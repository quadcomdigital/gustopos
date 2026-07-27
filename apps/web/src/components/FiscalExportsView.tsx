import { useEffect, useState } from 'react';
import { pushToast } from '../shared/ui/toast';
import { useAppStore } from '../store/app-store';
import { usePermission } from '../shared/authz/usePermission';
import ConfirmDialog from './ConfirmDialog';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export default function FiscalExportsView() {
  const [exportJobStatus, setExportJobStatus] = useState<'idle' | 'pending' | 'success' | 'failed'>('idle');
  const [loading, setLoading] = useState(false);
  const [businessDate, setBusinessDate] = useState(() => new Date().toISOString().slice(0, 10));
  const items = useAppStore((state) => state.fiscalExports);
  const refreshFiscalExports = useAppStore((state) => state.refreshFiscalExports);
  const closeFiscalDay = useAppStore((state) => state.closeFiscalDay);
  const createFiscalExport = useAppStore((state) => state.createFiscalExport);
  const downloadFiscalExportCsv = useAppStore((state) => state.downloadFiscalExportCsv);
  const [csvPreview, setCsvPreview] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);

  const mapError = (value: unknown) => {
    const message = value instanceof Error ? value.message : 'Errore modulo fiscale';
    if (message.includes('Fiscal day already closed')) return 'La giornata fiscale risulta gia chiusa.';
    return message;
  };

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      await refreshFiscalExports({ limit: 200 });
    } catch (loadError) {
      setError(mapError(loadError));
    } finally {
      setLoading(false);
    }
  };

  // Data loaded from store on mount — no redundant refetch needed

  const closeDay = async () => {
    if (!businessDate) {
      setError('Seleziona una data valida.');
      return;
    }
    setError('');
    setSuccess('');
    try {
      await closeFiscalDay({ businessDate, notes: 'Chiusura da UI' });
      await load();
      setSuccess('Chiusura giornaliera registrata.');
      pushToast('success', 'Chiusura giornaliera registrata.');
    } catch (closeError) {
      const message = mapError(closeError);
      setError(message);
      pushToast('error', message);
    }
  };

  const generateExport = async () => {
    if (!businessDate) {
      setError('Seleziona una data valida.');
      return;
    }
    setError('');
    setSuccess('');
    setExportJobStatus('pending');
    try {
      await createFiscalExport({ businessDate, format: 'csv' });
      await load();
      setExportJobStatus('success');
      setSuccess('Export CSV generato.');
      pushToast('success', 'Export CSV generato.');
    } catch (genError) {
      setExportJobStatus('failed');
      const message = mapError(genError);
      setError(message);
      pushToast('error', message);
    }
  };

  const printDailyReport = () => {
    const reportHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Report Giornaliero ${escapeHtml(businessDate)}</title>
        <style>
          body { font-family: monospace; padding: 20px; }
          h1 { font-size: 18px; border-bottom: 2px solid #000; padding-bottom: 5px; }
          table { width: 100%; border-collapse: collapse; margin: 10px 0; }
          td, th { padding: 4px 8px; border: 1px solid #ccc; text-align: left; font-size: 12px; }
          th { background: #f0f0f0; }
          .total { font-weight: bold; font-size: 14px; }
        </style>
      </head>
      <body>
        <h1>REPORT GIORNALIERO</h1>
        <p><strong>Data:</strong> ${escapeHtml(businessDate)}</p>
        <p><strong>Totale Export:</strong> ${items.length}</p>
        <table>
          <tr><th>ID</th><th>Stato</th><th>Generato</th></tr>
          ${items.map(item => `<tr><td>${escapeHtml(item.id)}</td><td>${escapeHtml(item.status)}</td><td>${escapeHtml(item.generatedAt)}</td></tr>`).join('')}
        </table>
        <p style="margin-top:20px; font-size:10px; color:#666;">Generato da GustoPOS — ${new Date().toLocaleString()}</p>
      </body>
      </html>
    `;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(reportHtml);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const previewCsv = async (id: string) => {
    setError('');
    try {
      const content = await downloadFiscalExportCsv(id);
      setCsvPreview(content);
      setSuccess('CSV caricato in anteprima.');
      pushToast('success', 'CSV caricato in anteprima.');

    } catch (previewError) {
      const message = mapError(previewError);
      setError(message);
      pushToast('error', message);
    }
  };

  const downloadCsv = async (id: string, businessDate: string) => {
    setError('');
    try {
      const content = await downloadFiscalExportCsv(id);
      const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.setAttribute('download', `fiscal_${businessDate}.csv`);
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      window.URL.revokeObjectURL(url);
      pushToast('success', 'Download CSV avviato.');
    } catch (downloadError) {
      const message = mapError(downloadError);
      setError(message);
      pushToast('error', message);
    }
  };

  const { can } = usePermission();

  if (!can('fiscalClose') && !can('fiscalExport')) {
    return (
      <div className="space-y-4">
        <div className="bg-white border border-border rounded-xl p-4">
          <h2 className="text-lg font-bold text-primary uppercase tracking-wide">Fiscal Exports (CSV)</h2>
          <p className="text-sm text-text-muted mt-2">Non hai i permessi per accedere a questa sezione.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-border rounded-xl p-4 space-y-3">
        <h2 className="text-lg font-bold text-primary uppercase tracking-wide">Fiscal Exports (CSV)</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <input
            type="date"
            value={businessDate}
            onChange={(event) => setBusinessDate(event.target.value)}
            className="px-3 py-2 rounded border border-border text-sm"
          />
          <button onClick={() => setConfirmCloseOpen(true)} disabled={loading} className="px-4 py-2 rounded border border-border text-xs font-bold uppercase tracking-wider disabled:opacity-50">Chiudi giornata</button>
          <button onClick={() => void generateExport()} disabled={loading} className="px-4 py-2 rounded bg-primary text-white text-xs font-bold uppercase tracking-wider disabled:opacity-50">Genera CSV</button>
          <button onClick={() => void load()} disabled={loading} className="px-4 py-2 rounded border border-border text-xs font-bold uppercase tracking-wider disabled:opacity-50">{loading ? '...' : 'Aggiorna'}</button>
          <button onClick={printDailyReport} className="px-4 py-2 rounded bg-accent text-white text-xs font-bold uppercase tracking-wider">Stampa Report</button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Stato export:</span>
          <span className="text-xs font-semibold">
            {exportJobStatus === 'idle' && 'idle'}
            {exportJobStatus === 'pending' && 'pending'}
            {exportJobStatus === 'success' && 'success'}
            {exportJobStatus === 'failed' && 'failed'}
          </span>
          {exportJobStatus === 'failed' && (
            <button
              onClick={() => void generateExport()}
              disabled={loading}
              className="px-2 py-1 rounded border border-border text-xs font-bold disabled:opacity-50"
            >
              Retry export
            </button>
          )}
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}
        {success && <p className="text-xs text-emerald-600 font-semibold">{success}</p>}
      </div>

      <div className="bg-white border border-border rounded-xl p-4 space-y-2">
        {items.map((item) => (
          <div key={item.id} className="border border-border rounded p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-secondary">{item.businessDate} • {item.status}</p>
              <p className="text-xs text-text-muted">{item.path}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 w-full sm:w-auto">
              <button onClick={() => void previewCsv(item.id)} className="px-2 py-2 rounded border border-border text-xs font-bold min-h-10">Preview</button>
              <button onClick={() => void downloadCsv(item.id, item.businessDate)} className="px-2 py-2 rounded border border-border text-xs font-bold min-h-10">Download</button>
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="text-xs text-text-muted">Nessun export fiscale.</p>}
      </div>

      {csvPreview && (
        <div className="bg-white border border-border rounded-xl p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted mb-2">Preview CSV</p>
          <pre className="text-xs text-text-muted overflow-auto whitespace-pre-wrap">{csvPreview}</pre>
        </div>
      )}

      <ConfirmDialog
        open={confirmCloseOpen}
        title="Conferma chiusura"
        message={`Confermi chiusura fiscale del ${businessDate}?`}
        confirmLabel="Chiudi giornata"
        cancelLabel="Annulla"
        onCancel={() => setConfirmCloseOpen(false)}
        onConfirm={() => {
          setConfirmCloseOpen(false);
          void closeDay();
        }}
      />
    </div>
  );
}

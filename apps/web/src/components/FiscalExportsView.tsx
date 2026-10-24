import { useEffect, useMemo, useState } from 'react';
import { pushToast } from '../shared/ui/toast';
import { useAppStore } from '../store/app-store';
import { usePermission } from '../shared/authz/usePermission';
import { cn } from '../lib/utils';
import ConfirmDialog from './ConfirmDialog';
import {
  fetchFiscalPrinterConfig,
  fetchFiscalProtocols,
  fetchFiscalJob,
  updateFiscalPrinterConfig,
  enqueueFiscalTestJob,
  enqueueFiscalChiusura,
  fetchFiscalJobs,
  programFiscalDepartments,
  readFiscalDepartments,
  registerFiscalLiveVerification,
  revokeFiscalLiveVerification,
} from '../shared/api/client';
import {
  describeFiscalDepartmentMapping,
  fiscalDepartmentMappingHasErrors,
  nextFreeDepartmentNumber,
  sortFiscalDepartments,
  validateFiscalDepartmentMapping,
} from '@gustopos/shared';
import type {
  FiscalDepartment,
  FiscalDepartmentRead,
  FiscalPrinterConfig,
  FiscalProtocolOption,
  FiscalJob,
} from '@gustopos/shared';

/** Risultato di un job fiscale decodificato dal server (progressivo, quadrature, reparti). */
type FiscalJobResultView = {
  progressive: string;
  counters: Record<string, string>;
  departments: FiscalDepartmentRead[];
  notes: string[];
};

const EMPTY_FISCAL_RESULT: FiscalJobResultView = { progressive: '', counters: {}, departments: [], notes: [] };

/**
 * Il `result` del job è JSON scritto dal server (l'agente non interpreta nulla):
 * qui si legge solo per mostrarlo. Qualunque forma inattesa diventa vuoto invece
 * di far esplodere la pagina.
 */
function parseFiscalJobResult(job: FiscalJob): FiscalJobResultView {
  if (!job.result) return EMPTY_FISCAL_RESULT;
  try {
    const parsed = JSON.parse(job.result) as Partial<FiscalJobResultView>;
    return {
      progressive: typeof parsed.progressive === 'string' ? parsed.progressive : '',
      counters: parsed.counters && typeof parsed.counters === 'object' ? parsed.counters : {},
      departments: Array.isArray(parsed.departments) ? parsed.departments : [],
      notes: Array.isArray(parsed.notes) ? parsed.notes.filter((note): note is string => typeof note === 'string') : [],
    };
  } catch {
    return EMPTY_FISCAL_RESULT;
  }
}

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
  const retryFiscalExport = useAppStore((state) => state.retryFiscalExport);
  const downloadFiscalExportCsv = useAppStore((state) => state.downloadFiscalExportCsv);
  const [csvPreview, setCsvPreview] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  // UX-004: mobile task split — Genera / Chiudi / Storico, one action per screen.
  const [mobileTab, setMobileTab] = useState<'generate' | 'close' | 'history'>('generate');

  // ── Certified fiscal printer (Path B: Registratore Telematico) ──────────
  const [printer, setPrinter] = useState<FiscalPrinterConfig | null>(null);
  const [savingPrinter, setSavingPrinter] = useState(false);
  const [jobs, setJobs] = useState<FiscalJob[]>([]);
  const [rtTestStatus, setRtTestStatus] = useState<'idle' | 'pending' | 'success' | 'failed'>('idle');
  // Catalogo dialetti (solo label: i codici di protocollo restano sul server).
  const [protocols, setProtocols] = useState<FiscalProtocolOption[]>([]);
  // Confronto con il RT: programmazione letta dal registratore e dichiarata dal
  // server. `layoutVerified` false = posizioni da manuale, mai confermate dal
  // vivo → il testo grezzo resta visibile accanto ai campi decodificati.
  const [rtDepartmentReads, setRtDepartmentReads] = useState<FiscalDepartmentRead[] | null>(null);
  const [rtReadNotes, setRtReadNotes] = useState<string[]>([]);
  const [rtReadStatus, setRtReadStatus] = useState<'idle' | 'pending' | 'success' | 'failed'>('idle');
  const [confirmProgramOpen, setConfirmProgramOpen] = useState(false);
  // Collaudo dal vivo: un protocollo nato dai manuali non emette corrispettivi
  // finché non c'è una prova gestionale completata su questa cassa. L'esito lo
  // registra il server e conserva l'evidenza (job + quadrature lette dal RT).
  const [verificationNote, setVerificationNote] = useState('');
  const [verificationStatus, setVerificationStatus] = useState<'idle' | 'pending' | 'success' | 'failed'>('idle');
  const [verificationMessage, setVerificationMessage] = useState('');
  const [confirmRevokeVerificationOpen, setConfirmRevokeVerificationOpen] = useState(false);

  const allCategories = useAppStore((state) => state.data?.categories);
  const menuCategories = useMemo(
    () => (allCategories ?? []).filter((category) => category.scope === 'menu' && category.isActive),
    [allCategories],
  );

  const activeProtocol = protocols.find((option) => option.id === printer?.dialectId) ?? null;

  // Collaudo registrato per il protocollo attivo (null = emissione bloccata
  // finché non si collauda: il gate è anche server-side, non solo nella UI).
  const liveVerification = useMemo(
    () => printer?.liveVerifications.find((entry) => entry.protocolId === activeProtocol?.id) ?? null,
    [printer, activeProtocol],
  );

  // Seriale = il campo `host` porta il *dispositivo* (porta seriale), non un IP:
  // la porta TCP non ha senso su quel collegamento.
  const isSerial = printer?.transport === 'serial';

  // Mappa reparti del protocollo attivo: la numerazione è per piattaforma, quindi
  // ogni dialetto ha la sua tabella (vedi docs/16_catalogo-dialetti).
  const departments = useMemo(() => {
    if (!printer || !activeProtocol) return [];
    const group = printer.departmentMappings.find((entry) => entry.protocolId === activeProtocol.id);
    return sortFiscalDepartments(group?.departments ?? []);
  }, [printer, activeProtocol]);

  const departmentIssues = useMemo(() => validateFiscalDepartmentMapping(departments), [departments]);
  const departmentErrors = departmentIssues.filter((issue) => issue.level === 'error');
  const departmentWarnings = departmentIssues.filter((issue) => issue.level === 'warning');

  const setDepartments = (next: FiscalDepartment[]) => {
    setPrinter((current) => {
      if (!current || !activeProtocol) return current;
      const others = current.departmentMappings.filter((entry) => entry.protocolId !== activeProtocol.id);
      return {
        ...current,
        departmentMappings: [...others, { protocolId: activeProtocol.id, departments: sortFiscalDepartments(next) }],
      };
    });
  };

  const updateDepartment = (index: number, patch: Partial<FiscalDepartment>) => {
    setDepartments(departments.map((entry, position) => (position === index ? { ...entry, ...patch } : entry)));
  };

  const toggleCategory = (index: number, categoryId: string) => {
    const entry = departments[index];
    if (!entry) return;
    const categoryIds = entry.categoryIds.includes(categoryId)
      ? entry.categoryIds.filter((id) => id !== categoryId)
      : [...entry.categoryIds, categoryId];
    updateDepartment(index, { categoryIds });
  };

  const addDepartment = () => {
    const nextNumber = nextFreeDepartmentNumber(departments);
    if (nextNumber === null) return;
    setDepartments([
      ...departments,
      { department: nextNumber, label: '', vatRate: null, kind: 'unknown', categoryIds: [], isDefault: departments.length === 0 },
    ]);
  };

  const removeDepartment = (index: number) => {
    setDepartments(departments.filter((_, position) => position !== index));
  };

  const mapError = (value: unknown) => {
    const message = value instanceof Error ? value.message : 'Errore modulo fiscale';
    if (message.includes('Fiscal day already closed')) return 'La giornata fiscale risulta gia chiusa.';
    return message;
  };

  const loadProtocols = async () => {
    try {
      const { protocols: catalog } = await fetchFiscalProtocols();
      setProtocols(catalog);
    } catch {
      // Non fatale: senza catalogo il pannello resta sull'adattatore storico
      // dentro l'agente (nessuna emissione dialetto viene selezionata).
    }
  };

  const loadPrinterConfig = async () => {
    try {
      const { fiscalPrinter } = await fetchFiscalPrinterConfig();
      setPrinter(fiscalPrinter);
    } catch (configError) {
      setError(mapError(configError));
    }
  };

  const refreshFiscalJobs = async () => {
    try {
      const { jobs: jobList } = await fetchFiscalJobs({ limit: 10 });
      setJobs(jobList);
    } catch {
      // Non-fatal: jobs list is informational.
    }
  };

  const selectProtocol = (value: string) => {
    setPrinter((current) => {
      if (!current) return current;
      if (value === '') {
        return { ...current, dialectId: null };
      }
      const option = protocols.find((candidate) => candidate.id === value);
      if (!option) return current;
      const modelStillValid = option.models.some((model) => model.id === current.dialectModel);
      return {
        ...current,
        dialectId: option.id,
        dialectModel: modelStillValid ? current.dialectModel : option.defaultModel,
        dialectVersion: option.versions.includes(current.dialectVersion) ? current.dialectVersion : option.defaultVersion,
        transport: option.transports.includes(current.transport) ? current.transport : option.transports[0] ?? current.transport,
        port: option.defaultPort ?? current.port,
      };
    });
  };

  const savePrinter = async () => {
    if (!printer) return;
    setSavingPrinter(true);
    setError('');
    setSuccess('');
    try {
      const { fiscalPrinter: updated } = await updateFiscalPrinterConfig({ fiscalPrinter: printer });
      setPrinter(updated);
      setSuccess('Configurazione RT salvata.');
      pushToast('success', 'Configurazione RT salvata.');
    } catch (saveError) {
      const message = mapError(saveError);
      setError(message);
      pushToast('error', message);
    } finally {
      setSavingPrinter(false);
    }
  };

  /**
   * Attende l'esito del job: l'agente reclama il lavoro al primo polling
   * (l'heartbeat gira ogni pochi secondi), quindi il risultato non è
   * disponibile subito. Oltre il numero di tentativi non si inventa nulla:
   * il job resta in lista e la UI lo dice.
   */
  const awaitFiscalJob = async (initial: FiscalJob, attempts = 12): Promise<FiscalJob> => {
    let current = initial;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      if (current.status === 'completed' || current.status === 'failed') return current;
      await new Promise((resolve) => setTimeout(resolve, 900));
      try {
        const { job } = await fetchFiscalJob(initial.id);
        current = job;
      } catch {
        return current;
      }
    }
    return current;
  };

  /**
   * Lettura della programmazione reparti dal RT: chiude il cerchio della
   * mappatura (i numeri configurati sono quelli che il registratore usa
   * davvero? aliquota e natura coincidono?). I reparti da leggere sono quelli
   * della mappatura salvata: leggere reparti non configurati non direbbe nulla.
   */
  const readRtDepartments = async () => {
    setRtReadStatus('pending');
    setError('');
    setSuccess('');
    setRtReadNotes([]);
    try {
      const { job, warnings } = await readFiscalDepartments({
        departments: departments.length > 0 ? departments.map((entry) => entry.department) : undefined,
      });
      const finished = await awaitFiscalJob(job);
      await refreshFiscalJobs();
      const result = parseFiscalJobResult(finished);
      setRtDepartmentReads(result.departments);
      setRtReadNotes([...warnings, ...result.notes]);
      if (finished.status === 'failed') {
        setRtReadStatus('failed');
        const message = finished.error ?? 'Lettura reparti non riuscita.';
        setError(message);
        pushToast('error', message);
        return;
      }
      setRtReadStatus('success');
      setSuccess(
        result.departments.length > 0
          ? 'Programmazione reparti letta dal RT: confronta i valori con la mappatura.'
          : 'Lettura inviata: il RT non ha restituito valori decodificabili (vedi note).',
      );
    } catch (readError) {
      setRtReadStatus('failed');
      const message = mapError(readError);
      setError(message);
      pushToast('error', message);
    }
  };

  /**
   * Programmazione dei reparti sul RT: scrive aliquota e natura bene/servizio
   * nella memoria del registratore. Solo i reparti completi (aliquota e natura
   * definite) vengono scritti: un reparto "da definire" è una mappatura a metà,
   * e scriverla sul RT significherebbe emettere con l'aliquota sbagliata.
   */
  const programRtDepartments = async () => {
    const ready = departments.filter((entry) => entry.vatRate !== null && entry.kind !== 'unknown');
    if (ready.length === 0) {
      setError('Imposta aliquota e natura (bene/servizio) dei reparti prima di programmarli sul RT.');
      return;
    }
    setConfirmProgramOpen(false);
    setRtReadStatus('pending');
    setError('');
    setSuccess('');
    try {
      const { job, warnings } = await programFiscalDepartments({
        confirm: true,
        departments: ready.map((entry) => ({
          department: entry.department,
          vatRate: entry.vatRate as number,
          kind: entry.kind === 'service' ? 'service' : 'good',
          label: entry.label,
          priceCents: 0,
        })),
      });
      const finished = await awaitFiscalJob(job);
      await refreshFiscalJobs();
      setRtReadNotes([...warnings, ...parseFiscalJobResult(finished).notes]);
      if (finished.status === 'failed') {
        setRtReadStatus('failed');
        const message = finished.error ?? 'Programmazione reparti non riuscita.';
        setError(message);
        pushToast('error', message);
        return;
      }
      setRtReadStatus('success');
      setSuccess(`Programmazione inviata al RT per ${ready.length} reparti: verifica con la lettura.`);
      pushToast('success', 'Reparti programmati sul RT.');
    } catch (programError) {
      setRtReadStatus('failed');
      const message = mapError(programError);
      setError(message);
      pushToast('error', message);
    }
  };

  /** Confronto mappatura configurata ↔ programmazione letta dal RT. */
  const departmentComparison = useMemo(() => {
    if (!rtDepartmentReads) return [];
    return departments.map((entry) => {
      const read = rtDepartmentReads.find((item) => item.department === entry.department) ?? null;
      return {
        entry,
        read,
        vatMismatch: read !== null && read.vatRate !== null && entry.vatRate !== null && read.vatRate !== entry.vatRate,
        kindMismatch:
          read !== null && read.kind !== 'unknown' && entry.kind !== 'unknown' && read.kind !== entry.kind,
      };
    });
  }, [departments, rtDepartmentReads]);

  const unconfiguredRtDepartments = useMemo(
    () => (rtDepartmentReads ?? []).filter((item) => !departments.some((entry) => entry.department === item.department)),
    [rtDepartmentReads, departments],
  );

  const testPrinter = async () => {
    setRtTestStatus('pending');
    setError('');
    setSuccess('');
    try {
      const { job, warnings } = await enqueueFiscalTestJob();
      await refreshFiscalJobs();
      if (job.status === 'failed') {
        setRtTestStatus('failed');
        setError(job.error ?? 'Test RT fallito.');
        return;
      }
      setRtTestStatus('success');
      setSuccess(
        warnings.length > 0
          ? `Test RT accodato. Avvisi del protocollo: ${warnings.join(' · ')}`
          : 'Test RT accodato: verifica il progressivo sui lavori fiscali.',
      );
      pushToast('success', 'Test RT accodato.');
    } catch (testError) {
      setRtTestStatus('failed');
      const message = mapError(testError);
      setError(message);
      pushToast('error', message);
    }
  };

  /**
   * Registra il collaudo del protocollo attivo: da qui in poi i corrispettivi
   * sono emettibili. Il collaudo non è una dichiarazione — il server pretende
   * una **prova gestionale completata** per quel protocollo e ne conserva
   * l'evidenza — quindi l'errore dice cosa manca invece di essere un rifiuto
   * muto.
   */
  const registerVerification = async () => {
    setVerificationStatus('pending');
    setVerificationMessage('');
    try {
      const { fiscalPrinter } = await registerFiscalLiveVerification({ note: verificationNote.trim() });
      setPrinter(fiscalPrinter);
      setVerificationNote('');
      setVerificationStatus('success');
      setVerificationMessage(
        'Collaudo registrato: l\'emissione dei corrispettivi è abilitata per questo protocollo.',
      );
      pushToast('success', 'Collaudo registrato.');
    } catch (verificationError) {
      const message = mapError(verificationError);
      setVerificationStatus('failed');
      setVerificationMessage(message);
      pushToast('error', message);
    }
  };

  /** Revoca il collaudo: l'emissione torna bloccata fino a una nuova prova. */
  const revokeVerification = async () => {
    setConfirmRevokeVerificationOpen(false);
    setVerificationStatus('pending');
    setVerificationMessage('');
    try {
      const { fiscalPrinter } = await revokeFiscalLiveVerification();
      setPrinter(fiscalPrinter);
      setVerificationStatus('success');
      setVerificationMessage('Collaudo revocato: l\'emissione dei corrispettivi è di nuovo bloccata.');
      pushToast('success', 'Collaudo revocato.');
    } catch (revokeError) {
      const message = mapError(revokeError);
      setVerificationStatus('failed');
      setVerificationMessage(message);
      pushToast('error', message);
    }
  };

  const runChiusura = async () => {
    setRtTestStatus('pending');
    setError('');
    setSuccess('');
    try {
      const { job, warnings } = await enqueueFiscalChiusura(businessDate);
      await refreshFiscalJobs();
      if (job.status === 'failed') {
        setRtTestStatus('failed');
        setError(job.error ?? 'Chiusura RT fallita.');
        return;
      }
      setRtTestStatus('success');
      setSuccess(
        warnings.length > 0
          ? `Chiusura RT accodata. Avvisi del protocollo: ${warnings.join(' · ')}`
          : `Chiusura RT ${businessDate} accodata all'agente.`,
      );
      pushToast('success', 'Chiusura RT accodata.');
    } catch (chiusuraError) {
      setRtTestStatus('failed');
      const message = mapError(chiusuraError);
      setError(message);
      pushToast('error', message);
    }
  };

  useEffect(() => {
    void loadPrinterConfig();
    void loadProtocols();
    void refreshFiscalJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Query-aware TTL: refreshFiscalExports short-circuits when the same query
  // was fetched within the last 30s, so navigating away and back does not
  // refetch. The explicit "Aggiorna" button passes force to bypass the cache.
  const load = async (force = false) => {
    setLoading(true);
    setError('');
    try {
      await refreshFiscalExports({ limit: 200 }, force);
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
      const result = await createFiscalExport({ businessDate, format: 'csv' });
      await load();
      // Generation failures are persisted server-side as a status:'failed'
      // row and returned (not thrown), so the view must inspect the status
      // instead of assuming any response means success.
      if (result.status === 'failed') {
        setExportJobStatus('failed');
        const message = result.error ?? 'Generazione export fallita.';
        setError(message);
        pushToast('error', message);
        return;
      }
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

  const retryExport = async (id: string) => {
    setError('');
    setSuccess('');
    try {
      const result = await retryFiscalExport(id);
      await load();
      if (result.status === 'failed') {
        setError(result.error ?? 'Nuovo tentativo fallito.');
        pushToast('error', result.error ?? 'Nuovo tentativo fallito.');
        return;
      }
      setSuccess('Export rigenerato con successo.');
      pushToast('success', 'Export rigenerato con successo.');
    } catch (retryError) {
      const message = mapError(retryError);
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
        <p style="margin-top:20px; font-size:10px; color:#666;">Generato da OmniRestaurant — ${new Date().toLocaleString()}</p>
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
      {/* Mobile tab switcher (UX-004) */}
      <div role="tablist" aria-label="Sezioni fiscali" className="md:hidden grid grid-cols-3 gap-1 bg-white border border-border rounded-xl p-1.5">
        {([
          { key: 'generate' as const, label: 'Genera' },
          { key: 'close' as const, label: 'Chiudi' },
          { key: 'history' as const, label: 'Storico' },
        ]).map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={mobileTab === tab.key}
            onClick={() => setMobileTab(tab.key)}
            className={cn(
              'px-2 py-3 rounded-lg text-xs font-bold uppercase tracking-wider transition-all min-h-[44px]',
              mobileTab === tab.key ? 'bg-primary text-white shadow-sm' : 'bg-bg/50 text-text-muted',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Certified fiscal printer (Registratore Telematico) — Path B */}
      <div className="bg-white border border-border rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-primary uppercase tracking-wide">Registratore Telematico</h2>
          <span className={cn('px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider', printer?.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-bg text-text-muted')}>
            {printer?.enabled ? 'Attivo' : 'Disattivato'}
          </span>
        </div>
        <p className="text-xs text-text-muted">
          Connessione al registratore via agente stampa (protocollo RT su TCP/IP locale).
          L'emissione fiscale è <strong>opt-in per singola transazione</strong> — mai obbligatoria.
        </p>
        <p className="text-[11px] text-text-muted bg-bg/50 rounded-lg px-3 py-2">
          ⚠️ L'agente che emette deve avere assegnata l'area <strong>cassa</strong> (Stampanti → Aree).
          Senza area cassa i lavori fiscali non vengono prelevati.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Protocollo fiscale</span>
            <select
              aria-label="Protocollo fiscale"
              value={printer?.dialectId ?? ''}
              onChange={(event) => selectProtocol(event.target.value)}
              className="mt-1 w-full px-3 py-2 rounded border border-border text-sm bg-white"
            >
              <option value="">Adattatore nell'agente (impostazione storica)</option>
              {protocols.map((option) => (
                <option key={option.id} value={option.id} disabled={!option.selectionEnabled}>
                  {option.label}
                  {option.status === 'verified' ? ' — verificato' : option.selectionEnabled ? ' — da collaudare' : ' — non disponibile'}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-[10px] leading-snug text-text-muted">
              Cambia protocollo, modello e versione senza aggiornare l'agente: i codici di dialogo restano sul server.
            </span>
          </label>
          {activeProtocol ? (
            <>
              <label className="block">
                <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Modello</span>
                <select
                  aria-label="Modello"
                  value={printer?.dialectModel || activeProtocol.defaultModel}
                  onChange={(event) => setPrinter((current) => current ? { ...current, dialectModel: event.target.value } : current)}
                  className="mt-1 w-full px-3 py-2 rounded border border-border text-sm bg-white"
                >
                  {activeProtocol.models.map((model) => (
                    <option key={model.id} value={model.id}>{model.label}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Versione / firmware</span>
                {activeProtocol.versions.length > 0 ? (
                  <select
                    aria-label="Versione / firmware"
                    value={printer?.dialectVersion || activeProtocol.defaultVersion}
                    onChange={(event) => setPrinter((current) => current ? { ...current, dialectVersion: event.target.value } : current)}
                    className="mt-1 w-full px-3 py-2 rounded border border-border text-sm bg-white"
                  >
                    {!activeProtocol.defaultVersion && <option value="">Da confermare in collaudo</option>}
                    {activeProtocol.versions.map((version) => (
                      <option key={version} value={version}>{version}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    aria-label="Versione / firmware"
                    type="text"
                    value={printer?.dialectVersion ?? ''}
                    placeholder="es. firmware da leggere sul RT"
                    onChange={(event) => setPrinter((current) => current ? { ...current, dialectVersion: event.target.value } : current)}
                    className="mt-1 w-full px-3 py-2 rounded border border-border text-sm"
                  />
                )}
              </label>
              <label className="block">
                <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Collegamento</span>
                <select
                  aria-label="Collegamento"
                  value={printer?.transport ?? 'tcp'}
                  onChange={(event) => setPrinter((current) => current ? { ...current, transport: event.target.value as FiscalPrinterConfig['transport'] } : current)}
                  className="mt-1 w-full px-3 py-2 rounded border border-border text-sm bg-white"
                >
                  {activeProtocol.transports.map((transport) => (
                    <option key={transport} value={transport} disabled={transport === 'usb'}>
                      {transport === 'tcp'
                        ? 'Rete TCP/IP'
                        : transport === 'serial'
                          ? 'Seriale RS232 (cavo RJ45 ↔ DB9)'
                          : 'USB (adattatore USB-seriale: usare Seriale RS232)'}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : (
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Modello (adattatore nell'agente)</span>
              <select
                aria-label="Modello (adattatore nell'agente)"
                value={printer?.model ?? 'generic-rt'}
                onChange={(event) => setPrinter((current) => current ? { ...current, model: event.target.value as FiscalPrinterConfig['model'] } : current)}
                className="mt-1 w-full px-3 py-2 rounded border border-border text-sm bg-white"
              >
                <option value="generic-rt">Generico (protocollo RT)</option>
                <option value="epson-tm-s1000">Epson TM-S1000</option>
                <option value="custom-vkp80iii">Custom VKP80 III</option>
              </select>
            </label>
          )}
          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
              {isSerial ? 'Dispositivo seriale' : 'Host / IP'}
            </span>
            <input
              aria-label={isSerial ? 'Dispositivo seriale' : 'Host / IP'}
              type="text"
              value={printer?.host ?? ''}
              placeholder={isSerial ? '/dev/ttyUSB0 (Linux) o COM3 (Windows)' : '192.168.1.50'}
              onChange={(event) => setPrinter((current) => current ? { ...current, host: event.target.value } : current)}
              className="mt-1 w-full px-3 py-2 rounded border border-border text-sm"
            />
          </label>
          {!isSerial && (
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Porta</span>
              <input
                aria-label="Porta"
                type="number"
                min={1}
                max={65535}
                value={printer?.port ?? 4001}
                onChange={(event) => setPrinter((current) => current ? { ...current, port: Number(event.target.value) } : current)}
                className="mt-1 w-full px-3 py-2 rounded border border-border text-sm"
              />
            </label>
          )}
          {activeProtocol && isSerial && (
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Baud</span>
              <input
                aria-label="Baud"
                type="number"
                min={300}
                max={115200}
                value={printer.baud}
                onChange={(event) => setPrinter((current) => current ? { ...current, baud: Number(event.target.value) } : current)}
                className="mt-1 w-full px-3 py-2 rounded border border-border text-sm"
              />
            </label>
          )}
          <label className="flex items-end gap-2 pb-1">
            <input
              type="checkbox"
              checked={printer?.enabled ?? false}
              onChange={(event) => setPrinter((current) => current ? { ...current, enabled: event.target.checked } : current)}
              className="h-4 w-4 accent-primary"
            />
            <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Abilita stampante fiscale</span>
          </label>
        </div>
        {activeProtocol && (
          <div className="rounded-lg border border-border bg-bg/40 px-3 py-2 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider',
                  activeProtocol.status === 'verified'
                    ? 'bg-emerald-100 text-emerald-700'
                    : activeProtocol.status === 'documented'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-bg text-text-muted',
                )}
              >
                {activeProtocol.status === 'verified' ? 'Verificato dal vivo' : activeProtocol.status === 'documented' ? 'Da manuale, non verificato' : 'Catalogazione non iniziata'}
              </span>
              {activeProtocol.requiresAgentVersion && (
                <span className="text-[10px] font-semibold text-text-muted">
                  richiede agente stampa ≥ {activeProtocol.requiresAgentVersion}
                </span>
              )}
              {activeProtocol.emissionGated && (
                <span
                  className={cn(
                    'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider',
                    liveVerification ? 'bg-emerald-100 text-emerald-700' : 'bg-danger/10 text-danger',
                  )}
                >
                  {liveVerification
                    ? `Collaudo registrato il ${new Date(liveVerification.verifiedAt).toLocaleDateString('it-IT')}`
                    : 'Emissione bloccata fino al collaudo'}
                </span>
              )}
            </div>
            <p className="text-[11px] leading-snug text-text-muted">{activeProtocol.statusNote}</p>
            {activeProtocol.emissionGated && (
              <div className="mt-1 border-t border-border/60 pt-2 space-y-1.5">
                {liveVerification ? (
                  <>
                    <p className="text-[11px] leading-snug text-text-muted">
                      Collaudo del <strong>{new Date(liveVerification.verifiedAt).toLocaleString('it-IT')}</strong>
                      {liveVerification.agentVersion ? ` con l'agente ${liveVerification.agentVersion}` : ''}
                      {liveVerification.testJobId ? ` (prova gestionale ${liveVerification.testJobId})` : ''}.
                      {liveVerification.counters['gran totale'] && (
                        <>
                          {' '}Gran Totale al collaudo: <strong>{liveVerification.counters['gran totale']}</strong>
                          {liveVerification.counters.corrispettivi ? `, corrispettivi ${liveVerification.counters.corrispettivi}` : ''}.
                        </>
                      )}
                    </p>
                    {liveVerification.note && (
                      <p className="text-[11px] text-text-muted">Nota del collaudo: {liveVerification.note}</p>
                    )}
                    <button
                      onClick={() => setConfirmRevokeVerificationOpen(true)}
                      disabled={verificationStatus === 'pending'}
                      className="px-3 py-1.5 rounded border border-border text-[11px] font-bold uppercase tracking-wider disabled:opacity-50"
                    >
                      Revoca collaudo
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-[11px] leading-snug text-text-muted">
                      I corrispettivi restano bloccati finché non c'è una <strong>prova gestionale completata</strong> su
                      questa cassa: usa <em>Test connessione</em> (documento non fiscale, nessun corrispettivo) e poi
                      registra l'esito. La prova e le quadrature lette dal RT restano come evidenza del collaudo.
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        aria-label="Nota del collaudo"
                        type="text"
                        maxLength={300}
                        value={verificationNote}
                        placeholder="Nota del collaudo (chi, dove, esito)"
                        onChange={(event) => setVerificationNote(event.target.value)}
                        className="px-2 py-1.5 rounded border border-border text-[11px] flex-1 min-w-[200px]"
                      />
                      <button
                        onClick={() => void registerVerification()}
                        disabled={verificationStatus === 'pending' || !printer?.host}
                        className="px-3 py-1.5 rounded bg-emerald-600 text-white text-[11px] font-bold uppercase tracking-wider disabled:opacity-50"
                      >
                        {verificationStatus === 'pending' ? 'Registrazione...' : 'Registra esito collaudo'}
                      </button>
                    </div>
                  </>
                )}
                {verificationMessage && (
                  <p
                    className={cn(
                      'text-[11px] font-semibold',
                      verificationStatus === 'failed' ? 'text-danger' : 'text-emerald-700',
                    )}
                  >
                    {verificationMessage}
                  </p>
                )}
              </div>
            )}
            <p className="text-[10px] leading-snug text-text-muted">
              I comandi di protocollo sono composti dal server e non vengono mai spediti al browser: in Impostazioni si sceglie
              solo protocollo, modello e versione.
            </p>
          </div>
        )}
        <div className="rounded-lg border border-border p-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted">Reparti del RT</h3>
            {activeProtocol && (
              <button
                onClick={addDepartment}
                disabled={departments.length >= 99}
                className="px-2.5 py-1.5 rounded border border-border text-[11px] font-bold uppercase tracking-wider disabled:opacity-50"
              >
                Aggiungi reparto
              </button>
            )}
          </div>
          {!activeProtocol ? (
            <p className="text-[11px] leading-snug text-text-muted">
              Scegli prima un <strong>protocollo fiscale</strong>: la numerazione dei reparti è specifica della
              piattaforma, quindi la mappatura si configura per protocollo.
            </p>
          ) : (
            <>
              <p className="text-[11px] leading-snug text-text-muted">
                Associa le categorie del menu ai reparti del RT per <strong>{activeProtocol.label}</strong>. Il reparto
                determina aliquota e natura bene/servizio del corrispettivo: i numeri devono corrispondere alla
                programmazione del RT (`&gt;R…`), che si fa una volta sola in assistenza. La vendita resta sul server,
                che traduce categoria → reparto quando compone il documento.
              </p>
              {departments.length === 0 && (
                <p className="text-[11px] text-text-muted">Nessun reparto mappato: con questa configurazione nessuna vendita può essere emessa.</p>
              )}
              <div className="space-y-2">
                {departments.map((entry, index) => (
                  <div key={`${entry.department}-${index}`} className="rounded border border-border p-2 space-y-2">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <label className="block">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Reparto</span>
                        <input
                          aria-label={`Numero reparto ${index + 1}`}
                          type="number"
                          min={1}
                          max={99}
                          value={entry.department}
                          onChange={(event) => updateDepartment(index, { department: Number(event.target.value) })}
                          className="mt-1 w-full px-2 py-1.5 rounded border border-border text-sm"
                        />
                      </label>
                      <label className="block">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Descrizione</span>
                        <input
                          aria-label={`Descrizione reparto ${index + 1}`}
                          type="text"
                          maxLength={36}
                          value={entry.label}
                          onChange={(event) => updateDepartment(index, { label: event.target.value })}
                          className="mt-1 w-full px-2 py-1.5 rounded border border-border text-sm"
                        />
                      </label>
                      <label className="block">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Aliquota IVA</span>
                        <select
                          aria-label={`Aliquota reparto ${index + 1}`}
                          value={entry.vatRate === null ? '' : String(entry.vatRate)}
                          onChange={(event) => updateDepartment(index, { vatRate: event.target.value === '' ? null : Number(event.target.value) })}
                          className="mt-1 w-full px-2 py-1.5 rounded border border-border text-sm bg-white"
                        >
                          <option value="">Da rilevare sul RT</option>
                          {[0, 4, 5, 10, 22].map((rate) => (
                            <option key={rate} value={rate}>{rate}%</option>
                          ))}
                        </select>
                      </label>
                      <label className="block">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Natura</span>
                        <select
                          aria-label={`Natura reparto ${index + 1}`}
                          value={entry.kind}
                          onChange={(event) => updateDepartment(index, { kind: event.target.value as FiscalDepartment['kind'] })}
                          className="mt-1 w-full px-2 py-1.5 rounded border border-border text-sm bg-white"
                        >
                          <option value="unknown">Da definire</option>
                          <option value="good">Bene</option>
                          <option value="service">Servizio</option>
                        </select>
                      </label>
                    </div>
                    <div className="flex flex-wrap items-start gap-3">
                      <label className="block min-w-[220px] flex-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Categorie menu</span>
                        <select
                          aria-label={`Categorie reparto ${entry.department}`}
                          multiple
                          size={Math.min(4, Math.max(2, menuCategories.length))}
                          value={entry.categoryIds}
                          onChange={(event) => {
                            const selected = Array.from(event.target.selectedOptions).map((option) => option.value);
                            updateDepartment(index, { categoryIds: selected });
                          }}
                          className="mt-1 w-full px-2 py-1.5 rounded border border-border text-sm bg-white"
                        >
                          {menuCategories.map((category) => (
                            <option key={category.id} value={category.id}>{category.name}</option>
                          ))}
                        </select>
                        {entry.categoryIds.length > 0 && (
                          <span className="mt-1 flex flex-wrap gap-1">
                            {entry.categoryIds.map((categoryId) => {
                              const category = menuCategories.find((candidate) => candidate.id === categoryId);
                              return (
                                <button
                                  key={categoryId}
                                  onClick={() => toggleCategory(index, categoryId)}
                                  className="px-1.5 py-0.5 rounded bg-bg text-[10px] text-text-muted"
                                  title="Rimuovi la categoria da questo reparto"
                                >
                                  {category?.name ?? categoryId} ✕
                                </button>
                              );
                            })}
                          </span>
                        )}
                      </label>
                      <div className="space-y-1 pt-1">
                        <label className="flex items-center gap-2">
                          <input
                            aria-label={`Reparto di ripiego ${entry.department}`}
                            type="checkbox"
                            checked={entry.isDefault}
                            onChange={(event) => updateDepartment(index, { isDefault: event.target.checked })}
                            className="h-4 w-4 accent-primary"
                          />
                          <span className="text-[11px] font-semibold text-text-muted">Reparto di ripiego</span>
                        </label>
                        <button
                          onClick={() => removeDepartment(index)}
                          className="px-2 py-1 rounded border border-border text-[11px] font-bold uppercase tracking-wider"
                        >
                          Rimuovi
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {departments.length > 0 && (
                <p className="text-[10px] text-text-muted">{describeFiscalDepartmentMapping(departments)}</p>
              )}
              {departmentErrors.map((issue) => (
                <p key={issue.message} className="text-[11px] font-semibold text-danger">✕ {issue.message}</p>
              ))}
              {departmentWarnings.map((issue) => (
                <p key={issue.message} className="text-[11px] text-amber-700">! {issue.message}</p>
              ))}
              <p className="text-[10px] leading-snug text-text-muted">
                Una categoria non mappata finisce sul reparto di ripiego; se il ripiego non c'è, l'emissione si ferma con
                un errore esplicito invece di emettere un corrispettivo con l'aliquota sbagliata.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => void readRtDepartments()}
                  disabled={rtReadStatus === 'pending' || !printer?.host || departments.length === 0}
                  className="px-3 py-1.5 rounded border border-border text-[11px] font-bold uppercase tracking-wider disabled:opacity-50"
                >
                  {rtReadStatus === 'pending' ? 'Lettura in corso...' : 'Leggi dal RT'}
                </button>
                <button
                  onClick={() => setConfirmProgramOpen(true)}
                  disabled={
                    rtReadStatus === 'pending' ||
                    !printer?.host ||
                    departments.length === 0 ||
                    departments.every((entry) => entry.vatRate === null || entry.kind === 'unknown')
                  }
                  className="px-3 py-1.5 rounded border-2 border-amber-500 text-amber-700 text-[11px] font-bold uppercase tracking-wider disabled:opacity-50"
                >
                  Programma sul RT
                </button>
              </div>
              {confirmProgramOpen && (
                <div className="rounded border-2 border-amber-500 bg-amber-50 p-3 space-y-2">
                  <p className="text-[11px] font-semibold text-amber-800">
                    La programmazione <strong>scrive</strong> nella memoria del registratore: aliquota IVA e natura
                    bene/servizio dei reparti indicati qui sotto sostituiscono quelle attuali. Su un RT certificato è
                    un'operazione da fare con il tecnico presente.
                  </p>
                  <ul className="text-[11px] text-amber-900 space-y-0.5">
                    {departments
                      .filter((entry) => entry.vatRate !== null && entry.kind !== 'unknown')
                      .map((entry) => (
                        <li key={entry.department}>
                          Reparto {entry.department}
                          {entry.label ? ` — ${entry.label}` : ''}: IVA {entry.vatRate}%,{' '}
                          {entry.kind === 'service' ? 'servizio' : 'bene'}
                        </li>
                      ))}
                  </ul>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => void programRtDepartments()}
                      className="px-3 py-1.5 rounded bg-amber-600 text-white text-[11px] font-bold uppercase tracking-wider"
                    >
                      Confermo la scrittura sul RT
                    </button>
                    <button
                      onClick={() => setConfirmProgramOpen(false)}
                      className="px-3 py-1.5 rounded border border-border text-[11px] font-bold uppercase tracking-wider"
                    >
                      Annulla
                    </button>
                  </div>
                </div>
              )}
              {rtDepartmentReads && (
                <div className="rounded border border-border p-2 space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Confronto con il RT</p>
                  {departmentComparison.length === 0 ? (
                    <p className="text-[11px] text-text-muted">Nessun reparto configurato da confrontare.</p>
                  ) : (
                    <table className="w-full text-[11px]">
                      <thead>
                        <tr className="text-text-muted uppercase text-[10px]">
                          <th className="text-left">Reparto</th>
                          <th className="text-left">Configurato</th>
                          <th className="text-left">Sul RT</th>
                        </tr>
                      </thead>
                      <tbody>
                        {departmentComparison.map((row) => (
                          <tr key={row.entry.department} className="border-t border-border/60">
                            <td className="py-1 font-semibold">{row.entry.department}</td>
                            <td className="py-1">
                              IVA {row.entry.vatRate === null ? 'da rilevare' : `${row.entry.vatRate}%`} ·{' '}
                              {row.entry.kind === 'unknown' ? 'natura da definire' : row.entry.kind === 'service' ? 'servizio' : 'bene'}
                            </td>
                            <td className={cn('py-1', (row.vatMismatch || row.kindMismatch) && 'font-semibold text-danger')}>
                              {row.read === null ? (
                                'nessuna lettura'
                              ) : (
                                <>
                                  IVA {row.read.vatRate === null ? '?' : `${row.read.vatRate}%`} ·{' '}
                                  {row.read.kind === 'unknown' ? 'natura ?' : row.read.kind === 'service' ? 'servizio' : 'bene'}
                                  {row.vatMismatch && ' ⚠ aliquota diversa'}
                                  {row.kindMismatch && ' ⚠ natura diversa'}
                                </>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  {unconfiguredRtDepartments.length > 0 && (
                    <p className="text-[11px] leading-snug text-amber-700">
                      Il RT risponde anche per reparti non configurati qui:{' '}
                      {unconfiguredRtDepartments.map((item) => item.department).join(', ')} (grezzo:{' '}
                      {unconfiguredRtDepartments
                        .map((item) => `«${item.raw}»`)
                        .slice(0, 3)
                        .join(' ')}
                      ).
                    </p>
                  )}
                  <p className="text-[10px] leading-snug text-text-muted">
                    I campi decodificati vengono dalle posizioni del manuale:{' '}
                    {rtDepartmentReads.some((item) => !item.layoutVerified)
                      ? 'nessuna lettura è stata confermata dal vivo, quindi fanno fede il testo grezzo e lo scontrino di prova.'
                      : 'layout confermato sulle unità collaudate.'}
                  </p>
                  {rtReadNotes.length > 0 && (
                    <ul className="text-[10px] leading-snug text-text-muted space-y-0.5">
                      {rtReadNotes.map((note) => (
                        <li key={note}>· {note}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => void savePrinter()}
            disabled={savingPrinter || !printer || fiscalDepartmentMappingHasErrors(departmentIssues)}
            className="px-4 py-2 rounded bg-primary text-white text-xs font-bold uppercase tracking-wider disabled:opacity-50"
          >
            {savingPrinter ? 'Salvataggio...' : 'Salva configurazione'}
          </button>
          <button
            onClick={() => void testPrinter()}
            disabled={rtTestStatus === 'pending' || !printer?.host}
            className="px-4 py-2 rounded border border-border text-xs font-bold uppercase tracking-wider disabled:opacity-50"
          >
            {rtTestStatus === 'pending' ? 'Test in corso...' : 'Test connessione'}
          </button>
          <button
            onClick={() => void runChiusura()}
            disabled={rtTestStatus === 'pending' || !printer?.host}
            className="px-4 py-2 rounded border-2 border-amber-500 text-amber-700 text-xs font-bold uppercase tracking-wider disabled:opacity-50"
          >
            Chiusura RT {businessDate}
          </button>
        </div>
        {rtTestStatus === 'success' && <p className="text-xs text-emerald-600 font-semibold">Operazione accodata: verifica l'esito sulla lista lavori.</p>}
        {rtTestStatus === 'failed' && <p className="text-xs text-danger">Operazione non riuscita. Controlla agente stampa e registratore.</p>}
        {jobs.length > 0 && (
          <div className="border-t border-border pt-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted mb-2">Lavori fiscali recenti</p>
            <ul className="space-y-1.5">
              {jobs.slice(0, 6).map((job) => {
                const { progressive, counters } = parseFiscalJobResult(job);
                const grandTotal = counters['gran totale'];
                return (
                  <li key={job.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold capitalize">{job.type}</span>
                    <span className="text-text-muted">{new Date(job.createdAt).toLocaleTimeString('it-IT')}</span>
                    {grandTotal && <span className="font-mono text-text-muted">GT {grandTotal}</span>}
                    {progressive && <span className="font-mono text-emerald-700">#{progressive}</span>}
                    <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-bold uppercase', job.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : job.status === 'failed' ? 'bg-danger/10 text-danger' : 'bg-bg text-text-muted')}>
                      {job.status}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      <div className="bg-white border border-border rounded-xl p-4 space-y-3">
        <h2 className="text-lg font-bold text-primary uppercase tracking-wide">Fiscal Exports (CSV)</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <input
            type="date"
            value={businessDate}
            onChange={(event) => setBusinessDate(event.target.value)}
            className="px-3 py-2 rounded border border-border text-sm"
          />
          {/* Mobile: these two primaries live in the sticky CTAs below; the
              grid keeps them desktop-only to avoid duplicate actions. */}
          <button onClick={() => setConfirmCloseOpen(true)} disabled={loading} className="hidden md:block px-4 py-2 rounded border border-border text-xs font-bold uppercase tracking-wider disabled:opacity-50">Chiudi giornata</button>
          <button onClick={() => void generateExport()} disabled={loading} className="hidden md:block px-4 py-2 rounded bg-primary text-white text-xs font-bold uppercase tracking-wider disabled:opacity-50">Genera CSV</button>
          <button onClick={() => void load(true)} disabled={loading} className={cn('px-4 py-2 rounded border border-border text-xs font-bold uppercase tracking-wider disabled:opacity-50', mobileTab !== 'history' && 'hidden md:block')}>{loading ? '...' : 'Aggiorna'}</button>
          <button onClick={printDailyReport} className={cn('px-4 py-2 rounded bg-accent text-white text-xs font-bold uppercase tracking-wider', mobileTab !== 'history' && 'hidden md:block')}>Stampa Report</button>
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
              Riprova
            </button>
          )}
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}
        {success && <p className="text-xs text-emerald-600 font-semibold">{success}</p>}
      </div>

      {/* Mobile sticky primary CTA (UX-004) */}
      {mobileTab === 'generate' && (
        <button
          onClick={() => void generateExport()}
          disabled={loading}
          className="md:hidden w-full px-4 py-3.5 rounded-lg bg-primary text-white text-xs font-bold uppercase tracking-wider min-h-[48px] shadow-md disabled:opacity-50"
        >
          Genera CSV per {businessDate}
        </button>
      )}
      {mobileTab === 'close' && (
        <button
          onClick={() => setConfirmCloseOpen(true)}
          disabled={loading}
          className="md:hidden w-full px-4 py-3.5 rounded-lg border-2 border-amber-500 text-amber-700 text-xs font-bold uppercase tracking-wider min-h-[48px] shadow-md disabled:opacity-50"
        >
          Chiudi giornata fiscale
        </button>
      )}

      <div className={cn('bg-white border border-border rounded-xl p-4 space-y-2', mobileTab !== 'history' && 'hidden md:block')}>
        {items.map((item) => (
          <div key={item.id} className="border border-border rounded p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-secondary">{item.businessDate} • {item.status}</p>
              <p className="text-xs text-text-muted">{item.path}</p>
              {item.status === 'failed' && item.error && (
                <p className="text-[11px] text-danger mt-1">{item.error}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 w-full sm:w-auto">
              {item.status === 'failed' && (
                <button onClick={() => void retryExport(item.id)} disabled={loading} className="px-2 py-2 rounded border border-amber-500 text-amber-700 text-xs font-bold min-h-10 disabled:opacity-50">Riprova</button>
              )}
              <button onClick={() => void previewCsv(item.id)} disabled={item.status !== 'ready'} className="px-2 py-2 rounded border border-border text-xs font-bold min-h-10 disabled:opacity-40">Preview</button>
              <button onClick={() => void downloadCsv(item.id, item.businessDate)} disabled={item.status !== 'ready'} className="px-2 py-2 rounded border border-border text-xs font-bold min-h-10 disabled:opacity-40">Download</button>
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
        open={confirmRevokeVerificationOpen}
        title="Revoca del collaudo"
        message="Il collaudo del protocollo attivo verrà revocato: l'emissione dei corrispettivi torna bloccata fino a una nuova prova gestionale completata."
        confirmLabel="Revoca il collaudo"
        cancelLabel="Annulla"
        onCancel={() => setConfirmRevokeVerificationOpen(false)}
        onConfirm={() => {
          void revokeVerification();
        }}
      />

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

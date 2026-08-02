import { useId, useRef, useState } from 'react';
import type { PrintJob, UiSettings } from '@gustopos/shared';
import { useAppStore } from '../../store/app-store';
import { uploadPrintLogo, type QzTrayConfig } from '../../shared/api/client';

interface PrintSettingsSectionProps {
  draft: UiSettings;
  printingSuccess: string;
  saving: boolean;
  onSetDraft: React.Dispatch<React.SetStateAction<UiSettings>>;
  onSavePrinting: () => Promise<void>;
  printJobs: PrintJob[];
  onRefreshPrintJobs: () => Promise<void>;
  onDispatchPrintJob: (id: string, payload?: { endpoint?: string }) => Promise<void>;
  // QZ Tray connection config
  qzConfig: QzTrayConfig | null;
  qzConfigLoading: boolean;
  qzConfigSaving: boolean;
  qzConfigError: string;
  qzConfigSuccess: string;
  onSaveQzConfig: () => Promise<void>;
  onAddQzHost: () => void;
  onUpdateQzHost: (index: number, value: string) => void;
  onRemoveQzHost: (index: number) => void;
  onAddQzPort: (type: 'securePorts' | 'insecurePorts') => void;
  onUpdateQzPort: (type: 'securePorts' | 'insecurePorts', index: number, value: number) => void;
  onRemoveQzPort: (type: 'securePorts' | 'insecurePorts', index: number) => void;
  onSetQzUseSecure: (value: boolean) => void;
}

export default function PrintSettingsSection({
  draft,
  printingSuccess,
  saving,
  onSetDraft,
  onSavePrinting,
  printJobs,
  onRefreshPrintJobs,
  onDispatchPrintJob,
  qzConfig,
  qzConfigLoading,
  qzConfigSaving,
  qzConfigError,
  qzConfigSuccess,
  onSaveQzConfig,
  onAddQzHost,
  onUpdateQzHost,
  onRemoveQzHost,
  onAddQzPort,
  onUpdateQzPort,
  onRemoveQzPort,
  onSetQzUseSecure,
}: PrintSettingsSectionProps) {
  const printBridges = useAppStore((state) => state.printBridges);
  const idPrefix = useId();
  const fieldId = (key: string) => `${idPrefix}-${key}`;
  const [bridgeEndpointOverride, setBridgeEndpointOverride] = useState('');
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState('');
  const [logoPreview, setLogoPreview] = useState('');
  const [logoMeta, setLogoMeta] = useState('');
  const logoFileInput = useRef<HTMLInputElement>(null);

  const clearLogo = () => {
    setPrinting({ logoMode: 'none', logoBitmap: undefined });
    setLogoPreview('');
    setLogoMeta('');
    setLogoError('');
    if (logoFileInput.current) logoFileInput.current.value = '';
  };

  const handleLogoFile = async (file: File | undefined) => {
    setLogoError('');
    if (!file) return;
    const ALLOWED = ['image/png', 'image/jpeg', 'image/bmp', 'image/gif'];
    if (!ALLOWED.includes(file.type)) {
      setLogoError('Formato non supportato: usa PNG, JPEG, BMP o GIF.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setLogoError('File troppo grande (max 2 MB).');
      return;
    }
    setLogoUploading(true);
    try {
      const result = await uploadPrintLogo(file, {
        width: draft.printing.logoWidth,
        threshold: draft.printing.logoThreshold,
      });
      setPrinting({ logoMode: 'bitmap', logoBitmap: result.logoBitmap, logoWidth: result.logoWidth });
      setLogoMeta(`${result.logoWidth}×${result.logoHeight} px · ${(result.byteLength / 1024).toFixed(1)} KB`);
      // Local preview of the original image (the server converts to 1-bit).
      const reader = new FileReader();
      reader.onload = () => setLogoPreview(String(reader.result ?? ''));
      reader.readAsDataURL(file);
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : 'Caricamento logo fallito.');
    } finally {
      setLogoUploading(false);
    }
  };

  const setPrinting = (patch: Partial<UiSettings['printing']>) => {
    onSetDraft((prev) => ({ ...prev, printing: { ...prev.printing, ...patch } }));
  };

  return (
    <section className="space-y-6">
      {/* ── Layout scontrino ─────────────────────────────────────────── */}
      <div className="rounded-xl border border-border p-4 space-y-4 bg-white">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-secondary">
            Layout scontrino
          </h3>
          <p className="text-[11px] text-text-muted">
            Protocollo, logo e aree di stampa usati da tutte le stampanti collegate.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label htmlFor={fieldId('printProtocol')} className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Protocollo Stampa</label>
            <select
              id={fieldId('printProtocol')}
              value={draft.printing.protocol}
              onChange={(event) => setPrinting({ protocol: event.target.value as 'escpos' | 'disabled' })}
              className="mt-1 w-full px-3 py-2 rounded border border-border text-sm"
            >
              <option value="escpos">ESC/POS</option>
              <option value="disabled">Disabilitato</option>
            </select>
          </div>
          <div>
            <label htmlFor={fieldId('printLogoMode')} className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Modalità Logo</label>
            <select
              id={fieldId('printLogoMode')}
              value={draft.printing.logoMode}
              onChange={(event) => setPrinting({ logoMode: event.target.value as 'none' | 'bitmap' })}
              className="mt-1 w-full px-3 py-2 rounded border border-border text-sm"
            >
              <option value="none">Nessun logo</option>
              <option value="bitmap">Bitmap termica</option>
            </select>
          </div>
        </div>

        {draft.printing.logoMode === 'bitmap' && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label htmlFor={fieldId('printLogoWidth')} className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Larghezza (dot)</label>
                <input
                  id={fieldId('printLogoWidth')}
                  value={String(draft.printing.logoWidth)}
                  onChange={(event) => {
                    const next = Number(event.target.value.replace(/[^0-9]/g, ''));
                    onSetDraft((prev) => ({
                      ...prev,
                      printing: { ...prev.printing, logoWidth: Number.isFinite(next) ? next : prev.printing.logoWidth },
                    }));
                  }}
                  className="mt-1 w-full px-3 py-2 rounded border border-border text-sm"
                />
              </div>
              <div>
                <label htmlFor={fieldId('printLogoThreshold')} className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Soglia bianco/nero (0-255)</label>
                <input
                  id={fieldId('printLogoThreshold')}
                  value={String(draft.printing.logoThreshold)}
                  onChange={(event) => {
                    const next = Number(event.target.value.replace(/[^0-9]/g, ''));
                    onSetDraft((prev) => ({
                      ...prev,
                      printing: { ...prev.printing, logoThreshold: Number.isFinite(next) ? next : prev.printing.logoThreshold },
                    }));
                  }}
                  className="mt-1 w-full px-3 py-2 rounded border border-border text-sm"
                />
              </div>
            </div>

            <div className="rounded border border-border p-3 space-y-2 bg-gray-50">
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={() => logoFileInput.current?.click()}
                  disabled={logoUploading}
                  className="px-3 py-2 rounded bg-primary text-white text-xs font-bold uppercase tracking-wider disabled:opacity-50"
                >
                  {logoUploading ? 'Conversione...' : '📁 Carica logo'}
                </button>
                <input
                  ref={logoFileInput}
                  id={fieldId('printLogoFile')}
                  type="file"
                  accept="image/png,image/jpeg,image/bmp,image/gif"
                  onChange={(event) => void handleLogoFile(event.target.files?.[0])}
                  className="hidden"
                />
                {draft.printing.logoBitmap && (
                  <button
                    onClick={clearLogo}
                    className="px-3 py-2 rounded border border-danger/40 text-danger text-xs font-bold uppercase tracking-wider"
                  >
                    🗑 Rimuovi logo
                  </button>
                )}
              </div>
              {logoError && <p className="text-xs text-danger font-medium">{logoError}</p>}
              {(logoPreview || draft.printing.logoBitmap) && (
                <div className="flex items-center gap-3 flex-wrap">
                  {logoPreview ? (
                    <img
                      src={logoPreview}
                      alt="Anteprima logo"
                      className="h-12 w-auto object-contain bg-white border border-border rounded px-1"
                    />
                  ) : (
                    <div className="h-12 w-24 flex items-center justify-center border border-dashed border-border rounded text-[10px] text-text-muted uppercase">
                      Logo salvato
                    </div>
                  )}
                  {logoMeta && <span className="text-xs text-text-muted font-mono">{logoMeta}</span>}
                </div>
              )}
            </div>
            <p className="text-[11px] text-text-muted">
              Il logo viene stampato solo sullo <strong>scontrino cassa</strong> (chiusura tavolo), non sui ticket cucina/bar.
            </p>
          </div>
        )}

        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Aree stampa attive</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(['kitchen', 'bar', 'cashier'] as const).map((area) => (
              <button
                key={area}
                onClick={() =>
                  onSetDraft((prev) => {
                    const exists = prev.printing.activeAreas.includes(area);
                    const activeAreas = exists
                      ? prev.printing.activeAreas.filter((entry) => entry !== area)
                      : [...prev.printing.activeAreas, area];
                    return {
                      ...prev,
                      printing: { ...prev.printing, activeAreas },
                    };
                  })
                }
                className={`px-3 py-2 rounded-full text-[11px] font-bold uppercase tracking-wider border ${
                  draft.printing.activeAreas.includes(area)
                    ? 'bg-accent text-white border-accent'
                    : 'bg-white text-secondary border-border'
                }`}
              >
                {area}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="flex items-center justify-between border border-border rounded p-3 text-sm">
            <span>Auto-print cucina</span>
            <input
              type="checkbox"
              checked={draft.printing.autoPrintKitchen}
              onChange={(event) => setPrinting({ autoPrintKitchen: event.target.checked })}
            />
          </label>
          <label className="flex items-center justify-between border border-border rounded p-3 text-sm">
            <span>Auto-print chiusura tavolo</span>
            <input
              type="checkbox"
              checked={draft.printing.autoPrintOnClose}
              onChange={(event) => setPrinting({ autoPrintOnClose: event.target.checked })}
            />
          </label>
        </div>

        <div>
          <label htmlFor={fieldId('printReceiptFooter')} className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Footer Scontrino</label>
          <textarea
            id={fieldId('printReceiptFooter')}
            value={draft.printing.receiptFooter}
            onChange={(event) => setPrinting({ receiptFooter: event.target.value.slice(0, 200) })}
            rows={3}
            className="mt-1 w-full px-3 py-2 rounded border border-border text-sm"
          />
        </div>

        <div className="flex gap-2 items-center">
          {printingSuccess && (
            <p className="text-xs text-success font-medium self-center">{printingSuccess}</p>
          )}
          <button
            onClick={() => void onSavePrinting()}
            disabled={saving}
            className="px-4 py-2 rounded bg-primary text-white text-xs font-bold uppercase tracking-wider disabled:opacity-50"
          >
            {saving ? 'Salvataggio...' : 'Salva configurazioni stampa'}
          </button>
        </div>
      </div>

      {/* ── Connessione QZ Tray (per la stampa dal browser) ──────────── */}
      <div className="rounded-xl border border-border p-4 space-y-3 bg-white">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-secondary">
            QZ Tray — Indirizzi di Connessione
          </h3>
          <p className="text-[11px] text-text-muted">
            Solo per la stampa <strong>dal browser</strong> (bridge su questo PC). Gli agenti
            Go si collegano a QZ Tray in locale automaticamente.
          </p>
        </div>
        <div className="rounded border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
          <strong>ℹ️ Come trovare l'IP:</strong> Sul PC cassa, apri il terminale e digita{' '}
          <code className="bg-white px-1 rounded border font-mono">ipconfig</code> (Windows) o{' '}
          <code className="bg-white px-1 rounded border font-mono">ifconfig</code> (Mac/Linux).
        </div>
        <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <strong>⚠️ Importante:</strong> Su QZ Tray (PC cassa), vai su <strong>Preferences → Network</strong>{' '}
          e spunta <strong>"Accept connections from other computers"</strong>. Altrimenti il browser non potrà connettersi.
        </div>

        {qzConfigLoading && <p className="text-xs text-text-muted">Caricamento configurazione QZ Tray...</p>}
        {qzConfigError && <p className="text-xs text-danger">{qzConfigError}</p>}
        {qzConfigSuccess && <p className="text-xs text-success">{qzConfigSuccess}</p>}

        {qzConfig && !qzConfigLoading && (
          <>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                Host QZ Tray (IP del PC cassa)
              </label>
              <div className="mt-1 space-y-1">
                {qzConfig.hosts.map((host, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <label htmlFor={fieldId(`qzHost-${i}`)} className="sr-only">Host QZ Tray {i + 1}</label>
                    <input
                      id={fieldId(`qzHost-${i}`)}
                      value={host}
                      onChange={(e) => onUpdateQzHost(i, e.target.value)}
                      placeholder="192.168.1.100"
                      className="flex-1 px-3 py-1.5 rounded border border-border text-sm font-mono"
                    />
                    <button
                      onClick={() => onRemoveQzHost(i)}
                      disabled={qzConfig.hosts.length <= 1}
                      className="px-2 py-1.5 rounded border border-border text-xs text-danger disabled:opacity-40"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  onClick={onAddQzHost}
                  className="px-3 py-1.5 rounded border border-border text-xs font-bold uppercase tracking-wider"
                >
                  + Aggiungi host
                </button>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Porte Sicure (WSS)</label>
              <div className="mt-1 space-y-1">
                {qzConfig.securePorts.map((port, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <label htmlFor={fieldId(`qzSecurePort-${i}`)} className="sr-only">Porta sicura {i + 1}</label>
                    <input
                      id={fieldId(`qzSecurePort-${i}`)}
                      type="number"
                      value={port}
                      onChange={(e) => onUpdateQzPort('securePorts', i, Number(e.target.value))}
                      placeholder="8181"
                      className="w-32 px-3 py-1.5 rounded border border-border text-sm"
                    />
                    <button
                      onClick={() => onRemoveQzPort('securePorts', i)}
                      disabled={qzConfig.securePorts.length <= 1}
                      className="px-2 py-1.5 rounded border border-border text-xs text-danger disabled:opacity-40"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => onAddQzPort('securePorts')}
                  className="px-3 py-1.5 rounded border border-border text-xs font-bold uppercase tracking-wider"
                >
                  + Aggiungi porta sicura
                </button>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Porte Non Sicure (WS)</label>
              <div className="mt-1 space-y-1">
                {qzConfig.insecurePorts.map((port, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <label htmlFor={fieldId(`qzInsecurePort-${i}`)} className="sr-only">Porta non sicura {i + 1}</label>
                    <input
                      id={fieldId(`qzInsecurePort-${i}`)}
                      type="number"
                      value={port}
                      onChange={(e) => onUpdateQzPort('insecurePorts', i, Number(e.target.value))}
                      placeholder="8182"
                      className="w-32 px-3 py-1.5 rounded border border-border text-sm"
                    />
                    <button
                      onClick={() => onRemoveQzPort('insecurePorts', i)}
                      disabled={qzConfig.insecurePorts.length <= 1}
                      className="px-2 py-1.5 rounded border border-border text-xs text-danger disabled:opacity-40"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => onAddQzPort('insecurePorts')}
                  className="px-3 py-1.5 rounded border border-border text-xs font-bold uppercase tracking-wider"
                >
                  + Aggiungi porta non sicura
                </button>
              </div>
            </div>

            <label className="flex items-center justify-between border border-border rounded p-3 text-sm bg-white">
              <span>Usa connessione sicura (WSS)</span>
              <input
                type="checkbox"
                checked={qzConfig.useSecure}
                onChange={(e) => onSetQzUseSecure(e.target.checked)}
              />
            </label>

            <button
              onClick={() => void onSaveQzConfig()}
              disabled={qzConfigSaving}
              className="px-4 py-2 rounded bg-primary text-white text-xs font-bold uppercase tracking-wider disabled:opacity-50"
            >
              {qzConfigSaving ? 'Salvataggio...' : 'Salva configurazione QZ Tray'}
            </button>
          </>
        )}
      </div>

      {/* ── Coda stampa ───────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border p-4 space-y-3 bg-white">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-secondary">Coda stampa</h3>
            <p className="text-[11px] text-text-muted">Job di stampa generati dal POS.</p>
          </div>
          <button
            onClick={() => void onRefreshPrintJobs()}
            className="px-3 py-1.5 rounded border border-border text-xs font-bold uppercase tracking-wider hover:bg-gray-50 transition-colors"
          >
            ↻ Aggiorna coda
          </button>
        </div>

        <div className="space-y-2 max-h-56 overflow-auto">
          {printJobs.map((job) => {
            const bridge = job.bridgeId ? printBridges.find((b) => b.id === job.bridgeId) : undefined;
            const handlerLabel = bridge
              ? `${bridge.name}${bridge.host ? ` @ ${bridge.host}` : ''}`
              : job.bridgeId
                ? `bridge ${job.bridgeId.slice(0, 10)} (sconosciuto)`
                : 'browser fallback';
            return (
              <div key={job.id} className="flex items-center justify-between gap-2 border border-border rounded p-2 text-xs">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-secondary">{job.area ? job.area.toUpperCase() : '—'} • {job.status.toUpperCase()}</p>
                  <p className="text-text-muted">{new Date(job.createdAt).toLocaleString()}</p>
                </div>
                <span
                  title={handlerLabel}
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full border ${
                    bridge ? 'border-primary text-primary' : 'border-border text-text-muted'
                  }`}
                >
                  {bridge ? `↳ ${bridge.name}` : '↳ browser'}
                </span>
                <button
                  onClick={() =>
                    void onDispatchPrintJob(job.id, bridgeEndpointOverride ? { endpoint: bridgeEndpointOverride } : undefined)
                  }
                  disabled={job.status !== 'pending'}
                  className="px-3 py-1 rounded border border-border text-[10px] font-bold uppercase tracking-wider disabled:opacity-50"
                >
                  Dispatch
                </button>
              </div>
            );
          })}
          {printJobs.length === 0 && <p className="text-xs text-text-muted">Nessun job in coda.</p>}
        </div>
        <div className="pt-1">
          <label htmlFor={fieldId('printBridgeEndpoint')} className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Override endpoint bridge (opzionale)</label>
          <input
            id={fieldId('printBridgeEndpoint')}
            value={bridgeEndpointOverride}
            onChange={(event) => setBridgeEndpointOverride(event.target.value)}
            placeholder="http://192.168.x.x:11905"
            className="mt-1 w-full px-3 py-2 rounded border border-border text-xs"
          />
        </div>
      </div>
    </section>
  );
}

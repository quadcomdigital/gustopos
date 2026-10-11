import { useId, useRef, useState } from 'react';
import type { UiSettings } from '@gustopos/shared';
import { uploadPrintLogo } from '../../shared/api/client';

// ─── Section C — Avanzate · layout scontrino ─────────────────────────────
//
// Only what shapes the RECEIPT: protocol, logo, footer, auto-print. Zone
// selection lives with the zones (PrintStationsManager), the QZ addresses
// with the bridges, and the queue/diagnostics with the operations section —
// one concept, one surface.

interface PrintSettingsSectionProps {
  draft: UiSettings;
  printingSuccess: string;
  saving: boolean;
  onSetDraft: React.Dispatch<React.SetStateAction<UiSettings>>;
  onSavePrinting: () => Promise<void>;
}

export default function PrintSettingsSection({
  draft,
  printingSuccess,
  saving,
  onSetDraft,
  onSavePrinting,
}: PrintSettingsSectionProps) {
  const idPrefix = useId();
  const fieldId = (key: string) => `${idPrefix}-${key}`;
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
            Protocollo, logo e footer dello scontrino. Le zone che stampano si scelgono in
            &laquo;Zone di stampa&raquo;, i collegamenti in &laquo;Collegamenti&raquo;.
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

    </section>
  );
}

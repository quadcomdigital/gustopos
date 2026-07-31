import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  defaultUiSettings,
  type DispatchPrintJobRequest,
  type ModuleKey,
  type PaymentKind,
  type PaymentMethod,
  type PrintJob,
  type RefundPaymentResponse,
  type StaffAdmin,
  type Table,
  type UiSettings,
  type TableCreateRequest,
  type TableBulkCreateRequest,
  type TableUpdateRequest,
} from '@gustopos/shared';
import StaffView from './StaffView';
import PaymentsView from './PaymentsView';
import TablesManagementView from './TablesManagementView';
import PrintBridgesPanel from './print/PrintBridgesPanel';
import { useAppStore } from '../store/app-store';
import { usePermission } from '../shared/authz/usePermission';
import { fetchQzTrayConfig, updateQzTrayConfig, type QzTrayConfig } from '../shared/api/client';

interface SettingsViewProps {
  settings: UiSettings;
  staff: StaffAdmin[];
  loading: boolean;
  payments: Parameters<typeof PaymentsView>[0]['payments'];
  onRefreshSettings: () => Promise<void>;
  onUpdateSettings: (payload: UiSettings) => Promise<void>;
  onUpdatePrintingSettings: (payload: { printing: Partial<UiSettings['printing']> }) => Promise<void>;
  onRefreshStaff: Parameters<typeof StaffView>[0]['onRefresh'];
  onCreateStaff: Parameters<typeof StaffView>[0]['onCreate'];
  onUpdateStaff: Parameters<typeof StaffView>[0]['onUpdate'];
  onResetStaffPin: Parameters<typeof StaffView>[0]['onResetPin'];
  onSetStaffActive: Parameters<typeof StaffView>[0]['onSetActive'];
  onRefreshPayments: Parameters<typeof PaymentsView>[0]['onRefresh'];
  onRefundPayment: (id: string, payload: { amount?: number; reason: string; notes?: string }) => Promise<RefundPaymentResponse>;
  printJobs: PrintJob[];
  onRefreshPrintJobs: () => Promise<void>;
  onDispatchPrintJob: (id: string, payload?: DispatchPrintJobRequest) => Promise<void>;
  tables: Table[];
  onRefreshTables: () => Promise<void>;
  onCreateTable: (payload: TableCreateRequest) => Promise<void>;
  onBulkCreateTables: (payload: TableBulkCreateRequest) => Promise<void>;
  onUpdateTable: (id: string, payload: TableUpdateRequest) => Promise<void>;
  onDeleteTable: (id: string) => Promise<void>;
}

function parseHexColor(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.replace('#', '');
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function channelToLinear(value: number): number {
  const srgb = value / 255;
  return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const { r, g, b } = parseHexColor(hex);
  const lr = channelToLinear(r);
  const lg = channelToLinear(g);
  const lb = channelToLinear(b);
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

function contrastRatio(fgHex: string, bgHex: string): number {
  const l1 = luminance(fgHex);
  const l2 = luminance(bgHex);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export default function SettingsView({
  settings,
  staff,
  loading,
  payments,
  onRefreshSettings,
  onUpdateSettings,
  onUpdatePrintingSettings,
  onRefreshStaff,
  onCreateStaff,
  onUpdateStaff,
  onResetStaffPin,
  onSetStaffActive,
  onRefreshPayments,
  onRefundPayment,
  printJobs,
  onRefreshPrintJobs,
  onDispatchPrintJob,
  tables,
  onRefreshTables: _onRefreshTables,
  onCreateTable,
  onBulkCreateTables,
  onUpdateTable,
  onDeleteTable,
}: SettingsViewProps) {
  const enabledModules = useAppStore((state) => state.enabledModules);
  const storeError = useAppStore((state) => state.error);
  const { can } = usePermission();
  const [activeTab, setActiveTab] = useState<'theme' | 'staff' | 'printing' | 'tables'>('theme');
  const [draft, setDraftInternal] = useState<UiSettings>(settings);
  const isDirtyRef = useRef(false);
  const setDraft = useCallback<typeof setDraftInternal>((value) => {
    isDirtyRef.current = true;
    setDraftInternal(value);
  }, []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [printingSuccess, setPrintingSuccess] = useState('');
  const [printBridgeEndpoint, setPrintBridgeEndpoint] = useState('');
  const [qzConfig, setQzConfig] = useState<QzTrayConfig | null>(null);
  const [qzConfigLoading, setQzConfigLoading] = useState(false);
  const [qzConfigSaving, setQzConfigSaving] = useState(false);
  const [qzConfigError, setQzConfigError] = useState('');
  const [qzConfigSuccess, setQzConfigSuccess] = useState('');
  const idPrefix = useId();
  const fieldId = (key: string) => `${idPrefix}-${key}`;

  useEffect(() => {
    if (!isDirtyRef.current) {
      setDraftInternal(settings);
    }
  }, [settings]);

  const hasModule = (moduleKey: ModuleKey) => enabledModules.includes(moduleKey);
  const staffEnabled = hasModule('kitchen');
  const tablesEnabled = hasModule('kitchen');
  const printingEnabled = hasModule('printing');
  const analyticsEnabled = hasModule('analytics');
  const printBridges = useAppStore((state) => state.printBridges);

  useEffect(() => {
    if (activeTab === 'printing' && printingEnabled && !qzConfig) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- [form-sync] loading flag set synchronously to show spinner; setter receives constant primitive, no stale-closure risk
      setQzConfigLoading(true);
      fetchQzTrayConfig()
        .then((res) => setQzConfig(res.qzTray))  
        .catch(() => setQzConfigError('Impossibile caricare la configurazione QZ Tray'))  
        .finally(() => setQzConfigLoading(false));  
    }
  }, [activeTab, printingEnabled, qzConfig]);

  const saveQzConfig = async () => {
    if (!qzConfig) return;
    setQzConfigSaving(true);
    setQzConfigError('');
    setQzConfigSuccess('');
    try {
      const res = await updateQzTrayConfig({ qzTray: qzConfig });
      setQzConfig(res.qzTray);
      setQzConfigSuccess('Configurazione QZ Tray salvata con successo');
    } catch {
      setQzConfigError('Errore nel salvataggio della configurazione QZ Tray');
    } finally {
      setQzConfigSaving(false);
    }
  };

  const addQzHost = () => {
    if (!qzConfig) return;
    setQzConfig({ ...qzConfig, hosts: [...qzConfig.hosts, ''] });
  };

  const updateQzHost = (index: number, value: string) => {
    if (!qzConfig) return;
    const newHosts = [...qzConfig.hosts];
    newHosts[index] = value;
    setQzConfig({ ...qzConfig, hosts: newHosts });
  };

  const removeQzHost = (index: number) => {
    if (!qzConfig || qzConfig.hosts.length <= 1) return;
    setQzConfig({ ...qzConfig, hosts: qzConfig.hosts.filter((_, i) => i !== index) });
  };

  const addQzPort = (type: 'securePorts' | 'insecurePorts') => {
    if (!qzConfig) return;
    setQzConfig({ ...qzConfig, [type]: [...qzConfig[type], 0] });
  };

  const updateQzPort = (type: 'securePorts' | 'insecurePorts', index: number, value: number) => {
    if (!qzConfig) return;
    const newPorts = [...qzConfig[type]];
    newPorts[index] = value;
    setQzConfig({ ...qzConfig, [type]: newPorts });
  };

  const removeQzPort = (type: 'securePorts' | 'insecurePorts', index: number) => {
    if (!qzConfig || qzConfig[type].length <= 1) return;
    setQzConfig({ ...qzConfig, [type]: qzConfig[type].filter((_, i) => i !== index) });
  };

  const checks = useMemo(
    () => [
      {
        label: 'textMain su bg',
        ratio: contrastRatio(draft.theme.textMain, draft.theme.bg),
        min: 4.5,
      },
      {
        label: 'textMuted su bg',
        ratio: contrastRatio(draft.theme.textMuted, draft.theme.bg),
        min: 3,
      },
      {
        label: 'bianco su primary',
        ratio: contrastRatio('#ffffff', draft.theme.primary),
        min: 4.5,
      },
      {
        label: 'bianco su accent',
        ratio: contrastRatio('#ffffff', draft.theme.accent),
        min: 4.5,
      },
    ],
    [draft],
  );

  const invalidChecks = checks.filter((entry) => entry.ratio < entry.min);

  const applyReset = () => {
    setDraft(defaultUiSettings);
    setError('');
  };

  const displayError = error || storeError;

  const save = async () => {
    if (invalidChecks.length > 0 && activeTab === 'theme') {
      setError('Contrasto insufficiente: correggi i colori prima di salvare.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await onUpdateSettings(draft);
      isDirtyRef.current = false;
      await onRefreshSettings();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Salvataggio impostazioni fallito');
    } finally {
      setSaving(false);
    }
  };

  const validatePrintingDraft = (): string | null => {
    // Mirror backend validatePrintingSettings() to avoid "silent" 400s.
    if (draft.printing.protocol === 'escpos') {
      if (draft.printing.activeAreas.length === 0) {
        return 'ESC/POS richiede almeno un\'area di stampa attiva.';
      }
      if (draft.printing.logoMode === 'bitmap' && !draft.printing.logoBitmap) {
        return 'Modalità logo bitmap richiede un logoBitmap valido.';
      }
    }
    return null;
  };

  const savePrinting = async () => {
    const validationError = validatePrintingDraft();
    if (validationError) {
      setError(validationError);
      setPrintingSuccess('');
      return;
    }

    setSaving(true);
    setError('');
    setPrintingSuccess('');
    try {
      await onUpdatePrintingSettings({ printing: draft.printing });
      isDirtyRef.current = false;
      await onRefreshSettings();
      setPrintingSuccess('Configurazione stampa salvata con successo');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Salvataggio configurazione stampa fallito');
    } finally {
      setSaving(false);
    }
  };

  if (!can('settingsUpdate')) {
    return (
      <div className="space-y-8">
        <div className="bg-white border border-border rounded-xl p-5">
          <h2 className="text-2xl font-bold text-primary tracking-tight uppercase">Impostazioni Globali</h2>
          <p className="text-text-muted text-sm font-medium mt-2">Non hai i permessi per accedere alle impostazioni.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="bg-white border border-border rounded-xl p-5 space-y-4">
        <div>
          <h2 className="text-2xl font-bold text-primary tracking-tight uppercase">Impostazioni Globali</h2>
          <p className="text-text-muted text-sm font-medium">Theme, staff e stampa condivisi per tutto il locale</p>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-border pb-3">
          <button
            onClick={() => setActiveTab('theme')}
            className={`px-3 py-2 rounded text-xs font-bold uppercase tracking-wider ${
              activeTab === 'theme' ? 'bg-primary text-white' : 'border border-border'
            }`}
          >
            Theme Settings
          </button>
          <button
            onClick={() => setActiveTab('staff')}
            disabled={!staffEnabled}
            className={`px-3 py-2 rounded text-xs font-bold uppercase tracking-wider ${
              activeTab === 'staff' ? 'bg-primary text-white' : 'border border-border'
            } ${!staffEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            title={staffEnabled ? undefined : 'Modulo kitchen disabilitato'}
          >
            Gestione Staff
          </button>
          <button
            onClick={() => setActiveTab('tables')}
            disabled={!tablesEnabled}
            className={`px-3 py-2 rounded text-xs font-bold uppercase tracking-wider ${
              activeTab === 'tables' ? 'bg-primary text-white' : 'border border-border'
            } ${!tablesEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            title={tablesEnabled ? undefined : 'Modulo kitchen disabilitato'}
          >
            Gestione Tavoli
          </button>
          <button
            onClick={() => setActiveTab('printing')}
            disabled={!printingEnabled}
            className={`px-3 py-2 rounded text-xs font-bold uppercase tracking-wider ${
              activeTab === 'printing' ? 'bg-primary text-white' : 'border border-border'
            } ${!printingEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            title={printingEnabled ? undefined : 'Modulo printing disabilitato'}
          >
            Configurazioni Stampa
          </button>
        </div>

        {!staffEnabled && activeTab === 'staff' && (
          <div className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 font-semibold">
            Modulo kitchen disabilitato: gestione staff non disponibile.
          </div>
        )}

        {!tablesEnabled && activeTab === 'tables' && (
          <div className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 font-semibold">
            Modulo kitchen disabilitato: gestione tavoli non disponibile.
          </div>
        )}

        {!printingEnabled && activeTab === 'printing' && (
          <div className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 font-semibold">
            Modulo printing disabilitato: configurazioni e coda stampa non disponibili.
          </div>
        )}

        {!analyticsEnabled && activeTab === 'staff' && (
          <div className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 font-semibold">
            Modulo analytics disabilitato: sezione rimborsi storico pagamenti non disponibile.
          </div>
        )}

        {displayError && (
          <p className="text-xs text-danger font-medium">{displayError}</p>
        )}

        {activeTab === 'theme' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <label htmlFor={fieldId('brandName')} className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Nome Header Globale</label>
                <input
                  id={fieldId('brandName')}
                  value={draft.brandName}
                  onChange={(event) => setDraft((prev) => ({ ...prev, brandName: event.target.value.slice(0, 40) }))}
                  placeholder="Nome brand"
                  className="mt-1 w-full px-3 py-2 rounded border border-border text-sm"
                />
              </div>
              <div className="rounded-lg border border-border p-3" style={{ background: draft.theme.bg, color: draft.theme.textMain }}>
                <p className="text-[10px] uppercase font-bold tracking-widest" style={{ color: draft.theme.textMuted }}>Preview Header</p>
                <div className="mt-2 px-3 py-2 rounded" style={{ background: draft.theme.primary, color: '#ffffff' }}>
                  {draft.brandName || 'GUSTOPOS'}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(Object.keys(draft.theme) as Array<keyof UiSettings['theme']>).map((token) => (
                <div key={token} className="rounded-lg border border-border p-3 space-y-2">
                  <label htmlFor={fieldId(`theme-color-${token}`)} className="text-[10px] font-bold uppercase tracking-wider text-text-muted">{token}</label>
                  <div className="flex items-center gap-2">
                    <input
                      id={fieldId(`theme-color-${token}`)}
                      type="color"
                      value={draft.theme[token]}
                      onChange={(event) =>
                        setDraft((prev) => ({
                          ...prev,
                          theme: {
                            ...prev.theme,
                            [token]: event.target.value,
                          },
                        }))
                      }
                      className="h-9 w-14 rounded border border-border bg-white"
                    />
                    <input
                      id={fieldId(`theme-hex-${token}`)}
                      value={draft.theme[token]}
                      onChange={(event) =>
                        setDraft((prev) => ({
                          ...prev,
                          theme: {
                            ...prev.theme,
                            [token]: event.target.value,
                          },
                        }))
                      }
                      className="flex-1 px-3 py-2 rounded border border-border text-xs uppercase"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-1">
              {checks.map((entry) => {
                const ok = entry.ratio >= entry.min;
                return (
                  <p key={entry.label} className={`text-xs ${ok ? 'text-success' : 'text-danger'}`}>
                    {entry.label}: {entry.ratio.toFixed(2)} (min {entry.min})
                  </p>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => void save()}
                disabled={saving}
                className="px-4 py-2 rounded bg-primary text-white text-xs font-bold uppercase tracking-wider disabled:opacity-50"
              >
                {saving ? 'Salvataggio...' : 'Salva impostazioni globali'}
              </button>
              <button
                onClick={applyReset}
                className="px-4 py-2 rounded border border-border text-xs font-bold uppercase tracking-wider"
              >
                Reset default tema
              </button>
            </div>
          </div>
        )}

        {activeTab === 'printing' && printingEnabled && (
          <div className="space-y-6">
            <PrintBridgesPanel />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label htmlFor={fieldId('printProtocol')} className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Protocollo Stampa</label>
                <select
                  id={fieldId('printProtocol')}
                  value={draft.printing.protocol}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      printing: { ...prev.printing, protocol: event.target.value as 'escpos' | 'disabled' },
                    }))
                  }
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
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      printing: { ...prev.printing, logoMode: event.target.value as 'none' | 'bitmap' },
                    }))
                  }
                  className="mt-1 w-full px-3 py-2 rounded border border-border text-sm"
                >
                  <option value="none">Nessun logo</option>
                  <option value="bitmap">Bitmap termica</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label htmlFor={fieldId('printLogoWidth')} className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Larghezza Bitmap</label>
                <input
                  id={fieldId('printLogoWidth')}
                  value={String(draft.printing.logoWidth)}
                  onChange={(event) => {
                    const next = Number(event.target.value.replace(/[^0-9]/g, ''));
                    setDraft((prev) => ({
                      ...prev,
                      printing: { ...prev.printing, logoWidth: Number.isFinite(next) ? next : prev.printing.logoWidth },
                    }));
                  }}
                  className="mt-1 w-full px-3 py-2 rounded border border-border text-sm"
                />
              </div>
              <div>
                <label htmlFor={fieldId('printLogoThreshold')} className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Threshold Bitmap</label>
                <input
                  id={fieldId('printLogoThreshold')}
                  value={String(draft.printing.logoThreshold)}
                  onChange={(event) => {
                    const next = Number(event.target.value.replace(/[^0-9]/g, ''));
                    setDraft((prev) => ({
                      ...prev,
                      printing: { ...prev.printing, logoThreshold: Number.isFinite(next) ? next : prev.printing.logoThreshold },
                    }));
                  }}
                  className="mt-1 w-full px-3 py-2 rounded border border-border text-sm"
                />
              </div>
              <div>
                <label htmlFor={fieldId('printLogoBitmap')} className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Bitmap Logo (base64)</label>
                <input
                  id={fieldId('printLogoBitmap')}
                  value={draft.printing.logoBitmap ?? ''}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      printing: { ...prev.printing, logoBitmap: event.target.value || undefined },
                    }))
                  }
                  placeholder="data:image/png;base64,..."
                  className="mt-1 w-full px-3 py-2 rounded border border-border text-sm"
                />
              </div>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Aree stampa attive</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(['kitchen', 'bar', 'cashier'] as const).map((area) => (
                  <button
                    key={area}
                    onClick={() =>
                      setDraft((prev) => {
                        const exists = prev.printing.activeAreas.includes(area);
                        const activeAreas = exists
                          ? prev.printing.activeAreas.filter((entry) => entry !== area)
                          : [...prev.printing.activeAreas, area];
                        return {
                          ...prev,
                          printing: {
                            ...prev.printing,
                            activeAreas,
                          },
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

            {/* ─── QZ Tray Configuration ─────────────────────────────────── */}
            <div className="rounded-lg border border-border p-4 space-y-3 bg-gray-50">
              <p className="text-[12px] font-bold uppercase tracking-wider text-text-muted">QZ Tray — Indirizzi di Connessione</p>
              <p className="text-xs text-text-muted">
                Inserisci l'<strong>IP locale del PC cassa</strong> dove è installato QZ Tray (es. <code className="bg-white px-1 rounded border">192.168.1.100</code>). 
                Il browser si connetterà a questo IP via WebSocket per stampare.
              </p>
              <div className="rounded border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
                <strong>ℹ️ Come trovare l'IP:</strong> Sul PC cassa, apri il terminale e digita <code className="bg-white px-1 rounded border font-mono">ipconfig</code> (Windows) o <code className="bg-white px-1 rounded border font-mono">ifconfig</code> (Mac/Linux). Usa l'indirizzo IPv4 (es. 192.168.x.x).
              </div>
              <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <strong>⚠️ Importante:</strong> Su QZ Tray (PC cassa), vai su <strong>Preferences → Network</strong> e spunta <strong>"Accept connections from other computers"</strong> (o imposta l'IP di ascolto su <code className="bg-white px-1 rounded border font-mono">0.0.0.0</code>). Altrimenti il browser non potrà connettersi.
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
                            onChange={(e) => updateQzHost(i, e.target.value)}
                            placeholder="192.168.1.100"
                            className="flex-1 px-3 py-1.5 rounded border border-border text-sm font-mono"
                          />
                          <button
                            onClick={() => removeQzHost(i)}
                            disabled={qzConfig.hosts.length <= 1}
                            className="px-2 py-1.5 rounded border border-border text-xs text-danger disabled:opacity-40"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={addQzHost}
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
                            onChange={(e) => updateQzPort('securePorts', i, Number(e.target.value))}
                            placeholder="8181"
                            className="w-32 px-3 py-1.5 rounded border border-border text-sm"
                          />
                          <button
                            onClick={() => removeQzPort('securePorts', i)}
                            disabled={qzConfig.securePorts.length <= 1}
                            className="px-2 py-1.5 rounded border border-border text-xs text-danger disabled:opacity-40"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => addQzPort('securePorts')}
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
                            onChange={(e) => updateQzPort('insecurePorts', i, Number(e.target.value))}
                            placeholder="8182"
                            className="w-32 px-3 py-1.5 rounded border border-border text-sm"
                          />
                          <button
                            onClick={() => removeQzPort('insecurePorts', i)}
                            disabled={qzConfig.insecurePorts.length <= 1}
                            className="px-2 py-1.5 rounded border border-border text-xs text-danger disabled:opacity-40"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => addQzPort('insecurePorts')}
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
                      onChange={(e) => setQzConfig({ ...qzConfig, useSecure: e.target.checked })}
                    />
                  </label>

                  <button
                    onClick={() => void saveQzConfig()}
                    disabled={qzConfigSaving}
                    className="px-4 py-2 rounded bg-primary text-white text-xs font-bold uppercase tracking-wider disabled:opacity-50"
                  >
                    {qzConfigSaving ? 'Salvataggio...' : 'Salva configurazione QZ Tray'}
                  </button>
                </>
              )}
            </div>

            <div className="rounded-lg border border-border bg-gray-50 px-4 py-3 space-y-1">
              <p className="text-[12px] font-bold uppercase tracking-wider text-text-muted">Stampanti fisiche</p>
              <p className="text-xs text-text-muted">
                <strong>↑ Vedi in alto — Pool stampanti</strong>: apri la scheda di un bridge →
                <em>Mappings (N)</em> → scegli una stampante dal menu a tendina (riferito a quello
                che QZ Tray vede su quel PC). Le impostazioni globali di protocollo, logo e footer
                rimangono qui.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="flex items-center justify-between border border-border rounded p-3 text-sm">
                <span>Auto-print cucina</span>
                <input
                  type="checkbox"
                  checked={draft.printing.autoPrintKitchen}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      printing: { ...prev.printing, autoPrintKitchen: event.target.checked },
                    }))
                  }
                />
              </label>
              <label className="flex items-center justify-between border border-border rounded p-3 text-sm">
                <span>Auto-print chiusura tavolo</span>
                <input
                  type="checkbox"
                  checked={draft.printing.autoPrintOnClose}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      printing: { ...prev.printing, autoPrintOnClose: event.target.checked },
                    }))
                  }
                />
              </label>
            </div>

            <div>
              <label htmlFor={fieldId('printReceiptFooter')} className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Footer Scontrino</label>
              <textarea
                id={fieldId('printReceiptFooter')}
                value={draft.printing.receiptFooter}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    printing: { ...prev.printing, receiptFooter: event.target.value.slice(0, 200) },
                  }))
                }
                rows={3}
                className="mt-1 w-full px-3 py-2 rounded border border-border text-sm"
              />
            </div>

            <div className="flex gap-2">
              {printingSuccess && (
                <p className="text-xs text-success font-medium self-center">{printingSuccess}</p>
              )}
              <button
                onClick={() => void savePrinting()}
                disabled={saving}
                className="px-4 py-2 rounded bg-primary text-white text-xs font-bold uppercase tracking-wider disabled:opacity-50"
              >
                {saving ? 'Salvataggio...' : 'Salva configurazioni stampa'}
              </button>
              <button
                onClick={() => void onRefreshPrintJobs()}
                className="px-4 py-2 rounded border border-border text-xs font-bold uppercase tracking-wider"
              >
                Aggiorna coda stampa
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Coda stampa ESC/POS</p>
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
                      <p className="font-bold text-secondary">{job.area ? job.area.toUpperCase() : "—"} • {job.status.toUpperCase()}</p>
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
                      onClick={() => void onDispatchPrintJob(job.id, printBridgeEndpoint ? { endpoint: printBridgeEndpoint } : {})}
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
              <label htmlFor={fieldId('printBridgeEndpoint')} className="sr-only">Override endpoint bridge (opzionale)</label>
              <input
                id={fieldId('printBridgeEndpoint')}
                value={printBridgeEndpoint}
                onChange={(event) => setPrintBridgeEndpoint(event.target.value)}
                placeholder="Override endpoint bridge (opzionale)"
                className="w-full px-3 py-2 rounded border border-border text-xs"
              />
            </div>
          </div>
        )}

        {activeTab === 'tables' && tablesEnabled && (
          <div className="space-y-8">
            <TablesManagementView
              tables={tables}
              loading={loading}
              onCreateTable={onCreateTable}
              onBulkCreateTables={onBulkCreateTables}
              onUpdateTable={onUpdateTable}
              onDeleteTable={onDeleteTable}
            />
          </div>
        )}

        {activeTab === 'staff' && staffEnabled && (
          <div className="space-y-8">
            <StaffView
              staff={staff}
              loading={loading}
              onRefresh={onRefreshStaff}
              onCreate={onCreateStaff}
              onUpdate={onUpdateStaff}
              onResetPin={onResetStaffPin}
              onSetActive={onSetStaffActive}
            />

            {analyticsEnabled && (
              <PaymentsView
                payments={payments}
                onRefresh={(filters?: { kind?: PaymentKind; method?: PaymentMethod; staffId?: string; from?: string; to?: string }) =>
                  onRefreshPayments(filters)
                }
                onRefund={onRefundPayment}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}


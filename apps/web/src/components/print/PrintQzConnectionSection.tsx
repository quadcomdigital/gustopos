import { useEffect, useId, useState } from 'react';
import { fetchQzTrayConfig, updateQzTrayConfig, type QzTrayConfig } from '../../shared/api/client';

// ─── QZ Tray connection (browser-as-bridge) ──────────────────────────────
//
// Self-contained: fetches and saves its own config, because it belongs to the
// BRIDGE setup (section A · Collegamenti) while the rest of the printing
// settings live in the advanced section. Go agents never read this — they
// reach QZ Tray locally on their own machine.

export default function PrintQzConnectionSection() {
  const idPrefix = useId();
  const fieldId = (key: string) => `${idPrefix}-${key}`;

  const [qzConfig, setQzConfig] = useState<QzTrayConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchQzTrayConfig()
      .then((res) => {
        if (alive) setQzConfig(res.qzTray);
      })
      .catch(() => {
        if (alive) setError('Impossibile caricare la configurazione QZ Tray');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const save = async () => {
    if (!qzConfig) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const res = await updateQzTrayConfig({ qzTray: qzConfig });
      setQzConfig(res.qzTray);
      setSuccess('Configurazione QZ Tray salvata con successo');
    } catch {
      setError('Errore nel salvataggio della configurazione QZ Tray');
    } finally {
      setSaving(false);
    }
  };

  const patch = (next: QzTrayConfig) => setQzConfig(next);
  const updateHost = (index: number, value: string) => {
    if (!qzConfig) return;
    const hosts = [...qzConfig.hosts];
    hosts[index] = value;
    patch({ ...qzConfig, hosts });
  };
  const updatePort = (type: 'securePorts' | 'insecurePorts', index: number, value: number) => {
    if (!qzConfig) return;
    const ports = [...qzConfig[type]];
    ports[index] = value;
    patch({ ...qzConfig, [type]: ports });
  };

  return (
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

      {loading && <p className="text-xs text-text-muted">Caricamento configurazione QZ Tray...</p>}
      {error && <p className="text-xs text-danger">{error}</p>}
      {success && <p className="text-xs text-success">{success}</p>}

      {qzConfig && !loading && (
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
                    onChange={(e) => updateHost(i, e.target.value)}
                    placeholder="192.168.1.100"
                    className="flex-1 px-3 py-1.5 rounded border border-border text-sm font-mono"
                  />
                  <button
                    onClick={() => {
                      if (qzConfig.hosts.length <= 1) return;
                      patch({ ...qzConfig, hosts: qzConfig.hosts.filter((_, index) => index !== i) });
                    }}
                    disabled={qzConfig.hosts.length <= 1}
                    className="px-2 py-1.5 rounded border border-border text-xs text-danger disabled:opacity-40"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                onClick={() => patch({ ...qzConfig, hosts: [...qzConfig.hosts, ''] })}
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
                    onChange={(e) => updatePort('securePorts', i, Number(e.target.value))}
                    placeholder="8181"
                    className="w-32 px-3 py-1.5 rounded border border-border text-sm"
                  />
                  <button
                    onClick={() => {
                      if (qzConfig.securePorts.length <= 1) return;
                      patch({ ...qzConfig, securePorts: qzConfig.securePorts.filter((_, index) => index !== i) });
                    }}
                    disabled={qzConfig.securePorts.length <= 1}
                    className="px-2 py-1.5 rounded border border-border text-xs text-danger disabled:opacity-40"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                onClick={() => patch({ ...qzConfig, securePorts: [...qzConfig.securePorts, 0] })}
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
                    onChange={(e) => updatePort('insecurePorts', i, Number(e.target.value))}
                    placeholder="8182"
                    className="w-32 px-3 py-1.5 rounded border border-border text-sm"
                  />
                  <button
                    onClick={() => {
                      if (qzConfig.insecurePorts.length <= 1) return;
                      patch({ ...qzConfig, insecurePorts: qzConfig.insecurePorts.filter((_, index) => index !== i) });
                    }}
                    disabled={qzConfig.insecurePorts.length <= 1}
                    className="px-2 py-1.5 rounded border border-border text-xs text-danger disabled:opacity-40"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                onClick={() => patch({ ...qzConfig, insecurePorts: [...qzConfig.insecurePorts, 0] })}
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
              onChange={(e) => patch({ ...qzConfig, useSecure: e.target.checked })}
            />
          </label>

          <button
            onClick={() => void save()}
            disabled={saving}
            className="px-4 py-2 rounded bg-primary text-white text-xs font-bold uppercase tracking-wider disabled:opacity-50"
          >
            {saving ? 'Salvataggio...' : 'Salva configurazione QZ Tray'}
          </button>
        </>
      )}
    </div>
  );
}

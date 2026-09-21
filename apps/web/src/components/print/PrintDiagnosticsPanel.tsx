import { useCallback, useEffect, useRef, useState } from 'react';
import type { PrintBridge, PrintBridgeLogRecord } from '@gustopos/shared';
import { fetchBridgeLogs } from '../../shared/api/client';

interface PrintDiagnosticsPanelProps {
  printBridges: PrintBridge[];
}

type LevelFilter = 'all' | 'info' | 'warn' | 'error';

const LEVEL_STYLES: Record<string, string> = {
  info: 'text-primary',
  warn: 'text-warning',
  error: 'text-danger',
};

function heartbeatState(bridge: PrintBridge): { label: string; className: string } {
  if (!bridge.lastHeartbeatAt) return { label: 'Mai visto', className: 'text-text-muted' };
  const ageMs = Date.now() - new Date(bridge.lastHeartbeatAt).getTime();
  if (ageMs < 90_000) return { label: 'Online', className: 'text-success' };
  if (ageMs < 180_000) return { label: 'Rallentato', className: 'text-warning' };
  return { label: 'Offline', className: 'text-danger' };
}

export default function PrintDiagnosticsPanel({ printBridges }: PrintDiagnosticsPanelProps) {
  const [selectedBridgeId, setSelectedBridgeId] = useState('');
  const [level, setLevel] = useState<LevelFilter>('all');
  const [logs, setLogs] = useState<PrintBridgeLogRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const selectedRef = useRef(selectedBridgeId);
  selectedRef.current = selectedBridgeId;

  // Default to the first bridge once the pool loads.
  useEffect(() => {
    if (!selectedBridgeId && printBridges.length > 0) {
      setSelectedBridgeId(printBridges[0].id);
    }
  }, [printBridges, selectedBridgeId]);

  const load = useCallback(async (bridgeId: string, filter: LevelFilter, silent = false) => {
    if (!bridgeId) return;
    if (!silent) setLoading(true);
    try {
      const result = await fetchBridgeLogs(bridgeId, {
        ...(filter !== 'all' ? { level: filter } : {}),
        limit: 300,
      });
      setLogs(result);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lettura log non riuscita');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(selectedBridgeId, level);
  }, [selectedBridgeId, level, load]);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => {
      void load(selectedRef.current, level, true);
    }, 5000);
    return () => clearInterval(timer);
  }, [autoRefresh, level, load]);

  const selected = printBridges.find((bridge) => bridge.id === selectedBridgeId);

  const downloadLogs = () => {
    const lines = logs
      .map((entry) => `${entry.timestamp} ${entry.level.toUpperCase()} ${entry.component ? `[${entry.component}] ` : ''}${entry.message}`)
      .join('\n');
    const blob = new Blob([lines], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `gustopos-bridge-${selectedBridgeId || 'logs'}.log`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded-xl border border-border p-4 space-y-3 bg-white">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-secondary">Diagnostica bridge</h3>
          <p className="text-[11px] text-text-muted">
            Log e stato riportati dall'agente sul POS. Il pannello locale completo è su http://127.0.0.1:8183 della postazione.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-text-muted">
            <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
            Auto
          </label>
          <button
            onClick={() => void load(selectedBridgeId, level)}
            className="px-3 py-1.5 rounded border border-border text-xs font-bold uppercase tracking-wider hover:bg-gray-50 transition-colors"
          >
            ↻ Aggiorna
          </button>
          <button
            onClick={downloadLogs}
            disabled={logs.length === 0}
            className="px-3 py-1.5 rounded border border-border text-xs font-bold uppercase tracking-wider disabled:opacity-50"
          >
            Scarica
          </button>
        </div>
      </div>

      {printBridges.length === 0 ? (
        <p className="text-xs text-text-muted">Nessun bridge registrato.</p>
      ) : (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={selectedBridgeId}
              onChange={(e) => setSelectedBridgeId(e.target.value)}
              className="px-3 py-2 rounded border border-border text-xs bg-white"
            >
              {printBridges.map((bridge) => (
                <option key={bridge.id} value={bridge.id}>
                  {bridge.name}{bridge.host ? ` @ ${bridge.host}` : ''}
                </option>
              ))}
            </select>
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value as LevelFilter)}
              className="px-3 py-2 rounded border border-border text-xs bg-white"
            >
              <option value="all">Tutti i livelli</option>
              <option value="error">Solo error</option>
              <option value="warn">Solo warn</option>
              <option value="info">Solo info</option>
            </select>
          </div>

          {selected && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
              {(() => {
                const hb = heartbeatState(selected);
                return (
                  <div className="border border-border rounded p-2">
                    <p className="text-text-muted uppercase tracking-wider text-[9px]">Stato</p>
                    <p className={`font-bold ${hb.className}`}>{hb.label}</p>
                  </div>
                );
              })()}
              <div className="border border-border rounded p-2">
                <p className="text-text-muted uppercase tracking-wider text-[9px]">Heartbeat</p>
                <p className="font-bold text-secondary">
                  {selected.lastHeartbeatAt ? new Date(selected.lastHeartbeatAt).toLocaleTimeString() : '—'}
                </p>
              </div>
              <div className="border border-border rounded p-2">
                <p className="text-text-muted uppercase tracking-wider text-[9px]">Diagnostica</p>
                <p className="font-bold text-secondary">
                  {selected.diagnosticsAt ? new Date(selected.diagnosticsAt).toLocaleTimeString() : 'mai'}
                </p>
              </div>
              <div className="border border-border rounded p-2 col-span-2 sm:col-span-1">
                <p className="text-text-muted uppercase tracking-wider text-[9px]">Ultimo errore</p>
                <p className="font-bold text-danger break-words">{selected.lastError || '—'}</p>
              </div>
            </div>
          )}

          {error && <p className="text-xs text-danger">{error}</p>}

          <div className="max-h-72 overflow-auto border border-border rounded">
            <table className="w-full text-[11px] font-mono">
              <tbody>
                {logs.map((entry) => (
                  <tr key={entry.id} className="border-b border-border align-top">
                    <td className="px-2 py-1 whitespace-nowrap text-text-muted">
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </td>
                    <td className={`px-2 py-1 font-bold uppercase ${LEVEL_STYLES[entry.level] ?? ''}`}>{entry.level}</td>
                    <td className="px-2 py-1 break-all">{entry.message}</td>
                  </tr>
                ))}
                {logs.length === 0 && !loading && (
                  <tr>
                    <td className="px-2 py-3 text-text-muted" colSpan={3}>
                      Nessun log disponibile (l'agente potrebbe non aver ancora inviato la diagnostica).
                    </td>
                  </tr>
                )}
                {loading && logs.length === 0 && (
                  <tr>
                    <td className="px-2 py-3 text-text-muted" colSpan={3}>Caricamento…</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

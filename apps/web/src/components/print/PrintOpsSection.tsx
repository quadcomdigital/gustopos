import { useId, useState } from 'react';
import type { PrintBridge, PrintJob } from '@gustopos/shared';
import { retryPrintJob } from '../../shared/api/client';
import PrintDiagnosticsPanel from './PrintDiagnosticsPanel';

// ─── Section B — Operazioni ──────────────────────────────────────────────
//
// Runtime monitoring (queue + agent diagnostics), kept OUT of the setup flow:
// you come here while the service is running, not to configure it.

interface PrintOpsSectionProps {
  printJobs: PrintJob[];
  printBridges: PrintBridge[];
  onRefreshPrintJobs: () => Promise<void>;
  onDispatchPrintJob: (id: string, payload?: { endpoint?: string }) => Promise<void>;
}

export default function PrintOpsSection({
  printJobs,
  printBridges,
  onRefreshPrintJobs,
  onDispatchPrintJob,
}: PrintOpsSectionProps) {
  const idPrefix = useId();
  const fieldId = (key: string) => `${idPrefix}-${key}`;
  const [bridgeEndpointOverride, setBridgeEndpointOverride] = useState('');
  const [retryingJobId, setRetryingJobId] = useState('');

  const handleRetryJob = async (id: string) => {
    setRetryingJobId(id);
    try {
      await retryPrintJob(id);
      await onRefreshPrintJobs();
    } catch {
      // The queue refresh will surface the persisted error again.
    } finally {
      setRetryingJobId('');
    }
  };

  return (
    <section className="space-y-6">
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
                  {job.error && (
                    <p className="text-danger break-words" title={job.error}>{job.error}</p>
                  )}
                </div>
                <span
                  title={handlerLabel}
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full border ${
                    bridge ? 'border-primary text-primary' : 'border-border text-text-muted'
                  }`}
                >
                  {bridge ? `↳ ${bridge.name}` : '↳ browser'}
                </span>
                {job.status === 'failed' ? (
                  <button
                    onClick={() => void handleRetryJob(job.id)}
                    disabled={retryingJobId === job.id}
                    className="px-3 py-1 rounded border border-danger text-danger text-[10px] font-bold uppercase tracking-wider disabled:opacity-50"
                  >
                    {retryingJobId === job.id ? '…' : 'Riprova'}
                  </button>
                ) : (
                  <button
                    onClick={() =>
                      void onDispatchPrintJob(job.id, bridgeEndpointOverride ? { endpoint: bridgeEndpointOverride } : undefined)
                    }
                    disabled={job.status !== 'pending'}
                    className="px-3 py-1 rounded border border-border text-[10px] font-bold uppercase tracking-wider disabled:opacity-50"
                  >
                    Dispatch
                  </button>
                )}
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

      {/* ── Diagnostica bridge ────────────────────────────────────────── */}
      <PrintDiagnosticsPanel printBridges={printBridges} />
    </section>
  );
}

import { useCallback, useEffect, useState } from 'react';
import type { PrintEndpoint } from '@gustopos/shared';
import { deletePrintEndpoint, updatePrintEndpoint } from '../../shared/api/client';
import { usePrintEndpoints } from './usePrintEndpoints';
import Button from '../../shared/ui/atoms/Button';
import SectionHeader from '../../shared/ui/molecules/SectionHeader';
import { Trash2 } from 'lucide-react';

// ─── Acquired printer registry (UI) ──────────────────────────────────────
//
// Read-mostly: the registry fills itself from bridge heartbeats and LAN
// scans, this panel only curates it (rename / park / forget). Its whole point
// is to stay available while printers and bridges are OFF, which is what lets
// a configuration be built and applied later.

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return 'ora';
  if (minutes < 60) return `${minutes}m fa`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h fa`;
  return `${Math.floor(hours / 24)}g fa`;
}

export default function PrintEndpointsPanel() {
  const { endpoints, loading, refresh } = usePrintEndpoints();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const patch = useCallback(
    async (id: string, payload: { name?: string; isActive?: boolean }) => {
      setSaving(true);
      setError('');
      try {
        await updatePrintEndpoint(id, payload);
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Aggiornamento fallito');
      } finally {
        setSaving(false);
      }
    },
    [refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      setSaving(true);
      setError('');
      try {
        await deletePrintEndpoint(id);
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Eliminazione fallita');
      } finally {
        setSaving(false);
        setConfirmingId(null);
      }
    },
    [refresh],
  );

  // The registry changes while a scan runs elsewhere: re-read once on mount.
  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="rounded-xl border border-border p-4 space-y-3 bg-white">
      <SectionHeader
        title="Stampanti acquisite"
        description="Tutto ciò che i bridge hanno mai visto (scansione rete e QZ Tray): resta disponibile anche con la stampante spenta o il bridge offline, ed è da qui che le configurazioni prendono gli ip:port."
        actions={
          <Button variant="secondary" size="sm" onClick={() => void refresh()} disabled={saving}>
            ↻ Aggiorna
          </Button>
        }
      />

      {error && (
        <p className="rounded border border-danger/30 bg-red-50 px-3 py-2 text-xs text-danger">{error}</p>
      )}

      {loading && endpoints.length === 0 && (
        <p className="text-xs text-text-muted">Caricamento…</p>
      )}

      {!loading && endpoints.length === 0 && (
        <p className="text-xs text-text-muted border border-dashed border-border rounded px-3 py-4">
          Nessuna stampante acquisita ancora. Avvia <strong>Scansiona rete</strong> da una card
          bridge (o avvia QZ Tray sul PC): ogni stampante trovata viene registrata qui e resta a
          disposizione delle configurazioni.
        </p>
      )}

      <div className="divide-y divide-border border border-border rounded-lg">
        {endpoints.map((endpoint) => (
          <div key={endpoint.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
            <input
              defaultValue={endpoint.name}
              disabled={saving}
              onBlur={(event) => {
                const value = event.target.value.trim();
                if (value && value !== endpoint.name) void patch(endpoint.id, { name: value });
              }}
              className="flex-1 min-w-[160px] px-2 py-1.5 rounded border border-border text-sm disabled:opacity-60"
              title="Rinomina la stampante acquisita"
            />
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                endpoint.kind === 'net'
                  ? 'border-primary/40 text-primary'
                  : 'border-border text-text-muted'
              }`}
            >
              {endpoint.kind === 'net' ? 'rete' : 'QZ'}
            </span>
            <span className="text-[11px] font-mono text-secondary tabular-nums">
              {endpoint.kind === 'net'
                ? `${endpoint.ip}:${endpoint.port ?? 9100}`
                : (endpoint.bridgeName ?? 'PC')}
            </span>
            {endpoint.vendor && (
              <span className="text-[10px] text-text-muted">{endpoint.vendor}</span>
            )}
            <span
              title={
                endpoint.kind === 'net'
                  ? `Prima volta: ${new Date(endpoint.firstSeenAt).toLocaleString('it-IT')}`
                  : `Macchina: ${endpoint.instanceId ?? '—'}`
              }
              className={`text-[10px] font-bold uppercase tracking-wider tabular-nums ${
                endpoint.isActive ? 'text-text-muted' : 'text-amber-700'
              }`}
            >
              {endpoint.isActive ? `visto ${relativeTime(endpoint.lastSeenAt)}` : 'spenta'}
            </span>

            {confirmingId === endpoint.id ? (
              <span className="flex items-center gap-1.5">
                <span className="text-[10px] text-danger">Dimenticare questa stampante?</span>
                <button
                  type="button"
                  onClick={() => void remove(endpoint.id)}
                  className="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-danger text-white"
                >
                  Sì, elimina
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingId(null)}
                  className="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border border-border"
                >
                  Annulla
                </button>
              </span>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => void patch(endpoint.id, { isActive: !endpoint.isActive })}
                  disabled={saving}
                  className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border disabled:opacity-50 ${
                    endpoint.isActive ? 'border-success/40 text-success' : 'border-border text-text-muted'
                  }`}
                  title="Una stampante spenta resta disponibile: questo stato la nasconde dalle scelte"
                >
                  {endpoint.isActive ? 'Attiva' : 'Spenta'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingId(endpoint.id)}
                  disabled={saving}
                  className="p-1.5 rounded border border-border text-danger disabled:opacity-50"
                  title="Elimina dal registro (le configurazioni che la usano restano invariate)"
                >
                  <Trash2 size={13} />
                </button>
              </>
            )}
          </div>
        ))}
      </div>

      {endpoints.length > 0 && (
        <p className="text-[11px] text-text-muted tabular-nums">
          {endpoints.length} stampanti acquisite · {endpoints.filter((e) => e.kind === 'net').length}{' '}
          di rete · {endpoints.filter((e) => e.kind === 'qz').length} QZ
        </p>
      )}
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  GhostOrder,
  GhostOrderCommitResponse,
  GhostOrderItem,
} from '@gustopos/shared';
import { useAppStore } from '../store/app-store';

export type GhostSyncState = 'idle' | 'syncing' | 'error';

interface GhostOrderSyncOptions {
  enabled: boolean;
  /** True only for a physical dine-in table: ghosts are dine-in only. */
  active: boolean;
  tableId: string | null;
  items: GhostOrderItem[];
  /** Called when a conflict reveals the draft was closed elsewhere while the
   *  socket was unavailable (committed/discarded by the cashier). */
  onExternalRemoval?: () => void;
}

interface GhostOrderSyncResult {
  ghostOrderId: string | null;
  version: number;
  state: GhostSyncState;
  commit: (options?: { expectedTotal?: number; print?: boolean }) => Promise<GhostOrderCommitResponse>;
  discard: () => Promise<void>;
  reset: () => void;
}

const SYNC_DEBOUNCE_MS = 350;

/**
 * Debounced, serialized sync of the POS cart into its server-side ghost.
 *
 * The local cart stays authoritative while the waiter is editing. The server
 * returns a canonical snapshot + version; a version conflict is surfaced as an
 * error and reconciled by a refetch, never by overwriting local edits.
 */
export function useGhostOrderSync({
  enabled,
  active,
  tableId,
  items,
  onExternalRemoval,
}: GhostOrderSyncOptions): GhostOrderSyncResult {
  const createGhostOrder = useAppStore((s) => s.createGhostOrder);
  const patchGhostOrder = useAppStore((s) => s.patchGhostOrder);
  const discardGhostOrder = useAppStore((s) => s.discardGhostOrder);
  const commitGhostOrder = useAppStore((s) => s.commitGhostOrder);
  const refreshGhostOrders = useAppStore((s) => s.refreshGhostOrders);
  const ghostOrders = useAppStore((s) => s.ghostOrders);

  const [ghostOrderId, setGhostOrderId] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<GhostSyncState>('idle');

  const ghostRef = useRef<{ id: string | null; version: number }>({ id: null, version: 0 });
  const itemsRef = useRef(items);
  const tableIdRef = useRef(tableId);
  const inFlightRef = useRef(false);
  const queuedRef = useRef(false);
  const debounceRef = useRef<number | null>(null);
  const suppressRef = useRef(false);
  const inFlightPromiseRef = useRef<Promise<void> | null>(null);
  const generationRef = useRef(0);
  const onExternalRemovalRef = useRef(onExternalRemoval);
  onExternalRemovalRef.current = onExternalRemoval;

  itemsRef.current = items;
  tableIdRef.current = tableId;

  const applyGhost = useCallback((ghost: GhostOrder | null) => {
    if (!ghost || ghost.status !== 'open') {
      ghostRef.current = { id: null, version: 0 };
      setGhostOrderId(null);
      setVersion(0);
      return;
    }
    ghostRef.current = { id: ghost.id, version: ghost.version };
    setGhostOrderId(ghost.id);
    setVersion(ghost.version);
  }, []);

  const reset = useCallback(() => {
    if (debounceRef.current != null) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    generationRef.current += 1;
    ghostRef.current = { id: null, version: 0 };
    setGhostOrderId(null);
    setVersion(0);
    setState('idle');
  }, []);

  /** Rebase the local version on the canonical open draft after a conflict. */
  const adoptCanonicalVersion = useCallback((): boolean => {
    const id = ghostRef.current.id;
    if (!id) return false;
    const canonical = useAppStore.getState().ghostOrders.find(
      (ghost) => ghost.id === id && ghost.status === 'open',
    );
    if (!canonical) return false;
    ghostRef.current = { id: canonical.id, version: canonical.version };
    setVersion(canonical.version);
    return true;
  }, []);

  // Changing table/context abandons the in-memory binding: the old ghost stays
  // on its table for the cashier, and the new context starts fresh.
  useEffect(() => {
    reset();
  }, [active, tableId, enabled, reset]);

  // Fallback reconciliation for a missed `ghost_order:removed` event (tab in
  // background, gap between reconnect and the refetch, event dropped). The
  // store list is the authoritative set of open drafts: if ours is no longer
  // open, the cashier committed or discarded it. Release the binding and let
  // the POS empty the cart — otherwise those same lines stay in `posCart`
  // while the committed order lands in `data.orders`, and the POS total counts
  // them twice.
  useEffect(() => {
    if (!ghostOrderId) return;
    // Our own commit/discard/sync owns the transition; do not race it.
    if (suppressRef.current || inFlightRef.current) return;
    const stillOpen = ghostOrders.some(
      (ghost) => ghost.id === ghostOrderId && ghost.status === 'open',
    );
    if (stillOpen) return;
    reset();
    onExternalRemovalRef.current?.();
  }, [ghostOrderId, ghostOrders, reset]);

  const syncNow = useCallback(async (): Promise<void> => {
    if (!enabled || !active || !tableIdRef.current || suppressRef.current) return;
    if (inFlightRef.current) {
      queuedRef.current = true;
      return inFlightPromiseRef.current ?? Promise.resolve();
    }

    const snapshot = itemsRef.current;
    if (snapshot.length === 0 && !ghostRef.current.id) return;

    inFlightRef.current = true;
    setState('syncing');
    const generation = generationRef.current;
    const run = (async () => {
      try {
        if (snapshot.length === 0) {
          const current = ghostRef.current;
          if (current.id) {
            await discardGhostOrder(current.id, { expectedVersion: current.version });
            if (generation === generationRef.current) applyGhost(null);
          }
          return;
        }

        if (!ghostRef.current.id) {
          const created = await createGhostOrder({
            tableId: tableIdRef.current!,
            items: snapshot,
          });
          if (generation !== generationRef.current) return;
          applyGhost(created);
          // A concurrent tab may have created the same draft first; make the
          // local cart win for this waiter by applying one full patch.
          if (JSON.stringify(created.items) !== JSON.stringify(snapshot)) {
            const patched = await patchGhostOrder(created.id, {
              expectedVersion: created.version,
              items: snapshot,
            });
            if (generation === generationRef.current) applyGhost(patched);
          }
          return;
        }

        const patched = await patchGhostOrder(ghostRef.current.id, {
          expectedVersion: ghostRef.current.version,
          items: snapshot,
        });
        if (generation === generationRef.current) applyGhost(patched);
      } catch (error) {
        setState('error');
        const message = error instanceof Error ? error.message : '';
        if (/already committed|no longer open/i.test(message)) {
          // The socket may have been offline when the cashier closed the
          // draft. Reconcile via REST and, if it is no longer open, clear the
          // local binding so the waiter cannot resend the same cart.
          await refreshGhostOrders();
          const stillOpen = useAppStore.getState().ghostOrders.some(
            (ghost) => ghost.id === ghostRef.current.id && ghost.status === 'open',
          );
          if (!stillOpen && ghostRef.current.id) {
            applyGhost(null);
            onExternalRemovalRef.current?.();
          }
        } else if (/changed/i.test(message)) {
          // A version conflict on a still-open draft: fetch the canonical
          // state for the cashier panel, but keep the local cart.
          await refreshGhostOrders();
          adoptCanonicalVersion();
        }
      } finally {
        inFlightRef.current = false;
        setState((current) => (current === 'error' ? current : 'idle'));
        inFlightPromiseRef.current = null;
        if (queuedRef.current) {
          queuedRef.current = false;
          void syncNow();
        }
      }
    })();

    inFlightPromiseRef.current = run;
    return run;
  }, [
    enabled,
    active,
    createGhostOrder,
    patchGhostOrder,
    discardGhostOrder,
    refreshGhostOrders,
    applyGhost,
    adoptCanonicalVersion,
  ]);

  useEffect(() => {
    if (!enabled || !active || !tableId) return;
    if (suppressRef.current) return;
    if (debounceRef.current != null) {
      window.clearTimeout(debounceRef.current);
    }
    debounceRef.current = window.setTimeout(() => {
      debounceRef.current = null;
      void syncNow();
    }, SYNC_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current != null) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [items, enabled, active, tableId, syncNow]);

  const commit = useCallback(async (options?: { expectedTotal?: number; print?: boolean }): Promise<GhostOrderCommitResponse> => {
    if (debounceRef.current != null) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    // Stop the debounced/queued sync from racing the commit. The in-flight
    // patch (if any) is awaited, then the commit carries the final snapshot.
    suppressRef.current = true;
    // Let an in-flight patch finish so the commit sees the same version the
    // server has; the commit itself also carries the final local snapshot.
    if (inFlightPromiseRef.current) {
      await inFlightPromiseRef.current.catch(() => undefined);
    }

    const snapshot = itemsRef.current;
    if (snapshot.length === 0) {
      suppressRef.current = false;
      throw new Error('Il carrello è vuoto');
    }

    try {
      let ghostId = ghostRef.current.id;
      let expectedVersion = ghostRef.current.version;
      if (!ghostId) {
        const created = await createGhostOrder({
          tableId: tableIdRef.current!,
          items: snapshot,
        });
        applyGhost(created);
        ghostId = created.id;
        expectedVersion = created.version;
      }

      const result = await commitGhostOrder(ghostId, {
        expectedVersion,
        items: snapshot,
        ...(options?.expectedTotal != null ? { expectedTotal: options.expectedTotal } : {}),
        ...(options?.print != null ? { print: options.print } : {}),
      }).catch(async (error: unknown) => {
        const message = error instanceof Error ? error.message : '';
        if (/already committed|no longer open/i.test(message)) {
          // The socket was offline when the cashier committed/discarded the
          // draft: reconcile and release the local binding before surfacing
          // the error to the POS.
          await refreshGhostOrders();
          const stillOpen = useAppStore.getState().ghostOrders.some(
            (ghost) => ghost.id === ghostId && ghost.status === 'open',
          );
          if (!stillOpen) {
            applyGhost(null);
            onExternalRemovalRef.current?.();
          } else {
            adoptCanonicalVersion();
          }
        } else if (/changed/i.test(message)) {
          await refreshGhostOrders();
          adoptCanonicalVersion();
        }
        throw error;
      });
      applyGhost(null);
      return result;
    } finally {
      suppressRef.current = false;
    }
  }, [createGhostOrder, commitGhostOrder, applyGhost, refreshGhostOrders, adoptCanonicalVersion]);

  const discard = useCallback(async (): Promise<void> => {
    if (debounceRef.current != null) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    suppressRef.current = true;
    try {
      const current = ghostRef.current;
      if (!current.id) return;
      await discardGhostOrder(current.id, { expectedVersion: current.version });
      applyGhost(null);
    } finally {
      suppressRef.current = false;
    }
  }, [discardGhostOrder, applyGhost]);

  return { ghostOrderId, version, state, commit, discard, reset };
}

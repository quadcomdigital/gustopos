import { useCallback, useEffect, useRef, useState } from 'react';
import type { Staff } from '@gustopos/shared';
import { fetchOrderDrafts } from '../../../shared/api/client';
import { pushToast } from '../../../shared/ui/toast';

const POLL_MS = 20_000;

/**
 * Public drafts waiting for staff approval (group orders + online takeaway).
 *
 * Polled rather than pushed over realtime: drafts must stay out of the POS and
 * kitchen feeds, so `order:draft_pending` is used for the push notification
 * while this hook keeps the nav badge honest and warns in-app when a new draft
 * lands while the backoffice is open.
 */
export function usePendingApprovals(currentUser: Staff | null) {
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);
  const knownDraftIds = useRef<Set<string> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const entries = await fetchOrderDrafts();
      setPendingApprovalsCount(entries.length);

      const known = knownDraftIds.current;
      if (known) {
        const fresh = entries.filter((entry) => !known.has(entry.order.id));
        if (fresh.length === 1) {
          pushToast('info', `Nuovo ordine da approvare · ${fresh[0].order.ticketNumber ?? fresh[0].order.id}`);
        } else if (fresh.length > 1) {
          pushToast('info', `${fresh.length} nuovi ordini da approvare`);
        }
      }
      knownDraftIds.current = new Set(entries.map((entry) => entry.order.id));
    } catch {
      // A failed poll must neither clear the badge nor nag the user.
    }
  }, []);

  useEffect(() => {
    if (!currentUser) {
      knownDraftIds.current = null;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- [logout-reset] the badge must not survive a logout
      setPendingApprovalsCount(0);
      return;
    }
    void refresh();
    const timer = window.setInterval(() => void refresh(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [currentUser, refresh]);

  return { pendingApprovalsCount, refreshPendingApprovals: refresh };
}

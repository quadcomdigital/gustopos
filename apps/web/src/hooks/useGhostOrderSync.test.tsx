import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import type { GhostOrder, GhostOrderItem } from '@gustopos/shared';

// The ghost list is authoritative for open drafts. If a `ghost_order:removed`
// event is missed (background tab, gap between reconnect and refetch) the POS
// must still release the cart, otherwise the committed lines stay in posCart
// and are counted twice once the order lands in data.orders.
const h = vi.hoisted(() => ({
  store: null as unknown as {
    getState: () => { ghostOrders: GhostOrder[] };
    setState: (partial: { ghostOrders?: GhostOrder[] }) => void;
  },
  actions: {
    createGhostOrder: vi.fn(),
    patchGhostOrder: vi.fn(),
    discardGhostOrder: vi.fn(),
    commitGhostOrder: vi.fn(),
    refreshGhostOrders: vi.fn(),
  },
}));

vi.mock('../store/app-store', async () => {
  const { create } = await import('zustand');
  h.store = create(() => ({ ghostOrders: [] as GhostOrder[], ...h.actions })) as never;
  return { useAppStore: h.store };
});

import { useGhostOrderSync } from './useGhostOrderSync';

const ITEMS = [{ cartItemId: 'cart-1', menuItemId: 'menu-1', quantity: 2, basePrice: 10 } as unknown as GhostOrderItem];

// The canonical snapshot must match the local cart, otherwise the hook follows
// up with a full patch (see syncNow) and would need a second mock.
const ghost = (id: string): GhostOrder =>
  ({ id, tableId: 'table-1', status: 'open', version: 1, items: ITEMS }) as unknown as GhostOrder;

describe('useGhostOrderSync reconciliation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.store.setState({ ghostOrders: [] });
    h.actions.createGhostOrder.mockImplementation(async () => {
      const created = ghost('ghost-1');
      h.store.setState({ ghostOrders: [created] });
      return created;
    });
  });

  it('releases the cart when the bound draft disappears from the list', async () => {
    const onExternalRemoval = vi.fn();
    const { result } = renderHook(() =>
      useGhostOrderSync({
        enabled: true,
        active: true,
        tableId: 'table-1',
        items: ITEMS,
        onExternalRemoval,
      }),
    );

    await waitFor(() => expect(result.current.ghostOrderId).toBe('ghost-1'));
    expect(onExternalRemoval).not.toHaveBeenCalled();

    // The cashier committed/discarded it: no removal event reached this client.
    act(() => {
      h.store.setState({ ghostOrders: [] });
    });

    await waitFor(() => expect(onExternalRemoval).toHaveBeenCalledTimes(1));
    expect(result.current.ghostOrderId).toBeNull();
  });

  it('keeps the binding while the draft is still open', async () => {
    const onExternalRemoval = vi.fn();
    const { result } = renderHook(() =>
      useGhostOrderSync({
        enabled: true,
        active: true,
        tableId: 'table-1',
        items: ITEMS,
        onExternalRemoval,
      }),
    );

    await waitFor(() => expect(result.current.ghostOrderId).toBe('ghost-1'));

    // Another waiter's draft shows up: ours is still open, nothing to release.
    act(() => {
      h.store.setState({ ghostOrders: [ghost('ghost-1'), ghost('ghost-2')] });
    });

    await act(async () => {
      await Promise.resolve();
    });
    expect(onExternalRemoval).not.toHaveBeenCalled();
    expect(result.current.ghostOrderId).toBe('ghost-1');
  });
});

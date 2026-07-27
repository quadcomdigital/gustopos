import type { OrderStatus } from "@gustopos/shared";

const TRANSITIONS: Record<OrderStatus, ReadonlySet<OrderStatus>> = {
  pending: new Set(["preparing", "cancelled"]),
  preparing: new Set(["pending", "ready", "cancelled"]),
  ready: new Set(["preparing", "served", "cancelled"]),
  served: new Set(["cancelled"]),
  paid: new Set(),
  cancelled: new Set(),
};

export function canTransitionOrderStatus(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) {
    return true;
  }
  return TRANSITIONS[from].has(to);
}

export function assertOrderStatusTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransitionOrderStatus(from, to)) {
    throw new Error(`Invalid order status transition: ${from} -> ${to}`);
  }
}

export const socketEvents = {
  orderNew: "order:new",
  orderUpdate: "order:update",
  ordersUpdate: "orders:update",
  inventoryUpdate: "inventory:update",
  tablesUpdate: "tables:update",
  dataUpdate: "data:update",
  settingsUpdate: "settings:update",
  groupOrderJoined: "group_order_joined",
  groupOrderCartUpdated: "group_order_cart_updated",
  groupOrderMasterChanged: "group_order_master_changed",
  groupOrderSubmitted: "group_order_submitted",
  bridgeStatus: "bridge:status",
  bridgeRemoved: "bridge:removed",
  jobClaimed: "job:claimed",
  jobCompleted: "job:completed",
  jobFailed: "job:failed",
} as const;

export type SocketEventName = (typeof socketEvents)[keyof typeof socketEvents];

/**
 * Targeted order-patch payload for `orders:update`. Emitted by the API
 * instead of the full `data:update` snapshot, so clients can reconcile
 * their local order list with a tiny payload.
 */
export type OrdersUpdatePatch =
  | { action: "set_paid"; tableNumber: string }
  | { action: "move"; fromTableNumber: string; toTableNumber: string };

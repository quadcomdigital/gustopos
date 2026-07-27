export const socketEvents = {
  orderNew: "order:new",
  orderUpdate: "order:update",
  inventoryUpdate: "inventory:update",
  dataUpdate: "data:update",
  settingsUpdate: "settings:update",
  groupOrderJoined: "group_order_joined",
  groupOrderCartUpdated: "group_order_cart_updated",
  groupOrderMasterChanged: "group_order_master_changed",
  groupOrderSubmitted: "group_order_submitted",
  bridgeStatus: "bridge:status",
  jobClaimed: "job:claimed",
  jobCompleted: "job:completed",
  jobFailed: "job:failed",
} as const;

export type SocketEventName = (typeof socketEvents)[keyof typeof socketEvents];

import { z } from "zod";
import {
  appDataSchema,
  ingredientSchema,
  orderSchema,
  reservationSchema,
  tableSchema,
  uiSettingsSchema,
  printBridgeSchema,
  printJobSchema,
  groupOrderRealtimeCartUpdatedSchema,
  groupOrderRealtimeJoinedSchema,
  groupOrderRealtimeMasterChangedSchema,
  groupOrderRealtimeSubmittedSchema,
  type AppData,
  type Ingredient,
  type Order,
  type Reservation,
  type PrintBridge,
  type PrintJob,
  type Table,
  type UiSettings,
} from "./contracts";

export const socketEvents = {
  orderNew: "order:new",
  orderUpdate: "order:update",
  ordersUpdate: "orders:update",
  reservationUpdate: "reservation:update",
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

const SOCKET_EVENT_NAMES: ReadonlySet<string> = new Set(Object.values(socketEvents));

export function isSocketEventName(value: string): value is SocketEventName {
  return SOCKET_EVENT_NAMES.has(value);
}

/**
 * Targeted order-patch payload for `orders:update`. Emitted by the API
 * instead of the full `data:update` snapshot, so clients can reconcile
 * their local order list with a tiny payload.
 */
export const ordersUpdatePatchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("set_paid"), tableNumber: z.string() }),
  z.object({ action: z.literal("move"), fromTableNumber: z.string(), toTableNumber: z.string() }),
]);

export type OrdersUpdatePatch = z.infer<typeof ordersUpdatePatchSchema>;

export const bridgeRemovedPayloadSchema = z.object({ id: z.string() });

/**
 * Zod schema for every socket event payload (Epic 7). Every emit is validated
 * against its schema on the server before fan-out, and every client handler
 * re-validates before applying, so a malformed payload can never reach state.
 */
export const socketEventPayloadSchema = {
  [socketEvents.orderNew]: orderSchema,
  [socketEvents.orderUpdate]: orderSchema,
  [socketEvents.ordersUpdate]: ordersUpdatePatchSchema,
  [socketEvents.reservationUpdate]: reservationSchema,
  [socketEvents.inventoryUpdate]: z.array(ingredientSchema),
  [socketEvents.tablesUpdate]: z.array(tableSchema),
  [socketEvents.dataUpdate]: appDataSchema,
  [socketEvents.settingsUpdate]: uiSettingsSchema,
  [socketEvents.groupOrderJoined]: groupOrderRealtimeJoinedSchema,
  [socketEvents.groupOrderCartUpdated]: groupOrderRealtimeCartUpdatedSchema,
  [socketEvents.groupOrderMasterChanged]: groupOrderRealtimeMasterChangedSchema,
  [socketEvents.groupOrderSubmitted]: groupOrderRealtimeSubmittedSchema,
  [socketEvents.bridgeStatus]: printBridgeSchema,
  [socketEvents.bridgeRemoved]: bridgeRemovedPayloadSchema,
  [socketEvents.jobClaimed]: printJobSchema,
  [socketEvents.jobCompleted]: printJobSchema,
  [socketEvents.jobFailed]: printJobSchema,
} satisfies Record<SocketEventName, z.ZodTypeAny>;

export type SocketEventPayloadMap = {
  [K in SocketEventName]: z.infer<(typeof socketEventPayloadSchema)[K]>;
};

export type SocketEventPayload = SocketEventPayloadMap[SocketEventName];

/**
 * Type-safe payload validation for a single event. Returns the parsed payload
 * on success, or null when the payload does not match the event contract.
 */
export function parseSocketEventPayload<E extends SocketEventName>(
  event: E,
  payload: unknown,
): SocketEventPayloadMap[E] | null {
  const result = socketEventPayloadSchema[event].safeParse(payload);
  return result.success ? (result.data as SocketEventPayloadMap[E]) : null;
}

/** Minimal Socket.IO client surface used by the typed subscriber helper. */
export interface SocketEventSubscriber {
  on(event: string, listener: (...args: unknown[]) => void): unknown;
  off(event: string, listener?: (...args: unknown[]) => void): unknown;
}

/**
 * Typed subscribe helper (Epic 7). Handlers receive an already-validated
 * payload; malformed payloads are dropped with a console warning instead of
 * corrupting client state.
 */
export function onSocketEvent<E extends SocketEventName>(
  socket: SocketEventSubscriber,
  event: E,
  handler: (payload: SocketEventPayloadMap[E]) => void,
): () => void {
  socket.on(event, (raw: unknown) => {
    const payload = parseSocketEventPayload(event, raw);
    if (payload === null) {
      console.warn(`[realtime] dropped invalid payload for ${event}`);
      return;
    }
    handler(payload);
  });
  return () => socket.off(event);
}

// Re-exported payload types for convenience so consumers do not need to
// import from the contract modules directly when typing socket handlers.
export type { AppData, Ingredient, Order, Reservation, PrintBridge, PrintJob, Table, UiSettings };

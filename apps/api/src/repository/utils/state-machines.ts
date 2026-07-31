// ─── State Machines ───────────────────────────────────────────────────────
// Extracted from app.repository.ts — pure data, no DB/NestJS deps.
// Define valid status transitions for reservations, deliveries, and purchase orders.

import type { ReservationStatus, DeliveryStatus, PurchaseOrderStatus } from "@gustopos/shared";

export const reservationTransitions: Record<ReservationStatus, ReservationStatus[]> = {
  pending: ["confirmed", "cancelled", "no_show", "seated"],
  confirmed: ["seated", "cancelled", "no_show"],
  seated: ["cancelled"],
  cancelled: [],
  no_show: [],
};

export const deliveryTransitions: Record<DeliveryStatus, DeliveryStatus[]> = {
  new: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["out_for_delivery", "cancelled"],
  out_for_delivery: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
};

export const purchaseOrderTransitions: Record<PurchaseOrderStatus, PurchaseOrderStatus[]> = {
  draft: ["sent", "cancelled"],
  sent: ["partial_received", "received", "cancelled"],
  partial_received: ["received", "cancelled"],
  received: [],
  cancelled: [],
};

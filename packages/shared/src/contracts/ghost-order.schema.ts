import { z } from "zod";
import { cartItemSchema } from "./cart.schema";
import { orderSchema } from "./order.schema";

/**
 * A "ghost order" is the server-side mirror of a waiter's POS cart before it
 * is sent. It is deliberately NOT an order: it never prints, never deducts
 * stock and never changes the table status. Only `commitGhostOrder` creates a
 * real order, atomically with the deletion of the draft.
 *
 * One open ghost exists per (tenant, table, owner staff): the waiter keeps
 * owning their cart, while the cashier/admin can see it and, if allowed,
 * commit or discard it.
 */
export const ghostOrderStatusSchema = z.enum([
  "open",
  "committing",
  "committed",
  "discarded",
]);

export const ghostOrderItemSchema = cartItemSchema.extend({
  /** Per-line "Salta stampa cucina" flag carried from the POS cart. */
  skipKitchenPrint: z.boolean().optional(),
});

export const ghostOrderSchema = z.object({
  id: z.string().min(1),
  /** Stable server key, always `dine_in:<tableId>`. */
  contextKey: z.string().min(1),
  ownerStaffId: z.string().min(1),
  /** Resolved for the cashier panel; never trusted for authorization. */
  ownerStaffName: z.string().optional(),
  orderType: z.literal("dine_in"),
  tableId: z.string().min(1),
  tableNumber: z.string().min(1),
  status: ghostOrderStatusSchema,
  version: z.number().int().nonnegative(),
  items: z.array(ghostOrderItemSchema),
  total: z.number().nonnegative(),
  itemCount: z.number().int().nonnegative(),
  committedOrderId: z.string().optional(),
  committedAt: z.string().datetime().optional(),
  discardedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  /**
   * Server clock of the last accepted mutation. Used by the cashier UI to
   * warn before committing a draft that is still being edited.
   */
  updatedAt: z.string().datetime(),
});

export const ghostOrderCreateRequestSchema = z.object({
  tableId: z.string().min(1),
  items: z.array(ghostOrderItemSchema).min(1, "A ghost order needs at least one item"),
});

/**
 * Full replacement: the waiter's local cart is the source of truth and every
 * debounced sync sends the whole snapshot. This keeps the protocol simple and
 * removes the need for line-level operations on a single-owner draft.
 */
export const ghostOrderPatchRequestSchema = z.object({
  expectedVersion: z.number().int().nonnegative(),
  items: z.array(ghostOrderItemSchema),
});

export const ghostOrderDiscardRequestSchema = z.object({
  expectedVersion: z.number().int().nonnegative().optional(),
  reason: z.string().max(200).optional(),
});

export const ghostOrderCommitRequestSchema = z.object({
  expectedVersion: z.number().int().nonnegative(),
  /**
   * Owner-only: the final local snapshot, so the last unsynced edit is part of
   * the same atomic commit instead of depending on the debounce window.
   * Admin/cashier commits omit it and send the server-canonical draft.
   */
  items: z.array(ghostOrderItemSchema).optional(),
  /** Reject the commit if the total changed since the confirmation dialog. */
  expectedTotal: z.number().nonnegative().optional(),
  /** Defaults to true. `false` is admin-only and audited. */
  print: z.boolean().optional(),
});

export const ghostOrderCommitResponseSchema = z.object({
  order: orderSchema,
  ghostOrderId: z.string(),
});

export const ghostOrderListResponseSchema = z.array(ghostOrderSchema);

export type GhostOrderStatus = z.infer<typeof ghostOrderStatusSchema>;
export type GhostOrderItem = z.infer<typeof ghostOrderItemSchema>;
export type GhostOrder = z.infer<typeof ghostOrderSchema>;
export type GhostOrderCreateRequest = z.infer<typeof ghostOrderCreateRequestSchema>;
export type GhostOrderPatchRequest = z.infer<typeof ghostOrderPatchRequestSchema>;
export type GhostOrderDiscardRequest = z.infer<typeof ghostOrderDiscardRequestSchema>;
export type GhostOrderCommitRequest = z.infer<typeof ghostOrderCommitRequestSchema>;
export type GhostOrderCommitResponse = z.infer<typeof ghostOrderCommitResponseSchema>;
export type GhostOrderListResponse = z.infer<typeof ghostOrderListResponseSchema>;

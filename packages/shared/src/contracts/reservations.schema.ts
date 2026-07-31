import { z } from "zod";

// ─── Reservations ───────────────────────────────────────────────────────────

export const reservationStatusSchema = z.enum(["pending", "confirmed", "seated", "cancelled", "no_show"]);

export const reservationSchema = z.object({
  id: z.string(),
  tableId: z.string().optional(),
  customerName: z.string().min(1),
  customerPhone: z.string().optional(),
  partySize: z.number().int().positive(),
  reservedFor: z.string(),
  status: reservationStatusSchema,
  noShowReason: z.string().optional(),
  notes: z.string().optional(),
  source: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const reservationListResponseSchema = z.array(reservationSchema);

export const reservationCreateRequestSchema = z.object({
  tableId: z.string().optional(),
  customerName: z.string().min(2).max(120),
  customerPhone: z.string().max(30).optional(),
  partySize: z.number().int().min(1).max(50),
  reservedFor: z.string().datetime(),
  notes: z.string().max(500).optional(),
  source: z.enum(["walk_in", "phone", "online", "manual"]).default("manual"),
});

export const reservationUpdateRequestSchema = z.object({
  tableId: z.string().optional(),
  customerName: z.string().min(2).max(120).optional(),
  customerPhone: z.string().max(30).optional(),
  partySize: z.number().int().min(1).max(50).optional(),
  reservedFor: z.string().datetime().optional(),
  status: reservationStatusSchema.optional(),
  noShowReason: z.string().min(3).max(160).optional(),
  notes: z.string().max(500).optional(),
  source: z.enum(["walk_in", "phone", "online", "manual"]).optional(),
});

export const reservationNoShowRequestSchema = z.object({
  reason: z.string().min(3).max(160),
});

export const reservationsQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  status: reservationStatusSchema.optional(),
  limit: z.number().int().min(1).max(500).optional(),
});

// ─── Inferred Types ─────────────────────────────────────────────────────────

export type ReservationStatus = z.infer<typeof reservationStatusSchema>;
export type Reservation = z.infer<typeof reservationSchema>;
export type ReservationListResponse = z.infer<typeof reservationListResponseSchema>;
export type ReservationCreateRequest = z.infer<typeof reservationCreateRequestSchema>;
export type ReservationUpdateRequest = z.infer<typeof reservationUpdateRequestSchema>;
export type ReservationNoShowRequest = z.infer<typeof reservationNoShowRequestSchema>;
export type ReservationsQuery = z.infer<typeof reservationsQuerySchema>;

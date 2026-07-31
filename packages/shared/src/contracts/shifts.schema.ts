import { z } from "zod";

// ─── Shift Enums ────────────────────────────────────────────────────────────

export const shiftStatusSchema = z.enum(["scheduled", "completed", "cancelled"]);
export const timeEntryStatusSchema = z.enum(["open", "closed", "anomaly"]);
export const timeEntrySourceSchema = z.enum(["web", "kiosk"]);

// ─── Shifts ─────────────────────────────────────────────────────────────────

export const shiftSchema = z.object({
  id: z.string(),
  staffId: z.string(),
  shiftDate: z.string(),
  startAt: z.string(),
  endAt: z.string(),
  toleranceEarlyMin: z.number().int().min(0).max(180),
  toleranceLateMin: z.number().int().min(0).max(180),
  status: shiftStatusSchema,
  notes: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const shiftCreateRequestSchema = z.object({
  staffId: z.string().min(1),
  shiftDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  toleranceEarlyMin: z.number().int().min(0).max(180).default(15),
  toleranceLateMin: z.number().int().min(0).max(180).default(15),
  notes: z.string().max(500).optional(),
});

export const shiftUpdateRequestSchema = z.object({
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
  toleranceEarlyMin: z.number().int().min(0).max(180).optional(),
  toleranceLateMin: z.number().int().min(0).max(180).optional(),
  status: shiftStatusSchema.optional(),
  notes: z.string().max(500).optional(),
});

export const shiftsQuerySchema = z.object({
  staffId: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  status: shiftStatusSchema.optional(),
  limit: z.number().int().min(1).max(500).optional(),
});

// ─── Time Entries ───────────────────────────────────────────────────────────

export const timeEntrySchema = z.object({
  id: z.string(),
  staffId: z.string(),
  shiftId: z.string().optional(),
  clockInAt: z.string(),
  clockOutAt: z.string().nullable(),
  status: timeEntryStatusSchema,
  source: timeEntrySourceSchema,
  notes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const clockInRequestSchema = z.object({
  staffId: z.string().min(1),
  shiftId: z.string().optional(),
  source: timeEntrySourceSchema.default("web"),
  at: z.string().datetime(),
});

export const clockOutRequestSchema = z.object({
  staffId: z.string().min(1),
  at: z.string().datetime(),
});

// ─── Time Reports ───────────────────────────────────────────────────────────

export const timeReportQuerySchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  staffId: z.string().optional(),
});

export const timeReportEntrySchema = z.object({
  staffId: z.string(),
  minutes: z.number().int().nonnegative(),
  date: z.string(),
  anomaly: z.boolean(),
});

export const timeReportResponseSchema = z.object({
  totalMinutes: z.number().int().nonnegative(),
  totalHours: z.number().nonnegative(),
  entries: z.array(timeReportEntrySchema),
});

// ─── Inferred Types ─────────────────────────────────────────────────────────

export type ShiftStatus = z.infer<typeof shiftStatusSchema>;
export type TimeEntryStatus = z.infer<typeof timeEntryStatusSchema>;
export type TimeEntrySource = z.infer<typeof timeEntrySourceSchema>;
export type Shift = z.infer<typeof shiftSchema>;
export type ShiftCreateRequest = z.infer<typeof shiftCreateRequestSchema>;
export type ShiftUpdateRequest = z.infer<typeof shiftUpdateRequestSchema>;
export type ShiftsQuery = z.infer<typeof shiftsQuerySchema>;
export type TimeEntry = z.infer<typeof timeEntrySchema>;
export type ClockInRequest = z.infer<typeof clockInRequestSchema>;
export type ClockOutRequest = z.infer<typeof clockOutRequestSchema>;
export type TimeReportQuery = z.infer<typeof timeReportQuerySchema>;
export type TimeReportEntry = z.infer<typeof timeReportEntrySchema>;
export type TimeReportResponse = z.infer<typeof timeReportResponseSchema>;

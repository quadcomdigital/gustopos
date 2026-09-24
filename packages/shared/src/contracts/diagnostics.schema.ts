import { z } from "zod";

/**
 * Client-side terminal diagnostics. Purely observational: the PWA reports the
 * viewport/screen it detects so an operator can verify what a given POS
 * terminal looks like (resolution, DPR, input kind, installed PWA) without
 * physical access. No business data, never persisted to the database.
 */
export const clientDiagnosticsSchema = z.object({
  /** Stable per-device id stored in localStorage on the terminal. */
  terminalId: z.string().max(64),
  /** `WxH@dpr` signature of the physical screen. */
  signature: z.string().max(64),
  input: z.enum(["touch", "fine"]),
  monitorClass: z.string().max(24),
  screenWidth: z.number().int().nonnegative(),
  screenHeight: z.number().int().nonnegative(),
  availWidth: z.number().int().nonnegative().optional(),
  availHeight: z.number().int().nonnegative().optional(),
  innerWidth: z.number().int().nonnegative(),
  innerHeight: z.number().int().nonnegative(),
  devicePixelRatio: z.number().positive(),
  colorDepth: z.number().int().nonnegative().optional(),
  standalonePwa: z.boolean().optional(),
  maxTouchPoints: z.number().int().nonnegative().optional(),
  coarsePointer: z.boolean().optional(),
  noHover: z.boolean().optional(),
  userAgent: z.string().max(400).optional(),
  platform: z.string().max(60).optional(),
  host: z.string().max(120).optional(),
  path: z.string().max(200).optional(),
  reportedAt: z.string().max(40).optional(),
});

export type ClientDiagnostics = z.infer<typeof clientDiagnosticsSchema>;

export const clientDiagnosticsRecordSchema = clientDiagnosticsSchema.extend({
  ip: z.string().nullable().optional(),
  receivedAt: z.string(),
});

export type ClientDiagnosticsRecord = z.infer<typeof clientDiagnosticsRecordSchema>;

export const clientDiagnosticsLatestResponseSchema = z.object({
  terminals: z.array(clientDiagnosticsRecordSchema),
});

export type ClientDiagnosticsLatestResponse = z.infer<typeof clientDiagnosticsLatestResponseSchema>;

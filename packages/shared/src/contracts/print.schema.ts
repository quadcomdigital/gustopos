import { z } from "zod";
import { printAreaSchema } from "../contracts/shared.schema";
import { fiscalPrinterConfigSchema } from "./fiscal.schema";

// ─── Print Job ─────────────────────────────────────────────────────────

export const printJobSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  area: z.union([printAreaSchema, z.string(), z.null()]).optional(),
  protocol: z.enum(["escpos", "disabled"]),
  status: z.enum(["pending", "dispatched", "completed", "failed"]),
  payload: z.string(),
  error: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  dispatchedAt: z.string().optional(),
  bridgeId: z.string().nullable().optional(),
});

export const printJobsListResponseSchema = z.array(printJobSchema);

export const printJobsQuerySchema = z.object({
  status: z.enum(["pending", "dispatched", "completed", "failed"]).optional(),
  area: z.string().optional(),
  limit: z.number().int().min(1).max(500).optional(),
});

export const printJobsPollQuerySchema = z.object({
  areas: z.string().min(1), // comma-separated: "kitchen,bar,cashier"
});

export const dispatchPrintJobRequestSchema = z.object({
  endpoint: z.string().url().optional(),
});

export const failPrintJobRequestSchema = z.object({
  error: z.string().min(1).max(500),
});

export const confirmPrintJobRequestSchema = z.object({
  notes: z.string().max(500).optional(),
});

export const retryPrintJobRequestSchema = z.object({
  notes: z.string().max(500).optional(),
});

// ─── UI Settings ───────────────────────────────────────────────────────

export const uiThemeSchema = z.object({
  primary: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  secondary: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  success: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  warning: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  danger: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  bg: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  border: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  textMain: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  textMuted: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

export const uiSettingsSchema = z.object({
  brandName: z.string().min(2).max(40),
  taxRate: z.number().min(0).max(1).default(0.10),
  theme: uiThemeSchema,
  printing: z.object({
    kitchenPrinterName: z.string().max(80),
    kitchenPrinterIp: z.string().max(45).optional(),
    kitchenPrinterPort: z.number().int().min(1).max(65535).optional(),
    cashierPrinterName: z.string().max(80),
    cashierPrinterIp: z.string().max(45).optional(),
    cashierPrinterPort: z.number().int().min(1).max(65535).optional(),
    barPrinterName: z.string().max(80),
    barPrinterIp: z.string().max(45).optional(),
    barPrinterPort: z.number().int().min(1).max(65535).optional(),
    protocol: z.enum(["escpos", "disabled"]),
    // Dynamic station ids that should receive order tickets (supersedes
    // activeAreas). Empty falls back to activeAreas for legacy settings.
    activeStationIds: z.array(z.string()).default([]),
    activeAreas: z.array(printAreaSchema),
    autoPrintKitchen: z.boolean(),
    autoPrintOnClose: z.boolean(),
    logoMode: z.enum(["none", "bitmap"]),
    // Base64 of the full ESC/POS raster command (GS v 0) produced by the
    // logo upload endpoint. Kept in settings so receipt builders splice the
    // already-converted bytes without needing an image decoder at print time.
    logoBitmap: z.string().max(400_000).optional(),
    logoWidth: z.number().int().min(128).max(576),
    logoThreshold: z.number().int().min(0).max(255),
    receiptFooter: z.string().max(200),
  }),
});

export const updateUiSettingsRequestSchema = uiSettingsSchema;

export const updatePrintingSettingsRequestSchema = z.object({
  printing: uiSettingsSchema.shape.printing.partial(),
});

export const printLogoUploadResponseSchema = z.object({
  // Base64 of the complete ESC/POS raster command (GS v 0) — ready to splice.
  logoBitmap: z.string().min(8).max(400_000),
  logoWidth: z.number().int().min(8).max(576),
  logoHeight: z.number().int().min(1).max(2048),
  byteLength: z.number().int().positive(),
});

// ─── Print-Bridge ──────────────────────────────────────────────────────

export const printBridgePrinterSchema = z.object({
  area: z.union([printAreaSchema, z.string(), z.null()]).optional(),
  name: z.string(),
  ip: z.string().nullable().optional(),
  port: z.number().nullable().optional(),
  // "qz" = printer installed on the POS PC and seen by QZ Tray;
  // "net" = raw network printer found by scanning the LAN.
  source: z.enum(["qz", "net"]).optional(),
  vendor: z.string().max(80).optional(),
  mac: z.string().max(32).optional(),
});
/* CASCADE2_PRINTER_SCHEMA_DONE */

export const printBridgePrinterMappingSchema = z.object({
  area: z.union([printAreaSchema, z.string(), z.null()]).optional(),
  name: z.string(),
  ip: z.string().nullable().optional(),
  port: z.number().nullable().optional(),
});
// CASCADE_CONTRACTS_PRINTER_MAPPING_DONE

export const printBridgeSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  instanceId: z.string().nullable().optional(),
  name: z.string(),
  host: z.string().nullable().optional(),
  version: z.string().nullable().optional(),
  status: z.string(),
  areas: z.array(z.string()).default([]),
  printers: z.array(printBridgePrinterSchema).default([]),
  mappings: z.array(printBridgePrinterMappingSchema).default([]),
  claimedAreas: z.array(z.string()).default([]),
  lastHeartbeatAt: z.string().nullable().optional(),
  lastError: z.string().nullable().optional(),
  diagnosticsAt: z.string().nullable().optional(),
  createdAt: z.string().nullable().optional(),
  updatedAt: z.string().nullable().optional(),
});

export const printBridgeHeartbeatRequestSchema = z.object({
  bridgeId: z.string(),
  name: z.string().optional(),
  host: z.string().optional(),
  version: z.string().optional(),
  areas: z.array(z.string()).default([]),
  printers: z.array(printBridgePrinterSchema).default([]),
});

// Command pushed to a bridge in the heartbeat response. One-shot: the agent
// executes it and acks, then the server clears it.
export const printBridgeCommandSchema = z.object({
  id: z.string(),
  type: z.enum(["scan", "test-print", "update"]),
  ip: z.string().max(45).optional(),
  port: z.number().int().min(1).max(65535).optional(),
  label: z.string().max(120).optional(),
  createdAt: z.string().optional(),
});

export const printBridgeHeartbeatResponseSchema = z.object({
  bridge: printBridgeSchema,
  serverTime: z.string(),
  // Present only when an admin requested a network scan or a direct test print
  // from Settings → Stampa.
  command: printBridgeCommandSchema.optional(),
  // Certified fiscal (Path B): the tenant's RT printer config, present only
  // when the tenant configured a device. The Go agent applies it on receipt.
  fiscalPrinter: fiscalPrinterConfigSchema.optional(),
});

// ─── Network discovery ─────────────────────────────────────────────────

export const printBridgeDiscoveredDeviceSchema = z.object({
  ip: z.string().min(1).max(45),
  port: z.number().int().min(1).max(65535),
  mac: z.string().max(32).optional(),
  vendor: z.string().max(80).optional(),
  source: z.literal("net").optional(),
});

export const printBridgeDiscoveredPrintersRequestSchema = z.object({
  bridgeId: z.string(),
  devices: z.array(printBridgeDiscoveredDeviceSchema).max(512),
});

export const printBridgeCommandAckRequestSchema = z.object({
  bridgeId: z.string(),
  commandId: z.string(),
  // Execution outcome reported by the agent (Go agent >= 0.14.0). `ok=false`
  // carries the failure reason, which the API records as a bridge log entry
  // so Settings → Diagnostica shows the test result instead of leaving the
  // admin guessing. Older agents omit both fields.
  ok: z.boolean().optional(),
  error: z.string().max(500).optional(),
});

// Admin request: direct test print to an arbitrary network printer (used to
// identify a discovered IP before binding it to a station).
export const printBridgeTestPrinterRequestSchema = z.object({
  ip: z.string().min(1).max(45),
  port: z.number().int().min(1).max(65535).optional(),
  label: z.string().max(120).optional(),
});

export const printBridgeClaimRequestSchema = z.object({
  bridgeId: z.string(),
  limit: z.number().int().positive().max(50).optional(),
});

export const printBridgeClaimResponseSchema = z.object({
  jobs: z.array(printJobSchema),
});

export const printBridgeJobCompleteRequestSchema = z.object({
  bridgeId: z.string(),
  notes: z.string().optional(),
});

export const printBridgeJobFailRequestSchema = z.object({
  bridgeId: z.string(),
  error: z.string(),
});

export const printBridgeOnboardingSecretSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  suggestedBridgeId: z.string(),
  boundBridgeId: z.string().nullable().optional(),
  isActive: z.boolean(),
  lastUsedAt: z.string().nullable().optional(),
  revokedAt: z.string().nullable().optional(),
  createdByStaffId: z.string().nullable().optional(),
  createdAt: z.string(),
});
// CASCADE_CONTRACTS_ONBOARDING_SECRET_DONE

export const printBridgeOnboardingSecretCreateModeSchema = z.enum(["long", "code-6digit"]);

export const printBridgeOnboardingSecretCreateRequestSchema = z.object({
  bridgeIdHint: z.string().min(1).max(80).optional(),
  mode: printBridgeOnboardingSecretCreateModeSchema.optional(),
  publicBaseUrl: z.string().url().optional(),
});

export const printBridgeOnboardingSecretCreateResponseSchema = z.object({
  mode: z.literal("long").default("long" as const),
  secret: printBridgeOnboardingSecretSchema,
  plaintext: z.string(),
  bootstrapSnippet: z.string(),
  suggestedBridgeId: z.string(),
});

export const printBridgeOnboardingSecretCreateCode6DigitResponseSchema = z.object({
  mode: z.literal("code-6digit"),
  secretId: z.string(),
  code: z.string().regex(/^\d{6}$/, "Code must be exactly 6 digits"),
  qrPayload: z.string().url(),
  ttlSeconds: z.number().int().positive(),
  expiresAt: z.string().datetime(),
  suggestedBridgeId: z.string(),
});

export const printBridgeUpdateMappingsRequestSchema = z.object({
  mappings: z.array(printBridgePrinterMappingSchema),
});

export const printBridgeUpdateClaimedAreasRequestSchema = z.object({
  claimedAreas: z.array(z.string()),
});

export const printBridgeTestPrintRequestSchema = z.object({
  area: z.union([printAreaSchema, z.string(), z.null()]).optional(),
  message: z.string().optional(),
});

export const printBridgeTestPrintResponseSchema = z.object({
  success: z.boolean(),
  jobId: z.string().optional(),
  dispatchedAt: z.string().optional(),
  error: z.string().optional(),
});

// ─── Print-bridge response envelopes ───────────────────────────────────

export const printBridgeListResponseSchema = z.object({
  bridges: z.array(printBridgeSchema),
});

export const printBridgeOnboardingSecretsListResponseSchema = z.object({
  secrets: z.array(printBridgeOnboardingSecretSchema),
});

export const printBridgeJobCompleteResponseSchema = z.object({
  job: printJobSchema,
});

export const printBridgeJobFailResponseSchema = z.object({
  job: printJobSchema,
});

export const printBridgePrintBridgesListResponseSchema = z.array(printBridgeSchema);

// ─── Agent diagnostics (logs + health) ─────────────────────────────────
//
// The Go agent keeps a local ring buffer of logs/status (local dashboard on
// 127.0.0.1) and ships a compact batch to the API so admins can inspect remote
// POS agents without physical access. Retention/pruning is server-side.

export const printBridgeLogLevelSchema = z.enum(["info", "warn", "error"]);

export const printBridgeLogEntrySchema = z.object({
  timestamp: z.string(),
  level: printBridgeLogLevelSchema,
  component: z.string().max(80).optional(),
  message: z.string().min(1).max(1000),
});

export const printBridgeDiagnosticsRequestSchema = z.object({
  bridgeId: z.string(),
  instanceId: z.string().optional(),
  version: z.string().max(40).optional(),
  os: z.string().max(40).optional(),
  // Last error surfaced by the agent, if any (kept on the bridge for a badge).
  lastError: z.string().max(500).nullable().optional(),
  logs: z.array(printBridgeLogEntrySchema).max(200).default([]),
});

export const printBridgeLogRecordSchema = printBridgeLogEntrySchema.extend({
  id: z.string(),
  bridgeId: z.string().nullable().optional(),
  createdAt: z.string(),
});

export const printBridgeDiagnosticsResponseSchema = z.object({
  bridgeId: z.string(),
  logs: z.array(printBridgeLogRecordSchema),
});

// ─── Local browser-bridge config ───────────────────────────────────────

export const localBridgePrinterMappingSchema = z.object({
  area: z.union([printAreaSchema, z.string(), z.null()]).optional(),
  printerName: z.string(),
  // Optional network-printer target. When `ip` is set, QZ Tray sends the raw
  // ESC/POS payload directly to `ip:port` (default port 9100) instead of using
  // a locally-installed driver by name.
  ip: z.string().max(45).optional(),
  port: z.number().int().min(1).max(65535).optional(),
});

export const localBridgeConfigSchema = z.object({
  enabled: z.boolean(),
  bridgeId: z.string(),
  deviceName: z.string(),
  areas: z.array(z.string()),
  printersPerArea: z.array(localBridgePrinterMappingSchema),
  enableWakeLock: z.boolean().default(true),
  enableKeepaliveWorker: z.boolean().default(true),
  heartbeatIntervalMs: z.number().int().positive().default(15000),
  claimIntervalMs: z.number().int().positive().default(3000),
  enabledAt: z.string(),
});

// ─── Default UI Settings ───────────────────────────────────────────────

export const defaultUiSettings: UiSettings = {
  brandName: "GUSTOPOS",
  taxRate: 0.10,
  theme: {
    primary: "#1a365d",
    secondary: "#2d3748",
    accent: "#3182ce",
    success: "#38a169",
    warning: "#dd6b20",
    danger: "#e53e3e",
    bg: "#f7fafc",
    border: "#e2e8f0",
    textMain: "#2d3748",
    textMuted: "#718096",
  },
  printing: {
    kitchenPrinterName: "Kitchen-01",
    kitchenPrinterIp: undefined,
    kitchenPrinterPort: undefined,
    cashierPrinterName: "Cashier-01",
    cashierPrinterIp: undefined,
    cashierPrinterPort: undefined,
    barPrinterName: "Bar-01",
    barPrinterIp: undefined,
    barPrinterPort: undefined,
    protocol: "escpos",
    activeStationIds: [],
    activeAreas: ["kitchen", "cashier"],
    autoPrintKitchen: true,
    autoPrintOnClose: false,
    logoMode: "none",
    logoBitmap: undefined,
    logoWidth: 384,
    logoThreshold: 160,
    receiptFooter: "Grazie per aver scelto GustoPOS",
  },
};

// ─── Types ─────────────────────────────────────────────────────────────

export type PrintJob = z.infer<typeof printJobSchema>;
export type PrintJobsListResponse = z.infer<typeof printJobsListResponseSchema>;
export type PrintJobsQuery = z.infer<typeof printJobsQuerySchema>;
export type DispatchPrintJobRequest = z.infer<typeof dispatchPrintJobRequestSchema>;
export type ConfirmPrintJobRequest = z.infer<typeof confirmPrintJobRequestSchema>;
export type RetryPrintJobRequest = z.infer<typeof retryPrintJobRequestSchema>;
export type UiTheme = z.infer<typeof uiThemeSchema>;
export type UiSettings = z.infer<typeof uiSettingsSchema>;
export type UpdateUiSettingsRequest = z.infer<typeof updateUiSettingsRequestSchema>;
export type UpdatePrintingSettingsRequest = z.infer<typeof updatePrintingSettingsRequestSchema>;
export type PrintLogoUploadResponse = z.infer<typeof printLogoUploadResponseSchema>;
export type PrintBridgePrinter = z.infer<typeof printBridgePrinterSchema>;
export type PrintBridgePrinterMapping = z.infer<typeof printBridgePrinterMappingSchema>;
export type PrintBridge = z.infer<typeof printBridgeSchema>;
export type PrintBridgeHeartbeatRequest = z.infer<typeof printBridgeHeartbeatRequestSchema>;
export type PrintBridgeHeartbeatResponse = z.infer<typeof printBridgeHeartbeatResponseSchema>;
export type PrintBridgeClaimRequest = z.infer<typeof printBridgeClaimRequestSchema>;
export type PrintBridgeClaimResponse = z.infer<typeof printBridgeClaimResponseSchema>;
export type PrintBridgeJobCompleteRequest = z.infer<typeof printBridgeJobCompleteRequestSchema>;
export type PrintBridgeJobFailRequest = z.infer<typeof printBridgeJobFailRequestSchema>;
export type PrintBridgeOnboardingSecret = z.infer<typeof printBridgeOnboardingSecretSchema>;
export type PrintBridgeOnboardingSecretCreateMode = z.infer<typeof printBridgeOnboardingSecretCreateModeSchema>;
export type PrintBridgeOnboardingSecretCreateRequest = z.infer<typeof printBridgeOnboardingSecretCreateRequestSchema>;
export type PrintBridgeOnboardingSecretCreateResponse = z.infer<typeof printBridgeOnboardingSecretCreateResponseSchema>;
export type PrintBridgeOnboardingSecretCreateCode6DigitResponse = z.infer<typeof printBridgeOnboardingSecretCreateCode6DigitResponseSchema>;
export type PrintBridgeUpdateMappingsRequest = z.infer<typeof printBridgeUpdateMappingsRequestSchema>;
export type PrintBridgeUpdateClaimedAreasRequest = z.infer<typeof printBridgeUpdateClaimedAreasRequestSchema>;
export type PrintBridgeTestPrintRequest = z.infer<typeof printBridgeTestPrintRequestSchema>;
export type PrintBridgeTestPrintResponse = z.infer<typeof printBridgeTestPrintResponseSchema>;
export type PrintBridgeCommand = z.infer<typeof printBridgeCommandSchema>;
export type PrintBridgeDiscoveredDevice = z.infer<typeof printBridgeDiscoveredDeviceSchema>;
export type PrintBridgeDiscoveredPrintersRequest = z.infer<typeof printBridgeDiscoveredPrintersRequestSchema>;
export type PrintBridgeCommandAckRequest = z.infer<typeof printBridgeCommandAckRequestSchema>;
export type PrintBridgeTestPrinterRequest = z.infer<typeof printBridgeTestPrinterRequestSchema>;
export type PrintBridgeListResponse = z.infer<typeof printBridgeListResponseSchema>;
export type PrintBridgeOnboardingSecretsListResponse = z.infer<typeof printBridgeOnboardingSecretsListResponseSchema>;
export type PrintBridgeJobCompleteResponse = z.infer<typeof printBridgeJobCompleteResponseSchema>;
export type PrintBridgeJobFailResponse = z.infer<typeof printBridgeJobFailResponseSchema>;
export type PrintBridgePrintBridgesListResponse = z.infer<typeof printBridgePrintBridgesListResponseSchema>;
export type PrintBridgeLogLevel = z.infer<typeof printBridgeLogLevelSchema>;
export type PrintBridgeLogEntry = z.infer<typeof printBridgeLogEntrySchema>;
export type PrintBridgeDiagnosticsRequest = z.infer<typeof printBridgeDiagnosticsRequestSchema>;
export type PrintBridgeLogRecord = z.infer<typeof printBridgeLogRecordSchema>;
export type PrintBridgeDiagnosticsResponse = z.infer<typeof printBridgeDiagnosticsResponseSchema>;
export type LocalBridgePrinterMapping = z.infer<typeof localBridgePrinterMappingSchema>;
export type LocalBridgeConfig = z.infer<typeof localBridgeConfigSchema>;
export type LocalBridgeArea = string;

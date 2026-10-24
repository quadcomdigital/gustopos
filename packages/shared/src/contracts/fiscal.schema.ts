import { z } from "zod";

// ─── Fiscal Closure (Path A — internal bookkeeping) ───────────────────────

export const fiscalClosureSchema = z.object({
  id: z.string(),
  businessDate: z.string(),
  closedByStaffId: z.string(),
  totals: z.object({
    gross: z.number(),
    refunds: z.number(),
    net: z.number(),
    cash: z.number(),
    card: z.number(),
  }),
  closedAt: z.string(),
  notes: z.string().optional(),
});

export const fiscalCloseRequestSchema = z.object({
  businessDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().max(500).optional(),
});

// ─── Fiscal Export (Path A — immutable CSV snapshots) ─────────────────────

export const fiscalExportStatusSchema = z.enum(["pending", "ready", "failed"]);
export const fiscalExportFormatSchema = z.enum(["csv"]);

export const fiscalExportSchema = z.object({
  id: z.string(),
  businessDate: z.string(),
  format: fiscalExportFormatSchema,
  status: fiscalExportStatusSchema,
  path: z.string(),
  generatedByStaffId: z.string(),
  generatedAt: z.string(),
  checksum: z.string().optional(),
  error: z.string().optional(),
});

export const fiscalExportCreateRequestSchema = z.object({
  businessDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  format: fiscalExportFormatSchema.default("csv"),
});

export const fiscalExportsQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  status: fiscalExportStatusSchema.optional(),
  limit: z.number().int().min(1).max(500).optional(),
});

// ─── Certified Fiscal Printer / Registratore Telematico (Path B) ──────────
// Emission to a certified RT device reached through the Go agent on the
// cashier PC (generic protocollo RT over TCP). Distinct from Path A (internal
// closure + export) which is pure bookkeeping with no hardware.

export const fiscalPrinterModelSchema = z.enum(["generic-rt", "epson-tm-s1000", "custom-vkp80iii", "rch-custom"]);

// ─── Selectable fiscal dialect (protocol / model / version) ───────────────
// The admin picks the dialect from Settings; the *codes* that implement it
// (framing, checksums, function letters, vendita/pagamento sequences) live
// ONLY server-side, in apps/api/src/fiscal/dialects. This file ships to the
// browser bundle, so it must never carry a protocol code — labels only.

/**
 * Fiscal protocol identifiers offered in the admin UI. Adding a dialect is a
 * server-side change (dialect engine + catalog entry); the enum only tells the
 * UI which ids exist.
 *  - `print3rt`   PRINT! 3.0 RT / Print! RT family (documented)
 *  - `rch-walle`  WALL-E MEC RT / K-BILL RT — prot. PrintF (verified live)
 *  - `ditron`     Ditron RT — awaiting vendor documentation
 *  - `rt-text`    protocollo RT testuale "storico": riproduce l'adattatore che
 *                 stava dentro l'agente, ora rimosso. Serve ai locali che
 *                 avevano un RT generico configurato senza dialetto.
 */
export const fiscalProtocolIdSchema = z.enum(["print3rt", "rch-walle", "ditron", "rt-text"]);

/** Physical link to the RT. Serial/USB are catalogued, TCP is the only one
 *  implemented by the current print agent. */
export const fiscalTransportSchema = z.enum(["tcp", "serial", "usb"]);

/** Evidence level of a catalogued dialect. `verified` = observed on real
 *  hardware; `documented` = from the vendor manual; `cataloguing` = no sources
 *  yet, therefore not selectable for emission. */
export const fiscalProtocolStatusSchema = z.enum(["verified", "documented", "cataloguing"]);

export const fiscalProtocolModelSchema = z.object({
  id: z.string().min(1).max(64),
  label: z.string().min(1).max(120),
});

/** Public (browser-safe) description of a dialect: labels and limits only. */
export const fiscalProtocolOptionSchema = z.object({
  id: fiscalProtocolIdSchema,
  label: z.string().min(1).max(120),
  vendor: z.string().min(1).max(80),
  status: fiscalProtocolStatusSchema,
  statusNote: z.string().max(400),
  models: z.array(fiscalProtocolModelSchema).min(1),
  transports: z.array(fiscalTransportSchema).min(1),
  defaultPort: z.number().int().min(1).max(65535).nullable(),
  defaultModel: z.string().min(1).max(64),
  defaultVersion: z.string().max(32),
  versions: z.array(z.string().max(32)),
  /** Minimum print-agent build able to run this dialect (null = the legacy
   *  adapter inside the current binaries already speaks it). */
  requiresAgentVersion: z.string().max(32).nullable(),
  /** false = catalogued but not yet selectable: the engine cannot emit. */
  selectionEnabled: z.boolean(),
  /** true = emission stops with a clear error until the agent is updated and
   *  the dialect is verified on the tenant's device. */
  emissionGated: z.boolean(),
});

export const fiscalProtocolsResponseSchema = z.object({
  protocols: z.array(fiscalProtocolOptionSchema),
});

// ─── Mappatura reparti (gustopos → reparto del RT) ────────────────────────
// Il **reparto** è il campo fiscalmente rilevante della battuta di vendita (da
// esso il RT ricava aliquota e natura bene/servizio), e la sua numerazione è
// **per piattaforma**: la stessa categoria gustopos può finire su reparti
// diversi su un Print RT 3.0 e su una WALL-E. Quindi la mappa si tiene per
// protocollo, e la risolve il server quando compone i frame: l'agente non
// compone nulla e non ha bisogno dei codici.

export const fiscalDepartmentKindSchema = z.enum(["good", "service", "unknown"]);

export const fiscalDepartmentSchema = z.object({
  /** Numero reparto del RT (1..99), lo stesso di `=R<n>` / `>R<n>`. */
  department: z.number().int().min(1).max(99),
  /** Descrizione operativa (max 36 caratteri, come la descrizione del comando). */
  label: z.string().max(36).default(""),
  /** Aliquota IVA come valore 0..39 (null = non ancora rilevata dal RT). */
  vatRate: z.number().int().min(0).max(39).nullable().default(null),
  /** Natura del reparto: `/@0` bene · `/@1` servizio. */
  kind: fiscalDepartmentKindSchema.default("unknown"),
  /** Categorie menu di gustopos che confluiscono su questo reparto. */
  categoryIds: z.array(z.string().max(64)).max(200).default([]),
  /** Reparto di ripiego per le categorie non mappate. Al più uno per gruppo. */
  isDefault: z.boolean().default(false),
});

export const fiscalDepartmentGroupSchema = z.object({
  protocolId: fiscalProtocolIdSchema,
  departments: z.array(fiscalDepartmentSchema).max(99).default([]),
});

/**
 * Briefing inviato all'agente nell'heartbeat: protocollo attivo + reparti
 * risolti per quel protocollo. Serve a istruire il gate comunicante (l'agente
 * può validare/loggare la mappatura e fare da specchio locale), restando il
 * server l'unico che compone i comandi.
 */
export const fiscalDepartmentBriefingSchema = z.object({
  protocolId: fiscalProtocolIdSchema,
  requiresAgentVersion: z.string().max(32).nullable(),
  /** Unico reparto di ripiego, quando configurato. */
  defaultDepartment: z.number().int().min(1).max(99).nullable(),
  /** Reparti con le categorie gustopos associate: l'istruzione completa. */
  departments: z.array(fiscalDepartmentSchema).max(99),
});

// ─── Collaudo dal vivo (sblocca l'emissione di un dialetto "gated") ──────
// Un dialetto nato dai manuali (`emissionGated: true`) non può emettere
// corrispettivi finché qualcuno non ha **prodotto la prova** su quella cassa:
// prova gestionale (non fiscale) eseguita davvero, quadratura letta dal RT,
// esito registrato. La prova non è una dichiarazione dell'utente: il server
// accetta solo un job `test` **completato** per quel protocollo, e ne conserva
// l'id come evidenza. Questo file arriva al browser, quindi qui c'è solo la
// forma del record: nessun codice di protocollo.

export const fiscalLiveVerificationSchema = z.object({
  protocolId: fiscalProtocolIdSchema,
  /** Quando il tecnico ha registrato l'esito (ISO 8601). */
  verifiedAt: z.string(),
  /** Chi ha registrato l'esito: resta nell'audit della configurazione. */
  verifiedByStaffId: z.string().max(64).default(""),
  /** Versione dell'agente che ha eseguito la prova (diagnosi se poi cambia). */
  agentVersion: z.string().max(32).default(""),
  /** Prova gestionale completata su cui si fonda il collaudo. */
  testJobId: z.string().max(64).default(""),
  /** Quadratura letta dal RT nella prova (Gran Totale, corrispettivi, …). */
  counters: z.record(z.string().max(24), z.string().max(40)).default({}),
  note: z.string().max(300).default(""),
});

/** Richiesta di registrazione/revoca del collaudo per il dialetto attivo. */
export const fiscalLiveVerificationRequestSchema = z.object({
  note: z.string().max(300).default(""),
});

export const fiscalPrinterConfigSchema = z.object({
  enabled: z.boolean().default(false),
  model: fiscalPrinterModelSchema.default("generic-rt"),
  // host può essere vuoto quando enabled=false (fiscale non configurata): il
  // default "" è legittimo, quindi niente min(1) qui — altrimenti il parse del
  // config assente fallisce e ogni heartbeat del print agent va in 500.
  host: z.string().max(253).default(""),
  port: z.number().int().min(1).max(65535).default(4001),
  // Commands differ per vendor; `generic-rt` uses the common @-command text
  // protocol. Per-model adapters can tune command strings later.
  protocol: z.literal("rt-text").default("rt-text"),
  // ── Dialetto selezionato dall'admin (additivo, retro-compatibile) ───────
  // null = adattatore storico dentro il binary (decide `model`): il motore
  // dialetti server-side non viene usato e nulla cambia per i tenant già
  // configurati. Valorizzato = i frame li compone il server.
  dialectId: fiscalProtocolIdSchema.nullable().default(null),
  dialectModel: z.string().max(64).default(""),
  dialectVersion: z.string().max(32).default(""),
  transport: fiscalTransportSchema.default("tcp"),
  // Solo per transport=serial: parametri della porta del RT (il baud dei
  // comandi non è dichiarato nei manuali, va letto sul dispositivo).
  baud: z.number().int().min(300).max(115200).default(9600),
  // Mappatura reparti per protocollo (una voce per dialetto configurato).
  departmentMappings: z.array(fiscalDepartmentGroupSchema).max(8).default([]),
  // Collaudi dal vivo registrati, uno per protocollo: sbloccano l'emissione
  // dei dialetti `emissionGated` (vedi fiscalLiveVerificationSchema).
  liveVerifications: z.array(fiscalLiveVerificationSchema).max(8).default([]),
});

export const fiscalPrinterConfigResponseSchema = z.object({
  fiscalPrinter: fiscalPrinterConfigSchema,
});

export const fiscalPrinterConfigUpdateRequestSchema = z.object({
  fiscalPrinter: fiscalPrinterConfigSchema.partial(),
});

// ─── Trasporto dei frame (l'agente è puro trasporto) ─────────────────────
// Il server compone i frame del dialetto (i codici restano server-side);
// l'agente scrive i byte, legge la risposta e la riporta. Nessuna
// interpretazione lato binary: la semantica fiscale resta sul server, che è
// anche il posto giusto per l'audit.

export const fiscalWireFrameSchema = z.object({
  /** Descrizione operativa ("vendita reparto 1"): finisce nei log, non è un comando. */
  label: z.string().max(80).default(""),
  /** Frame pronto in base64: l'agente lo scrive così com'è. */
  tx: z.string().min(1).max(8192),
  /** true = il RT risponde con la <DATA_ANSW> a 10 byte. */
  expectsAnswer: z.boolean().default(false),
  /** Pausa dopo la scrittura, prima della lettura. */
  waitMs: z.number().int().min(0).max(10_000).default(250),
});

/** Terminatore di lettura: proprietà del dispositivo, non del dialetto. */
export const fiscalWireTerminatorSchema = z.enum(["etx", "lf", "none"]);

export const fiscalWireSchema = z.object({
  /** Etichetta di audit del dialetto: l'agente non la interpreta. */
  protocolId: z.string().min(1).max(32),
  frames: z.array(fiscalWireFrameSchema).min(1).max(64),
  terminator: fiscalWireTerminatorSchema.default("etx"),
  maxResponseBytes: z.number().int().min(16).max(65536).default(4096),
  /** Distanziamento minimo fra frame (la famiglia PrintF rifiuta le raffiche). */
  pacingMs: z.number().int().min(0).max(10_000).default(500),
  timeoutMs: z.number().int().min(100).max(60_000).default(8000),
});

export const fiscalJobPurposeSchema = z.enum([
  "receipt",
  "test",
  "daily-close",
  "health",
  "counters",
  "identity",
  "departments",
  "program-departments",
  "drawer",
]);

export const fiscalWirePayloadSchema = z.object({
  wire: fiscalWireSchema,
  purpose: fiscalJobPurposeSchema,
  paymentId: z.string().max(64).optional(),
  businessDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  /**
   * Avvisi del motore al momento della composizione (descrizione adattata al
   * protocollo, comando non ancora verificato dal vivo, categoria finita sul
   * reparto di ripiego). Viaggiano col job perché il motivo di un'esecuzione
   * "corretta ma adattata" deve restare leggibile in Impostazioni e nei log.
   */
  warnings: z.array(z.string().max(200)).max(64).optional(),
});

// ─── Richieste della pagina fiscale (letture e programmazione) ────────────

/** Lettura della programmazione reparti dal RT (`<</?C/(Rnnn)`). */
export const fiscalDepartmentReadRequestSchema = z.object({
  /** Reparti da leggere. Omesso = quelli della mappatura configurata. */
  departments: z.array(z.number().int().min(1).max(99)).max(99).optional(),
});

export const fiscalDepartmentProgramRequestSchema = z.object({
  /**
   * Obbligatorio: la programmazione **scrive** sulla memoria del RT (aliquota e
   * natura del reparto) ed è l'unica operazione del percorso che modifica il
   * dispositivo. Il flag impedisce che una richiesta qualunque la esegua.
   */
  confirm: z.literal(true),
  departments: z
    .array(
      z.object({
        department: z.number().int().min(1).max(99),
        vatRate: z.number().int().min(0).max(39),
        kind: fiscalDepartmentKindSchema.default("good"),
        label: z.string().max(36).default(""),
        /** Prezzo del reparto in centesimi (0 = reparto a importo libero). */
        priceCents: z.number().int().nonnegative().default(0),
      }),
    )
    .min(1)
    .max(99),
});

/** Esito di un singolo frame, riportato dall'agente. */
export const fiscalWireExchangeSchema = z.object({
  label: z.string().max(80).default(""),
  rxHex: z.string().max(16384).default(""),
  error: z.string().max(300).optional(),
});

export const fiscalWireResponseSchema = z.object({
  exchanges: z.array(fiscalWireExchangeSchema).max(64),
});

// ─── Fiscal Job (agent-claimed, like print jobs) ──────────────────────────
// `receipt`/`chiusura`/`test` = documenti; `read`/`program` = letture e
// programmazione del RT (identità, quadratura, reparti).

export const fiscalJobTypeSchema = z.enum(["receipt", "chiusura", "test", "read", "program"]);
export const fiscalJobStatusSchema = z.enum(["pending", "dispatched", "completed", "failed"]);

export const fiscalReceiptItemSchema = z.object({
  name: z.string().min(1),
  quantity: z.number().int().positive(),
  price: z.number().nonnegative(),
});

export const fiscalReceiptPayloadSchema = z.object({
  paymentId: z.string(),
  items: z.array(fiscalReceiptItemSchema).min(1),
  subtotal: z.number().nonnegative(),
  discountAmount: z.number().nonnegative().default(0),
  total: z.number().nonnegative(),
  method: z.enum(["cash", "card", "mixed"]),
  businessDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

/** Valori letti dal RT e decodificati dal server (mai dall'agente). */
export const fiscalDepartmentReadSchema = z.object({
  department: z.number().int().min(1).max(99),
  label: z.string().max(40).default(""),
  priceCents: z.number().int().nonnegative().nullable().default(null),
  vatRate: z.number().int().min(0).max(39).nullable().default(null),
  kind: z.enum(["good", "service", "unknown"]).default("unknown"),
  /** Testo grezzo della risposta: la fonte autorevole finché il layout non è confermato. */
  raw: z.string().max(120).default(""),
  /** false = layout non ancora confermato dal vivo (posizioni da manuale). */
  layoutVerified: z.boolean().default(false),
});

export const fiscalJobExchangeSchema = z.object({
  label: z.string().max(80).default(""),
  rxHex: z.string().max(16384).default(""),
  dati: z.string().max(2048).default(""),
  ackReceived: z.boolean().default(false),
  nackReceived: z.boolean().default(false),
  checksumOk: z.boolean().default(false),
  /** null quando la risposta non è una <DATA_ANSW> (letture). */
  answerOk: z.boolean().nullable().default(null),
  errorCode: z.string().max(8).nullable().default(null),
  errorMessage: z.string().max(160).nullable().default(null),
  decodeError: z.string().max(200).default(""),
});

/** Result JSON del job fiscale, decodificato dal server. */
export const fiscalJobResultSchema = z.object({
  progressive: z.string().max(64).optional(),
  emittedAt: z.string().optional(),
  exchanges: z.array(fiscalJobExchangeSchema).max(64).optional(),
  counters: z.record(z.string().max(24), z.string().max(40)).optional(),
  departments: z.array(fiscalDepartmentReadSchema).max(99).optional(),
  notes: z.array(z.string().max(200)).max(32).optional(),
});

export const fiscalJobSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  type: fiscalJobTypeSchema,
  status: fiscalJobStatusSchema,
  payload: z.string(), // JSON string (fiscalReceiptPayloadSchema for receipts)
  result: z.string().optional(), // JSON string: { progressive, emittedAt } on success
  error: z.string().optional(),
  bridgeId: z.string().nullable().optional(),
  claimedByInstanceId: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  dispatchedAt: z.string().nullable().optional(),
  completedAt: z.string().nullable().optional(),
});

export const fiscalJobsQuerySchema = z.object({
  status: fiscalJobStatusSchema.optional(),
  type: fiscalJobTypeSchema.optional(),
  limit: z.number().int().min(1).max(500).optional(),
});

// ─── Fiscal-bridge protocol (agent ↔ API, mirrors print-bridge) ───────────

export const fiscalBridgeClaimRequestSchema = z.object({
  bridgeId: z.string(),
  limit: z.number().int().positive().max(20).optional(),
});

export const fiscalBridgeClaimResponseSchema = z.object({
  jobs: z.array(fiscalJobSchema),
});

export const fiscalBridgeJobCompleteRequestSchema = z.object({
  bridgeId: z.string(),
  // Il progressivo lo ricava il **server** dalla risposta del RT: l'agente non
  // interpreta nulla, e per le letture non esiste alcun progressivo.
  progressive: z.string().max(64).default(""),
  emittedAt: z.string().datetime().optional(),
  /** Risposte grezze dei frame (hex), da decodificare lato server. */
  response: fiscalWireResponseSchema.optional(),
});

export const fiscalBridgeJobFailRequestSchema = z.object({
  bridgeId: z.string(),
  error: z.string().min(1).max(500),
});

export const fiscalChiusuraRequestSchema = z.object({
  businessDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

// ─── Inferred Types ─────────────────────────────────────────────────────────

export type FiscalClosure = z.infer<typeof fiscalClosureSchema>;
export type FiscalCloseRequest = z.infer<typeof fiscalCloseRequestSchema>;
export type FiscalExportStatus = z.infer<typeof fiscalExportStatusSchema>;
export type FiscalExportFormat = z.infer<typeof fiscalExportFormatSchema>;
export type FiscalExport = z.infer<typeof fiscalExportSchema>;
export type FiscalExportCreateRequest = z.infer<typeof fiscalExportCreateRequestSchema>;
export type FiscalExportsQuery = z.infer<typeof fiscalExportsQuerySchema>;
export type FiscalPrinterModel = z.infer<typeof fiscalPrinterModelSchema>;
export type FiscalProtocolId = z.infer<typeof fiscalProtocolIdSchema>;
export type FiscalTransport = z.infer<typeof fiscalTransportSchema>;
export type FiscalProtocolStatus = z.infer<typeof fiscalProtocolStatusSchema>;
export type FiscalProtocolModel = z.infer<typeof fiscalProtocolModelSchema>;
export type FiscalProtocolOption = z.infer<typeof fiscalProtocolOptionSchema>;
export type FiscalProtocolsResponse = z.infer<typeof fiscalProtocolsResponseSchema>;
export type FiscalDepartmentKind = z.infer<typeof fiscalDepartmentKindSchema>;
export type FiscalDepartment = z.infer<typeof fiscalDepartmentSchema>;
export type FiscalDepartmentGroup = z.infer<typeof fiscalDepartmentGroupSchema>;
export type FiscalDepartmentBriefing = z.infer<typeof fiscalDepartmentBriefingSchema>;
export type FiscalLiveVerification = z.infer<typeof fiscalLiveVerificationSchema>;
export type FiscalLiveVerificationRequest = z.infer<typeof fiscalLiveVerificationRequestSchema>;
export type FiscalWireFrame = z.infer<typeof fiscalWireFrameSchema>;
export type FiscalWire = z.infer<typeof fiscalWireSchema>;
export type FiscalWirePayload = z.infer<typeof fiscalWirePayloadSchema>;
export type FiscalWireResponse = z.infer<typeof fiscalWireResponseSchema>;
export type FiscalJobPurpose = z.infer<typeof fiscalJobPurposeSchema>;
export type FiscalDepartmentReadRequest = z.infer<typeof fiscalDepartmentReadRequestSchema>;
export type FiscalDepartmentProgramRequest = z.infer<typeof fiscalDepartmentProgramRequestSchema>;
export type FiscalWireExchange = z.infer<typeof fiscalWireExchangeSchema>;
export type FiscalJobExchange = z.infer<typeof fiscalJobExchangeSchema>;
export type FiscalJobResult = z.infer<typeof fiscalJobResultSchema>;
export type FiscalDepartmentRead = z.infer<typeof fiscalDepartmentReadSchema>;
export type FiscalPrinterConfig = z.infer<typeof fiscalPrinterConfigSchema>;
export type FiscalPrinterConfigResponse = z.infer<typeof fiscalPrinterConfigResponseSchema>;
export type FiscalPrinterConfigUpdateRequest = z.infer<typeof fiscalPrinterConfigUpdateRequestSchema>;
export type FiscalJobType = z.infer<typeof fiscalJobTypeSchema>;
export type FiscalJobStatus = z.infer<typeof fiscalJobStatusSchema>;
export type FiscalReceiptItem = z.infer<typeof fiscalReceiptItemSchema>;
export type FiscalReceiptPayload = z.infer<typeof fiscalReceiptPayloadSchema>;
export type FiscalJob = z.infer<typeof fiscalJobSchema>;
export type FiscalJobsQuery = z.infer<typeof fiscalJobsQuerySchema>;
export type FiscalBridgeClaimRequest = z.infer<typeof fiscalBridgeClaimRequestSchema>;
export type FiscalBridgeClaimResponse = z.infer<typeof fiscalBridgeClaimResponseSchema>;
export type FiscalBridgeJobCompleteRequest = z.infer<typeof fiscalBridgeJobCompleteRequestSchema>;
export type FiscalBridgeJobFailRequest = z.infer<typeof fiscalBridgeJobFailRequestSchema>;
export type FiscalChiusuraRequest = z.infer<typeof fiscalChiusuraRequestSchema>;

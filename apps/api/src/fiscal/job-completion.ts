/**
 * Decisione di chiusura di un job fiscale.
 *
 * L'agente riporta le risposte **grezze** del RT: qui il server verifica
 * checksum, <DATA_ANSW>, NACK, estrae il progressivo e le quadrature, e decide
 * se il documento è emesso. Nessuna di queste valutazioni sta nell'agente: sul
 * binary distribuito non esiste logica fiscale (e nessun codice di protocollo).
 *
 * Funzione pura: il repository la chiama al `complete` dell'agente ed è testata
 * senza database.
 */

import {
  fiscalProtocolIdSchema,
  fiscalWirePayloadSchema,
  type FiscalJobExchange,
  type FiscalJobType,
  type FiscalWireResponse,
} from "@gustopos/shared";
import { resolveConfiguredDialect } from "./dialects";
import {
  decodeWireExchanges,
  exchangesAccepted,
  parseCounters,
  parseDepartmentPrograms,
  parseReceiptProgressive,
  summarizeJobResult,
} from "./dialects/wire";

export interface FiscalCompletionDecision {
  status: "completed" | "failed";
  /** JSON da scrivere in `fiscal_jobs.result`. */
  resultJson: string;
  /** Progressivo letto dal RT (null per le letture e quando il RT non risponde). */
  progressive: string | null;
  /** Motivo del fallimento, da mostrare in Impostazioni (null = riuscito). */
  error: string | null;
  /** Risposte decodificate, per log/audit del chiamante. */
  exchanges: FiscalJobExchange[];
}

const ERROR_MAX = 500;

export function decideFiscalCompletion(args: {
  jobType: FiscalJobType;
  payloadJson: string;
  response?: FiscalWireResponse;
  /** Progressivo dichiarato dall'agente: usato solo se il RT non lo dice. */
  progressive?: string;
}): FiscalCompletionDecision {
  const payload = fiscalWirePayloadSchema.safeParse(safeJson(args.payloadJson));
  const protocolId = payload.success ? fiscalProtocolIdSchema.safeParse(payload.data.wire.protocolId) : null;
  const dialect = protocolId?.success ? resolveConfiguredDialect(protocolId.data) : null;

  // Un payload senza `wire` è di un agente precedente al trasporto generico: non
  // ci sono frame a cui correlare le risposte, quindi si conserva il
  // comportamento storico (progressivo dichiarato dall'agente).
  const exchanges = dialect && args.response ? decodeWireExchanges(dialect, args.response) : [];
  const frames = payload.success ? payload.data.wire.frames : [];
  const documentFrames =
    dialect && frames.length === exchanges.length ? frames.map((frame) => frame.expectsAnswer) : undefined;
  const verdict = dialect ? exchangesAccepted(exchanges, documentFrames) : { ok: true, failures: [], notes: [] };

  const progressive = parseReceiptProgressive(exchanges) ?? (args.progressive?.trim() || null);
  const counters = parseCounters(exchanges);
  const departments = parseDepartmentPrograms(exchanges);
  const notes = Array.from(new Set([...(payload.success ? payload.data.warnings ?? [] : []), ...verdict.notes]));
  if (dialect && progressive === null && (args.jobType === "receipt" || args.jobType === "chiusura")) {
    notes.push("il RT non ha restituito il progressivo del documento: verifica sullo scontrino o in quadratura");
  }

  const resultJson = JSON.stringify(
    summarizeJobResult({
      exchanges,
      progressive,
      counters,
      departments,
      notes,
    }),
  );

  if (!verdict.ok) {
    const error = verdict.failures.join("; ");
    return {
      status: "failed",
      resultJson,
      progressive,
      error: error.length > ERROR_MAX ? `${error.slice(0, ERROR_MAX - 1)}…` : error,
      exchanges,
    };
  }

  return { status: "completed", resultJson, progressive, error: null, exchanges };
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

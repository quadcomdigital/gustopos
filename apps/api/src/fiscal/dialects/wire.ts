/**
 * Ponte fra il motore dialetti e il trasporto: costruisce il payload `wire`
 * che l'agente esegue e decodifica le risposte che l'agente riporta.
 *
 * Qui sta la regola centrale del canale: **i codici di protocollo non escono
 * dal server** (viaggiano solo come byte già composti) e **nessuna decisione
 * fiscale è presa dall'agente** (checksum, <DATA_ANSW>, progressivo, quadratura
 * e reparti si interpretano qui).
 *
 * RISERVATO — server-side soltanto.
 */

import {
  fiscalDepartmentReadSchema,
  fiscalJobExchangeSchema,
  fiscalJobResultSchema,
  fiscalWirePayloadSchema,
  type FiscalDepartmentRead,
  type FiscalJobExchange,
  type FiscalJobPurpose,
  type FiscalJobResult,
  type FiscalWirePayload,
  type FiscalWireResponse,
} from "@gustopos/shared";
import { decodePrintfExchange, PrintfFrameError } from "./printf-frame";
import type { FiscalDialectDefinition, FiscalDocument } from "./types";

const PRINTF_PACING_MS = 500;
const TEXT_PACING_MS = 100;

/** Costruisce il payload eseguibile dal trasporto dell'agente. */
export function buildWirePayload(
  dialect: FiscalDialectDefinition,
  document: FiscalDocument,
  extra: { purpose: FiscalJobPurpose; paymentId?: string; businessDate?: string },
): FiscalWirePayload {
  return fiscalWirePayloadSchema.parse({
    purpose: extra.purpose,
    ...(extra.paymentId ? { paymentId: extra.paymentId } : {}),
    ...(extra.businessDate ? { businessDate: extra.businessDate } : {}),
    ...(document.warnings.length > 0 ? { warnings: document.warnings } : {}),
    wire: {
      protocolId: dialect.id,
      terminator: dialect.framing.terminator,
      pacingMs: dialect.framing.kind === "printf" ? PRINTF_PACING_MS : TEXT_PACING_MS,
      frames: document.commands.map((entry) => ({
        label: entry.label,
        tx: Buffer.from(entry.frameHex, "hex").toString("base64"),
        expectsAnswer: entry.expectsAnswer,
        waitMs: entry.waitMs,
      })),
    },
  });
}

/**
 * Decodifica le risposte riportate dall'agente. Per i dialetti PrintF verifica
 * checksum, <LUNGH>, ACK/NACK e <DATA_ANSW>; per il protocollo testuale
 * restituisce il testo così com'è (non c'è checksum da verificare).
 */
export function decodeWireExchanges(
  dialect: FiscalDialectDefinition,
  response: FiscalWireResponse | undefined,
): FiscalJobExchange[] {
  const exchanges = response?.exchanges ?? [];
  return exchanges.map((exchange) => {
    if (exchange.error) {
      return fiscalJobExchangeSchema.parse({
        label: exchange.label,
        rxHex: exchange.rxHex,
        decodeError: exchange.error,
      });
    }
    if (dialect.framing.kind === "text-line") {
      const dati = Buffer.from(exchange.rxHex, "hex").toString("ascii").replace(/\r?\n$/, "").trim();
      return fiscalJobExchangeSchema.parse({
        label: exchange.label,
        rxHex: exchange.rxHex,
        dati,
        checksumOk: true,
      });
    }
    try {
      const decoded = decodePrintfExchange(exchange.rxHex);
      return fiscalJobExchangeSchema.parse({
        label: exchange.label,
        rxHex: exchange.rxHex,
        dati: decoded.dati,
        ackReceived: decoded.ackReceived,
        nackReceived: decoded.nackReceived,
        checksumOk: decoded.checksumOk,
        answerOk: decoded.answer ? decoded.answer.ok : null,
        errorCode: decoded.answer ? decoded.answer.errorCode : null,
        errorMessage: decoded.answer ? decoded.answer.errorMessage : null,
      });
    } catch (error) {
      // Due casi distinti:
      //  - <NACK> senza frame: il RT ha rifiutato il pacchetto (corrotto o
      //    duplicato) e non c'è nulla da decodificare;
      //  - testo non incorniciato: le letture possono rispondere in chiaro, e il
      //    testo grezzo è la fonte autorevole per il tecnico.
      const nackOnly = /^15/.test(exchange.rxHex.replace(/[\s:]/g, "").toUpperCase());
      return fiscalJobExchangeSchema.parse({
        label: exchange.label,
        rxHex: exchange.rxHex,
        dati: printableAscii(exchange.rxHex),
        nackReceived: nackOnly,
        decodeError: nackOnly
          ? "NACK dal RT: pacchetto rifiutato o duplicato"
          : error instanceof PrintfFrameError
            ? error.message
            : "risposta non decodificabile",
      });
    }
  });
}

/** Testo leggibile di una risposta non incorniciata (letture testuali). */
function printableAscii(rxHex: string): string {
  return Buffer.from(rxHex.replace(/[^0-9a-fA-F]/g, ""), "hex")
    .toString("ascii")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim();
}

export interface ExchangeVerdict {
  ok: boolean;
  /** Motivi che rendono il documento non emesso (da mostrare all'operatore). */
  failures: string[];
  /** Problemi delle sole letture: informativi, non bocciano un documento. */
  notes: string[];
}

/**
 * Esito di una sequenza. `documentFrames[i] === true` marca i frame che
 * **devono** essere accettati dal RT (`=`/`>` con <DATA_ANSW>): solo quelli
 * decidono se il documento è emesso. Le letture (`<</?…`, aggiunte dal server
 * per leggere lo stato dopo il documento) restano informative: un corrispettivo
 * già stampato non deve risultare "fallito" perché non si è potuto leggere il
 * progressivo.
 */
export function exchangesAccepted(
  exchanges: FiscalJobExchange[],
  documentFrames?: boolean[],
): ExchangeVerdict {
  const failures: string[] = [];
  const notes: string[] = [];
  exchanges.forEach((exchange, index) => {
    const isDocument = documentFrames ? documentFrames[index] !== false : true;
    const target = isDocument ? failures : notes;
    const reason = (() => {
      if (exchange.nackReceived) return "NACK dal RT";
      if (exchange.decodeError) return `risposta non leggibile (${exchange.decodeError})`;
      if (!exchange.checksumOk) return "checksum non valido";
      if (exchange.answerOk === false) {
        return `${exchange.errorCode ?? "errore"} ${exchange.errorMessage ?? ""}`.trim();
      }
      return null;
    })();
    if (reason) target.push(`${exchange.label || "frame"}: ${reason}`);
  });
  return { ok: failures.length === 0, failures, notes };
}

/**
 * Progressivo dell'ultimo documento commerciale, letto dallo stato del RT
 * (`<</?s`): `s` + errore(4) + stato documento(2) + chiave(1) + euro(1) +
 * numero ultimo documento(4). Formato confermato dalle evidenze live
 * (`s000000RE0001` → documento 1).
 */
export function parseLastDocumentFromStatus(dati: string): string | null {
  const match = /^s(\d{4})(\d{2})([A-Za-z])([A-Za-z])(\d{4})$/.exec(dati.trim());
  return match ? match[5] : null;
}

export function parseReceiptProgressive(exchanges: FiscalJobExchange[]): string | null {
  for (const exchange of exchanges) {
    const progressive = parseLastDocumentFromStatus(exchange.dati);
    if (progressive !== null) return progressive;
  }
  return null;
}

/** Contatori di quadratura letti dal RT (testo così com'è: sono letture). */
export function parseCounters(exchanges: FiscalJobExchange[]): Record<string, string> {
  const counters: Record<string, string> = {};
  for (const exchange of exchanges) {
    if (!exchange.label.startsWith("quadratura")) continue;
    const key = exchange.label.replace(/^quadratura\s*/, "").trim();
    if (key !== "" && exchange.dati !== "") counters[key] = exchange.dati;
  }
  return counters;
}

/**
 * Programmazione di un reparto (`<</?C/(Rnnn)`), dal manuale:
 * `R`, numero reparto (2), descrizione (20), prezzo (10 cifre), indice aliquota
 * (posizione 25), bene/servizio (posizione 29).
 *
 * ATTENZIONE: il layout posizionale viene dal manuale e **non è mai stato
 * verificato dal vivo** su un RT (nelle evidenze del 15/10 la lettura reparti
 * non è stata eseguita). Per questo il testo grezzo resta sempre nel risultato
 * e `layoutVerified` è false finché non si cattura un campione reale: la UI
 * mostra i due valori affiancati e il tecnico conferma.
 */
export function parseDepartmentPrograms(exchanges: FiscalJobExchange[], layoutVerified = false): FiscalDepartmentRead[] {
  const reads: FiscalDepartmentRead[] = [];
  for (const exchange of exchanges) {
    if (!exchange.label.startsWith("programmazione reparto")) continue;
    // Il numero del reparto richiesto è nella label: se la risposta è
    // illeggibile il reparto resta quello che il server ha interrogato.
    const requested = Number(/programmazione reparto (\d+)/.exec(exchange.label)?.[1]);
    const read = parseDepartmentProgram(exchange.dati, layoutVerified);
    const decoded = /^R\d{1,2}/.test(read.raw);
    reads.push(
      !decoded && Number.isInteger(requested) && requested >= 1 ? { ...read, department: requested } : read,
    );
  }
  return reads;
}

export function parseDepartmentProgram(dati: string | null | undefined, layoutVerified = false): FiscalDepartmentRead {
  const raw = String(dati ?? "").trim();
  if (raw === "") {
    // Nessun dato: il flag resta quello dichiarato dal chiamante (è una
    // proprietà dell'unità, non della singola risposta).
    return fiscalDepartmentReadSchema.parse({ department: 1, raw, layoutVerified });
  }
  const numberMatch = /^R(\d{1,2})/.exec(raw);
  if (!numberMatch) {
    return fiscalDepartmentReadSchema.parse({ department: 1, raw, layoutVerified });
  }
  const department = Number(numberMatch[1]);
  const description = raw.slice(3, 23).trim();
  const priceDigits = raw.slice(23, 33).trim();
  const priceCents = /^\d+$/.test(priceDigits) ? Number(priceDigits) : null;
  const vatChar = raw.slice(24, 26).trim();
  const vatRate = /^\d{1,2}$/.test(vatChar) ? Number(vatChar) : null;
  const kindChar = raw.slice(28, 30).trim();
  const kind = kindChar === "0" ? "good" : kindChar === "1" ? "service" : "unknown";
  return fiscalDepartmentReadSchema.parse({
    department,
    label: description.slice(0, 40),
    priceCents,
    vatRate,
    kind,
    raw: raw.slice(0, 120),
    layoutVerified,
  });
}

/** Aggrega gli esiti in un result JSON pronto per il job. */
export function summarizeJobResult(args: {
  exchanges: FiscalJobExchange[];
  progressive?: string | null;
  counters?: Record<string, string>;
  departments?: FiscalDepartmentRead[];
  notes?: string[];
}): FiscalJobResult {
  return fiscalJobResultSchema.parse({
    ...(args.progressive ? { progressive: args.progressive } : {}),
    emittedAt: new Date().toISOString(),
    exchanges: args.exchanges,
    ...(args.counters && Object.keys(args.counters).length > 0 ? { counters: args.counters } : {}),
    ...(args.departments && args.departments.length > 0 ? { departments: args.departments } : {}),
    ...(args.notes && args.notes.length > 0 ? { notes: args.notes.slice(0, 32) } : {}),
  });
}

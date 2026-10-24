/**
 * Tipi del motore dialetti fiscali (lato server).
 *
 * RISERVATO — un dialetto contiene i codici di protocollo del RT (riservati ai
 * tecnici autorizzati): questi moduli non devono essere importati da
 * `packages/shared`, dal bundle web o dal binary Go. L'unica cosa che esce dal
 * server è `toPublicOption()`, cioè label/modelli/versioni senza codici.
 */

import type { FiscalProtocolId, FiscalProtocolOption, FiscalProtocolStatus, FiscalTransport } from "@gustopos/shared";
import { encodePrintfFrame } from "./printf-frame";
import type { DepartmentProgram, PaymentMethod, SaleLine } from "./printf-commands";

export type { DepartmentProgram } from "./printf-commands";

/** Livello di evidenza di un singolo comando. */
export type FiscalCommandConfidence = "verified" | "documented" | "untested";

export interface FiscalCommandCapability {
  status: FiscalCommandConfidence;
  note: string;
}

/**
 * Framing del dialetto. È l'unica cosa che cambia nel trasporto:
 *  - `printf`    pacchetto binario <STX>…<ETX> (famiglia PrintF);
 *  - `text-line` comando testuale terminato da LF (protocolli storici).
 */
export interface FiscalFraming {
  kind: "printf" | "text-line";
  terminator: "etx" | "lf";
}

/** Un comando già incorniciato, pronto per il trasporto. */
export interface FiscalFramedCommand {
  /** Descrizione operativa ("chiave REG", "vendita reparto 1", …). */
  label: string;
  /** Comando nella grammatica del dialetto (`=C1`, `<</?s`, …). */
  command: string;
  /** Frame completo che l'agente deve scrivere sul socket. */
  frameHex: string;
  packId: string;
  /** Byte attesi in risposta (informativo per il decoder e per l'audit). */
  expectsAck: boolean;
  /** true = il RT risponde con la <DATA_ANSW> a 10 byte. */
  expectsAnswer: boolean;
  /** Stima del tempo di elaborazione del RT prima della risposta. */
  waitMs: number;
}

export type FiscalDocumentKind = "test" | "receipt" | "daily-close" | "identity" | "departments" | "health" | "drawer";

export interface FiscalDocument {
  kind: FiscalDocumentKind;
  dialectId: FiscalProtocolId;
  dialectLabel: string;
  /** Comandi in sequenza: l'agente li spedisce in quest'ordine. */
  commands: FiscalFramedCommand[];
  /** Adattamenti applicati ai dati di ingresso (descrizioni, ecc.). */
  warnings: string[];
}

export interface FiscalReceiptRequest {
  lines: SaleLine[];
  payment: PaymentMethod;
  /** Stampa il subtotale (`=S`) prima dell'incasso. */
  printSubtotal?: boolean;
  /** Manda `=C1` davanti al documento: senza chiave REG il RT rifiuta con E20. */
  ensureRegKey?: boolean;
  /** Pagamento esplicito (importo/descrizione/ticket); default: chiusura col dovuto. */
  paymentDetail?: { amountCents?: number; description?: string; tickets?: number };
}

export interface FiscalDialectDefinition {
  id: FiscalProtocolId;
  label: string;
  vendor: string;
  status: FiscalProtocolStatus;
  statusNote: string;
  models: Array<{ id: string; label: string }>;
  transports: FiscalTransport[];
  defaultPort: number | null;
  defaultModel: string;
  defaultVersion: string;
  /** Versioni/firmware catalogate per il selettore. */
  versions: string[];
  /** Build minima dell'agente capace di eseguire il dialetto (null = legacy). */
  requiresAgentVersion: string | null;
  selectionEnabled: boolean;
  emissionGated: boolean;
  framing: FiscalFraming;
  capabilities: Record<string, FiscalCommandCapability>;
  buildReceipt(request: FiscalReceiptRequest): FiscalDocument;
  buildTestDocument(): FiscalDocument;
  buildDailyClose(): FiscalDocument;
  buildIdentityReads(): FiscalDocument;
  buildHealthCheck(): FiscalDocument;
  /** Quadratura: Gran Totale, numero corrispettivi, chiusure giornaliere. */
  buildCounterReads(): FiscalDocument;
  buildDepartmentReads(departments: number[]): FiscalDocument;
  /**
   * Programmazione dei reparti sul RT (`>R…`): l'unica scrittura del percorso.
   * Implementata solo dai dialetti che hanno il comando documentato; gli altri
   * sollevano `FiscalDialectUnavailableError` invece di indovinare.
   */
  buildDepartmentPrograms(programs: DepartmentProgram[]): FiscalDocument;
  buildDrawerKick(): FiscalDocument;
  toPublicOption(): FiscalProtocolOption;
}

export class FiscalDialectUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FiscalDialectUnavailableError";
  }
}

/**
 * Prima build dell'agente in grado di eseguire i frame composti dal server
 * (trasporto generico, nessun codice di dialetto nel binary). Finché l'agente
 * installato è più vecchio, il gate blocca l'emissione invece di lasciar
 * cadere il job sull'adattatore storico: il numero va confermato in fase di
 * release dell'agente con passthrough.
 */
export const FISCAL_FRAME_PASSTHROUGH_AGENT_VERSION = "go-0.15.0";

const PACK_ID_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * Il manuale consiglia di far variare ciclicamente il <PACK-ID>; la WALL-E
 * risponde comunque sempre '8', quindi serve solo a rendere riconoscibili i
 * frame nell'audit — non a correlare richiesta e risposta.
 */
export function packIdForIndex(index: number): string {
  return PACK_ID_ALPHABET[index % PACK_ID_ALPHABET.length];
}

/** Frame testuale: il comando così com'è, terminato da LF. */
export function encodeTextLineFrame(command: string): Buffer {
  return Buffer.from(`${command}\n`, "ascii");
}

export interface PendingCommand {
  label: string;
  command: string;
  expectsAnswer?: boolean;
  waitMs?: number;
  packIdIndex?: number;
}

/**
 * Incornicia una sequenza di comandi secondo il framing del dialetto:
 * `printf` aggiunge <STX>/<LUNGH>/<CHK>/<ETX> e fa variare il <PACK-ID>,
 * `text-line` spedisce il comando terminato da LF.
 */
export function frameCommands(
  commands: PendingCommand[],
  framing: FiscalFraming = { kind: "printf", terminator: "etx" },
): FiscalFramedCommand[] {
  return commands.map((entry, index) => {
    if (framing.kind === "text-line") {
      return {
        label: entry.label,
        command: entry.command,
        frameHex: encodeTextLineFrame(entry.command).toString("hex").toUpperCase(),
        packId: "",
        expectsAck: false,
        expectsAnswer: entry.expectsAnswer ?? true,
        waitMs: entry.waitMs ?? 250,
      };
    }
    const packId = packIdForIndex(entry.packIdIndex ?? index);
    return {
      label: entry.label,
      command: entry.command,
      frameHex: encodePrintfFrame(entry.command, packId).toString("hex").toUpperCase(),
      packId,
      expectsAck: true,
      expectsAnswer: entry.expectsAnswer ?? (entry.command.startsWith("=") || entry.command.startsWith(">")),
      waitMs: entry.waitMs ?? 250,
    };
  });
}

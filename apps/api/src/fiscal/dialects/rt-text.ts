/**
 * Dialetto `rt-text` — protocollo RT testuale "storico".
 *
 * Perché esiste: l'agente conteneva un adattatore testuale (`@A`, `@T`, `@P…`,
 * `@E`, `@F`, `@X`) che **non era mai stato verificato** su hardware e che
 * teneva i comandi dentro il binary distribuito. Con il trasporto generico
 * quella tabella è stata rimossa dal Go: per non lasciare scoperti i locali che
 * avevano un RT generico configurato senza dialetto, gli stessi comandi vivono
 * qui, lato server, dietro lo schema `fiscalProtocolIdSchema`.
 *
 * Il framing è testuale (comando + LF), senza checksum: è l'unico dialetto che
 * non usa il pacchetto PrintF.
 *
 * RISERVATO — server-side soltanto (come gli altri dialetti).
 */

import type { FiscalProtocolId, FiscalProtocolOption, FiscalTransport } from "@gustopos/shared";
import {
  FiscalDialectUnavailableError,
  frameCommands,
  type FiscalDialectDefinition,
  type FiscalDocument,
  type PendingCommand,
} from "./types";

const FRAMING = { kind: "text-line" as const, terminator: "lf" as const };

/** Larghezza di stampa usata dall'adattatore storico per le descrizioni. */
const TEXT_DESCRIPTION_MAX = 42;

/** Neutralizza i caratteri che nel protocollo testuale farebbero da comando. */
function sanitizeTextMode(value: string, maxChars = TEXT_DESCRIPTION_MAX): { text: string; changed: boolean } {
  let out = "";
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (char === "@" || code < 0x20 || code === 0x7f) continue;
    if (out.length >= maxChars) break;
    out += char;
  }
  out = out.trim();
  return { text: out, changed: out !== value };
}

function euro(amount: number): string {
  return amount.toFixed(2);
}

export interface LegacyReceiptLine {
  description: string;
  quantity: number;
  amountCents: number;
}

function receiptLines(
  lines: LegacyReceiptLine[],
  payment: "cash" | "card",
  declaredTotal?: number,
): { commands: PendingCommand[]; warnings: string[] } {
  const warnings: string[] = [];
  const commands: PendingCommand[] = [{ label: "apertura documento", command: "@A" }];
  let computed = 0;
  for (const line of lines) {
    computed += (line.amountCents * line.quantity) / 100;
    const { text, changed } = sanitizeTextMode(line.description);
    if (changed) warnings.push(`descrizione adattata al protocollo: "${line.description}" -> "${text}"`);
    commands.push({
      label: `vendita ${line.quantity} x ${euro(line.amountCents / 100)}`,
      command: `${line.quantity}@${euro(line.amountCents / 100)}L${text}`,
    });
  }
  const total = declaredTotal === undefined ? computed : declaredTotal / 100;
  commands.push({ label: "subtotale", command: "@T" });
  commands.push({ label: `pagamento ${payment}`, command: `@P${payment}|${euro(total)}`, waitMs: 500 });
  commands.push({ label: "chiusura documento", command: "@E", waitMs: 500 });
  return { commands, warnings };
}

const PUBLIC_OPTION: FiscalProtocolOption = {
  id: "rt-text",
  label: "RT testo (compatibilità)",
  vendor: "Generico",
  status: "documented",
  statusNote:
    "Protocollo testuale storico: riproduce l'adattatore che stava dentro l'agente, mai verificato su un RT reale. Usalo solo se hai un RT generico già in servizio e non riesci a identificarne la famiglia.",
  models: [{ id: "generic-rt", label: "RT generico (protocollo testuale)" }],
  transports: ["tcp"],
  defaultPort: 4001,
  defaultModel: "generic-rt",
  defaultVersion: "",
  versions: [],
  requiresAgentVersion: "go-0.15.0",
  selectionEnabled: true,
  emissionGated: true,
};

/** Il protocollo testuale espone solo lo stato del dispositivo. */
function statusReads(): FiscalDocument {
  return {
    kind: "identity",
    dialectId: "rt-text",
    dialectLabel: PUBLIC_OPTION.label,
    commands: frameCommands([{ label: "stato RT", command: "@X", waitMs: 200 }], FRAMING),
    warnings: [
      "con questo protocollo non è possibile leggere la programmazione dei reparti: la mappatura va verificata a mano sul RT",
    ],
  };
}

export const rtTextDialect: FiscalDialectDefinition = {
  ...PUBLIC_OPTION,
  framing: FRAMING,
  capabilities: {
    saleByDepartment: { status: "untested", note: "protocollo storico dell'adattatore in-binary: mai verificato su hardware" },
    payment: { status: "untested", note: "@P{cash|card}|importo: mai verificato" },
    managementDocument: { status: "untested", note: "il protocollo testuale non ha un documento gestionale: il collaudo resta un documento fiscale" },
    dailyClose: { status: "untested", note: "@F: mai verificato" },
    counterReads: { status: "untested", note: "il protocollo testuale espone solo @X (stato)" },
  },
  buildReceipt(request) {
    const { commands, warnings } = receiptLines(
      request.lines.map((line) => ({
        description: line.description ?? "",
        quantity: line.quantity ?? 1,
        amountCents: line.amountCents,
      })),
      request.payment === "card" ? "card" : "cash",
      request.paymentDetail?.amountCents,
    );
    return {
      kind: "receipt",
      dialectId: "rt-text",
      dialectLabel: PUBLIC_OPTION.label,
      commands: frameCommands(commands, FRAMING),
      warnings,
    };
  },
  /**
   * ATTENZIONE: nel protocollo testuale non esiste un documento gestionale, e
   * l'adattatore storico emetteva uno **scontrino fiscale reale** di 0,00 €.
   * Il comportamento resta identico (compatibilità), ma è il motivo per cui il
   * dialetto nasce con `emissionGated: true`.
   */
  buildTestDocument() {
    const { commands, warnings } = receiptLines([{ description: "GUSTOPOS TEST FISCALE", quantity: 1, amountCents: 0 }], "cash");
    return {
      kind: "test",
      dialectId: "rt-text",
      dialectLabel: PUBLIC_OPTION.label,
      commands: frameCommands(commands, FRAMING),
      warnings,
    };
  },
  buildDailyClose() {
    return {
      kind: "daily-close",
      dialectId: "rt-text",
      dialectLabel: PUBLIC_OPTION.label,
      commands: frameCommands([{ label: "chiusura fiscale di giornata", command: "@F", waitMs: 4000 }], FRAMING),
      warnings: ["dailyClose: @F non verificato su hardware"],
    };
  },
  buildIdentityReads: statusReads,
  buildHealthCheck: statusReads,
  buildCounterReads: statusReads,
  buildDepartmentReads: statusReads,
  // La programmazione dei reparti non esiste nel protocollo testuale: invece di
  // comporre un comando inventato (che su un RT certificato cambierebbe aliquote
  // reali) il dialetto dichiara che non sa farlo.
  buildDepartmentPrograms() {
    throw new FiscalDialectUnavailableError(
      "il protocollo testuale non ha un comando di programmazione reparti: la mappatura va allineata a mano sul RT",
    );
  },
  buildDrawerKick() {
    return {
      kind: "drawer",
      dialectId: "rt-text",
      dialectLabel: PUBLIC_OPTION.label,
      commands: frameCommands([{ label: "apertura cassetto", command: "@C", waitMs: 300 }], FRAMING),
      warnings: ["drawer: @C mai verificato"],
    };
  },
  toPublicOption: () => ({ ...PUBLIC_OPTION }),
};

/** Solo per i test: qualifica il tipo senza esporre costanti interne. */
export const RT_TEXT_PROTOCOL_ID: FiscalProtocolId = "rt-text";
export const RT_TEXT_TRANSPORTS: FiscalTransport[] = PUBLIC_OPTION.transports;

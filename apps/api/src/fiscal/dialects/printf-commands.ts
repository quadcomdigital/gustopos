/**
 * Costruttori dei comandi della grammatica `=` (stampante fiscale) e `<`
 * (dump-enq) della famiglia PrintF.
 *
 * RISERVATO — server-side soltanto (vedi `printf-frame.ts`).
 *
 * Grammatica (manuale protocollo §1.5.2 / §1.6):
 *
 *   = <FUNZIONE> [ /VALORE1 ] [ /QUANTITA ] [ /DESCRIZIONE ] [ /SEGNO ] [ /VALORE2..7 ]
 *
 *   [VALORE1]     `$`     valore primario, cifre ASCII (1000 = 10,00 EUR)
 *   [QUANTITA]    `*`     quantita (max 3 decimali; se omessa vale 1)
 *   [DESCRIZIONE] `(…)`   testo libero
 *   [SEGNO]       `+` `-` forza il segno
 *   [VALORE2..7]  `&[]^_@` parametri secondari
 *
 *   <FUNZIONE> = ID_FUNZIONE (lettera, MINUSCOLE SIGNIFICATIVE) + numero
 *   opzionale (se omesso vale 1: `=R/$1000` = reparto 1).
 *
 * Qui vivono solo i comandi usati dal percorso di emissione, dalle letture di
 * quadratura e dalla chiusura; il catalogo completo (sconti, resi, fidelity,
 * DGFE, messa in servizio, …) è in `docs/16_catalogo-dialetti/print3rt.json`.
 */

import { PrintfFrameError, sanitizePrintfText } from "./printf-frame";

/** Limiti del protocollo (manuale §limiti). */
export const PRINTF_DESCRIPTION_MAX = 36;
export const PRINTF_MANAGEMENT_LINE_MAX = 48;
export const PRINTF_DEPARTMENT_MIN = 1;
export const PRINTF_DEPARTMENT_MAX = 99;

export interface PrintfCommandText {
  /** Comando nella grammatica `=` / `<`. */
  command: string;
  /** Descrizioni modificate dalla sanitizzazione (da mostrare nei log/UI). */
  warnings: string[];
}

/** 1000 = 10,00 EUR: il protocollo vuole i centesimi in cifre ASCII. */
export function formatEuroValue(cents: number): string {
  if (!Number.isFinite(cents) || cents < 0) {
    throw new PrintfFrameError(`invalid euro amount: ${cents}`);
  }
  return String(Math.round(cents));
}

/** Massimo 3 decimali; `1` non viene inviato (è il default del protocollo). */
export function formatQuantity(quantity: number): string | null {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new PrintfFrameError(`invalid quantity: ${quantity}`);
  }
  if (Number.isInteger(quantity) && quantity === 1) return null;
  const rounded = Math.round(quantity * 1000) / 1000;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

function assertDepartment(department: number): number {
  if (!Number.isInteger(department) || department < PRINTF_DEPARTMENT_MIN || department > PRINTF_DEPARTMENT_MAX) {
    throw new PrintfFrameError(
      `department must be an integer in ${PRINTF_DEPARTMENT_MIN}..${PRINTF_DEPARTMENT_MAX}: got ${department}`,
    );
  }
  return department;
}

/** `/&x` della vendita a reparto (§3.1): 0 vendita · 1 omaggio · 2 acconto · 3 buono. */
export type SaleLineKind = "sale" | "gift" | "prepaid" | "voucher";

const SALE_LINE_KIND_CODE: Record<SaleLineKind, string | null> = {
  sale: null,
  gift: "1",
  prepaid: "2",
  voucher: "3",
};

export interface SaleLine {
  /** Reparto del RT (1..99). Determina aliquota e bene/servizio. */
  department: number;
  amountCents: number;
  quantity?: number;
  description?: string;
  kind?: SaleLineKind;
}

/**
 * `=R[N]/$importo[/*quantita][/(descrizione)][/&x]` — vendita a reparto.
 * Il documento commerciale si apre da sé alla prima battuta.
 */
export function saleByDepartment(line: SaleLine): PrintfCommandText {
  const department = assertDepartment(line.department);
  const warnings: string[] = [];
  const parts: string[] = [`=R${department}`, `$${formatEuroValue(line.amountCents)}`];
  const quantity = line.quantity === undefined ? null : formatQuantity(line.quantity);
  if (quantity !== null) parts.push(`*${quantity}`);
  // Ordine degli esempi del manuale §3.1: =R2/$2000/&1/(OMAGGIO B).
  const kind = SALE_LINE_KIND_CODE[line.kind ?? "sale"];
  if (kind !== null) parts.push(`&${kind}`);
  if (line.description && line.description.trim() !== "") {
    const { text, changed } = sanitizePrintfText(line.description, PRINTF_DESCRIPTION_MAX);
    if (text !== "") parts.push(`(${text})`);
    if (changed) warnings.push(`descrizione adattata al protocollo: "${line.description}" -> "${text}"`);
  }
  return { command: parts.join("/"), warnings };
}

/** `=S` stampa il subtotale corrente del documento. */
export const SUBTOTAL_COMMAND = "=S";
/** `=K` azzera/cancella le operazioni in corso. */
export const CLEAR_COMMAND = "=K";
/** `=x` terminatore: annulla e chiude a zero il documento in corso. */
export const TERMINATOR_COMMAND = "=x";

/** `=$`1..5` dati cliente (tutte e cinque le righe sono obbligatorie). */
export const CUSTOMER_DATA_MAX = 40;

export type PaymentMethod = "cash" | "card" | "electronic" | "cheque" | "ticket" | "uncollected";

/** Forme di pagamento del manuale §3.4. */
const PAYMENT_CODE: Record<PaymentMethod, string> = {
  cash: "1",
  uncollected: "2",
  cheque: "3",
  card: "4",
  electronic: "4",
  ticket: "5",
};

export interface PaymentRequest {
  method: PaymentMethod;
  /** Omesso: il RT chiude il documento con l'importo a debito. */
  amountCents?: number;
  description?: string;
  /** Numero di ticket/buoni (solo `=T5`). */
  tickets?: number;
}

/**
 * `=T[N]/[$importo][/(descrizione)][/&numeroTicket]` — pagamento.
 * La descrizione non può contenere la parola TOTALE (E05).
 */
export function paymentCommand(request: PaymentRequest): PrintfCommandText {
  const warnings: string[] = [];
  const parts: string[] = [`=T${PAYMENT_CODE[request.method]}`];
  if (request.amountCents !== undefined) parts.push(`$${formatEuroValue(request.amountCents)}`);
  if (request.description && request.description.trim() !== "") {
    const { text, changed } = sanitizePrintfText(request.description, PRINTF_DESCRIPTION_MAX);
    if (text !== "") parts.push(`(${text})`);
    if (changed) warnings.push(`descrizione pagamento adattata: "${request.description}" -> "${text}"`);
  }
  if (request.tickets !== undefined) {
    if (request.tickets <= 0) throw new PrintfFrameError(`invalid ticket count: ${request.tickets}`);
    parts.push(`&${request.tickets}`);
  }
  return { command: parts.join("/"), warnings };
}

/** Apre/chiude un documento gestionale (NON fiscale, §4). */
export const MANAGEMENT_DOCUMENT_COMMAND = "=o";

/** Ristampa l'intestazione a documento gestionale aperto. */
export const MANAGEMENT_HEADER_COMMAND = "=H";

/** Riga di testo libero: `="/?A/(riga)`. */
export function textLine(text: string, maxChars = PRINTF_MANAGEMENT_LINE_MAX): PrintfCommandText {
  const { text: clean, changed } = sanitizePrintfText(text, maxChars);
  return {
    command: `="/?A/(${clean})`,
    warnings: changed ? [`riga gestionale adattata: "${text}" -> "${clean}"`] : [],
  };
}

/** Comandi di selezione chiave (§3.6). */
export const KEY_LOCK_COMMAND = "=C0";
export const KEY_REG_COMMAND = "=C1";
export const KEY_X_COMMAND = "=C2";
export const KEY_Z_COMMAND = "=C3";
export const KEY_PRG_COMMAND = "=C4";
export const KEY_SRV_COMMAND = "=C5";
/** In chiave Z esegue la chiusura fiscale, in chiave X la lettura giornaliera. */
export const DAILY_CLOSE_COMMAND = "=C10";
/** Apertura cassetto: solo a documento chiuso e non in PRG. */
export const OPEN_DRAWER_COMMAND = "=C86";

/** Letture (dump-enq, §6). */
export const READ_STATUS_COMMAND = "<</?s";
export const READ_SUBTOTAL_COMMAND = "<</?S";
/** Identificazione macchina: firmware, matricola, numero programmazioni, data/ora. */
export const READ_IDENTITY_COMMANDS = ["<</?f", "<</?m", "<</?n", "<</?d"];
/**
 * Quadratura: Gran Totale, numero corrispettivi, chiusure giornaliere.
 * Ogni voce ha una **label distinta**: serve al server per riconoscere quale
 * contatore ha risposto (l'agente riporta le risposte per label, non sa nulla
 * di contatori fiscali).
 */
export const READ_COUNTERS: Array<{ label: string; command: string }> = [
  { label: "quadratura gran totale", command: "<</?8" },
  { label: "quadratura corrispettivi", command: "<</?1" },
  { label: "quadratura chiusure giornaliere", command: "<</?7" },
];

/** Comandi della quadratura, in ordine. */
export const READ_COUNTER_COMMANDS = READ_COUNTERS.map((entry) => entry.command);
/** Progressivo dei documenti gestionali (verificato su WALL-E). */
export const READ_MANAGEMENT_DOC_COUNTER_COMMAND = "<</?N";
/** Programmazione di un reparto: `<</?C/(Rnnn)`. */
export function readDepartmentProgram(department: number): string {
  return `<</?C/(R${String(assertDepartment(department)).padStart(3, "0")})`;
}

/** Programmazione reparti: `>R<n>/?A/$Prezzo/*IVA/(descrizione)`. */
export interface DepartmentProgram {
  department: number;
  priceCents: number;
  /** Aliquota IVA come valore 0..39. */
  vatRate: number;
  description?: string;
  /** `/@0` bene · `/@1` servizio. */
  service?: boolean;
}

export function departmentProgram(program: DepartmentProgram): PrintfCommandText {
  const department = assertDepartment(program.department);
  if (!Number.isInteger(program.vatRate) || program.vatRate < 0 || program.vatRate > 39) {
    throw new PrintfFrameError(`VAT rate must be 0..39: got ${program.vatRate}`);
  }
  const warnings: string[] = [];
  const parts = [`>R${department}`, `?A`, `$${formatEuroValue(program.priceCents)}`, `*${program.vatRate}`];
  if (program.description && program.description.trim() !== "") {
    const { text, changed } = sanitizePrintfText(program.description, PRINTF_DESCRIPTION_MAX);
    if (text !== "") parts.push(`(${text})`);
    if (changed) warnings.push(`descrizione reparto adattata: "${program.description}" -> "${text}"`);
  }
  if (program.service !== undefined) parts.push(`@${program.service ? 1 : 0}`);
  return { command: parts.join("/"), warnings };
}

/**
 * Codec del framing della famiglia "Prot. PrintF" (RCH PRINT! 3.0 RT / Print!
 * RT / WALL-E MEC RT / K-BILL RT).
 *
 * RISERVATO — il contenuto di questo file non deve essere importato da
 * `packages/shared`, dal bundle web o dal binary Go: sta solo lato server.
 *
 * Struttura del pacchetto <DATA_CMD> (manuale protocollo §1.1 / §1.5.1):
 *
 *   <STX> <ADDS> <LUNGH> <PROT-ID> <DATI> <PACK-ID> <CHK> <ETX>
 *    02h    "01"   3 dec     'N'     dati    1 char    2 hex    03h
 *
 *   - <ADDS>    non usato: "01" per convenzione.
 *   - <LUNGH>   lunghezza di <DATI>, 3 cifre decimali.
 *   - <PROT-ID> fisso 'N' ("nuovo protocollo").
 *   - <PACK-ID> 1 carattere, rinviato indietro dal RT. La verifica live del
 *     15/10/2026 su WALL-E ha mostrato che il RT risponde **sempre '8'**
 *     qualunque cosa si invii: non correlare mai richiesta e risposta sul
 *     PACK-ID, correlare sui tempi/ordine della sessione.
 *   - <CHK>     XOR di tutto il pacchetto TRANNE <ETX> (quindi <STX> incluso),
 *     reso in 2 caratteri ASCII esadecimali maiuscoli.
 *
 * Il RT antepone <ACK> (06h) alla risposta; <NACK> (15h) segnala un frame
 * corrotto/duplicato. La regola del checksum è stata ricalcolata su tutte le
 * risposte reali raccolte il 15/10/2026 (`docs/15_evidenze_15-10-2026/prova.jsonl`:
 * 54/54 valide) e questo codec riproduce byte per byte il frame di richiesta
 * `<</?s` accettato dal dispositivo (PACK-ID '0', CHK '42').
 */

export const PRINTF_STX = 0x02;
export const PRINTF_ETX = 0x03;
export const PRINTF_ACK = 0x06;
export const PRINTF_NACK = 0x15;
export const PRINTF_ADDS = "01";
export const PRINTF_PROT_ID = "N";
export const PRINTF_LUNGH_DIGITS = 3;
/** Il RT rinvia il PACK-ID "tale e quale" da manuale, ma le unità verificate
 *  rispondono sempre '8': default difensivo per i confronti. */
export const PRINTF_DEVICE_PACK_ID = "8";

const PRINTF_MIN_PRINTABLE = 0x20;
const PRINTF_MAX_PRINTABLE = 0x7e;

export class PrintfFrameError extends Error {}

/** XOR semplice su una sequenza di byte (0 se vuota). */
export function xorBytes(bytes: ArrayLike<number>): number {
  let chk = 0;
  for (let i = 0; i < bytes.length; i += 1) chk ^= bytes[i] & 0xff;
  return chk & 0xff;
}

/**
 * Checksum di un frame completo: XOR di <STX>…<PACK-ID>, cioè tutto tranne
 * gli ultimi tre byte (<PACK-ID> non è escluso, <CHK> e <ETX> sì).
 */
export function printfFrameChecksum(frame: Uint8Array): number {
  if (frame.length < 12) {
    throw new PrintfFrameError("frame too short to checksum");
  }
  return xorBytes(frame.subarray(0, frame.length - 3));
}

function assertPrintableAscii(value: string, what: string): void {
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code < PRINTF_MIN_PRINTABLE || code > PRINTF_MAX_PRINTABLE) {
      throw new PrintfFrameError(
        `${what} contains character 0x${code.toString(16).padStart(2, "0")}: only printable ASCII 0x20-0x7E is allowed`,
      );
    }
  }
}

/** Costruisce il pacchetto <DATA_CMD> da inviare al RT. */
export function encodePrintfFrame(dati: string, packId = "0"): Buffer {
  if (dati.length === 0) {
    throw new PrintfFrameError("<DATI> cannot be empty");
  }
  if (packId.length !== 1) {
    throw new PrintfFrameError("<PACK-ID> must be exactly 1 character");
  }
  assertPrintableAscii(dati, "<DATI>");
  assertPrintableAscii(packId, "<PACK-ID>");
  if (dati.length > 999) {
    throw new PrintfFrameError(`<DATI> too long for <LUNGH>: ${dati.length} > 999`);
  }
  const body = `${PRINTF_ADDS}${String(dati.length).padStart(PRINTF_LUNGH_DIGITS, "0")}${PRINTF_PROT_ID}${dati}${packId}`;
  const head = Buffer.concat([Buffer.from([PRINTF_STX]), Buffer.from(body, "ascii")]);
  const checksum = xorBytes(head);
  return Buffer.concat([
    head,
    Buffer.from(checksum.toString(16).padStart(2, "0").toUpperCase(), "ascii"),
    Buffer.from([PRINTF_ETX]),
  ]);
}

export interface PrintfFrameParts {
  adds: string;
  lungh: number;
  protId: string;
  dati: string;
  packId: string;
  checksum: string;
  /** true quando <LUNGH> combacia con la lunghezza reale di <DATI>. */
  lunghConsistent: boolean;
}

/** Divide un frame (senza ACK/NACK) nei suoi campi. */
export function splitPrintfFrame(frame: Buffer): PrintfFrameParts {
  if (frame.length < 12) {
    throw new PrintfFrameError(`frame too short: ${frame.length} bytes`);
  }
  if (frame[0] !== PRINTF_STX) {
    throw new PrintfFrameError(`missing <STX>: first byte 0x${frame[0].toString(16)}`);
  }
  if (frame[frame.length - 1] !== PRINTF_ETX) {
    throw new PrintfFrameError(`missing <ETX>: last byte 0x${frame[frame.length - 1].toString(16)}`);
  }
  // head = <ADDS><LUNGH><PROT-ID><DATI>: fuori restano <PACK-ID><CHK><ETX>.
  const head = frame.subarray(1, -4).toString("ascii");
  const adds = head.slice(0, 2);
  const lunghText = head.slice(2, 5);
  const protId = head[5] ?? "";
  const dati = head.slice(6);
  const packId = String.fromCharCode(frame[frame.length - 4]);
  const checksum = frame.subarray(frame.length - 3, frame.length - 1).toString("ascii");
  const lungh = Number.parseInt(lunghText, 10);
  return {
    adds,
    lungh: Number.isNaN(lungh) ? -1 : lungh,
    protId,
    dati,
    packId,
    checksum,
    lunghConsistent: lungh === dati.length,
  };
}

/** La <DATA_ANSW> a 10 byte dei comandi `=` (manuale §1.1). */
export interface PrintfAnswer {
  /** 'O' eseguito · 'E' errore di esecuzione. */
  tipo: "O" | "E";
  /** 'N' nessun errore · 'G' generico · 'S' bloccante · 'P' fine carta. */
  famiglia: string;
  /** 4 caratteri, es. "0000" (nessuno) oppure "0020" = E20. */
  codice: string;
  /** 00 IDLE · 01 in transazione fiscale · 02 in pagamento · 03 input
   *  alfanumerico · 04 in attesa chiusura (02/03/04 solo con funzione STATI). */
  statoDocumento: string;
  segueMessaggio: string;
  libero: string;
  ok: boolean;
  /** "E20" quando il RT rifiuta l'esecuzione. */
  errorCode: string | null;
  /** Messaggio utente (cap. 10 del manuale protocollo). */
  errorMessage: string | null;
}

/**
 * Messaggi di errore del RT (cap. 10). Il campo <CODICE> della risposta usa la
 * stessa numerazione senza la lettera E.
 */
export const PRINTF_ERROR_MESSAGES: Record<string, string> = {
  E01: "Valore non valido",
  E02: "Funzione errata",
  E03: "Data errata",
  E04: "Ora errata",
  E05: "Voce TOTALE non ammessa",
  E06: "Codice articolo errato",
  E07: "Codice fiscale errato",
  E08: "Numero reparto non valido",
  E09: "Totale reparto negativo",
  E10: "Formato DGFE non valido",
  E11: "DGFE gia utilizzato",
  E12: "DGFE assente o errato",
  E13: "Errore formattazione DGFE",
  E14: "Errore scrittura DGFE",
  E15: "Errore RTC (data di sistema incoerente)",
  E16: "Documento non rettificabile/annullabile",
  E17: "Formato DGFE non corretto",
  E18: "Font B non disponibile",
  E19: "Formato DGFE non riconosciuto",
  E20: "Sequenza errata",
  E21: "Operazione non ammessa",
};

/** true quando <DATI> è la <DATA_ANSW> a 10 byte di un comando `=`/`>`. */
export function looksLikePrintfAnswer(dati: string): boolean {
  return dati.length === 10 && (dati.startsWith("O") || dati.startsWith("E"));
}

export function parsePrintfAnswer(dati: string): PrintfAnswer {
  if (dati.length < 10) {
    throw new PrintfFrameError(`answer too short (${dati.length} < 10): ${JSON.stringify(dati)}`);
  }
  const tipo = dati[0];
  if (tipo !== "O" && tipo !== "E") {
    throw new PrintfFrameError(`unexpected <TIPO> ${JSON.stringify(tipo)}: expected O or E`);
  }
  const famiglia = dati[1];
  const codice = dati.slice(2, 6);
  const numeric = Number.parseInt(codice, 10);
  // Il manuale numera gli errori come E01…E21: "0002" = E02, "0020" = E20.
  const errorCode =
    Number.isNaN(numeric) || numeric === 0 ? null : `E${String(numeric).padStart(2, "0")}`;
  return {
    tipo,
    famiglia,
    codice,
    statoDocumento: dati.slice(6, 8),
    segueMessaggio: dati[8],
    libero: dati[9],
    ok: tipo === "O",
    errorCode,
    errorMessage: errorCode ? PRINTF_ERROR_MESSAGES[errorCode] ?? `Errore RT ${errorCode}` : null,
  };
}

export interface PrintfExchange {
  /** Byte <ACK> visto prima del frame. */
  ackReceived: boolean;
  /** Byte <NACK> visto al posto del frame. */
  nackReceived: boolean;
  /** Frame grezzo esadecimale (senza ACK/NACK). */
  frameHex: string;
  packId: string;
  dati: string;
  checksum: string;
  checksumOk: boolean;
  lunghConsistent: boolean;
  /** Valorizzata solo quando <DATI> è una <DATA_ANSW> a 10 byte. */
  answer: PrintfAnswer | null;
  /** Byte dopo il primo <ETX> (una sessione può accodare più frame). */
  trailingHex: string;
}

function hexToBytes(hex: string): Buffer {
  const clean = hex.replace(/[\s:]/g, "").toUpperCase();
  if (clean.length % 2 !== 0) {
    throw new PrintfFrameError("hex payload has an odd number of characters");
  }
  if (!/^[0-9A-F]*$/.test(clean)) {
    throw new PrintfFrameError("hex payload contains non-hexadecimal characters");
  }
  return Buffer.from(clean, "hex");
}

/**
 * Decodifica la risposta del RT: <ACK>? <STX>…<ETX> con verifica di lunghezza
 * e checksum, più l'eventuale risposta a 10 byte per i comandi di documento.
 */
export function decodePrintfExchange(response: Buffer | string): PrintfExchange {
  const bytes = typeof response === "string" ? hexToBytes(response) : response;
  let offset = 0;
  let ackReceived = false;
  let nackReceived = false;
  if (bytes.length > 0 && bytes[0] === PRINTF_ACK) {
    ackReceived = true;
    offset = 1;
  } else if (bytes.length > 0 && bytes[0] === PRINTF_NACK) {
    nackReceived = true;
    offset = 1;
  }
  const start = bytes.indexOf(PRINTF_STX, offset);
  if (start < 0) {
    throw new PrintfFrameError("no <STX> in the device response");
  }
  const end = bytes.indexOf(PRINTF_ETX, start);
  if (end < 0) {
    throw new PrintfFrameError("truncated device response: no <ETX>");
  }
  const frame = bytes.subarray(start, end + 1);
  const parts = splitPrintfFrame(frame);
  const expected = printfFrameChecksum(frame);
  const declared = Number.parseInt(parts.checksum, 16);
  return {
    ackReceived,
    nackReceived,
    frameHex: Buffer.from(frame).toString("hex").toUpperCase(),
    packId: parts.packId,
    dati: parts.dati,
    checksum: parts.checksum,
    checksumOk: !Number.isNaN(declared) && declared === expected,
    lunghConsistent: parts.lunghConsistent,
    answer: looksLikePrintfAnswer(parts.dati) ? parsePrintfAnswer(parts.dati) : null,
    trailingHex: Buffer.from(bytes.subarray(end + 1)).toString("hex").toUpperCase(),
  };
}

/**
 * Neutralizza i caratteri che nel campo <DESCRIZIONE> verrebbero interpretati
 * come sintassi del protocollo (`/` parametri, `$` valore, `*` quantita,
 * `()` descrizione, `&[]^_@` valori secondari, `"` codice alfanumerico).
 * Senza questo filtro un nome di prodotto scelto dall'operatore potrebbe
 * aggiungere parametri o spezzare il comando (stessa logica di
 * sanitizeRTText lato agente). La parola TOTALE è rifiutata dal RT (E05) e
 * viene rimossa con una segnalazione esplicita.
 */
export function sanitizePrintfText(value: string, maxChars: number): { text: string; changed: boolean } {
  const original = value;
  let text = "";
  for (const char of value.replace(/TOTALE/gi, "")) {
    const code = char.charCodeAt(0);
    if (code < PRINTF_MIN_PRINTABLE || code > PRINTF_MAX_PRINTABLE) continue;
    if (`/*$()&[]^_@"`.includes(char)) continue;
    if (text.length >= maxChars) break;
    text += char;
  }
  text = text.trim();
  return { text, changed: text !== original };
}

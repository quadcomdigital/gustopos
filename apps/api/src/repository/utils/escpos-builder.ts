// ─── ESC/POS Binary Builder ─────────────────────────────────────────────
// Extracted from app.repository.ts — pure functions, no DB/NestJS deps.

/**
 * Printed tickets must show wall-clock time in the venue's timezone. The API
 * runs in UTC, so every `toLocale*` call on a ticket must pin the timezone
 * explicitly (or it silently prints UTC — e.g. 14:50 instead of 16:50 CEST).
 */
export const PRINT_TIMEZONE = "Europe/Rome";

/** HH:mm in the venue timezone (e.g. "16:50"). */
export function formatRomeTime(date: Date): string {
  return date.toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: PRINT_TIMEZONE,
  });
}

/** dd/mm/yyyy, HH:mm:ss in the venue timezone. */
export function formatRomeDateTime(date: Date): string {
  return date.toLocaleString("it-IT", { timeZone: PRINT_TIMEZONE });
}

/** yyyy-mm-dd of the venue's local day (fiscal/business date, not UTC). */
export function formatRomeDate(date: Date): string {
  // en-CA yields ISO-like yyyy-mm-dd, then we pin the venue timezone.
  return date.toLocaleDateString("en-CA", { timeZone: PRINT_TIMEZONE });
}

const ACCENT_MAP: Record<string, string> = {
  "\u00E0": "a", "\u00E8": "e", "\u00E9": "e", "\u00EC": "i",
  "\u00F2": "o", "\u00F3": "o", "\u00F9": "u", "\u00FC": "u",
  "\u00E1": "a", "\u00E2": "a", "\u00E4": "a",
  "\u00E7": "c", "\u00F1": "n",
};

/**
 * Sanitize text for CP437 thermal printers:
 * strips Italian accents and converts the euro sign to "EUR".
 */
export function sanitizeForCp437(text: string): string {
  return text.replace(/[\u00C0-\u024F]/g, (ch) => ACCENT_MAP[ch] ?? ch).replace(/\u20AC/g, "EUR");
}

/**
 * Encode a string to UTF-8 bytes after CP437 sanitization.
 */
export function escPosEncode(text: string): Uint8Array {
  return new TextEncoder().encode(sanitizeForCp437(text));
}

export class EscPosBuilder {
  private buf: number[] = [];

  init() {
    this.raw(0x1B, 0x40);
    return this;
  }

  bold(on: boolean) {
    this.raw(0x1B, 0x45, on ? 0x01 : 0x00);
    return this;
  }

  align(mode: "left" | "center" | "right") {
    const n = mode === "left" ? 0 : mode === "center" ? 1 : 2;
    this.raw(0x1B, 0x61, n);
    return this;
  }

  doubleWidth(on: boolean) {
    this.raw(0x1D, 0x21, on ? 0x10 : 0x00);
    return this;
  }

  doubleSize(on: boolean) {
    this.raw(0x1D, 0x21, on ? 0x11 : 0x00);
    return this;
  }

  doubleHeight(on: boolean) {
    this.raw(0x1D, 0x21, on ? 0x01 : 0x00);
    return this;
  }

  /**
   * Generic character size (GS ! n): width/height multipliers 1..8, encoded as
   * (width-1)<<4 | (height-1). Used by the calibration ticket to probe which
   * sizes a printer actually supports.
   */
  charSize(width: number, height: number) {
    const w = Math.min(8, Math.max(1, Math.trunc(width))) - 1;
    const h = Math.min(8, Math.max(1, Math.trunc(height))) - 1;
    this.raw(0x1D, 0x21, (w << 4) | h);
    return this;
  }

  /** Underline (ESC - n). */
  underline(on: boolean) {
    this.raw(0x1B, 0x2D, on ? 0x01 : 0x00);
    return this;
  }

  /** Double-strike / "doppio colpo" (ESC G n). */
  doubleStrike(on: boolean) {
    this.raw(0x1B, 0x47, on ? 0x01 : 0x00);
    return this;
  }

  /** White-on-black reverse (GS B n). */
  reverse(on: boolean) {
    this.raw(0x1D, 0x42, on ? 0x01 : 0x00);
    return this;
  }

  /** Upside-down printing (ESC { n). */
  upsideDown(on: boolean) {
    this.raw(0x1B, 0x7B, on ? 0x01 : 0x00);
    return this;
  }

  text(t: string) {
    const bytes = escPosEncode(t);
    for (const b of bytes) this.buf.push(b);
    return this;
  }

  line(t?: string) {
    if (t !== undefined) this.text(t);
    this.raw(0x0A);
    return this;
  }

  /**
   * Feed n lines (ESC d n). Advances paper by n lines before cutting.
   */
  feed(lines: number) {
    this.raw(0x1B, 0x64, lines);
    return this;
  }

  /**
   * Full cut with paper feed (GS V 48 = 0x30).
   * NO ESC @ before cut to avoid clearing the printer buffer on some models.
   */
  cut() {
    this.raw(0x1D, 0x56, 0x30);
    return this;
  }

  /**
   * Select font (ESC ! n).
   *   n=0: Font A (default, larger)
   *   n=1: Font B (condensed, allows more chars per line)
   */
  font(mode: "a" | "b") {
    this.raw(0x1B, 0x21, mode === "a" ? 0x00 : 0x01);
    return this;
  }

  raw(...bytes: number[]) {
    this.buf.push(...bytes);
    return this;
  }

  /**
   * Splice pre-encoded bytes (e.g. a GS v 0 raster command) into the payload.
   */
  bytes(data: Uint8Array) {
    for (const b of data) this.buf.push(b);
    return this;
  }

  build(): string {
    return Buffer.from(new Uint8Array(this.buf)).toString("base64");
  }
}

export const RECEIPT_WIDTH = 42;

/**
 * Cashier receipt uses Font B (condensed, 9x17 glyphs) so more chars fit per
 * line on 80mm paper. 56 = proportional to RECEIPT_WIDTH (42) scaled by the
 * Font B/Font A glyph-width ratio (12/9), with a small safety margin.
 */
export const CASHIER_RECEIPT_WIDTH = 56;

/**
 * True when the stored base64 is a valid GS v 0 raster command we can splice
 * (1D 76 30 header). Pure byte check — no image decoding involved.
 */
export function isValidLogoRaster(logoBitmap: string | undefined | null): boolean {
  if (!logoBitmap || typeof logoBitmap !== "string") return false;
  try {
    const bytes = Buffer.from(logoBitmap, "base64");
    return bytes.length >= 8 && bytes[0] === 0x1d && bytes[1] === 0x76 && bytes[2] === 0x30;
  } catch {
    return false;
  }
}

export function padRight(s: string, width: number): string {
  if (s.length >= width) return s.slice(0, width);
  return s + " ".repeat(width - s.length);
}

export function padLeft(s: string, width: number): string {
  if (s.length >= width) return s.slice(0, width);
  return " ".repeat(width - s.length) + s;
}

/**
 * Order the lines of a station ticket so the receiving station's own items are
 * grouped first (they print 2xl) and the other stations' items follow (small).
 * When round (portata) presentation is enabled, rounds stay the primary key so
 * each `--- portata ---` header remains unique; within a round the own-area
 * items still come first. The sort is stable, so the original order is kept
 * inside each group.
 */
export function orderStationTicketItems<
  T extends { stationId: string | null; round?: number | null },
>(items: T[], stationId: string, opts: { groupByRound: boolean }): T[] {
  const ownRank = (item: T) => (item.stationId === stationId ? 0 : 1);
  const ordered = [...items];
  if (opts.groupByRound) {
    ordered.sort((left, right) => {
      const leftRound = left.round ?? Number.MAX_SAFE_INTEGER;
      const rightRound = right.round ?? Number.MAX_SAFE_INTEGER;
      if (leftRound !== rightRound) return leftRound - rightRound;
      return ownRank(left) - ownRank(right);
    });
  } else {
    ordered.sort((left, right) => ownRank(left) - ownRank(right));
  }
  return ordered;
}

/**
 * Scopes the items printed on a station ticket.
 *
 * With `ownItemsOnly` the ticket contains only the receiving station's items;
 * items without a station assignment (`stationId === null`) are kept so nothing
 * is silently dropped. Without it the whole order is kept (legacy behaviour:
 * own items 2xl, other stations' items normal size).
 */
export function selectStationTicketItems<
  T extends { stationId: string | null },
>(items: T[], stationId: string, ownItemsOnly: boolean): T[] {
  if (!ownItemsOnly) return items;
  return items.filter((item) => item.stationId === stationId || item.stationId === null);
}

export function buildCashierReceiptPayload(params: {
  brandName: string;
  tableNumber: string;
  items: Array<{ name: string; quantity: number; price: number; notes: string | null }>;
  subtotal: number;
  discountAmount: number;
  surchargeAmount: number;
  total: number;
  method: "cash" | "card" | "mixed";
  paidAmount: number;
  changeAmount: number;
  notes: string | null;
  receiptFooter: string;
  logoMode: "none" | "bitmap";
  logoBitmap?: string;
  logoWidth: number;
  logoThreshold: number;
}): string {
  const {
    brandName,
    tableNumber,
    items,
    subtotal,
    discountAmount,
    surchargeAmount,
    total,
    method,
    paidAmount,
    changeAmount,
    notes,
    receiptFooter,
    logoMode,
    logoBitmap,
    logoWidth,
    logoThreshold,
  } = params;
  const ep = new EscPosBuilder();
  ep.init();

  const hasLogo = logoMode === "bitmap" && !!logoBitmap && isValidLogoRaster(logoBitmap);
  if (hasLogo) {
    // The stored logoBitmap is the base64 of a complete GS v 0 raster
    // command produced by the upload endpoint. Center it and splice it
    // verbatim. When a logo is present the brand-name line is omitted: the
    // logo already carries the brand.
    const raster = Buffer.from(logoBitmap as string, "base64");
    ep.align("center");
    ep.raw(0x1B, 0x33, 0x0A);
    ep.bytes(raster);
    ep.raw(0x1B, 0x32);
    ep.line();
  } else {
    ep.align("center").doubleWidth(true).bold(true);
    ep.line(brandName.toUpperCase());
    ep.doubleWidth(false).bold(false);
  }
  ep.align("left");
  ep.line();

  // Cashier body in Font B (condensed) — standard for cashier receipts: fits
  // more chars per line and keeps the ticket compact. CASHIER_RECEIPT_WIDTH
  // accounts for the narrower Font B glyphs when right-aligning prices.
  ep.font("b");
  ep.line(`Tavolo: ${tableNumber}`);
  ep.line(formatRomeDateTime(new Date()));
  ep.line();

  const fmt = (v: number) => `EUR ${v.toFixed(2)}`;
  for (const item of items) {
    const label = `${item.quantity}x ${item.name}`;
    const priceStr = fmt(item.price * item.quantity);
    const pad = CASHIER_RECEIPT_WIDTH - label.length - priceStr.length;
    ep.line(`${label}${pad > 0 ? " ".repeat(pad) : " "}${priceStr}`);
    if (item.notes) {
      ep.line(`  * ${item.notes}`);
    }
  }

  ep.line("-".repeat(CASHIER_RECEIPT_WIDTH));

  const row = (label: string, value: string, bold = false) => {
    const pad = CASHIER_RECEIPT_WIDTH - label.length - value.length;
    const line = `${label}${pad > 0 ? " ".repeat(pad) : " "}${value}`;
    if (bold) ep.bold(true).line(line).bold(false);
    else ep.line(line);
  };

  row("SUB TOTALE", fmt(subtotal));
  if (discountAmount > 0) row("SCONTO", `-${fmt(discountAmount)}`);
  if (surchargeAmount > 0) row("SUPPLEMENTO", fmt(surchargeAmount));
  row("TOTALE", fmt(total), true);
  ep.line();
  const methodLabel = method === "cash" ? "CONTANTI" : method === "card" ? "CARTA" : "MISTO";
  row("PAGAMENTO", methodLabel);
  row("PAGATO", fmt(paidAmount));
  if (changeAmount > 0) row("RESTO", fmt(changeAmount));
  if (notes) {
    ep.line(`Nota: ${notes}`);
  }
  ep.line();
  if (receiptFooter) {
    ep.align("center").line(receiptFooter);
  }
  // Fiscal disclaimer moved to the bottom of the receipt, after the footer.
  ep.align("center").line("SCONTRINO NON FISCALE");

  ep.feed(5);
  ep.cut();
  return ep.build();
}

/**
 * Pre-bill ("preconto") receipt: the items + total handed to the table before
 * payment. Deliberately omits payment/change rows and prints a clear
 * "PRECONTO" header + non-fiscal disclaimer so it is never mistaken for a
 * paid receipt. Reuses the cashier receipt layout/logo handling.
 */
export function buildPreBillPayload(params: {
  brandName: string;
  tableNumber: string;
  items: Array<{ name: string; quantity: number; price: number; notes: string | null }>;
  subtotal: number;
  discountAmount: number;
  surchargeAmount: number;
  total: number;
  receiptFooter: string;
  logoMode: "none" | "bitmap";
  logoBitmap?: string;
  logoWidth: number;
  logoThreshold: number;
}): string {
  const {
    brandName,
    tableNumber,
    items,
    subtotal,
    discountAmount,
    surchargeAmount,
    total,
    receiptFooter,
    logoMode,
    logoBitmap,
    logoWidth,
    logoThreshold,
  } = params;
  const ep = new EscPosBuilder();
  ep.init();

  const hasLogo = logoMode === "bitmap" && !!logoBitmap && isValidLogoRaster(logoBitmap);
  if (hasLogo) {
    const raster = Buffer.from(logoBitmap as string, "base64");
    ep.align("center");
    ep.raw(0x1B, 0x33, 0x0A);
    ep.bytes(raster);
    ep.raw(0x1B, 0x32);
    ep.line();
  } else {
    ep.align("center").doubleWidth(true).bold(true);
    ep.line(brandName.toUpperCase());
    ep.doubleWidth(false).bold(false);
  }
  ep.align("center").doubleWidth(true).bold(true);
  ep.line("PRECONTO");
  ep.doubleWidth(false).bold(false);
  ep.align("left");
  ep.line();

  ep.font("b");
  ep.line(`Tavolo: ${tableNumber}`);
  ep.line(formatRomeDateTime(new Date()));
  ep.line();

  const fmt = (v: number) => `EUR ${v.toFixed(2)}`;
  for (const item of items) {
    const label = `${item.quantity}x ${item.name}`;
    const priceStr = fmt(item.price * item.quantity);
    const pad = CASHIER_RECEIPT_WIDTH - label.length - priceStr.length;
    ep.line(`${label}${pad > 0 ? " ".repeat(pad) : " "}${priceStr}`);
    if (item.notes) {
      ep.line(`  * ${item.notes}`);
    }
  }

  ep.line("-".repeat(CASHIER_RECEIPT_WIDTH));

  const row = (label: string, value: string, bold = false) => {
    const pad = CASHIER_RECEIPT_WIDTH - label.length - value.length;
    const line = `${label}${pad > 0 ? " ".repeat(pad) : " "}${value}`;
    if (bold) ep.bold(true).line(line).bold(false);
    else ep.line(line);
  };

  row("SUB TOTALE", fmt(subtotal));
  if (discountAmount > 0) row("SCONTO", `-${fmt(discountAmount)}`);
  if (surchargeAmount > 0) row("SUPPLEMENTO", fmt(surchargeAmount));
  row("TOTALE", fmt(total), true);
  ep.line();
  if (receiptFooter) {
    ep.align("center").line(receiptFooter);
  }
  ep.align("center").line("PRECONTO NON FISCALE");

  ep.feed(5);
  ep.cut();
  return ep.build();
}

/**
 * Calibration ticket: an exhaustive sample of every ESC/POS text format this
 * builder can emit, each labeled with its exact command, so an operator can
 * choose a "grandezza" and see which ones the printer actually supports.
 *
 * Sections: FONT (A/B, bold, double-strike, underline, reverse, upside-down),
 * full character-size matrix (GS ! width x height, up to 4x), size + style
 * combinations, alignments (ESC a) and row widths (Font A=42 / Font B=56).
 */
export function buildCalibrationTicketPayload(params?: { brandName?: string }): string {
  const brandName = params?.brandName?.trim() || "GUSTOPOS";
  const ep = new EscPosBuilder();
  ep.init();

  const reset = () => {
    ep.charSize(1, 1);
    ep.bold(false).underline(false).doubleStrike(false).reverse(false).upsideDown(false);
    ep.align("left").font("a");
  };

  const section = (title: string) => {
    reset();
    ep.line();
    ep.bold(true).line(`== ${title} ==`).bold(false);
  };

  const entry = (label: string, sample: string, apply: () => void) => {
    reset();
    ep.line(`${label}:`);
    apply();
    ep.line(sample);
    reset();
  };

  reset();
  ep.align("center").charSize(2, 2).bold(true).line("CALIBRAZIONE ESC/POS");
  reset();
  ep.align("center").line(brandName.toUpperCase());
  ep.align("center").line(formatRomeDateTime(new Date()));

  section("FONT / STILI");
  entry("1 Font A", "ABC abc 123", () => ep.font("a"));
  entry("2 Font B condensato", "ABC abc 123", () => ep.font("b"));
  entry("3 Grassetto ESC E", "ABC abc 123", () => ep.bold(true));
  entry("4 Grassetto + Font B", "ABC abc 123", () => { ep.font("b"); ep.bold(true); });
  entry("5 Doppio colpo ESC G", "ABC abc 123", () => ep.doubleStrike(true));
  entry("6 Sottolineato ESC -", "ABC abc 123", () => ep.underline(true));
  entry("7 Invertito GS B", "ABC abc 123", () => ep.reverse(true));
  entry("8 Capovolto ESC {", "ABC abc 123", () => ep.upsideDown(true));

  section("GRANDEZZE GS ! (larghezza x altezza)");
  const sizes: Array<[number, number]> = [
    [1, 1], [1, 2], [1, 3],
    [2, 1], [2, 2], [2, 3],
    [3, 1], [3, 2], [3, 3],
    [4, 1], [4, 2],
  ];
  for (const [w, h] of sizes) {
    entry(`${w}x${h}`, "19:30", () => ep.charSize(w, h));
  }

  section("GRANDEZZE + STILI");
  entry("2x2 grassetto", "19:30", () => { ep.charSize(2, 2); ep.bold(true); });
  entry("2x2 doppio colpo", "19:30", () => { ep.charSize(2, 2); ep.doubleStrike(true); });
  entry("2x2 sottolineato", "19:30", () => { ep.charSize(2, 2); ep.underline(true); });
  entry("2x2 invertito", "19:30", () => { ep.charSize(2, 2); ep.reverse(true); });
  entry("3x3 grassetto", "19:30", () => { ep.charSize(3, 3); ep.bold(true); });
  entry("3x3 invertito", "19:30", () => { ep.charSize(3, 3); ep.reverse(true); });

  section("ALLINEAMENTI ESC a");
  ep.align("left").line("Sinistra");
  ep.align("center").line("Centro");
  ep.align("right").line("Destra");
  reset();

  section("LARGHEZZA RIGA");
  ep.font("a").line("A42: " + "1234567890".repeat(4) + "12");
  ep.font("b").line("B56: " + "1234567890".repeat(5) + "123456");
  reset();

  ep.align("center").line();
  ep.align("center").line("Fine calibrazione");
  ep.feed(4);
  ep.cut();
  return ep.build();
}

/**
 * Kitchen format test: a realistic (non-order) station ticket that mirrors the
 * chosen sizes so an operator can validate them in context:
 *   - "Consegna HH:mm"                      -> GRANDE x2 (GS 2x2)
 *   - modifiers + ALL sandwich changes (+/-) -> GS 2x1 + bold
 * One-shot test artifact, not used by real order printing.
 */
export function buildStationFormatTestPayload(params?: { stationName?: string }): string {
  const stationName = params?.stationName?.trim() || "CUCINA";
  const ep = new EscPosBuilder();
  ep.init();
  ep.font("a");

  ep.align("center").doubleSize(true).bold(true).line(stationName.toUpperCase());
  ep.doubleSize(false).bold(false);
  ep.align("left").line("TEST FORMATTAZIONE COMANDA");
  ep.line(formatRomeDateTime(new Date()));
  ep.line();
  ep.line("Ordine: TEST | Take away");
  ep.line("Cliente: TEST");
  ep.line();
  ep.doubleSize(true).line("Consegna 19:30").doubleSize(false);
  ep.line();

  const mod = (text: string) => ep.charSize(2, 1).bold(true).line(text).bold(false).charSize(1, 1);
  ep.charSize(2, 2).line("2x Margherita").charSize(1, 1);
  mod("  + Mozzarella");
  mod("  + Bacon");
  mod("  - Cipolla");
  mod("  Ben cotta");
  ep.line();

  ep.charSize(2, 2).line("1x Coca Cola").charSize(1, 1);
  ep.line();

  ep.line("-".repeat(RECEIPT_WIDTH));
  ep.align("center").bold(true).line("RIEPILOGO").bold(false).align("left");
  ep.line(`${padRight("MARGHERITA", 28)} ${String(2).padStart(4)}`);
  ep.line(`${padRight("TOTALE", 28)} ${String(3).padStart(4)}`);
  ep.line("-".repeat(RECEIPT_WIDTH));

  ep.align("center").line("Fine test");
  ep.feed(4);
  ep.cut();
  return ep.build();
}

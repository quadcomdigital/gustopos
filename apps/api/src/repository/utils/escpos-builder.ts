// ─── ESC/POS Binary Builder ─────────────────────────────────────────────
// Extracted from app.repository.ts — pure functions, no DB/NestJS deps.

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

export function padRight(s: string, width: number): string {
  if (s.length >= width) return s.slice(0, width);
  return s + " ".repeat(width - s.length);
}

export function padLeft(s: string, width: number): string {
  if (s.length >= width) return s.slice(0, width);
  return " ".repeat(width - s.length) + s;
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

  if (logoMode === "bitmap" && logoBitmap) {
    ep.raw(0x1B, 0x33, 0x0A);
    ep.line(`LOGO_BITMAP:${logoWidth}:${logoThreshold}`);
    ep.raw(0x1B, 0x32);
  }

  ep.align("center").doubleWidth(true).bold(true);
  ep.line(brandName.toUpperCase());
  ep.doubleWidth(false).bold(false);
  ep.align("center").line("SCONTRINO NON FISCALE");
  ep.align("left");
  ep.line();

  // Cashier body in Font B (condensed) — standard for cashier receipts: fits
  // more chars per line and keeps the ticket compact. CASHIER_RECEIPT_WIDTH
  // accounts for the narrower Font B glyphs when right-aligning prices.
  ep.font("b");
  ep.line(`Tavolo: ${tableNumber}`);
  ep.line(new Date().toLocaleString("it-IT"));
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

  ep.feed(5);
  ep.cut();
  return ep.build();
}

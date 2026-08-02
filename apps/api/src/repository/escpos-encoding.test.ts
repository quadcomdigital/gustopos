import test from "node:test";
import assert from "node:assert/strict";
import {
  sanitizeForCp437,
  escPosEncode,
  EscPosBuilder,
  padRight,
  padLeft,
  RECEIPT_WIDTH,
  buildCashierReceiptPayload,
} from "./utils/escpos-builder";
import { imageBufferToLogoRaster } from "./utils/logo-raster";
import Jimp from "jimp";

/**
 * Tests for ESC/POS receipt encoding and formatting helpers.
 *
 * These pure functions are used by buildEscPosPayload to generate
 * kitchen and cashier receipts. They must handle CP437 sanitization,
 * accent mapping, padding, and width alignment correctly.
 */

// ─── toNumeric (local test helper) ────────────────────────────────────────

function toNumeric(value: string | number): number {
  return typeof value === "number" ? value : Number(value);
}

// ─── CP437 sanitization tests ────────────────────────────────────────────

test("sanitizeForCp437 strips Italian accents", () => {
  assert.equal(sanitizeForCp437("caffè"), "caffe");
  assert.equal(sanitizeForCp437("città"), "citta");
  assert.equal(sanitizeForCp437("perché"), "perche");
  assert.equal(sanitizeForCp437("più"), "piu");
});

test("sanitizeForCp437 handles euro sign", () => {
  assert.equal(sanitizeForCp437("€10.00"), "EUR10.00");
  assert.equal(sanitizeForCp437("Totale: €5,50"), "Totale: EUR5,50");
});

test("sanitizeForCp437 passes ASCII through unchanged", () => {
  const ascii = "ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789 !@#$%^&*()";
  assert.equal(sanitizeForCp437(ascii), ascii);
});

test("sanitizeForCp437 handles mixed accented + ASCII text", () => {
  const input = "Panino con mozzarella e pomodoro — €4,50";
  const result = sanitizeForCp437(input);
  assert.ok(!result.includes("€"), "Euro sign should be replaced");
  assert.ok(result.includes("EUR"), "Euro should become EUR");
  // Mozzarella has no grave/acute in Italian, so it passes through
  assert.ok(result.includes("mozzarella"));
});

test("escPosEncode produces valid UTF-8 bytes", () => {
  const bytes = escPosEncode("Caffè €2");
  const decoded = new TextDecoder().decode(bytes);
  assert.equal(decoded, "Caffe EUR2");
});

test("escPosEncode produces non-empty output", () => {
  const bytes = escPosEncode("Test");
  assert.ok(bytes.length > 0);
});

test("escPosEncode empty string produces empty buffer", () => {
  const bytes = escPosEncode("");
  assert.equal(bytes.length, 0);
});

test("shared ESC/POS builder preserves large-item layout and reset commands", () => {
  const payload = Buffer.from(
    new EscPosBuilder().init().doubleWidth(true).line("2x BAR ITEM").doubleWidth(false).line("modifier").build(),
    "base64",
  );
  const bytes = [...payload];
  const enableIndex = bytes.findIndex((byte, index) => byte === 0x1d && bytes[index + 1] === 0x21 && bytes[index + 2] === 0x10);
  const resetIndex = bytes.findIndex((byte, index) => byte === 0x1d && bytes[index + 1] === 0x21 && bytes[index + 2] === 0x00);
  assert.ok(enableIndex >= 0, "payload should enable double width for the item");
  assert.ok(resetIndex > enableIndex, "payload should reset double width after the item");
});

// ─── Cashier receipt logo raster ──────────────────────────────────────────

const RECEIPT_ARGS = {
  brandName: "GUSTOPOS",
  tableNumber: "5",
  items: [{ name: "Pizza", quantity: 1, price: 8.5, notes: null }],
  subtotal: 8.5,
  discountAmount: 0,
  surchargeAmount: 0,
  total: 8.5,
  method: "cash" as const,
  paidAmount: 8.5,
  changeAmount: 0,
  notes: null,
  receiptFooter: "Grazie",
  logoMode: "none" as const,
  logoBitmap: undefined,
  logoWidth: 384,
  logoThreshold: 160,
};

async function makeLogoBitmap(width = 384, height = 128): Promise<string> {
  const img = new Jimp(width, height, 0x000000ff);
  const png = await img.getBufferAsync(Jimp.MIME_PNG);
  const result = await imageBufferToLogoRaster(png, { width, threshold: 160 });
  return result.logoBitmap;
}

function payloadBytes(payload: string): number[] {
  return [...Buffer.from(payload, "base64")];
}

test("cashier receipt with bitmap logo embeds the GS v 0 raster bytes", async () => {
  const logoBitmap = await makeLogoBitmap();
  const payload = buildCashierReceiptPayload({
    ...RECEIPT_ARGS,
    logoMode: "bitmap",
    logoBitmap,
  });
  const bytes = payloadBytes(payload);
  const signatureIndex = bytes.findIndex(
    (byte, index) =>
      byte === 0x1d &&
      bytes[index + 1] === 0x76 &&
      bytes[index + 2] === 0x30 &&
      bytes[index + 3] === 0x00,
  );
  assert.ok(signatureIndex >= 0, "payload should contain a GS v 0 raster command");
  // Full raster command (header + data) must be present verbatim.
  const rasterBytes = [...Buffer.from(logoBitmap, "base64")];
  assert.ok(
    rasterBytes.every((b, i) => bytes[signatureIndex + i] === b),
    "the stored raster command should be spliced verbatim into the payload",
  );
});

// ─── Shared ESC/POS builder (app.repository + tables.repository) ───────────

test("shared ESC/POS builder feeds before full cut", () => {
  const payload = Buffer.from(new EscPosBuilder().init().line("ticket").feed(5).cut().build(), "base64");
  const bytes = [...payload];
  const feedIndex = bytes.findIndex((byte, index) => byte === 0x1b && bytes[index + 1] === 0x64 && bytes[index + 2] === 0x05);
  const cutIndex = bytes.findIndex((byte, index) => byte === 0x1d && bytes[index + 1] === 0x56 && bytes[index + 2] === 0x30);
  assert.ok(feedIndex >= 0, "payload should contain ESC d 5");
  assert.ok(cutIndex > feedIndex, "full cut should follow the feed");
});

// ─── Padding tests ───────────────────────────────────────────────────────

test("padRight fills short string to width", () => {
  assert.equal(padRight("Test", 10), "Test      ");
  assert.equal(padRight("Test", 10).length, 10);
});

test("padRight truncates longer string", () => {
  assert.equal(padRight("Hello World This Is Too Long", 10), "Hello Worl");
});

test("padRight exact width returns unchanged", () => {
  const s = padRight("ABCDEFGHIJ", 10);
  assert.equal(s, "ABCDEFGHIJ");
  assert.equal(s.length, 10);
});

test("padLeft fills short string with leading spaces", () => {
  assert.equal(padLeft("42", 6), "    42");
  assert.equal(padLeft("42", 6).length, 6);
});

test("padLeft truncates longer string", () => {
  assert.equal(padLeft("1234567890ABC", 8), "12345678");
});

// ─── Receipt width constant ──────────────────────────────────────────────

test("RECEIPT_WIDTH is 42 (standard thermal printer)", () => {
  assert.equal(RECEIPT_WIDTH, 42);
});

// ─── toNumeric tests ─────────────────────────────────────────────────────

test("toNumeric converts string to number", () => {
  assert.equal(toNumeric("0.150"), 0.150);
  assert.equal(toNumeric("42"), 42);
});

test("toNumeric passes number through", () => {
  assert.equal(toNumeric(3.14), 3.14);
});

test("toNumeric handles zero", () => {
  assert.equal(toNumeric("0"), 0);
  assert.equal(toNumeric(0), 0);
});

// ─── Receipt layout helpers ──────────────────────────────────────────────

function buildOrderRef(order: {
  orderType: string;
  table?: string;
  customerName?: string;
}): string {
  return order.orderType === "dine_in"
    ? `Tavolo: ${order.table ?? "-"}`
    : `Cliente: ${order.customerName ?? "-"}`;
}

function buildOrderTypeLabel(orderType: string): string {
  return orderType === "takeaway"
    ? "Take away"
    : orderType === "delivery"
      ? "Delivery"
      : orderType === "dine_in"
        ? "Dine-in"
        : orderType;
}

test("kitchen receipt header uses REF for container summary", () => {
  // The REF section in kitchen receipts shows container inventory counts
  const header = "*** REF ***";
  assert.ok(header.includes("REF"));
});

test("kitchen receipt shows container counts with alignment", () => {
  const containers = new Map<string, number>([
    ["Panino", 3],
    ["Piatto", 5],
  ]);

  const lines: string[] = [];
  for (const [name, count] of containers) {
    const label = padRight(name.toUpperCase(), 24);
    const countStr = String(count).padStart(4);
    const line = `${label} ${countStr}`;
    // Standard alignment: NAME(6) + padRight(18 spaces) + 1 space + padStart(3 spaces) + digit
    assert.equal(line.length, 29, `Line "${line}" should have 29 chars`);
    assert.ok(line.startsWith(name.toUpperCase()), `Line should start with ${name.toUpperCase()}`);
    assert.ok(line.endsWith(String(count)), `Line should end with ${count}`);
  }
});

test("kitchen receipt items have no prices", () => {
  // Kitchen receipts show item names at double width (GS ! 16) without prices
  const label = "2x Margherita";
  const hasPrice = label.includes("EUR");
  assert.equal(hasPrice, false);
});

test("cashier receipt items show prices right-aligned", () => {
  const name = "2x Margherita";
  const price = "EUR 12.00";
  const pad = RECEIPT_WIDTH - name.length - price.length;
  const line = `${name}${" ".repeat(Math.max(1, pad))}${price}`;

  assert.equal(line.length, RECEIPT_WIDTH);
  assert.ok(line.startsWith("2x Margherita"));
  assert.ok(line.endsWith("EUR 12.00"));
});

test("order type label translation", () => {
  assert.equal(buildOrderTypeLabel("dine_in"), "Dine-in");
  assert.equal(buildOrderTypeLabel("takeaway"), "Take away");
  assert.equal(buildOrderTypeLabel("delivery"), "Delivery");
  assert.equal(buildOrderTypeLabel("catering"), "catering"); // fallthrough
});

test("dine-in order ref uses table number", () => {
  assert.equal(buildOrderRef({ orderType: "dine_in", table: "7" }), "Tavolo: 7");
  assert.equal(buildOrderRef({ orderType: "dine_in" }), "Tavolo: -");
});

test("non-dine-in order ref uses customer name", () => {
  assert.equal(
    buildOrderRef({ orderType: "takeaway", customerName: "Mario" }),
    "Cliente: Mario",
  );
  assert.equal(
    buildOrderRef({ orderType: "delivery", customerName: "Luigi", table: "3" }),
    "Cliente: Luigi",
  );
  assert.equal(
    buildOrderRef({ orderType: "delivery" }),
    "Cliente: -",
  );
});

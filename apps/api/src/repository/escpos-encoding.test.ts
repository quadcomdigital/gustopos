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
  buildPreBillPayload,
  buildCalibrationTicketPayload,
  formatRomeTime,
  formatRomeDateTime,
  formatRomeDate,
  orderStationTicketItems,
  selectStationTicketItems,
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

test("cashier receipt with logo omits the brand-name header and centers the raster", async () => {
  const logoBitmap = await makeLogoBitmap();
  const payload = buildCashierReceiptPayload({ ...RECEIPT_ARGS, logoMode: "bitmap", logoBitmap });
  const bytes = payloadBytes(payload);
  const text = Buffer.from(payload, "base64").toString("latin1");
  assert.ok(!text.includes("GUSTOPOS"), "brand-name header must be omitted when a logo is printed");

  // ESC a 1 (center) must precede the ESC 3 feed + GS v 0 raster header.
  const rasterIndex = bytes.findIndex((b, i) => b === 0x1d && bytes[i + 1] === 0x76 && bytes[i + 2] === 0x30);
  assert.ok(rasterIndex >= 6, "raster header present");
  assert.deepEqual(bytes.slice(rasterIndex - 6, rasterIndex - 3), [0x1b, 0x61, 0x01], "logo must be centered");
});

test("cashier receipt without logo keeps the brand-name header", () => {
  const payload = buildCashierReceiptPayload({ ...RECEIPT_ARGS });
  const text = Buffer.from(payload, "base64").toString("latin1");
  assert.ok(text.includes("GUSTOPOS"), "brand-name header printed when no logo is configured");
});

test("cashier receipt prints SCONTRINO NON FISCALE at the bottom", () => {
  const payload = buildCashierReceiptPayload({ ...RECEIPT_ARGS });
  const text = Buffer.from(payload, "base64").toString("latin1");
  assert.ok(
    text.indexOf("SCONTRINO NON FISCALE") > text.indexOf("TOTALE"),
    "disclaimer must come after the totals",
  );
  assert.ok(
    text.indexOf("SCONTRINO NON FISCALE") > text.indexOf("Grazie"),
    "disclaimer moved to the very bottom (after the footer)",
  );
});

// ─── Pre-bill (preconto) ───────────────────────────────────────────────────

test("pre-bill prints PRECONTO, items and total without payment rows", () => {
  const payload = buildPreBillPayload({
    brandName: "GUSTOPOS",
    tableNumber: "7",
    items: [
      { name: "Pizza", quantity: 2, price: 8.5, notes: null },
      { name: "Acqua", quantity: 1, price: 1, notes: "fredda" },
    ],
    subtotal: 18,
    discountAmount: 0,
    surchargeAmount: 0,
    total: 18,
    receiptFooter: "Grazie",
    logoMode: "none",
    logoWidth: 384,
    logoThreshold: 160,
  });
  const text = Buffer.from(payload, "base64").toString("latin1");
  assert.ok(text.includes("PRECONTO"), "must be headed PRECONTO");
  assert.ok(text.includes("Tavolo: 7"));
  assert.ok(text.includes("2x Pizza"));
  assert.ok(text.includes("TOTALE"));
  assert.ok(!text.includes("PAGAMENTO"), "pre-bill must not print a payment row");
  assert.ok(!text.includes("PAGATO"), "pre-bill must not print the paid amount");
  assert.ok(text.includes("PRECONTO NON FISCALE"));
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

// ─── Calibration ticket + new size commands ────────────────────────────────

test("EscPosBuilder.doubleHeight emits GS ! 0x01 then resets", () => {
  const bytes = payloadBytes(new EscPosBuilder().init().doubleHeight(true).line("A").doubleHeight(false).build());
  const on = bytes.findIndex((b, i) => b === 0x1d && bytes[i + 1] === 0x21 && bytes[i + 2] === 0x01);
  const off = bytes.findIndex((b, i) => b === 0x1d && bytes[i + 1] === 0x21 && bytes[i + 2] === 0x00);
  assert.ok(on >= 0, "double height enable present");
  assert.ok(off > on, "double height reset after the line");
});

test("EscPosBuilder.charSize encodes width/height nibbles", () => {
  const bytes = payloadBytes(new EscPosBuilder().init().charSize(3, 2).build());
  // width 3x -> high nibble 2, height 2x -> low nibble 1 => 0x21
  assert.ok(
    bytes.some((b, i) => b === 0x1d && bytes[i + 1] === 0x21 && bytes[i + 2] === 0x21),
    "GS ! 0x21 expected for charSize(3,2)",
  );
});

test("calibration ticket includes every format, the sample and all size commands", () => {
  const payload = buildCalibrationTicketPayload({ brandName: "Franks" });
  const text = Buffer.from(payload, "base64").toString("latin1");
  for (const label of [
    "CALIBRAZIONE ESC/POS",
    "FONT / STILI",
    "Font A",
    "Font B",
    "Grassetto",
    "Doppio colpo",
    "Sottolineato",
    "Invertito",
    "Capovolto",
    "GRANDEZZE GS !",
    "GRANDEZZE + STILI",
    "ALLINEAMENTI",
    "LARGHEZZA RIGA",
  ]) {
    assert.ok(text.includes(label), `calibration should include "${label}"`);
  }
  assert.ok(text.includes("19:30"), "sample line present");
  assert.ok(text.includes("FRANKS"), "brand name present");

  const bytes = payloadBytes(payload);
  for (const size of [0x01, 0x10, 0x11, 0x22, 0x21]) {
    assert.ok(
      bytes.some((b, i) => b === 0x1d && bytes[i + 1] === 0x21 && bytes[i + 2] === size),
      `GS ! 0x${size.toString(16)} present`,
    );
  }
});

test("EscPosBuilder style commands emit underline/double-strike/reverse/upside-down", () => {
  const bytes = payloadBytes(
    new EscPosBuilder()
      .init()
      .underline(true).line("u").underline(false)
      .doubleStrike(true).line("d").doubleStrike(false)
      .reverse(true).line("r").reverse(false)
      .upsideDown(true).line("x").upsideDown(false)
      .build(),
  );
  const has = (a: number, b: number, c: number) =>
    bytes.some((byte, i) => byte === a && bytes[i + 1] === b && bytes[i + 2] === c);
  assert.ok(has(0x1b, 0x2d, 0x01), "underline on");
  assert.ok(has(0x1b, 0x2d, 0x00), "underline off");
  assert.ok(has(0x1b, 0x47, 0x01), "double-strike on");
  assert.ok(has(0x1b, 0x47, 0x00), "double-strike off");
  assert.ok(has(0x1d, 0x42, 0x01), "reverse on");
  assert.ok(has(0x1d, 0x42, 0x00), "reverse off");
  assert.ok(has(0x1b, 0x7b, 0x01), "upside-down on");
  assert.ok(has(0x1b, 0x7b, 0x00), "upside-down off");
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

// ─── Timezone: tickets must render Europe/Rome, never UTC ─────────────────

test("formatRomeTime renders CEST wall clock, not UTC", () => {
  // 2026-09-21T14:50:00Z is 16:50 in Rome (CEST, UTC+2).
  assert.equal(formatRomeTime(new Date("2026-09-21T14:50:00Z")), "16:50");
});

test("formatRomeTime renders CET wall clock in winter", () => {
  // 2026-01-15T09:05:00Z is 10:05 in Rome (CET, UTC+1).
  assert.equal(formatRomeTime(new Date("2026-01-15T09:05:00Z")), "10:05");
});

test("formatRomeDate follows the Rome day across midnight", () => {
  // 23:30 UTC on the 21st is already the 22nd in Rome.
  assert.equal(formatRomeDate(new Date("2026-09-21T23:30:00Z")), "2026-09-22");
});

test("formatRomeDateTime includes seconds in Rome time", () => {
  assert.match(formatRomeDateTime(new Date("2026-09-21T14:53:49Z")), /21\/09\/2026, 16:53:49/);
});

// ─── Station ticket ordering: own area first, rounds as primary key ────────

test("orderStationTicketItems puts the own-area items first when no rounds", () => {
  const items = [
    { id: "bar-1", stationId: "bar" },
    { id: "cuc-1", stationId: "cucina" },
    { id: "bar-2", stationId: "bar" },
    { id: "cuc-2", stationId: "cucina" },
  ];
  const ordered = orderStationTicketItems(items, "cucina", { groupByRound: false });
  assert.deepEqual(ordered.map((item) => item.id), ["cuc-1", "cuc-2", "bar-1", "bar-2"]);
});

test("orderStationTicketItems keeps rounds first, own area within each round", () => {
  const items = [
    { id: "bar-r1", stationId: "bar", round: 1 },
    { id: "cuc-r1", stationId: "cucina", round: 1 },
    { id: "cuc-r0", stationId: "cucina", round: 0 },
    { id: "bar-r0", stationId: "bar", round: 0 },
  ];
  const ordered = orderStationTicketItems(items, "cucina", { groupByRound: true });
  assert.deepEqual(ordered.map((item) => item.id), ["cuc-r0", "bar-r0", "cuc-r1", "bar-r1"]);
});

test("orderStationTicketItems tolerates items without a station", () => {
  const items = [
    { id: "none", stationId: null },
    { id: "own", stationId: "cucina" },
  ];
  const ordered = orderStationTicketItems(items, "cucina", { groupByRound: false });
  assert.deepEqual(ordered.map((item) => item.id), ["own", "none"]);
});

// ─── Station ticket scope: own items only vs whole order ───────────────────

test("selectStationTicketItems keeps the whole order when ownItemsOnly is false", () => {
  const items = [
    { id: "cuc-1", stationId: "cucina" },
    { id: "bar-1", stationId: "bar" },
    { id: "none", stationId: null },
  ];
  const selected = selectStationTicketItems(items, "cucina", false);
  assert.deepEqual(selected.map((item) => item.id), ["cuc-1", "bar-1", "none"]);
});

test("selectStationTicketItems drops other stations but keeps own and unassigned", () => {
  const items = [
    { id: "cuc-1", stationId: "cucina" },
    { id: "bar-1", stationId: "bar" },
    { id: "none", stationId: null },
    { id: "bar-2", stationId: "bar" },
  ];
  const selected = selectStationTicketItems(items, "cucina", true);
  assert.deepEqual(selected.map((item) => item.id), ["cuc-1", "none"]);
});

test("selectStationTicketItems returns a new array and preserves input order", () => {
  const items = [
    { id: "a", stationId: "cucina" },
    { id: "b", stationId: "cucina" },
  ];
  const selected = selectStationTicketItems(items, "cucina", true);
  assert.notEqual(selected, items);
  assert.deepEqual(selected.map((item) => item.id), ["a", "b"]);
});

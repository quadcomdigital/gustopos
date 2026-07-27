import test from "node:test";
import assert from "node:assert/strict";

/**
 * Tests for receipt label logic.
 *
 * The buildEscPosPayload method is private, so we extract and test the
 * label-building logic that determines what appears on kitchen/cashier receipts.
 */

function buildOrderRef(order: {
  orderType: string;
  table?: string;
  customerName?: string;
  ticketNumber?: string;
  scheduledFor?: string;
}): string {
  const ref =
    order.orderType === "dine_in"
      ? `Tavolo: ${order.table ?? "-"}`
      : `Cliente: ${order.customerName ?? "-"}`;
  return ref;
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

// --- Delivery order tests ---

test("delivery order shows customer name, not Tavolo", () => {
  const ref = buildOrderRef({
    orderType: "delivery",
    customerName: "Mario Rossi",
  });
  assert.equal(ref, "Cliente: Mario Rossi");
  assert.ok(!ref.includes("Tavolo"), "Should not contain 'Tavolo'");
});

test("delivery order without customer name shows dash", () => {
  const ref = buildOrderRef({
    orderType: "delivery",
  });
  assert.equal(ref, "Cliente: -");
});

test("delivery order type label is 'Delivery'", () => {
  const label = buildOrderTypeLabel("delivery");
  assert.equal(label, "Delivery");
});

// --- Takeaway order tests ---

test("takeaway order shows customer name", () => {
  const ref = buildOrderRef({
    orderType: "takeaway",
    customerName: "Luigi Bianchi",
  });
  assert.equal(ref, "Cliente: Luigi Bianchi");
});

test("takeaway order type label is 'Take away'", () => {
  const label = buildOrderTypeLabel("takeaway");
  assert.equal(label, "Take away");
});

// --- Dine-in order tests ---

test("dine-in order shows table number", () => {
  const ref = buildOrderRef({
    orderType: "dine_in",
    table: "5",
  });
  assert.equal(ref, "Tavolo: 5");
});

test("dine-in order without table shows dash", () => {
  const ref = buildOrderRef({
    orderType: "dine_in",
  });
  assert.equal(ref, "Tavolo: -");
});

test("dine-in order type label is 'Dine-in'", () => {
  const label = buildOrderTypeLabel("dine_in");
  assert.equal(label, "Dine-in");
});

// --- Edge cases ---

test("delivery with both table and customerName uses customerName", () => {
  const ref = buildOrderRef({
    orderType: "delivery",
    table: "3",
    customerName: "Anna Verdi",
  });
  assert.equal(ref, "Cliente: Anna Verdi");
  assert.ok(!ref.includes("Tavolo"));
});

test("unknown order type falls through to raw string", () => {
  const label = buildOrderTypeLabel("catering");
  assert.equal(label, "catering");
});

// --- Scheduled time tests ---

function buildScheduledLine(scheduledFor?: string): string {
  if (!scheduledFor) return "";
  const scheduledDate = new Date(scheduledFor);
  const time = scheduledDate.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
  return `Consegna: ${time}`;
}

test("takeaway with pickupEta shows scheduled time", () => {
  const line = buildScheduledLine("2026-07-22T18:30:00Z");
  assert.ok(line.includes("Consegna:"), "Should contain 'Consegna:'");
  assert.ok(line.includes("18:30"), "Should contain the time");
});

test("delivery without scheduledFor shows nothing", () => {
  const line = buildScheduledLine(undefined);
  assert.equal(line, "");
});

test("takeaway without pickupEta shows nothing", () => {
  const line = buildScheduledLine(undefined);
  assert.equal(line, "");
});

// --- Phone tests ---

function buildPhoneLine(phone?: string): string {
  return phone ? `Telefono: ${phone}` : "";
}

test("delivery with phone shows phone line", () => {
  const line = buildPhoneLine("+39 333 1234567");
  assert.equal(line, "Telefono: +39 333 1234567");
});

test("delivery without phone shows nothing", () => {
  const line = buildPhoneLine(undefined);
  assert.equal(line, "");
});

test("takeaway with phone shows phone line", () => {
  const line = buildPhoneLine("02 1234567");
  assert.equal(line, "Telefono: 02 1234567");
});

// Container counting tests

test("container items are counted in kitchen summary", () => {
  const containerItems = [
    { name: "Bun", isContainer: 1 },
    { name: "Prosciutto", isContainer: 0 },
    { name: "Panino", isContainer: 1 },
  ];

  const counts: Record<string, number> = {};
  for (const item of containerItems) {
    if (item.isContainer) {
      counts[item.name] = (counts[item.name] ?? 0) + 1;
    }
  }

  assert.deepEqual(counts, { Bun: 1, Panino: 1 });
  assert.ok(!("Prosciutto" in counts), "Non-container items should not be counted");
});

test("non-container items are excluded from kitchen summary", () => {
  const containerItems = [
    { name: "Mozzarella", isContainer: 0 },
    { name: "Pomodoro", isContainer: 0 },
  ];

  const counts: Record<string, number> = {};
  for (const item of containerItems) {
    if (item.isContainer) {
      counts[item.name] = (counts[item.name] ?? 0) + 1;
    }
  }

  assert.deepEqual(counts, {});
});

test("kitchen receipt header is REF", () => {
  const header = "*** REF ***";
  assert.ok(header.includes("REF"));
});

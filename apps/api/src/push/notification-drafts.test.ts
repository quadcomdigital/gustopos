import test from "node:test";
import assert from "node:assert/strict";
import type { GroupOrderRealtimeSubmitted, Ingredient, Order, PrintBridge, PrintJob, Reservation } from "@gustopos/shared";
import {
  buildBridgeDraft,
  buildGroupOrderSubmittedDraft,
  buildLowStockDraft,
  buildOrderCreatedDraft,
  buildOrderStatusDraft,
  buildPrintJobDraft,
  buildReservationDraft,
  buildTakeawayStatusDraft,
  collectBelowThreshold,
  diffBelowThreshold,
  resolvePushUrl,
} from "./notification-drafts";

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: "ord_1",
    orderType: "dine_in",
    table: "12",
    ticketNumber: "007",
    items: [
      { id: "mi_1", name: "Piadina", price: 8, quantity: 2 },
      { id: "mi_2", name: "Cola", price: 3, quantity: 1 },
    ],
    total: 19,
    status: "pending",
    timestamp: new Date().toISOString(),
    staffId: "stf_1",
    ...overrides,
  };
}

function makeIngredient(overrides: Partial<Ingredient> = {}): Ingredient {
  return {
    id: "ing_1",
    name: "Farina",
    quantity: 1,
    unit: "kg",
    minThreshold: 5,
    unitCost: 0,
    salePrice: null,
    isActive: true,
    isStockTracked: true,
    ...overrides,
  };
}

test("new order draft names the table and counts the items", () => {
  const draft = buildOrderCreatedDraft(makeOrder());
  assert.match(draft.title, /Nuovo ordine · Tavolo 12/);
  assert.match(draft.body, /3 articoli/);
  assert.equal(draft.tag, "order-ord_1");
});

test("takeaway orders are labelled by ticket, not by table", () => {
  const draft = buildOrderCreatedDraft(makeOrder({ orderType: "takeaway", table: undefined }));
  assert.match(draft.title, /Asporto #007/);
});

test("staff order updates only interrupt on ready/cancelled", () => {
  for (const status of ["pending", "preparing", "served", "paid"] as const) {
    assert.equal(buildOrderStatusDraft(makeOrder({ status })), null, `status ${status} must stay silent`);
  }
  const ready = buildOrderStatusDraft(makeOrder({ status: "ready" }));
  assert.ok(ready);
  assert.match(ready.title, /Ordine pronto/);
  const cancelled = buildOrderStatusDraft(makeOrder({ status: "cancelled" }));
  assert.ok(cancelled);
  assert.match(cancelled.title, /Ordine annullato/);
});

function makeReservation(overrides: Partial<Reservation> = {}): Reservation {
  return {
    id: "res_1",
    customerName: "Mario Rossi",
    partySize: 4,
    reservedFor: new Date().toISOString(),
    status: "pending",
    source: "online",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

test("only a brand-new reservation notifies", () => {
  assert.equal(buildReservationDraft(makeReservation({ status: "confirmed" })), null);
  assert.equal(buildReservationDraft(makeReservation({ status: "seated" })), null);
  const draft = buildReservationDraft(makeReservation());
  assert.ok(draft);
  assert.match(draft.body, /Mario Rossi · 4 pax/);
});

function makePrintJob(overrides: Partial<PrintJob> = {}): PrintJob {
  return {
    id: "job_1",
    orderId: "ord_1",
    area: "cucina",
    protocol: "escpos",
    status: "dispatched",
    payload: "{}",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

test("only a failed print job notifies", () => {
  assert.equal(buildPrintJobDraft(makePrintJob()), null);
  assert.equal(buildPrintJobDraft(makePrintJob({ status: "completed" })), null);
  const draft = buildPrintJobDraft(makePrintJob({ status: "failed", error: "printer offline" }));
  assert.ok(draft);
  assert.match(draft.title, /Stampa non riuscita/);
  assert.match(draft.body, /cucina/);
  assert.match(draft.body, /printer offline/);
});

function makeBridge(overrides: Partial<PrintBridge> = {}): PrintBridge {
  return {
    id: "br_1",
    tenantId: "tenant_test",
    name: "Cucina PC",
    status: "active",
    areas: [],
    printers: [],
    mappings: [],
    claimedAreas: [],
    ...overrides,
  };
}

test("an active bridge stays silent, a lost one does not", () => {
  assert.equal(buildBridgeDraft(makeBridge()), null);
  const offline = buildBridgeDraft(makeBridge({ status: "offline" }));
  assert.ok(offline);
  assert.match(offline.title, /offline/);
  const removed = buildBridgeDraft(makeBridge(), true);
  assert.ok(removed);
  assert.match(removed.title, /rimosso/);
});

test("takeaway consumers only hear the meaningful statuses", () => {
  for (const status of ["pending", "served", "paid"] as const) {
    assert.equal(buildTakeawayStatusDraft(makeOrder({ status })), null, `status ${status} must stay silent`);
  }
  const ready = buildTakeawayStatusDraft(makeOrder({ orderType: "takeaway", status: "ready" }));
  assert.ok(ready);
  assert.match(ready.title, /pronto al ritiro/);
  assert.equal(ready.tag, "takeaway-ord_1");
});

test("group order submission links back to the group order page", () => {
  const payload: GroupOrderRealtimeSubmitted = {
    session: {
      id: "gos_1",
      tenantId: "tenant_test",
      tenantSlug: "franks",
      joinCode: "ABCD",
      status: "submitted",
      version: 3,
      masterParticipantId: "gop_1",
      expiresAt: new Date().toISOString(),
      participants: [],
      items: [],
      total: 25,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    order: makeOrder({ orderType: "takeaway", total: 25 }),
  };
  const draft = buildGroupOrderSubmittedDraft(payload);
  assert.equal(draft.url, "/franks/group-order/ABCD");
  assert.match(draft.title, /Ordine di gruppo inviato/);
});

// ─── Low stock ─────────────────────────────────────────────────────────────

test("the first inventory snapshot seeds the baseline without notifying", () => {
  const items = [makeIngredient({ quantity: 0 })];
  const first = diffBelowThreshold(null, items);
  assert.deepEqual(first.newlyBelow, []);
  assert.equal(first.next.size, 1);
});

test("an ingredient crossing the threshold notifies exactly once", () => {
  const healthy = makeIngredient({ id: "ing_a", quantity: 10, minThreshold: 5 });
  const seeded = diffBelowThreshold(null, [healthy]);
  assert.deepEqual(seeded.newlyBelow, []);

  // Still healthy: no notification.
  const stillHealthy = diffBelowThreshold(seeded.next, [healthy]);
  assert.deepEqual(stillHealthy.newlyBelow, []);

  // Crosses the line: one notification.
  const crossed = diffBelowThreshold(stillHealthy.next, [{ ...healthy, quantity: 4 }]);
  assert.equal(crossed.newlyBelow.length, 1);
  assert.equal(crossed.newlyBelow[0].id, "ing_a");

  // Stays below: no repeat.
  const stillBelow = diffBelowThreshold(crossed.next, [{ ...healthy, quantity: 3 }]);
  assert.deepEqual(stillBelow.newlyBelow, []);
});

test("untracked ingredients never trigger a low-stock alert", () => {
  const untracked = makeIngredient({ quantity: 0, isStockTracked: false });
  assert.equal(collectBelowThreshold([untracked]).size, 0);
  assert.equal(buildLowStockDraft(diffBelowThreshold(null, [untracked]).newlyBelow), null);
});

test("the low-stock draft lists at most three names", () => {
  const items = ["A", "B", "C", "D"].map((name, index) => makeIngredient({ id: `ing_${index}`, name }));
  const draft = buildLowStockDraft(items);
  assert.ok(draft);
  assert.equal(draft.title, "Scorte basse");
  assert.match(draft.body, /A, B, C e altri 1/);
});

// ─── Deep links ────────────────────────────────────────────────────────────

test("staff links are prefixed with the tenant slug when known", () => {
  assert.equal(resolvePushUrl("staff", "franks", "/app"), "/franks/app");
  assert.equal(resolvePushUrl("staff", undefined, "/app"), "/app");
  assert.equal(resolvePushUrl("consumer", "franks", "/takeaway/track"), "/franks/takeaway/track");
});

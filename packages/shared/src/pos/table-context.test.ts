import assert from "node:assert/strict";
import test from "node:test";
import {
  cartContextKeyFor,
  groupOpenConti,
  isPosPresenceEligible,
  nextPosContext,
  resolveCheckoutTarget,
  resolveEffectivePosMode,
  shouldRetireVirtualTable,
  type OpenContoOrderLike,
  type PosContextState,
  type PosTableLike,
} from "./table-context";

const tables: PosTableLike[] = [
  { id: "tbl_d1", number: "D1", status: "free" },
  { id: "tbl_f1", number: "F1", status: "occupied" },
  { id: "tbl_v_ta", number: "TA-20261122-1212", status: "occupied", isVirtual: true },
];

function baseState(patch: Partial<PosContextState> = {}): PosContextState {
  return {
    mode: "dine_in",
    tableId: "tbl_d1",
    tableNumber: "D1",
    lastDineInTableId: "tbl_d1",
    lastDineInTableNumber: "D1",
    pinnedOrderId: null,
    ...patch,
  };
}

// ─── cartContextKeyFor ─────────────────────────────────────────────────────

test("cart key: sala senza conto usa l'id stabile del tavolo", () => {
  assert.equal(cartContextKeyFor({ mode: "dine_in", tableId: "tbl_d1" }), "dine_in:tbl_d1");
});

test("cart key: sala senza tavolo è la modalità nuda", () => {
  assert.equal(cartContextKeyFor({ mode: "dine_in" }), "dine_in");
});

test("cart key: asporto senza conto non condivide il carrello con la sala", () => {
  assert.equal(cartContextKeyFor({ mode: "takeaway", tableId: "tbl_d1" }), "takeaway");
});

test("cart key: con conto agganciato vince il numero del conto (ticket virtuale)", () => {
  assert.equal(
    cartContextKeyFor({ mode: "takeaway", tableId: "", pinnedTable: "TA-20261122-1212" }),
    "takeaway:TA-20261122-1212",
  );
});

test("cart key: conto in sala è keyed sul numero tavolo anche se l'id è presente", () => {
  assert.equal(
    cartContextKeyFor({ mode: "dine_in", tableId: "tbl_f1", pinnedTable: "F1" }),
    "dine_in:F1",
  );
});

test("cart key: stringhe vuote/blank non producono chiavi spurie", () => {
  assert.equal(cartContextKeyFor({ mode: "dine_in", tableId: "", pinnedTable: "  " }), "dine_in");
});

// ─── resolveEffectivePosMode ───────────────────────────────────────────────

test("mode effettiva: il conto agganciato vince sulla preferenza", () => {
  assert.equal(resolveEffectivePosMode({ orderType: "takeaway" }, "dine_in"), "takeaway");
});

test("mode effettiva: senza conto resta la preferenza", () => {
  assert.equal(resolveEffectivePosMode(null, "delivery"), "delivery");
});

// ─── nextPosContext: selectTable ───────────────────────────────────────────

test("selectTable: un tavolo reale aggiorna selezione e memoria di sala", () => {
  const patch = nextPosContext({
    state: baseState(),
    action: { type: "selectTable", tableId: "tbl_f1", tableNumber: "F1" },
    tables,
  });
  assert.deepEqual(patch, { tableId: "tbl_f1", tableNumber: "F1", lastDineInTableId: "tbl_f1", lastDineInTableNumber: "F1" });
});

test("selectTable: un tavolo virtuale non sporca la memoria di sala", () => {
  const patch = nextPosContext({
    state: baseState(),
    action: { type: "selectTable", tableId: "tbl_v_ta", tableNumber: "TA-20261122-1212", virtual: true },
    tables,
  });
  assert.equal(patch.tableId, "tbl_v_ta");
  assert.equal(patch.lastDineInTableId, undefined);
});

test("selectTable: svuotare la selezione conserva la memoria di sala", () => {
  const patch = nextPosContext({
    state: baseState({ tableId: "tbl_v_ta", tableNumber: "TA-20261122-1212" }),
    action: { type: "selectTable", tableId: "", tableNumber: "" },
    tables,
  });
  assert.equal(patch.tableId, "");
  assert.equal(patch.tableNumber, "");
  assert.equal(patch.lastDineInTableId, undefined);
});

test("selectTable: non tocca modalità né conto agganciato", () => {
  const patch = nextPosContext({
    state: baseState({ mode: "takeaway", pinnedOrderId: "ord_1" }),
    action: { type: "selectTable", tableId: "tbl_f1", tableNumber: "F1" },
    tables,
  });
  assert.equal(patch.mode, undefined);
  assert.equal(patch.pinnedOrderId, undefined);
});

// ─── nextPosContext: pinOrder ──────────────────────────────────────────────

test("pinOrder: aggancia un asporto e segue il suo tavolo virtuale", () => {
  const patch = nextPosContext({
    state: baseState(),
    action: {
      type: "pinOrder",
      order: { id: "ord_ta", orderType: "takeaway", table: "TA-20261122-1212" },
    },
    tables,
  });
  assert.equal(patch.pinnedOrderId, "ord_ta");
  assert.equal(patch.mode, "takeaway");
  assert.equal(patch.tableId, "tbl_v_ta");
  assert.equal(patch.tableNumber, "TA-20261122-1212");
  assert.equal(patch.lastDineInTableId, undefined, "il conto virtuale non è memoria di sala");
});

test("pinOrder: un conto in sala aggiorna anche la memoria di sala", () => {
  const patch = nextPosContext({
    state: baseState(),
    action: { type: "pinOrder", order: { id: "ord_f1", orderType: "dine_in", table: "F1" } },
    tables,
  });
  assert.equal(patch.lastDineInTableId, "tbl_f1");
});

test("pinOrder: null slega soltanto (modalità e tavolo restano)", () => {
  const patch = nextPosContext({
    state: baseState({ mode: "takeaway", pinnedOrderId: "ord_ta" }),
    action: { type: "pinOrder", order: null },
    tables,
  });
  assert.deepEqual(patch, { pinnedOrderId: null });
});

test("pinOrder: un tavolo non (più) presente non inventa un id", () => {
  const patch = nextPosContext({
    state: baseState(),
    action: { type: "pinOrder", order: { id: "ord_x", orderType: "takeaway", table: "GONE" } },
    tables,
  });
  assert.equal(patch.tableId, "");
  assert.equal(patch.tableNumber, "GONE");
  assert.equal(patch.lastDineInTableId, undefined);
});

// ─── nextPosContext: switchMode ────────────────────────────────────────────

test("switchMode: uscendo dalla sala si slega il conto e si azzera la selezione", () => {
  const patch = nextPosContext({
    state: baseState({ pinnedOrderId: "ord_ta" }),
    action: { type: "switchMode", mode: "takeaway" },
    tables,
  });
  assert.deepEqual(patch, { pinnedOrderId: null, mode: "takeaway", tableId: "", tableNumber: "" });
});

test("switchMode: rientro in sala sull'ultimo tavolo reale", () => {
  const patch = nextPosContext({
    state: baseState({
      mode: "takeaway",
      tableId: "tbl_v_ta",
      tableNumber: "TA-20261122-1212",
      lastDineInTableId: "tbl_f1",
      lastDineInTableNumber: "F1",
      pinnedOrderId: "ord_ta",
    }),
    action: { type: "switchMode", mode: "dine_in" },
    tables,
  });
  assert.deepEqual(patch, {
    pinnedOrderId: null,
    mode: "dine_in",
    tableId: "tbl_f1",
    tableNumber: "F1",
  });
});

test("switchMode: rientro in sala senza ultimo tavolo valido non autopicka", () => {
  const patch = nextPosContext({
    state: baseState({
      mode: "takeaway",
      tableId: "",
      tableNumber: "",
      lastDineInTableId: "tbl_deleted",
      lastDineInTableNumber: "A9",
    }),
    action: { type: "switchMode", mode: "dine_in" },
    tables,
  });
  assert.equal(patch.tableId, "");
  assert.equal(patch.tableNumber, "");
});

test("switchMode: target esplicito (table picker) vince sulla memoria di sala", () => {
  const patch = nextPosContext({
    state: baseState({ mode: "takeaway", tableId: "", tableNumber: "", pinnedOrderId: "ord_ta" }),
    action: { type: "switchMode", mode: "dine_in", tableId: "tbl_f1", tableNumber: "F1" },
    tables,
  });
  assert.equal(patch.mode, "dine_in");
  assert.equal(patch.tableId, "tbl_f1");
  assert.equal(patch.lastDineInTableId, "tbl_f1");
  assert.equal(patch.pinnedOrderId, null);
});

test("switchMode: un target virtuale non diventa memoria di sala", () => {
  const patch = nextPosContext({
    state: baseState(),
    action: { type: "switchMode", mode: "takeaway", tableId: "tbl_v_ta", tableNumber: "TA-20261122-1212" },
    tables,
  });
  assert.equal(patch.tableId, "tbl_v_ta");
  assert.equal(patch.lastDineInTableId, undefined);
});

// ─── presenza / cassa / retirement ─────────────────────────────────────────

test("presenza: solo sala su un tavolo reale", () => {
  assert.equal(isPosPresenceEligible("dine_in", tables[0]!), true);
  assert.equal(isPosPresenceEligible("dine_in", tables[2]!), false);
  assert.equal(isPosPresenceEligible("takeaway", tables[0]!), false);
  assert.equal(isPosPresenceEligible("dine_in", null), false);
});

test("cassa: il tavolo del conto agganciato vince sulla selezione residua", () => {
  assert.equal(resolveCheckoutTarget(tables[2]!, tables[1]!), tables[2]);
  assert.equal(resolveCheckoutTarget(null, tables[1]!), tables[1]);
  assert.equal(resolveCheckoutTarget(null, null), null);
});

test("retirement: virtuale senza ordini aperti sì, con ordini aperti no, fisico mai", () => {
  assert.equal(shouldRetireVirtualTable({ isVirtual: true }, false), true);
  assert.equal(shouldRetireVirtualTable({ isVirtual: true }, true), false);
  assert.equal(shouldRetireVirtualTable({ isVirtual: false }, false), false);
  assert.equal(shouldRetireVirtualTable({}, false), false);
});

// ─── groupOpenConti ────────────────────────────────────────────────────────

function order(patch: Partial<OpenContoOrderLike> & Pick<OpenContoOrderLike, "id">): OpenContoOrderLike {
  return {
    orderType: "takeaway",
    status: "pending",
    total: 10,
    timestamp: "2026-11-22T18:00:00.000Z",
    table: "TA-1",
    items: [{ quantity: 1 }],
    ...patch,
  };
}

test("conti: più invii sullo stesso conto diventano una card sola", () => {
  const { takeaway } = groupOpenConti([
    order({ id: "o1", total: 7, timestamp: "2026-11-22T18:00:00.000Z", items: [{ quantity: 2 }] }),
    order({ id: "o2", total: 5, timestamp: "2026-11-22T18:10:00.000Z", items: [{ quantity: 1 }] }),
  ]);
  assert.equal(takeaway.length, 1);
  assert.equal(takeaway[0]!.total, 12);
  assert.equal(takeaway[0]!.itemCount, 3);
  assert.equal(takeaway[0]!.orderId, "o1", "l'ordine più vecchio rappresenta il conto");
  assert.equal(takeaway[0]!.timestamp, "2026-11-22T18:00:00.000Z");
});

test("conti: lo stato mostrato è il meno avanzato del gruppo", () => {
  const { takeaway } = groupOpenConti([
    order({ id: "o1", status: "served" }),
    order({ id: "o2", status: "preparing" }),
  ]);
  assert.equal(takeaway[0]!.status, "preparing");
});

test("conti: ordini pagati/annullati e la sala sono esclusi", () => {
  const grouped = groupOpenConti([
    order({ id: "o1", status: "paid" }),
    order({ id: "o2", status: "cancelled" }),
    order({ id: "o3", orderType: "dine_in", table: "D1" }),
    order({ id: "o4", table: "TA-2" }),
  ]);
  assert.equal(grouped.takeaway.length, 1);
  assert.equal(grouped.takeaway[0]!.orderId, "o4");
  assert.equal(grouped.delivery.length, 0);
});

test("conti: asporti e consegne separati, ordinati per lavoro residuo", () => {
  const grouped = groupOpenConti([
    order({ id: "t-served", table: "TA-A", status: "served", timestamp: "2026-11-22T17:00:00.000Z" }),
    order({ id: "t-pending", table: "TA-B", status: "pending", timestamp: "2026-11-22T19:00:00.000Z" }),
    order({ id: "d-ready", table: "DL-A", orderType: "delivery", status: "ready" }),
  ]);
  assert.deepEqual(grouped.takeaway.map((c) => c.orderId), ["t-pending", "t-served"]);
  assert.deepEqual(grouped.delivery.map((c) => c.orderId), ["d-ready"]);
});

test("conti: senza numero tavolo il gruppo usa l'id ordine (non collassa tutto)", () => {
  const { takeaway } = groupOpenConti([
    order({ id: "o1", table: null }),
    order({ id: "o2", table: null }),
  ]);
  assert.equal(takeaway.length, 2);
  assert.deepEqual(takeaway.map((c) => c.key).sort(), ["o1", "o2"]);
});

test("conti: etichetta = cliente, poi ticket, poi tipo", () => {
  const { takeaway } = groupOpenConti([
    order({ id: "o1", table: "TA-1", ticketNumber: "TA-20261122-1111" }),
    order({ id: "o2", table: "TA-2", ticketNumber: "TA-20261122-2222", customerName: "Mario" }),
  ]);
  assert.equal(takeaway.find((c) => c.orderId === "o1")!.label, "TA-20261122-1111");
  assert.equal(takeaway.find((c) => c.orderId === "o2")!.label, "Mario");
  assert.equal(groupOpenConti([order({ id: "o3", table: "TA-3" })]).takeaway[0]!.label, "Asporto");
  assert.equal(
    groupOpenConti([order({ id: "o4", table: "DL-4", orderType: "delivery" })]).delivery[0]!.label,
    "Consegna",
  );
});

test("conti: un conto più vecchio che arriva dopo aggiorna ordine ed etichetta", () => {
  const { takeaway } = groupOpenConti([
    order({ id: "new", table: "TA-1", timestamp: "2026-11-22T18:30:00.000Z" }),
    order({ id: "old", table: "TA-1", timestamp: "2026-11-22T18:00:00.000Z", customerName: "Luca" }),
  ]);
  assert.equal(takeaway[0]!.orderId, "old");
  assert.equal(takeaway[0]!.label, "Luca");
});

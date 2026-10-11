import "../test-support/setup-env";
import test from "node:test";
import assert from "node:assert/strict";
import { AppRepository } from "./app.repository";
import type { Order, PrintStation, UiSettings } from "@gustopos/shared";

/**
 * Header of the real station ticket (`AppRepository.buildStationTicketPayload`,
 * private — called through a cast, which is what the test exercises: the bytes
 * that reach the printer).
 *
 * Two casale overrides live here:
 *   - `stationHideComandaLine` → production comanda drops `Comanda: <numero>`
 *   - `stationTable2x1`        → the table number runs at GS 2x1
 * plus the CP437 fold of `1ª portata` in the round header.
 */

const settings = {
  brandName: "Antico Casale",
  taxRate: 0.1,
  theme: {},
  printing: {
    protocol: "escpos",
    activeStationIds: [],
    autoPrintKitchen: true,
    autoPrintOnClose: false,
    logoMode: "none",
    logoWidth: 384,
    logoThreshold: 160,
    receiptFooter: "",
  },
} as unknown as UiSettings;

const order = {
  id: "ord_abcdef0123456789",
  orderType: "dine_in",
  table: "SALA OROLOGIO 7",
  timestamp: Date.now(),
  total: 16,
  items: [],
} as unknown as Order;

const items = [
  {
    name: "BUSIATA CON PESTO",
    ticketName: null,
    quantity: 1,
    price: 14,
    notes: "senza glutine",
    modifiers: [],
    modifierOptionIds: [],
    overrides: [],
    stationId: "st_cucina",
    round: 0,
  },
];

type TicketParams = {
  order: Order;
  waiterName: string | null;
  station: PrintStation;
  items: typeof items;
  summary: Array<{ name: string; count: number }>;
  totalItems: number;
  settings: UiSettings;
  priceDeltaByOptionId: Map<string, number>;
  roundLabels?: string[];
  notes2x1: boolean;
  hideComandaLine: boolean;
  table2x1: boolean;
};

function buildTicket(overrides: Partial<TicketParams>, station?: Partial<PrintStation>): string {
  // `buildStationTicketPayload` is private and the class is Nest-injected with
  // 11 repositories (an empty constructor body, none used by this pure path):
  // construct it with no arguments and drive only the method under test.
  const Repository = AppRepository as unknown as new () => {
    buildStationTicketPayload: (params: TicketParams) => string;
  };
  const repository = new Repository();
  return repository.buildStationTicketPayload({
    order,
    waiterName: "Cameriere",
    station: { id: "st_cucina", name: "CUCINA", kind: "production" } as unknown as PrintStation,
    items,
    summary: [{ name: "PASTA", count: 1 }],
    totalItems: 1,
    settings,
    priceDeltaByOptionId: new Map(),
    roundLabels: ["1ª portata"],
    notes2x1: false,
    hideComandaLine: false,
    table2x1: false,
    ...overrides,
    ...(station ? { station: { id: "st_cucina", name: "CUCINA", kind: "production", ...station } as PrintStation } : {}),
  });
}

function text(payload: string): string {
  return Buffer.from(payload, "base64").toString("latin1");
}

test("production comanda drops the Comanda line when stationHideComandaLine is on", () => {
  const hidden = text(buildTicket({ hideComandaLine: true }));
  const shown = text(buildTicket({}));
  assert.ok(!hidden.includes("Comanda:"), "production ticket hides the comanda number");
  assert.ok(shown.includes("Comanda: ord_abcd"), "base behaviour keeps it");
  // The rest of the header is untouched.
  assert.ok(hidden.includes("Ordine: ord_abc"));
  assert.ok(hidden.includes("Orario:"));
  assert.ok(hidden.includes("Cameriere: Cameriere"));
});

test("the cashier station keeps the Comanda line even with the override on", () => {
  const cashier = text(
    buildTicket({ hideComandaLine: true, table2x1: false }, { id: "st_cassa", name: "CASSA", kind: "cashier" }),
  );
  assert.ok(cashier.includes("Comanda:"), "the cashier copy is the order's reference");
});

test("stationTable2x1 prints the table number at GS 2x1 on the same line", () => {
  const payload = buildTicket({ table2x1: true });
  const decoded = text(payload);
  const bytes = payloadBytes(payload);

  const valueIndex = decoded.indexOf("SALA OROLOGIO 7");
  assert.ok(valueIndex > 0, "table value present");
  // GS 2x1 immediately before the value, reset immediately after it.
  assert.deepEqual([...bytes.slice(valueIndex - 3, valueIndex)], [0x1d, 0x21, 0x10], "GS 2x1 before the table number");
  assert.deepEqual(
    [...bytes.slice(valueIndex + "SALA OROLOGIO 7".length, valueIndex + "SALA OROLOGIO 7".length + 3)],
    [0x1d, 0x21, 0x00],
    "size reset after the table number",
  );
  // Label stays Font A and label + value share one physical line: the only
  // bytes between them are the GS 2x1 switch (2x1 doubles the width but keeps
  // the height, so the header never grows a row).
  const labelIndex = decoded.indexOf("Tavolo: ");
  assert.ok(labelIndex >= 0 && labelIndex < valueIndex, "label precedes the value");
  const between = bytes.slice(labelIndex + "Tavolo: ".length, valueIndex);
  assert.ok(!between.includes(0x0a), "label and value share a single physical line");
  assert.deepEqual([...between], [0x1d, 0x21, 0x10], "Font A → GS 2x1 switch between them");
  assert.ok(decoded.slice(valueIndex).includes("Orario:"), "header continues after the table line");

  // Without the override the value stays at 1x1.
  const plain = buildTicket({});
  const plainBytes = payloadBytes(plain);
  const plainIndex = text(plain).indexOf("SALA OROLOGIO 7");
  assert.notDeepEqual([...plainBytes.slice(plainIndex - 3, plainIndex)], [0x1d, 0x21, 0x10]);
});

test("takeaway orders keep the Cliente line untouched by stationTable2x1", () => {
  const payload = buildTicket({
    table2x1: true,
    order: { ...order, orderType: "takeaway", customerName: "Mario" } as unknown as Order,
  });
  const decoded = text(payload);
  assert.ok(decoded.includes("Cliente: Mario"), "takeaway shows the customer");
  const bytes = payloadBytes(payload);
  const index = decoded.indexOf("Mario");
  assert.notDeepEqual([...bytes.slice(index - 3, index)], [0x1d, 0x21, 0x10], "no 2x1 on the customer line");
});

test("the round header folds ª so it reads on paper", () => {
  const decoded = text(buildTicket({}));
  assert.ok(decoded.includes("--- 1a portata ---"), "1ª portata must print as 1a portata");
  assert.ok(!decoded.includes("\u00AA"), "no raw ª reaches the printer");
});

function payloadBytes(payload: string): number[] {
  return [...Buffer.from(payload, "base64")];
}

import test from "node:test";
import assert from "node:assert/strict";
import {
  ghostOrderCommitRequestSchema,
  ghostOrderCreateRequestSchema,
  ghostOrderItemSchema,
  ghostOrderPatchRequestSchema,
  ghostOrderRemovedPayloadSchema,
  ghostOrderSchema,
  hasTenantOverride,
} from "@gustopos/shared";

const cartLine = {
  cartItemId: "ci_1",
  menuItemId: "m_1",
  name: "AGOSTO BURGER",
  basePrice: 7,
  quantity: 2,
  notes: "",
  ingredientOverrides: [],
  selectedModifiers: [],
  modifierPriceDelta: 0,
};

test("ghost items reuse the POS cart shape and default optional collections", () => {
  const parsed = ghostOrderItemSchema.parse({
    cartItemId: "ci_1",
    menuItemId: "m_1",
    name: "AGOSTO BURGER",
    basePrice: 7,
    quantity: 2,
  });
  assert.equal(parsed.notes, "");
  assert.deepEqual(parsed.ingredientOverrides, []);
  assert.deepEqual(parsed.selectedModifiers, []);
  assert.equal(parsed.modifierPriceDelta, 0);
});

test("ghost create requires a table and at least one line", () => {
  assert.throws(() => ghostOrderCreateRequestSchema.parse({ tableId: "tbl_1", items: [] }));
  const parsed = ghostOrderCreateRequestSchema.parse({ tableId: "tbl_1", items: [cartLine] });
  assert.equal(parsed.items.length, 1);
});

test("ghost patch is a full snapshot with an optimistic version", () => {
  assert.throws(() => ghostOrderPatchRequestSchema.parse({ expectedVersion: -1, items: [] }));
  const parsed = ghostOrderPatchRequestSchema.parse({ expectedVersion: 3, items: [cartLine] });
  assert.equal(parsed.expectedVersion, 3);
  assert.equal(parsed.items[0]?.menuItemId, "m_1");
});

test("ghost commit can carry the owner's final cart snapshot and a no-print flag", () => {
  const parsed = ghostOrderCommitRequestSchema.parse({
    expectedVersion: 4,
    expectedTotal: 14,
    items: [cartLine],
    print: false,
  });
  assert.equal(parsed.print, false);
  assert.equal(parsed.items?.[0]?.quantity, 2);
});

test("ghost removal payload only accepts known reasons", () => {
  assert.doesNotThrow(() => ghostOrderRemovedPayloadSchema.parse({ id: "gho_1", reason: "committed" }));
  assert.throws(() => ghostOrderRemovedPayloadSchema.parse({ id: "gho_1", reason: "something_else" }));
});

test("ghost order schema round-trips the server snapshot", () => {
  const ghost = ghostOrderSchema.parse({
    id: "gho_1",
    contextKey: "dine_in:tbl_1",
    ownerStaffId: "s_1",
    ownerStaffName: "Mario",
    orderType: "dine_in",
    tableId: "tbl_1",
    tableNumber: "5",
    status: "open",
    version: 2,
    items: [cartLine],
    total: 14,
    itemCount: 2,
    createdAt: "2026-10-24T10:00:00.000Z",
    updatedAt: "2026-10-24T10:01:00.000Z",
  });
  assert.equal(ghost.total, 14);
  assert.equal(ghost.items[0]?.name, "AGOSTO BURGER");
});

test("ghost orders are a per-tenant capability, off by default", () => {
  assert.equal(hasTenantOverride("ghostOrders", "casale"), true);
  assert.equal(hasTenantOverride("ghostOrders", "franks"), true);
  assert.equal(hasTenantOverride("ghostOrders", "unknown-tenant"), false);
});

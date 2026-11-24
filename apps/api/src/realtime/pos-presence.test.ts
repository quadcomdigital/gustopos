import test from "node:test";
import assert from "node:assert/strict";
import {
  parseSocketEventPayload,
  posClaimTableRequestSchema,
  posPresenceEntrySchema,
  socketEvents,
} from "@gustopos/shared";

const entry = {
  tableId: "tbl_1",
  tableNumber: "D1",
  staffId: "stf_1",
  staffName: "Maria",
  orderId: null,
  orderType: "dine_in" as const,
  updatedAt: new Date().toISOString(),
};

test("pos claim accepts a table binding and its release (null)", () => {
  assert.equal(posClaimTableRequestSchema.safeParse({ tableId: "tbl_1", tableNumber: "D1" }).success, true);
  assert.equal(posClaimTableRequestSchema.safeParse(null).success, true);
  // Un claim senza tavolo non ha senso: non deve mai arrivare al gateway.
  assert.equal(posClaimTableRequestSchema.safeParse({ tableNumber: "D1" }).success, false);
  assert.equal(posClaimTableRequestSchema.safeParse({ tableId: "tbl_1" }).success, false);
});

test("pos presence payload is a validated list", () => {
  assert.equal(posPresenceEntrySchema.safeParse(entry).success, true);
  // staffName è ciò che la mappa mostra: se manca, il payload è scartato.
  assert.equal(posPresenceEntrySchema.safeParse({ ...entry, staffName: "" }).success, false);

  const parsed = parseSocketEventPayload(socketEvents.posPresence, [entry]);
  assert.deepEqual(parsed, [entry]);
  assert.equal(parseSocketEventPayload(socketEvents.posPresence, [{ tableId: "tbl_1" }]), null);
});

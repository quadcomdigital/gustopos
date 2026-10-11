import test from "node:test";
import assert from "node:assert/strict";
import { normalizeTicketName, resolveStationItemName } from "./ticket-names";

test("normalizeTicketName trims and collapses blanks to null", () => {
  assert.equal(normalizeTicketName("  P.DI MARE  "), "P.DI MARE");
  assert.equal(normalizeTicketName(""), null);
  assert.equal(normalizeTicketName("   "), null);
  assert.equal(normalizeTicketName(undefined), null);
  assert.equal(normalizeTicketName(null), null);
});

test("production comanda prints the internal name", () => {
  const item = { name: "MEDITERRENEA DEL CASALE", ticketName: "MEDITERR" };
  assert.equal(resolveStationItemName(item, "production"), "MEDITERR");
});

test("cashier station ticket keeps the real name", () => {
  const item = { name: "MEDITERRENEA DEL CASALE", ticketName: "MEDITERR" };
  assert.equal(resolveStationItemName(item, "cashier"), "MEDITERRENEA DEL CASALE");
});

test("blank or missing internal name falls back to the real name", () => {
  assert.equal(resolveStationItemName({ name: "ORO DI MARE", ticketName: null }, "production"), "ORO DI MARE");
  assert.equal(resolveStationItemName({ name: "ORO DI MARE", ticketName: undefined }, "production"), "ORO DI MARE");
  assert.equal(resolveStationItemName({ name: "ORO DI MARE", ticketName: "   " }, "production"), "ORO DI MARE");
});

test("an unknown station kind still falls back safely", () => {
  assert.equal(resolveStationItemName({ name: "MARGHERITA", ticketName: "MARGH" }, "production"), "MARGH");
  assert.equal(resolveStationItemName({ name: "MARGHERITA", ticketName: "MARGH" }, "anything-else"), "MARGHERITA");
});

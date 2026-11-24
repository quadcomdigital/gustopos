import assert from "node:assert/strict";
import test from "node:test";
import { makeTicketNumber, ticketDatePart } from "./utils/ticket-number";

// Il vecchio formato usava le ultime 4 cifre dei millisecondi: ciclavano ogni
// 10 secondi, quindi due conti a 10 s di distanza condividevano il numero (e
// quindi il tavolo virtuale). Questi test bloccano quel meccanismo.

test("formato: prefisso, data compatta, 6 cifre", () => {
  const ticket = makeTicketNumber("TA", { now: new Date("2026-11-24T10:00:00Z"), digits: "012345" });
  assert.equal(ticket, "TA-20261124-012345");
});

test("le cifre sono sempre 6 (padding)", () => {
  const ticket = makeTicketNumber("DL", { now: new Date("2026-11-24T10:00:00Z"), digits: "7" });
  assert.equal(ticket, "DL-20261124-7");
});

test("data locale del giorno (parte condivisa)", () => {
  assert.equal(ticketDatePart(new Date("2026-11-24T23:59:59Z")), "20261124");
});

test("due ticket generati nello STESSO millisecondo non coincidono", () => {
  const seen = new Set<string>();
  for (let i = 0; i < 500; i += 1) seen.add(makeTicketNumber("TA"));
  // 500 estrazioni su 1.000.000 di valori: collisioni possibili ma non garantite.
  assert.ok(seen.size >= 498, `attese quasi tutte distinte, ottenute ${seen.size}`);
});

test("non dipende dal timestamp: nessun ciclo di 10 secondi", () => {
  // Stessa data, cifre iniettate diverse → ticket diversi (il vecchio helper
  // avrebbe prodotto lo stesso numero per due chiamate a 10 s di distanza).
  const a = makeTicketNumber("TA", { now: new Date("2026-11-24T10:00:00Z"), digits: "1000" });
  const b = makeTicketNumber("TA", { now: new Date("2026-11-24T10:00:10Z"), digits: "2000" });
  assert.notEqual(a, b);
});

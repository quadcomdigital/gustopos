import { test } from "node:test";
import assert from "node:assert/strict";
import { fiscalPrinterConfigSchema, fiscalWirePayloadSchema, type FiscalPrinterConfig } from "@gustopos/shared";
import { liveVerificationFor, selectVerificationEvidence, verificationCounters } from "./live-verification";

/**
 * La prova gestionale che il server compone: è l'unica cosa che rende il
 * collaudo verificabile (id + protocollo scritti dal server nel payload).
 */
function testJobPayload(protocolId: string, frames = 1): string {
  return JSON.stringify(
    fiscalWirePayloadSchema.parse({
      purpose: "test",
      wire: {
        protocolId,
        frames: Array.from({ length: frames }, () => ({ label: "prova", tx: "PW8=" })),
      },
    }),
  );
}

function config(overrides: Record<string, unknown> = {}): FiscalPrinterConfig {
  return fiscalPrinterConfigSchema.parse({ enabled: true, host: "192.168.0.120", ...overrides });
}

test("il collaudo si legge per protocollo, non per posizione", () => {
  const stored = config({
    liveVerifications: [
      { protocolId: "rch-walle", verifiedAt: "2026-10-15T10:00:00.000Z", testJobId: "fj_walle" },
      { protocolId: "print3rt", verifiedAt: "2026-10-16T09:00:00.000Z", testJobId: "fj_print3" },
    ],
  });
  assert.equal(liveVerificationFor(stored, "print3rt")?.testJobId, "fj_print3");
  assert.equal(liveVerificationFor(stored, "rch-walle")?.testJobId, "fj_walle");
  // Un dialetto mai collaudato e l'assenza di dialetto valgono uguale: bloccato.
  assert.equal(liveVerificationFor(stored, "ditron"), null);
  assert.equal(liveVerificationFor(stored, null), null);
  assert.equal(liveVerificationFor(config(), "print3rt"), null);
});

test("l'evidenza del collaudo è una prova completata dello stesso protocollo", () => {
  const rows = [
    // Più recente, ma di un altro dialetto: non vale per print3rt.
    { id: "fj_walle", bridgeId: "pb_1", payload: testJobPayload("rch-walle"), result: null },
    { id: "fj_print3", bridgeId: "pb_1", payload: testJobPayload("print3rt"), result: '{"counters":{}}' },
    { id: "fj_vecchia", bridgeId: "pb_1", payload: testJobPayload("print3rt"), result: null },
  ];
  assert.equal(selectVerificationEvidence(rows, "print3rt")?.id, "fj_print3");
  // Nessuna prova per ditron: il collaudo non si può registrare.
  assert.equal(selectVerificationEvidence(rows, "ditron"), null);
  assert.equal(selectVerificationEvidence([], "print3rt"), null);
});

test("un payload illeggibile vale come prova assente", () => {
  const rows = [
    { id: "fj_rotta", bridgeId: null, payload: "{non-json", result: null },
    { id: "fj_senza_wire", bridgeId: null, payload: '{"purpose":"test"}', result: null },
    { id: "fj_buona", bridgeId: null, payload: testJobPayload("print3rt"), result: null },
  ];
  assert.equal(selectVerificationEvidence(rows, "print3rt")?.id, "fj_buona");
  assert.equal(selectVerificationEvidence(rows.slice(0, 2), "print3rt"), null);
});

test("dell'evidenza si conservano le quadrature, non ciò che non è leggibile", () => {
  assert.deepEqual(
    verificationCounters(
      JSON.stringify({ counters: { "gran totale": "8342.413,29", corrispettivi: "0042" } }),
    ),
    { "gran totale": "8342.413,29", corrispettivi: "0042" },
  );
  // Valori non testuali (numeri, null) non entrano: il risultato è testo del RT.
  assert.deepEqual(verificationCounters(JSON.stringify({ counters: { x: 5, y: null, z: "ok" } })), { z: "ok" });
  assert.deepEqual(verificationCounters(null), {});
  assert.deepEqual(verificationCounters("{non-json"), {});
  assert.deepEqual(verificationCounters('{"counters":"non-oggetto"}'), {});
});

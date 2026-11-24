import assert from "node:assert/strict";
import test from "node:test";
import { tableReleasePatch } from "./utils/table-release";

// Il caso che ha riempito il DB di 284 righe inattive: un conto asporto chiuso
// veniva solo "liberato" (`status='free'`) e restava attivo per sempre. Ora il
// rilascio ritira il virtuale, ma SOLO quando non ha più ordini aperti.

test("salotto: il tavolo fisico si libera ma non si ritira mai", () => {
  const { retired, patch } = tableReleasePatch({ isVirtual: false, hasOpenOrders: false });
  assert.equal(retired, false);
  assert.deepEqual(patch, { status: "free", currentOrderId: null });
  assert.equal("isActive" in patch, false);
});

test("conto virtuale chiuso: liberato E ritirato (mai cancellato)", () => {
  const { retired, patch } = tableReleasePatch({ isVirtual: true, hasOpenOrders: false });
  assert.equal(retired, true);
  assert.deepEqual(patch, { status: "free", currentOrderId: null, isActive: 0 });
});

test("conto virtuale con altre voci aperte: resta attivo e occupabile", () => {
  const { retired, patch } = tableReleasePatch({ isVirtual: true, hasOpenOrders: true });
  assert.equal(retired, false);
  assert.deepEqual(patch, { status: "free", currentOrderId: null });
});

test("il rilascio azzera sempre il puntatore all'ordine", () => {
  for (const isVirtual of [true, false]) {
    for (const hasOpenOrders of [true, false]) {
      assert.equal(
        tableReleasePatch({ isVirtual, hasOpenOrders }).patch.currentOrderId,
        null,
      );
    }
  }
});

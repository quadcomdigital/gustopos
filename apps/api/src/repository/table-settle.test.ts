import test from "node:test";
import assert from "node:assert/strict";
import { computeSettleTotals } from "./utils/table-settle";

test("un conto con tutte le voci pagate non lascia residuo", () => {
  const totals = computeSettleTotals(
    [{ id: 6530, quantity: 1, price: "5.00" }],
    [{ orderItemId: 6530, quantity: 1 }],
  );
  assert.deepEqual(totals, { totalAmount: 5, paidAmount: 5, remainingAmount: 0 });
});

test("una voce non pagata blocca la chiusura a saldo zero", () => {
  const totals = computeSettleTotals(
    [
      { id: 1, quantity: 1, price: 5 },
      { id: 2, quantity: 2, price: "3.50" },
    ],
    [{ orderItemId: 1, quantity: 1 }],
  );
  assert.equal(totals.totalAmount, 12);
  assert.equal(totals.paidAmount, 5);
  assert.equal(totals.remainingAmount, 7);
});

test("pagato parziale e quantità superiori all'ordinato non gonfiano l'incassato", () => {
  const totals = computeSettleTotals(
    [{ id: 1, quantity: 2, price: 4 }],
    [
      { orderItemId: 1, quantity: 1 },
      // voce ridotta dopo l'incasso: il pagamento in eccesso non conta
      { orderItemId: 1, quantity: 3 },
      // pagamento su una voce che non esiste più: ignorato
      { orderItemId: 99, quantity: 5 },
    ],
  );
  assert.equal(totals.totalAmount, 8);
  assert.equal(totals.paidAmount, 8);
  assert.equal(totals.remainingAmount, 0);
});

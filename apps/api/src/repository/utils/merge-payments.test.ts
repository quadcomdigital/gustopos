import test from "node:test";
import assert from "node:assert/strict";
import { collectCurrentSessionPaymentIds } from "./merge-payments";

test("returns only payments linked to open order items", () => {
  const paymentIds = collectCurrentSessionPaymentIds(
    [101, 102],
    [
      { paymentId: "pay_a", orderItemId: 101 },
      { paymentId: "pay_a", orderItemId: 102 },
      { paymentId: "pay_historical", orderItemId: 103 },
      { paymentId: "pay_c", orderItemId: 101 },
    ],
  );
  assert.deepEqual(paymentIds.sort(), ["pay_a", "pay_c"]);
});

test("dedupes repeated payment ids", () => {
  const paymentIds = collectCurrentSessionPaymentIds(
    [1],
    [
      { paymentId: "pay_a", orderItemId: 1 },
      { paymentId: "pay_a", orderItemId: 1 },
    ],
  );
  assert.deepEqual(paymentIds, ["pay_a"]);
});

test("returns empty when no open items match", () => {
  const paymentIds = collectCurrentSessionPaymentIds(
    [],
    [{ paymentId: "pay_historical", orderItemId: 999 }],
  );
  assert.deepEqual(paymentIds, []);
});

test("returns empty for an empty payment rows list", () => {
  const paymentIds = collectCurrentSessionPaymentIds([1, 2, 3], []);
  assert.deepEqual(paymentIds, []);
});

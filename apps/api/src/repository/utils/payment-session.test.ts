import test from "node:test";
import assert from "node:assert/strict";
import {
  isPaymentInSession,
  resolveSessionStartedAt,
  selectSessionSplitBatch,
} from "./payment-session";

const at = (minutes: number) => new Date(Date.UTC(2026, 10, 22, 20, minutes, 0));

test("resolveSessionStartedAt picks the earliest open order", () => {
  assert.equal(resolveSessionStartedAt([]), null);
  const started = resolveSessionStartedAt([
    { timestamp: at(30) },
    { timestamp: at(5) },
    { timestamp: at(12) },
  ]);
  assert.equal(started?.getTime(), at(5).getTime());
});

test("isPaymentInSession rejects payments from a previous session", () => {
  const started = at(20);
  assert.equal(isPaymentInSession({ createdAt: at(19) }, started), false);
  assert.equal(isPaymentInSession({ createdAt: at(20) }, started), true);
  assert.equal(isPaymentInSession({ createdAt: at(21) }, started), true);
  assert.equal(isPaymentInSession({ createdAt: at(21) }, null), false);
});

test("selectSessionSplitBatch ignores shares from previous nights", () => {
  const batch = selectSessionSplitBatch(
    [
      { createdAt: at(0), shareIndex: 0, reference: "split:old" },
      { createdAt: at(0), shareIndex: 1, reference: "split:old" },
      { createdAt: at(30), shareIndex: 0, reference: "split:current" },
      { createdAt: at(30), shareIndex: 1, reference: "split:current" },
    ],
    at(10),
  );
  assert.deepEqual(batch.map((p) => p.reference), ["split:current", "split:current"]);
});

test("selectSessionSplitBatch keeps only the latest batch when the table is re-split", () => {
  const batch = selectSessionSplitBatch(
    [
      { createdAt: at(30), shareIndex: 0, reference: "split:first" },
      { createdAt: at(30), shareIndex: 1, reference: "split:first" },
      { createdAt: at(45), shareIndex: 0, reference: "split:second" },
      { createdAt: at(45), shareIndex: 1, reference: "split:second" },
      { createdAt: at(45), shareIndex: 2, reference: "split:second" },
    ],
    at(10),
  );
  assert.equal(batch.length, 3);
  assert.deepEqual(batch.map((p) => p.shareIndex), [0, 1, 2]);
});

test("selectSessionSplitBatch ignores item payments and empty sessions", () => {
  const payments = [
    { createdAt: at(30), shareIndex: null, reference: "items:1" },
    { createdAt: at(31), shareIndex: null, reference: "items:2" },
  ];
  assert.deepEqual(selectSessionSplitBatch(payments, at(10)), []);
  assert.deepEqual(selectSessionSplitBatch(payments, null), []);
});

import test from "node:test";
import assert from "node:assert/strict";
import { assertOrderStatusTransition, canTransitionOrderStatus } from "./order-status-policy";

test("allows valid operational kitchen transitions", () => {
  assert.equal(canTransitionOrderStatus("pending", "preparing"), true);
  assert.equal(canTransitionOrderStatus("preparing", "ready"), true);
  assert.equal(canTransitionOrderStatus("ready", "served"), true);
  assert.equal(canTransitionOrderStatus("served", "paid"), false);
});

test("allows valid backward transitions", () => {
  assert.equal(canTransitionOrderStatus("preparing", "pending"), true);
  assert.equal(canTransitionOrderStatus("ready", "preparing"), true);
});

test("blocks invalid backwards transitions", () => {
  assert.equal(canTransitionOrderStatus("ready", "pending"), false);
  assert.equal(canTransitionOrderStatus("paid", "served"), false);
});

test("throws on invalid status transitions", () => {
  assert.throws(() => assertOrderStatusTransition("paid", "ready"), /Invalid order status transition/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { resolveRolePermissions } from "./role-permissions";

test("admin receives critical operational permissions", () => {
  const permissions = resolveRolePermissions("admin");
  assert.equal(permissions.includes("payments:refund"), true);
  assert.equal(permissions.includes("fiscal:export"), true);
  assert.equal(permissions.includes("settings:update"), true);
});

test("waiter permissions are restricted", () => {
  const permissions = resolveRolePermissions("waiter");
  assert.equal(permissions.includes("tables:pay"), true);
  assert.equal(permissions.includes("payments:refund"), false);
});

test("consumer has no privileged permissions", () => {
  assert.deepEqual(resolveRolePermissions("consumer"), []);
});

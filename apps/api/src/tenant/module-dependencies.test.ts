import test from "node:test";
import assert from "node:assert/strict";
import { planModuleToggle } from "./module-dependencies";
import type { ModuleKey } from "@gustopos/shared";

function plan(moduleKey: ModuleKey, enabled: boolean, enabledSet: ModuleKey[]) {
  const set = new Set<ModuleKey>(enabledSet);
  return planModuleToggle({ moduleKey, enabled, isEnabled: (key) => set.has(key) });
}

test("enabling simple_catalog disables inventory (mutual exclusion)", () => {
  const result = plan("simple_catalog", true, ["inventory"]);
  assert.deepEqual(result.enable, ["simple_catalog"]);
  assert.deepEqual(result.disable, ["inventory"]);
});

test("enabling simple_catalog cascades to inventory's dependents", () => {
  const result = plan("simple_catalog", true, ["inventory", "purchasing_suppliers"]);
  assert.deepEqual(result.enable, ["simple_catalog"]);
  assert.deepEqual(new Set(result.disable), new Set(["inventory", "purchasing_suppliers"]));
});

test("disabling inventory disables purchasing_suppliers", () => {
  const result = plan("inventory", false, ["inventory", "purchasing_suppliers"]);
  assert.deepEqual(result.enable, []);
  assert.deepEqual(result.disable, ["purchasing_suppliers"]);
});

test("enabling purchasing_suppliers auto-enables inventory", () => {
  const result = plan("purchasing_suppliers", true, []);
  assert.deepEqual(new Set(result.enable), new Set(["purchasing_suppliers", "inventory"]));
  assert.deepEqual(result.disable, []);
});

test("disabling customers disables loyalty_points", () => {
  const result = plan("customers", false, ["customers", "loyalty_points"]);
  assert.deepEqual(result.disable, ["loyalty_points"]);
});

test("toggling an unrelated module leaves others untouched", () => {
  const result = plan("kitchen", false, ["inventory", "purchasing_suppliers"]);
  assert.deepEqual(result.enable, []);
  assert.deepEqual(result.disable, []);
});

test("enabling course_rounds auto-enables kitchen (dependency)", () => {
  const result = plan("course_rounds", true, []);
  assert.deepEqual(new Set(result.enable), new Set(["course_rounds", "kitchen"]));
});

test("disabling kitchen disables course_rounds", () => {
  const result = plan("kitchen", false, ["kitchen", "course_rounds"]);
  assert.deepEqual(result.disable, ["course_rounds"]);
});

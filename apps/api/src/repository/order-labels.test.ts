import test from "node:test";
import assert from "node:assert/strict";
import { formatIngredientOverrideLabel, formatIngredientOverrides } from "./utils/order-labels";

test("override label uses the resolved name for remove/add", () => {
  const names = new Map<string, string>([["i_pollo", "Pollo"], ["prep_smash", "Smash"]]);
  assert.equal(formatIngredientOverrideLabel("remove", "prep_smash", names), "- Smash");
  assert.equal(formatIngredientOverrideLabel("add", "i_pollo", names), "+ Pollo");
});

test("override label falls back to the id when the name is unknown", () => {
  assert.equal(formatIngredientOverrideLabel("remove", "prep_812728", new Map()), "- prep_812728");
});

test("formatIngredientOverrides keeps order and never emits opaque ids when known", () => {
  const names = new Map<string, string>([
    ["prep_smash", "Smash"],
    ["prep_scamorza", "Scamorza a fette"],
    ["i_cipolla", "Cipolla caramellata"],
  ]);
  const labels = formatIngredientOverrides(
    [
      { ingredientId: "prep_smash", action: "remove" },
      { ingredientId: "prep_scamorza", action: "add" },
      { ingredientId: "i_cipolla", action: "remove" },
    ],
    names,
  );
  assert.deepEqual(labels, ["- Smash", "+ Scamorza a fette", "- Cipolla caramellata"]);
});

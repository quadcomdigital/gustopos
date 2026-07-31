import test from "node:test";
import assert from "node:assert/strict";

/**
 * Tests for BoM explosion logic (explodeBomRequirements).
 *
 * This tests the pure algorithm that powers stock deduction during order creation.
 * The function takes a BoM ID + multiplier and recursively explodes all components
 * into a flat ingredient/prep quantity map.
 */

function toNumeric(value: string | number): number {
  return typeof value === "number" ? value : Number(value);
}

interface BomRow {
  id: string;
  name: string;
  yieldQuantity: string;
  isActive: number;
}

interface BomComponentRow {
  bomId: string;
  componentType: "ingredient" | "bom" | "prep";
  componentId: string;
  quantity: string;
}

function explodeBomRequirements(params: {
  bomId: string;
  multiplier: number;
  bomById: Map<string, BomRow>;
  componentsByBomId: Map<string, BomComponentRow[]>;
  visited?: Set<string>;
}): { ingredients: Map<string, number>; preps: Map<string, number> } {
  const { bomId, multiplier, bomById, componentsByBomId } = params;
  const visited = params.visited ?? new Set<string>();

  if (visited.has(bomId)) {
    const bomName = bomById.get(bomId)?.name ?? bomId;
    throw new Error(`BoM recursion cycle detected at "${bomName}" (${bomId})`);
  }

  const bom = bomById.get(bomId);
  if (!bom) {
    throw new Error(`BoM item ${bomId} not found`);
  }

  if (bom.isActive !== 1) {
    throw new Error(`BoM "${bom.name}" (${bomId}) is not active`);
  }

  const yieldQty = toNumeric(bom.yieldQuantity);
  if (yieldQty <= 0) {
    throw new Error(`Invalid BoM yield for ${bomId}`);
  }

  const normalizedMultiplier = multiplier / yieldQty;
  const components = componentsByBomId.get(bomId) ?? [];
  const ingredients = new Map<string, number>();
  const preps = new Map<string, number>();

  const nextVisited = new Set(visited);
  nextVisited.add(bomId);

  for (const component of components) {
    const qty = toNumeric(component.quantity) * normalizedMultiplier;

    if (component.componentType === "ingredient") {
      ingredients.set(component.componentId, (ingredients.get(component.componentId) ?? 0) + qty);
    } else if (component.componentType === "bom") {
      const nested = explodeBomRequirements({
        bomId: component.componentId,
        multiplier: qty,
        bomById,
        componentsByBomId,
        visited: nextVisited,
      });

      for (const [ingredientId, nestedQty] of nested.ingredients) {
        ingredients.set(ingredientId, (ingredients.get(ingredientId) ?? 0) + nestedQty);
      }
      for (const [prepId, nestedQty] of nested.preps) {
        preps.set(prepId, (preps.get(prepId) ?? 0) + nestedQty);
      }
    } else if (component.componentType === "prep") {
      preps.set(component.componentId, (preps.get(component.componentId) ?? 0) + qty);
    }
  }

  return { ingredients, preps };
}

// ─── Basic explosion tests ──────────────────────────────────────────────

test("single ingredient BoM with yield 1 → direct quantities", () => {
  const bomById = new Map<string, BomRow>([
    ["bom1", { id: "bom1", name: "Burger", yieldQuantity: "1", isActive: 1 }],
  ]);
  const componentsByBomId = new Map<string, BomComponentRow[]>([
    ["bom1", [
      { bomId: "bom1", componentType: "ingredient", componentId: "beef", quantity: "0.150" },
      { bomId: "bom1", componentType: "ingredient", componentId: "bun", quantity: "1" },
      { bomId: "bom1", componentType: "ingredient", componentId: "lettuce", quantity: "0.030" },
    ]],
  ]);

  const result = explodeBomRequirements({
    bomId: "bom1",
    multiplier: 2,
    bomById,
    componentsByBomId,
  });

  assert.deepEqual(
    Object.fromEntries(result.ingredients),
    { beef: 0.300, bun: 2, lettuce: 0.060 },
  );
  assert.equal(result.preps.size, 0);
});

test("BoM with yield > 1 divides quantities", () => {
  // yieldQuantity = 2 means one "unit" of this BoM produces 2 portions
  const bomById = new Map<string, BomRow>([
    ["bom1", { id: "bom1", name: "SauceBatch", yieldQuantity: "4", isActive: 1 }],
  ]);
  const componentsByBomId = new Map<string, BomComponentRow[]>([
    ["bom1", [
      { bomId: "bom1", componentType: "ingredient", componentId: "oil", quantity: "0.200" },
      { bomId: "bom1", componentType: "ingredient", componentId: "tomato", quantity: "0.800" },
    ]],
  ]);

  // Order 1 portion → multiplier=1, yield=4 → normalizedMultiplier=0.25
  const result = explodeBomRequirements({
    bomId: "bom1",
    multiplier: 1,
    bomById,
    componentsByBomId,
  });

  assert.deepEqual(
    Object.fromEntries(result.ingredients),
    { oil: 0.050, tomato: 0.200 }, // 0.200*0.25, 0.800*0.25
  );
});

test("BoM with prep items", () => {
  const bomById = new Map<string, BomRow>([
    ["bom1", { id: "bom1", name: "Pizza", yieldQuantity: "1", isActive: 1 }],
  ]);
  const componentsByBomId = new Map<string, BomComponentRow[]>([
    ["bom1", [
      { bomId: "bom1", componentType: "ingredient", componentId: "flour", quantity: "0.200" },
      { bomId: "bom1", componentType: "prep", componentId: "prep_dough", quantity: "1" },
      { bomId: "bom1", componentType: "prep", componentId: "prep_sauce", quantity: "0.5" },
    ]],
  ]);

  const result = explodeBomRequirements({
    bomId: "bom1",
    multiplier: 3,
    bomById,
    componentsByBomId,
  });

  // Use approximate comparison for floating-point math
  const flour = result.ingredients.get("flour")!;
  assert.ok(Math.abs(flour - 0.6) < 0.0001, `flour should be ~0.6, got ${flour}`);
  assert.deepEqual(Object.fromEntries(result.preps), { prep_dough: 3, prep_sauce: 1.5 });
});

// ─── Nested BoM tests ───────────────────────────────────────────────────

test("nested BoM → flourishes through to ingredients", () => {
  const bomById = new Map<string, BomRow>([
    ["bom_burger", { id: "bom_burger", name: "Burger", yieldQuantity: "1", isActive: 1 }],
    ["bom_patty", { id: "bom_patty", name: "Patty Mix", yieldQuantity: "1", isActive: 1 }],
  ]);
  const componentsByBomId = new Map<string, BomComponentRow[]>([
    ["bom_burger", [
      { bomId: "bom_burger", componentType: "bom", componentId: "bom_patty", quantity: "1" },
      { bomId: "bom_burger", componentType: "ingredient", componentId: "bun", quantity: "1" },
    ]],
    ["bom_patty", [
      { bomId: "bom_patty", componentType: "ingredient", componentId: "beef", quantity: "0.150" },
      { bomId: "bom_patty", componentType: "ingredient", componentId: "salt", quantity: "0.005" },
    ]],
  ]);

  // 2 burgers → 2 patties → 2 * (0.150 beef + 0.005 salt) + 2 * bun
  const result = explodeBomRequirements({
    bomId: "bom_burger",
    multiplier: 2,
    bomById,
    componentsByBomId,
  });

  assert.deepEqual(
    Object.fromEntries(result.ingredients),
    { bun: 2, beef: 0.300, salt: 0.010 },
  );
  assert.equal(result.preps.size, 0);
});

test("deeply nested BoM with yield scaling in the middle", () => {
  const bomById = new Map<string, BomRow>([
    ["bom_meal", { id: "bom_meal", name: "Meal Deal", yieldQuantity: "1", isActive: 1 }],
    ["bom_sauce", { id: "bom_sauce", name: "Sauce Batch (4 portions)", yieldQuantity: "4", isActive: 1 }],
  ]);
  const componentsByBomId = new Map<string, BomComponentRow[]>([
    ["bom_meal", [
      { bomId: "bom_meal", componentType: "bom", componentId: "bom_sauce", quantity: "1" },
      { bomId: "bom_meal", componentType: "ingredient", componentId: "fries", quantity: "0.200" },
    ]],
    ["bom_sauce", [
      { bomId: "bom_sauce", componentType: "ingredient", componentId: "ketchup", quantity: "0.100" },
      { bomId: "bom_sauce", componentType: "ingredient", componentId: "mayo", quantity: "0.080" },
    ]],
  ]);

  // 2 meals → 2 sauce servings (yield=4 → multiplier=2/4=0.5)
  // sauce ingredients: 0.100*0.5 + 0.080*0.5 per meal
  const result = explodeBomRequirements({
    bomId: "bom_meal",
    multiplier: 2,
    bomById,
    componentsByBomId,
  });

  assert.deepEqual(
    Object.fromEntries(result.ingredients),
    { fries: 0.400, ketchup: 0.050, mayo: 0.040 },
  );
});

// ─── Error handling tests ───────────────────────────────────────────────

test("throws on missing BoM", () => {
  const bomById = new Map<string, BomRow>();
  const componentsByBomId = new Map<string, BomComponentRow[]>();

  assert.throws(
    () =>
      explodeBomRequirements({
        bomId: "ghost",
        multiplier: 1,
        bomById,
        componentsByBomId,
      }),
    /BoM item ghost not found/,
  );
});

test("throws on inactive BoM", () => {
  const bomById = new Map<string, BomRow>([
    ["bom1", { id: "bom1", name: "Old Recipe", yieldQuantity: "1", isActive: 0 }],
  ]);
  const componentsByBomId = new Map<string, BomComponentRow[]>();

  assert.throws(
    () =>
      explodeBomRequirements({
        bomId: "bom1",
        multiplier: 1,
        bomById,
        componentsByBomId,
      }),
    /is not active/,
  );
});

test("throws on invalid yield", () => {
  const bomById = new Map<string, BomRow>([
    ["bom1", { id: "bom1", name: "Bad Yield", yieldQuantity: "0", isActive: 1 }],
  ]);
  const componentsByBomId = new Map<string, BomComponentRow[]>();

  assert.throws(
    () =>
      explodeBomRequirements({
        bomId: "bom1",
        multiplier: 1,
        bomById,
        componentsByBomId,
      }),
    /Invalid BoM yield/,
  );
});

test("throws on recursion cycle", () => {
  // A → B → A
  const bomById = new Map<string, BomRow>([
    ["bom_a", { id: "bom_a", name: "Cycle A", yieldQuantity: "1", isActive: 1 }],
    ["bom_b", { id: "bom_b", name: "Cycle B", yieldQuantity: "1", isActive: 1 }],
  ]);
  const componentsByBomId = new Map<string, BomComponentRow[]>([
    ["bom_a", [{ bomId: "bom_a", componentType: "bom", componentId: "bom_b", quantity: "1" }]],
    ["bom_b", [{ bomId: "bom_b", componentType: "bom", componentId: "bom_a", quantity: "1" }]],
  ]);

  assert.throws(
    () =>
      explodeBomRequirements({
        bomId: "bom_a",
        multiplier: 1,
        bomById,
        componentsByBomId,
      }),
    /recursion cycle/,
  );
});

// ─── Edge cases ─────────────────────────────────────────────────────────

test("empty recipe → zero ingredients and preps", () => {
  const bomById = new Map<string, BomRow>([
    ["bom_empty", { id: "bom_empty", name: "Just a Container", yieldQuantity: "1", isActive: 1 }],
  ]);
  const componentsByBomId = new Map<string, BomComponentRow[]>();

  const result = explodeBomRequirements({
    bomId: "bom_empty",
    multiplier: 5,
    bomById,
    componentsByBomId,
  });

  assert.equal(result.ingredients.size, 0);
  assert.equal(result.preps.size, 0);
});

test("high multiplier → large quantities scale correctly", () => {
  const bomById = new Map<string, BomRow>([
    ["bom1", { id: "bom1", name: "Single", yieldQuantity: "1", isActive: 1 }],
  ]);
  const componentsByBomId = new Map<string, BomComponentRow[]>([
    ["bom1", [
      { bomId: "bom1", componentType: "ingredient", componentId: "salt", quantity: "0.002" },
    ]],
  ]);

  const result = explodeBomRequirements({
    bomId: "bom1",
    multiplier: 100,
    bomById,
    componentsByBomId,
  });

  assert.deepEqual(Object.fromEntries(result.ingredients), { salt: 0.200 });
});

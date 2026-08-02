import { Injectable } from "@nestjs/common";
import { db, withTenantTx } from "../db/client";
import { getTenantIdOrDefault } from "../tenant/tenant-context.store";
import { and, asc, desc, eq, inArray, isNull, ne, or, sql, SQL, lt, gte, lte } from "drizzle-orm";
import crypto from "node:crypto";
import {
  ingredientCreateRequestSchema,
  ingredientUpdateRequestSchema,
  bomCreateRequestSchema,
  bomItemSchema,
  bomUpdateRequestSchema,
  bomUpsertComponentsRequestSchema,
  bomAddComponentRequestSchema,
  bomRemoveComponentRequestSchema,
  categoryCreateRequestSchema,
  categoryUpdateRequestSchema,
  categoriesListResponseSchema,
  categoryScopeSchema,
  menuItemAdminListResponseSchema,
  menuItemAdminSchema,
  menuItemCreateRequestSchema,
  menuItemUpdateRequestSchema,
  menuItemReplaceRecipeRequestSchema,
  menuItemAddRecipeComponentRequestSchema,
  menuItemRemoveRecipeComponentRequestSchema,
  printAreaSchema,
  type Ingredient,
  type IngredientCreateRequest,
  type IngredientUpdateRequest,
  type BomItem,
  type BomCreateRequest,
  type BomUpdateRequest,
  type PrepItem,
  type PrepItemUpdateRequest,
  type PreparePrepItemResponse,
  type UnitConversion,
  type UnitConversionCreateRequest,
  type Category,
  type CategoryCreateRequest,
  type CategoryUpdateRequest,
  type CategoryModifierPool,
  type CategoryModifierPoolCreateRequest,
  type CategoryModifierPoolUpdateRequest,
  type MenuItemAdmin,
  type MenuItemCreateRequest,
  type MenuItemUpdateRequest,
  type MenuItemReplaceRecipeRequest,
  type PrintArea,
} from "@gustopos/shared";
import {
  inventory,
  bomItems,
  bomComponents,
  prepItems,
  inventoryUnitConversions,
  stockMovements,
  categories,
  categoryModifierPools,
  categoryModifierPoolOptions,
  categoryModifierPoolCategories,
  menuItems,
  menuItemIngredients,
  menuItemBomRequirements,
  menuItemPrepRequirements,
  menuModifierGroups,
  menuModifierOptions,
  menuModifierOptionOverrides,
  menuItemModifiers,
  suppliers,
  supplierIngredients,
  inventoryAudit,
  printJobs,
} from "../db/schema";

type InventoryRow = typeof inventory.$inferSelect;
type BomRow = typeof bomItems.$inferSelect;
type BomComponentRow = typeof bomComponents.$inferSelect;

function toNumeric(value: string | number): number {
  return typeof value === "number" ? value : Number(value);
}

function parsePrintAreas(raw: string | null | undefined): PrintArea[] {
  if (!raw) return ["kitchen"];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return ["kitchen"];
    const valid = parsed
      .map((entry: unknown) => { try { return printAreaSchema.parse(entry); } catch { return null; } })
      .filter((entry): entry is PrintArea => entry !== null);
    return valid.length > 0 ? valid : ["kitchen"];
  } catch { return ["kitchen"]; }
}

@Injectable()
export class InventoryRepository {
  private mapInventoryRows(rows: { id: string; name: string; quantity: unknown; unit: string; minThreshold: unknown; categoryId: string | null; unitCost: unknown; salePrice: string | null; isActive: number; isContainer: number; supplierName?: string | null; brandName?: string | null; sku?: string | null }[]): Ingredient[] {
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      sku: row.sku ?? null,
      quantity: Number(row.quantity),
      unit: row.unit,
      minThreshold: Number(row.minThreshold),
      categoryId: row.categoryId ?? undefined,
      unitCost: Number(row.unitCost ?? 0),
      salePrice: row.salePrice != null ? Number(row.salePrice) : null,
      isActive: row.isActive === 1,
      isContainer: row.isContainer ?? 0,
      supplierName: row.supplierName ?? null,
      brandName: row.brandName ?? null,
    }));
  }

  private mapCategoryRow(row: typeof categories.$inferSelect): Category {
    return {
      id: row.id,
      name: row.name,
      scope: categoryScopeSchema.parse(row.scope),
      isActive: row.isActive === 1,
      printAreas: parsePrintAreas(row.printAreas),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private explodeBomRequirements(params: {
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
    if (!bom) throw new Error(`BoM item ${bomId} not found`);
    if (bom.isActive !== 1) throw new Error(`BoM "${bom.name}" (${bomId}) is not active`);
    const yieldQty = toNumeric(bom.yieldQuantity);
    if (yieldQty <= 0) throw new Error(`Invalid BoM yield for ${bomId}`);
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
        const nested = this.explodeBomRequirements({ bomId: component.componentId, multiplier: qty, bomById, componentsByBomId, visited: nextVisited });
        for (const [ingredientId, nestedQty] of nested.ingredients) ingredients.set(ingredientId, (ingredients.get(ingredientId) ?? 0) + nestedQty);
        for (const [prepId, nestedQty] of nested.preps) preps.set(prepId, (preps.get(prepId) ?? 0) + nestedQty);
      } else if (component.componentType === "prep") {
        preps.set(component.componentId, (preps.get(component.componentId) ?? 0) + qty);
      }
    }
    return { ingredients, preps };
  }

  private async mapBomItems(): Promise<BomItem[]> {
    const tenantId = getTenantIdOrDefault();
    const [bomRows, componentRows] = await Promise.all([
      db.select().from(bomItems).where(eq(bomItems.tenantId, tenantId)),
      db.select().from(bomComponents).where(eq(bomComponents.tenantId, tenantId)),
    ]);
    const componentsByBomId = new Map<string, typeof componentRows>();
    for (const component of componentRows) {
      const existing = componentsByBomId.get(component.bomId) ?? [];
      existing.push(component);
      componentsByBomId.set(component.bomId, existing);
    }
    return bomRows.map((row) =>
      bomItemSchema.parse({
        id: row.id, name: row.name, unit: row.unit,
        yieldQuantity: Number(row.yieldQuantity), isActive: row.isActive === 1,
        categoryId: row.categoryId ?? undefined, isContainer: row.isContainer ?? 0,
        components: (componentsByBomId.get(row.id) ?? []).map((component) => ({
          id: String(component.id), componentType: component.componentType,
          componentId: component.componentId, quantity: Number(component.quantity), unit: component.unit,
        })),
      }),
    );
  }

  private async mapMenuItemsAdmin(): Promise<MenuItemAdmin[]> {
    const tenantId = getTenantIdOrDefault();
    const [menuRows, ingredientRows, bomRows, prepRows, inventoryRows, bomItemRows, prepItemRows, modifierGroupRows, modifierOptionRows, overrideRows, menuItemModifierRows] = await Promise.all([
      db.select().from(menuItems).where(eq(menuItems.tenantId, tenantId)),
      db.select().from(menuItemIngredients).where(eq(menuItemIngredients.tenantId, tenantId)),
      db.select().from(menuItemBomRequirements).where(eq(menuItemBomRequirements.tenantId, tenantId)),
      db.select().from(menuItemPrepRequirements).where(eq(menuItemPrepRequirements.tenantId, tenantId)),
      db.select().from(inventory).where(eq(inventory.tenantId, tenantId)),
      db.select().from(bomItems).where(eq(bomItems.tenantId, tenantId)),
      db.select().from(prepItems).where(eq(prepItems.tenantId, tenantId)),
      db.select().from(menuModifierGroups).where(eq(menuModifierGroups.tenantId, tenantId)),
      db.select().from(menuModifierOptions).where(eq(menuModifierOptions.tenantId, tenantId)),
      db.select().from(menuModifierOptionOverrides).where(eq(menuModifierOptionOverrides.tenantId, tenantId)),
      db.select().from(menuItemModifiers).where(eq(menuItemModifiers.tenantId, tenantId)),
    ]);
    const ingredientNameById = new Map(inventoryRows.map((row) => [row.id, row.name]));
    const bomNameById = new Map(bomItemRows.map((row) => [row.id, row.name]));
    const prepNameById = new Map(prepItemRows.map((row) => [row.id, row.name]));
    const prepUnitById = new Map(prepItemRows.map((row) => [row.id, row.unit]));
    const recipeByMenuId = new Map<string, MenuItemAdmin["recipe"]>();
    for (const ingredient of ingredientRows) {
      const existing = recipeByMenuId.get(ingredient.menuItemId) ?? [];
      existing.push({ componentType: "ingredient", componentId: ingredient.ingredientId, componentName: ingredientNameById.get(ingredient.ingredientId) ?? ingredient.ingredientId, quantity: toNumeric(ingredient.quantity), unit: ingredient.unit });
      recipeByMenuId.set(ingredient.menuItemId, existing);
    }
    for (const bom of bomRows) {
      const existing = recipeByMenuId.get(bom.menuItemId) ?? [];
      existing.push({ componentType: "bom", componentId: bom.bomId, componentName: bomNameById.get(bom.bomId) ?? bom.bomId, quantity: toNumeric(bom.quantity), unit: bom.unit });
      recipeByMenuId.set(bom.menuItemId, existing);
    }
    for (const prep of prepRows) {
      const existing = recipeByMenuId.get(prep.menuItemId) ?? [];
      existing.push({ componentType: "prep", componentId: prep.prepItemId, componentName: prepNameById.get(prep.prepItemId) ?? prep.prepItemId, quantity: toNumeric(prep.quantity), unit: prepUnitById.get(prep.prepItemId) ?? "" });
      recipeByMenuId.set(prep.menuItemId, existing);
    }
    const overridesByOptionId = new Map<string, Array<{ ingredientId: string; action: "add" | "remove" | "replace" }>>();
    for (const override of overrideRows) {
      const existing = overridesByOptionId.get(override.optionId) ?? [];
      existing.push({ ingredientId: override.ingredientId, action: override.action as "add" | "remove" | "replace" });
      overridesByOptionId.set(override.optionId, existing);
    }
    const optionsByGroupId = new Map<string, any[]>();
    for (const opt of modifierOptionRows) {
      const existing = optionsByGroupId.get(opt.groupId) ?? [];
      existing.push({ id: opt.id, name: opt.name, inventoryItemId: opt.inventoryItemId ?? undefined, bomId: opt.bomId ?? undefined, priceDelta: Number(opt.priceDelta), isDefault: Boolean(opt.isDefault), isActive: Boolean(opt.isActive), sortOrder: opt.sortOrder ?? 0, ingredientOverrides: overridesByOptionId.get(opt.id) ?? [] });
      optionsByGroupId.set(opt.groupId, existing);
    }
    const modifierGroupsByMenuId = new Map<string, any[]>();
    for (const group of modifierGroupRows) {
      const existing = modifierGroupsByMenuId.get(group.menuItemId) ?? [];
      existing.push({ id: group.id, name: group.name, required: Boolean(group.required), minSelections: group.minSelections, maxSelections: group.maxSelections, sortOrder: group.sortOrder ?? 0, options: optionsByGroupId.get(group.id) ?? [] });
      modifierGroupsByMenuId.set(group.menuItemId, existing);
    }
    const adminInventoryById = new Map(inventoryRows.map((row) => [row.id, row]));
    const adminModifiersByMenuId = new Map<string, any[]>();
    for (const mod of menuItemModifierRows) {
      const existing = adminModifiersByMenuId.get(mod.menuItemId) ?? [];
      const invItem = adminInventoryById.get(mod.inventoryItemId);
      const priceDelta = Number(mod.priceDelta);
      const effectivePrice = priceDelta || (invItem?.salePrice != null ? Number(invItem.salePrice) : 0);
      existing.push({ id: mod.id, inventoryItemId: mod.inventoryItemId, name: invItem?.name ?? mod.inventoryItemId, priceDelta, effectivePrice });
      adminModifiersByMenuId.set(mod.menuItemId, existing);
    }
    return menuItemAdminListResponseSchema.parse(menuRows.map((row) => menuItemAdminSchema.parse({
      id: row.id, name: row.name, price: Number(row.price), category: row.category, categoryId: row.categoryId ?? undefined,
      defaultContainerId: row.defaultContainerId ?? null, printAreas: parsePrintAreas(row.printAreas), isActive: row.isActive === 1,
      recipe: recipeByMenuId.get(row.id) ?? [], modifiers: adminModifiersByMenuId.get(row.id) ?? [], modifierGroups: modifierGroupsByMenuId.get(row.id) ?? [],
    })));
  }

  // --- Shadow BoM helpers ---

  private shadowBomName(menuItemId: string): string {
    return `__shadow__${menuItemId}`;
  }

  private async findShadowBoMId(menuItemId: string): Promise<string | null> {
    const tenantId = getTenantIdOrDefault();
    const rows = await db
      .select({ id: bomItems.id })
      .from(bomItems)
      .where(and(eq(bomItems.tenantId, tenantId), eq(bomItems.name, this.shadowBomName(menuItemId))))
      .limit(1);
    return rows[0]?.id ?? null;
  }

  private async syncShadowBoM(
    tx: typeof db,
    tenantId: string,
    menuItemId: string,
    recipe: Array<{ componentType: string; componentId: string; quantity: number; unit: string }>,
    categoryId?: string | null,
  ): Promise<void> {
    const shadowName = this.shadowBomName(menuItemId);
    let bomId = await this.findShadowBoMId(menuItemId);

    if (!bomId) {
      bomId = `bom_shadow_${Date.now().toString(36)}`;
      await tx.insert(bomItems).values({
        id: bomId,
        tenantId,
        name: shadowName,
        unit: 'pz',
        yieldQuantity: '1',
        categoryId: categoryId ?? null,
        isActive: 1,
        isContainer: 0,
      });
      await tx.insert(menuItemBomRequirements).values({
        tenantId,
        menuItemId,
        bomId,
        quantity: '1',
        unit: 'pz',
      });
    }

    await tx
      .delete(bomComponents)
      .where(and(eq(bomComponents.tenantId, tenantId), eq(bomComponents.bomId, bomId)));

    if (recipe.length > 0) {
      await tx.insert(bomComponents).values(
        recipe.map((c) => ({
          tenantId,
          bomId: bomId!,
          componentType: c.componentType,
          componentId: c.componentId,
          quantity: String(c.quantity),
          unit: c.unit,
        })),
      );
    }
  }

  private async deleteShadowBoM(menuItemId: string): Promise<void> {
    const tenantId = getTenantIdOrDefault();
    const bomId = await this.findShadowBoMId(menuItemId);
    if (!bomId) return;
    await db
      .delete(bomComponents)
      .where(and(eq(bomComponents.tenantId, tenantId), eq(bomComponents.bomId, bomId)));
    await db
      .delete(bomItems)
      .where(and(eq(bomItems.tenantId, tenantId), eq(bomItems.id, bomId)));
  }

  async listInventoryItems(): Promise<{ id: string; name: string; quantity: number; unit: string; minThreshold: number; unitCost: number; salePrice: number | null; isActive: boolean; isContainer: number; sku?: string | null | undefined; categoryId?: string | undefined; supplierName?: string | null | undefined; brandName?: string | null | undefined; }[]> {
const tenantId = getTenantIdOrDefault();
const rows = await db
  .select({
    id: inventory.id,
    name: inventory.name,
    sku: inventory.sku,
    quantity: inventory.quantity,
    unit: inventory.unit,
    minThreshold: inventory.minThreshold,
    categoryId: inventory.categoryId,
    unitCost: inventory.unitCost,
    salePrice: inventory.salePrice,
    isActive: inventory.isActive,
    isContainer: inventory.isContainer,
    supplierName: sql<string | null>`"suppliers"."name"`.as('supplierName'),
    brandName: sql<string | null>`"supplier_ingredients"."brand_name"`.as('brandName'),
  })
  .from(inventory)
  .leftJoin(
    supplierIngredients,
    and(
      eq(supplierIngredients.ingredientId, inventory.id),
      eq(supplierIngredients.tenantId, tenantId),
      eq(supplierIngredients.isPreferred, 1),
    ),
  )
  .leftJoin(suppliers, eq(suppliers.id, supplierIngredients.supplierId))
  .where(eq(inventory.tenantId, tenantId));
return this.mapInventoryRows(rows);
  }

  async createInventoryItem(payload: IngredientCreateRequest): Promise<{ id: string; name: string; quantity: number; unit: string; minThreshold: number; unitCost: number; salePrice: number | null; isActive: boolean; isContainer: number; sku?: string | null | undefined; categoryId?: string | undefined; supplierName?: string | null | undefined; brandName?: string | null | undefined; }> {
const parsed = ingredientCreateRequestSchema.parse(payload);
const tenantId = getTenantIdOrDefault();
const id = `i_${Date.now().toString(36)}`;

const inserted = await db
  .insert(inventory)
  .values({
    id,
    tenantId,
    name: parsed.name,
    sku: parsed.sku ?? null,
    quantity: String(parsed.quantity),
    unit: parsed.unit,
    minThreshold: String(parsed.minThreshold),
    categoryId: parsed.categoryId ?? null,
    unitCost: String(parsed.unitCost ?? 0),
    salePrice: parsed.salePrice != null ? String(parsed.salePrice) : null,
    isContainer: parsed.isContainer ? 1 : 0,
    isActive: 1,
  })
  .returning();

const created = inserted[0];
return {
  id: created.id,
  name: created.name,
  sku: created.sku ?? null,
  quantity: Number(created.quantity),
  unit: created.unit,
  minThreshold: Number(created.minThreshold),
  categoryId: created.categoryId ?? undefined,
  unitCost: Number(created.unitCost ?? 0),
  salePrice: created.salePrice != null ? Number(created.salePrice) : null,
  isActive: created.isActive === 1,
  isContainer: created.isContainer ?? 0,
};
  }

  async updateInventoryItem(id: string, payload: IngredientUpdateRequest): Promise<{ id: string; name: string; quantity: number; unit: string; minThreshold: number; unitCost: number; salePrice: number | null; isActive: boolean; isContainer: number; sku?: string | null | undefined; categoryId?: string | undefined; supplierName?: string | null | undefined; brandName?: string | null | undefined; } | null> {
const parsed = ingredientUpdateRequestSchema.parse(payload);
const tenantId = getTenantIdOrDefault();

// Capture old values for audit trail
const existing = await db
  .select()
  .from(inventory)
  .where(and(eq(inventory.tenantId, tenantId), eq(inventory.id, id)))
  .limit(1);
const oldRow = existing[0] ?? null;

const updated = await db
  .update(inventory)
  .set({
    ...(parsed.name !== undefined ? { name: parsed.name } : {}),
    ...(parsed.sku !== undefined ? { sku: parsed.sku } : {}),
    ...(parsed.quantity !== undefined ? { quantity: String(parsed.quantity) } : {}),
    ...(parsed.unit !== undefined ? { unit: parsed.unit } : {}),
    ...(parsed.minThreshold !== undefined ? { minThreshold: String(parsed.minThreshold) } : {}),
    ...(parsed.categoryId !== undefined ? { categoryId: parsed.categoryId } : {}),
    ...(parsed.unitCost !== undefined ? { unitCost: String(parsed.unitCost) } : {}),
    ...(parsed.salePrice !== undefined ? { salePrice: parsed.salePrice != null ? String(parsed.salePrice) : null } : {}),
    ...(parsed.isActive !== undefined ? { isActive: parsed.isActive ? 1 : 0 } : {}),
    ...(parsed.isContainer !== undefined ? { isContainer: parsed.isContainer ? 1 : 0 } : {}),
  })
  .where(and(eq(inventory.tenantId, tenantId), eq(inventory.id, id)))
  .returning();

if (updated.length === 0) {
  return null;
}

// Audit trail: log changes
if (oldRow) {
  const row = updated[0];
  const auditableFields = [
    { field: "name", oldVal: oldRow.name, newVal: row.name },
    { field: "quantity", oldVal: oldRow.quantity, newVal: row.quantity },
    { field: "unit", oldVal: oldRow.unit, newVal: row.unit },
    { field: "minThreshold", oldVal: oldRow.minThreshold, newVal: row.minThreshold },
    { field: "unitCost", oldVal: oldRow.unitCost ?? "0", newVal: row.unitCost ?? "0" },
    { field: "salePrice", oldVal: oldRow.salePrice ?? null, newVal: row.salePrice ?? null },
    { field: "categoryId", oldVal: oldRow.categoryId ?? null, newVal: row.categoryId ?? null },
    { field: "isActive", oldVal: String(oldRow.isActive), newVal: String(row.isActive) },
    { field: "isContainer", oldVal: String(oldRow.isContainer ?? 0), newVal: String(row.isContainer ?? 0) },
    { field: "sku", oldVal: oldRow.sku ?? null, newVal: row.sku ?? null },
  ];
  const changes = auditableFields.filter((f) => f.oldVal !== f.newVal);
  if (changes.length > 0) {
    await db.insert(inventoryAudit).values(changes.map((c) => ({
      id: crypto.randomUUID(),
      tenantId,
      inventoryId: id,
      field: c.field,
      oldValue: c.oldVal,
      newValue: c.newVal,
      changedBy: null,
      createdAt: new Date(),
    })));
  }
}

const row = updated[0];
return {
  id: row.id,
  name: row.name,
  sku: row.sku ?? null,
  quantity: Number(row.quantity),
  unit: row.unit,
  minThreshold: Number(row.minThreshold),
  categoryId: row.categoryId ?? undefined,
  unitCost: Number(row.unitCost ?? 0),
  salePrice: row.salePrice != null ? Number(row.salePrice) : null,
  isActive: row.isActive === 1,
  isContainer: row.isContainer ?? 0,
};
  }

  async deleteInventoryItem(id: string): Promise<boolean> {
const tenantId = getTenantIdOrDefault();
const existing = await db
  .select({ id: inventory.id })
  .from(inventory)
  .where(and(eq(inventory.tenantId, tenantId), eq(inventory.id, id)))
  .limit(1);
if (existing.length === 0) {
  return false;
}

const menuUsage = await db
  .select({ menuItemId: menuItemIngredients.menuItemId })
  .from(menuItemIngredients)
  .where(and(eq(menuItemIngredients.tenantId, tenantId), eq(menuItemIngredients.ingredientId, id)))
  .limit(1);
if (menuUsage.length > 0) {
  throw new Error("Cannot delete ingredient linked to a menu recipe");
}

const bomUsage = await db
  .select({ bomId: bomComponents.bomId })
  .from(bomComponents)
  .where(
    and(
      eq(bomComponents.tenantId, tenantId),
      eq(bomComponents.componentType, "ingredient"),
      eq(bomComponents.componentId, id),
    ),
  )
  .limit(1);
if (bomUsage.length > 0) {
  throw new Error("Cannot delete ingredient linked to a BoM");
}

await db
  .delete(inventory)
  .where(and(eq(inventory.tenantId, tenantId), eq(inventory.id, id)));
return true;
  }

  async adjustInventoryItem(id: string, deltaQuantity: number, notes?: string, staffId?: string): Promise<{ id: string; name: string; quantity: number; unit: string; minThreshold: number; unitCost: number; salePrice: number | null; isActive: boolean; isContainer: number; sku?: string | null | undefined; categoryId?: string | undefined; supplierName?: string | null | undefined; brandName?: string | null | undefined; }> {
if (!Number.isFinite(deltaQuantity) || deltaQuantity === 0) {
  throw new Error("Inventory adjustment must be a finite non-zero number");
}
const tenantId = getTenantIdOrDefault();

return withTenantTx(async (tx) => {
  const rows = await tx
    .select()
    .from(inventory)
    .where(and(eq(inventory.tenantId, tenantId), eq(inventory.id, id)))
    .limit(1)
    .for("update");
  const row = rows[0];
  if (!row) {
    throw new Error("Ingredient not found");
  }

  const previousQty = Number(row.quantity);
  const newQty = previousQty + deltaQuantity;
  if (newQty < 0) {
    throw new Error(`Stock cannot go below zero (current: ${previousQty}, adjustment: ${deltaQuantity})`);
  }

  await tx
    .update(inventory)
    .set({ quantity: String(newQty) })
    .where(and(eq(inventory.tenantId, tenantId), eq(inventory.id, id)));

  await tx.insert(stockMovements).values({
    id: crypto.randomUUID(),
    tenantId,
    ingredientId: id,
    orderId: null,
    movementType: "manual_adjustment",
    quantity: String(deltaQuantity),
    previousQuantity: String(previousQty),
    newQuantity: String(newQty),
    notes: notes ?? `Manual adjustment: ${deltaQuantity > 0 ? "+" : ""}${deltaQuantity}`,
    staffId: staffId ?? null,
  });

  const updated = await tx
    .select()
    .from(inventory)
    .where(and(eq(inventory.tenantId, tenantId), eq(inventory.id, id)))
    .limit(1);
  const r = updated[0];
  return {
    id: r.id,
    name: r.name,
    quantity: Number(r.quantity),
    unit: r.unit,
    minThreshold: Number(r.minThreshold),
    categoryId: r.categoryId ?? undefined,
    unitCost: Number(r.unitCost ?? 0),
    salePrice: r.salePrice != null ? Number(r.salePrice) : null,
    isActive: r.isActive === 1,
    isContainer: r.isContainer ?? 0,
  };
});
  }

  async listStockMovements(filters?: {
    ingredientId?: string;
    orderId?: string;
    movementType?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: { id: string; tenantId: string; ingredientId: string | null; prepItemId: string | null; orderId: string | null; movementType: string; quantity: number; previousQuantity: number; newQuantity: number; notes: string | null; staffId: string | null; createdAt: string; }[]; total: number; }> {
const tenantId = getTenantIdOrDefault();
const limit = filters?.limit ?? 50;
const offset = filters?.offset ?? 0;
const conditions: SQL[] = [eq(stockMovements.tenantId, tenantId)];
if (filters?.ingredientId) conditions.push(eq(stockMovements.ingredientId, filters.ingredientId));
if (filters?.orderId) conditions.push(eq(stockMovements.orderId, filters.orderId));
if (filters?.movementType) conditions.push(eq(stockMovements.movementType, filters.movementType));

const countResult = await db
  .select({ count: sql<number>`count(*)::int` })
  .from(stockMovements)
  .where(and(...conditions));
const total = countResult[0]?.count ?? 0;

const rows = await db
  .select()
  .from(stockMovements)
  .where(and(...conditions))
  .orderBy(desc(stockMovements.createdAt))
  .limit(limit)
  .offset(offset);

return {
  items: rows.map((r) => ({
    id: r.id,
    tenantId: r.tenantId,
    ingredientId: r.ingredientId,
    prepItemId: r.prepItemId,
    orderId: r.orderId,
    movementType: r.movementType,
    quantity: Number(r.quantity),
    previousQuantity: Number(r.previousQuantity),
    newQuantity: Number(r.newQuantity),
    notes: r.notes,
    staffId: r.staffId,
    createdAt: r.createdAt.toISOString(),
  })),
  total,
};
  }

  async listBomItems(): Promise<{ id: string; name: string; unit: string; yieldQuantity: number; isActive: boolean; components: { id: string; unit: string; componentType: "ingredient" | "bom" | "prep"; componentId: string; quantity: number; }[]; isContainer: number; categoryId?: string | undefined; }[]> {
return this.mapBomItems();
  }

  async createBomItem(payload: BomCreateRequest): Promise<{ id: string; name: string; unit: string; yieldQuantity: number; isActive: boolean; components: { id: string; unit: string; componentType: "ingredient" | "bom" | "prep"; componentId: string; quantity: number; }[]; isContainer: number; categoryId?: string | undefined; }> {
const parsed = bomCreateRequestSchema.parse(payload);
const tenantId = getTenantIdOrDefault();
const bomId = `bom_${Date.now().toString(36)}`;

await withTenantTx(async (tx) => {
  await tx.insert(bomItems).values({
    id: bomId,
    tenantId,
    name: parsed.name,
    unit: parsed.unit,
    yieldQuantity: String(parsed.yieldQuantity),
    categoryId: parsed.categoryId ?? null,
    isContainer: parsed.isContainer ? 1 : 0,
    isActive: 1,
  });

  if (parsed.components.length > 0) {
    await tx.insert(bomComponents).values(
      parsed.components.map((component) => ({
        tenantId,
        bomId,
        componentType: component.componentType,
        componentId: component.componentId,
        quantity: String(component.quantity),
        unit: component.unit,
      })),
    );
  }
});

const created = (await this.mapBomItems()).find((item) => item.id === bomId);
if (!created) {
  throw new Error("Failed to create BoM item");
}

return created;
  }

  async updateBomItem(id: string, payload: BomUpdateRequest): Promise<{ id: string; name: string; unit: string; yieldQuantity: number; isActive: boolean; components: { id: string; unit: string; componentType: "ingredient" | "bom" | "prep"; componentId: string; quantity: number; }[]; isContainer: number; categoryId?: string | undefined; } | null> {
const parsed = bomUpdateRequestSchema.parse(payload);
const tenantId = getTenantIdOrDefault();
const existing = await db
  .select({ id: bomItems.id, name: bomItems.name })
  .from(bomItems)
  .where(and(eq(bomItems.tenantId, tenantId), eq(bomItems.id, id)))
  .limit(1);
if (existing.length === 0) return null;
if (existing[0].name.startsWith('__shadow__')) {
  throw new Error("Cannot modify auto-generated shadow BoM");
}

const updated = await db
  .update(bomItems)
  .set({
    ...(parsed.name ? { name: parsed.name } : {}),
    ...(parsed.unit ? { unit: parsed.unit } : {}),
    ...(parsed.yieldQuantity ? { yieldQuantity: String(parsed.yieldQuantity) } : {}),
    ...(parsed.categoryId !== undefined ? { categoryId: parsed.categoryId } : {}),
    ...(parsed.isActive !== undefined ? { isActive: parsed.isActive ? 1 : 0 } : {}),
    ...(parsed.isContainer !== undefined ? { isContainer: parsed.isContainer ? 1 : 0 } : {}),
  })
  .where(and(eq(bomItems.tenantId, tenantId), eq(bomItems.id, id)))
  .returning({ id: bomItems.id });

if (updated.length === 0) {
  return null;
}

return (await this.mapBomItems()).find((item) => item.id === id) ?? null;
  }

  async deleteBomItem(id: string): Promise<boolean> {
const tenantId = getTenantIdOrDefault();
const existing = await db
  .select({ id: bomItems.id, name: bomItems.name })
  .from(bomItems)
  .where(and(eq(bomItems.tenantId, tenantId), eq(bomItems.id, id)))
  .limit(1);
if (existing.length === 0) {
  return false;
}

if (existing[0].name.startsWith('__shadow__')) {
  throw new Error("Cannot delete auto-generated shadow BoM");
}

const nestedUsage = await db
  .select({ bomId: bomComponents.bomId })
  .from(bomComponents)
  .where(
    and(
      eq(bomComponents.tenantId, tenantId),
      eq(bomComponents.componentType, "bom"),
      eq(bomComponents.componentId, id),
    ),
  )
  .limit(1);
if (nestedUsage.length > 0) {
  throw new Error("Cannot delete BoM linked to another BoM");
}

const menuUsage = await db
  .select({ menuItemId: menuItemBomRequirements.menuItemId })
  .from(menuItemBomRequirements)
  .where(and(eq(menuItemBomRequirements.tenantId, tenantId), eq(menuItemBomRequirements.bomId, id)))
  .limit(1);
if (menuUsage.length > 0) {
  throw new Error("Cannot delete BoM linked to a menu recipe");
}

const prepUsage = await db
  .select({ prepItemId: prepItems.id })
  .from(prepItems)
  .where(and(eq(prepItems.tenantId, tenantId), eq(prepItems.bomId, id)))
  .limit(1);
if (prepUsage.length > 0) {
  throw new Error("Cannot delete BoM linked to a prep item");
}

await db
  .delete(bomItems)
  .where(and(eq(bomItems.tenantId, tenantId), eq(bomItems.id, id)));
return true;
  }

  async addBomComponent(id: string, payload: { componentType: 'ingredient' | 'bom' | 'prep'; componentId: string; quantity: number; unit: string }): Promise<{ id: string; name: string; unit: string; yieldQuantity: number; isActive: boolean; components: { id: string; unit: string; componentType: "ingredient" | "bom" | "prep"; componentId: string; quantity: number; }[]; isContainer: number; categoryId?: string | undefined; } | null> {
const parsed = bomAddComponentRequestSchema.parse(payload);
const tenantId = getTenantIdOrDefault();
const bom = await db
  .select({ id: bomItems.id, name: bomItems.name })
  .from(bomItems)
  .where(and(eq(bomItems.tenantId, tenantId), eq(bomItems.id, id)))
  .limit(1);
if (bom.length === 0) {
  return null;
}
if (bom[0].name.startsWith('__shadow__')) {
  throw new Error("Cannot modify auto-generated shadow BoM");
}

// Validate component exists
if (parsed.componentType === 'ingredient') {
  const exists = await db
    .select({ id: inventory.id })
    .from(inventory)
    .where(and(eq(inventory.tenantId, tenantId), eq(inventory.id, parsed.componentId)))
    .limit(1);
  if (exists.length === 0) throw new Error(`Ingredient ${parsed.componentId} not found`);
} else {
  const exists = await db
    .select({ id: bomItems.id })
    .from(bomItems)
    .where(and(eq(bomItems.tenantId, tenantId), eq(bomItems.id, parsed.componentId)))
    .limit(1);
  if (exists.length === 0) throw new Error(`BoM ${parsed.componentId} not found`);
}

// Check duplicate
const existing = await db
  .select()
  .from(bomComponents)
  .where(
    and(
      eq(bomComponents.tenantId, tenantId),
      eq(bomComponents.bomId, id),
      eq(bomComponents.componentType, parsed.componentType),
      eq(bomComponents.componentId, parsed.componentId),
    ),
  )
  .limit(1);
if (existing.length > 0) throw new Error(`Component ${parsed.componentType}:${parsed.componentId} already exists in this BoM`);

await db.insert(bomComponents).values({
  tenantId,
  bomId: id,
  componentType: parsed.componentType,
  componentId: parsed.componentId,
  quantity: String(parsed.quantity),
  unit: parsed.unit,
});

return (await this.mapBomItems()).find((item) => item.id === id) ?? null;
  }

  async removeBomComponent(id: string, payload: { componentType: 'ingredient' | 'bom' | 'prep'; componentId: string }): Promise<{ id: string; name: string; unit: string; yieldQuantity: number; isActive: boolean; components: { id: string; unit: string; componentType: "ingredient" | "bom" | "prep"; componentId: string; quantity: number; }[]; isContainer: number; categoryId?: string | undefined; } | null> {
const parsed = bomRemoveComponentRequestSchema.parse(payload);
const tenantId = getTenantIdOrDefault();
const bom = await db
  .select({ id: bomItems.id, name: bomItems.name })
  .from(bomItems)
  .where(and(eq(bomItems.tenantId, tenantId), eq(bomItems.id, id)))
  .limit(1);
if (bom.length === 0) {
  return null;
}
if (bom[0].name.startsWith('__shadow__')) {
  throw new Error("Cannot modify auto-generated shadow BoM");
}

await db
  .delete(bomComponents)
  .where(
    and(
      eq(bomComponents.tenantId, tenantId),
      eq(bomComponents.bomId, id),
      eq(bomComponents.componentType, parsed.componentType),
      eq(bomComponents.componentId, parsed.componentId),
    ),
  );

return (await this.mapBomItems()).find((item) => item.id === id) ?? null;
  }

  async listPrepItems(): Promise<{ id: string; tenantId: string; ingredientId: string | null; bomId: string | null; name: string; quantityPerUnit: number; unit: string; stockQuantity: number; createdAt: string; }[]> {
const tenantId = getTenantIdOrDefault();
const rows = await db
  .select({
    id: prepItems.id,
    tenantId: prepItems.tenantId,
    ingredientId: prepItems.ingredientId,
    bomId: prepItems.bomId,
    name: prepItems.name,
    quantityPerUnit: prepItems.quantityPerUnit,
    unit: prepItems.unit,
    stockQuantity: prepItems.stockQuantity,
    createdAt: prepItems.createdAt,
  })
  .from(prepItems)
  .where(eq(prepItems.tenantId, tenantId))
  .orderBy(prepItems.name);

return rows.map((row) => ({
  id: row.id,
  tenantId: row.tenantId,
  ingredientId: row.ingredientId,
  bomId: row.bomId,
  name: row.name,
  quantityPerUnit: Number(row.quantityPerUnit),
  unit: row.unit,
  stockQuantity: Number(row.stockQuantity),
  createdAt: row.createdAt.toISOString(),
}));
  }

  async createPrepItem(payload: { ingredientId?: string; bomId?: string; name: string; quantityPerUnit: number; unit: string }): Promise<{ id: string; tenantId: string; ingredientId: string | null; bomId: string | null; name: string; quantityPerUnit: number; unit: string; stockQuantity: number; createdAt: string; }> {
const tenantId = getTenantIdOrDefault();
const hasIngredient = !!payload.ingredientId;
const hasBom = !!payload.bomId;
if (hasIngredient === hasBom) {
  throw new Error("Prep item must reference exactly one of an ingredient or a BoM");
}
if (hasBom) {
  const bom = await db
    .select({ id: bomItems.id, name: bomItems.name, isActive: bomItems.isActive })
    .from(bomItems)
    .where(and(eq(bomItems.tenantId, tenantId), eq(bomItems.id, payload.bomId!)))
    .limit(1);
  if (bom.length === 0) throw new Error(`BoM ${payload.bomId} not found`);
  if (bom[0].isActive !== 1) throw new Error(`Cannot create prep item from inactive BoM "${bom[0].name}"`);
}
const id = `prep_${Date.now().toString(36)}`;
await db.insert(prepItems).values({
  id,
  tenantId,
  ingredientId: payload.ingredientId ?? null,
  bomId: payload.bomId ?? null,
  name: payload.name,
  quantityPerUnit: String(payload.quantityPerUnit),
  unit: payload.unit,
});
return (await this.listPrepItems()).find((p) => p.id === id)!;
  }

  async updatePrepItem(id: string, payload: PrepItemUpdateRequest): Promise<{ id: string; tenantId: string; ingredientId: string | null; bomId: string | null; name: string; quantityPerUnit: number; unit: string; stockQuantity: number; createdAt: string; }> {
const tenantId = getTenantIdOrDefault();
const existing = await db.query.prepItems.findFirst({
  where: and(eq(prepItems.tenantId, tenantId), eq(prepItems.id, id)),
});
if (!existing) throw new Error(`Prep item ${id} not found`);
const updates: Record<string, any> = {};
if (payload.name !== undefined) updates.name = payload.name;
if (payload.quantityPerUnit !== undefined) updates.quantityPerUnit = String(payload.quantityPerUnit);
if (payload.unit !== undefined) updates.unit = payload.unit;
if (Object.keys(updates).length > 0) {
  await db.update(prepItems).set(updates).where(and(eq(prepItems.tenantId, tenantId), eq(prepItems.id, id)));
}
return (await this.listPrepItems()).find((p) => p.id === id)!;
  }

  async deletePrepItem(id: string): Promise<void> {
const tenantId = getTenantIdOrDefault();
await db.delete(prepItems).where(and(eq(prepItems.tenantId, tenantId), eq(prepItems.id, id)));
  }

  async preparePrepItem(id: string, quantity: number): Promise<{ prepItemId: string; name: string; previousStock: number; newStock: number; ingredientsDeducted: { name: string; id: string; quantity: number; unit: string; }[]; }> {
if (!Number.isFinite(quantity) || quantity <= 0) {
  throw new Error("Prepared quantity must be a finite positive number");
}
return withTenantTx(async (tx) => {
  const tenantId = getTenantIdOrDefault();
  const prepRows = await tx
    .select()
    .from(prepItems)
    .where(and(eq(prepItems.tenantId, tenantId), eq(prepItems.id, id)))
    .limit(1)
    .for("update");
  const prep = prepRows[0];
  if (!prep) throw new Error(`Prep item ${id} not found`);
  const prevStock = Number(prep.stockQuantity);
  const ingredientsDeducted: { id: string; name: string; quantity: number; unit: string; }[] = [];

  if (prep.bomId) {
    // BoM-based variant: explode the recipe and deduct every raw ingredient
    // (and any nested prep stock) in the same transaction, then add the
    // finished units to this prep item's stock.
    const [bomRows, componentRows] = await Promise.all([
      // All tenant BoMs: explodeBomRequirements recurses into nested `bom`
      // components, so the lookup map must contain every BoM in the tenant.
      tx.select().from(bomItems).where(eq(bomItems.tenantId, tenantId)),
      tx.select().from(bomComponents).where(eq(bomComponents.tenantId, tenantId)),
    ]);
    const bom = bomRows.find((row) => row.id === prep.bomId);
    if (!bom) throw new Error(`BoM ${prep.bomId} not found for prep item ${prep.name}`);
    const bomById = new Map(bomRows.map((row) => [row.id, row]));
    const componentsByBomId = new Map<string, typeof componentRows>();
    for (const component of componentRows) {
      const existing = componentsByBomId.get(component.bomId) ?? [];
      existing.push(component);
      componentsByBomId.set(component.bomId, existing);
    }
    const exploded = this.explodeBomRequirements({
      bomId: bom.id,
      multiplier: quantity * Number(prep.quantityPerUnit || 1),
      bomById,
      componentsByBomId,
    });

    const prepNameById = new Map(
      (await tx.select({ id: prepItems.id, name: prepItems.name, unit: prepItems.unit })
        .from(prepItems)
        .where(eq(prepItems.tenantId, tenantId)))
        .map((row) => [row.id, row]),
    );

    const ingredientIds = [...exploded.ingredients.keys()];
    const ingredientRows = ingredientIds.length > 0
      ? await tx.select().from(inventory).where(and(eq(inventory.tenantId, tenantId), inArray(inventory.id, ingredientIds))).for("update")
      : [];
    const ingredientById = new Map(ingredientRows.map((row) => [row.id, row]));
    for (const [ingredientId, needed] of exploded.ingredients) {
      const ing = ingredientById.get(ingredientId);
      if (!ing) throw new Error(`Ingredient ${ingredientId} not found`);
      const prevQty = Number(ing.quantity);
      if (prevQty < needed) {
        throw new Error(`Insufficient ${ing.name}: need ${needed} ${ing.unit}, have ${prevQty}`);
      }
      const newQty = prevQty - needed;
      await tx.update(inventory).set({ quantity: String(newQty) }).where(and(eq(inventory.tenantId, tenantId), eq(inventory.id, ing.id)));
      await tx.insert(stockMovements).values({
        id: crypto.randomUUID(),
        tenantId,
        ingredientId: ing.id,
        orderId: null,
        movementType: "manual_adjustment",
        quantity: String(-needed),
        previousQuantity: String(prevQty),
        newQuantity: String(newQty),
        notes: `Prepared ${quantity} ${prep.name}`,
        staffId: null,
      });
      ingredientsDeducted.push({ id: ing.id, name: ing.name, quantity: needed, unit: ing.unit });
    }

    for (const [nestedPrepId, needed] of exploded.preps) {
      if (nestedPrepId === prep.id) {
        throw new Error(`BoM "${bom.name}" references its own prep item — cycle not allowed`);
      }
      const nested = prepNameById.get(nestedPrepId);
      if (!nested) throw new Error(`Prep item ${nestedPrepId} not found`);
      const nestedRows = await tx
        .select()
        .from(prepItems)
        .where(and(eq(prepItems.tenantId, tenantId), eq(prepItems.id, nestedPrepId)))
        .limit(1)
        .for("update");
      const nestedPrep = nestedRows[0];
      if (!nestedPrep) throw new Error(`Prep item ${nestedPrepId} not found`);
      const prevNested = Number(nestedPrep.stockQuantity);
      if (prevNested < needed) {
        throw new Error(`Insufficient ${nested.name}: need ${needed} ${nested.unit}, have ${prevNested}`);
      }
      const newNested = prevNested - needed;
      await tx.update(prepItems).set({ stockQuantity: String(newNested) }).where(and(eq(prepItems.tenantId, tenantId), eq(prepItems.id, nestedPrepId)));
      await tx.insert(stockMovements).values({
        id: crypto.randomUUID(),
        tenantId,
        ingredientId: null,
        prepItemId: nestedPrepId,
        orderId: null,
        movementType: "manual_adjustment",
        quantity: String(-needed),
        previousQuantity: String(prevNested),
        newQuantity: String(newNested),
        notes: `Prepared ${quantity} ${prep.name}`,
        staffId: null,
      });
      ingredientsDeducted.push({ id: nestedPrepId, name: nested.name, quantity: needed, unit: nested.unit });
    }
  } else {
    if (!prep.ingredientId) throw new Error(`Prep item ${prep.name} has no ingredient source`);
    const ingredientRows = await tx
      .select()
      .from(inventory)
      .where(and(eq(inventory.tenantId, tenantId), eq(inventory.id, prep.ingredientId)))
      .limit(1)
      .for("update");
    const ing = ingredientRows[0];
    if (!ing) throw new Error(`Ingredient ${prep.ingredientId} not found`);
    const rawNeeded = Number(prep.quantityPerUnit) * quantity;
    const prevIngQty = Number(ing.quantity);
    if (prevIngQty < rawNeeded) {
      throw new Error(`Insufficient ${ing.name}: need ${rawNeeded} ${ing.unit}, have ${prevIngQty}`);
    }
    const newIngQty = prevIngQty - rawNeeded;
    await tx.update(inventory).set({ quantity: String(newIngQty) }).where(and(eq(inventory.tenantId, tenantId), eq(inventory.id, ing.id)));
    await tx.insert(stockMovements).values({
      id: crypto.randomUUID(),
      tenantId,
      ingredientId: ing.id,
      orderId: null,
      movementType: "manual_adjustment",
      quantity: String(-rawNeeded),
      previousQuantity: String(prevIngQty),
      newQuantity: String(newIngQty),
      notes: `Prepared ${quantity} ${prep.name}`,
      staffId: null,
    });
    ingredientsDeducted.push({ id: ing.id, name: ing.name, quantity: rawNeeded, unit: ing.unit });
  }

  const newStock = prevStock + quantity;
  await tx.update(prepItems).set({ stockQuantity: String(newStock) }).where(and(eq(prepItems.tenantId, tenantId), eq(prepItems.id, id)));
  return {
    name: prep.name,
    prepItemId: prep.id,
    previousStock: prevStock,
    newStock,
    ingredientsDeducted,
  }; /* CASCADE2_PREP_PREPITEM_RETURN_DONE */
});
  }

  async listUnitConversions(inventoryId: string): Promise<{ id: string; tenantId: string; inventoryId: string; fromUnit: string; toUnit: string; factor: number; createdAt: string; }[]> {
const tenantId = getTenantIdOrDefault();
const rows = await db
  .select()
  .from(inventoryUnitConversions)
  .where(and(eq(inventoryUnitConversions.tenantId, tenantId), eq(inventoryUnitConversions.inventoryId, inventoryId)));
return rows.map((r) => ({
  id: r.id,
  tenantId: r.tenantId,
  inventoryId: r.inventoryId,
  fromUnit: r.fromUnit,
  toUnit: r.toUnit,
  factor: Number(r.factor),
  createdAt: r.createdAt.toISOString(),
}));
  }

  async createUnitConversion(inventoryId: string, payload: UnitConversionCreateRequest): Promise<{ id: string; tenantId: string; inventoryId: string; fromUnit: string; toUnit: string; factor: number; createdAt: string; }> {
const tenantId = getTenantIdOrDefault();
// Guard against the (tenantId, inventoryId, fromUnit) unique constraint so
// the caller gets a clear Italian message instead of a raw Postgres 23505.
const existing = await db
  .select({ id: inventoryUnitConversions.id })
  .from(inventoryUnitConversions)
  .where(
    and(
      eq(inventoryUnitConversions.tenantId, tenantId),
      eq(inventoryUnitConversions.inventoryId, inventoryId),
      eq(inventoryUnitConversions.fromUnit, payload.fromUnit),
    ),
  )
  .limit(1);
if (existing.length > 0) {
  throw new Error(`Esiste già una conversione per "${payload.fromUnit}"`);
}
const id = `uc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
try {
  await db.insert(inventoryUnitConversions).values({
    id,
    tenantId,
    inventoryId,
    fromUnit: payload.fromUnit,
    toUnit: payload.toUnit,
    factor: String(payload.factor),
  });
} catch (error) {
  // TOCTOU fallback: two concurrent requests may both pass the pre-check
  // above; the partial unique index then rejects the loser with 23505.
  // Map it to the same friendly Italian message instead of leaking Postgres.
  const code = typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code)
    : "";
  if (code === "23505") {
    throw new Error(`Esiste già una conversione per "${payload.fromUnit}"`);
  }
  throw error;
}
return (await this.listUnitConversions(inventoryId)).find((c) => c.id === id)!;
  }

  async deleteUnitConversion(inventoryId: string, conversionId: string): Promise<boolean> {
const tenantId = getTenantIdOrDefault();
const result = await db
  .delete(inventoryUnitConversions)
  .where(
    and(
      eq(inventoryUnitConversions.tenantId, tenantId),
      eq(inventoryUnitConversions.inventoryId, inventoryId),
      eq(inventoryUnitConversions.id, conversionId),
    ),
  );
return (result.rowCount ?? 0) > 0;
  }

  async listCategories(scope?: Category["scope"]): Promise<{ id: string; name: string; scope: "ingredient" | "bom" | "menu"; isActive: boolean; printAreas: ("kitchen" | "bar" | "cashier")[]; createdAt: string; updatedAt: string; }[]> {
const tenantId = getTenantIdOrDefault();
const rows = scope
  ? await db
      .select()
      .from(categories)
      .where(and(eq(categories.tenantId, tenantId), eq(categories.scope, scope)))
      .orderBy(categories.name)
  : await db.select().from(categories).where(eq(categories.tenantId, tenantId)).orderBy(categories.name);
return categoriesListResponseSchema.parse(rows.map((row) => this.mapCategoryRow(row)));
  }

  async createCategory(payload: CategoryCreateRequest): Promise<{ id: string; name: string; scope: "ingredient" | "bom" | "menu"; isActive: boolean; printAreas: ("kitchen" | "bar" | "cashier")[]; createdAt: string; updatedAt: string; }> {
const parsed = categoryCreateRequestSchema.parse(payload);
const tenantId = getTenantIdOrDefault();
const id = `cat_${Date.now().toString(36)}`;
const inserted = await db
  .insert(categories)
  .values({
    id,
    tenantId,
    name: parsed.name.trim(),
    scope: parsed.scope,
    printAreas: JSON.stringify(parsed.printAreas),
    isActive: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  })
  .returning();

return this.mapCategoryRow(inserted[0]);
  }

  async updateCategory(id: string, payload: CategoryUpdateRequest): Promise<{ id: string; name: string; scope: "ingredient" | "bom" | "menu"; isActive: boolean; printAreas: ("kitchen" | "bar" | "cashier")[]; createdAt: string; updatedAt: string; } | null> {
const parsed = categoryUpdateRequestSchema.parse(payload);
const tenantId = getTenantIdOrDefault();
const updated = await db
  .update(categories)
  .set({
    ...(parsed.name ? { name: parsed.name.trim() } : {}),
    ...(parsed.isActive !== undefined ? { isActive: parsed.isActive ? 1 : 0 } : {}),
    ...(parsed.printAreas ? { printAreas: JSON.stringify(parsed.printAreas) } : {}),
    updatedAt: new Date(),
  })
  .where(and(eq(categories.tenantId, tenantId), eq(categories.id, id)))
  .returning();

if (updated.length === 0) {
  return null;
}

return this.mapCategoryRow(updated[0]);
  }

  async deleteCategory(id: string): Promise<boolean> {
const tenantId = getTenantIdOrDefault();
const existing = await db
  .select({ id: categories.id, scope: categories.scope })
  .from(categories)
  .where(and(eq(categories.tenantId, tenantId), eq(categories.id, id)))
  .limit(1);
if (existing.length === 0) {
  return false;
}

const inventoryUsage = await db
  .select({ id: inventory.id })
  .from(inventory)
  .where(and(eq(inventory.tenantId, tenantId), eq(inventory.categoryId, id)))
  .limit(1);
if (inventoryUsage.length > 0) {
  throw new Error("Cannot delete category linked to inventory items");
}

const bomUsage = await db
  .select({ id: bomItems.id })
  .from(bomItems)
  .where(and(eq(bomItems.tenantId, tenantId), eq(bomItems.categoryId, id)))
  .limit(1);
if (bomUsage.length > 0) {
  throw new Error("Cannot delete category linked to BoM items");
}

const menuUsage = await db
  .select({ id: menuItems.id })
  .from(menuItems)
  .where(and(eq(menuItems.tenantId, tenantId), eq(menuItems.categoryId, id)))
  .limit(1);
if (menuUsage.length > 0) {
  throw new Error("Cannot delete category linked to menu items");
}

await db
  .delete(categories)
  .where(and(eq(categories.tenantId, tenantId), eq(categories.id, id)));
return true;
  }

  async listCategoryModifierPools(categoryId?: string): Promise<{ id: string; options: { id: string; sortOrder: number; priceDelta: number; name?: string | undefined; inventoryItemId?: string | undefined; }[]; categoryIds: string[]; name: string; sortOrder: number; categoryId?: string | undefined; }[]> {
const tenantId = getTenantIdOrDefault();
const conditions: SQL[] = [eq(categoryModifierPools.tenantId, tenantId)];

const groupRows = await db
  .select()
  .from(categoryModifierPools)
  .where(and(...conditions))
  .orderBy(asc(categoryModifierPools.sortOrder));

if (groupRows.length === 0) return [];

const [optionRows, categoryRows] = await Promise.all([
  db.select().from(categoryModifierPoolOptions).where(eq(categoryModifierPoolOptions.tenantId, tenantId)),
  db.select().from(categoryModifierPoolCategories).where(eq(categoryModifierPoolCategories.tenantId, tenantId)),
]);

const optionsByPoolId = new Map<string, CategoryModifierPool["options"]>();
for (const opt of optionRows) {
  const existing = optionsByPoolId.get(opt.poolId) ?? [];
  existing.push({
    id: opt.id,
    name: opt.name ?? undefined,
    inventoryItemId: opt.inventoryItemId ?? undefined,
    priceDelta: Number(opt.priceDelta),
    sortOrder: opt.sortOrder ?? 0,
  });
  optionsByPoolId.set(opt.poolId, existing);
}

const categoriesByPoolId = new Map<string, string[]>();
for (const cat of categoryRows) {
  const existing = categoriesByPoolId.get(cat.poolId) ?? [];
  existing.push(cat.categoryId);
  categoriesByPoolId.set(cat.poolId, existing);
}

let pools = groupRows.map((row) => {
  const poolCategoryIds = categoriesByPoolId.get(row.id) ?? [];
  return {
    id: row.id,
    categoryId: row.categoryId ?? undefined,
    categoryIds: poolCategoryIds,
    name: row.name,
    sortOrder: row.sortOrder ?? 0,
    options: optionsByPoolId.get(row.id) ?? [],
  };
});

if (categoryId) {
  pools = pools.filter((p) => p.categoryIds.includes(categoryId));
}

return pools;
  }

  async createCategoryModifierPool(payload: CategoryModifierPoolCreateRequest): Promise<{ id: string; options: { id: string; sortOrder: number; priceDelta: number; name?: string | undefined; inventoryItemId?: string | undefined; }[]; categoryIds: string[]; name: string; sortOrder: number; categoryId?: string | undefined; }> {
const tenantId = getTenantIdOrDefault();
const poolId = `cmp_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;

await db.insert(categoryModifierPools).values({
  id: poolId,
  tenantId,
  categoryId: payload.categoryIds[0] ?? null,
  name: payload.name,
});

if (payload.categoryIds.length > 0) {
  await db.insert(categoryModifierPoolCategories).values(
    payload.categoryIds.map((catId) => ({
      id: `cmpc_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`,
      tenantId,
      poolId,
      categoryId: catId,
    })),
  );
}

if (payload.options.length > 0) {
  await db.insert(categoryModifierPoolOptions).values(
    payload.options.map((opt, idx) => ({
      id: `cmpo_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`,
      tenantId,
      poolId,
      name: opt.name ?? null,
      inventoryItemId: opt.inventoryItemId ?? null,
      priceDelta: String(opt.priceDelta),
      sortOrder: idx,
    })),
  );
}

const pools = await this.listCategoryModifierPools();
return pools.find((p) => p.id === poolId)!;
  }

  async updateCategoryModifierPool(id: string, payload: CategoryModifierPoolUpdateRequest): Promise<{ id: string; options: { id: string; sortOrder: number; priceDelta: number; name?: string | undefined; inventoryItemId?: string | undefined; }[]; categoryIds: string[]; name: string; sortOrder: number; categoryId?: string | undefined; } | null> {
const tenantId = getTenantIdOrDefault();

if (payload.name !== undefined) {
  await db
    .update(categoryModifierPools)
    .set({ name: payload.name })
    .where(and(eq(categoryModifierPools.tenantId, tenantId), eq(categoryModifierPools.id, id)));
}

if (payload.categoryIds !== undefined) {
  await db
    .delete(categoryModifierPoolCategories)
    .where(and(eq(categoryModifierPoolCategories.tenantId, tenantId), eq(categoryModifierPoolCategories.poolId, id)));

  if (payload.categoryIds.length > 0) {
    await db.insert(categoryModifierPoolCategories).values(
      payload.categoryIds.map((catId) => ({
        id: `cmpc_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`,
        tenantId,
        poolId: id,
        categoryId: catId,
      })),
    );
  }
}

if (payload.options !== undefined) {
  await db
    .delete(categoryModifierPoolOptions)
    .where(and(eq(categoryModifierPoolOptions.tenantId, tenantId), eq(categoryModifierPoolOptions.poolId, id)));

  if (payload.options.length > 0) {
    await db.insert(categoryModifierPoolOptions).values(
      payload.options.map((opt, idx) => ({
        id: `cmpo_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`,
        tenantId,
        poolId: id,
        name: opt.name ?? null,
        inventoryItemId: opt.inventoryItemId ?? null,
        priceDelta: String(opt.priceDelta),
        sortOrder: idx,
      })),
    );
  }
}

const pools = await this.listCategoryModifierPools();
return pools.find((p) => p.id === id) ?? null;
  }

  async deleteCategoryModifierPool(id: string): Promise<boolean> {
const tenantId = getTenantIdOrDefault();
await db
  .delete(categoryModifierPoolOptions)
  .where(and(eq(categoryModifierPoolOptions.tenantId, tenantId), eq(categoryModifierPoolOptions.poolId, id)));
await db
  .delete(categoryModifierPoolCategories)
  .where(and(eq(categoryModifierPoolCategories.tenantId, tenantId), eq(categoryModifierPoolCategories.poolId, id)));
const result = await db
  .delete(categoryModifierPools)
  .where(and(eq(categoryModifierPools.tenantId, tenantId), eq(categoryModifierPools.id, id)));
return (result.rowCount ?? 0) > 0;
  }

  async listMenuItemsAdmin(): Promise<{ id: string; name: string; price: number; category: string; printAreas: ("kitchen" | "bar" | "cashier")[]; isActive: boolean; recipe: { componentType: "ingredient" | "bom" | "prep"; componentId: string; quantity: number; unit: string; componentName?: string | undefined; }[]; modifiers: { id: string; inventoryItemId: string; priceDelta: number; name?: string | undefined; effectivePrice?: number | undefined; }[]; modifierGroups: { id: string; name: string; options: { id: string; name: string; isActive: boolean; priceDelta: number; sortOrder: number; isDefault: boolean; ingredientOverrides: { ingredientId: string; action: "add" | "remove" | "replace"; }[]; inventoryItemId?: string | undefined; bomId?: string | undefined; }[]; required: boolean; minSelections: number; maxSelections: number; sortOrder: number; }[]; categoryId?: string | undefined; defaultContainerId?: string | null | undefined; }[]> {
return this.mapMenuItemsAdmin();
  }

  async createMenuItem(payload: MenuItemCreateRequest): Promise<{ id: string; name: string; price: number; category: string; printAreas: ("kitchen" | "bar" | "cashier")[]; isActive: boolean; recipe: { componentType: "ingredient" | "bom" | "prep"; componentId: string; quantity: number; unit: string; componentName?: string | undefined; }[]; modifiers: { id: string; inventoryItemId: string; priceDelta: number; name?: string | undefined; effectivePrice?: number | undefined; }[]; modifierGroups: { id: string; name: string; options: { id: string; name: string; isActive: boolean; priceDelta: number; sortOrder: number; isDefault: boolean; ingredientOverrides: { ingredientId: string; action: "add" | "remove" | "replace"; }[]; inventoryItemId?: string | undefined; bomId?: string | undefined; }[]; required: boolean; minSelections: number; maxSelections: number; sortOrder: number; }[]; categoryId?: string | undefined; defaultContainerId?: string | null | undefined; }> {
const parsed = menuItemCreateRequestSchema.parse(payload);
const tenantId = getTenantIdOrDefault();
const recipeKeys = new Set<string>();
for (const component of parsed.recipe) {
  const key = `${component.componentType}:${component.componentId}`;
  if (recipeKeys.has(key)) {
    throw new Error(`Duplicate recipe component ${key}`);
  }

  if (component.componentId === "ingredient" || component.componentId === "bom") {
    throw new Error(`Invalid recipe component id ${component.componentId}`);
  }
  recipeKeys.add(key);
}

const ingredientIds = parsed.recipe.filter((item) => item.componentType === "ingredient").map((item) => item.componentId);
const bomIds = parsed.recipe.filter((item) => item.componentType === "bom").map((item) => item.componentId);
const prepIds = parsed.recipe.filter((item) => item.componentType === "prep").map((item) => item.componentId);

if (ingredientIds.length > 0) {
  const rows = await db
    .select({ id: inventory.id })
    .from(inventory)
    .where(and(eq(inventory.tenantId, tenantId), inArray(inventory.id, ingredientIds)));
  if (rows.length !== new Set(ingredientIds).size) {
    const found = new Set(rows.map((row) => row.id));
    const missing = ingredientIds.find((id) => !found.has(id));
    throw new Error(`Ingredient ${missing ?? "unknown"} not found`);
  }
}

if (bomIds.length > 0) {
  const rows = await db
    .select({ id: bomItems.id })
    .from(bomItems)
    .where(and(eq(bomItems.tenantId, tenantId), inArray(bomItems.id, bomIds)));
  if (rows.length !== new Set(bomIds).size) {
    const found = new Set(rows.map((row) => row.id));
    const missing = bomIds.find((id) => !found.has(id));
    throw new Error(`BoM ${missing ?? "unknown"} not found`);
  }
}

if (prepIds.length > 0) {
  const rows = await db
    .select({ id: prepItems.id })
    .from(prepItems)
    .where(and(eq(prepItems.tenantId, tenantId), inArray(prepItems.id, prepIds)));
  if (rows.length !== new Set(prepIds).size) {
    const found = new Set(rows.map((row) => row.id));
    const missing = prepIds.find((id) => !found.has(id));
    throw new Error(`Prep item ${missing ?? "unknown"} not found`);
  }
}

const menuId = `m_${Date.now().toString(36)}`;
await withTenantTx(async (tx) => {
  await tx.insert(menuItems).values({
    id: menuId,
    tenantId,
    name: parsed.name,
    price: String(parsed.price),
    category: parsed.category,
    categoryId: parsed.categoryId ?? null,
    printAreas: JSON.stringify(parsed.printAreas),
    isActive: 1,
  });

  const ingredientComponents = parsed.recipe.filter((item) => item.componentType === "ingredient");
  const bomComponentsPayload = parsed.recipe.filter((item) => item.componentType === "bom");
  const prepComponentsPayload = parsed.recipe.filter((item) => item.componentType === "prep");

  if (ingredientComponents.length > 0) {
    await tx.insert(menuItemIngredients).values(
      ingredientComponents.map((component) => ({
        tenantId,
        menuItemId: menuId,
        ingredientId: component.componentId,
        quantity: String(component.quantity),
        unit: component.unit,
      })),
    );
  }

  if (bomComponentsPayload.length > 0) {
    await tx.insert(menuItemBomRequirements).values(
      bomComponentsPayload.map((component) => ({
        tenantId,
        menuItemId: menuId,
        bomId: component.componentId,
        quantity: String(component.quantity),
        unit: component.unit,
      })),
    );
  }

  if (prepComponentsPayload.length > 0) {
    await tx.insert(menuItemPrepRequirements).values(
      prepComponentsPayload.map((component) => ({
        tenantId,
        menuItemId: menuId,
        prepItemId: component.componentId,
        quantity: String(component.quantity),
      })),
    );
  }

  if (parsed.modifiers && parsed.modifiers.length > 0) {
    await tx.insert(menuItemModifiers).values(
      parsed.modifiers.map((mod, idx) => ({
        id: `mim_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        tenantId,
        menuItemId: menuId,
        inventoryItemId: mod.inventoryItemId,
        priceDelta: String(mod.priceDelta),
        sortOrder: idx,
      })),
    );
  }

  if (parsed.modifierGroups && parsed.modifierGroups.length > 0) {
    for (let groupIdx = 0; groupIdx < parsed.modifierGroups.length; groupIdx++) {
      const group = parsed.modifierGroups[groupIdx];
      const groupId = group.id || `mg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

      await tx.insert(menuModifierGroups).values({
        id: groupId,
        tenantId,
        menuItemId: menuId,
        name: group.name,
        required: group.required ? 1 : 0,
        minSelections: group.minSelections,
        maxSelections: group.maxSelections,
        sortOrder: groupIdx,
      });

      for (let optIdx = 0; optIdx < group.options.length; optIdx++) {
        const opt = group.options[optIdx];
        const optId = opt.id || `mo_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

        await tx.insert(menuModifierOptions).values({
          id: optId,
          tenantId,
          groupId,
          name: opt.name,
          inventoryItemId: opt.inventoryItemId || null,
          priceDelta: String(opt.priceDelta),
          isDefault: opt.isDefault ? 1 : 0,
          isActive: opt.isActive ? 1 : 0,
          sortOrder: optIdx,
        });

        for (const override of opt.ingredientOverrides) {
          await tx.insert(menuModifierOptionOverrides).values({
            id: `moo_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
            tenantId,
            optionId: optId,
            ingredientId: override.ingredientId,
            action: override.action,
          });
        }
      }
    }
  }

  await this.syncShadowBoM(tx, tenantId, menuId, parsed.recipe, parsed.categoryId ?? null);
});

const created = (await this.mapMenuItemsAdmin()).find((item) => item.id === menuId);
if (!created) {
  throw new Error("Failed to create menu item");
}

return created;
  }

  async updateMenuItem(id: string, payload: MenuItemUpdateRequest): Promise<{ id: string; name: string; price: number; category: string; printAreas: ("kitchen" | "bar" | "cashier")[]; isActive: boolean; recipe: { componentType: "ingredient" | "bom" | "prep"; componentId: string; quantity: number; unit: string; componentName?: string | undefined; }[]; modifiers: { id: string; inventoryItemId: string; priceDelta: number; name?: string | undefined; effectivePrice?: number | undefined; }[]; modifierGroups: { id: string; name: string; options: { id: string; name: string; isActive: boolean; priceDelta: number; sortOrder: number; isDefault: boolean; ingredientOverrides: { ingredientId: string; action: "add" | "remove" | "replace"; }[]; inventoryItemId?: string | undefined; bomId?: string | undefined; }[]; required: boolean; minSelections: number; maxSelections: number; sortOrder: number; }[]; categoryId?: string | undefined; defaultContainerId?: string | null | undefined; } | null> {
const parsed = menuItemUpdateRequestSchema.parse(payload);
const tenantId = getTenantIdOrDefault();

const updated = await db
  .update(menuItems)
  .set({
    ...(parsed.name ? { name: parsed.name } : {}),
    ...(parsed.category ? { category: parsed.category } : {}),
    ...(parsed.categoryId !== undefined ? { categoryId: parsed.categoryId } : {}),
    ...(parsed.defaultContainerId !== undefined ? { defaultContainerId: parsed.defaultContainerId } : {}),
    ...(parsed.printAreas ? { printAreas: JSON.stringify(parsed.printAreas) } : {}),
    ...(parsed.price !== undefined ? { price: String(parsed.price) } : {}),
  })
  .where(and(eq(menuItems.tenantId, tenantId), eq(menuItems.id, id)))
  .returning({ id: menuItems.id });

if (updated.length === 0) {
  return null;
}

if (parsed.modifiers) {
  await withTenantTx(async (tx) => {
    await tx.delete(menuItemModifiers).where(
      and(eq(menuItemModifiers.tenantId, tenantId), eq(menuItemModifiers.menuItemId, id)),
    );
    for (let idx = 0; idx < parsed.modifiers!.length; idx++) {
      const mod = parsed.modifiers![idx];
      await tx.insert(menuItemModifiers).values({
        id: `mim_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        tenantId,
        menuItemId: id,
        inventoryItemId: mod.inventoryItemId,
        priceDelta: String(mod.priceDelta),
        sortOrder: idx,
      });
    }
  });
}

if (parsed.modifierGroups !== undefined) {
  await withTenantTx(async (tx) => {
    // Elimina tutti i modifier groups esistenti per questo menu item
    const existingGroups = await tx
      .select({ id: menuModifierGroups.id })
      .from(menuModifierGroups)
      .where(and(eq(menuModifierGroups.tenantId, tenantId), eq(menuModifierGroups.menuItemId, id)));

    for (const group of existingGroups) {
      // Elimina overrides delle opzioni
      const options = await tx
        .select({ id: menuModifierOptions.id })
        .from(menuModifierOptions)
        .where(eq(menuModifierOptions.groupId, group.id));

      for (const opt of options) {
        await tx
          .delete(menuModifierOptionOverrides)
          .where(eq(menuModifierOptionOverrides.optionId, opt.id));
      }

      // Elimina opzioni
      await tx.delete(menuModifierOptions).where(eq(menuModifierOptions.groupId, group.id));
    }

    // Elimina gruppi
    await tx
      .delete(menuModifierGroups)
      .where(and(eq(menuModifierGroups.tenantId, tenantId), eq(menuModifierGroups.menuItemId, id)));

    // Inserisci nuovi gruppi
    for (let groupIdx = 0; groupIdx < parsed.modifierGroups!.length; groupIdx++) {
      const group = parsed.modifierGroups![groupIdx];
      const groupId = group.id || `mg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

      await tx.insert(menuModifierGroups).values({
        id: groupId,
        tenantId,
        menuItemId: id,
        name: group.name,
        required: group.required ? 1 : 0,
        minSelections: group.minSelections,
        maxSelections: group.maxSelections,
        sortOrder: groupIdx,
      });

      // Inserisci opzioni
      for (let optIdx = 0; optIdx < group.options.length; optIdx++) {
        const opt = group.options[optIdx];
        const optId = opt.id || `mo_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

        await tx.insert(menuModifierOptions).values({
          id: optId,
          tenantId,
          groupId,
          name: opt.name,
          inventoryItemId: opt.inventoryItemId || null,
          priceDelta: String(opt.priceDelta),
          isDefault: opt.isDefault ? 1 : 0,
          isActive: opt.isActive ? 1 : 0,
          sortOrder: optIdx,
        });

        // Inserisci overrides
        for (const override of opt.ingredientOverrides) {
          await tx.insert(menuModifierOptionOverrides).values({
            id: `moo_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
            tenantId,
            optionId: optId,
            ingredientId: override.ingredientId,
            action: override.action,
          });
        }
      }
    }
  });
}

return (await this.mapMenuItemsAdmin()).find((item) => item.id === id) ?? null;
  }

  async deleteMenuItem(id: string): Promise<boolean> {
const tenantId = getTenantIdOrDefault();
const existing = await db
  .select({ id: menuItems.id })
  .from(menuItems)
  .where(and(eq(menuItems.tenantId, tenantId), eq(menuItems.id, id)))
  .limit(1);
if (existing.length === 0) {
  return false;
}

await db
  .delete(menuItems)
  .where(and(eq(menuItems.tenantId, tenantId), eq(menuItems.id, id)));

await this.deleteShadowBoM(id);
return true;
  }

  async replaceMenuItemRecipe(id: string, payload: MenuItemReplaceRecipeRequest): Promise<{ id: string; name: string; price: number; category: string; printAreas: ("kitchen" | "bar" | "cashier")[]; isActive: boolean; recipe: { componentType: "ingredient" | "bom" | "prep"; componentId: string; quantity: number; unit: string; componentName?: string | undefined; }[]; modifiers: { id: string; inventoryItemId: string; priceDelta: number; name?: string | undefined; effectivePrice?: number | undefined; }[]; modifierGroups: { id: string; name: string; options: { id: string; name: string; isActive: boolean; priceDelta: number; sortOrder: number; isDefault: boolean; ingredientOverrides: { ingredientId: string; action: "add" | "remove" | "replace"; }[]; inventoryItemId?: string | undefined; bomId?: string | undefined; }[]; required: boolean; minSelections: number; maxSelections: number; sortOrder: number; }[]; categoryId?: string | undefined; defaultContainerId?: string | null | undefined; } | null> {
const parsed = menuItemReplaceRecipeRequestSchema.parse(payload);
const tenantId = getTenantIdOrDefault();
const exists = await db
  .select({ id: menuItems.id, categoryId: menuItems.categoryId })
  .from(menuItems)
  .where(and(eq(menuItems.tenantId, tenantId), eq(menuItems.id, id)))
  .limit(1);
if (exists.length === 0) {
  return null;
}
const existingCategoryId = exists[0].categoryId;

const recipeKeys = new Set<string>();
for (const component of parsed.recipe) {
  const key = `${component.componentType}:${component.componentId}`;
  if (recipeKeys.has(key)) {
    throw new Error(`Duplicate recipe component ${key}`);
  }

  if (component.componentId === "ingredient" || component.componentId === "bom") {
    throw new Error(`Invalid recipe component id ${component.componentId}`);
  }
  recipeKeys.add(key);
}

const ingredientIds = parsed.recipe.filter((item) => item.componentType === "ingredient").map((item) => item.componentId);
const bomIds = parsed.recipe.filter((item) => item.componentType === "bom").map((item) => item.componentId);
const prepIds = parsed.recipe.filter((item) => item.componentType === "prep").map((item) => item.componentId);

if (ingredientIds.length > 0) {
  const rows = await db
    .select({ id: inventory.id })
    .from(inventory)
    .where(and(eq(inventory.tenantId, tenantId), inArray(inventory.id, ingredientIds)));
  if (rows.length !== new Set(ingredientIds).size) {
    const found = new Set(rows.map((row) => row.id));
    const missing = ingredientIds.find((entryId) => !found.has(entryId));
    throw new Error(`Ingredient ${missing ?? "unknown"} not found`);
  }
}

if (bomIds.length > 0) {
  const rows = await db
    .select({ id: bomItems.id })
    .from(bomItems)
    .where(and(eq(bomItems.tenantId, tenantId), inArray(bomItems.id, bomIds)));
  if (rows.length !== new Set(bomIds).size) {
    const found = new Set(rows.map((row) => row.id));
    const missing = bomIds.find((entryId) => !found.has(entryId));
    throw new Error(`BoM ${missing ?? "unknown"} not found`);
  }
}

if (prepIds.length > 0) {
  const rows = await db
    .select({ id: prepItems.id })
    .from(prepItems)
    .where(and(eq(prepItems.tenantId, tenantId), inArray(prepItems.id, prepIds)));
  if (rows.length !== new Set(prepIds).size) {
    const found = new Set(rows.map((row) => row.id));
    const missing = prepIds.find((entryId) => !found.has(entryId));
    throw new Error(`Prep item ${missing ?? "unknown"} not found`);
  }
}

await withTenantTx(async (tx) => {
  await tx
    .delete(menuItemIngredients)
    .where(and(eq(menuItemIngredients.tenantId, tenantId), eq(menuItemIngredients.menuItemId, id)));
  await tx
    .delete(menuItemBomRequirements)
    .where(and(eq(menuItemBomRequirements.tenantId, tenantId), eq(menuItemBomRequirements.menuItemId, id)));
  await tx
    .delete(menuItemPrepRequirements)
    .where(and(eq(menuItemPrepRequirements.tenantId, tenantId), eq(menuItemPrepRequirements.menuItemId, id)));

  const ingredientComponents = parsed.recipe.filter((item) => item.componentType === "ingredient");
  const bomComponentsPayload = parsed.recipe.filter((item) => item.componentType === "bom");
  const prepComponentsPayload = parsed.recipe.filter((item) => item.componentType === "prep");

  if (ingredientComponents.length > 0) {
    await tx.insert(menuItemIngredients).values(
      ingredientComponents.map((component) => ({
        tenantId,
        menuItemId: id,
        ingredientId: component.componentId,
        quantity: String(component.quantity),
        unit: component.unit,
      })),
    );
  }

  if (bomComponentsPayload.length > 0) {
    await tx.insert(menuItemBomRequirements).values(
      bomComponentsPayload.map((component) => ({
        tenantId,
        menuItemId: id,
        bomId: component.componentId,
        quantity: String(component.quantity),
        unit: component.unit,
      })),
    );
  }

  if (prepComponentsPayload.length > 0) {
    await tx.insert(menuItemPrepRequirements).values(
      prepComponentsPayload.map((component) => ({
        tenantId,
        menuItemId: id,
        prepItemId: component.componentId,
        quantity: String(component.quantity),
      })),
    );
  }

  await this.syncShadowBoM(tx, tenantId, id, parsed.recipe, existingCategoryId);
});

return (await this.mapMenuItemsAdmin()).find((item) => item.id === id) ?? null;
  }

  async addMenuItemRecipeComponent(id: string, payload: { componentType: 'ingredient' | 'bom' | 'prep'; componentId: string; quantity: number; unit: string }): Promise<{ id: string; name: string; price: number; category: string; printAreas: ("kitchen" | "bar" | "cashier")[]; isActive: boolean; recipe: { componentType: "ingredient" | "bom" | "prep"; componentId: string; quantity: number; unit: string; componentName?: string | undefined; }[]; modifiers: { id: string; inventoryItemId: string; priceDelta: number; name?: string | undefined; effectivePrice?: number | undefined; }[]; modifierGroups: { id: string; name: string; options: { id: string; name: string; isActive: boolean; priceDelta: number; sortOrder: number; isDefault: boolean; ingredientOverrides: { ingredientId: string; action: "add" | "remove" | "replace"; }[]; inventoryItemId?: string | undefined; bomId?: string | undefined; }[]; required: boolean; minSelections: number; maxSelections: number; sortOrder: number; }[]; categoryId?: string | undefined; defaultContainerId?: string | null | undefined; } | null> {
const parsed = menuItemAddRecipeComponentRequestSchema.parse(payload);
const tenantId = getTenantIdOrDefault();
const exists = await db
  .select({ id: menuItems.id })
  .from(menuItems)
  .where(and(eq(menuItems.tenantId, tenantId), eq(menuItems.id, id)))
  .limit(1);
if (exists.length === 0) return null;

if (parsed.componentType === 'ingredient') {
  const row = await db
    .select({ id: inventory.id })
    .from(inventory)
    .where(and(eq(inventory.tenantId, tenantId), eq(inventory.id, parsed.componentId)))
    .limit(1);
  if (row.length === 0) throw new Error(`Ingredient ${parsed.componentId} not found`);
} else if (parsed.componentType === 'bom') {
  const row = await db
    .select({ id: bomItems.id })
    .from(bomItems)
    .where(and(eq(bomItems.tenantId, tenantId), eq(bomItems.id, parsed.componentId)))
    .limit(1);
  if (row.length === 0) throw new Error(`BoM ${parsed.componentId} not found`);
} else {
  const row = await db
    .select({ id: prepItems.id })
    .from(prepItems)
    .where(and(eq(prepItems.tenantId, tenantId), eq(prepItems.id, parsed.componentId)))
    .limit(1);
  if (row.length === 0) throw new Error(`Prep item ${parsed.componentId} not found`);
}

await withTenantTx(async (tx) => {
  if (parsed.componentType === 'ingredient') {
    const existing = await tx
      .select()
      .from(menuItemIngredients)
      .where(and(eq(menuItemIngredients.tenantId, tenantId), eq(menuItemIngredients.menuItemId, id), eq(menuItemIngredients.ingredientId, parsed.componentId)))
      .limit(1);
    if (existing.length > 0) throw new Error(`Ingredient ${parsed.componentId} already in recipe`);
    await tx.insert(menuItemIngredients).values({ tenantId, menuItemId: id, ingredientId: parsed.componentId, quantity: String(parsed.quantity), unit: parsed.unit });
  } else if (parsed.componentType === 'bom') {
    const existing = await tx
      .select()
      .from(menuItemBomRequirements)
      .where(and(eq(menuItemBomRequirements.tenantId, tenantId), eq(menuItemBomRequirements.menuItemId, id), eq(menuItemBomRequirements.bomId, parsed.componentId)))
      .limit(1);
    if (existing.length > 0) throw new Error(`BoM ${parsed.componentId} already in recipe`);
    await tx.insert(menuItemBomRequirements).values({ tenantId, menuItemId: id, bomId: parsed.componentId, quantity: String(parsed.quantity), unit: parsed.unit });
  } else {
    const existing = await tx
      .select()
      .from(menuItemPrepRequirements)
      .where(and(eq(menuItemPrepRequirements.tenantId, tenantId), eq(menuItemPrepRequirements.menuItemId, id), eq(menuItemPrepRequirements.prepItemId, parsed.componentId)))
      .limit(1);
    if (existing.length > 0) throw new Error(`Prep item ${parsed.componentId} already in recipe`);
    await tx.insert(menuItemPrepRequirements).values({ tenantId, menuItemId: id, prepItemId: parsed.componentId, quantity: String(parsed.quantity) });
  }

  const shadowBomId = await this.findShadowBoMId(id);
  if (shadowBomId) {
    const currentRows = await tx
      .select()
      .from(bomComponents)
      .where(and(eq(bomComponents.tenantId, tenantId), eq(bomComponents.bomId, shadowBomId)));
    const recipe = currentRows.map((r) => ({ componentType: r.componentType, componentId: r.componentId, quantity: Number(r.quantity), unit: r.unit }));
    recipe.push({ componentType: parsed.componentType, componentId: parsed.componentId, quantity: parsed.quantity, unit: parsed.unit });
    const menuRow = await tx.select({ categoryId: menuItems.categoryId }).from(menuItems).where(eq(menuItems.id, id)).limit(1);
    await this.syncShadowBoM(tx, tenantId, id, recipe, menuRow[0]?.categoryId ?? null);
  }
});

return (await this.mapMenuItemsAdmin()).find((item) => item.id === id) ?? null;
  }

  async removeMenuItemRecipeComponent(id: string, payload: { componentType: 'ingredient' | 'bom' | 'prep'; componentId: string }): Promise<{ id: string; name: string; price: number; category: string; printAreas: ("kitchen" | "bar" | "cashier")[]; isActive: boolean; recipe: { componentType: "ingredient" | "bom" | "prep"; componentId: string; quantity: number; unit: string; componentName?: string | undefined; }[]; modifiers: { id: string; inventoryItemId: string; priceDelta: number; name?: string | undefined; effectivePrice?: number | undefined; }[]; modifierGroups: { id: string; name: string; options: { id: string; name: string; isActive: boolean; priceDelta: number; sortOrder: number; isDefault: boolean; ingredientOverrides: { ingredientId: string; action: "add" | "remove" | "replace"; }[]; inventoryItemId?: string | undefined; bomId?: string | undefined; }[]; required: boolean; minSelections: number; maxSelections: number; sortOrder: number; }[]; categoryId?: string | undefined; defaultContainerId?: string | null | undefined; } | null> {
const parsed = menuItemRemoveRecipeComponentRequestSchema.parse(payload);
const tenantId = getTenantIdOrDefault();
const exists = await db
  .select({ id: menuItems.id })
  .from(menuItems)
  .where(and(eq(menuItems.tenantId, tenantId), eq(menuItems.id, id)))
  .limit(1);
if (exists.length === 0) return null;

await withTenantTx(async (tx) => {
  if (parsed.componentType === 'ingredient') {
    await tx.delete(menuItemIngredients).where(and(eq(menuItemIngredients.tenantId, tenantId), eq(menuItemIngredients.menuItemId, id), eq(menuItemIngredients.ingredientId, parsed.componentId)));
  } else if (parsed.componentType === 'bom') {
    await tx.delete(menuItemBomRequirements).where(and(eq(menuItemBomRequirements.tenantId, tenantId), eq(menuItemBomRequirements.menuItemId, id), eq(menuItemBomRequirements.bomId, parsed.componentId)));
  } else {
    await tx.delete(menuItemPrepRequirements).where(and(eq(menuItemPrepRequirements.tenantId, tenantId), eq(menuItemPrepRequirements.menuItemId, id), eq(menuItemPrepRequirements.prepItemId, parsed.componentId)));
  }

  const shadowBomId = await this.findShadowBoMId(id);
  if (shadowBomId) {
    const currentRows = await tx
      .select()
      .from(bomComponents)
      .where(and(eq(bomComponents.tenantId, tenantId), eq(bomComponents.bomId, shadowBomId)));
    const recipe = currentRows
      .filter((r) => !(r.componentType === parsed.componentType && r.componentId === parsed.componentId))
      .map((r) => ({ componentType: r.componentType, componentId: r.componentId, quantity: Number(r.quantity), unit: r.unit }));
    const menuRow = await tx.select({ categoryId: menuItems.categoryId }).from(menuItems).where(eq(menuItems.id, id)).limit(1);
    await this.syncShadowBoM(tx, tenantId, id, recipe, menuRow[0]?.categoryId ?? null);
  }
});

return (await this.mapMenuItemsAdmin()).find((item) => item.id === id) ?? null;
  }

  async getFoodCostMatrix(): Promise<{ rows: { menuItemId: string; menuItemName: string; category: string; ingredientId: string; ingredientName: string; quantity: number; unit: string; ingredientCost: number; totalCost: number; menuItemPrice: number; margin: number; marginPercent: number; recommendedPrice: number; status: "ok" | "needs_change"; }[]; summary: { menuItemId: string; menuItemName: string; category: string; totalCost: number; currentPrice: number; recommendedPrice: number; margin: number; marginPercent: number; status: "ok" | "needs_change"; ingredientCount: number; }[]; }> {
const tenantId = getTenantIdOrDefault();

// Fetch all menu items, ingredients, and recipe links in parallel
const [menuRows, ingRows, recipeRows] = await Promise.all([
  db
    .select({
      id: menuItems.id,
      name: menuItems.name,
      category: menuItems.category,
      price: menuItems.price,
      defaultContainerId: menuItems.defaultContainerId,
    })
    .from(menuItems)
    .where(eq(menuItems.tenantId, tenantId)),
  db
    .select({
      id: inventory.id,
      name: inventory.name,
      unitCost: inventory.unitCost,
      unit: inventory.unit,
    })
    .from(inventory)
    .where(eq(inventory.tenantId, tenantId)),
  db
    .select({
      menuItemId: menuItemIngredients.menuItemId,
      ingredientId: menuItemIngredients.ingredientId,
      quantity: menuItemIngredients.quantity,
      unit: menuItemIngredients.unit,
    })
    .from(menuItemIngredients)
    .where(eq(menuItemIngredients.tenantId, tenantId)),
]);

// Fetch container costs
const containerIds = [...new Set(menuRows.map((m) => m.defaultContainerId).filter((id): id is string => Boolean(id)))];
const containerRows = containerIds.length > 0
  ? await db
      .select({ id: inventory.id, name: inventory.name, unitCost: inventory.unitCost })
      .from(inventory)
      .where(and(eq(inventory.tenantId, tenantId), inArray(inventory.id, containerIds)))
  : [];
const containerById = new Map(containerRows.map((c) => [c.id, c]));

// Build lookup maps
const menuById = new Map(menuRows.map((m) => [m.id, m]));
const ingById = new Map(ingRows.map((i) => [i.id, i]));

// Target margin: 66.67% (1/3 food cost)
const TARGET_MARGIN = 0.6667;

// Build matrix rows
const rows: Array<{
  menuItemId: string;
  menuItemName: string;
  category: string;
  ingredientId: string;
  ingredientName: string;
  quantity: number;
  unit: string;
  ingredientCost: number;
  totalCost: number;
  menuItemPrice: number;
  margin: number;
  marginPercent: number;
  recommendedPrice: number;
  status: 'ok' | 'needs_change';
}> = [];

const summaryMap = new Map<string, {
  menuItemId: string;
  menuItemName: string;
  category: string;
  totalCost: number;
  currentPrice: number;
  recommendedPrice: number;
  margin: number;
  marginPercent: number;
  status: 'ok' | 'needs_change';
  ingredientCount: number;
}>();

// Initialize summary for all menu items
for (const menu of menuRows) {
  summaryMap.set(menu.id, {
    menuItemId: menu.id,
    menuItemName: menu.name,
    category: menu.category,
    totalCost: 0,
    currentPrice: toNumeric(menu.price as unknown as string),
    recommendedPrice: 0,
    margin: 0,
    marginPercent: 0,
    status: 'ok',
    ingredientCount: 0,
  });
}

// Add container cost if selected
for (const menu of menuRows) {
  if (menu.defaultContainerId) {
    const container = containerById.get(menu.defaultContainerId);
    if (container) {
      const containerCost = toNumeric(container.unitCost as unknown as string);

      rows.push({
        menuItemId: menu.id,
        menuItemName: menu.name,
        category: menu.category,
        ingredientId: container.id,
        ingredientName: `[Container] ${container.name}`,
        quantity: 1,
        unit: 'pz',
        ingredientCost: containerCost,
        totalCost: containerCost,
        menuItemPrice: toNumeric(menu.price as unknown as string),
        margin: 0,
        marginPercent: 0,
        recommendedPrice: 0,
        status: 'ok',
      });

      const summary = summaryMap.get(menu.id);
      if (summary) {
        summary.totalCost += containerCost;
        summary.ingredientCount++;
      }
    }
  }
}

// Process each recipe link
for (const recipe of recipeRows) {
  const menu = menuById.get(recipe.menuItemId);
  const ing = ingById.get(recipe.ingredientId);
  if (!menu || !ing) continue;

  const qty = toNumeric(recipe.quantity as unknown as string);
  const unitCost = toNumeric(ing.unitCost as unknown as string);
  const menuItemPrice = toNumeric(menu.price as unknown as string);

  // Cost = quantity × unit cost (both in inventory-native units)
  const totalCost = qty * unitCost;

  // Margin calculation
  const margin = menuItemPrice - totalCost;
  const marginPercent = menuItemPrice > 0 ? margin / menuItemPrice : 0;
  const recommendedPrice = marginPercent < TARGET_MARGIN && marginPercent > 0
    ? totalCost / (1 - TARGET_MARGIN)
    : menuItemPrice;

  const status: 'ok' | 'needs_change' = marginPercent >= TARGET_MARGIN ? 'ok' : 'needs_change';

  rows.push({
    menuItemId: recipe.menuItemId,
    menuItemName: menu.name,
    category: menu.category,
    ingredientId: recipe.ingredientId,
    ingredientName: ing.name,
    quantity: qty,
    unit: recipe.unit || ing.unit,
    ingredientCost: unitCost,
    totalCost,
    menuItemPrice,
    margin,
    marginPercent,
    recommendedPrice,
    status,
  });

  // Update summary
  const summary = summaryMap.get(recipe.menuItemId);
  if (summary) {
    summary.totalCost += totalCost;
    summary.ingredientCount++;
  }
}

// Finalize summary
const summary = Array.from(summaryMap.values()).map((s) => {
  const margin = s.currentPrice - s.totalCost;
  const marginPercent = s.currentPrice > 0 ? margin / s.currentPrice : 0;
  const recommendedPrice = marginPercent < TARGET_MARGIN && marginPercent > 0
    ? s.totalCost / (1 - TARGET_MARGIN)
    : s.currentPrice;

  return {
    ...s,
    margin,
    marginPercent,
    recommendedPrice,
    status: marginPercent >= TARGET_MARGIN ? 'ok' as const : 'needs_change' as const,
  };
});

return { rows, summary };
  }

  // ─── Food Cost Matrix mutations ──────────────────────────────────────

  async updateFoodCostMatrixCell(
    menuItemId: string,
    ingredientId: string,
    quantity: number,
    unit: string,
  ): Promise<void> {
    const tenantId = getTenantIdOrDefault();

    // Check if the link exists
    const existing = await db
      .select()
      .from(menuItemIngredients)
      .where(
        and(
          eq(menuItemIngredients.tenantId, tenantId),
          eq(menuItemIngredients.menuItemId, menuItemId),
          eq(menuItemIngredients.ingredientId, ingredientId),
        ),
      )
      .limit(1);

    if (quantity <= 0) {
      // Remove the link if quantity is 0 or negative
      if (existing.length > 0) {
        await db
          .delete(menuItemIngredients)
          .where(
            and(
              eq(menuItemIngredients.tenantId, tenantId),
              eq(menuItemIngredients.menuItemId, menuItemId),
              eq(menuItemIngredients.ingredientId, ingredientId),
            ),
          );
      }
      return;
    }

    if (existing.length > 0) {
      // Update existing link
      await db
        .update(menuItemIngredients)
        .set({ quantity: quantity.toString(), unit })
        .where(
          and(
            eq(menuItemIngredients.tenantId, tenantId),
            eq(menuItemIngredients.menuItemId, menuItemId),
            eq(menuItemIngredients.ingredientId, ingredientId),
          ),
        );
    } else {
      // Create new link
      await db.insert(menuItemIngredients).values({
        tenantId,
        menuItemId,
        ingredientId,
        quantity: quantity.toString(),
        unit,
      });
    }
  }

  /**
   * Bulk import food cost matrix from spreadsheet data.
   * Maps ingredient names to inventory IDs and creates/updates recipe links.
   */
  async importFoodCostMatrix(
    rows: Array<{
      ingredientName: string;
      menuItemName: string;
      quantity: number;
      unit: string;
    }>,
  ): Promise<{ imported: number; skipped: number; errors: string[] }> {
    const tenantId = getTenantIdOrDefault();
    const errors: string[] = [];
    let imported = 0;
    let skipped = 0;

    // Fetch all menu items and inventory for name-to-ID mapping
    const [menuRows, ingRows] = await Promise.all([
      db
        .select({ id: menuItems.id, name: menuItems.name })
        .from(menuItems)
        .where(eq(menuItems.tenantId, tenantId)),
      db
        .select({ id: inventory.id, name: inventory.name })
        .from(inventory)
        .where(eq(inventory.tenantId, tenantId)),
    ]);

    // Build name-to-ID maps (case-insensitive)
    const menuByName = new Map(menuRows.map((m) => [m.name.toLowerCase().trim(), m.id]));
    const ingByName = new Map(ingRows.map((i) => [i.name.toLowerCase().trim(), i.id]));

    // Track processed pairs to prevent duplicates
    const processedPairs = new Set<string>();

    for (const row of rows) {
      const menuItemId = menuByName.get(row.menuItemName.toLowerCase().trim());
      const ingredientId = ingByName.get(row.ingredientName.toLowerCase().trim());

      if (!menuItemId) {
        errors.push(`Menu item not found: "${row.menuItemName}"`);
        skipped++;
        continue;
      }

      if (!ingredientId) {
        errors.push(`Ingredient not found: "${row.ingredientName}"`);
        skipped++;
        continue;
      }

      // Deduplicate: skip if this exact pair was already processed
      const pairKey = `${menuItemId}:${ingredientId}`;
      if (processedPairs.has(pairKey)) {
        errors.push(`Duplicate skipped: "${row.menuItemName}" × "${row.ingredientName}" (already imported)`);
        skipped++;
        continue;
      }
      processedPairs.add(pairKey);

      try {
        await this.updateFoodCostMatrixCell(menuItemId, ingredientId, row.quantity, row.unit);
        imported++;
      } catch (e) {
        errors.push(`Failed to import ${row.menuItemName} × ${row.ingredientName}: ${(e as Error).message}`);
        skipped++;
      }
    }

    return { imported, skipped, errors };
  }

  // ── Fuzzy name matching helpers ──────────────────────────────────────
  private readonly INGREDIENT_ALIASES: Record<string, string> = {
    'hamburgher100': 'Burger 100g',
    'hamburgher180': 'Burger 180g',
    'birbe di polllo': 'Nuggets',
    'chiken': 'Chicken',
    'cotto': 'Prosciutto',
    'bresaola': 'Prosciutto crudo',
    'wrustel grandi': 'Wurstel',
    'wrustel piccoli': 'Wurstel',
    'uovo': 'Albume',
    'pecorinograttugiato': 'Pecorino romano',
    'pecorinofette': 'Pecorino romano',
    'provolaaffumicata': 'Scamorza affumicata',
    'cipollacroccante': 'Anelli di cipolla',
    'cipollacaramellata': 'Cipolla caramellata',
    'cremadizucca': 'Crema di zucca',
    'pulledpork': 'Pulled pork',
    'ciliegino': 'Pomodoro',
  };

  private readonly MENU_ITEM_ALIASES: Record<string, string> = {
    'luglio': 'Luglio Burger',
    'smoky': 'Smoky Burger',
    'pistacchio': 'Pistacchio Burger',
    'agosto': 'Agosto Burger',
    'smash': 'Smash Burger',
    'carbo': 'Carbo Burger',
    'frank': "Frank's",
    'wrap': 'Chicken Wrap',
    'xxl': 'Burro XXL',
    'spicy': 'Spicy Combo',
  };

  private normalizeName(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private fuzzyFind(
    needle: string,
    haystack: Array<{ id: string; name: string }>,
    aliases?: Record<string, string>,
  ): { id: string; name: string } | null {
    const norm = this.normalizeName(needle);
    if (!norm) return null;

    // Manual alias lookup
    const aliasTarget = aliases?.[norm];
    if (aliasTarget) {
      const normAlias = this.normalizeName(aliasTarget);
      const found = haystack.find((i) => this.normalizeName(i.name) === normAlias);
      if (found) return found;
    }

    // 1) exact normalized match
    for (const item of haystack) {
      if (this.normalizeName(item.name) === norm) return item;
    }
    // 2) needle is a prefix of item name (word-boundary safe, ≥3 chars)
    for (const item of haystack) {
      const itemNorm = this.normalizeName(item.name);
      if (norm.length >= 3 && itemNorm.startsWith(norm)) {
        const rest = itemNorm.slice(norm.length);
        if (!rest || rest.startsWith(' ')) return item;
      }
    }
    // 3) word-level overlap (all needle words found in target, ≥3 chars each)
    const needleWords = norm.split(' ').filter((w) => w.length >= 3);
    if (needleWords.length > 0) {
      for (const item of haystack) {
        const itemWords = this.normalizeName(item.name).split(' ').filter(Boolean);
        const hits = needleWords.filter((w) => itemWords.includes(w));
        if (hits.length === needleWords.length) return item;
      }
    }
    return null;
  }

  // ── Full xlsx import (backend parses file) ──────────────────────────
  async importFromXlsx(xlsxBuffer: Buffer): Promise<{
    costsUpdated: number;
    costsSkipped: number;
    recipesImported: number;
    recipesSkipped: number;
    costMatches: Array<{ xlsxName: string; matchedTo: string; unitCost: number }>;
    recipeMatches: Array<{ ingredient: string; menuItem: string; qty: number }>;
    errors: string[];
  }> {
    const tenantId = getTenantIdOrDefault();
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(xlsxBuffer, { type: 'buffer' });

    const errors: string[] = [];
    let costsUpdated = 0;
    let costsSkipped = 0;
    let recipesImported = 0;
    let recipesSkipped = 0;
    const costMatches: Array<{ xlsxName: string; matchedTo: string; unitCost: number }> = [];
    const recipeMatches: Array<{ ingredient: string; menuItem: string; qty: number }> = [];

    // Fetch all existing inventory + menu items
    const [ingRows, menuRows] = await Promise.all([
      db.select({ id: inventory.id, name: inventory.name, unit: inventory.unit })
        .from(inventory).where(eq(inventory.tenantId, tenantId)),
      db.select({ id: menuItems.id, name: menuItems.name, price: menuItems.price })
        .from(menuItems).where(eq(menuItems.tenantId, tenantId)),
    ]);
    const ingList = ingRows.map((i) => ({ id: i.id, name: i.name, unit: i.unit }));
    const menuList = menuRows.map((m) => ({ id: m.id, name: m.name }));

    // Track processed ingredient-menu pairs to prevent duplicates
    const processedPairs = new Set<string>();
    // Track which xlsx names mapped to which DB IDs (for duplicate detection)
    const xlsxNameToDbId = new Map<string, string>();
    // Track which DB ingredient IDs already had their cost updated (prevent overwrite)
    const processedCosts = new Set<string>();

    // Build grams-per-portion lookup from Ingredienti tab
    const gramsPerPortionMap = new Map<string, number>();

    // ── Phase 1: Parse Ingredienti tab → update inventory.unit_cost + build grams lookup ──
    const ingSheet = workbook.Sheets['Ingredienti'];
    if (ingSheet) {
      const data = XLSX.utils.sheet_to_json<unknown[]>(ingSheet, { header: 1, defval: null });

      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const xlsxName = String(row[0] ?? '').trim();
        if (!xlsxName) continue;

        const grams = Number(row[1]) || 0;
        // Column G = correct per-portion cost (already computed in XLSX)
        // Column F = cost+IVA per kg (misleading: actually pack cost for some items)
        // Column E = cost per kg (without IVA)
        // Use column G directly — it's the single source of truth
        const costPerPiece = Number(row[6]) || 0;
        const costPerKg = costPerPiece; // use per-portion cost directly

        // Build grams-per-portion map (normalized key)
        const normName = this.normalizeName(xlsxName);
        if (grams > 0) {
          gramsPerPortionMap.set(normName, grams);
        }

        const matched = this.fuzzyFind(xlsxName, ingList, this.INGREDIENT_ALIASES);
        if (!matched) {
          errors.push(`Ingredient not found: "${xlsxName}"`);
          costsSkipped++;
          continue;
        }

        // Check for ambiguous matches: does another xlsx name also map to the same DB item?
        const existingMapping = xlsxNameToDbId.get(matched.id);
        if (existingMapping && existingMapping !== normName) {
          errors.push(`Ambiguous: "${xlsxName}" and "${existingMapping}" both map to "${matched.name}" — using first`);
        }
        xlsxNameToDbId.set(matched.id, normName);

        // Skip if this DB ingredient already had its cost updated by a previous xlsx row
        if (processedCosts.has(matched.id)) {
          costsSkipped++;
          continue;
        }

        const invUnit = ingList.find((i) => i.id === matched.id)?.unit ?? 'g';

        // Calculate cost in the inventory's native unit
        let unitCost = 0;
        if (invUnit === 'kg' || invUnit === 'L') {
          unitCost = costPerKg;
        } else if (invUnit === 'g') {
          unitCost = costPerKg > 0 ? costPerKg / 1000 : 0;
        } else if (invUnit === 'pz' || invUnit === 'fette' || invUnit === 'pacchi') {
          unitCost = costPerPiece;
        } else {
          unitCost = costPerKg;
        }

        if (unitCost > 0) {
          await db
            .update(inventory)
            .set({ unitCost: unitCost.toFixed(4) })
            .where(and(eq(inventory.id, matched.id), eq(inventory.tenantId, tenantId)));

          costMatches.push({ xlsxName, matchedTo: matched.name, unitCost });
          costsUpdated++;
          processedCosts.add(matched.id);
        } else {
          costsSkipped++;
        }
      }
    }

    // ── Phase 2: Parse recipe tabs → create/update BOM links ────────
    const RECIPE_SHEETS = ['Antipasti', 'Panini', 'Special'];
    for (const sheetName of RECIPE_SHEETS) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;

      const data = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null });
      if (data.length < 2) continue;

      // Row 0: menu item names starting from column B
      const menuNames = (data[0] as unknown[]).slice(1) as string[];

      for (let r = 1; r < data.length; r++) {
        const row = data[r] as unknown[];
        const xlsxIngName = String(row[0] ?? '').trim();
        if (!xlsxIngName) continue;

        const matchedIng = this.fuzzyFind(xlsxIngName, ingList, this.INGREDIENT_ALIASES);
        if (!matchedIng) {
          continue;
        }

        // Determine the unit to store quantity in (match inventory unit)
        const invUnit = ingList.find((i) => i.id === matchedIng.id)?.unit ?? 'g';

        for (let c = 0; c < menuNames.length; c++) {
          const rawQty = row[c + 1];
          if (rawQty == null || rawQty === '' || rawQty === 0) continue;
          const qty = Number(rawQty);
          if (!qty || qty <= 0) continue;

          const xlsxMenuName = String(menuNames[c] ?? '').trim();
          if (!xlsxMenuName) continue;

          const matchedMenu = this.fuzzyFind(xlsxMenuName, menuList, this.MENU_ITEM_ALIASES);
          if (!matchedMenu) {
            errors.push(`Menu item not found: "${xlsxMenuName}"`);
            recipesSkipped++;
            continue;
          }

          // Deduplicate: skip if this exact ingredient-menu pair was already processed
          const pairKey = `${matchedMenu.id}:${matchedIng.id}`;
          if (processedPairs.has(pairKey)) {
            errors.push(`Duplicate skipped: "${matchedIng.name}" × "${matchedMenu.name}" (already imported from another row)`);
            recipesSkipped++;
            continue;
          }
          processedPairs.add(pairKey);

          // Convert quantity: xlsx qty is number of portions; multiply by grams-per-portion
          const gramsPP = gramsPerPortionMap.get(this.normalizeName(xlsxIngName)) ?? 0;
          let storeQty = qty;
          let storeUnit = 'g';
          if (invUnit === 'kg') {
            storeQty = (gramsPP * qty) / 1000;
            storeUnit = 'kg';
          } else if (invUnit === 'pz' || invUnit === 'fette' || invUnit === 'pacchi') {
            storeQty = qty;
            storeUnit = invUnit;
          } else if (invUnit === 'g') {
            storeQty = gramsPP > 0 ? gramsPP * qty : qty;
            storeUnit = 'g';
          } else {
            storeQty = gramsPP > 0 ? gramsPP * qty : qty;
            storeUnit = invUnit;
          }

          try {
            await this.updateFoodCostMatrixCell(matchedMenu.id, matchedIng.id, storeQty, storeUnit);
            recipeMatches.push({ ingredient: matchedIng.name, menuItem: matchedMenu.name, qty: storeQty });
            recipesImported++;
          } catch (e) {
            errors.push(`Failed: ${matchedMenu.name} × ${matchedIng.name}: ${(e as Error).message}`);
            recipesSkipped++;
          }
        }
      }
    }

    return { costsUpdated, costsSkipped, recipesImported, recipesSkipped, costMatches, recipeMatches, errors };
  }

  /**
   * Full food cost import from pre-parsed data (used by frontend).
   */
  async importFoodCostFull(
    ingredientCosts: Array<{ name: string; costPerKg: number; costPerPiece: number; gramsPerPortion: number; piecesPerPortion: number }>,
    recipeRows: Array<{ ingredientName: string; menuItemName: string; quantity: number; unit: string }>,
  ): Promise<{
    costsUpdated: number;
    recipesImported: number;
    recipesSkipped: number;
    errors: string[];
  }> {
    const tenantId = getTenantIdOrDefault();
    const errors: string[] = [];
    let costsUpdated = 0;
    let recipesImported = 0;
    let recipesSkipped = 0;

    // Fetch all existing inventory + menu items for fuzzy matching
    const [ingRows, menuRows] = await Promise.all([
      db.select({ id: inventory.id, name: inventory.name })
        .from(inventory).where(eq(inventory.tenantId, tenantId)),
      db.select({ id: menuItems.id, name: menuItems.name })
        .from(menuItems).where(eq(menuItems.tenantId, tenantId)),
    ]);
    const ingList = ingRows.map((i) => ({ id: i.id, name: i.name }));
    const menuList = menuRows.map((m) => ({ id: m.id, name: m.name }));

    // Track processed pairs to prevent duplicates
    const processedPairs = new Set<string>();
    // Track which DB ingredient IDs already had their cost updated
    const processedCosts = new Set<string>();

    for (const cost of ingredientCosts) {
      const matched = this.fuzzyFind(cost.name, ingList, this.INGREDIENT_ALIASES);
      if (!matched) {
        errors.push(`Ingredient not found: "${cost.name}"`);
        continue;
      }
      if (processedCosts.has(matched.id)) continue;
      let unitCost = 0;
      if (cost.costPerPiece > 0 && cost.piecesPerPortion > 0) {
        unitCost = cost.costPerPiece;
      } else if (cost.costPerKg > 0 && cost.gramsPerPortion > 0) {
        unitCost = (cost.costPerKg / 1000) * cost.gramsPerPortion;
      } else if (cost.costPerPiece > 0) {
        unitCost = cost.costPerPiece;
      } else if (cost.costPerKg > 0) {
        unitCost = cost.costPerKg;
      }
      if (unitCost > 0) {
        await db.update(inventory).set({ unitCost: unitCost.toFixed(4) })
          .where(and(eq(inventory.id, matched.id), eq(inventory.tenantId, tenantId)));
        costsUpdated++;
        processedCosts.add(matched.id);
      }
    }

    for (const row of recipeRows) {
      const matchedIng = this.fuzzyFind(row.ingredientName, ingList, this.INGREDIENT_ALIASES);
      const matchedMenu = this.fuzzyFind(row.menuItemName, menuList, this.MENU_ITEM_ALIASES);
      if (!matchedMenu) { errors.push(`Menu item not found: "${row.menuItemName}"`); recipesSkipped++; continue; }
      if (!matchedIng) { errors.push(`Ingredient not found: "${row.ingredientName}"`); recipesSkipped++; continue; }

      // Deduplicate: skip if this exact ingredient-menu pair was already processed
      const pairKey = `${matchedMenu.id}:${matchedIng.id}`;
      if (processedPairs.has(pairKey)) {
        errors.push(`Duplicate skipped: "${row.ingredientName}" × "${row.menuItemName}" (already imported)`);
        recipesSkipped++;
        continue;
      }
      processedPairs.add(pairKey);

      try {
        await this.updateFoodCostMatrixCell(matchedMenu.id, matchedIng.id, row.quantity, row.unit);
        recipesImported++;
      } catch (e) {
        errors.push(`Failed: ${row.menuItemName} × ${row.ingredientName}: ${(e as Error).message}`);
        recipesSkipped++;
      }
    }

    return { costsUpdated, recipesImported, recipesSkipped, errors };
  }
}

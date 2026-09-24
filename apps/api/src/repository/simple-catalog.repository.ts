import { Injectable } from "@nestjs/common";
import crypto from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, withTenantTx } from "../db/client";
import { menuItems, menuItemComponents } from "../db/schema";
import { getTenantIdOrDefault } from "../tenant/tenant-context.store";
import {
  menuItemUpdateRequestSchema,
  type MenuItemAdmin,
  type MenuItemCreateRequest,
  type MenuItemUpdateRequest,
} from "@gustopos/shared";
import { InventoryRepository } from "./inventory.repository";
import { syncMenuModifierGroups } from "./utils/sync-menu-modifier-groups";

/**
 * simple_catalog data access: catalog CRUD only — no stock, no BoM, no prep.
 *
 * Composition ("Togli" list) IS supported, deliberately narrowed: recipe edges
 * are `componentType="ingredient"` with the free-text ingredient NAME as
 * `componentId` (no inventory row). Display/ticket code resolves the label via
 * `componentId` fallback, so names print everywhere without inventory joins.
 * Prep/BoM components are rejected here: complex mechanics belong to `inventory`.
 */
@Injectable()
export class SimpleCatalogRepository {
  constructor(private readonly inventoryRepo: InventoryRepository) {}

  async setMenuItemActiveState(id: string, active: boolean): Promise<boolean> {
    const tenantId = getTenantIdOrDefault();
    const updated = await db
      .update(menuItems)
      .set({ isActive: active ? 1 : 0 })
      .where(and(eq(menuItems.tenantId, tenantId), eq(menuItems.id, id)))
      .returning({ id: menuItems.id });

    return updated.length > 0;
  }

  async listSimpleCatalogItems(): Promise<MenuItemAdmin[]> {
    const all = await this.inventoryRepo.mapMenuItemsAdmin();
    // Same behaviour as before (only sellable rows), but with recipe /
    // modifierGroups / isActive resolved for the backoffice editor.
    return all.filter((item) => item.isActive);
  }

  async createSimpleCatalogItem(
    payload: Omit<MenuItemCreateRequest, "recipe"> & { recipe?: MenuItemCreateRequest["recipe"] },
  ): Promise<MenuItemAdmin> {
    const tenantId = getTenantIdOrDefault();
    const menuId = `m_${crypto.randomUUID()}`;
    const recipe = payload.recipe ?? [];
    assertIngredientOnly(recipe);

    await withTenantTx(async (tx) => {
      await tx.insert(menuItems).values({
        id: menuId,
        tenantId,
        name: payload.name,
        price: String(payload.price),
        category: payload.category,
        categoryId: payload.categoryId ?? null,
        stationId: payload.stationId ?? null,
        referenceId: payload.referenceId ?? null,
        printAreas: JSON.stringify(payload.printAreas ?? []),
        isActive: 1,
      });

      const edges = dedupeByComponentId(recipe).map((component) => ({
        id: `mic_${crypto.randomUUID()}`,
        tenantId,
        menuItemId: menuId,
        componentType: component.componentType,
        componentId: component.componentId,
        quantity: String(component.quantity),
        unit: component.unit || "pz",
      }));
      if (edges.length > 0) {
        await tx.insert(menuItemComponents).values(edges);
      }

      if (payload.modifierGroups && payload.modifierGroups.length > 0) {
        await syncMenuModifierGroups(tx, tenantId, menuId, payload.modifierGroups);
      }
    });

    const created = (await this.inventoryRepo.mapMenuItemsAdmin()).find((item) => item.id === menuId);
    if (!created) {
      throw new Error("Failed to create simple catalog item");
    }
    return created;
  }

  async updateSimpleCatalogItem(id: string, payload: MenuItemUpdateRequest): Promise<MenuItemAdmin | null> {
    const parsed = menuItemUpdateRequestSchema.parse(payload);
    const tenantId = getTenantIdOrDefault();

    const exists = await db
      .select({ id: menuItems.id })
      .from(menuItems)
      .where(and(eq(menuItems.tenantId, tenantId), eq(menuItems.id, id)))
      .limit(1);
    if (exists.length === 0) {
      return null;
    }

    await withTenantTx(async (tx) => {
      const scalarUpdates: Partial<Record<string, unknown>> = {};
      if (parsed.name !== undefined) scalarUpdates.name = parsed.name;
      if (parsed.category !== undefined) scalarUpdates.category = parsed.category;
      if (parsed.categoryId !== undefined) scalarUpdates.categoryId = parsed.categoryId ?? null;
      if (parsed.stationId !== undefined) scalarUpdates.stationId = parsed.stationId;
      if (parsed.referenceId !== undefined) scalarUpdates.referenceId = parsed.referenceId;
      if (parsed.printAreas !== undefined) scalarUpdates.printAreas = JSON.stringify(parsed.printAreas);
      if (parsed.price !== undefined) scalarUpdates.price = String(parsed.price);
      if (Object.keys(scalarUpdates).length > 0) {
        await tx.update(menuItems).set(scalarUpdates).where(and(eq(menuItems.tenantId, tenantId), eq(menuItems.id, id)));
      }

      // Composition ("Togli"): replace the ingredient-only recipe edges.
      if (parsed.components !== undefined) {
        assertIngredientOnly(parsed.components);
        await tx
          .delete(menuItemComponents)
          .where(and(eq(menuItemComponents.tenantId, tenantId), eq(menuItemComponents.menuItemId, id)));
        const edges = dedupeByComponentId(parsed.components).map((component) => ({
          id: `mic_${crypto.randomUUID()}`,
          tenantId,
          menuItemId: id,
          componentType: component.componentType,
          componentId: component.componentId,
          quantity: String(component.quantity),
          unit: component.unit || "pz",
        }));
        if (edges.length > 0) {
          await tx.insert(menuItemComponents).values(edges);
        }
      }

      if (parsed.modifierGroups !== undefined) {
        await syncMenuModifierGroups(tx, tenantId, id, parsed.modifierGroups);
      }
    });

    return (await this.inventoryRepo.mapMenuItemsAdmin()).find((item) => item.id === id) ?? null;
  }
}

/** simple_catalog supports ingredient-only compositions (no prep/BoM complexity). */
function assertIngredientOnly(
  components: ReadonlyArray<{ componentType: string; componentId: string }>,
): void {
  const invalid = components.filter((component) => component.componentType !== "ingredient");
  if (invalid.length > 0) {
    throw new Error(
      "simple_catalog compositions accept ingredient components only (no prep/BoM)",
    );
  }
  const empty = components.find((component) => !component.componentId.trim());
  if (empty) {
    throw new Error("Composition componentId (ingredient name) cannot be empty");
  }
}

/** The unique edge index is (tenant, item, type, id): last entry wins. */
function dedupeByComponentId<T extends { componentId: string }>(components: readonly T[]): T[] {
  const byId = new Map<string, T>();
  for (const component of components) {
    byId.set(component.componentId, component);
  }
  return [...byId.values()];
}

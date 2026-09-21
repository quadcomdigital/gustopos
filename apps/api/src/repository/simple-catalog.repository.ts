import { Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { db } from "../db/client";
import { menuItems } from "../db/schema";
import { getTenantIdOrDefault } from "../tenant/tenant-context.store";
import {
  menuItemSchema,
  menuItemUpdateRequestSchema,
  type MenuItem,
  type MenuItemCreateRequest,
  type MenuItemUpdateRequest,
} from "@gustopos/shared";
import { parsePrintAreas } from "./app.repository";

@Injectable()
export class SimpleCatalogRepository {
  async setMenuItemActiveState(id: string, active: boolean): Promise<boolean> {
    const tenantId = getTenantIdOrDefault();
    const updated = await db
      .update(menuItems)
      .set({ isActive: active ? 1 : 0 })
      .where(and(eq(menuItems.tenantId, tenantId), eq(menuItems.id, id)))
      .returning({ id: menuItems.id });

    return updated.length > 0;
  }

  async listSimpleCatalogItems(): Promise<MenuItem[]> {
    const tenantId = getTenantIdOrDefault();
    const rows = await db
      .select()
      .from(menuItems)
      .where(and(eq(menuItems.tenantId, tenantId), eq(menuItems.isActive, 1)));

    return rows.map((row) =>
      menuItemSchema.parse({
        id: row.id,
        name: row.name,
        price: Number(row.price),
        category: row.category,
        stationId: row.stationId,
        referenceId: row.referenceId,
        printAreas: parsePrintAreas(row.printAreas),
        ingredients: []
      }),
    );
  }

  async createSimpleCatalogItem(payload: Omit<MenuItemCreateRequest, "recipe"> & { recipe?: unknown }): Promise<MenuItem> {
    const tenantId = getTenantIdOrDefault();
    const menuId = `m_${Date.now().toString(36)}`;

    await db.insert(menuItems).values({
      id: menuId,
      tenantId,
      name: payload.name,
      price: String(payload.price),
      category: payload.category,
      categoryId: payload.categoryId ?? null,
      stationId: payload.stationId ?? null,
      referenceId: payload.referenceId ?? null,
      printAreas: JSON.stringify(payload.printAreas ?? []),
      isActive: 1
    });

    const created = await db
      .select()
      .from(menuItems)
      .where(and(eq(menuItems.tenantId, tenantId), eq(menuItems.id, menuId)))
      .limit(1);

    if (created.length === 0) {
      throw new Error("Failed to create simple catalog item");
    }

    const row = created[0];
    return menuItemSchema.parse({
      id: row.id,
      name: row.name,
      price: Number(row.price),
      category: row.category,
      printAreas: parsePrintAreas(row.printAreas),
      ingredients: []
    });
  }

  async updateSimpleCatalogItem(id: string, payload: MenuItemUpdateRequest): Promise<MenuItem | null> {
    const parsed = menuItemUpdateRequestSchema.parse(payload);
    const tenantId = getTenantIdOrDefault();

    const updated = await db
      .update(menuItems)
      .set({
        ...(parsed.name ? { name: parsed.name } : {}),
        ...(parsed.category ? { category: parsed.category } : {}),
        ...(parsed.categoryId !== undefined ? { categoryId: parsed.categoryId } : {}),
        ...(parsed.stationId !== undefined ? { stationId: parsed.stationId } : {}),
        ...(parsed.referenceId !== undefined ? { referenceId: parsed.referenceId } : {}),
        ...(parsed.printAreas ? { printAreas: JSON.stringify(parsed.printAreas) } : {}),
        ...(parsed.price !== undefined ? { price: String(parsed.price) } : {})
      })
      .where(and(eq(menuItems.tenantId, tenantId), eq(menuItems.id, id)))
      .returning();

    if (updated.length === 0) {
      return null;
    }

    const row = updated[0];
    return menuItemSchema.parse({
      id: row.id,
      name: row.name,
      price: Number(row.price),
      category: row.category,
      printAreas: parsePrintAreas(row.printAreas),
      ingredients: []
    });
  }
}

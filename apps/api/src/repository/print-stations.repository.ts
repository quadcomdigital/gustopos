import { Injectable } from "@nestjs/common";
import { and, asc, eq } from "drizzle-orm";
import { db } from "../db/client";
import { categories, menuItems, printStations } from "../db/schema";
import { getTenantIdOrDefault } from "../tenant/tenant-context.store";
import {
  printStationCreateRequestSchema,
  printStationSchema,
  printStationUpdateRequestSchema,
  type PrintStation,
  type PrintStationCreateRequest,
  type PrintStationUpdateRequest,
} from "@gustopos/shared";

/**
 * Dynamic per-tenant print stations (Cucina, Pizzeria, Bar, …).
 *
 * Station `id` is the opaque routing key used by `print_jobs.area` and by
 * bridge claimed areas/mappings. Assignment is explicit only: a product points
 * to a station via `menu_items.station_id`, a category via
 * `categories.station_id`, and when both are null the tenant default station
 * is used. There is intentionally no name/regex inference.
 */
@Injectable()
export class PrintStationsRepository {
  private toStation(row: typeof printStations.$inferSelect): PrintStation {
    return printStationSchema.parse({
      id: row.id,
      name: row.name,
      kind: row.kind === "cashier" ? "cashier" : "production",
      isDefault: row.isDefault === 1,
      isActive: row.isActive === 1,
      sortOrder: row.sortOrder,
      createdAt: row.createdAt?.toISOString?.() ?? undefined,
      updatedAt: row.updatedAt?.toISOString?.() ?? undefined,
    });
  }

  async listStations(): Promise<PrintStation[]> {
    const tenantId = getTenantIdOrDefault();
    const rows = await db
      .select()
      .from(printStations)
      .where(eq(printStations.tenantId, tenantId))
      .orderBy(asc(printStations.sortOrder), asc(printStations.name));
    return rows.map((row) => this.toStation(row));
  }

  async listActiveStations(): Promise<PrintStation[]> {
    const tenantId = getTenantIdOrDefault();
    const rows = await db
      .select()
      .from(printStations)
      .where(and(eq(printStations.tenantId, tenantId), eq(printStations.isActive, 1)))
      .orderBy(asc(printStations.sortOrder), asc(printStations.name));
    return rows.map((row) => this.toStation(row));
  }

  async getStation(id: string): Promise<PrintStation | null> {
    const tenantId = getTenantIdOrDefault();
    const rows = await db
      .select()
      .from(printStations)
      .where(and(eq(printStations.tenantId, tenantId), eq(printStations.id, id)))
      .limit(1);
    return rows.length > 0 ? this.toStation(rows[0]) : null;
  }

  async getDefaultStation(): Promise<PrintStation | null> {
    const tenantId = getTenantIdOrDefault();
    const rows = await db
      .select()
      .from(printStations)
      .where(and(eq(printStations.tenantId, tenantId), eq(printStations.isDefault, 1)))
      .limit(1);
    if (rows.length === 0) {
      // Defensive: tenants created before stations existed (or with none) get a
      // deterministic Cucina default rather than an implicit kitchen string.
      const fallback = await db
        .select()
        .from(printStations)
        .where(eq(printStations.tenantId, tenantId))
        .orderBy(asc(printStations.sortOrder))
        .limit(1);
      return fallback.length > 0 ? this.toStation(fallback[0]) : null;
    }
    return this.toStation(rows[0]);
  }

  /** id → station lookup for the current tenant (includes inactive stations). */
  async getStationMap(): Promise<Map<string, PrintStation>> {
    const stations = await this.listStations();
    return new Map(stations.map((station) => [station.id, station]));
  }

  async createStation(payload: PrintStationCreateRequest): Promise<PrintStation> {
    const tenantId = getTenantIdOrDefault();
    const parsed = printStationCreateRequestSchema.parse(payload);

    const existing = await this.listStations();
    const makeDefault = parsed.isDefault === true || existing.length === 0;
    const sortOrder = parsed.sortOrder ?? (existing.length > 0 ? Math.max(...existing.map((s) => s.sortOrder)) + 1 : 0);

    const id = `st_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

    await db.transaction(async (tx) => {
      if (makeDefault) {
        await tx
          .update(printStations)
          .set({ isDefault: 0, updatedAt: new Date() })
          .where(eq(printStations.tenantId, tenantId));
      }
      await tx.insert(printStations).values({
        id,
        tenantId,
        name: parsed.name,
        kind: parsed.kind,
        isDefault: makeDefault ? 1 : 0,
        sortOrder,
        isActive: parsed.isActive === false ? 0 : 1,
      });
    });

    const created = await this.getStation(id);
    if (!created) throw new Error("Failed to create print station");
    return created;
  }

  async updateStation(id: string, payload: PrintStationUpdateRequest): Promise<PrintStation | null> {
    const parsed = printStationUpdateRequestSchema.parse(payload);
    const tenantId = getTenantIdOrDefault();

    const target = await this.getStation(id);
    if (!target) return null;

    await db.transaction(async (tx) => {
      if (parsed.isDefault === true) {
        await tx
          .update(printStations)
          .set({ isDefault: 0, updatedAt: new Date() })
          .where(eq(printStations.tenantId, tenantId));
      }
      await tx
        .update(printStations)
        .set({
          ...(parsed.name !== undefined ? { name: parsed.name } : {}),
          ...(parsed.kind !== undefined ? { kind: parsed.kind } : {}),
          ...(parsed.isDefault !== undefined ? { isDefault: parsed.isDefault ? 1 : 0 } : {}),
          ...(parsed.isActive !== undefined ? { isActive: parsed.isActive ? 1 : 0 } : {}),
          ...(parsed.sortOrder !== undefined ? { sortOrder: parsed.sortOrder } : {}),
          updatedAt: new Date(),
        })
        .where(and(eq(printStations.tenantId, tenantId), eq(printStations.id, id)));
    });

    return this.getStation(id);
  }

  /**
   * Removing a station nulls the assignment on dependent products/categories
   * (FK ON DELETE SET NULL) so nothing routes to a dead key. The default
   * station cannot be deleted. Returns false when the station does not exist
   * or is the tenant default.
   */
  async deleteStation(id: string): Promise<boolean> {
    const tenantId = getTenantIdOrDefault();
    const target = await this.getStation(id);
    if (!target || target.isDefault) return false;

    const deleted = await db
      .delete(printStations)
      .where(and(eq(printStations.tenantId, tenantId), eq(printStations.id, id)))
      .returning({ id: printStations.id });

    return deleted.length > 0;
  }

  /** Counts used by the Settings UI to warn before deleting a station. */
  async getStationUsage(id: string): Promise<{ menuItems: number; categories: number }> {
    const tenantId = getTenantIdOrDefault();
    const items = await db
      .select({ id: menuItems.id })
      .from(menuItems)
      .where(and(eq(menuItems.tenantId, tenantId), eq(menuItems.stationId, id)));
    const cats = await db
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.tenantId, tenantId), eq(categories.stationId, id)));
    return { menuItems: items.length, categories: cats.length };
  }
}

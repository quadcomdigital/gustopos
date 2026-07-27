import { Injectable, Logger } from "@nestjs/common";
import type {
  ModuleKey,
  Tenant,
  TenantCreateRequest,
  TenantModule,
  TenantModuleConfig,
  TenantModuleConfigUpsertRequest,
  TenantModuleToggleRequest,
  TenantUpdateRequest,
} from "@gustopos/shared";
import {
  moduleKeySchema,
  tenantCreateRequestSchema,
  tenantModuleConfigUpsertRequestSchema,
  tenantModuleToggleRequestSchema,
  tenantUpdateRequestSchema,
} from "@gustopos/shared";
import { and, eq } from "drizzle-orm";
import crypto from "node:crypto";
import Redis from "ioredis";
import { getRedisUrl } from "../config/redis.config";
import { db } from "../db/client";
import { categories, menuItems, tenantAuditLogs, tenantModuleConfigs, tenantModules, tenants } from "../db/schema";
import { BootstrapTenantService } from "./bootstrap-tenant.service";

const DEFAULT_MODULES: ModuleKey[] = [
  "kitchen",
  "inventory",
  "customers",
  "analytics",
  "printing",
  "public_menu",
  "public_takeaway",
  "consumer_accounts",
  "self_order_qr",
  "public_group_order",
  "loyalty_points",
  "reservations",
  "delivery",
  "purchasing_suppliers",
  "staff_shifts_timeclock",
  "fiscal_exports",
];

const MUTUALLY_EXCLUSIVE_MODULES: Array<[ModuleKey, ModuleKey]> = [["inventory", "simple_catalog"]];
const MODULE_DEPENDENCIES: Array<[ModuleKey, ModuleKey]> = [["loyalty_points", "customers"]];

@Injectable()
export class TenantService {
  private readonly logger = new Logger(TenantService.name);
  private readonly redis = new Redis(getRedisUrl(), { lazyConnect: false });

  constructor(private readonly bootstrapService: BootstrapTenantService) {}

  async onApplicationShutdown(): Promise<void> {
    await this.redis.quit();
  }

  async listTenants(): Promise<Tenant[]> {
    const rows = await db.select().from(tenants);
    return rows.map((row) => this.mapTenant(row));
  }

  async createTenant(payload: TenantCreateRequest): Promise<Tenant> {
    const parsed = tenantCreateRequestSchema.parse(payload);
    const id = `ten_${crypto.randomUUID()}`;
    const resolutionOrder = parsed.resolutionOrder ?? ["subdomain", "slug", "header", "jwt"];
    const now = new Date();

    await db.transaction(async (tx) => {
      await tx.insert(tenants).values({
        id,
        slug: parsed.slug,
        name: parsed.name,
        subdomain: parsed.subdomain ?? null,
        domain: parsed.domain ?? null,
        isActive: 1,
        resolutionOrder: resolutionOrder.join(","),
        createdAt: now,
        updatedAt: now,
      });

      await tx.insert(tenantModules).values(
        DEFAULT_MODULES.map((moduleKey) => ({
          id: `tm_${crypto.randomUUID()}`,
          tenantId: id,
          moduleKey,
          enabled: 1,
          createdAt: now,
          updatedAt: now,
        })),
      );

      await tx.insert(tenantAuditLogs).values({
        id: `tal_${crypto.randomUUID()}`,
        tenantId: id,
        actor: "superadmin",
        event: "tenant.provisioned",
        payload: JSON.stringify({ slug: parsed.slug, modules: DEFAULT_MODULES }),
        createdAt: now,
      });
    });

    // Bootstrap initial operational data (staff, tables, categories)
    await this.bootstrapService.bootstrap(id);

    return (await this.getTenantById(id)) as Tenant;
  }

  async getTenantById(id: string): Promise<Tenant | null> {
    const rows = await db.select().from(tenants).where(eq(tenants.id, id)).limit(1);
    if (rows.length === 0) {
      return null;
    }
    return this.mapTenant(rows[0]);
  }

  async updateTenant(id: string, payload: TenantUpdateRequest): Promise<Tenant | null> {
    const parsed = tenantUpdateRequestSchema.parse(payload);
    const updated = await db
      .update(tenants)
      .set({
        ...(parsed.name !== undefined ? { name: parsed.name } : {}),
        ...(parsed.subdomain !== undefined ? { subdomain: parsed.subdomain } : {}),
        ...(parsed.domain !== undefined ? { domain: parsed.domain } : {}),
        ...(parsed.isActive !== undefined ? { isActive: parsed.isActive ? 1 : 0 } : {}),
        ...(parsed.resolutionOrder !== undefined ? { resolutionOrder: parsed.resolutionOrder.join(",") } : {}),
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, id))
      .returning();

    if (updated.length === 0) {
      return null;
    }

    await db.insert(tenantAuditLogs).values({
      id: `tal_${crypto.randomUUID()}`,
      tenantId: id,
      actor: "superadmin",
      event: "tenant.updated",
      payload: JSON.stringify(parsed),
      createdAt: new Date(),
    });

    return this.mapTenant(updated[0]);
  }

  async listTenantModules(tenantId: string): Promise<TenantModule[]> {
    const rows = await db.select().from(tenantModules).where(eq(tenantModules.tenantId, tenantId));
    return rows.map((row) => ({
      id: row.id,
      tenantId: row.tenantId,
      moduleKey: moduleKeySchema.parse(row.moduleKey),
      enabled: row.enabled === 1,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  async toggleTenantModule(tenantId: string, payload: TenantModuleToggleRequest): Promise<TenantModule> {
    const parsed = tenantModuleToggleRequestSchema.parse(payload);
    const now = new Date();

    const toggledAndDisabled = await db.transaction(async (tx) => {
      const upsertModule = async (moduleKey: ModuleKey, enabled: boolean) => {
        const existing = await tx
          .select()
          .from(tenantModules)
          .where(and(eq(tenantModules.tenantId, tenantId), eq(tenantModules.moduleKey, moduleKey)))
          .limit(1);

        if (existing.length === 0) {
          const created = await tx
            .insert(tenantModules)
            .values({
              id: `tm_${crypto.randomUUID()}`,
              tenantId,
              moduleKey,
              enabled: enabled ? 1 : 0,
              createdAt: now,
              updatedAt: now,
            })
            .returning();
          return created[0];
        }

        const updated = await tx
          .update(tenantModules)
          .set({ enabled: enabled ? 1 : 0, updatedAt: now })
          .where(eq(tenantModules.id, existing[0].id))
          .returning();
        return updated[0];
      };

      const toggled = await upsertModule(parsed.moduleKey, parsed.enabled);
      const disabledModules: ModuleKey[] = [];

      if (parsed.enabled) {
        for (const [first, second] of MUTUALLY_EXCLUSIVE_MODULES) {
          const opposite = parsed.moduleKey === first ? second : parsed.moduleKey === second ? first : null;
          if (opposite) {
            await upsertModule(opposite, false);
            disabledModules.push(opposite);
          }
        }
        for (const [child, parent] of MODULE_DEPENDENCIES) {
          if (parsed.moduleKey === child) {
            const parentExisting = await tx
              .select()
              .from(tenantModules)
              .where(and(eq(tenantModules.tenantId, tenantId), eq(tenantModules.moduleKey, parent)))
              .limit(1);
            if (parentExisting.length === 0 || parentExisting[0].enabled === 0) {
              await upsertModule(parent, true);
            }
          }
        }
      } else {
        for (const [child, parent] of MODULE_DEPENDENCIES) {
          if (parsed.moduleKey === parent) {
            const childExisting = await tx
              .select()
              .from(tenantModules)
              .where(and(eq(tenantModules.tenantId, tenantId), eq(tenantModules.moduleKey, child)))
              .limit(1);
            if (childExisting.length > 0 && childExisting[0].enabled === 1) {
              await upsertModule(child, false);
              disabledModules.push(child);
            }
          }
        }
      }

      return { toggled, disabledModules };
    });

    await this.invalidateModulesCache(tenantId);

    await db.insert(tenantAuditLogs).values({
      id: `tal_${crypto.randomUUID()}`,
      tenantId,
      actor: "superadmin",
      event: "tenant.module.toggled",
      payload: JSON.stringify({ ...parsed, autoDisabledModules: toggledAndDisabled.disabledModules }),
      createdAt: now,
    });

    return {
      id: toggledAndDisabled.toggled.id,
      tenantId: toggledAndDisabled.toggled.tenantId,
      moduleKey: moduleKeySchema.parse(toggledAndDisabled.toggled.moduleKey),
      enabled: toggledAndDisabled.toggled.enabled === 1,
      createdAt: toggledAndDisabled.toggled.createdAt.toISOString(),
      updatedAt: toggledAndDisabled.toggled.updatedAt.toISOString(),
    };
  }

  async upsertTenantModuleConfig(tenantId: string, payload: TenantModuleConfigUpsertRequest): Promise<TenantModuleConfig> {
    const parsed = tenantModuleConfigUpsertRequestSchema.parse(payload);
    const now = new Date();

    const existing = await db
      .select()
      .from(tenantModuleConfigs)
      .where(and(eq(tenantModuleConfigs.tenantId, tenantId), eq(tenantModuleConfigs.moduleKey, parsed.moduleKey)))
      .limit(1);

    let row;
    if (existing.length === 0) {
      const created = await db
        .insert(tenantModuleConfigs)
        .values({
          id: `tmc_${crypto.randomUUID()}`,
          tenantId,
          moduleKey: parsed.moduleKey,
          config: JSON.stringify(parsed.config),
          updatedAt: now,
        })
        .returning();
      row = created[0];
    } else {
      const updated = await db
        .update(tenantModuleConfigs)
        .set({ config: JSON.stringify(parsed.config), updatedAt: now })
        .where(eq(tenantModuleConfigs.id, existing[0].id))
        .returning();
      row = updated[0];
    }

    await db.insert(tenantAuditLogs).values({
      id: `tal_${crypto.randomUUID()}`,
      tenantId,
      actor: "superadmin",
      event: "tenant.module.config.upserted",
      payload: JSON.stringify(parsed),
      createdAt: now,
    });

    return {
      id: row.id,
      tenantId: row.tenantId,
      moduleKey: moduleKeySchema.parse(row.moduleKey),
      config: JSON.parse(row.config),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async getTenantModuleConfig(tenantId: string, moduleKey: ModuleKey): Promise<TenantModuleConfig | null> {
    const rows = await db
      .select()
      .from(tenantModuleConfigs)
      .where(and(eq(tenantModuleConfigs.tenantId, tenantId), eq(tenantModuleConfigs.moduleKey, moduleKey)))
      .limit(1);

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];
    return {
      id: row.id,
      tenantId: row.tenantId,
      moduleKey: moduleKeySchema.parse(row.moduleKey),
      config: JSON.parse(row.config),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async listPublicMenuCatalog(tenantId: string): Promise<{
    categories: Array<{ id: string; name: string; isActive: boolean }>;
    items: Array<{ id: string; name: string; categoryId?: string; category: string; isActive: boolean }>;
  }> {
    const [categoryRows, itemRows] = await Promise.all([
      db
        .select()
        .from(categories)
        .where(and(eq(categories.tenantId, tenantId), eq(categories.scope, "menu"))),
      db.select().from(menuItems).where(eq(menuItems.tenantId, tenantId)),
    ]);

    return {
      categories: categoryRows.map((row) => ({
        id: row.id,
        name: row.name,
        isActive: row.isActive === 1,
      })),
      items: itemRows.map((row) => ({
        id: row.id,
        name: row.name,
        categoryId: row.categoryId ?? undefined,
        category: row.category,
        isActive: row.isActive === 1,
      })),
    };
  }

  async listTenantAuditLogs(limit = 200): Promise<Array<{ id: string; tenantId?: string; actor: string; event: string; payload: unknown; createdAt: string }>> {
    const rows = await db.select().from(tenantAuditLogs).limit(limit);
    return rows.map((row) => ({
      id: row.id,
      tenantId: row.tenantId ?? undefined,
      actor: row.actor,
      event: row.event,
      payload: JSON.parse(row.payload),
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async getEnabledModulesForTenant(tenantId: string): Promise<ModuleKey[]> {
    const cacheKey = `tenant:${tenantId}:modules`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as string[];
        return parsed.map((entry) => moduleKeySchema.parse(entry));
      } catch {
        console.debug(`[tenant] module cache deserialization failed for key ${cacheKey}, refreshing from DB`);
      }
    }

    const rows = await db
      .select({ moduleKey: tenantModules.moduleKey })
      .from(tenantModules)
      .where(and(eq(tenantModules.tenantId, tenantId), eq(tenantModules.enabled, 1)));

    const modules = rows.map((row) => moduleKeySchema.parse(row.moduleKey));
    await this.redis.set(cacheKey, JSON.stringify(modules), "EX", 300);
    return modules;
  }

  async invalidateModulesCache(tenantId: string): Promise<void> {
    await this.redis.del(`tenant:${tenantId}:modules`);
  }

  async resolveTenantBySlug(slug: string): Promise<Tenant | null> {
    const rows = await db.select().from(tenants).where(eq(tenants.slug, slug)).limit(1);
    if (rows.length === 0) {
      return null;
    }

    return this.mapTenant(rows[0]);
  }

  async resolveTenantBySubdomain(subdomain: string): Promise<Tenant | null> {
    const rows = await db.select().from(tenants).where(eq(tenants.subdomain, subdomain)).limit(1);
    if (rows.length === 0) {
      return null;
    }

    return this.mapTenant(rows[0]);
  }

  private mapTenant(row: typeof tenants.$inferSelect): Tenant {
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      subdomain: row.subdomain ?? undefined,
      domain: row.domain ?? undefined,
      isActive: row.isActive === 1,
      resolutionOrder: row.resolutionOrder
        .split(",")
        .map((entry) => entry.trim())
        .filter((entry): entry is "subdomain" | "slug" | "header" | "jwt" =>
          ["subdomain", "slug", "header", "jwt"].includes(entry),
        ),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}

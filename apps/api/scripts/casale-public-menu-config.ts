/**
 * One-off: superadmin-only public_menu config for the casale tenant.
 *
 * `hiddenCategoryIds` is intentionally excluded from publicMenuTenantEditableSchema
 * (tenant backoffice cannot hide categories), so a tenant admin cannot set it via
 * PUT /api/public-menu/config. This script performs the same upsert the superadmin
 * endpoint does (tenant.service upsertTenantModuleConfig), hiding the "Merce"
 * (scope=ingredient) category from the public menu.
 *
 * Usage: DATABASE_URL=... npx tsx scripts/casale-public-menu-config.ts
 */
import crypto from "node:crypto";
import { and, eq } from "drizzle-orm";
import { normalizePublicMenuConfig } from "@gustopos/shared";
import { db } from "../src/db/client";
import { tenantAuditLogs, tenantModuleConfigs, tenants } from "../src/db/schema";

const TENANT_SLUG = "casale";
const HIDDEN_CATEGORY_IDS = [
  // categories.name = 'Merce', scope = 'ingredient' (stock goods, not menu)
  "cat_0ded3e63-ac80-4fe7-939c-b54413499661",
];

async function main() {
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.slug, TENANT_SLUG))
    .limit(1);
  if (!tenant) throw new Error(`tenant '${TENANT_SLUG}' not found`);

  const [existing] = await db
    .select()
    .from(tenantModuleConfigs)
    .where(and(eq(tenantModuleConfigs.tenantId, tenant.id), eq(tenantModuleConfigs.moduleKey, "public_menu")))
    .limit(1);

  // Merge onto the stored config (so any branding already set is preserved).
  const base = existing ? JSON.parse(existing.config) : {};
  const config = normalizePublicMenuConfig({ ...base, hiddenCategoryIds: HIDDEN_CATEGORY_IDS });
  const now = new Date();

  let row;
  if (!existing) {
    const created = await db
      .insert(tenantModuleConfigs)
      .values({
        id: `tmc_${crypto.randomUUID()}`,
        tenantId: tenant.id,
        moduleKey: "public_menu",
        config: JSON.stringify(config),
        updatedAt: now,
      })
      .returning();
    row = created[0];
  } else {
    const updated = await db
      .update(tenantModuleConfigs)
      .set({ config: JSON.stringify(config), updatedAt: now })
      .where(eq(tenantModuleConfigs.id, existing.id))
      .returning();
    row = updated[0];
  }

  await db.insert(tenantAuditLogs).values({
    id: `tal_${crypto.randomUUID()}`,
    tenantId: tenant.id,
    actor: "superadmin",
    event: "tenant.module.config.upserted",
    payload: JSON.stringify({ moduleKey: "public_menu", config }),
    createdAt: now,
  });

  console.log("upserted", row.id, "hiddenCategoryIds =", config.hiddenCategoryIds);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

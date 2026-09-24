/**
 * One-off for tenant "casale": adds the JOLLY product and the MAXI modifier.
 *
 *  JOLLY  — a product in its own category (stazione Pizzeria, hidden from the
 *           public menu) so the POS can compose a "mezza pizza maxi" by
 *           picking up to 2 of the existing pizzas. The group charges
 *           `priceDelta = pizza price / 2` in "sum" mode, so two halves cost
 *           (pA + pB)/2. `is_jolly` opens the POS "Prezzo ad-hoc" field,
 *           which starts at 0 and is added on top of the computed halves.
 *
 *  MAXI   — a single category pool option on "Pizzeria" with priceMultiplier=2:
 *           it doubles whatever pizza it is attached to (base × 2, then
 *           toppings add on top). Because it is a pool, the existing pizzas
 *           AND any future pizza are covered by one option.
 *
 * Idempotent: an existing category / product / group / pool is reused rather
 * than duplicated. Run with --dry-run first.
 *
 * Usage:
 *   DATABASE_URL=... npx tsx scripts/casale-jolly-maxi.ts [--dry-run]
 */
import { and, eq } from "drizzle-orm";
import { db, pool } from "../src/db/client";
import {
  categories,
  menuItems,
  menuModifierGroups,
  menuModifierOptions,
  categoryModifierPools,
  categoryModifierPoolOptions,
  categoryModifierPoolCategories,
  tenantModuleConfigs,
  tenants,
  printStations,
} from "../src/db/schema";

const DRY_RUN = process.argv.includes("--dry-run");
const TENANT_SLUG = "casale";
const PIZZERIA_CATEGORY = "Pizzeria";
const JOLLY_CATEGORY = "JOLLY";
const JOLLY_ITEM = "JOLLY";
const HALF_GROUP = "Le due metà";
const MAXI_POOL = "MAXI";
const MAXI_OPTION = "MAXI";
const MAXI_MULTIPLIER = "2";

const newId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

async function main() {
  const log = (message: string) => console.log(message);

  const tenantRows = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.slug, TENANT_SLUG))
    .limit(1);
  const tenantId = tenantRows[0]?.id;
  if (!tenantId) throw new Error(`tenant "${TENANT_SLUG}" not found`);
  log(`tenant ${tenantId}`);

  const stationRows = await db
    .select({ id: printStations.id })
    .from(printStations)
    .where(and(eq(printStations.tenantId, tenantId), eq(printStations.name, "Pizzeria")))
    .limit(1);
  if (stationRows.length === 0) throw new Error("print station 'Pizzeria' not found");
  const pizzeriaStationId = stationRows[0].id;
  log(`station Pizzeria ${pizzeriaStationId}`);

  // ── pizzas: source of truth for the halves ──────────────────────────────
  const pizzeriaCategoryRows = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.tenantId, tenantId), eq(categories.name, PIZZERIA_CATEGORY)))
    .limit(1);
  const pizzeriaCategoryId = pizzeriaCategoryRows[0]?.id;
  if (!pizzeriaCategoryId) throw new Error(`category "${PIZZERIA_CATEGORY}" not found`);

  const pizzas = await db
    .select({ id: menuItems.id, name: menuItems.name, price: menuItems.price })
    .from(menuItems)
    .where(
      and(
        eq(menuItems.tenantId, tenantId),
        eq(menuItems.categoryId, pizzeriaCategoryId),
        eq(menuItems.isActive, 1),
      ),
    )
    .orderBy(menuItems.name);
  if (pizzas.length === 0) throw new Error("no active pizzas found in Pizzeria");
  log(`${pizzas.length} pizze attive`);

  // ── B1: category JOLLY (own category → hidden online, prints to Pizzeria)
  const existingJollyCategory = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.tenantId, tenantId), eq(categories.name, JOLLY_CATEGORY)))
    .limit(1);

  let jollyCategoryId = existingJollyCategory[0]?.id;
  if (jollyCategoryId) {
    log(`[B1] categoria "${JOLLY_CATEGORY}" già presente: ${jollyCategoryId}`);
  } else if (DRY_RUN) {
    jollyCategoryId = undefined;
    log(`[B1] (dry-run) creerei la categoria "${JOLLY_CATEGORY}" scope=menu, station=Pizzeria`);
  } else {
    jollyCategoryId = newId("cat");
    await db.insert(categories).values({
      id: jollyCategoryId,
      tenantId,
      name: JOLLY_CATEGORY,
      scope: "menu",
      isActive: 1,
      stationId: pizzeriaStationId,
    });
    log(`[B1] categoria "${JOLLY_CATEGORY}" creata → ${jollyCategoryId}`);
  }

  // ── B2: the JOLLY product (price 0, is_jolly = 1 for the ad-hoc field) ──
  const existingJollyItem = await db
    .select({ id: menuItems.id })
    .from(menuItems)
    .where(and(eq(menuItems.tenantId, tenantId), eq(menuItems.name, JOLLY_ITEM)))
    .limit(1);

  let jollyItemId = existingJollyItem[0]?.id;
  if (jollyItemId) {
    log(`[B2] prodotto "${JOLLY_ITEM}" già presente: ${jollyItemId}`);
  } else if (DRY_RUN) {
    log(`[B2] (dry-run) creerei il prodotto "${JOLLY_ITEM}" prezzo 0.00, is_jolly=1`);
  } else {
    if (!jollyCategoryId) throw new Error("JOLLY category is required to create the product");
    jollyItemId = newId("m");
    await db.insert(menuItems).values({
      id: jollyItemId,
      tenantId,
      name: JOLLY_ITEM,
      price: "0.00",
      category: JOLLY_CATEGORY,
      categoryId: jollyCategoryId,
      stationId: pizzeriaStationId,
      printAreas: JSON.stringify(["kitchen"]),
      isActive: 1,
      // Not part of the simple_catalog API contract, so it is written here.
      isJolly: 1,
    });
    log(`[B2] prodotto "${JOLLY_ITEM}" creato → ${jollyItemId}`);
  }

  // ── B3: "Le due metà" group — one option per pizza at price/2, sum, ≤2 ──
  const existingHalfGroups = await db
    .select({ id: menuModifierGroups.id })
    .from(menuModifierGroups)
    .where(
      and(
        eq(menuModifierGroups.tenantId, tenantId),
        eq(menuModifierGroups.menuItemId, jollyItemId ?? ""),
        eq(menuModifierGroups.name, HALF_GROUP),
      ),
    )
    .limit(1);

  if (existingHalfGroups.length > 0) {
    log(`[B3] group "${HALF_GROUP}" già presente: ${existingHalfGroups[0].id} (lasciato invariato)`);
  } else if (DRY_RUN) {
    log(`[B3] (dry-run) creerei il group "${HALF_GROUP}" con ${pizzas.length} opzioni a prezzo/2`);
  } else {
    if (!jollyItemId) throw new Error("JOLLY product is required to create the halves group");
    const halfGroupId = newId("mg");
    await db.insert(menuModifierGroups).values({
      id: halfGroupId,
      tenantId,
      menuItemId: jollyItemId,
      name: HALF_GROUP,
      required: 0,
      minSelections: 0,
      maxSelections: 2,
      multiSelectPriceMode: "sum",
      sortOrder: 0,
    });
    await db.insert(menuModifierOptions).values(
      pizzas.map((pizza, index) => ({
        id: newId("mo"),
        tenantId,
        groupId: halfGroupId,
        name: pizza.name,
        componentType: "ingredient",
        priceDelta: (Number(pizza.price) / 2).toFixed(2),
        isDefault: 0,
        isActive: 1,
        sortOrder: index,
        quantity: "1",
        unit: "pz",
      })),
    );
    log(`[B3] group "${HALF_GROUP}" creato con ${pizzas.length} opzioni (priceDelta = prezzo/2)`);
  }

  // ── B4: MAXI pool on Pizzeria (priceMultiplier = 2, active) ─────────────
  const existingPools = await db
    .select({ id: categoryModifierPools.id })
    .from(categoryModifierPools)
    .where(and(eq(categoryModifierPools.tenantId, tenantId), eq(categoryModifierPools.name, MAXI_POOL)))
    .limit(1);

  if (existingPools.length > 0) {
    log(`[B4] pool "${MAXI_POOL}" già presente: ${existingPools[0].id}`);
  } else if (DRY_RUN) {
    log(`[B4] (dry-run) creerei il pool "${MAXI_POOL}" su ${PIZZERIA_CATEGORY} con priceMultiplier=${MAXI_MULTIPLIER}`);
  } else {
    const maxiPoolId = newId("cmp");
    await db.insert(categoryModifierPools).values({
      id: maxiPoolId,
      tenantId,
      categoryId: pizzeriaCategoryId,
      name: MAXI_POOL,
      sortOrder: 0,
    });
    await db.insert(categoryModifierPoolCategories).values({
      id: newId("cmpc"),
      tenantId,
      poolId: maxiPoolId,
      categoryId: pizzeriaCategoryId,
    });
    await db.insert(categoryModifierPoolOptions).values({
      id: newId("cmo"),
      tenantId,
      poolId: maxiPoolId,
      name: MAXI_OPTION,
      componentType: "ingredient",
      quantity: "1",
      unit: "pz",
      priceDelta: "0",
      priceMultiplier: MAXI_MULTIPLIER,
      isActive: 1,
      sortOrder: 0,
    });
    log(`[B4] pool "${MAXI_POOL}" creato → ${maxiPoolId} (priceMultiplier=${MAXI_MULTIPLIER}, active)`);
  }

  // ── B5: hide the JOLLY category from the public menu ────────────────────
  const configRows = await db
    .select({ id: tenantModuleConfigs.id, config: tenantModuleConfigs.config })
    .from(tenantModuleConfigs)
    .where(
      and(
        eq(tenantModuleConfigs.tenantId, tenantId),
        eq(tenantModuleConfigs.moduleKey, "public_menu"),
      ),
    )
    .limit(1);
  const configRow = configRows[0];
  if (!configRow) throw new Error("public_menu config not found for casale");

  let config: Record<string, unknown>;
  try {
    config = JSON.parse(configRow.config) as Record<string, unknown>;
  } catch {
    throw new Error("public_menu config is not valid JSON");
  }
  const hidden = Array.isArray(config.hiddenCategoryIds)
    ? (config.hiddenCategoryIds as string[])
    : [];

  if (jollyCategoryId && hidden.includes(jollyCategoryId)) {
    log(`[B5] categoria "${JOLLY_CATEGORY}" già nascosta dal menu pubblico`);
  } else if (DRY_RUN || !jollyCategoryId) {
    log(`[B5] (dry-run) aggiungerei la categoria "${JOLLY_CATEGORY}" a hiddenCategoryIds`);
  } else {
    config.hiddenCategoryIds = [...hidden, jollyCategoryId];
    await db
      .update(tenantModuleConfigs)
      .set({ config: JSON.stringify(config), updatedAt: new Date() })
      .where(eq(tenantModuleConfigs.id, configRow.id));
    log(`[B5] categoria "${JOLLY_CATEGORY}" nascosta dal menu pubblico`);
  }

  log("\n=== RIEPILOGO ===");
  log(
    JSON.stringify(
      {
        dryRun: DRY_RUN,
        tenantId,
        pizzeriaCategory: pizzeriaCategoryId,
        jollyCategory: jollyCategoryId ?? "(da creare)",
        halfGroup: HALF_GROUP,
        maxiPool: MAXI_POOL,
        pizzas: pizzas.length,
        sampleHalves: pizzas.slice(0, 3).map((pizza) => ({
          pizza: pizza.name,
          price: Number(pizza.price).toFixed(2),
          half: (Number(pizza.price) / 2).toFixed(2),
        })),
      },
      null,
      2,
    ),
  );
}

main()
  .then(() => pool.end())
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
    return pool.end();
  });

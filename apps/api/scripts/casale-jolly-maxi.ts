/**
 * One-off for tenant "casale": adds the JOLLY product and the MAXI modifier.
 *
 *  JOLLY  — a product in its own category (stazione Pizzeria, hidden from the
 *           public menu) so the POS can compose a "mezza pizza maxi" by
 *           picking up to 2 of the existing pizzas. The group charges
 *           `priceDelta = pizza price / 2` in "sum" mode, so two halves cost
 *           (pA + pB)/2. `is_jolly` marks the line POS-only: its price is
 *           COMPOSED by those selections — the POS renders no ad-hoc input —
 *           and MAXI (×2) scales that composed base.
 *
 *  MAXI   — a single category pool option on "Pizzeria" with priceMultiplier=2:
 *           it doubles whatever pizza it is attached to (base × 2, then
 *           toppings add on top). Because it is a pool, the existing pizzas
 *           AND any future pizza are covered by one option.
 *
 * Step B6 mirrors the whole PIZZERIA pool set onto the JOLLY category (a pool
 * can serve several categories): MAXI, the existing "Senza glutine" pool and
 * "AGGIUNTA" — a JOLLY is two pizza halves, so anything that can go on a pizza
 * can go on it, and the large AGGIUNTA pool is what feeds "Personalizza".
 * B7 makes "Le due metà" required so an empty €0,00 JOLLY cannot be sold.
 *
 * Idempotent: an existing category / product / group / pool / link is reused
 * rather than duplicated. Run with --dry-run first.
 *
 * Usage:
 *   DATABASE_URL=... npx tsx scripts/casale-jolly-maxi.ts [--dry-run]
 */
import { and, eq, ilike } from "drizzle-orm";
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
// Category names are stored uppercase in Magazzino ("PIZZERIA"): match
// case-insensitively or the script dies at the very first lookup.
const PIZZERIA_CATEGORY = "Pizzeria";
const JOLLY_CATEGORY = "JOLLY";
const JOLLY_ITEM = "JOLLY";
const HALF_GROUP = "Le due metà";
const MAXI_POOL = "MAXI";
const MAXI_OPTION = "MAXI";
const MAXI_MULTIPLIER = "2";
const GLUTEN_FREE_POOL = "senza glutine";

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
    .where(and(eq(categories.tenantId, tenantId), ilike(categories.name, PIZZERIA_CATEGORY)))
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
    .where(and(eq(categories.tenantId, tenantId), ilike(categories.name, JOLLY_CATEGORY)))
    .limit(1);

  let jollyCategoryId: string | undefined = existingJollyCategory[0]?.id;
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

  // ── B2: the JOLLY product (price 0, is_jolly = 1 → POS-only line) ──────
  const existingJollyItem = await db
    .select({ id: menuItems.id })
    .from(menuItems)
    .where(and(eq(menuItems.tenantId, tenantId), eq(menuItems.name, JOLLY_ITEM)))
    .limit(1);

  let jollyItemId: string | undefined = existingJollyItem[0]?.id;
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
  // required + minSelections=1: the POS disables "Aggiungi" until at least one
  // half is picked, so a JOLLY can never be sold at €0,00.
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
    log(`[B3] (dry-run) creerei il group "${HALF_GROUP}" con ${pizzas.length} opzioni a prezzo/2 (obbligatorio, min 1)`);
  } else {
    if (!jollyItemId) throw new Error("JOLLY product is required to create the halves group");
    const halfGroupId = newId("mg");
    await db.insert(menuModifierGroups).values({
      id: halfGroupId,
      tenantId,
      menuItemId: jollyItemId,
      name: HALF_GROUP,
      required: 1,
      minSelections: 1,
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

  // ── B6: link every PIZZERIA pool to the JOLLY category ────────────────
  // A pool can serve several categories (category_modifier_pool_categories).
  // The JOLLY line lives in its own category, so with no links it would offer
  // neither the ×2 nor the gluten-free upgrade — nor the "AGGIUNTA" pool that
  // feeds "Personalizza". A JOLLY is two pizza halves: every pool that applies
  // to PIZZERIA applies to it (MAXI, Senza glutine, AGGIUNTA, and anything
  // added later).
  let jollyPoolNames: string[] = [];
  if (!jollyCategoryId) {
    log(`[B6] (dry-run) collegherei i pool di "${PIZZERIA_CATEGORY}" alla categoria "${JOLLY_CATEGORY}"`);
    jollyPoolNames = [MAXI_POOL, GLUTEN_FREE_POOL];
  } else {
    const tenantPools = await db
      .select({
        id: categoryModifierPools.id,
        name: categoryModifierPools.name,
        categoryId: categoryModifierPools.categoryId,
      })
      .from(categoryModifierPools)
      .where(eq(categoryModifierPools.tenantId, tenantId));
    const named = (needle: string) =>
      tenantPools.filter((pool) => pool.name.trim().toLowerCase().includes(needle));

    // Pools reachable from a pizza: legacy single-category column + join rows.
    const pizzeriaPoolIds = new Set<string>();
    for (const pool of tenantPools) {
      if (pool.categoryId && pool.categoryId === pizzeriaCategoryId) pizzeriaPoolIds.add(pool.id);
    }
    const pizzeriaLinks = await db
      .select({ poolId: categoryModifierPoolCategories.poolId })
      .from(categoryModifierPoolCategories)
      .where(
        and(
          eq(categoryModifierPoolCategories.tenantId, tenantId),
          eq(categoryModifierPoolCategories.categoryId, pizzeriaCategoryId),
        ),
      );
    for (const link of pizzeriaLinks) pizzeriaPoolIds.add(link.poolId);

    const byId = new Map<string, { id: string; name: string }>();
    for (const pool of tenantPools) {
      if (pizzeriaPoolIds.has(pool.id)) byId.set(pool.id, pool);
    }
    // Named lookups stay as a safety net (they also catch a pool created by
    // B4 before it was ever linked to a category).
    for (const pool of [...named(MAXI_POOL.toLowerCase()), ...named(GLUTEN_FREE_POOL)]) {
      byId.set(pool.id, pool);
    }
    const targets = [...byId.values()];
    jollyPoolNames = targets.map((pool) => pool.name);

    if (named(MAXI_POOL.toLowerCase()).length === 0) {
      log(`[B6] ATTENZIONE: pool "${MAXI_POOL}" non trovato: esegui prima B4`);
    }
    if (named(GLUTEN_FREE_POOL).length === 0) {
      log(`[B6] ATTENZIONE: nessun pool "${GLUTEN_FREE_POOL}" trovato per ${TENANT_SLUG}`);
    }
    if (targets.length === 0) {
      log(`[B6] ATTENZIONE: nessun pool collegato a "${PIZZERIA_CATEGORY}": niente da collegare al JOLLY`);
    }

    for (const pool of targets) {
      const [existingLink] = await db
        .select({ id: categoryModifierPoolCategories.id })
        .from(categoryModifierPoolCategories)
        .where(
          and(
            eq(categoryModifierPoolCategories.tenantId, tenantId),
            eq(categoryModifierPoolCategories.poolId, pool.id),
            eq(categoryModifierPoolCategories.categoryId, jollyCategoryId),
          ),
        )
        .limit(1);

      if (existingLink) {
        log(`[B6] pool "${pool.name}" già collegato alla categoria "${JOLLY_CATEGORY}"`);
      } else if (DRY_RUN) {
        log(`[B6] (dry-run) collegherei il pool "${pool.name}" alla categoria "${JOLLY_CATEGORY}"`);
      } else {
        await db.insert(categoryModifierPoolCategories).values({
          id: newId("cmpc"),
          tenantId,
          poolId: pool.id,
          categoryId: jollyCategoryId,
        });
        log(`[B6] pool "${pool.name}" collegato alla categoria "${JOLLY_CATEGORY}"`);
      }
    }
  }

  // ── B7: "Le due metà" required → an empty (€0,00) JOLLY cannot be sold ──
  const halfGroupRows = await db
    .select({
      id: menuModifierGroups.id,
      required: menuModifierGroups.required,
      minSelections: menuModifierGroups.minSelections,
    })
    .from(menuModifierGroups)
    .where(
      and(
        eq(menuModifierGroups.tenantId, tenantId),
        eq(menuModifierGroups.menuItemId, jollyItemId ?? ""),
        eq(menuModifierGroups.name, HALF_GROUP),
      ),
    )
    .limit(1);
  const halfGroup = halfGroupRows[0];

  // NB: the live `required` column is BOOLEAN (schema.ts declares integer): the
  // driver hands back `true`, so a `=== 1` test would re-apply this on every run.
  if (!halfGroup) {
    log(`[B7] gruppo "${HALF_GROUP}" non trovato: esegui prima B3`);
  } else if (Boolean(halfGroup.required) && halfGroup.minSelections >= 1) {
    log(`[B7] gruppo "${HALF_GROUP}" già obbligatorio (min 1 selezione)`);
  } else if (DRY_RUN) {
    log(`[B7] (dry-run) renderei obbligatorio il gruppo "${HALF_GROUP}" (min 1 selezione)`);
  } else {
    await db
      .update(menuModifierGroups)
      .set({ required: 1, minSelections: 1 })
      .where(eq(menuModifierGroups.id, halfGroup.id));
    log(`[B7] gruppo "${HALF_GROUP}" ora obbligatorio (min 1 selezione)`);
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
        halfGroupRequired: "min 1 selezione",
        maxiPool: MAXI_POOL,
        glutenFreePool: GLUTEN_FREE_POOL,
        jollyPoolsLinked: jollyPoolNames,
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

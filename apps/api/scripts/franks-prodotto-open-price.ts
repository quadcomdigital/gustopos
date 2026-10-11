import { and, eq } from "drizzle-orm";
import { db, pool } from "../src/db/client";
import {
  categories,
  menuItems,
  printStations,
  tenantModuleConfigs,
  tenants,
} from "../src/db/schema";

/**
 * One-off for tenant "franks": adds the open-price product "PRODOTTO".
 *
 *  PRODOTTO — a POS-only product whose unit price the waiter types by hand on
 *             the product modal (`is_open_price = 1`, gated by the `openPrice`
 *             tenant override). It is hidden from the public menu and can never
 *             be ordered online: there is no server-side price to charge.
 *
 *  Station  — assigned to the reserved CASHIER station (kind = "cashier"), so
 *             it never reaches a production comanda; it only appears on the
 *             cashier/order ticket. The cashier station is created if the tenant
 *             does not have one yet.
 *
 *  Category — its own "PRODOTTO" category (menu scope, cashier station), also
 *             hidden from the public menu so no empty category is left online.
 *
 * Idempotent: an existing station / category / product / hidden-category entry
 * is reused or updated in place rather than duplicated. Run with --dry-run
 * first.
 *
 * Usage:
 *   DATABASE_URL=... npx tsx apps/api/scripts/franks-prodotto-open-price.ts [--dry-run]
 */
const DRY_RUN = process.argv.includes("--dry-run");
const TENANT_SLUG = "franks";
const TENANT_ID = process.env.FRANKS_TENANT_ID ?? "ten_26ed333e-9dbd-43f7-85b1-fe57054e9e6f";
const CATEGORY_NAME = "PRODOTTO";
const ITEM_NAME = "PRODOTTO";
const CASHIER_STATION_NAME = "Cassa";

const newId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

async function main() {
  const log = (message: string) => console.log(message);

  const tenantRows = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.slug, TENANT_SLUG))
    .limit(1);
  const tenantId = tenantRows[0]?.id ?? TENANT_ID;
  if (!tenantRows[0]?.id) {
    log(`tenant "${TENANT_SLUG}" non trovato per slug: uso l'id ${TENANT_ID}`);
  }
  log(`tenant ${tenantId}`);

  // ── A1: the reserved cashier station (create it if missing) ────────────────
  const cashierRows = await db
    .select({ id: printStations.id })
    .from(printStations)
    .where(and(eq(printStations.tenantId, tenantId), eq(printStations.kind, "cashier")))
    .limit(1);

  let cashierStationId: string | undefined = cashierRows[0]?.id;
  if (cashierStationId) {
    log(`[A1] stazione cashier già presente: ${cashierStationId}`);
  } else if (DRY_RUN) {
    log(`[A1] (dry-run) creerei la stazione cashier "${CASHIER_STATION_NAME}"`);
  } else {
    cashierStationId = newId("st");
    await db.insert(printStations).values({
      id: cashierStationId,
      tenantId,
      name: CASHIER_STATION_NAME,
      kind: "cashier",
      // Never steal the tenant default (that drives the production fallback).
      isDefault: 0,
      sortOrder: 99,
      isActive: 1,
      ownItemsOnly: 0,
    });
    log(`[A1] stazione cashier "${CASHIER_STATION_NAME}" creata → ${cashierStationId}`);
  }

  // ── A2: the "PRODOTTO" category (menu scope, cashier station) ──────────────
  const existingCategories = await db
    .select({ id: categories.id, stationId: categories.stationId })
    .from(categories)
    .where(and(eq(categories.tenantId, tenantId), eq(categories.name, CATEGORY_NAME)))
    .limit(1);

  let categoryId: string | undefined = existingCategories[0]?.id;
  if (categoryId) {
    log(`[A2] categoria "${CATEGORY_NAME}" già presente: ${categoryId}`);
    if (!DRY_RUN && cashierStationId && existingCategories[0].stationId !== cashierStationId) {
      await db
        .update(categories)
        .set({ stationId: cashierStationId, updatedAt: new Date() })
        .where(eq(categories.id, categoryId));
      log(`[A2] stazione della categoria aggiornata → cashier ${cashierStationId}`);
    }
  } else if (DRY_RUN) {
    log(`[A2] (dry-run) creerei la categoria "${CATEGORY_NAME}" scope=menu, station=cashier`);
  } else {
    categoryId = newId("cat");
    await db.insert(categories).values({
      id: categoryId,
      tenantId,
      name: CATEGORY_NAME,
      scope: "menu",
      isActive: 1,
      stationId: cashierStationId ?? null,
    });
    log(`[A2] categoria "${CATEGORY_NAME}" creata → ${categoryId}`);
  }

  // ── A3: the open-price product (price 0, is_open_price = 1) ────────────────
  const existingItems = await db
    .select({ id: menuItems.id, isOpenPrice: menuItems.isOpenPrice, stationId: menuItems.stationId })
    .from(menuItems)
    .where(and(eq(menuItems.tenantId, tenantId), eq(menuItems.name, ITEM_NAME)))
    .limit(1);

  let itemId: string | undefined = existingItems[0]?.id;
  if (itemId) {
    log(`[A3] prodotto "${ITEM_NAME}" già presente: ${itemId}`);
    if (!DRY_RUN && existingItems[0].isOpenPrice !== 1) {
      await db.update(menuItems).set({ isOpenPrice: 1, updatedAt: new Date() }).where(eq(menuItems.id, itemId));
      log(`[A3] prodotto "${ITEM_NAME}" marcato is_open_price = 1`);
    }
    if (!DRY_RUN && cashierStationId && existingItems[0].stationId !== cashierStationId) {
      await db.update(menuItems).set({ stationId: cashierStationId, updatedAt: new Date() }).where(eq(menuItems.id, itemId));
      log(`[A3] stazione del prodotto aggiornata → cashier ${cashierStationId}`);
    }
  } else if (DRY_RUN) {
    log(`[A3] (dry-run) creerei il prodotto "${ITEM_NAME}" prezzo 0.00, is_open_price=1, station=cashier`);
  } else {
    if (!categoryId) throw new Error(`categoria "${CATEGORY_NAME}" richiesta per creare il prodotto`);
    itemId = newId("m");
    await db.insert(menuItems).values({
      id: itemId,
      tenantId,
      name: ITEM_NAME,
      price: "0.00",
      category: CATEGORY_NAME,
      categoryId,
      stationId: cashierStationId ?? null,
      printAreas: JSON.stringify(["kitchen"]),
      isActive: 1,
      isOpenPrice: 1,
    });
    log(`[A3] prodotto "${ITEM_NAME}" creato → ${itemId}`);
  }

  // ── A4: hide the category from the public menu ─────────────────────────────
  // The item is already excluded by `is_open_price = 0` on the public read, but
  // without this the empty "PRODOTTO" category would still show online.
  const configRows = await db
    .select({ id: tenantModuleConfigs.id, config: tenantModuleConfigs.config })
    .from(tenantModuleConfigs)
    .where(and(eq(tenantModuleConfigs.tenantId, tenantId), eq(tenantModuleConfigs.moduleKey, "public_menu")))
    .limit(1);
  const configRow = configRows[0];

  if (!configRow) {
    log(`[A4] nessuna config public_menu per "${TENANT_SLUG}": categoria non nascosta (nessun menu pubblico)`);
  } else if (!categoryId) {
    log(`[A4] (dry-run) aggiungerei la categoria "${CATEGORY_NAME}" a hiddenCategoryIds`);
  } else {
    let config: Record<string, unknown>;
    try {
      config = JSON.parse(configRow.config) as Record<string, unknown>;
    } catch {
      throw new Error("public_menu config non è JSON valido");
    }
    const hidden = Array.isArray(config.hiddenCategoryIds) ? (config.hiddenCategoryIds as string[]) : [];
    if (hidden.includes(categoryId)) {
      log(`[A4] categoria "${CATEGORY_NAME}" già nascosta dal menu pubblico`);
    } else if (DRY_RUN) {
      log(`[A4] (dry-run) aggiungerei la categoria "${CATEGORY_NAME}" a hiddenCategoryIds`);
    } else {
      config.hiddenCategoryIds = [...hidden, categoryId];
      await db
        .update(tenantModuleConfigs)
        .set({ config: JSON.stringify(config), updatedAt: new Date() })
        .where(eq(tenantModuleConfigs.id, configRow.id));
      log(`[A4] categoria "${CATEGORY_NAME}" nascosta dal menu pubblico`);
    }
  }

  log("\n=== RIEPILOGO ===");
  log(
    JSON.stringify(
      {
        dryRun: DRY_RUN,
        tenantId,
        cashierStation: cashierStationId ?? "(da creare)",
        category: categoryId ?? "(da creare)",
        item: itemId ?? "(da creare)",
        itemName: ITEM_NAME,
        openPrice: true,
        productionPrint: false,
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

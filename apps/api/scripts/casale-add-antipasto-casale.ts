/**
 * One-off per tenant "casale": aggiunge un piatto con la sua composizione.
 *
 * Il piatto finisce in "APERTURE DEL TAVOLO" (categoria esistente, scope=menu,
 * stazione Cucina ereditata dai prodotti sorella). La composizione è scritta
 * come ricetta "semplice" — `menu_item_components`, componentType="ingredient"
 * con il NOME libero come componentId, lo stesso pattern che casale usa già
 * per le pizze — e da lì arriva:
 *   - menu pubblico: riga "Ingredienti: …" (branding showIngredients = true);
 *   - POS: tab «Personalizza → Togli» del prodotto (nessun magazzino, nessuna
 *     BoM: casale gira in `simple_catalog`).
 *
 * Idempotente: un prodotto omonimo viene riusato (prezzo/categoria
 * riconciliati) e la composizione viene riallineata riga per riga, mai
 * duplicata (l'unique index su (tenant, prodotto, tipo, componente) lo
 * impedirebbe). Run con --dry-run prima.
 *
 * Per aggiungere altri piatti: aggiungi una voce a DISHES.
 *
 * Usage:
 *   DATABASE_URL=... npx tsx scripts/casale-add-antipasto-casale.ts [--dry-run]
 */
import { and, eq, ilike, inArray } from "drizzle-orm";
import { db, pool } from "../src/db/client";
import { categories, menuItems, menuItemComponents, tenants } from "../src/db/schema";

const DRY_RUN = process.argv.includes("--dry-run");
const TENANT_SLUG = "casale";

interface DishSpec {
  name: string;
  price: string;
  /** Nome della categoria (scope menu, case-insensitive). */
  category: string;
  /** Ingredienti in ordine di stampa sul menu / tab "Togli" del POS. */
  composition: string[];
}

const DISHES: DishSpec[] = [
  {
    name: "ANTIPASTO CASALE",
    price: "12.00",
    category: "APERTURE DEL TAVOLO",
    composition: [
      "Pomodoro secco",
      "olive",
      "salamino rustico",
      "formaggi locali",
      "zucca agrodolce",
      "caponata di melanzane",
      "montanarina con ricotta fichi e noci",
    ],
  },
];

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
  if (!tenantId) throw new Error(`tenant "${TENANT_SLUG}" non trovato`);
  log(`tenant ${tenantId}${DRY_RUN ? "  [dry-run: niente scritture]" : ""}`);

  for (const dish of DISHES) {
    const categoryRows = await db
      .select({ id: categories.id, name: categories.name, isActive: categories.isActive })
      .from(categories)
      .where(
        and(
          eq(categories.tenantId, tenantId),
          eq(categories.scope, "menu"),
          ilike(categories.name, dish.category),
        ),
      )
      .limit(1);
    const category = categoryRows[0];
    if (!category) throw new Error(`categoria "${dish.category}" non trovata`);
    if (category.isActive !== 1) {
      log(`  ! categoria "${category.name}" disattiva: il piatto resterà invisibile finché non la riattivi`);
    }
    log(`categoria ${category.name} → ${category.id}`);

    // ── prodotto (riuso per nome) ──────────────────────────────────────────
    const existingRows = await db
      .select({
        id: menuItems.id,
        price: menuItems.price,
        categoryId: menuItems.categoryId,
        isActive: menuItems.isActive,
      })
      .from(menuItems)
      .where(and(eq(menuItems.tenantId, tenantId), ilike(menuItems.name, dish.name)))
      .limit(1);
    const existing = existingRows[0];

    let itemId = existing?.id;
    if (itemId) {
      log(`prodotto "${dish.name}" già presente → ${itemId}`);
      const priceDiffers = Number(existing?.price) !== Number(dish.price);
      const categoryDiffers = existing?.categoryId !== category.id;
      if (priceDiffers || categoryDiffers) {
        const detail = [
          priceDiffers ? `prezzo ${existing?.price} → ${dish.price}` : null,
          categoryDiffers ? `categoria → ${category.name}` : null,
        ]
          .filter(Boolean)
          .join(", ");
        if (DRY_RUN) {
          log(`  (dry-run) aggiornerei: ${detail}`);
        } else {
          await db
            .update(menuItems)
            .set({
              price: dish.price,
              category: category.name,
              categoryId: category.id,
              updatedAt: new Date(),
            })
            .where(eq(menuItems.id, itemId));
          log(`  aggiornato: ${detail}`);
        }
      }
      if (existing && existing.isActive !== 1) {
        log(`  ! prodotto disattivato: riattivalo dal Catalogo se deve comparire`);
      }
    } else if (DRY_RUN) {
      log(`  (dry-run) creerei "${dish.name}" a €${dish.price} in "${category.name}"`);
    } else {
      itemId = newId("m");
      await db.insert(menuItems).values({
        id: itemId,
        tenantId,
        name: dish.name,
        price: dish.price,
        category: category.name,
        categoryId: category.id,
        // Come i prodotti sorella della stessa categoria: nessuna area legacy
        // (superseded da station_id), stazione ereditata dalla categoria → Cucina.
        printAreas: JSON.stringify([]),
        isActive: 1,
      });
      log(`prodotto creato → ${itemId}`);
    }

    // ── composizione (riconciliazione idempotente) ─────────────────────────
    if (!itemId) {
      log(`  (dry-run) comporrei ${dish.composition.length} ingredienti`);
      continue;
    }

    const currentRows = await db
      .select({
        id: menuItemComponents.id,
        componentType: menuItemComponents.componentType,
        componentId: menuItemComponents.componentId,
      })
      .from(menuItemComponents)
      .where(
        and(
          eq(menuItemComponents.tenantId, tenantId),
          eq(menuItemComponents.menuItemId, itemId),
        ),
      );

    const wanted = new Set(dish.composition);
    const stale = currentRows.filter(
      (row) => row.componentType !== "ingredient" || !wanted.has(row.componentId),
    );
    const current = new Set(
      currentRows
        .filter((row) => row.componentType === "ingredient")
        .map((row) => row.componentId),
    );
    const missing = dish.composition.filter((name) => !current.has(name));

    if (stale.length > 0) {
      if (DRY_RUN) {
        log(`  (dry-run) rimuoverei ${stale.length} componente/i obsolete: ${stale.map((r) => r.componentId).join(" | ")}`);
      } else {
        await db
          .delete(menuItemComponents)
          .where(
            and(
              eq(menuItemComponents.tenantId, tenantId),
              eq(menuItemComponents.menuItemId, itemId),
              inArray(
                menuItemComponents.id,
                stale.map((row) => row.id),
              ),
            ),
          );
        log(`  rimosse ${stale.length} componente/i obsolete`);
      }
    }

    if (missing.length === 0) {
      log(`  composizione già allineata (${dish.composition.length} ingredienti)`);
      continue;
    }
    if (DRY_RUN) {
      log(`  (dry-run) aggiungerei ${missing.length} ingredienti: ${missing.join(" | ")}`);
      continue;
    }
    await db.insert(menuItemComponents).values(
      missing.map((componentId) => ({
        id: newId("mic"),
        tenantId,
        menuItemId: itemId,
        componentType: "ingredient",
        componentId,
        quantity: "1",
        unit: "pz",
      })),
    );
    log(`  +${missing.length} ingredienti (${dish.composition.length} totali)`);
  }

  log("fatto");
}

main()
  .then(() => pool.end())
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
    return pool.end();
  });

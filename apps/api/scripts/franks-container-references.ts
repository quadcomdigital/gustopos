import crypto from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db, pool } from "../src/db/client";
import {
  categories,
  inventory,
  menuItemComponents,
  menuItems,
  menuModifierGroups,
  menuModifierOptions,
  productionReferences,
} from "../src/db/schema";

/**
 * One-off: franks container tally (RIEPILOGO) + composition fixes.
 *
 * 1. SPECIAL category gets the "Piadina" counting reference, so BURRO XXL and
 *    CHICKEN WRAP are tallied even when the line carries no "Base" modifier.
 * 2. CARTOCCIO is moved to CLASSICI (categoryId AND the legacy `category` text,
 *    because the POS/public grid group by text while the menu chip filters by
 *    id), which gives it the "Panino" default and the CLASSICI pools.
 * 3. CARTOCCIO receives the required "Base" group (cloned from an existing
 *    CLASSICI one) so the manual container override is available there too.
 * 4. A new "A piatto" option (+1.00, ref_a_piatto) is added to the "Base" group
 *    of every BURGERS / CLASSICI / SPECIAL product: an extra container choice
 *    alongside Bun / Panino / Piadina.
 * 5. The preselected "Base" option is aligned with the container the product
 *    resolves to (BURGERS→Bun, CLASSICI→Panino, SPECIAL→Piadina): the POS
 *    sends the default option on the line and the modifier beats the category.
 * 6. Tabasco is added to Messicano's composition, so it shows up in the POS
 *    «Personalizza → Togli/Aggiungi» tab (mirrors FRANK'S).
 *
 * Every step is idempotent: already-applied changes are skipped.
 *
 * Usage:
 *   DATABASE_URL=postgresql://... npx tsx apps/api/scripts/franks-container-references.ts
 */
const TENANT_ID = process.env.FRANKS_TENANT_ID ?? "ten_26ed333e-9dbd-43f7-85b1-fe57054e9e6f";

const SPECIAL_CATEGORY_ID = "cat_special";
const CLASSICI_CATEGORY_ID = "cat_classici";
const BURGERS_CATEGORY_ID = "cat_burgers";
const PIADINA_REFERENCE_ID = "ref_piadina";
const A_PIATTO_REFERENCE_ID = "ref_a_piatto";

const A_PIATTO_OPTION_NAME = "A piatto";
const A_PIATTO_PRICE_DELTA = "1.00";
const A_PIATTO_SORT_ORDER = 3;

const CARTOCCIO_ITEM_ID = "m_cdfa6adb-f873-40ce-bff8-a69058e59323";
const CONTADINO_ITEM_ID = "m_2d7cc2a4-80ea-47b2-8cf9-b6a4747dcada";
const MESSICANO_ITEM_ID = "m_34323902-ab65-494f-b329-3040dcefaf10";
const TABASCO_INGREDIENT_ID = "i_msexg74r";
const TABASCO_QUANTITY = "1";
const TABASCO_UNIT = "pz";

const BASE_GROUP_NAME = "Base";
const A_PIATTO_CATEGORY_IDS = [BURGERS_CATEGORY_ID, CLASSICI_CATEGORY_ID, SPECIAL_CATEGORY_ID];

const newId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

const applied: string[] = [];
const skipped: string[] = [];

async function ensureReferences() {
  const refs = await db
    .select()
    .from(productionReferences)
    .where(and(
      eq(productionReferences.tenantId, TENANT_ID),
      inArray(productionReferences.id, [PIADINA_REFERENCE_ID, A_PIATTO_REFERENCE_ID]),
    ));
  const byId = new Map(refs.map((row) => [row.id, row]));
  for (const id of [PIADINA_REFERENCE_ID, A_PIATTO_REFERENCE_ID]) {
    const row = byId.get(id);
    if (!row) throw new Error(`Production reference ${id} not found for tenant ${TENANT_ID}`);
    if (row.isActive !== 1) throw new Error(`Production reference ${row.name} (${id}) is not active`);
  }
}

/** 1. SPECIAL → Piadina (category default for the RIEPILOGO). */
async function setSpecialReference() {
  const [special] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.tenantId, TENANT_ID), eq(categories.id, SPECIAL_CATEGORY_ID)));
  if (!special) throw new Error("Category SPECIAL not found");

  if (special.referenceId === PIADINA_REFERENCE_ID) {
    skipped.push("SPECIAL already references Piadina");
    return;
  }
  await db
    .update(categories)
    .set({ referenceId: PIADINA_REFERENCE_ID, updatedAt: new Date() })
    .where(and(eq(categories.tenantId, TENANT_ID), eq(categories.id, SPECIAL_CATEGORY_ID)));
  applied.push(`SPECIAL → Piadina (was ${special.referenceId ?? "none"})`);
}

/** 2. CARTOCCIO → CLASSICI, keeping the legacy `category` text in sync. */
async function moveCartoccioToClassici() {
  const [item] = await db
    .select()
    .from(menuItems)
    .where(and(eq(menuItems.tenantId, TENANT_ID), eq(menuItems.id, CARTOCCIO_ITEM_ID)));
  if (!item) throw new Error("CARTOCCIO not found");

  if (item.categoryId === CLASSICI_CATEGORY_ID && item.category === "CLASSICI") {
    skipped.push("CARTOCCIO already in CLASSICI");
    return;
  }
  await db
    .update(menuItems)
    .set({ categoryId: CLASSICI_CATEGORY_ID, category: "CLASSICI" })
    .where(and(eq(menuItems.tenantId, TENANT_ID), eq(menuItems.id, CARTOCCIO_ITEM_ID)));
  applied.push(`CARTOCCIO → CLASSICI (category text: ${item.category})`);
}

/** 3. CARTOCCIO gets the required "Base" group, cloned from an existing one. */
async function ensureCartoccioBaseGroup() {
  const [existing] = await db
    .select({ id: menuModifierGroups.id })
    .from(menuModifierGroups)
    .where(and(
      eq(menuModifierGroups.tenantId, TENANT_ID),
      eq(menuModifierGroups.menuItemId, CARTOCCIO_ITEM_ID),
      eq(menuModifierGroups.name, BASE_GROUP_NAME),
    ))
    .limit(1);
  if (existing) {
    skipped.push("CARTOCCIO already has a Base group");
    return;
  }

  const [templateItem] = await db
    .select({ id: menuItems.id, name: menuItems.name })
    .from(menuItems)
    .where(and(
      eq(menuItems.tenantId, TENANT_ID),
      eq(menuItems.categoryId, CLASSICI_CATEGORY_ID),
      eq(menuItems.id, CONTADINO_ITEM_ID),
    ))
    .limit(1);
  if (!templateItem) throw new Error("Template CLASSICI item not found for the Base group clone");

  const [template] = await db
    .select({
      id: menuModifierGroups.id,
      name: menuModifierGroups.name,
      required: menuModifierGroups.required,
      minSelections: menuModifierGroups.minSelections,
      maxSelections: menuModifierGroups.maxSelections,
      multiSelectPriceMode: menuModifierGroups.multiSelectPriceMode,
      sortOrder: menuModifierGroups.sortOrder,
    })
    .from(menuModifierGroups)
    .where(and(
      eq(menuModifierGroups.tenantId, TENANT_ID),
      eq(menuModifierGroups.menuItemId, templateItem.id),
      eq(menuModifierGroups.name, BASE_GROUP_NAME),
    ))
    .limit(1);
  if (!template) throw new Error(`Template "${BASE_GROUP_NAME}" group not found on ${templateItem.name}`);

  const templateOptions = await db
    .select()
    .from(menuModifierOptions)
    .where(eq(menuModifierOptions.groupId, template.id))
    .orderBy(menuModifierOptions.sortOrder);
  if (templateOptions.length === 0) throw new Error("Template Base group has no options");

  const groupId = newId("mg");
  await db.insert(menuModifierGroups).values({
    id: groupId,
    tenantId: TENANT_ID,
    menuItemId: CARTOCCIO_ITEM_ID,
    name: template.name,
    required: template.required,
    minSelections: template.minSelections,
    maxSelections: template.maxSelections,
    multiSelectPriceMode: template.multiSelectPriceMode,
    sortOrder: template.sortOrder ?? 0,
  });
  await db.insert(menuModifierOptions).values(
    templateOptions.map((opt) => ({
      id: newId("mo"),
      tenantId: TENANT_ID,
      groupId,
      name: opt.name,
      inventoryItemId: opt.inventoryItemId,
      referenceId: opt.referenceId,
      componentType: opt.componentType,
      componentId: opt.componentId,
      priceDelta: opt.priceDelta,
      priceMultiplier: opt.priceMultiplier,
      isDefault: opt.isDefault,
      isActive: opt.isActive,
      sortOrder: opt.sortOrder ?? 0,
      quantity: opt.quantity,
      unit: opt.unit,
    })),
  );
  applied.push(`CARTOCCIO Base group created (${templateOptions.map((o) => o.name).join(" / ")})`);
}

/**
 * 4. "A piatto" on every BURGERS/CLASSICI/SPECIAL "Base" group.
 * No inventory row backs this option (it is a container choice, not a stock
 * item): componentId stays null, exactly like the 49 other franks options.
 */
async function addAPiattoOption() {
  const groups = await db
    .select({ groupId: menuModifierGroups.id, itemName: menuItems.name })
    .from(menuModifierGroups)
    .innerJoin(menuItems, eq(menuItems.id, menuModifierGroups.menuItemId))
    .where(and(
      eq(menuModifierGroups.tenantId, TENANT_ID),
      eq(menuModifierGroups.name, BASE_GROUP_NAME),
      eq(menuItems.tenantId, TENANT_ID),
      inArray(menuItems.categoryId, A_PIATTO_CATEGORY_IDS),
    ));
  if (groups.length === 0) throw new Error("No Base group found in BURGERS/CLASSICI/SPECIAL");

  let created = 0;
  const already: string[] = [];
  for (const group of groups) {
    const options = await db
      .select({ id: menuModifierOptions.id, name: menuModifierOptions.name })
      .from(menuModifierOptions)
      .where(eq(menuModifierOptions.groupId, group.groupId));
    const hit = options.find((opt) => opt.name.trim().toLocaleLowerCase("it") === A_PIATTO_OPTION_NAME.toLocaleLowerCase("it"));
    if (hit) {
      already.push(group.itemName);
      continue;
    }
    await db.insert(menuModifierOptions).values({
      id: newId("mo"),
      tenantId: TENANT_ID,
      groupId: group.groupId,
      name: A_PIATTO_OPTION_NAME,
      inventoryItemId: null,
      referenceId: A_PIATTO_REFERENCE_ID,
      componentType: "ingredient",
      componentId: null,
      priceDelta: A_PIATTO_PRICE_DELTA,
      priceMultiplier: null,
      isDefault: 0,
      isActive: 1,
      sortOrder: A_PIATTO_SORT_ORDER,
      quantity: "1",
      unit: "pz",
    });
    created += 1;
  }

  if (created > 0) applied.push(`"A piatto" added to ${created} Base group(s)`);
  if (already.length > 0) skipped.push(`"A piatto" already present on: ${already.join(", ")}`);
}

/**
 * 5. The preselected "Base" option must match the container the product
 * resolves to (product reference, else category reference). The POS product
 * modal sends the default option on the line, and in `resolveItemReference`
 * the modifier wins over the category: a CLASSICI item whose default is "Bun"
 * would be tallied as BUN instead of Panino.
 */
async function syncBaseDefaults() {
  const groups = await db
    .select({
      groupId: menuModifierGroups.id,
      itemName: menuItems.name,
      itemReferenceId: menuItems.referenceId,
      categoryId: menuItems.categoryId,
    })
    .from(menuModifierGroups)
    .innerJoin(menuItems, eq(menuItems.id, menuModifierGroups.menuItemId))
    .where(and(
      eq(menuModifierGroups.tenantId, TENANT_ID),
      eq(menuModifierGroups.name, BASE_GROUP_NAME),
      eq(menuItems.tenantId, TENANT_ID),
      inArray(menuItems.categoryId, A_PIATTO_CATEGORY_IDS),
    ));
  if (groups.length === 0) throw new Error("No Base group found while syncing defaults");

  const categoryRows = await db
    .select({ id: categories.id, referenceId: categories.referenceId })
    .from(categories)
    .where(and(eq(categories.tenantId, TENANT_ID), inArray(categories.id, A_PIATTO_CATEGORY_IDS)));
  const categoryReferenceById = new Map(categoryRows.map((row) => [row.id, row.referenceId]));

  let updated = 0;
  const changedItems: string[] = [];
  for (const group of groups) {
    const expected =
      group.itemReferenceId ??
      (group.categoryId ? categoryReferenceById.get(group.categoryId) : null) ??
      null;
    if (!expected) continue;

    const options = await db
      .select({ id: menuModifierOptions.id, name: menuModifierOptions.name, referenceId: menuModifierOptions.referenceId, isDefault: menuModifierOptions.isDefault })
      .from(menuModifierOptions)
      .where(eq(menuModifierOptions.groupId, group.groupId));

    let touched = false;
    for (const option of options) {
      const shouldDefault = option.referenceId === expected;
      if (Boolean(option.isDefault) === shouldDefault) continue;
      await db
        .update(menuModifierOptions)
        .set({ isDefault: shouldDefault ? 1 : 0 })
        .where(eq(menuModifierOptions.id, option.id));
      updated += 1;
      touched = true;
    }
    if (touched) changedItems.push(group.itemName);
  }

  if (updated > 0) applied.push(`Base default aligned on ${changedItems.length} item(s): ${changedItems.join(", ")}`);
  else skipped.push("Base defaults already match the resolved container");
}

/** 6. Tabasco in Messicano's composition (POS Togli/Aggiungi tab). */
async function addTabascoToMessicano() {
  const [item] = await db
    .select({ id: menuItems.id })
    .from(menuItems)
    .where(and(eq(menuItems.tenantId, TENANT_ID), eq(menuItems.id, MESSICANO_ITEM_ID)))
    .limit(1);
  if (!item) throw new Error("Messicano not found");

  const [ingredient] = await db
    .select({ id: inventory.id, name: inventory.name, unit: inventory.unit, isActive: inventory.isActive })
    .from(inventory)
    .where(and(eq(inventory.tenantId, TENANT_ID), eq(inventory.id, TABASCO_INGREDIENT_ID)))
    .limit(1);
  if (!ingredient) throw new Error(`Tabasco ingredient ${TABASCO_INGREDIENT_ID} not found`);
  if (ingredient.isActive !== 1) throw new Error(`Tabasco ingredient ${ingredient.name} is not active`);
  if (ingredient.unit !== TABASCO_UNIT) {
    throw new Error(`Tabasco unit ${ingredient.unit} does not match the expected ${TABASCO_UNIT}`);
  }

  const [existing] = await db
    .select({ id: menuItemComponents.id })
    .from(menuItemComponents)
    .where(and(
      eq(menuItemComponents.tenantId, TENANT_ID),
      eq(menuItemComponents.menuItemId, MESSICANO_ITEM_ID),
      eq(menuItemComponents.componentType, "ingredient"),
      eq(menuItemComponents.componentId, TABASCO_INGREDIENT_ID),
    ))
    .limit(1);
  if (existing) {
    skipped.push("Tabasco already in Messicano's composition");
    return;
  }

  await db.insert(menuItemComponents).values({
    id: `mic_${crypto.randomUUID()}`,
    tenantId: TENANT_ID,
    menuItemId: MESSICANO_ITEM_ID,
    componentType: "ingredient",
    componentId: TABASCO_INGREDIENT_ID,
    quantity: TABASCO_QUANTITY,
    unit: TABASCO_UNIT,
  });
  applied.push("Tabasco added to Messicano's composition");
}

async function main() {
  await ensureReferences();
  await setSpecialReference();
  await moveCartoccioToClassici();
  await ensureCartoccioBaseGroup();
  await addAPiattoOption();
  await syncBaseDefaults();
  await addTabascoToMessicano();

  console.log("\nApplied:");
  for (const line of applied) console.log("  + " + line);
  console.log("Skipped (already in the desired state):");
  for (const line of skipped) console.log("  - " + line);
  if (applied.length === 0 && skipped.length === 0) console.log("  (nothing to do)");

  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

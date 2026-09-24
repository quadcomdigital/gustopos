/**
 * One-off: import dish compositions for the casale tenant from the
 * restaurant's public site (anticocasalericevimenti.it).
 *
 * The WooCommerce Store API exposes NO ingredient data (descriptions are
 * empty); the ingredients live in the Elementor accordion of the site's home
 * page: each dish is an <h5> heading followed by a <p> with the comma-separated
 * ingredient list (a <p> containing "€" is the price, not ingredients).
 *
 * For every matched dish this writes canonical recipe edges
 * (`menu_item_components`, componentType="ingredient") where componentId is the
 * free-text ingredient NAME — the simple_catalog "Togli" composition. No
 * inventory rows, no stock, no BoM. Idempotent: edges are replaced per item.
 *
 * Usage:
 *   DATABASE_URL=postgresql://... npx tsx scripts/casale-composition-import.ts [--dry-run]
 *
 * Matching: exact normalized name first, then token-containment (e.g. site
 * "Pizza Americana" ↔ catalog "AMERICANA"), restricted to the dish's category
 * (section → catalog category map). Ambiguous or unmatched dishes are reported
 * so they can be fixed by hand in Catalogo → Prodotto → Composizione.
 */
import crypto from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "../src/db/client";
import { categories, menuItems, menuItemComponents, tenants } from "../src/db/schema";

const TENANT_SLUG = "casale";
const HOME_URL = "https://anticocasalericevimenti.it/wp-json/wp/v2/pages/8?_fields=content";
const DRY_RUN = process.argv.includes("--dry-run");
/** Max edit distance for the spelling-drift matching pass (Buonagrazia/Bonagrazia). */
const MAX_EDIT_DISTANCE = 2;

// Accordion section title (lowercased, contains…) → catalog categories allowed
// as match candidates. Sections not listed here match against every item.
const SECTION_CATEGORY_KEYWORDS: Array<{ keywords: string[]; categories: string[] }> = [
  { keywords: ["antipast"], categories: ["Antipasti"] },
  { keywords: ["pizz"], categories: ["Pizzeria"] },
  { keywords: ["primi"], categories: ["Primi"] },
  { keywords: ["secondi"], categories: ["Secondi"] },
  { keywords: ["contorn"], categories: ["Contorni"] },
  { keywords: ["frutta"], categories: ["Frutta"] },
  { keywords: ["dessert"], categories: ["Dessert"] },
  { keywords: ["bibite", "vini"], categories: ["Bibite", "Caffe e Amari"] },
  { keywords: ["menu fisso"], categories: [] }, // skip: not a dish list
];

interface Dish {
  name: string;
  ingredients: string[];
  section: string;
}

interface CatalogItem {
  id: string;
  name: string;
  category: string;
}

// ─── HTML helpers ───────────────────────────────────────────────────────────

function decodeEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');
}

function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function normalize(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// ─── Home page parsing ──────────────────────────────────────────────────────

function parseHomeDishes(html: string): Dish[] {
  const dishes: Dish[] = [];

  // Split into accordion sections: each starts with the toggle title.
  const titleRe = /<a[^>]*class="[^"]*elementor-toggle-title[^"]*"[^>]*>([\s\S]*?)<\/a>/g;
  const titles: Array<{ name: string; start: number }> = [];
  let match: RegExpExecArray | null;
  while ((match = titleRe.exec(html)) !== null) {
    titles.push({ name: stripTags(match[1]), start: match.index });
  }

  for (let i = 0; i < titles.length; i++) {
    const section = titles[i].name;
    const body = html.slice(titles[i].start, i + 1 < titles.length ? titles[i + 1].start : html.length);

    const skipSection = SECTION_CATEGORY_KEYWORDS.find((entry) =>
      entry.keywords.some((kw) => section.toLowerCase().includes(kw)),
    );
    if (skipSection && skipSection.categories.length === 0) continue;

    const h5Re = <RegExp>/<h5[^>]*>([\s\S]*?)<\/h5>/g;
    const headings: Array<{ name: string; index: number; end: number }> = [];
    let h5: RegExpExecArray | null;
    while ((h5 = h5Re.exec(body)) !== null) {
      headings.push({ name: stripTags(h5[1]), index: h5.index, end: h5.index + h5[0].length });
    }

    for (let h = 0; h < headings.length; h++) {
      const dishName = headings[h].name;
      if (!dishName) continue;
      const after = body.slice(
        headings[h].end,
        h + 1 < headings.length ? headings[h + 1].index : body.length,
      );

      // First non-empty <p> after the heading: ingredients unless it is a price.
      const pRe = /<p[^>]*>([\s\S]*?)<\/p>/g;
      let ingredients: string[] = [];
      let p: RegExpExecArray | null;
      while ((p = pRe.exec(after)) !== null) {
        const text = stripTags(p[1]);
        if (!text) continue;
        if (text.includes("€")) break; // price block: this dish has no ingredient line
        ingredients = text
          .split(",")
          .map((entry) => entry.replace(/\.$/, "").trim())
          .filter((entry) => entry.length > 1 && !/^\d/.test(entry));
        break;
      }

      dishes.push({ name: dishName, ingredients, section });
    }
  }

  return dishes;
}

// ─── Matching ───────────────────────────────────────────────────────────────

function candidatesFor(dish: Dish, items: CatalogItem[]): CatalogItem[] {
  const mapping = SECTION_CATEGORY_KEYWORDS.find((entry) =>
    entry.keywords.some((kw) => dish.section.toLowerCase().includes(kw)),
  );
  if (!mapping || mapping.categories.length === 0) return items;
  return items.filter((item) => mapping.categories.includes(item.category));
}

function matchDish(
  dish: Dish,
  pool: CatalogItem[],
): { kind: "exact" | "fuzzy"; item: CatalogItem } | { kind: "ambiguous"; items: CatalogItem[] } | null {
  const target = normalize(dish.name);
  if (!target) return null;

  const exact = pool.filter((item) => normalize(item.name) === target);
  if (exact.length === 1) return { kind: "exact", item: exact[0] };
  if (exact.length > 1) return { kind: "ambiguous", items: exact };

  const dishTokens = target.split(" ").filter((t) => t.length > 1);
  if (dishTokens.length === 0) return null;
  const dishSet = new Set(dishTokens);

  const fuzzy = pool.filter((item) => {
    const itemTokens = normalize(item.name).split(" ").filter((t) => t.length > 1);
    if (itemTokens.length === 0) return false;
    const shorter = itemTokens.length <= dishSet.size ? itemTokens : dishTokens;
    const longer = itemTokens.length <= dishSet.size ? dishTokens : itemTokens;
    const longerSet = itemTokens.length <= dishSet.size ? dishSet : new Set(itemTokens);
    return shorter.every((token) => longerSet.has(token));
  });

  if (fuzzy.length === 1) return { kind: "fuzzy", item: fuzzy[0] };
  if (fuzzy.length > 1) return { kind: "ambiguous", items: fuzzy };

  // Third pass: edit distance for spelling drift between the site and the
  // catalog (e.g. site "Maccheroni Buonagrazia" vs catalog "MACCHERONI
  // BONAGRAZIA"). Accepts ONLY a unique candidate within MAX_EDIT_DISTANCE;
  // two+ candidates at the same distance are reported as ambiguous.
  let best: { item: CatalogItem; distance: number } | null = null;
  let bestCount = 0;
  for (const item of pool) {
    const candidate = normalize(item.name);
    const distance = editDistance(target, candidate, MAX_EDIT_DISTANCE);
    if (distance === null) continue;
    if (!best || distance < best.distance) {
      best = { item, distance };
      bestCount = 1;
    } else if (best && distance === best.distance) {
      bestCount++;
    }
  }
  if (best && bestCount === 1 && best.distance > 0) {
    return { kind: "fuzzy", item: best.item };
  }
  if (best && bestCount > 1 && best.distance > 0) {
    return { kind: "ambiguous", items: pool.filter((item) => editDistance(target, normalize(item.name), MAX_EDIT_DISTANCE) === best!.distance) };
  }
  return null;
}

/** Bounded Levenshtein distance; returns null when above `max` (early exit). */
function editDistance(a: string, b: string, max: number): number | null {
  if (Math.abs(a.length - b.length) > max) return null;
  const width = b.length + 1;
  let prev = new Array<number>(width);
  let curr = new Array<number>(width);
  for (let j = 0; j < width; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j < width; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > max) return null;
    [prev, curr] = [curr, prev];
  }
  const distance = prev[width - 1];
  return distance <= max ? distance : null;
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const [tenant] = await db.select().from(tenants).where(eq(tenants.slug, TENANT_SLUG)).limit(1);
  if (!tenant) throw new Error(`tenant '${TENANT_SLUG}' not found`);

  const categoryRows = await db.select().from(categories).where(eq(categories.tenantId, tenant.id));
  const categoryNameById = new Map(categoryRows.map((row) => [row.id, row.name]));

  const itemRows = await db
    .select()
    .from(menuItems)
    .where(and(eq(menuItems.tenantId, tenant.id), eq(menuItems.isActive, 1)));
  const items: CatalogItem[] = itemRows.map((row) => ({
    id: row.id,
    name: row.name,
    category: row.categoryId ? (categoryNameById.get(row.categoryId) ?? row.category) : row.category,
  }));

  console.log(`[1/4] catalog: ${items.length} active items, ${categoryRows.length} categories`);

  const response = await fetch(HOME_URL);
  if (!response.ok) throw new Error(`home fetch failed: HTTP ${response.status}`);
  const page = (await response.json()) as { content?: { rendered?: string } };
  const html = page.content?.rendered;
  if (!html) throw new Error("home content.rendered is empty");

  const dishes = parseHomeDishes(html);
  const withIngredients = dishes.filter((d) => d.ingredients.length > 0);
  console.log(`[2/4] site: ${dishes.length} dishes parsed, ${withIngredients.length} with ingredients`);

  const stats = { exact: 0, fuzzy: 0, ambiguous: 0, unmatched: 0, noDescription: 0, written: 0 };
  const ambiguousReport: string[] = [];
  const unmatchedReport: string[] = [];
  const matchedItemIds = new Map<string, { ingredients: string[]; source: string }>();

  for (const dish of dishes) {
    const pool = candidatesFor(dish, items);
    const result = matchDish(dish, pool);
    if (!result) {
      if (dish.ingredients.length === 0) stats.noDescription++;
      else {
        stats.unmatched++;
        unmatchedReport.push(`  [${dish.section}] "${dish.name}" → nessun match`);
      }
      continue;
    }
    if (result.kind === "ambiguous") {
      stats.ambiguous++;
      ambiguousReport.push(
        `  [${dish.section}] "${dish.name}" → ambiguo fra: ${result.items.map((i) => `"${i.name}"`).join(", ")}`,
      );
      continue;
    }
    if (dish.ingredients.length === 0) {
      stats.noDescription++;
      continue;
    }
    stats[result.kind]++;
    matchedItemIds.set(result.item.id, {
      ingredients: dish.ingredients,
      source: `${dish.section} / "${dish.name}"`,
    });
  }

  console.log(`[3/4] matched: ${stats.exact} exact, ${stats.fuzzy} fuzzy, ${stats.ambiguous} ambiguous, ${stats.unmatched} unmatched`);

  if (ambiguousReport.length > 0) {
    console.log("\nAmbigui (sistemare a mano in Catalogo → Prodotto → Composizione):");
    for (const line of ambiguousReport) console.log(line);
  }
  if (unmatchedReport.length > 0) {
    console.log("\nNon trovati nel catalogo:");
    for (const line of unmatchedReport) console.log(line);
  }

  if (DRY_RUN) {
    console.log("\n[dry-run] no writes performed.");
    for (const [id, data] of matchedItemIds) {
      const item = items.find((i) => i.id === id);
      console.log(`  ${item?.name}: ${data.ingredients.join(", ")}`);
    }
    return;
  }

  for (const [menuItemId, data] of matchedItemIds) {
    // Dedupe case-insensitively; keep the site's original spelling for display.
    const seen = new Set<string>();
    const ingredients = data.ingredients.filter((name) => {
      const key = name.toLocaleLowerCase("it");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    await db.transaction(async (tx) => {
      await tx
        .delete(menuItemComponents)
        .where(and(eq(menuItemComponents.tenantId, tenant.id), eq(menuItemComponents.menuItemId, menuItemId)));
      if (ingredients.length > 0) {
        await tx.insert(menuItemComponents).values(
          ingredients.map((name) => ({
            id: `mic_${crypto.randomUUID()}`,
            tenantId: tenant.id,
            menuItemId,
            componentType: "ingredient",
            componentId: name,
            quantity: "1",
            unit: "pz",
          })),
        );
      }
    });
    stats.written++;
  }

  const unmatchedItems = items.filter((item) => !matchedItemIds.has(item.id));
  console.log(`[4/4] written: ${stats.written} items with composition`);
  console.log(`\nItems WITHOUT composition (${unmatchedItems.length}):`);
  for (const item of unmatchedItems) console.log(`  ${item.category} → ${item.name}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

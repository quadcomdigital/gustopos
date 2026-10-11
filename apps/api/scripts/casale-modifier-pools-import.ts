/**
 * One-off: import the modifier pools published on the restaurant's public site
 * (anticocasalericevimenti.it) onto the casale tenant's "Pizzeria" category.
 *
 * The site runs WooCommerce with the Product Add-ons plugin ("wc-pao"): every
 * pizza renders its add-on groups inside `<form class="cart">`, each group a
 * `<div class="wc-pao-addon-container" ... data-addon-name="...">` holding
 * checkbox inputs (`wc-pao-addon-field`) with `data-label` and
 * `data-raw-price` — or, for a few pizzas (SCHIACCIATA), a dropdown whose
 * `<option>` carries the same attributes. The Store API exposes none of it
 * (`extensions: {}`), so the product pages are the only public source.
 *
 * What gets imported (read-only scrape → HTTP API writes):
 *   - "Senza glutine" → the site's PIZZA CELIACA checkbox (+2,00 flat)
 *   - "AGGIUNTA"      → the 49 toppings with their own price deltas
 *   - "MAXI"          → sortOrder only: the pool already exists with
 *                       priceMultiplier=2 and options are replaced wholesale
 *                       by PATCH, which would re-mint ids (and a tenant
 *                       without the modifierMultiplier capability would get a
 *                       null multiplier written back).
 *
 * NOT imported:
 *   - "Togli"  → per-pizza ingredient lists, i.e. the dish composition the
 *                POS already renders from menu_item_components (45/50 pizzas
 *                are covered by scripts/casale-composition-import.ts);
 *   - "SEGUE"  → 0,00 course markers, not toppings.
 *
 * Idempotent: an existing pool is PATCHed only when its content differs.
 * Pools are ordered Senza glutine (0) → MAXI (1) → AGGIUNTA (2), which is the
 * order the POS containers and the public modifier sheet render in.
 *
 * Usage:
 *   SUPERADMIN_PASSWORD=... npx tsx scripts/casale-modifier-pools-import.ts [--dry-run]
 * Optional env: API_BASE, SUPERADMIN_USERNAME, WOO_BASE, WOO_CATEGORY
 */
import {
  categoryModifierPoolCreateRequestSchema,
  categoryModifierPoolUpdateRequestSchema,
} from "@gustopos/shared";

const API_BASE = (process.env.API_BASE ?? "http://127.0.0.1:11901").replace(/\/$/, "");
const WOO_BASE = (process.env.WOO_BASE ?? "https://anticocasalericevimenti.it/wp-json/wc/store/v1").replace(/\/$/, "");
const WOO_CATEGORY = process.env.WOO_CATEGORY ?? "Pizzeria";
const SA_USER = process.env.SUPERADMIN_USERNAME ?? "superadmin";
const SA_PASS = process.env.SUPERADMIN_PASSWORD;
const TENANT_SLUG = process.env.TENANT_SLUG ?? "casale";
const TARGET_CATEGORY = process.env.TARGET_CATEGORY ?? "Pizzeria";
const DRY_RUN = process.argv.includes("--dry-run");

const POOL_SORT: Record<string, number> = {
  "senza glutine": 0,
  maxi: 1,
  aggiunta: 2,
};
const FETCH_CONCURRENCY = 6;
const MAX_ATTEMPTS = 3;
const FETCH_TIMEOUT_MS = 45_000;
const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

type Json = Record<string, unknown>;

// ─── HTTP ───────────────────────────────────────────────────────────────────

async function api<T = unknown>(method: string, path: string, token: string | null, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`${method} ${path} -> ${response.status} ${text.slice(0, 400)}`);
  }
  return payload as T;
}

async function fetchText(url: string): Promise<string> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": UA,
          Accept: "text/html,application/json;q=0.9,*/*;q=0.8",
          "Accept-Language": "it-IT,it;q=0.9",
        },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
      return await response.text();
    } catch (error) {
      lastError = error;
      if (attempt < MAX_ATTEMPTS) await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function fetchJson<T = unknown>(url: string): Promise<T> {
  return JSON.parse(await fetchText(url)) as T;
}

// ─── WooCommerce Product Add-ons parsing ────────────────────────────────────

interface PaoOption {
  label: string;
  price: number;
  priceType: string;
}

interface PaoGroup {
  name: string;
  options: PaoOption[];
}

interface WooProduct {
  id: number;
  name: string;
  permalink: string;
  price: number;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&euro;/g, "€");
}

function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const match of tag.matchAll(/([\w:-]+)\s*=\s*"([^"]*)"/g)) {
    out[match[1]] = decodeEntities(match[2]);
  }
  return out;
}

function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

/** Extract the wc-pao add-on groups from a product page's add-to-cart form. */
function parsePaoAddons(html: string): PaoGroup[] {
  const formStart = html.indexOf('<form class="cart"');
  if (formStart < 0) return [];
  const formEnd = html.indexOf("</form>", formStart);
  const form = html.slice(formStart, formEnd < 0 ? html.length : formEnd);

  const chunks = form.split('<div class="wc-pao-addon-container');
  const groups: PaoGroup[] = [];
  for (const chunk of chunks.slice(1)) {
    const nameMatch = chunk.match(/data-addon-name="([^"]*)"/);
    const name = (nameMatch ? decodeEntities(nameMatch[1]) : "?").trim();

    const options: PaoOption[] = [];
    for (const inputMatch of chunk.matchAll(/<input\b[^>]*>/g)) {
      const input = attrs(inputMatch[0]);
      const klass = input.class ?? "";
      if (!klass.includes("wc-pao-addon-field")) continue;
      options.push({
        label: (input["data-label"] ?? input.value ?? "").trim(),
        price: Number(input["data-raw-price"] || 0),
        priceType: input["data-price-type"] ?? "flat_fee",
      });
    }
    // Dropdown add-ons (e.g. SCHIACCIATA's MAXI) carry the price on the
    // <option>, and the first option is usually the empty "Nessuna" one.
    for (const selectMatch of chunk.matchAll(/<select\b[^>]*name="addon-[^"]*"[^>]*>([\s\S]*?)<\/select>/g)) {
      for (const optionMatch of selectMatch[1].matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/g)) {
        const optionAttrs = attrs(`<option${optionMatch[1]}>`);
        const value = (optionAttrs.value ?? "").trim();
        if (!value) continue; // "Nessuna" — no add-on selected
        options.push({
          label: (optionAttrs["data-label"] ?? stripTags(optionMatch[2])).trim(),
          price: Number(optionAttrs["data-raw-price"] || 0),
          priceType: optionAttrs["data-price-type"] ?? "flat_fee",
        });
      }
    }
    if (/<textarea\b[^>]*name="addon-/.test(chunk)) {
      console.warn(`      ⚠ gruppo "${name}": textarea non supportata, controllare a mano`);
    }
    groups.push({ name, options: options.filter((option) => option.label.length > 0) });
  }
  return groups;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function normalize(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const money = (value: number) => `€${value.toFixed(2).replace(".", ",")}`;

interface DesiredOption {
  name: string;
  priceDelta: number;
  priceMultiplier?: number;
  componentType: "ingredient";
  componentId: string;
  quantity: number;
  unit: string;
  isActive: boolean;
  sortOrder: number;
}

interface DesiredPool {
  name: string;
  sortOrder: number;
  options: DesiredOption[];
}

interface ExistingPool {
  id: string;
  name: string;
  sortOrder: number;
  options: Array<{
    id: string;
    name?: string;
    priceDelta: number;
    priceMultiplier: number | null;
    componentType: string;
    componentId?: string;
    quantity: number;
    unit: string;
    isActive: boolean;
    sortOrder: number;
  }>;
}

function optionKey(option: {
  name?: string;
  priceDelta: number;
  priceMultiplier: number | null | undefined;
  componentType: string;
  componentId?: string;
  quantity: number;
  unit: string;
  isActive: boolean;
}): string {
  return [
    (option.name ?? "").trim(),
    Number(option.priceDelta).toFixed(2),
    option.priceMultiplier == null ? "" : Number(option.priceMultiplier).toFixed(3),
    option.componentType,
    (option.componentId ?? "").trim(),
    Number(option.quantity).toString(),
    option.unit,
    String(option.isActive),
  ].join("|");
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  if (!SA_PASS) throw new Error("SUPERADMIN_PASSWORD is required");

  console.log(`[1/7] superadmin login (${API_BASE})`);
  const login = await api<{ token: string }>("POST", "/api/superadmin/auth/login", null, {
    username: SA_USER,
    password: SA_PASS,
  });
  const tenants = await api<Array<{ id: string; slug: string }>>("GET", "/api/superadmin/tenants", login.token);
  const tenant = tenants.find((candidate) => candidate.slug === TENANT_SLUG);
  if (!tenant) throw new Error(`tenant "${TENANT_SLUG}" not found`);

  console.log(`[2/7] impersonate ${TENANT_SLUG}`);
  const impersonation = await api<{ token: string }>(
    "POST",
    `/api/superadmin/tenants/${tenant.id}/impersonate`,
    login.token,
    {},
  );
  const adminToken = impersonation.token;

  console.log(`[3/7] categoria ${TARGET_CATEGORY}`);
  const categories = await api<Array<{ id: string; name: string }>>(
    "GET",
    "/api/simple-catalog/categories",
    adminToken,
  );
  const category = categories.find((candidate) => candidate.name === TARGET_CATEGORY);
  if (!category) throw new Error(`category "${TARGET_CATEGORY}" not found`);
  const existingPools = await api<ExistingPool[]>(
    "GET",
    `/api/category-modifier-pools?categoryId=${encodeURIComponent(category.id)}`,
    adminToken,
  );
  console.log(`      ${category.id} · ${existingPools.length} pool esistenti (${existingPools.map((p) => p.name).join(", ") || "nessuno"})`);

  console.log(`[4/7] sito: pagine prodotto ${WOO_CATEGORY}`);
  const wooCategories = await fetchJson<Array<{ id: number; name: string; count: number }>>(
    `${WOO_BASE}/products/categories?per_page=100`,
  );
  const wooCategory = wooCategories.find((candidate) => normalize(candidate.name) === normalize(WOO_CATEGORY));
  if (!wooCategory) throw new Error(`WooCommerce category "${WOO_CATEGORY}" not found`);

  const products: WooProduct[] = [];
  for (let page = 1; page <= 10; page += 1) {
    const batch = await fetchJson<Array<{ id: number; name: string; permalink: string; prices: { price: string; currency_minor_unit: number } }>>(
      `${WOO_BASE}/products?category=${wooCategory.id}&per_page=100&page=${page}`,
    );
    if (!Array.isArray(batch) || batch.length === 0) break;
    for (const product of batch) {
      const minor = Number(product.prices?.currency_minor_unit ?? 2);
      products.push({
        id: product.id,
        name: product.name,
        permalink: product.permalink,
        price: Math.round((Number(product.prices?.price ?? 0) / 10 ** minor) * 100) / 100,
      });
    }
    if (batch.length < 100) break;
  }
  if (products.length === 0) throw new Error("no products returned by the WooCommerce Store API");
  console.log(`      ${products.length} prodotti`);

  // Parse the product pages in bounded concurrency (each page is ~110 KB).
  const parsed: Array<{ product: WooProduct; groups: PaoGroup[] }> = [];
  for (let index = 0; index < products.length; index += FETCH_CONCURRENCY) {
    const slice = products.slice(index, index + FETCH_CONCURRENCY);
    const results = await Promise.all(
      slice.map(async (product) => ({ product, groups: parsePaoAddons(await fetchText(product.permalink)) })),
    );
    parsed.push(...results);
    process.stdout.write(`\r      ${parsed.length}/${products.length} pagine lette`);
  }
  process.stdout.write("\n");

  console.log(`[5/7] validazione`);
  const report = validate(parsed);
  for (const line of report.lines) console.log(`      ${line}`);
  for (const anomaly of report.anomalies) console.log(`      ⚠ ${anomaly}`);
  for (const note of report.skipped) console.log(`      · ${note}`);
  if (report.fatal.length > 0) {
    throw new Error(`sito cambiato o dati incoerenti:\n  - ${report.fatal.join("\n  - ")}`);
  }

  const desired = buildDesiredPools(report);

  console.log(`[6/7] riconciliazione`);
  const plan = reconcile(desired, existingPools);
  if (plan.length === 0) {
    console.log("      tutto già allineato, nessuna scrittura");
  } else {
    for (const step of plan) console.log(`      ${step.description}`);
  }

  if (DRY_RUN) {
    console.log("\n[dry-run] nessuna scrittura effettuata.");
    return;
  }

  console.log("[7/7] scrittura");
  for (const step of plan) {
    if (step.kind === "create") {
      const payload = categoryModifierPoolCreateRequestSchema.parse({
        categoryIds: [category.id],
        name: step.pool.name,
        options: step.pool.options,
      });
      await api("POST", "/api/category-modifier-pools", adminToken, payload);
      console.log(`      creato "${step.pool.name}" (${step.pool.options.length} opzioni)`);
    } else {
      const payload = categoryModifierPoolUpdateRequestSchema.parse(step.patch);
      await api("PATCH", `/api/category-modifier-pools/${step.poolId}`, adminToken, payload);
      console.log(`      aggiornato "${step.poolName}"`);
    }
  }

  const verified = await api<ExistingPool[]>(
    "GET",
    `/api/category-modifier-pools?categoryId=${encodeURIComponent(category.id)}`,
    adminToken,
  );
  console.log("\n=== RESULT ===");
  console.log(
    JSON.stringify(
      {
        tenantId: tenant.id,
        category: category.name,
        scrapedProducts: products.length,
        pools: verified
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((pool) => ({ name: pool.name, sortOrder: pool.sortOrder, options: pool.options.length })),
        anomalies: report.anomalies,
        skipped: report.skipped,
      },
      null,
      2,
    ),
  );
}

// ─── Validation + pool building ─────────────────────────────────────────────

interface ValidationReport {
  lines: string[];
  fatal: string[];
  anomalies: string[];
  skipped: string[];
  aggiunta: DesiredOption[];
  celiac: DesiredOption | null;
}

function validate(parsed: Array<{ product: WooProduct; groups: PaoGroup[] }>): ValidationReport {
  const report: ValidationReport = { lines: [], fatal: [], anomalies: [], skipped: [], aggiunta: [], celiac: null };
  const total = parsed.length;

  // AGGIUNTA: one canonical set, expected to be identical on every pizza.
  // Pass 1 builds the union (and flags price conflicts), pass 2 flags options
  // a product is missing.
  const referenceKey = new Map<string, number>();
  let missingAggiunta = 0;
  const perProduct: Array<{ product: WooProduct; labels: Map<string, number> }> = [];
  for (const { product, groups } of parsed) {
    const group = groups.find((candidate) => normalize(candidate.name) === "aggiunta");
    if (!group || group.options.length === 0) {
      missingAggiunta += 1;
      report.fatal.push(`"${product.name}": gruppo AGGIUNTA assente`);
      continue;
    }
    const local = new Map(group.options.map((option) => [normalize(option.label), option.price]));
    perProduct.push({ product, labels: local });
    for (const [label, price] of local) {
      const known = referenceKey.get(label);
      if (known === undefined) referenceKey.set(label, price);
      else if (Math.abs(known - price) > 0.001) {
        report.fatal.push(`"${product.name}": "${label}" costa ${money(price)}, altrove ${money(known)}`);
      }
    }
  }
  for (const { product, labels } of perProduct) {
    for (const label of referenceKey.keys()) {
      if (!labels.has(label)) report.fatal.push(`"${product.name}": manca "${label}" del gruppo AGGIUNTA`);
    }
  }
  if (missingAggiunta === total) report.fatal.push("nessun gruppo AGGIUNTA trovato: il plugin Product Add-ons è cambiato");

  const sortedLabels = [...referenceKey.keys()].sort((a, b) => a.localeCompare(b, "it"));
  report.aggiunta = sortedLabels.map((label, index) => ({
    // Display name comes from the first product that carries the option, so
    // the site's original casing ("Pomodoro di Pachino") survives.
    name: displayNameOf(parsed, label),
    priceDelta: Number((referenceKey.get(label) ?? 0).toFixed(2)),
    componentType: "ingredient",
    componentId: displayNameOf(parsed, label),
    quantity: 1,
    unit: "pz",
    isActive: true,
    sortOrder: index,
  }));
  report.lines.push(`AGGIUNTA: ${report.aggiunta.length} opzioni identiche su ${total - missingAggiunta}/${total} pizze`);

  // PIZZA CELIACA: a flat checkbox, expected on every pizza.
  const celiacPrices = new Set<number>();
  let celiacMissing = 0;
  for (const { product, groups } of parsed) {
    const option = groups.flatMap((group) => group.options).find((candidate) => /celiac/i.test(candidate.label));
    if (!option) {
      celiacMissing += 1;
      continue;
    }
    celiacPrices.add(option.price);
  }
  if (celiacPrices.size > 1) {
    report.fatal.push(`PIZZA CELIACA con prezzi discordi: ${[...celiacPrices].map(money).join(", ")}`);
  }
  if (celiacPrices.size === 0) {
    report.fatal.push("opzione PIZZA CELIACA non trovata su nessuna pizza");
  } else {
    const price = [...celiacPrices][0];
    report.celiac = {
      name: "Pizza celiaca",
      priceDelta: Number(price.toFixed(2)),
      componentType: "ingredient",
      componentId: "Pizza celiaca",
      quantity: 1,
      unit: "pz",
      isActive: true,
      sortOrder: 0,
    };
    report.lines.push(`PIZZA CELIACA: ${money(price)} su ${total - celiacMissing}/${total} pizze`);
  }

  // MAXI: the site charges exactly the pizza base price (a ×2). Report any
  // product whose stored delta disagrees — the pool uses the multiplier, so
  // those site typos are corrected for free.
  let maxiChecked = 0;
  const missingMaxi: string[] = [];
  for (const { product, groups } of parsed) {
    const maxi = groups.flatMap((group) => group.options).filter((option) => normalize(option.label) === "maxi");
    if (maxi.length === 0) {
      missingMaxi.push(product.name);
      continue;
    }
    maxiChecked += 1;
    const delta = Math.max(...maxi.map((option) => option.price));
    if (Math.abs(delta - product.price) > 0.001) {
      report.anomalies.push(`${product.name}: MAXI ${money(delta)} vs prezzo base ${money(product.price)} (pool ×2 prevale)`);
    }
    if (maxi.length > 1) {
      report.anomalies.push(`${product.name}: ${maxi.length} opzioni MAXI duplicate`);
    }
  }
  report.lines.push(`MAXI: presente su ${maxiChecked}/${total} pizze, delta = prezzo base (pool priceMultiplier 2)`);
  if (missingMaxi.length > 0) {
    report.skipped.push(`MAXI assente dal sito su: ${missingMaxi.join(", ")} (il pool ×2 le copre comunque)`);
  }

  // Everything else on the page is informational: it is either the per-pizza
  // "Togli" list (dish composition) or the 0,00 "SEGUE" course markers.
  const otherGroups = new Map<string, number>();
  for (const { groups } of parsed) {
    for (const group of groups) {
      const key = normalize(group.name);
      if (key === "aggiunta" || group.options.some((option) => normalize(option.label) === "maxi")) continue;
      otherGroups.set(group.name, (otherGroups.get(group.name) ?? 0) + 1);
    }
  }
  const missingTogli = parsed
    .filter(({ groups }) => !groups.some((group) => normalize(group.name) === "togli"))
    .map(({ product }) => product.name);
  for (const [name, count] of otherGroups) {
    report.skipped.push(`gruppo "${name}" su ${count}/${total} pizze (non importato)`);
  }
  if (missingTogli.length > 0) {
    report.skipped.push(`nessun gruppo "Togli" su: ${missingTogli.join(", ")}`);
  }

  return report;
}

function displayNameOf(parsed: Array<{ product: WooProduct; groups: PaoGroup[] }>, label: string): string {
  for (const { groups } of parsed) {
    for (const group of groups) {
      const option = group.options.find((candidate) => normalize(candidate.label) === label);
      if (option) return option.label;
    }
  }
  return label;
}

function buildDesiredPools(report: ValidationReport): DesiredPool[] {
  const pools: DesiredPool[] = [];
  if (report.celiac) {
    pools.push({ name: "Senza glutine", sortOrder: POOL_SORT["senza glutine"], options: [report.celiac] });
  }
  pools.push({ name: "AGGIUNTA", sortOrder: POOL_SORT.aggiunta, options: report.aggiunta });
  return pools;
}

type PlanStep =
  | { kind: "create"; description: string; pool: DesiredPool }
  | { kind: "update"; description: string; poolId: string; poolName: string; patch: Record<string, unknown> };

function reconcile(desired: DesiredPool[], existing: ExistingPool[]): PlanStep[] {
  const steps: PlanStep[] = [];
  const byName = new Map(existing.map((pool) => [normalize(pool.name), pool]));

  // MAXI keeps its own pool: only the display order is updated, the options
  // (priceMultiplier=2) are never sent back through the wholesale PATCH.
  const maxi = byName.get("maxi");
  const wantedMaxiSort = POOL_SORT.maxi;
  if (maxi) {
    if (maxi.sortOrder !== wantedMaxiSort) {
      steps.push({
        kind: "update",
        description: `~ "${maxi.name}" sortOrder ${maxi.sortOrder} → ${wantedMaxiSort} (opzioni intatte)`,
        poolId: maxi.id,
        poolName: maxi.name,
        patch: { sortOrder: wantedMaxiSort },
      });
    }
    const multiplier = maxi.options[0]?.priceMultiplier;
    if (maxi.options.length !== 1 || multiplier == null || Math.abs(Number(multiplier) - 2) > 0.001) {
      console.warn(
        `      ⚠ "${maxi.name}": atteso 1 opzione con priceMultiplier 2, trovato ${maxi.options.length} opzioni / multiplier=${multiplier ?? "null"} — non modificato`,
      );
    }
  } else {
    steps.push({
      kind: "create",
      description: `+ crea pool "MAXI" (1 opzione, priceMultiplier 2)`,
      pool: {
        name: "MAXI",
        sortOrder: wantedMaxiSort,
        options: [
          {
            name: "MAXI",
            priceDelta: 0,
            priceMultiplier: 2,
            componentType: "ingredient",
            componentId: "MAXI",
            quantity: 1,
            unit: "pz",
            isActive: true,
            sortOrder: 0,
          },
        ],
      },
    });
  }

  for (const pool of desired) {
    const current = byName.get(normalize(pool.name));
    if (!current) {
      steps.push({
        kind: "create",
        description: `+ crea pool "${pool.name}" (${pool.options.length} opzioni, sortOrder ${pool.sortOrder})`,
        pool,
      });
      continue;
    }

    const patch: Record<string, unknown> = {};
    if (current.sortOrder !== pool.sortOrder) {
      patch.sortOrder = pool.sortOrder;
    }
    const currentKeys = current.options.map(optionKey).sort();
    const desiredKeys = pool.options.map(optionKey).sort();
    const sameContent =
      current.options.length === pool.options.length && currentKeys.every((key, index) => key === desiredKeys[index]);
    if (!sameContent) patch.options = pool.options;

    if (Object.keys(patch).length === 0) {
      console.log(`      = "${pool.name}" invariato`);
      continue;
    }
    const bits: string[] = [];
    if (patch.sortOrder !== undefined) bits.push(`sortOrder ${current.sortOrder} → ${pool.sortOrder}`);
    if (patch.options !== undefined) bits.push(`${current.options.length} → ${pool.options.length} opzioni`);
    steps.push({
      kind: "update",
      description: `~ "${pool.name}" ${bits.join(", ")}`,
      poolId: current.id,
      poolName: pool.name,
      patch,
    });
  }

  return steps;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

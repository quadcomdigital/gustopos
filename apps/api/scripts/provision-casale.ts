/**
 * One-off provisioning for the "Antico Casale" tenant.
 *
 * Uses only public/superadmin/admin HTTP endpoints (same calls the UI makes):
 *   1. superadmin login
 *   2. create tenant (idempotent by slug)
 *   3. set the Base menu/POS module set (simple_catalog)
 *   4. impersonate -> admin token, reset the admin PIN to a known value
 *   5. reconcile the 12 menu categories + assign print stations
 *   6. create the "Pizzeria" print station
 *   7. import the WooCommerce Store catalog (~134 items)
 *
 * Run:
 *   SUPERADMIN_PASSWORD=... npx tsx scripts/provision-casale.ts
 * Optional env: API_BASE, SUPERADMIN_USERNAME, ADMIN_PIN, WOO_BASE
 */
import crypto from "node:crypto";

const API_BASE = (process.env.API_BASE ?? "http://127.0.0.1:11901").replace(/\/$/, "");
const SA_USER = process.env.SUPERADMIN_USERNAME ?? "superadmin";
const SA_PASS = process.env.SUPERADMIN_PASSWORD;
const WOO_BASE = (process.env.WOO_BASE ?? "https://anticocasalericevimenti.it/wp-json/wc/store").replace(/\/$/, "");
const ADMIN_PIN = process.env.ADMIN_PIN ?? String(crypto.randomInt(1000, 9999));

const TENANT = {
  name: "Antico Casale",
  slug: "casale",
  domain: "test.anticocasalericevimenti.it",
};

const ENABLE = ["kitchen", "course_rounds", "printing", "simple_catalog", "public_menu", "customers", "analytics"];
const DISABLE = [
  "inventory",
  "purchasing_suppliers",
  "public_takeaway",
  "consumer_accounts",
  "self_order_qr",
  "public_group_order",
  "loyalty_points",
  "reservations",
  "delivery",
  "staff_shifts_timeclock",
  "fiscal_exports",
];

const RENAME: Record<string, string> = { Pizze: "Pizzeria", Bevande: "Bibite", Dolci: "Dessert" };

const CATEGORIES = [
  "Antipasti",
  "Pizzeria",
  "Primi",
  "Secondi",
  "Contorni",
  "Frutta",
  "Dessert",
  "Bibite",
  "Caffe e Amari",
  "Coperti",
  "MENU FISSO",
  "MENU SETTIMANALE",
];

const CATEGORY_STATION: Record<string, string> = {
  Pizzeria: "Pizzeria",
  Bibite: "Bar",
  "Caffe e Amari": "Bar",
  Dessert: "Bar",
  Frutta: "Bar",
  Antipasti: "Cucina",
  Primi: "Cucina",
  Secondi: "Cucina",
  Contorni: "Cucina",
  Coperti: "Cucina",
  "MENU FISSO": "Cucina",
  "MENU SETTIMANALE": "Cucina",
};

type Json = Record<string, unknown>;

async function api<T = unknown>(
  method: string,
  path: string,
  token: string | null,
  body?: unknown,
): Promise<T> {
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

async function woo<T = unknown>(path: string): Promise<T> {
  const response = await fetch(`${WOO_BASE}${path}`);
  if (!response.ok) {
    throw new Error(`WOO ${path} -> ${response.status}`);
  }
  return (await response.json()) as T;
}

async function fetchAllWooProducts(): Promise<Array<{ name: string; price: number; category: string }>> {
  const products: Array<{ name: string; price: number; category: string }> = [];
  for (let page = 1; page <= 20; page += 1) {
    const batch = await woo<Json[]>(`/products?per_page=100&page=${page}`);
    if (!Array.isArray(batch) || batch.length === 0) break;
    for (const product of batch) {
      const name = String(product.name ?? "").trim();
      const prices = (product.prices ?? {}) as Json;
      const minor = Number(prices.currency_minor_unit ?? 2);
      const raw = Number(prices.price ?? 0);
      const price = Math.round((raw / 10 ** minor) * 100) / 100;
      const categories = (product.categories ?? []) as Array<{ name?: string }>;
      const category = String(categories[0]?.name ?? "").trim();
      if (name.length >= 2 && category.length >= 2) {
        products.push({ name, price, category });
      }
    }
    if (batch.length < 100) break;
  }
  return products;
}

async function main() {
  if (!SA_PASS) throw new Error("SUPERADMIN_PASSWORD is required");

  console.log(`[1/7] superadmin login (${API_BASE})`);
  const login = await api<{ token: string }>("POST", "/api/superadmin/auth/login", null, {
    username: SA_USER,
    password: SA_PASS,
  });
  const saToken = login.token;

  console.log(`[2/7] tenant ${TENANT.slug}`);
  const tenants = await api<Array<{ id: string; slug: string; domain?: string }>>("GET", "/api/superadmin/tenants", saToken);
  let tenant = tenants.find((t) => t.slug === TENANT.slug || t.domain === TENANT.domain);
  if (!tenant) {
    tenant = await api<{ id: string; slug: string; domain?: string }>("POST", "/api/superadmin/tenants", saToken, TENANT);
    console.log(`      created ${tenant.id}`);
  } else {
    console.log(`      exists ${tenant.id}`);
  }
  const tenantId = tenant.id;

  console.log(`[3/7] modules`);
  for (const moduleKey of ENABLE) {
    await api("POST", `/api/superadmin/tenants/${tenantId}/modules/toggle`, saToken, { moduleKey, enabled: true });
  }
  for (const moduleKey of DISABLE) {
    await api("POST", `/api/superadmin/tenants/${tenantId}/modules/toggle`, saToken, { moduleKey, enabled: false });
  }
  const health = await api<{ modules: Array<{ moduleKey: string; enabled: boolean }> }>(
    "GET",
    `/api/superadmin/tenants/${tenantId}/health`,
    saToken,
  );
  const enabled = health.modules.filter((m) => m.enabled).map((m) => m.moduleKey).sort();
  console.log(`      enabled: ${enabled.join(", ")}`);

  console.log(`[4/7] impersonate + admin PIN`);
  const impersonation = await api<{ token: string }>("POST", `/api/superadmin/tenants/${tenantId}/impersonate`, saToken, {});
  const adminToken = impersonation.token;
  const staff = await api<Array<{ id: string; role: string; isActive: boolean }>>("GET", "/api/staff", adminToken);
  const admin = staff.find((s) => s.role === "admin" && s.isActive);
  if (!admin) throw new Error("no active admin staff found");
  await api("POST", `/api/staff/${admin.id}/reset-pin`, adminToken, { pin: ADMIN_PIN });
  console.log(`      admin PIN set`);

  console.log(`[5/7] categories + stations`);
  const stations = await api<Array<{ id: string; name: string }>>("GET", "/api/print-stations", adminToken);
  const stationByName = new Map(stations.map((s) => [s.name, s.id]));
  if (!stationByName.has("Pizzeria")) {
    const created = await api<{ id: string; name: string }>("POST", "/api/print-stations", adminToken, {
      name: "Pizzeria",
      kind: "production",
      sortOrder: 1,
    });
    stationByName.set(created.name, created.id);
    console.log(`      created station Pizzeria`);
  }
  if (!stationByName.has("Cucina") || !stationByName.has("Bar")) {
    throw new Error("expected bootstrap stations Cucina and Bar");
  }

  let categories = await api<Array<{ id: string; name: string; scope: string }>>(
    "GET",
    "/api/simple-catalog/categories",
    adminToken,
  );
  for (const [from, to] of Object.entries(RENAME)) {
    const existing = categories.find((c) => c.name === from);
    if (existing && !categories.some((c) => c.name === to)) {
      await api("PATCH", `/api/simple-catalog/categories/${existing.id}`, adminToken, { name: to });
      console.log(`      renamed ${from} -> ${to}`);
    }
  }
  categories = await api<Array<{ id: string; name: string; scope: string }>>("GET", "/api/simple-catalog/categories", adminToken);
  for (const name of CATEGORIES) {
    if (!categories.some((c) => c.name === name)) {
      await api("POST", "/api/simple-catalog/categories", adminToken, { name, scope: "menu", printAreas: [] });
      console.log(`      created category ${name}`);
    }
  }
  categories = await api<Array<{ id: string; name: string; scope: string }>>("GET", "/api/simple-catalog/categories", adminToken);
  const categoryByName = new Map(categories.map((c) => [c.name, c.id]));
  for (const name of CATEGORIES) {
    const stationId = stationByName.get(CATEGORY_STATION[name]);
    const categoryId = categoryByName.get(name);
    if (stationId && categoryId) {
      await api("PATCH", `/api/simple-catalog/categories/${categoryId}`, adminToken, { stationId });
    }
  }
  console.log(`      ${categories.length} menu categories, stations assigned`);

  console.log(`[6/7] fetch WooCommerce catalog`);
  const wooProducts = await fetchAllWooProducts();
  console.log(`      ${wooProducts.length} products`);

  console.log(`[7/7] import items`);
  const existingItems = await api<Array<{ name: string }>>("GET", "/api/simple-catalog/items", adminToken);
  const existingNames = new Set(existingItems.map((i) => i.name.toLowerCase()));
  let created = 0;
  let skipped = 0;
  const failures: string[] = [];
  for (const product of wooProducts) {
    if (existingNames.has(product.name.toLowerCase())) {
      skipped += 1;
      continue;
    }
    const categoryId = categoryByName.get(product.category);
    if (!categoryId) {
      failures.push(`${product.name} (unknown category "${product.category}")`);
      continue;
    }
    try {
      await api("POST", "/api/simple-catalog/items", adminToken, {
        name: product.name,
        price: product.price,
        category: product.category,
        categoryId,
        printAreas: [],
      });
      existingNames.add(product.name.toLowerCase());
      created += 1;
    } catch (error) {
      failures.push(`${product.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.log("\n=== RESULT ===");
  console.log(JSON.stringify(
    {
      tenantId,
      domain: TENANT.domain,
      modulesEnabled: enabled,
      adminPin: ADMIN_PIN,
      categories: categoryByName.size,
      itemsCreated: created,
      itemsSkipped: skipped,
      itemsFailed: failures.length,
      failures: failures.slice(0, 20),
    },
    null,
    2,
  ));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

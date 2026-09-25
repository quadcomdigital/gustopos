import test, { before, type TestContext } from "node:test";
import assert from "node:assert/strict";

/**
 * End-to-end guard tests against a running API: the public menu must never
 * carry a POS-only JOLLY item nor a price multiplier for a tenant that did not
 * opt into the capability.
 *
 * They SKIP (never fail) when the API is not reachable, so the suite stays
 * green in environments that only run unit tests.
 */

const API_URL = process.env.API_URL?.trim() || "http://localhost:11901";

type PublicMenu = {
  items: Array<{ id: string; name: string; price: number }>;
  categoryModifierPools: Array<{
    name: string;
    options: Array<{ name: string; priceMultiplier?: number | null }>;
  }>;
};

const menus: { franks: PublicMenu | null; casale: PublicMenu | null } = {
  franks: null,
  casale: null,
};

async function fetchMenu(slug: string): Promise<PublicMenu | null> {
  try {
    const response = await fetch(`${API_URL}/api/public/menu?slug=${encodeURIComponent(slug)}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    return (await response.json()) as PublicMenu;
  } catch {
    return null;
  }
}

before(async () => {
  [menus.franks, menus.casale] = await Promise.all([fetchMenu("franks"), fetchMenu("casale")]);
});

/** Skips the test at runtime (a `skip` option would be evaluated too early). */
function requireMenu(t: TestContext, menu: PublicMenu | null): menu is PublicMenu {
  if (menu) return true;
  t.skip("API not reachable");
  return false;
}

const multiplierOptions = (menu: PublicMenu, match: (value: number) => boolean) =>
  (menu.categoryModifierPools ?? []).flatMap((pool) =>
    (pool.options ?? []).filter(
      (option) => typeof option.priceMultiplier === "number" && match(option.priceMultiplier),
    ),
  );

test("public menu of franks exposes no JOLLY item", (t) => {
  if (!requireMenu(t, menus.franks)) return;
  const jolly = menus.franks.items.filter((item) => /jolly/i.test(item.name));
  assert.deepEqual(
    jolly.map((item) => item.name),
    [],
    "a JOLLY item must never be orderable online",
  );
});

test("public menu of franks exposes no free (€0) item", (t) => {
  if (!requireMenu(t, menus.franks)) return;
  const free = menus.franks.items.filter((item) => item.price === 0);
  assert.deepEqual(
    free.map((item) => item.name),
    [],
    "no zero-priced item may be publicly purchasable",
  );
});

test("public menu of franks exposes no price multiplier (base behaviour)", (t) => {
  if (!requireMenu(t, menus.franks)) return;
  const scaled = multiplierOptions(menus.franks, (value) => value !== 1);
  assert.deepEqual(
    scaled.map((option) => option.name),
    [],
    "tenants without the override must see additive-only pricing",
  );
});

test("public menu of casale keeps its MAXI ×2 pool (override honoured)", (t) => {
  if (!requireMenu(t, menus.casale)) return;
  const scaled = multiplierOptions(menus.casale, (value) => value === 2);
  assert.ok(scaled.length > 0, "casale opted into modifierMultiplier, the ×2 must survive");
});

test("server-side repricing refuses a POS-only JOLLY line", async (t) => {
  if (!requireMenu(t, menus.casale)) return;
  // The JOLLY product of casale is hidden from the public catalog, so this can
  // only be rejected — it never creates an order, whatever the guard does.
  const jolly = menus.casale.items.find((item) => /jolly/i.test(item.name));
  assert.equal(jolly, undefined, "the casale JOLLY must stay hidden from the catalog");

  const response = await fetch(`${API_URL}/api/public/casale/takeaway/orders`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      items: [{ id: "m_mufssj3d_0xx4v4", name: "JOLLY", price: 0, quantity: 1 }],
      total: 1,
      customerName: "Menu guard test",
    }),
    signal: AbortSignal.timeout(5000),
  });
  const body = (await response.json().catch(() => ({}))) as { message?: string };
  assert.equal(response.status, 400, `expected a rejection, got ${response.status}`);
  assert.match(body.message ?? "", /not available for online ordering/);
});

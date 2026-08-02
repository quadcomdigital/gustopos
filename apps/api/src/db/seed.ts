import { db } from "./client";
import {
  bomComponents,
  bomItems,
  inventory,
  menuItemBomRequirements,
  menuItemIngredients,
  menuItems,
  tenantModules,
  tenants,
  superadminUsers,
  staff,
  tables,
} from "./schema";
import { hashPin } from "../auth/pin-hash";

export async function seedInitialData(): Promise<void> {
  const isProduction = process.env.NODE_ENV === "production";

  const existingSuperadmin = await db.select().from(superadminUsers).limit(1);
  if (existingSuperadmin.length === 0) {
    const username = process.env.SUPERADMIN_USERNAME?.trim();
    const password = process.env.SUPERADMIN_PASSWORD?.trim();
    // Never fall back to the well-known default password in production: a
    // fresh database must fail boot with an explicit message instead of
    // silently creating superadmin / ChangeMe123!.
    if (isProduction && (!username || !password)) {
      throw new Error(
        "SUPERADMIN_USERNAME and SUPERADMIN_PASSWORD must be set in production before seeding; refusing to create default superadmin credentials",
      );
    }
    const passwordHash = await hashPin(password || "ChangeMe123!");

    await db.insert(superadminUsers).values({
      id: "sa_1",
      username: username || "superadmin",
      passwordHash,
      isActive: 1,
    });
  }

  const existingStaff = await db.select().from(staff).limit(1);
  if (existingStaff.length > 0) {
    return;
  }

  // Demo data below (staff PINs 1234/2222/3333, legacy tenant, inventory,
  // menu, tables) is for local development only. A fresh production database
  // must not silently receive accounts with publicly known PINs.
  if (isProduction && process.env.GUSTOPOS_SEED_DEMO !== "1") {
    console.warn(
      "[seed] production boot with empty staff table: skipping demo data (set GUSTOPOS_SEED_DEMO=1 to force)",
    );
    return;
  }

  const [adminPinHash, waiterPinHash, chefPinHash] = await Promise.all([
    hashPin("1234"),
    hashPin("2222"),
    hashPin("3333"),
  ]);

  await db.insert(staff).values([
    { id: "s1", tenantId: "tenant_legacy", name: "Marco", role: "admin", pin: adminPinHash, isActive: 1 },
    { id: "s2", tenantId: "tenant_legacy", name: "Giulia", role: "waiter", pin: waiterPinHash, isActive: 1 },
    { id: "s3", tenantId: "tenant_legacy", name: "Luca", role: "chef", pin: chefPinHash, isActive: 1 },
  ]);

  await db.insert(tenants).values({
    id: "tenant_legacy",
    slug: "legacy",
    name: "GustoPOS Legacy",
    subdomain: "legacy",
    domain: null,
    isActive: 1,
    resolutionOrder: "subdomain,slug,header,jwt",
  });

  await db.insert(tenantModules).values([
    { id: "tm1", tenantId: "tenant_legacy", moduleKey: "kitchen", enabled: 1 },
    { id: "tm2", tenantId: "tenant_legacy", moduleKey: "inventory", enabled: 1 },
    { id: "tm3", tenantId: "tenant_legacy", moduleKey: "customers", enabled: 1 },
    { id: "tm4", tenantId: "tenant_legacy", moduleKey: "analytics", enabled: 1 },
    { id: "tm5", tenantId: "tenant_legacy", moduleKey: "printing", enabled: 1 },
    { id: "tm6", tenantId: "tenant_legacy", moduleKey: "public_menu", enabled: 1 },
  ]);

  await db.insert(inventory).values([
    { id: "1", tenantId: "tenant_legacy", name: "Farina 00", quantity: "50", unit: "kg", minThreshold: "10", unitCost: "1.20" },
    { id: "2", tenantId: "tenant_legacy", name: "Pomodori", quantity: "20", unit: "kg", minThreshold: "5", unitCost: "2.50" },
    { id: "3", tenantId: "tenant_legacy", name: "Mozzarella", quantity: "15", unit: "kg", minThreshold: "5", unitCost: "8.00" },
    { id: "4", tenantId: "tenant_legacy", name: "Birra alla spina", quantity: "100", unit: "L", minThreshold: "20", unitCost: "1.50" },
  ]);

  await db.insert(menuItems).values([
    { id: "m1", tenantId: "tenant_legacy", name: "Margherita", price: "7.5", category: "Pizze", isActive: 1 },
    { id: "m2", tenantId: "tenant_legacy", name: "Diavola", price: "9.0", category: "Pizze", isActive: 1 },
    { id: "m3", tenantId: "tenant_legacy", name: "Birra Media", price: "5.0", category: "Bevande", isActive: 1 },
    { id: "m4", tenantId: "tenant_legacy", name: "Acqua Naturale", price: "2.0", category: "Bevande", isActive: 1 },
  ]);

  await db.insert(menuItemIngredients).values([
    { tenantId: "tenant_legacy", menuItemId: "m1", ingredientId: "1" },
    { tenantId: "tenant_legacy", menuItemId: "m1", ingredientId: "2" },
    { tenantId: "tenant_legacy", menuItemId: "m1", ingredientId: "3" },
    { tenantId: "tenant_legacy", menuItemId: "m2", ingredientId: "1" },
    { tenantId: "tenant_legacy", menuItemId: "m2", ingredientId: "2" },
    { tenantId: "tenant_legacy", menuItemId: "m2", ingredientId: "3" },
    { tenantId: "tenant_legacy", menuItemId: "m3", ingredientId: "4" },
  ]);

  await db.insert(bomItems).values([
    { id: "b1", tenantId: "tenant_legacy", name: "Impasto Pizza", unit: "kg", yieldQuantity: "1", isActive: 1 },
    { id: "b2", tenantId: "tenant_legacy", name: "Salsa Pomodoro Base", unit: "kg", yieldQuantity: "1", isActive: 1 },
  ]);

  await db.insert(bomComponents).values([
    { tenantId: "tenant_legacy", bomId: "b1", componentType: "ingredient", componentId: "1", quantity: "0.7", unit: "kg" },
    { tenantId: "tenant_legacy", bomId: "b1", componentType: "ingredient", componentId: "3", quantity: "0.3", unit: "kg" },
    { tenantId: "tenant_legacy", bomId: "b2", componentType: "ingredient", componentId: "2", quantity: "1", unit: "kg" },
  ]);

  await db.insert(menuItemBomRequirements).values([
    { tenantId: "tenant_legacy", menuItemId: "m1", bomId: "b1", quantity: "0.25", unit: "kg" },
    { tenantId: "tenant_legacy", menuItemId: "m1", bomId: "b2", quantity: "0.12", unit: "kg" },
    { tenantId: "tenant_legacy", menuItemId: "m2", bomId: "b1", quantity: "0.25", unit: "kg" },
    { tenantId: "tenant_legacy", menuItemId: "m2", bomId: "b2", quantity: "0.14", unit: "kg" },
  ]);

  await db.insert(tables).values(
    Array.from({ length: 12 }, (_, i) => ({
      id: `t${i + 1}`,
      tenantId: "tenant_legacy",
      number: String(i + 1),
      status: "free",
      currentOrderId: null,
    })),
  );
}

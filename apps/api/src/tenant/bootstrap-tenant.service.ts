import { Injectable, Logger } from "@nestjs/common";
import crypto from "node:crypto";
import { db } from "../db/client";
import {
  staff,
  tables,
  categories,
  printStations,
  tenantAuditLogs,
} from "../db/schema";
import { hashPin } from "../auth/pin-hash";

/**
 * BootstrapTenantService
 *
 * Creates initial operational data for a new tenant:
 * - Admin staff member with a random PIN
 * - 12 default tables
 * - Default categories (menu + inventory scopes)
 *
 * Called automatically after tenant creation via superadmin.
 */
@Injectable()
export class BootstrapTenantService {
  private readonly logger = new Logger(BootstrapTenantService.name);

  async bootstrap(tenantId: string): Promise<void> {
    const now = new Date();
    const adminPin = this.generatePin();
    const adminPinHash = await hashPin(adminPin);

    this.logger.log(`Bootstrapping tenant ${tenantId} with admin PIN: ${adminPin}`);

    await db.transaction(async (tx) => {
      // 1. Create admin staff
      const adminId = `s_${crypto.randomUUID()}`;
      await tx.insert(staff).values({
        id: adminId,
        tenantId,
        name: "Admin",
        role: "admin",
        pin: adminPinHash,
        isActive: 1,
        createdAt: now,
        updatedAt: now,
      });

      // 2. Create 12 default tables
      const tableInserts = Array.from({ length: 12 }, (_, i) => ({
        id: `tbl_${crypto.randomUUID()}`,
        tenantId,
        number: String(i + 1),
        status: "free" as const,
        currentOrderId: null,
      }));
      await tx.insert(tables).values(tableInserts);

      // 3. Create default print stations (Cucina = default, Bar) and the menu
      //    categories assigned to them. Station ids are deterministic so the
      //    migration backfill and bootstrap agree on the same keys.
      const kitchenStationId = `st_${crypto.createHash("md5").update(`${tenantId}:kitchen`).digest("hex").slice(0, 20)}`;
      const barStationId = `st_${crypto.createHash("md5").update(`${tenantId}:bar`).digest("hex").slice(0, 20)}`;
      await tx.insert(printStations).values([
        { id: kitchenStationId, tenantId, name: "Cucina", kind: "production", isDefault: 1, sortOrder: 0, isActive: 1, createdAt: now, updatedAt: now },
        { id: barStationId, tenantId, name: "Bar", kind: "production", isDefault: 0, sortOrder: 2, isActive: 1, createdAt: now, updatedAt: now },
      ]);

      // 4. Create default categories
      const categoryInserts = [
        // Menu scope categories
        { id: `cat_${crypto.randomUUID()}`, tenantId, name: "Pizze", scope: "menu" as const, stationId: kitchenStationId, printAreas: '["kitchen"]', isActive: 1, createdAt: now, updatedAt: now },
        { id: `cat_${crypto.randomUUID()}`, tenantId, name: "Primi", scope: "menu" as const, stationId: kitchenStationId, printAreas: '["kitchen"]', isActive: 1, createdAt: now, updatedAt: now },
        { id: `cat_${crypto.randomUUID()}`, tenantId, name: "Secondi", scope: "menu" as const, stationId: kitchenStationId, printAreas: '["kitchen"]', isActive: 1, createdAt: now, updatedAt: now },
        { id: `cat_${crypto.randomUUID()}`, tenantId, name: "Bevande", scope: "menu" as const, stationId: barStationId, printAreas: '["bar"]', isActive: 1, createdAt: now, updatedAt: now },
        { id: `cat_${crypto.randomUUID()}`, tenantId, name: "Dolci", scope: "menu" as const, stationId: kitchenStationId, printAreas: '["kitchen"]', isActive: 1, createdAt: now, updatedAt: now },
        // Ingredient scope categories (for inventory management)
        { id: `cat_${crypto.randomUUID()}`, tenantId, name: "Merce", scope: "ingredient" as const, stationId: null, printAreas: '[]', isActive: 1, createdAt: now, updatedAt: now },
      ];
      await tx.insert(categories).values(categoryInserts);

      // 5. Log the bootstrap event
      await tx.insert(tenantAuditLogs).values({
        id: `tal_${crypto.randomUUID()}`,
        tenantId,
        actor: "system",
        event: "tenant.bootstrapped",
        payload: JSON.stringify({
          adminId,
          tablesCreated: 12,
          categoriesCreated: categoryInserts.length,
          adminPinLength: adminPin.length,
        }),
        createdAt: now,
      });
    });

    this.logger.log(`Tenant ${tenantId} bootstrapped successfully`);
  }

  private generatePin(): string {
    // Generate a secure 4-digit PIN
    const num = crypto.randomInt(1000, 9999);
    return String(num);
  }
}

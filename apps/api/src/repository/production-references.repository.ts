import { Injectable } from "@nestjs/common";
import { and, asc, eq } from "drizzle-orm";
import { db } from "../db/client";
import { productionReferences } from "../db/schema";
import { getTenantIdOrDefault } from "../tenant/tenant-context.store";
import {
  productionReferenceCreateRequestSchema,
  productionReferenceSchema,
  productionReferenceUpdateRequestSchema,
  type ProductionReference,
  type ProductionReferenceCreateRequest,
  type ProductionReferenceUpdateRequest,
} from "@gustopos/shared";

/**
 * Production references ("contenitori"/basi): BUN, Piadina, Panino, A piatto…
 * Resolution precedence on an order line: main modifier (lowest sort_order)
 * > product > category. There is intentionally no name/regex inference.
 */
@Injectable()
export class ProductionReferencesRepository {
  private toReference(row: typeof productionReferences.$inferSelect): ProductionReference {
    return productionReferenceSchema.parse({
      id: row.id,
      name: row.name,
      sortOrder: row.sortOrder,
      isActive: row.isActive === 1,
      createdAt: row.createdAt?.toISOString?.() ?? undefined,
      updatedAt: row.updatedAt?.toISOString?.() ?? undefined,
    });
  }

  async listReferences(): Promise<ProductionReference[]> {
    const tenantId = getTenantIdOrDefault();
    const rows = await db
      .select()
      .from(productionReferences)
      .where(eq(productionReferences.tenantId, tenantId))
      .orderBy(asc(productionReferences.sortOrder), asc(productionReferences.name));
    return rows.map((row) => this.toReference(row));
  }

  async listActiveReferences(): Promise<ProductionReference[]> {
    const tenantId = getTenantIdOrDefault();
    const rows = await db
      .select()
      .from(productionReferences)
      .where(and(eq(productionReferences.tenantId, tenantId), eq(productionReferences.isActive, 1)))
      .orderBy(asc(productionReferences.sortOrder), asc(productionReferences.name));
    return rows.map((row) => this.toReference(row));
  }

  async getReference(id: string): Promise<ProductionReference | null> {
    const tenantId = getTenantIdOrDefault();
    const rows = await db
      .select()
      .from(productionReferences)
      .where(and(eq(productionReferences.tenantId, tenantId), eq(productionReferences.id, id)))
      .limit(1);
    return rows.length > 0 ? this.toReference(rows[0]) : null;
  }

  async createReference(payload: ProductionReferenceCreateRequest): Promise<ProductionReference> {
    const tenantId = getTenantIdOrDefault();
    const parsed = productionReferenceCreateRequestSchema.parse(payload);
    const existing = await this.listReferences();
    const sortOrder = parsed.sortOrder ?? (existing.length > 0 ? Math.max(...existing.map((r) => r.sortOrder)) + 1 : 0);
    const id = `ref_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

    await db.insert(productionReferences).values({
      id,
      tenantId,
      name: parsed.name,
      sortOrder,
      isActive: parsed.isActive === false ? 0 : 1,
    });

    const created = await this.getReference(id);
    if (!created) throw new Error("Failed to create production reference");
    return created;
  }

  async updateReference(id: string, payload: ProductionReferenceUpdateRequest): Promise<ProductionReference | null> {
    const parsed = productionReferenceUpdateRequestSchema.parse(payload);
    const tenantId = getTenantIdOrDefault();
    const target = await this.getReference(id);
    if (!target) return null;

    await db
      .update(productionReferences)
      .set({
        ...(parsed.name !== undefined ? { name: parsed.name } : {}),
        ...(parsed.sortOrder !== undefined ? { sortOrder: parsed.sortOrder } : {}),
        ...(parsed.isActive !== undefined ? { isActive: parsed.isActive ? 1 : 0 } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(productionReferences.tenantId, tenantId), eq(productionReferences.id, id)));

    return this.getReference(id);
  }

  async deleteReference(id: string): Promise<boolean> {
    const tenantId = getTenantIdOrDefault();
    const deleted = await db
      .delete(productionReferences)
      .where(and(eq(productionReferences.tenantId, tenantId), eq(productionReferences.id, id)))
      .returning({ id: productionReferences.id });
    return deleted.length > 0;
  }
}

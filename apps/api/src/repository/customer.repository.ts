import { Injectable } from "@nestjs/common";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "../db/client";
import { customers, customerAddresses, orders } from "../db/schema";
import { getTenantIdOrDefault } from "../tenant/tenant-context.store";
import {
  customerCreateRequestSchema,
  customersQuerySchema,
  customerListResponseSchema,
  customerSchema,
  customerAddressCreateRequestSchema,
  customerAddressUpdateRequestSchema,
  customerAnalyticsRequestSchema,
  customerAnalyticsSchema,
  type CustomerCreateRequest,
  type CustomerAddressCreateRequest,
  type CustomerAddressUpdateRequest,
  type CustomersQuery,
  type Customer,
  type CustomerAnalytics,
  type CustomerAnalyticsRequest,
} from "@gustopos/shared";

function normalizeCustomerName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

@Injectable()
export class CustomerRepository {
  private mapCustomerRow(params: {
    row: typeof customers.$inferSelect;
    totalOrders: number;
    totalSpent: number;
    addresses?: Array<typeof customerAddresses.$inferSelect>;
  }): Customer {
    const { row, totalOrders, totalSpent, addresses } = params;
    return customerSchema.parse({
      id: row.id,
      fullName: row.fullName,
      phone: row.phone ?? undefined,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      lastSeenAt: row.lastSeenAt ? row.lastSeenAt.toISOString() : undefined,
      totalOrders,
      totalSpent,
      addresses: addresses?.map((a) => ({
        id: a.id,
        label: a.label,
        address: a.address,
        isDefault: a.isDefault === 1,
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString(),
      })),
    });
  }

  async createOrReuseCustomer(payload: CustomerCreateRequest): Promise<typeof customers.$inferSelect> {
    const parsed = customerCreateRequestSchema.parse(payload);
    const tenantId = getTenantIdOrDefault();
    const normalized = normalizeCustomerName(parsed.fullName);

    if (parsed.phone) {
      const byPhone = await db
        .select()
        .from(customers)
        .where(and(eq(customers.tenantId, tenantId), eq(customers.phone, parsed.phone)))
        .limit(1);
      if (byPhone.length > 0) {
        return byPhone[0];
      }
    }

    const byName = await db
      .select()
      .from(customers)
      .where(and(eq(customers.tenantId, tenantId), eq(customers.fullNameNormalized, normalized)))
      .limit(1);
    if (byName.length > 0) {
      return byName[0];
    }

    const id = `c_${Date.now().toString(36)}`;
    const inserted = await db
      .insert(customers)
      .values({
        id,
        tenantId,
        fullName: parsed.fullName.trim(),
        fullNameNormalized: normalized,
        phone: parsed.phone ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSeenAt: null,
      })
      .returning();

    return inserted[0];
  }

  async listCustomers(query: CustomersQuery): Promise<Customer[]> {
    const parsed = customersQuerySchema.parse(query);
    const tenantId = getTenantIdOrDefault();
    const limit = parsed.limit ?? 50;

    const rows = await db
      .select()
      .from(customers)
      .where(eq(customers.tenantId, tenantId))
      .orderBy(desc(customers.updatedAt))
      .limit(limit);

    const filteredRows = parsed.query
      ? rows.filter((row) => {
          const q = parsed.query?.toLowerCase().trim() ?? "";
          return row.fullName.toLowerCase().includes(q) || (row.phone ?? "").toLowerCase().includes(q);
        })
      : rows;

    const customerIds = filteredRows.map((row) => row.id);
    const orderRows =
      customerIds.length > 0
        ? await db
            .select()
            .from(orders)
            .where(and(eq(orders.tenantId, tenantId), inArray(orders.customerId, customerIds)))
        : [];
    const totals = new Map<string, { count: number; sum: number }>();
    for (const row of orderRows) {
      if (!row.customerId) continue;
      const current = totals.get(row.customerId) ?? { count: 0, sum: 0 };
      totals.set(row.customerId, { count: current.count + 1, sum: current.sum + Number(row.total) });
    }

    return customerListResponseSchema.parse(
      filteredRows.map((row) => {
        const stats = totals.get(row.id) ?? { count: 0, sum: 0 };
        return this.mapCustomerRow({ row, totalOrders: stats.count, totalSpent: stats.sum });
      }),
    );
  }

  async getCustomerById(id: string): Promise<Customer | null> {
    const tenantId = getTenantIdOrDefault();
    const rows = await db
      .select()
      .from(customers)
      .where(and(eq(customers.tenantId, tenantId), eq(customers.id, id)))
      .limit(1);
    const row = rows[0];
    if (!row) {
      return null;
    }

    const [customerOrders, addresses] = await Promise.all([
      db.select().from(orders).where(and(eq(orders.tenantId, tenantId), eq(orders.customerId, id))),
      db.select().from(customerAddresses).where(and(eq(customerAddresses.tenantId, tenantId), eq(customerAddresses.customerId, id))).orderBy(desc(customerAddresses.isDefault), desc(customerAddresses.createdAt)),
    ]);
    return this.mapCustomerRow({
      row,
      totalOrders: customerOrders.length,
      totalSpent: customerOrders.reduce((sum, entry) => sum + Number(entry.total), 0),
      addresses,
    });
  }

  async listCustomerAddresses(customerId: string): Promise<Customer['addresses']> {
    const tenantId = getTenantIdOrDefault();
    const rows = await db
      .select()
      .from(customerAddresses)
      .where(and(eq(customerAddresses.tenantId, tenantId), eq(customerAddresses.customerId, customerId)))
      .orderBy(desc(customerAddresses.isDefault), desc(customerAddresses.createdAt));
    return rows.map((a) => ({
      id: a.id,
      label: a.label,
      address: a.address,
      isDefault: a.isDefault === 1,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    }));
  }

  async createCustomerAddress(customerId: string, payload: CustomerAddressCreateRequest): Promise<NonNullable<Customer['addresses']>[number]> {
    const parsed = customerAddressCreateRequestSchema.parse(payload);
    const tenantId = getTenantIdOrDefault();
    const id = `ca_${Date.now().toString(36)}`;
    const now = new Date();

    if (parsed.isDefault) {
      await db.update(customerAddresses).set({ isDefault: 0, updatedAt: now }).where(and(eq(customerAddresses.tenantId, tenantId), eq(customerAddresses.customerId, customerId)));
    }

    const rows = await db.insert(customerAddresses).values({
      id,
      tenantId,
      customerId,
      label: parsed.label ?? null,
      address: parsed.address,
      isDefault: parsed.isDefault ? 1 : 0,
      createdAt: now,
      updatedAt: now,
    }).returning();
    const row = rows[0];
    return { id: row.id, label: row.label, address: row.address, isDefault: row.isDefault === 1, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
  }

  async updateCustomerAddress(addressId: string, payload: CustomerAddressUpdateRequest): Promise<NonNullable<Customer['addresses']>[number] | null> {
    const parsed = customerAddressUpdateRequestSchema.parse(payload);
    const tenantId = getTenantIdOrDefault();
    const now = new Date();
    const updates: Record<string, unknown> = { updatedAt: now };
    if (parsed.label !== undefined) updates.label = parsed.label;
    if (parsed.address !== undefined) updates.address = parsed.address;
    if (parsed.isDefault !== undefined) {
      updates.isDefault = parsed.isDefault ? 1 : 0;
      if (parsed.isDefault) {
        const existing = await db.select().from(customerAddresses).where(eq(customerAddresses.id, addressId)).limit(1);
        if (existing.length > 0) {
          await db.update(customerAddresses).set({ isDefault: 0, updatedAt: now }).where(and(eq(customerAddresses.tenantId, tenantId), eq(customerAddresses.customerId, existing[0].customerId)));
        }
      }
    }
    const rows = await db.update(customerAddresses).set(updates).where(and(eq(customerAddresses.tenantId, tenantId), eq(customerAddresses.id, addressId))).returning();
    if (rows.length === 0) return null;
    const row = rows[0];
    return { id: row.id, label: row.label, address: row.address, isDefault: row.isDefault === 1, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
  }

  async deleteCustomerAddress(addressId: string): Promise<boolean> {
    const tenantId = getTenantIdOrDefault();
    const rows = await db.delete(customerAddresses).where(and(eq(customerAddresses.tenantId, tenantId), eq(customerAddresses.id, addressId))).returning();
    return rows.length > 0;
  }

  async updateCustomerById(id: string, payload: { fullName?: string; phone?: string | null }): Promise<Customer | null> {
    const tenantId = getTenantIdOrDefault();
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (payload.fullName !== undefined) {
      updates.fullName = payload.fullName.trim();
      updates.fullNameNormalized = normalizeCustomerName(payload.fullName);
    }
    if (payload.phone !== undefined) {
      updates.phone = payload.phone;
    }
    const rows = await db
      .update(customers)
      .set(updates)
      .where(and(eq(customers.tenantId, tenantId), eq(customers.id, id)))
      .returning();
    if (rows.length === 0) return null;
    return this.getCustomerById(id);
  }

  async deleteCustomerById(id: string): Promise<boolean> {
    const tenantId = getTenantIdOrDefault();
    const rows = await db
      .delete(customers)
      .where(and(eq(customers.tenantId, tenantId), eq(customers.id, id)))
      .returning();
    return rows.length > 0;
  }

  async getCustomerAnalytics(payload: CustomerAnalyticsRequest): Promise<CustomerAnalytics> {
    const parsed = customerAnalyticsRequestSchema.parse(payload);
    const tenantId = getTenantIdOrDefault();
    const customerRows = await db.select().from(customers).where(eq(customers.tenantId, tenantId));
    const orderRows = await db
      .select()
      .from(orders)
      .where(and(eq(orders.tenantId, tenantId), eq(orders.orderType, "takeaway")));

    const filteredOrders = orderRows.filter((row) => {
      if (parsed.from && row.timestamp < new Date(parsed.from)) return false;
      if (parsed.to && row.timestamp > new Date(parsed.to)) return false;
      return true;
    });

    const customerOrderCount = new Map<string, number>();
    const customerSpent = new Map<string, number>();
    for (const row of filteredOrders) {
      if (!row.customerId) continue;
      customerOrderCount.set(row.customerId, (customerOrderCount.get(row.customerId) ?? 0) + 1);
      customerSpent.set(row.customerId, (customerSpent.get(row.customerId) ?? 0) + Number(row.total));
    }

    const activeCustomers = [...customerOrderCount.keys()].length;
    const totalCustomers = customerRows.length;
    const repeatCustomers = [...customerOrderCount.values()].filter((value) => value > 1).length;
    const sumSpent = [...customerSpent.values()].reduce((sum, value) => sum + value, 0);
    const sumOrders = [...customerOrderCount.values()].reduce((sum, value) => sum + value, 0);

    const fromDate = parsed.from ? new Date(parsed.from) : null;
    const newCustomers = fromDate
      ? customerRows.filter((row) => row.createdAt >= fromDate).length
      : customerRows.length;

    return customerAnalyticsSchema.parse({
      totalCustomers,
      activeCustomers,
      newCustomers,
      repeatRate: activeCustomers > 0 ? repeatCustomers / activeCustomers : 0,
      avgSpendPerCustomer: activeCustomers > 0 ? sumSpent / activeCustomers : 0,
      avgOrdersPerCustomer: activeCustomers > 0 ? sumOrders / activeCustomers : 0,
    });
  }
}

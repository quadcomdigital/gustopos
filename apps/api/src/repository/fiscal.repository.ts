import { Injectable } from "@nestjs/common";
import crypto from "node:crypto";
import { and, desc, eq, gte, lte, SQL } from "drizzle-orm";
import { db } from "../db/client";
import { fiscalClosures, fiscalExports, timeEntries, payments } from "../db/schema";
import { getTenantIdOrDefault } from "../tenant/tenant-context.store";
import {
  fiscalClosureSchema,
  fiscalCloseRequestSchema,
  fiscalExportSchema,
  fiscalExportCreateRequestSchema,
  fiscalExportStatusSchema,
  fiscalExportsQuerySchema,
  timeReportQuerySchema,
  timeReportResponseSchema,
  type FiscalCloseRequest,
  type FiscalClosure,
  type FiscalExport,
  type FiscalExportCreateRequest,
  type FiscalExportsQuery,
  type TimeReportQuery,
  type TimeReportResponse,
} from "@gustopos/shared";

@Injectable()
export class FiscalRepository {
  async timeReport(query: TimeReportQuery): Promise<TimeReportResponse> {
    const parsed = timeReportQuerySchema.parse(query);
    const tenantId = getTenantIdOrDefault();
    const conditions: SQL[] = [eq(timeEntries.tenantId, tenantId), gte(timeEntries.clockInAt, new Date(parsed.from)), lte(timeEntries.clockInAt, new Date(parsed.to))];
    if (parsed.staffId) {
      conditions.push(eq(timeEntries.staffId, parsed.staffId));
    }

    const rows = await db
      .select()
      .from(timeEntries)
      .where(and(...conditions))
      .orderBy(desc(timeEntries.clockInAt));

    const entries = rows
      .filter((row) => row.clockOutAt)
      .map((row) => {
        const minutes = Math.max(0, Math.round((row.clockOutAt!.getTime() - row.clockInAt.getTime()) / 60000));
        return {
          staffId: row.staffId,
          minutes,
          date: row.clockInAt.toISOString().slice(0, 10),
          anomaly: row.status === "anomaly"
        };
      });

    const totalMinutes = entries.reduce((sum, entry) => sum + entry.minutes, 0);
    return timeReportResponseSchema.parse({
      totalMinutes,
      totalHours: Number((totalMinutes / 60).toFixed(2)),
      entries
    });
  }

  async closeFiscalDay(payload: FiscalCloseRequest, actorStaffId: string): Promise<FiscalClosure> {
    const parsed = fiscalCloseRequestSchema.parse(payload);
    const tenantId = getTenantIdOrDefault();
    const dayStart = new Date(`${parsed.businessDate}T00:00:00.000Z`);
    const dayEnd = new Date(`${parsed.businessDate}T23:59:59.999Z`);

    const already = await db
      .select({ id: fiscalClosures.id })
      .from(fiscalClosures)
      .where(and(eq(fiscalClosures.tenantId, tenantId), eq(fiscalClosures.businessDate, parsed.businessDate)))
      .limit(1);
    if (already.length > 0) {
      throw new Error("Fiscal day already closed");
    }

    const paymentsRows = await db
      .select()
      .from(payments)
      .where(and(eq(payments.tenantId, tenantId), gte(payments.createdAt, dayStart), lte(payments.createdAt, dayEnd)));

    const gross = paymentsRows.filter((row) => row.kind === "sale").reduce((sum, row) => sum + Number(row.total), 0);
    const refunds = paymentsRows.filter((row) => row.kind === "refund").reduce((sum, row) => sum + Number(row.total), 0);
    const cash = paymentsRows.filter((row) => row.kind === "sale" && row.method === "cash").reduce((sum, row) => sum + Number(row.total), 0);
    const card = paymentsRows.filter((row) => row.kind === "sale" && row.method === "card").reduce((sum, row) => sum + Number(row.total), 0);
    const totals = { gross, refunds, net: gross - refunds, cash, card };

    const now = new Date();
    const inserted = await db
      .insert(fiscalClosures)
      .values({
        id: `fc_${crypto.randomUUID()}`,
        tenantId,
        businessDate: parsed.businessDate,
        closedByStaffId: actorStaffId,
        totalsJson: JSON.stringify(totals),
        closedAt: now,
        notes: parsed.notes ?? null
      })
      .returning();

    const row = inserted[0];
    return fiscalClosureSchema.parse({
      id: row.id,
      businessDate: row.businessDate,
      closedByStaffId: row.closedByStaffId,
      totals,
      closedAt: row.closedAt.toISOString(),
      notes: row.notes ?? undefined
    });
  }

  async createFiscalExport(payload: FiscalExportCreateRequest, actorStaffId: string): Promise<FiscalExport> {
    const parsed = fiscalExportCreateRequestSchema.parse(payload);
    const tenantId = getTenantIdOrDefault();
    const now = new Date();
    const id = `fx_${crypto.randomUUID()}`;

    const path = `/exports/${tenantId}/fiscal_${parsed.businessDate}.csv`;
    const inserted = await db
      .insert(fiscalExports)
      .values({
        id,
        tenantId,
        businessDate: parsed.businessDate,
        format: parsed.format,
        status: "ready",
        path,
        generatedByStaffId: actorStaffId,
        generatedAt: now,
        checksum: null
      })
      .returning();

    const row = inserted[0];
    return fiscalExportSchema.parse({
      id: row.id,
      businessDate: row.businessDate,
      format: row.format as "csv",
      status: fiscalExportStatusSchema.parse(row.status),
      path: row.path,
      generatedByStaffId: row.generatedByStaffId,
      generatedAt: row.generatedAt.toISOString(),
      checksum: row.checksum ?? undefined
    });
  }

  async listFiscalExports(query: FiscalExportsQuery): Promise<FiscalExport[]> {
    const parsed = fiscalExportsQuerySchema.parse(query);
    const tenantId = getTenantIdOrDefault();
    const conditions: SQL[] = [eq(fiscalExports.tenantId, tenantId)];
    if (parsed.status) {
      conditions.push(eq(fiscalExports.status, parsed.status));
    }
    if (parsed.from) {
      conditions.push(gte(fiscalExports.generatedAt, new Date(parsed.from)));
    }
    if (parsed.to) {
      conditions.push(lte(fiscalExports.generatedAt, new Date(parsed.to)));
    }

    const rows = await db
      .select()
      .from(fiscalExports)
      .where(and(...conditions))
      .orderBy(desc(fiscalExports.generatedAt))
      .limit(parsed.limit ?? 200);

    return rows.map((row) =>
      fiscalExportSchema.parse({
        id: row.id,
        businessDate: row.businessDate,
        format: row.format as "csv",
        status: fiscalExportStatusSchema.parse(row.status),
        path: row.path,
        generatedByStaffId: row.generatedByStaffId,
        generatedAt: row.generatedAt.toISOString(),
        checksum: row.checksum ?? undefined
      }),
    );
  }

  async getFiscalExportById(id: string): Promise<FiscalExport | null> {
    const tenantId = getTenantIdOrDefault();
    const rows = await db
      .select()
      .from(fiscalExports)
      .where(and(eq(fiscalExports.tenantId, tenantId), eq(fiscalExports.id, id)))
      .limit(1);
    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];
    return fiscalExportSchema.parse({
      id: row.id,
      businessDate: row.businessDate,
      format: row.format as "csv",
      status: fiscalExportStatusSchema.parse(row.status),
      path: row.path,
      generatedByStaffId: row.generatedByStaffId,
      generatedAt: row.generatedAt.toISOString(),
      checksum: row.checksum ?? undefined
    });
  }
}

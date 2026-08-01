import { Injectable } from "@nestjs/common";
import crypto from "node:crypto";
import { and, desc, eq, gte, lte, SQL } from "drizzle-orm";
import { db, withTenantTx } from "../db/client";
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

interface FiscalExportDownload {
  entry: FiscalExport;
  csv: string;
  checksum: string;
}

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
          anomaly: row.status === "anomaly",
        };
      });

    const totalMinutes = entries.reduce((sum, entry) => sum + entry.minutes, 0);
    return timeReportResponseSchema.parse({
      totalMinutes,
      totalHours: Number((totalMinutes / 60).toFixed(2)),
      entries,
    });
  }

  async closeFiscalDay(payload: FiscalCloseRequest, actorStaffId: string): Promise<FiscalClosure> {
    const parsed = fiscalCloseRequestSchema.parse(payload);
    const tenantId = getTenantIdOrDefault();
    const dayStart = new Date(`${parsed.businessDate}T00:00:00.000Z`);
    const dayEnd = new Date(`${parsed.businessDate}T23:59:59.999Z`);

    return withTenantTx(async (tx) => {
      const already = await tx
        .select({ id: fiscalClosures.id })
        .from(fiscalClosures)
        .where(and(eq(fiscalClosures.tenantId, tenantId), eq(fiscalClosures.businessDate, parsed.businessDate)))
        .limit(1);
      if (already.length > 0) {
        throw new Error("Fiscal day already closed");
      }

      const paymentsRows = await tx
        .select()
        .from(payments)
        .where(and(eq(payments.tenantId, tenantId), gte(payments.createdAt, dayStart), lte(payments.createdAt, dayEnd)));

      const gross = paymentsRows.filter((row) => row.kind === "sale").reduce((sum, row) => sum + Number(row.total), 0);
      const refunds = paymentsRows.filter((row) => row.kind === "refund").reduce((sum, row) => sum + Number(row.total), 0);
      const cash = paymentsRows.filter((row) => row.kind === "sale" && row.method === "cash").reduce((sum, row) => sum + Number(row.total), 0);
      const card = paymentsRows.filter((row) => row.kind === "sale" && row.method === "card").reduce((sum, row) => sum + Number(row.total), 0);
      const totals = { gross, refunds, net: gross - refunds, cash, card };

      const now = new Date();
      const inserted = await tx
        .insert(fiscalClosures)
        .values({
          id: `fc_${crypto.randomUUID()}`,
          tenantId,
          businessDate: parsed.businessDate,
          closedByStaffId: actorStaffId,
          totalsJson: JSON.stringify(totals),
          closedAt: now,
          notes: parsed.notes ?? null,
        })
        .returning();

      const row = inserted[0];
      return fiscalClosureSchema.parse({
        id: row.id,
        businessDate: row.businessDate,
        closedByStaffId: row.closedByStaffId,
        totals,
        closedAt: row.closedAt.toISOString(),
        notes: row.notes ?? undefined,
      });
    });
  }

  private async buildFiscalCsv(
    client: typeof db,
    tenantId: string,
    businessDate: string,
  ): Promise<{ csv: string; checksum: string }> {
    const dayStart = new Date(`${businessDate}T00:00:00.000Z`);
    const dayEnd = new Date(`${businessDate}T23:59:59.999Z`);
    const paymentRows = await client
      .select()
      .from(payments)
      .where(and(eq(payments.tenantId, tenantId), gte(payments.createdAt, dayStart), lte(payments.createdAt, dayEnd)));

    const sales = paymentRows.filter((payment) => payment.kind === "sale");
    const refunds = paymentRows.filter((payment) => payment.kind === "refund");
    const gross = sales.reduce((sum, payment) => sum + Number(payment.total), 0);
    const refundsTotal = refunds.reduce((sum, payment) => sum + Number(payment.total), 0);
    const net = gross - refundsTotal;
    const cash = sales.filter((payment) => payment.method === "cash").reduce((sum, payment) => sum + Number(payment.total), 0);
    const card = sales.filter((payment) => payment.method === "card").reduce((sum, payment) => sum + Number(payment.total), 0);

    const csv = [
      "date;tenant_id;orders_count;gross;refunds;net;cash;card",
      `${businessDate};${tenantId};${sales.length};${gross.toFixed(2)};${refundsTotal.toFixed(2)};${net.toFixed(2)};${cash.toFixed(2)};${card.toFixed(2)}`,
    ].join("\n");

    return {
      csv,
      checksum: `sha256:${crypto.createHash("sha256").update(csv, "utf8").digest("hex")}`,
    };
  }

  private mapFiscalExport(row: typeof fiscalExports.$inferSelect): FiscalExport {
    return fiscalExportSchema.parse({
      id: row.id,
      businessDate: row.businessDate,
      format: row.format as "csv",
      status: fiscalExportStatusSchema.parse(row.status),
      path: row.path,
      generatedByStaffId: row.generatedByStaffId,
      generatedAt: row.generatedAt.toISOString(),
      checksum: row.checksum ?? undefined,
    });
  }

  async createFiscalExport(payload: FiscalExportCreateRequest, actorStaffId: string): Promise<FiscalExport> {
    const parsed = fiscalExportCreateRequestSchema.parse(payload);
    const tenantId = getTenantIdOrDefault();
    return withTenantTx(async (tx) => {
      const now = new Date();
      const id = `fx_${crypto.randomUUID()}`;
      const { csv, checksum } = await this.buildFiscalCsv(tx, tenantId, parsed.businessDate);
      const path = `/exports/${tenantId}/fiscal_${parsed.businessDate}.csv`;

      const inserted = await tx
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
          checksum,
          csvContent: csv,
        })
        .returning();

      return this.mapFiscalExport(inserted[0]);
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

    return rows.map((row) => this.mapFiscalExport(row));
  }

  async getFiscalExportById(id: string): Promise<FiscalExport | null> {
    const tenantId = getTenantIdOrDefault();
    const rows = await db
      .select()
      .from(fiscalExports)
      .where(and(eq(fiscalExports.tenantId, tenantId), eq(fiscalExports.id, id)))
      .limit(1);
    return rows.length > 0 ? this.mapFiscalExport(rows[0]) : null;
  }

  async getFiscalExportCsvById(id: string): Promise<FiscalExportDownload | null> {
    const tenantId = getTenantIdOrDefault();
    const rows = await db
      .select()
      .from(fiscalExports)
      .where(and(eq(fiscalExports.tenantId, tenantId), eq(fiscalExports.id, id)))
      .limit(1);
    const row = rows[0];
    if (!row) {
      return null;
    }

    const entry = this.mapFiscalExport(row);
    if (row.csvContent !== null) {
      return {
        entry,
        csv: row.csvContent,
        checksum: `sha256:${crypto.createHash("sha256").update(row.csvContent, "utf8").digest("hex")}`,
      };
    }

    // Legacy exports predate csv_content; preserve download compatibility while
    // new exports remain immutable snapshots.
    const generated = await this.buildFiscalCsv(db, tenantId, entry.businessDate);
    return { entry, ...generated };
  }
}

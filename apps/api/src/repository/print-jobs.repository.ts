import { Injectable } from "@nestjs/common";
import { db } from "../db/client";
import { getTenantIdOrDefault } from "../tenant/tenant-context.store";
import { and, desc, eq, inArray } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import {
  printJobSchema,
  printJobsListResponseSchema,
  printJobsQuerySchema,
  type PrintJob,
  type PrintJobsQuery,
} from "@gustopos/shared";
import { printJobs } from "../db/schema";

@Injectable()
export class PrintJobsRepository {
  async getPrintJobById(id: string): Promise<PrintJob | null> {
    const tenantId = getTenantIdOrDefault();
    const rows = await db
      .select()
      .from(printJobs)
      .where(and(eq(printJobs.tenantId, tenantId), eq(printJobs.id, id)))
      .limit(1);
    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];
    return printJobSchema.parse({
      id: row.id,
      orderId: row.orderId,
      area: row.area,
      protocol: row.protocol,
      status: row.status,
      payload: row.payload,
      error: row.error ?? undefined,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      dispatchedAt: row.dispatchedAt ? row.dispatchedAt.toISOString() : undefined,
    });
  }

  async listPrintJobs(query: PrintJobsQuery): Promise<PrintJob[]> {
    const parsed = printJobsQuerySchema.parse(query);
    const tenantId = getTenantIdOrDefault();
    const conditions: SQL[] = [];

    conditions.push(eq(printJobs.tenantId, tenantId));

    if (parsed.status) {
      conditions.push(eq(printJobs.status, parsed.status));
    }
    if (parsed.area) {
      conditions.push(eq(printJobs.area, parsed.area));
    }

    const baseQuery = db
      .select()
      .from(printJobs)
      .orderBy(desc(printJobs.createdAt))
      .limit(parsed.limit ?? 100);

    const rows = conditions.length > 0 ? await baseQuery.where(and(...conditions)) : await baseQuery;

    return printJobsListResponseSchema.parse(
      rows.map((row) =>
        printJobSchema.parse({
          id: row.id,
          orderId: row.orderId,
          area: row.area,
          protocol: row.protocol,
          status: row.status,
          payload: row.payload,
          error: row.error ?? undefined,
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
          dispatchedAt: row.dispatchedAt ? row.dispatchedAt.toISOString() : undefined,
        }),
      ),
    );
  }

  async pollPrintJobs(areas: string[]): Promise<PrintJob[]> {
    const tenantId = getTenantIdOrDefault();

    // Atomic: update pending jobs to dispatched and return them in one query.
    // This eliminates the race condition where concurrent polls could dispatch
    // the same jobs because the SELECT and UPDATE were separate operations.
    const now = new Date();
    const dispatchedRows = await db
      .update(printJobs)
      .set({ status: "dispatched", error: null, updatedAt: now, dispatchedAt: now })
      .where(
        and(
          eq(printJobs.tenantId, tenantId),
          eq(printJobs.status, "pending"),
          inArray(printJobs.area, areas),
        ),
      )
      .returning();

    if (dispatchedRows.length === 0) {
      return [];
    }

    return dispatchedRows.map((row) =>
      printJobSchema.parse({
        id: row.id,
        orderId: row.orderId,
        area: row.area,
        protocol: row.protocol,
        status: row.status,
        payload: row.payload,
        error: row.error ?? undefined,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        dispatchedAt: row.dispatchedAt ? row.dispatchedAt.toISOString() : undefined,
      }),
    );
  }

  async dispatchPrintJob(id: string): Promise<PrintJob | null> {
    const tenantId = getTenantIdOrDefault();
    const updated = await db
      .update(printJobs)
      .set({
        status: "dispatched",
        error: null,
        updatedAt: new Date(),
        dispatchedAt: new Date(),
      })
      .where(and(eq(printJobs.tenantId, tenantId), eq(printJobs.id, id)))
      .returning();

    if (updated.length === 0) {
      return null;
    }

    const row = updated[0];
    return printJobSchema.parse({
      id: row.id,
      orderId: row.orderId,
      area: row.area,
      protocol: row.protocol,
      status: row.status,
      payload: row.payload,
      error: row.error ?? undefined,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      dispatchedAt: row.dispatchedAt ? row.dispatchedAt.toISOString() : undefined,
    });
  }

  async failPrintJob(id: string, error: string): Promise<PrintJob | null> {
    const tenantId = getTenantIdOrDefault();
    const updated = await db
      .update(printJobs)
      .set({
        status: "failed",
        error: error.slice(0, 500),
        updatedAt: new Date(),
      })
      .where(and(eq(printJobs.tenantId, tenantId), eq(printJobs.id, id)))
      .returning();

    if (updated.length === 0) {
      return null;
    }

    const row = updated[0];
    return printJobSchema.parse({
      id: row.id,
      orderId: row.orderId,
      area: row.area,
      protocol: row.protocol,
      status: row.status,
      payload: row.payload,
      error: row.error ?? undefined,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      dispatchedAt: row.dispatchedAt ? row.dispatchedAt.toISOString() : undefined,
    });
  }

  async completePrintJob(id: string): Promise<PrintJob | null> {
    const tenantId = getTenantIdOrDefault();
    const now = new Date();
    const updated = await db
      .update(printJobs)
      .set({
        status: "completed",
        updatedAt: now,
        dispatchedAt: now,
      })
      .where(
        and(
          eq(printJobs.tenantId, tenantId),
          eq(printJobs.id, id),
          inArray(printJobs.status, ["pending", "dispatched"]),
        ),
      )
      .returning();

    if (updated.length === 0) {
      return null;
    }

    const row = updated[0];
    return printJobSchema.parse({
      id: row.id,
      orderId: row.orderId,
      area: row.area,
      protocol: row.protocol,
      status: row.status,
      payload: row.payload,
      error: row.error ?? undefined,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      dispatchedAt: row.dispatchedAt ? row.dispatchedAt.toISOString() : undefined,
    });
  }

  async confirmPrintJob(id: string): Promise<PrintJob | null> {
    const tenantId = getTenantIdOrDefault();
    const updated = await db
      .update(printJobs)
      .set({
        status: "completed",
        updatedAt: new Date(),
      })
      .where(and(eq(printJobs.tenantId, tenantId), eq(printJobs.id, id), eq(printJobs.status, "dispatched")))
      .returning();

    if (updated.length === 0) {
      return null;
    }

    const row = updated[0];
    return printJobSchema.parse({
      id: row.id,
      orderId: row.orderId,
      area: row.area,
      protocol: row.protocol,
      status: row.status,
      payload: row.payload,
      error: row.error ?? undefined,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      dispatchedAt: row.dispatchedAt ? row.dispatchedAt.toISOString() : undefined,
    });
  }

  async retryPrintJob(id: string): Promise<PrintJob | null> {
    const tenantId = getTenantIdOrDefault();
    const updated = await db
      .update(printJobs)
      .set({
        status: "pending",
        error: null,
        updatedAt: new Date(),
        dispatchedAt: null,
      })
      .where(and(eq(printJobs.tenantId, tenantId), eq(printJobs.id, id), inArray(printJobs.status, ["failed", "dispatched"])))
      .returning();

    if (updated.length === 0) {
      return null;
    }

    const row = updated[0];
    return printJobSchema.parse({
      id: row.id,
      orderId: row.orderId,
      area: row.area,
      protocol: row.protocol,
      status: row.status,
      payload: row.payload,
      error: row.error ?? undefined,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      dispatchedAt: row.dispatchedAt ? row.dispatchedAt.toISOString() : undefined,
    });
  }
}

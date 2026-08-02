import { Injectable } from "@nestjs/common";
import crypto from "node:crypto";
import { and, desc, eq, inArray, isNull, lt, or } from "drizzle-orm";
import { db, withTenantTx } from "../db/client";
import { fiscalJobs, payments, tenantModuleConfigs } from "../db/schema";
import { getTenantIdOrDefault } from "../tenant/tenant-context.store";
import { TenantService } from "../tenant/tenant.service";
import {
  fiscalBridgeJobCompleteRequestSchema,
  fiscalBridgeJobFailRequestSchema,
  fiscalJobSchema,
  fiscalJobsQuerySchema,
  fiscalPrinterConfigSchema,
  type FiscalBridgeJobCompleteRequest,
  type FiscalBridgeJobFailRequest,
  type FiscalJob,
  type FiscalJobType,
  type FiscalJobsQuery,
  type FiscalPrinterConfig,
} from "@gustopos/shared";

/**
 * Path B of the fiscal module: certified emission to a Registratore
 * Telematico reached through the Go agent on the cashier PC. Jobs follow the
 * same claim/complete pull model as print jobs (SKIP LOCKED, instance-bound).
 */
@Injectable()
export class FiscalBridgeRepository {
  constructor(private readonly tenantService: TenantService) {}

  private settingsKey = "ui_settings";

  // ─── Printer config (stored per tenant under the fiscal_exports module) ──

  async getFiscalPrinterConfig(): Promise<FiscalPrinterConfig> {
    const tenantId = getTenantIdOrDefault();
    const existing = await this.tenantService.getTenantModuleConfig(tenantId, "fiscal_exports");
    const raw = existing?.config as { fiscalPrinter?: Record<string, unknown> } | undefined;
    const stored = raw?.fiscalPrinter;
    return fiscalPrinterConfigSchema.parse(stored && typeof stored === "object" ? stored : {});
  }

  async saveFiscalPrinterConfig(patch: Partial<FiscalPrinterConfig>): Promise<FiscalPrinterConfig> {
    const tenantId = getTenantIdOrDefault();
    const current = await this.getFiscalPrinterConfig();
    const next = fiscalPrinterConfigSchema.parse({ ...current, ...patch });
    await this.tenantService.upsertTenantModuleConfig(tenantId, {
      moduleKey: "fiscal_exports",
      config: { fiscalPrinter: next },
    });
    return next;
  }

  // ─── Job lifecycle ───────────────────────────────────────────────────────

  async enqueueFiscalJob(payload: { type: FiscalJobType; payloadJson: string }, overrideTenantId?: string): Promise<FiscalJob> {
    const tenantId = overrideTenantId ?? getTenantIdOrDefault();
    const now = new Date();
    const [row] = await db
      .insert(fiscalJobs)
      .values({
        id: `fj_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        tenantId,
        type: payload.type,
        status: "pending",
        payload: payload.payloadJson,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return this.toFiscalJob(row);
  }

  async listFiscalJobs(query: FiscalJobsQuery = {}): Promise<FiscalJob[]> {
    const parsed = fiscalJobsQuerySchema.parse(query);
    const tenantId = getTenantIdOrDefault();
    const conditions = [eq(fiscalJobs.tenantId, tenantId)];
    if (parsed.status) conditions.push(eq(fiscalJobs.status, parsed.status));
    if (parsed.type) conditions.push(eq(fiscalJobs.type, parsed.type));
    const rows = await db
      .select()
      .from(fiscalJobs)
      .where(and(...conditions))
      .orderBy(desc(fiscalJobs.createdAt))
      .limit(parsed.limit ?? 100);
    return rows.map((row) => this.toFiscalJob(row));
  }

  async getFiscalJobById(id: string, overrideTenantId?: string): Promise<FiscalJob | null> {
    const tenantId = overrideTenantId ?? getTenantIdOrDefault();
    const rows = await db
      .select()
      .from(fiscalJobs)
      .where(and(eq(fiscalJobs.tenantId, tenantId), eq(fiscalJobs.id, id)))
      .limit(1);
    return rows.length > 0 ? this.toFiscalJob(rows[0]) : null;
  }

  async claimFiscalJobsForBridge(bridgeId: string, limit: number, instanceId: string, overrideTenantId?: string): Promise<FiscalJob[]> {
    const tenantId = overrideTenantId ?? getTenantIdOrDefault();
    await this.reclaimStaleFiscalClaims(tenantId);
    const boundedLimit = Math.max(1, Math.min(limit, 20));
    return db.transaction(async (tx) => {
      const candidates = await tx
        .select()
        .from(fiscalJobs)
        .where(
          and(
            eq(fiscalJobs.tenantId, tenantId),
            eq(fiscalJobs.status, "pending"),
            or(isNull(fiscalJobs.bridgeId), eq(fiscalJobs.bridgeId, bridgeId)),
          ),
        )
        .limit(boundedLimit)
        .for("update", { skipLocked: true });
      if (candidates.length === 0) return [];

      const candidateIds = candidates.map((candidate) => candidate.id);
      const claimed = await tx
        .update(fiscalJobs)
        .set({
          status: "dispatched",
          bridgeId,
          claimedByInstanceId: instanceId,
          dispatchedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(fiscalJobs.tenantId, tenantId),
            eq(fiscalJobs.status, "pending"),
            inArray(fiscalJobs.id, candidateIds),
          ),
        )
        .returning();
      return claimed.map((row) => this.toFiscalJob(row));
    });
  }

  async completeFiscalJob(bridgeId: string, jobId: string, result: FiscalBridgeJobCompleteRequest, instanceId: string, overrideTenantId?: string): Promise<FiscalJob | null> {
    const parsed = fiscalBridgeJobCompleteRequestSchema.parse(result);
    const tenantId = overrideTenantId ?? getTenantIdOrDefault();
    const existing = await db.query.fiscalJobs.findFirst({
      where: and(eq(fiscalJobs.tenantId, tenantId), eq(fiscalJobs.id, jobId), eq(fiscalJobs.claimedByInstanceId, instanceId)),
    });
    if (!existing || existing.bridgeId !== bridgeId) {
      return null;
    }
    const now = new Date();
    const [row] = await db
      .update(fiscalJobs)
      .set({
        status: "completed",
        result: JSON.stringify({ progressive: parsed.progressive, emittedAt: parsed.emittedAt ?? now.toISOString() }),
        error: null,
        completedAt: now,
        updatedAt: now,
      })
      .where(and(eq(fiscalJobs.tenantId, tenantId), eq(fiscalJobs.id, jobId)))
      .returning();

    if (row && existing.type === "receipt") {
      // Attach the progressive to the originating payment so the payment row
      // exposes Path-B emission status without a join at read time.
      try {
        const receiptPayload = JSON.parse(existing.payload) as { paymentId?: string };
        if (receiptPayload?.paymentId) {
          await db
            .update(payments)
            .set({ fiscalStatus: "emitted", fiscalProgressive: parsed.progressive, fiscalError: null })
            .where(and(eq(payments.tenantId, tenantId), eq(payments.id, receiptPayload.paymentId)));
        }
      } catch {
        // Never fail the job completion because of a side-table update.
      }
    }

    return row ? this.toFiscalJob(row) : null;
  }

  async failFiscalJob(bridgeId: string, jobId: string, failPayload: FiscalBridgeJobFailRequest, instanceId: string, overrideTenantId?: string): Promise<FiscalJob | null> {
    const parsed = fiscalBridgeJobFailRequestSchema.parse(failPayload);
    const tenantId = overrideTenantId ?? getTenantIdOrDefault();
    const existing = await db.query.fiscalJobs.findFirst({
      where: and(eq(fiscalJobs.tenantId, tenantId), eq(fiscalJobs.id, jobId), eq(fiscalJobs.claimedByInstanceId, instanceId)),
    });
    if (!existing || existing.bridgeId !== bridgeId) {
      return null;
    }
    const now = new Date();
    const [row] = await db
      .update(fiscalJobs)
      .set({ status: "failed", error: parsed.error, completedAt: now, updatedAt: now })
      .where(and(eq(fiscalJobs.tenantId, tenantId), eq(fiscalJobs.id, jobId)))
      .returning();

    if (row && existing.type === "receipt") {
      try {
        const receiptPayload = JSON.parse(existing.payload) as { paymentId?: string };
        if (receiptPayload?.paymentId) {
          await db
            .update(payments)
            .set({ fiscalStatus: "failed", fiscalError: parsed.error })
            .where(and(eq(payments.tenantId, tenantId), eq(payments.id, receiptPayload.paymentId)));
        }
      } catch {
        // Non-fatal side-table update.
      }
    }

    return row ? this.toFiscalJob(row) : null;
  }

  private async reclaimStaleFiscalClaims(tenantId: string): Promise<void> {
    const cutoff = new Date(Date.now() - 5 * 60 * 1000);
    await db
      .update(fiscalJobs)
      .set({ bridgeId: null, claimedByInstanceId: null, dispatchedAt: null, status: "pending", updatedAt: new Date() })
      .where(and(eq(fiscalJobs.tenantId, tenantId), eq(fiscalJobs.status, "dispatched"), or(isNull(fiscalJobs.dispatchedAt), lt(fiscalJobs.dispatchedAt, cutoff))));
  }

  private toFiscalJob(row: typeof fiscalJobs.$inferSelect): FiscalJob {
    return fiscalJobSchema.parse({
      id: row.id,
      tenantId: row.tenantId,
      type: row.type as FiscalJobType,
      status: row.status as FiscalJob["status"],
      payload: row.payload,
      result: row.result ?? undefined,
      error: row.error ?? undefined,
      bridgeId: row.bridgeId ?? undefined,
      claimedByInstanceId: row.claimedByInstanceId ?? undefined,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      dispatchedAt: row.dispatchedAt ? row.dispatchedAt.toISOString() : undefined,
      completedAt: row.completedAt ? row.completedAt.toISOString() : undefined,
    });
  }
}



import { BadRequestException, Injectable } from "@nestjs/common";
import crypto from "node:crypto";
import { and, desc, eq, inArray, isNull, lt, or } from "drizzle-orm";
import { db, withTenantTx } from "../db/client";
import { fiscalJobs, payments, printBridges, tenantModuleConfigs } from "../db/schema";
import { getTenantIdOrDefault } from "../tenant/tenant-context.store";
import { TenantService } from "../tenant/tenant.service";
import { departmentMappingErrors } from "../fiscal/department-mapping";
import { resolveConfiguredDialect } from "../fiscal/dialects";
import { decideFiscalCompletion } from "../fiscal/job-completion";
import { selectVerificationEvidence, verificationCounters } from "../fiscal/live-verification";
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
  type FiscalProtocolId,
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
    // La mappa reparti è quella che decide l'aliquota del corrispettivo: un
    // errore (reparto duplicato, categoria su due reparti, due ripieghi) va
    // fermato *prima* di salvarlo, non scoperto in cassa.
    this.assertValidDepartmentMappings(next);
    await this.tenantService.upsertTenantModuleConfig(tenantId, {
      moduleKey: "fiscal_exports",
      config: { fiscalPrinter: next },
    });
    return next;
  }

  private assertValidDepartmentMappings(config: FiscalPrinterConfig): void {
    const issues = departmentMappingErrors(config.departmentMappings);
    if (issues.length === 0) return;
    throw new BadRequestException({ message: "Mappatura reparti non valida", issues });
  }

  // ─── Collaudo dal vivo del dialetto attivo ──────────────────────────────

  /**
   * Registra il collaudo del protocollo configurato, sbloccando i
   * corrispettivi (`emissionGated`). Il collaudo **non è una dichiarazione**:
   * il server accetta solo una prova gestionale già **completata** per quel
   * protocollo — è il documento non fiscale che si è visto uscire dalla cassa —
   * e ne conserva id, versione dell'agente e quadrature lette dal RT. Senza
   * prova non si sblocca niente.
   */
  async recordFiscalLiveVerification(args: { staffId: string; note?: string }): Promise<FiscalPrinterConfig> {
    const tenantId = getTenantIdOrDefault();
    const config = await this.getFiscalPrinterConfig();
    const protocolId = config.dialectId;
    if (!protocolId) {
      throw new BadRequestException(
        "Nessun protocollo fiscale selezionato: scegli il protocollo del RT prima di registrare il collaudo",
      );
    }
    const dialect = resolveConfiguredDialect(protocolId);
    const label = dialect?.label ?? protocolId;
    const evidence = await this.findCompletedTestJob(tenantId, protocolId);
    if (!evidence) {
      throw new BadRequestException(
        `Nessuna prova gestionale completata per ${label}: lancia la prova in Impostazioni → Fiscale, attendi l'esito e registra il collaudo`,
      );
    }
    const agentVersion = evidence.bridgeId ? await this.bridgeVersion(tenantId, evidence.bridgeId) : null;
    const verification = {
      protocolId,
      verifiedAt: new Date().toISOString(),
      verifiedByStaffId: args.staffId,
      agentVersion: agentVersion ?? "",
      testJobId: evidence.id,
      counters: verificationCounters(evidence.result),
      note: (args.note ?? "").slice(0, 300),
    };
    const others = config.liveVerifications.filter((entry) => entry.protocolId !== protocolId);
    return this.saveFiscalPrinterConfig({ liveVerifications: [...others, verification] });
  }

  /**
   * Revoca il collaudo del protocollo attivo: l'emissione torna bloccata. Serve
   * quando la cassa viene sostituita o riconfigurata — meglio ripartire dalla
   * prova che fidarsi di un collaudo fatto su un altro dispositivo.
   */
  async revokeFiscalLiveVerification(): Promise<FiscalPrinterConfig> {
    const config = await this.getFiscalPrinterConfig();
    const protocolId = config.dialectId;
    return this.saveFiscalPrinterConfig({
      liveVerifications: config.liveVerifications.filter((entry) => entry.protocolId !== protocolId),
    });
  }

  /**
   * Ultima prova gestionale completata **per questo protocollo**: è l'evidenza
   * del collaudo. Le righe arrivano già filtrate (tipo `test`, stato
   * `completed`, più recenti prima) e la scelta per protocollo è una funzione
   * pura (`selectVerificationEvidence`), così la regola è testabile senza
   * database.
   */
  private async findCompletedTestJob(tenantId: string, protocolId: FiscalProtocolId) {
    const rows = await db
      .select({ id: fiscalJobs.id, bridgeId: fiscalJobs.bridgeId, payload: fiscalJobs.payload, result: fiscalJobs.result })
      .from(fiscalJobs)
      .where(
        and(eq(fiscalJobs.tenantId, tenantId), eq(fiscalJobs.type, "test"), eq(fiscalJobs.status, "completed")),
      )
      .orderBy(desc(fiscalJobs.completedAt))
      .limit(25);
    return selectVerificationEvidence(
      rows.map((row) => ({ id: row.id, bridgeId: row.bridgeId ?? null, payload: row.payload, result: row.result ?? null })),
      protocolId,
    );
  }

  /** Versione dell'agente che ha eseguito la prova (per la diagnosi della UI). */
  private async bridgeVersion(tenantId: string, bridgeId: string): Promise<string | null> {
    const rows = await db
      .select({ version: printBridges.version })
      .from(printBridges)
      .where(and(eq(printBridges.tenantId, tenantId), eq(printBridges.id, bridgeId)))
      .limit(1);
    return rows[0]?.version ?? null;
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
    // La decisione (emesso / non emesso) la prende il server dalle risposte
    // grezze del RT: checksum, <DATA_ANSW>, progressivo e quadratura.
    const decision = decideFiscalCompletion({
      jobType: existing.type as FiscalJobType,
      payloadJson: existing.payload,
      response: parsed.response,
      progressive: parsed.progressive,
    });
    const now = new Date();
    const [row] = await db
      .update(fiscalJobs)
      .set({
        status: decision.status,
        result: decision.resultJson,
        error: decision.error,
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
            .set({
              fiscalStatus: decision.status === "completed" ? "emitted" : "failed",
              fiscalProgressive: decision.progressive ?? null,
              fiscalError: decision.error,
            })
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




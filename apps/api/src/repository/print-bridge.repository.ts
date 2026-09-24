import { Injectable } from "@nestjs/common";
import { db } from "../db/client";
import { getTenantIdOrDefault } from "../tenant/tenant-context.store";
import { and, desc, eq, gt, inArray, isNull, isNotNull, lt, ne, or } from "drizzle-orm";
import crypto from "node:crypto";
import {
  printBridgeCommandSchema,
  printBridgeLogRecordSchema,
  printJobSchema,
  type PrintBridge,
  type PrintBridgeCommand,
  type PrintBridgePrinter,
  type PrintBridgePrinterMapping,
  type PrintBridgeLogEntry,
  type PrintBridgeLogRecord,
  type PrintBridgeOnboardingSecret,
  type PrintBridgeOnboardingSecretCreateResponse,
  type PrintBridgeOnboardingSecretCreateCode6DigitResponse,
  type PrintJob,
} from "@gustopos/shared";
import {
  printBridges,
  printBridgeLogs,
  printBridgeOnboardingSecrets,
  printJobs,
  printStations,
} from "../db/schema";

// Legacy print_areas enum values replaced by dynamic station ids (migration
// 0072). They must never be treated as a routing key again: jobs, claimed
// areas and mappings all use station ids now. Values are normalized away on
// read so stale rows can never resurrect the old routing.
const LEGACY_AREA_KEYS = new Set(["kitchen", "pizzeria", "bar", "cashier"]);

function isLegacyAreaKey(value: unknown): boolean {
  return typeof value === "string" && LEGACY_AREA_KEYS.has(value.trim().toLowerCase());
}

@Injectable()
export class PrintBridgeRepository {
  private hashBridgeSecret(plaintext: string): string {
    const pepper = process.env.PRINT_BRIDGE_SECRET_PEPPER?.trim();
    if (pepper) {
      return crypto.createHmac("sha256", pepper).update(plaintext).digest("hex");
    }
    return crypto.createHash("sha256").update(plaintext).digest("hex");
  }

  private hashShortCode(code: string): string {
    const pepper = process.env.SHORT_CODE_PEPPER?.trim();
    if (!pepper) {
      throw new Error("SHORT_CODE_PEPPER env var is not set; cannot authenticate 6-digit codes");
    }
    return crypto.createHmac("sha256", pepper).update(code).digest("hex");
  }

  // Drizzle rows contain nullable fields and Date instances. Keep that DB
  // representation out of the shared wire contract before validating it.
  private toPrintJob(row: typeof printJobs.$inferSelect): PrintJob {
    return printJobSchema.parse({
      id: row.id,
      orderId: row.orderId,
      area: row.area,
      protocol: row.protocol,
      status: row.status,
      payload: row.payload,
      error: row.error ?? undefined,
      bridgeId: row.bridgeId ?? undefined,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      dispatchedAt: row.dispatchedAt ? row.dispatchedAt.toISOString() : undefined,
    });
  }

  private toPrintBridge(row: typeof printBridges.$inferSelect): PrintBridge {
    // Areas/mappings hold opaque station ids (not the legacy enum). Never coerce
    // an unknown value to a station — an empty value simply stays empty.
    let areas: string[] = [];
    let printers: PrintBridgePrinter[] = [];
    try {
      const parsedAreas = JSON.parse(row.areas);
      if (Array.isArray(parsedAreas)) {
        areas = parsedAreas.filter((a): a is string => typeof a === "string" && a.length > 0 && !isLegacyAreaKey(a));
      }
    } catch {
      areas = [];
    }
    try {
      const parsedPrinters = JSON.parse(row.printers);
      if (Array.isArray(parsedPrinters)) {
        printers = parsedPrinters
          .filter((p): p is { area?: unknown; name: string; ip?: string | null; port?: number; source?: unknown; vendor?: unknown; mac?: unknown } =>
            typeof p === "object" && p !== null && typeof (p as any).name === "string")
          .map((p) => ({
            name: p.name as string,
            area: typeof p.area === "string" ? p.area : null,
            ip: typeof p.ip === "string" ? p.ip : null,
            port: typeof p.port === "number" ? p.port : undefined,
            ...(p.source === "qz" || p.source === "net" ? { source: p.source } : {}),
            ...(typeof p.vendor === "string" ? { vendor: p.vendor } : {}),
            ...(typeof p.mac === "string" ? { mac: p.mac } : {}),
          }));
      }
    } catch {
      printers = [];
    }

    let mappings: PrintBridgePrinterMapping[] = [];
    try {
      const parsedMappings = JSON.parse(row.mappings);
      if (Array.isArray(parsedMappings)) {
        mappings = parsedMappings
          .filter((m): m is { area?: unknown; name: string; ip?: string | null; port?: number } =>
            typeof m === "object" && m !== null && typeof (m as any).name === "string")
          .map((m) => ({
            area: typeof (m as any).area === "string" ? (m as any).area : null,
            name: (m as any).name as string,
            ip: typeof (m as any).ip === "string" ? (m as any).ip : undefined,
            port: typeof (m as any).port === "number" ? (m as any).port : undefined,
          }))
          // A legacy enum key cannot address a station: drop it (the physical
          // binding must be redone from Settings → Stampa).
          .filter((m) => m.name.length > 0 && !isLegacyAreaKey(m.area));
      }
    } catch {
      mappings = [];
    }

    let claimedAreas: string[] = [];
    try {
      const parsedClaimed = JSON.parse(row.claimedAreas);
      if (Array.isArray(parsedClaimed)) {
        claimedAreas = parsedClaimed.filter((a): a is string => typeof a === "string" && a.length > 0 && !isLegacyAreaKey(a));
      }
    } catch {
      claimedAreas = [];
    }
    return {
      id: row.id,
      tenantId: row.tenantId,
      instanceId: row.instanceId ?? null,
      name: row.name,
      host: row.host ?? null,
      version: row.version ?? null,
      status: row.status as "active" | "offline",
      areas,
      printers,
      lastHeartbeatAt: row.lastHeartbeatAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      mappings,
      claimedAreas,
      lastError: row.lastError ?? null,
      diagnosticsAt: row.diagnosticsAt ? row.diagnosticsAt.toISOString() : null,
    };
  }

  async upsertPrintBridge(payload: {
    bridgeId: string;
    name?: string;
    host?: string | null;
    version?: string | null;
    areas: string[];
    printers: Array<{ area: string; name: string; ip?: string | null; port?: number }>;
  }, instanceId?: string, overrideTenantId?: string): Promise<PrintBridge> {
    const tenantId = overrideTenantId ?? getTenantIdOrDefault();
    const crossTenantCollision = await db.query.printBridges.findFirst({
      where: and(eq(printBridges.id, payload.bridgeId), ne(printBridges.tenantId, tenantId)),
    });
    if (crossTenantCollision) {
      throw new Error();
    }
    const existingById = await db.query.printBridges.findFirst({
      where: and(eq(printBridges.tenantId, tenantId), eq(printBridges.id, payload.bridgeId)),
    });
    const existingByInstance = instanceId
      ? await db.query.printBridges.findFirst({
          where: and(eq(printBridges.tenantId, tenantId), eq(printBridges.instanceId, instanceId)),
        })
      : null;
    if (existingById && existingByInstance && existingById.id !== existingByInstance.id) {
      // Never let a pairing code overwrite a different machine's bridge row.
      // The stable instance identity wins only when it is unambiguous.
      throw new Error("Bridge ID and instance identity refer to different bridges");
    }
    // A new pairing code must not create another row for the same physical
    // agent. Prefer the stable instance row so print_jobs.bridge_id and
    // existing mappings remain attached to the same primary key.
    const existing = existingByInstance ?? existingById;
    const effectiveBridgeId = existing?.id ?? payload.bridgeId;
    const now = new Date();
    const areasJson = JSON.stringify(payload.areas);
    const printersJson = JSON.stringify(payload.printers);
    if (existing) {
      await db
        .update(printBridges)
        .set({
          instanceId: instanceId ?? existing.instanceId,
          name: payload.name ?? existing.name,
          host: payload.host ?? existing.host,
          version: payload.version ?? existing.version,
          status: "active",
          areas: areasJson,
          printers: printersJson,
          lastHeartbeatAt: now,
          updatedAt: now,
        })
        .where(and(eq(printBridges.tenantId, tenantId), eq(printBridges.id, effectiveBridgeId)));
    } else {
      try {
        await db.insert(printBridges).values({
          id: effectiveBridgeId,
          tenantId,
          instanceId: instanceId ?? null,
          name: payload.name ?? effectiveBridgeId,
          host: payload.host ?? null,
          version: payload.version ?? null,
          status: "active",
          areas: areasJson,
          printers: printersJson,
          lastHeartbeatAt: now,
          createdAt: now,
          updatedAt: now,
        });
      } catch (error) {
        // Two heartbeats can arrive together during pairing. The partial
        // unique index intentionally rejects the second insert; recover by
        // re-reading the row created by the winner and updating it normally.
        const code = typeof error === "object" && error !== null && "code" in error
          ? String((error as { code?: unknown }).code)
          : "";
        if (code !== "23505" || !instanceId) throw error;
        const raced = await db.query.printBridges.findFirst({
          where: and(eq(printBridges.tenantId, tenantId), eq(printBridges.instanceId, instanceId)),
        });
        if (!raced) throw error;
        await db
          .update(printBridges)
          .set({
            name: payload.name ?? raced.name,
            host: payload.host ?? raced.host,
            version: payload.version ?? raced.version,
            status: "active",
            areas: areasJson,
            printers: printersJson,
            lastHeartbeatAt: now,
            updatedAt: now,
          })
          .where(and(eq(printBridges.tenantId, tenantId), eq(printBridges.id, raced.id)));
        return (await this.getPrintBridge(raced.id))!;
      }
    }
    return (await this.getPrintBridge(effectiveBridgeId))!;
  }

  async listPrintBridges(): Promise<PrintBridge[]> {
    const tenantId = getTenantIdOrDefault();
    const rows = await db
      .select()
      .from(printBridges)
      .where(eq(printBridges.tenantId, tenantId))
      .orderBy(desc(printBridges.lastHeartbeatAt));
    return rows.map((r) => this.toPrintBridge(r));
  }

  async getPrintBridge(bridgeId: string): Promise<PrintBridge | null> {
    const tenantId = getTenantIdOrDefault();
    const row = await db.query.printBridges.findFirst({
      where: and(eq(printBridges.tenantId, tenantId), eq(printBridges.id, bridgeId)),
    });
    return row ? this.toPrintBridge(row) : null;
  }

  // ─── One-shot commands (network scan / direct test print) ───────────────

  async setBridgeCommand(bridgeId: string, command: PrintBridgeCommand): Promise<void> {
    const tenantId = getTenantIdOrDefault();
    await db
      .update(printBridges)
      .set({ command: JSON.stringify(command), updatedAt: new Date() })
      .where(and(eq(printBridges.tenantId, tenantId), eq(printBridges.id, bridgeId)));
  }

  async getBridgeCommand(bridgeId: string, overrideTenantId?: string): Promise<PrintBridgeCommand | null> {
    const tenantId = overrideTenantId ?? getTenantIdOrDefault();
    const row = await db.query.printBridges.findFirst({
      where: and(eq(printBridges.tenantId, tenantId), eq(printBridges.id, bridgeId)),
      columns: { command: true },
    });
    return this.parseCommand(row?.command ?? null);
  }

  async clearBridgeCommand(bridgeId: string, commandId: string, overrideTenantId?: string): Promise<boolean> {
    const tenantId = overrideTenantId ?? getTenantIdOrDefault();
    const row = await db.query.printBridges.findFirst({
      where: and(eq(printBridges.tenantId, tenantId), eq(printBridges.id, bridgeId)),
      columns: { command: true },
    });
    const current = this.parseCommand(row?.command ?? null);
    if (!current || current.id !== commandId) {
      // Nothing to clear, or a newer command replaced this one: keep it.
      return false;
    }
    await db
      .update(printBridges)
      .set({ command: null, updatedAt: new Date() })
      .where(and(eq(printBridges.tenantId, tenantId), eq(printBridges.id, bridgeId)));
    return true;
  }

  /**
   * Record the outcome of a one-shot command acked by the agent (Go agent
   * >= 0.14.0 reports ok/error). The entry lands in the same diagnostics log
   * admins read in Settings → Diagnostica, so a failed test print shows up
   * server-side instead of only in the agent's local ring buffer.
   */
  async appendBridgeCommandLog(params: {
    tenantId: string;
    bridgeId: string;
    level: "info" | "warn" | "error";
    component?: string;
    message: string;
  }): Promise<void> {
    await db.insert(printBridgeLogs).values({
      id: `pbl_${crypto.randomUUID()}`,
      tenantId: params.tenantId,
      bridgeId: params.bridgeId,
      instanceId: null,
      level: params.level,
      component: params.component ?? "command",
      message: params.message.slice(0, 1000),
      createdAt: new Date(),
    });
  }

  private parseCommand(raw: string | null): PrintBridgeCommand | null {
    if (!raw) return null;
    try {
      const parsed = printBridgeCommandSchema.safeParse(JSON.parse(raw));
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }

  /**
   * Merge network-discovered devices into the bridge printer list. Network
   * entries are replaced wholesale by the latest scan while QZ entries are
   * preserved (they come from the heartbeat and must not be lost).
   */
  async mergeDiscoveredPrinters(
    bridgeId: string,
    devices: Array<{ ip: string; port: number; mac?: string; vendor?: string }>,
    overrideTenantId?: string,
  ): Promise<PrintBridge | null> {
    const tenantId = overrideTenantId ?? getTenantIdOrDefault();
    const row = await db.query.printBridges.findFirst({
      where: and(eq(printBridges.tenantId, tenantId), eq(printBridges.id, bridgeId)),
    });
    if (!row) return null;

    let existing: PrintBridgePrinter[] = [];
    try {
      const parsed = JSON.parse(row.printers);
      if (Array.isArray(parsed)) {
        existing = parsed.filter((p): p is PrintBridgePrinter => typeof p === "object" && p !== null && typeof (p as any).name === "string");
      }
    } catch {
      existing = [];
    }
    const kept = existing.filter((p) => p.source !== "net");
    const seen = new Set<string>();
    for (const device of devices) {
      const ip = device.ip.trim();
      if (!ip || seen.has(ip)) continue;
      seen.add(ip);
      kept.push({
        name: (device.vendor ? device.vendor : "Stampante di rete") + " (" + ip + ")",
        ip,
        port: device.port,
        source: "net",
        ...(device.vendor ? { vendor: device.vendor } : {}),
        ...(device.mac ? { mac: device.mac } : {}),
      });
    }
    await db
      .update(printBridges)
      .set({ printers: JSON.stringify(kept), updatedAt: new Date() })
      .where(and(eq(printBridges.tenantId, tenantId), eq(printBridges.id, bridgeId)));
    const updated = await db.query.printBridges.findFirst({
      where: and(eq(printBridges.tenantId, tenantId), eq(printBridges.id, bridgeId)),
    });
    return updated ? this.toPrintBridge(updated) : null;
  }

  private async reclaimStalePrintJobClaims(tenantId: string): Promise<void> {
    const cutoff = new Date(Date.now() - 5 * 60 * 1000);
    await db.update(printJobs)
      .set({ bridgeId: null, claimedByInstanceId: null, claimedAt: null, status: 'pending' })
      .where(and(eq(printJobs.tenantId, tenantId), eq(printJobs.status, 'dispatched'), lt(printJobs.claimedAt, cutoff)));
  }

  async claimPrintJobsForBridge(bridgeId: string, limit: number, instanceId: string, overrideTenantId?: string): Promise<PrintJob[]> {
    const tenantId = overrideTenantId ?? getTenantIdOrDefault();
    await this.reclaimStalePrintJobClaims(tenantId);
    const bridge = await this.getPrintBridge(bridgeId);
    if (!bridge) return [];

    // Go agents use the admin-assigned claimedAreas as the queue boundary.
    // Legacy/browser bridges keep the historical heartbeat-driven `areas`
    // behavior so the two protocols remain backwards-compatible.
    const queueAreas = bridge.version?.startsWith("go-")
      ? bridge.claimedAreas
      : bridge.areas;
    if (queueAreas.length === 0) return [];

    const boundedLimit = Math.max(1, Math.min(limit, 50));
    return db.transaction(async (tx) => {
      // Lock only the jobs we will actually return. SKIP LOCKED prevents two
      // bridges polling concurrently from selecting the same pending rows.
      const candidates = await tx
        .select()
        .from(printJobs)
        .where(
          and(
            eq(printJobs.tenantId, tenantId),
            eq(printJobs.status, 'pending'),
            or(isNull(printJobs.bridgeId), eq(printJobs.bridgeId, bridgeId)),
            inArray(printJobs.area, queueAreas),
          ),
        )
        .limit(boundedLimit)
        .for('update', { skipLocked: true });
      if (candidates.length === 0) return [];

      const candidateIds = candidates.map((candidate) => candidate.id);
      const claimed = await tx
        .update(printJobs)
        .set({ status: 'dispatched', bridgeId, claimedByInstanceId: instanceId, claimedAt: new Date(), updatedAt: new Date() })
        .where(
          and(
            eq(printJobs.tenantId, tenantId),
            eq(printJobs.status, 'pending'),
            inArray(printJobs.id, candidateIds),
          ),
        )
        .returning();
      return claimed.map((row) => this.toPrintJob(row));
    });
  }

  async completeBridgeJob(bridgeId: string, jobId: string, notes: string | undefined, instanceId: string, overrideTenantId?: string): Promise<PrintJob | null> {
    const tenantId = overrideTenantId ?? getTenantIdOrDefault();
    const existing = await db.query.printJobs.findFirst({
      where: and(eq(printJobs.tenantId, tenantId), eq(printJobs.id, jobId), eq(printJobs.claimedByInstanceId, instanceId)),
    });
    if (!existing || existing.bridgeId !== bridgeId) {
      return null;
    }
    const [row] = await db
      .update(printJobs)
      .set({
        status: "completed",
        error: notes ?? null,
        updatedAt: new Date(),
      })
      .where(and(eq(printJobs.tenantId, tenantId), eq(printJobs.id, jobId)))
      .returning();
    return row ? this.toPrintJob(row) : null;
  }

  async failBridgeJob(bridgeId: string, jobId: string, error: string, instanceId: string, overrideTenantId?: string): Promise<PrintJob | null> {
    const tenantId = overrideTenantId ?? getTenantIdOrDefault();
    const existing = await db.query.printJobs.findFirst({
      where: and(eq(printJobs.tenantId, tenantId), eq(printJobs.id, jobId), eq(printJobs.claimedByInstanceId, instanceId)),
    });
    if (!existing || existing.bridgeId !== bridgeId) {
      return null;
    }
    const [row] = await db
      .update(printJobs)
      .set({
        status: "failed",
        error: error.slice(0, 500),
        updatedAt: new Date(),
      })
      .where(and(eq(printJobs.tenantId, tenantId), eq(printJobs.id, jobId)))
      .returning();
    return row ? this.toPrintJob(row) : null;
  }

  async listOnboardingSecrets(tenantId: string): Promise<PrintBridgeOnboardingSecret[]> {
    const rows = await db
      .select({
        id: printBridgeOnboardingSecrets.id,
        tenantId: printBridgeOnboardingSecrets.tenantId,
        suggestedBridgeId: printBridgeOnboardingSecrets.suggestedBridgeId,
        boundBridgeId: printBridgeOnboardingSecrets.boundBridgeId,
        lastUsedAt: printBridgeOnboardingSecrets.lastUsedAt,
        revokedAt: printBridgeOnboardingSecrets.revokedAt,
        createdByStaffId: printBridgeOnboardingSecrets.createdByStaffId,
        createdAt: printBridgeOnboardingSecrets.createdAt,
      })
      .from(printBridgeOnboardingSecrets)
      .where(eq(printBridgeOnboardingSecrets.tenantId, tenantId))
      .orderBy(desc(printBridgeOnboardingSecrets.createdAt));
    return rows.map((r) => ({
      id: r.id,
      tenantId: r.tenantId,
      suggestedBridgeId: r.suggestedBridgeId,
      boundBridgeId: r.boundBridgeId ?? null,
      lastUsedAt: r.lastUsedAt ? r.lastUsedAt.toISOString() : null,
      revokedAt: r.revokedAt ? r.revokedAt.toISOString() : null,
      createdByStaffId: r.createdByStaffId ?? null,
      createdAt: r.createdAt.toISOString(),
      isActive: r.revokedAt == null,
    }));
  }

  async createOnboardingSecret(
    tenantId: string,
    createdByStaffId: string | null,
    bridgeIdHint?: string,
    mode: "long" | "code-6digit" = "long",
    options?: { publicBaseUrl?: string },
  ): Promise<PrintBridgeOnboardingSecretCreateResponse | PrintBridgeOnboardingSecretCreateCode6DigitResponse> {
    const id = `obs_${crypto.randomBytes(8).toString("hex")}`;
    const safeHint = (bridgeIdHint ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 30);
    const suggestedBridgeId = `bridge_${safeHint || "auto"}_${crypto.randomBytes(3).toString("hex")}`;
    const now = new Date();

    if (mode === "code-6digit") {
      const pepper = process.env.SHORT_CODE_PEPPER?.trim();
      if (!pepper) {
        throw new Error("SHORT_CODE_PEPPER env var is not set; cannot mint 6-digit codes");
      }
      let code: string;
      let shortCodeHash: string;
      let attempts = 0;
      while (true) {
        attempts++;
        code = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
        shortCodeHash = crypto.createHmac("sha256", pepper).update(code).digest("hex");
        const conflict = await db.query.printBridgeOnboardingSecrets.findFirst({
          where: eq(printBridgeOnboardingSecrets.shortCodeHash, shortCodeHash),
        });
        if (!conflict) break;
        if (attempts > 5) throw new Error("Failed to mint a unique 6-digit code after multiple attempts");
      }
      // 5 minutes: long enough for an operator to walk to the remote PC and
      // type the code without the auto-reissued wizard invalidating it mid
      // entry (90s proved too tight in the field — codes silently expired).
      const shortCodeExpiresAt = new Date(now.getTime() + 300_000);

      await db.insert(printBridgeOnboardingSecrets).values({
        id,
        tenantId,
        secretHash: `code6_${id}`,
        shortCodeHash,
        shortCodeExpiresAt,
        suggestedBridgeId,
        boundBridgeId: null,
        lastUsedAt: null,
        revokedAt: null,
        createdByStaffId: createdByStaffId ?? null,
        createdAt: now,
      });

      const publicBaseUrl = (
        options?.publicBaseUrl
          ?? process.env.PRINT_BRIDGE_PUBLIC_BASE_URL
          ?? process.env.PUBLIC_BASE_URL
          ?? "http://localhost:11900"
      ).replace(/\/+$/, "");
      const qrPayload = `${publicBaseUrl}/print-station?code=${code}&tenant=${encodeURIComponent(tenantId)}&bridgeHint=${encodeURIComponent(suggestedBridgeId)}`;

      return {
        mode: "code-6digit",
        secretId: id,
        code,
        qrPayload,
        ttlSeconds: 300,
        expiresAt: shortCodeExpiresAt.toISOString(),
        suggestedBridgeId,
      };
    }

    const randomBytes = crypto.randomBytes(32);
    const b64url = randomBytes.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
    const plaintext = `pbos_${b64url}`;
    const secretHash = this.hashBridgeSecret(plaintext);

    await db.insert(printBridgeOnboardingSecrets).values({
      id,
      tenantId,
      secretHash,
      suggestedBridgeId,
      boundBridgeId: null,
      lastUsedAt: null,
      revokedAt: null,
      createdByStaffId: createdByStaffId ?? null,
      createdAt: now,
    });

    const admin: PrintBridgeOnboardingSecret = {
      id,
      tenantId,
      suggestedBridgeId,
      boundBridgeId: null,
      lastUsedAt: null,
      revokedAt: null,
      createdByStaffId: createdByStaffId ?? null,
      createdAt: now.toISOString(),
      isActive: true,
    };

    const bootstrapSnippet = [
      `# Esegui sul PC cucina dopo aver installato QZ Tray:`,
      `PRINT_BRIDGE_ID="${suggestedBridgeId}"`,
      `PRINT_BRIDGE_SECRET="${plaintext}"`,
      `PRINT_BRIDGE_AREAS="kitchen,bar,cashier"`,
      `pm2 start ecosystem.hmr.config.cjs --only gustopos-print-bridge`,
    ].join("\n");

    return {
      mode: "long",
      secret: admin,
      plaintext,
      suggestedBridgeId,
      bootstrapSnippet,
    };
  }

  async revokeOnboardingSecret(tenantId: string, id: string): Promise<void> {
    await db
      .update(printBridgeOnboardingSecrets)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(printBridgeOnboardingSecrets.tenantId, tenantId),
          eq(printBridgeOnboardingSecrets.id, id),
          isNull(printBridgeOnboardingSecrets.revokedAt),
        ),
      );
  }

  async resolveOnboardingSecret(plaintext: string): Promise<{
    secretId: string;
    tenantId: string;
    suggestedBridgeId: string;
    boundBridgeId: string | null;
    revokedAt: Date | null;
  } | null> {
    const hash = this.hashBridgeSecret(plaintext);
    const row = await db.query.printBridgeOnboardingSecrets.findFirst({
      where: eq(printBridgeOnboardingSecrets.secretHash, hash),
    });
    if (!row) return null;
    return {
      secretId: row.id,
      tenantId: row.tenantId,
      suggestedBridgeId: row.suggestedBridgeId,
      boundBridgeId: row.boundBridgeId ?? null,
      revokedAt: row.revokedAt ?? null,
    };
  }

  async resolveOnboardingSecretByShortCode(code: string): Promise<{
    secretId: string;
    tenantId: string;
    suggestedBridgeId: string;
    boundBridgeId: string | null;
    revokedAt: Date | null;
  } | null> {
    let hash: string;
    try {
      hash = this.hashShortCode(code);
    } catch {
      return null;
    }
    const now = new Date();
    const row = await db.query.printBridgeOnboardingSecrets.findFirst({
      where: and(
        eq(printBridgeOnboardingSecrets.shortCodeHash, hash),
        isNotNull(printBridgeOnboardingSecrets.shortCodeHash),
        // Unbound codes expire after the 5-minute pairing window (brute-force
        // protection). Once a code is bound to a bridge it becomes that
        // bridge's permanent credential until the secret is revoked (detached).
        or(
          gt(printBridgeOnboardingSecrets.shortCodeExpiresAt, now),
          isNotNull(printBridgeOnboardingSecrets.boundBridgeId),
        ),
        isNull(printBridgeOnboardingSecrets.revokedAt),
      ),
    });
    if (!row) return null;
    return {
      secretId: row.id,
      tenantId: row.tenantId,
      suggestedBridgeId: row.suggestedBridgeId,
      boundBridgeId: row.boundBridgeId ?? null,
      revokedAt: row.revokedAt ?? null,
    };
  }

  async markShortCodeFirstBind(
    code: string,
    bridgeId: string,
  ): Promise<{ firstBind: boolean; tenantId: string; suggestedBridgeId: string } | null> {
    let hash: string;
    try {
      hash = this.hashShortCode(code);
    } catch {
      return null;
    }
    const now = new Date();
    const claimed = await db
      .update(printBridgeOnboardingSecrets)
      .set({ boundBridgeId: bridgeId, lastUsedAt: now })
      .where(
        and(
          eq(printBridgeOnboardingSecrets.shortCodeHash, hash),
          isNotNull(printBridgeOnboardingSecrets.shortCodeHash),
          gt(printBridgeOnboardingSecrets.shortCodeExpiresAt, now),
          isNull(printBridgeOnboardingSecrets.revokedAt),
          isNull(printBridgeOnboardingSecrets.boundBridgeId),
        ),
      )
      .returning({
        tenantId: printBridgeOnboardingSecrets.tenantId,
        suggestedBridgeId: printBridgeOnboardingSecrets.suggestedBridgeId,
      });
    if (claimed.length > 0) {
      return {
        firstBind: true,
        tenantId: claimed[0].tenantId,
        suggestedBridgeId: claimed[0].suggestedBridgeId,
      };
    }
    const touched = await db
      .update(printBridgeOnboardingSecrets)
      .set({ lastUsedAt: now })
      .where(
        and(
          eq(printBridgeOnboardingSecrets.shortCodeHash, hash),
          isNotNull(printBridgeOnboardingSecrets.shortCodeHash),
          or(
            gt(printBridgeOnboardingSecrets.shortCodeExpiresAt, now),
            isNotNull(printBridgeOnboardingSecrets.boundBridgeId),
          ),
          isNull(printBridgeOnboardingSecrets.revokedAt),
        ),
      )
      .returning({
        tenantId: printBridgeOnboardingSecrets.tenantId,
        suggestedBridgeId: printBridgeOnboardingSecrets.suggestedBridgeId,
      });
    if (touched.length === 0) return null;
    return {
      firstBind: false,
      tenantId: touched[0].tenantId,
      suggestedBridgeId: touched[0].suggestedBridgeId,
    };
  }

  async markOnboardingSecretUsed(
    plaintext: string,
    bridgeId: string,
  ): Promise<{ firstBind: boolean }> {
    const hash = this.hashBridgeSecret(plaintext);
    const existing = await db.query.printBridgeOnboardingSecrets.findFirst({
      where: eq(printBridgeOnboardingSecrets.secretHash, hash),
    });
    if (!existing) return { firstBind: false };
    const now = new Date();
    const firstBind = existing.boundBridgeId == null;
    await db
      .update(printBridgeOnboardingSecrets)
      .set({
        lastUsedAt: now,
        boundBridgeId: firstBind ? bridgeId : existing.boundBridgeId ?? bridgeId,
      })
      .where(eq(printBridgeOnboardingSecrets.id, existing.id));
    return { firstBind };
  }

  async updateBridgeMappings(bridgeId: string, mappings: Array<{ area: string; name: string; ip?: string | null; port?: number | null }>): Promise<PrintBridge> {
    const tenantId = getTenantIdOrDefault();
    await db
      .update(printBridges)
      .set({ mappings: JSON.stringify(mappings), updatedAt: new Date() })
      .where(and(eq(printBridges.tenantId, tenantId), eq(printBridges.id, bridgeId)));
    const rows = await db
      .select()
      .from(printBridges)
      .where(and(eq(printBridges.tenantId, tenantId), eq(printBridges.id, bridgeId)))
      .limit(1);
    const row = rows[0];
    if (!row) throw new Error(`Bridge ${bridgeId} not found`);
    return this.toPrintBridge(row);
  }

  async updateBridgeClaimedAreas(bridgeId: string, claimedAreas: string[]): Promise<PrintBridge> {
    const tenantId = getTenantIdOrDefault();
    // Only real, active station ids can be a queue boundary. Anything else
    // (legacy enum keys, deleted stations) would silently strand jobs.
    const requested = claimedAreas.filter((a): a is string => typeof a === "string" && a.trim().length > 0);
    let normalized: string[] = [];
    if (requested.length > 0) {
      const stationRows = await db
        .select({ id: printStations.id })
        .from(printStations)
        .where(and(
          eq(printStations.tenantId, tenantId),
          eq(printStations.isActive, 1),
          inArray(printStations.id, requested),
        ));
      const valid = new Set(stationRows.map((row) => row.id));
      normalized = requested.filter((id) => valid.has(id));
    }
    await db
      .update(printBridges)
      .set({ claimedAreas: JSON.stringify(normalized), updatedAt: new Date() })
      .where(and(eq(printBridges.tenantId, tenantId), eq(printBridges.id, bridgeId)));
    const rows = await db
      .select()
      .from(printBridges)
      .where(and(eq(printBridges.tenantId, tenantId), eq(printBridges.id, bridgeId)))
      .limit(1);
    const row = rows[0];
    if (!row) throw new Error(`Bridge ${bridgeId} not found`);
    return this.toPrintBridge(row);
  }

  /**
   * Remove a bridge from the tenant pool. Also cleans up everything that
   * would otherwise let it come back or strand jobs:
   *  - in-flight/pending jobs are reset to pending and unassigned, so any
   *    surviving bridge can claim them again (the FK already nulls bridge_id
   *    on delete, but newer dispatched jobs would otherwise stay stuck);
   *  - any onboarding secret bound to this machine is revoked, so the agent
   *    cannot silently re-register with the same pairing code.
   */
  async deletePrintBridge(bridgeId: string): Promise<boolean> {
    const tenantId = getTenantIdOrDefault();
    return db.transaction(async (tx) => {
      const existing = await tx.query.printBridges.findFirst({
        where: and(eq(printBridges.tenantId, tenantId), eq(printBridges.id, bridgeId)),
      });
      if (!existing) return false;

      await tx
        .update(printJobs)
        .set({
          bridgeId: null,
          claimedByInstanceId: null,
          claimedAt: null,
          status: 'pending',
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(printJobs.tenantId, tenantId),
            eq(printJobs.bridgeId, bridgeId),
            inArray(printJobs.status, ['pending', 'dispatched']),
          ),
        );

      await tx
        .update(printBridgeOnboardingSecrets)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(printBridgeOnboardingSecrets.tenantId, tenantId),
            eq(printBridgeOnboardingSecrets.boundBridgeId, bridgeId),
            isNull(printBridgeOnboardingSecrets.revokedAt),
          ),
        );

      await tx
        .delete(printBridges)
        .where(and(eq(printBridges.tenantId, tenantId), eq(printBridges.id, bridgeId)));
      return true;
    });
  }

  // ─── Agent diagnostics (logs + snapshot) ──────────────────────────────

  async bridgeExistsForTenant(tenantId: string, bridgeId: string): Promise<boolean> {
    const rows = await db
      .select({ id: printBridges.id })
      .from(printBridges)
      .where(and(eq(printBridges.tenantId, tenantId), eq(printBridges.id, bridgeId)))
      .limit(1);
    return rows.length > 0;
  }

  /**
   * Persist a batch of agent logs, refresh the bridge health snapshot
   * (`last_error`, `diagnostics_at`) and prune entries older than the
   * retention window. Kept in one transaction so the snapshot never lags the
   * logs it summarizes.
   */
  async appendBridgeDiagnostics(params: {
    tenantId: string;
    bridgeId: string;
    instanceId?: string;
    lastError?: string | null;
    logs: PrintBridgeLogEntry[];
    retentionDays?: number;
  }): Promise<number> {
    const now = new Date();
    const rows = params.logs.map((entry) => ({
      id: `pbl_${crypto.randomUUID()}`,
      tenantId: params.tenantId,
      bridgeId: params.bridgeId,
      instanceId: params.instanceId ?? null,
      level: entry.level,
      component: entry.component ?? null,
      message: entry.message.slice(0, 1000),
      // Trust the agent timestamp only when parseable; fall back to server time.
      createdAt: Number.isNaN(new Date(entry.timestamp).getTime()) ? now : new Date(entry.timestamp),
    }));

    return db.transaction(async (tx) => {
      if (rows.length > 0) {
        await tx.insert(printBridgeLogs).values(rows);
      }

      await tx
        .update(printBridges)
        .set({
          lastError: params.lastError ?? null,
          diagnosticsAt: now,
          updatedAt: now,
        })
        .where(and(eq(printBridges.tenantId, params.tenantId), eq(printBridges.id, params.bridgeId)));

      const retentionMs = (params.retentionDays ?? 7) * 24 * 60 * 60 * 1000;
      await tx
        .delete(printBridgeLogs)
        .where(
          and(
            eq(printBridgeLogs.tenantId, params.tenantId),
            eq(printBridgeLogs.bridgeId, params.bridgeId),
            lt(printBridgeLogs.createdAt, new Date(now.getTime() - retentionMs)),
          ),
        );

      return rows.length;
    });
  }

  async listBridgeLogs(
    tenantId: string,
    bridgeId: string,
    options: { level?: string; limit?: number } = {},
  ): Promise<PrintBridgeLogRecord[]> {
    const conditions = [
      eq(printBridgeLogs.tenantId, tenantId),
      eq(printBridgeLogs.bridgeId, bridgeId),
    ];
    if (options.level) {
      conditions.push(eq(printBridgeLogs.level, options.level));
    }

    const rows = await db
      .select()
      .from(printBridgeLogs)
      .where(and(...conditions))
      .orderBy(desc(printBridgeLogs.createdAt))
      .limit(Math.min(Math.max(options.limit ?? 200, 1), 500));

    return rows.map((row) =>
      printBridgeLogRecordSchema.parse({
        id: row.id,
        bridgeId: row.bridgeId ?? undefined,
        level: row.level,
        component: row.component ?? undefined,
        message: row.message,
        timestamp: row.createdAt.toISOString(),
        createdAt: row.createdAt.toISOString(),
      }),
    );
  }
}

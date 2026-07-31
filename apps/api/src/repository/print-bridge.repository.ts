import { Injectable } from "@nestjs/common";
import { db } from "../db/client";
import { getTenantIdOrDefault } from "../tenant/tenant-context.store";
import { and, desc, eq, gt, inArray, isNull, isNotNull, lt, ne, or } from "drizzle-orm";
import { z } from "zod";
import crypto from "node:crypto";
import {
  printAreaSchema,
  printBridgePrinterMappingSchema,
  printJobSchema,
  type PrintArea,
  type PrintBridge,
  type PrintBridgePrinterMapping,
  type PrintBridgeOnboardingSecret,
  type PrintBridgeOnboardingSecretCreateResponse,
  type PrintBridgeOnboardingSecretCreateCode6DigitResponse,
  type PrintJob,
} from "@gustopos/shared";
import {
  printBridges,
  printBridgeOnboardingSecrets,
  printJobs,
} from "../db/schema";

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

  private toPrintBridge(row: typeof printBridges.$inferSelect): PrintBridge {
    let areas: PrintArea[] = [];
    let printers: Array<{ area: PrintArea; name: string; ip?: string | null; port?: number }> = [];
    try {
      const parsedAreas = JSON.parse(row.areas);
      if (Array.isArray(parsedAreas)) {
        areas = parsedAreas
          .filter((a): a is PrintArea => a === "kitchen" || a === "bar" || a === "cashier");
      }
    } catch {
      areas = [];
    }
    try {
      const parsedPrinters = JSON.parse(row.printers);
      if (Array.isArray(parsedPrinters)) {
        printers = parsedPrinters
          .filter((p): p is { area: string; name: string; ip?: string | null; port?: number } =>
            typeof p === "object" && p !== null && typeof (p as any).name === "string")
          .map((p) => {
            const area = (p as any).area;
            const safeArea: PrintArea = area === "kitchen" || area === "bar" || area === "cashier" ? area : "kitchen";
            return {
              name: (p as any).name as string,
              area: safeArea,
              ip: (p as any).ip ?? null,
              port: typeof (p as any).port === "number" ? (p as any).port : undefined,
            };
          });
      }
    } catch {
      printers = [];
    }

    let mappings: PrintBridgePrinterMapping[] = [];
    try {
      const parsedMappings = JSON.parse(row.mappings);
      if (Array.isArray(parsedMappings)) {
        const zodSafe = z.array(printBridgePrinterMappingSchema).safeParse(parsedMappings);
        if (zodSafe.success) {
          mappings = zodSafe.data.map((m) => ({ area: m.area, name: m.name, ip: m.ip, port: m.port }));
        } else {
          mappings = parsedMappings
          .filter(
            (m): m is { area: string; name: string; ip?: string | null; port?: number } =>
              typeof m === "object" && m !== null && typeof (m as any).name === "string",
          )
          .map((m): PrintBridgePrinterMapping | null => {
            const safeArea: PrintArea =
              (m as any).area === "kitchen" || (m as any).area === "bar" || (m as any).area === "cashier"
                ? ((m as any).area as PrintArea)
                : "kitchen";
            const name = typeof (m as any).name === "string" && (m as any).name.length > 0
              ? ((m as any).name as string)
              : null;
            if (name === null) return null;
            return {
              area: safeArea,
              name,
              ip: typeof (m as any).ip === "string" ? ((m as any).ip as string) : undefined,
              port: typeof (m as any).port === "number" ? ((m as any).port as number) : undefined,
            };
          })
          .filter((m): m is PrintBridgePrinterMapping => m !== null);
      }
      }
    } catch {
      mappings = [];
    }
    let claimedAreas: PrintArea[] = [];
    try {
      const parsedClaimed = JSON.parse(row.claimedAreas);
      if (Array.isArray(parsedClaimed)) {
        const zodSafe = z.array(printAreaSchema).safeParse(parsedClaimed);
        if (zodSafe.success) {
          claimedAreas = zodSafe.data;
        } else {
          claimedAreas = parsedClaimed.filter(
          (a): a is PrintArea => a === "kitchen" || a === "bar" || a === "cashier",
        );
      }
      }
    } catch {
      claimedAreas = [];
    }
    return {
      id: row.id,
      tenantId: row.tenantId,
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
    const existing = await db.query.printBridges.findFirst({
      where: and(eq(printBridges.tenantId, tenantId), eq(printBridges.id, payload.bridgeId)),
    });
    const now = new Date();
    const areasJson = JSON.stringify(payload.areas);
    const printersJson = JSON.stringify(payload.printers);
    if (existing) {
      await db
        .update(printBridges)
        .set({
          name: payload.name ?? existing.name,
          host: payload.host ?? existing.host,
          version: payload.version ?? existing.version,
          status: "active",
          areas: areasJson,
          printers: printersJson,
          lastHeartbeatAt: now,
          updatedAt: now,
        })
        .where(and(eq(printBridges.tenantId, tenantId), eq(printBridges.id, payload.bridgeId)));
    } else {
      await db.insert(printBridges).values({
        id: payload.bridgeId,
        tenantId,
        name: payload.name ?? payload.bridgeId,
        host: payload.host ?? null,
        version: payload.version ?? null,
        status: "active",
        areas: areasJson,
        printers: printersJson,
        lastHeartbeatAt: now,
        createdAt: now,
        updatedAt: now,
      });
    }
    return (await this.getPrintBridge(payload.bridgeId))!;
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
    if (!bridge || bridge.areas.length === 0) return [];

    const claimed = await db
      .update(printJobs)
      .set({ status: 'dispatched', bridgeId, claimedByInstanceId: instanceId, claimedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(printJobs.tenantId, tenantId),
          eq(printJobs.status, 'pending'),
          or(isNull(printJobs.bridgeId), eq(printJobs.bridgeId, bridgeId)),
          inArray(printJobs.area, bridge.areas),
        ),
      )
      .returning();
    return (claimed ?? []).slice(0, limit).map((r) => printJobSchema.parse(r));
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
    return row ? printJobSchema.parse(row) : null;
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
    return row ? printJobSchema.parse(row) : null;
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
      const shortCodeExpiresAt = new Date(now.getTime() + 90_000);

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
        ttlSeconds: 90,
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
        // Unbound codes expire after the 90s pairing window (brute-force
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

  async updateBridgeMappings(bridgeId: string, mappings: Array<{ area: PrintArea; name: string; ip?: string | null; port?: number | null }>): Promise<PrintBridge> {
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

  async updateBridgeClaimedAreas(bridgeId: string, claimedAreas: PrintArea[]): Promise<PrintBridge> {
    const tenantId = getTenantIdOrDefault();
    await db
      .update(printBridges)
      .set({ claimedAreas: JSON.stringify(claimedAreas), updatedAt: new Date() })
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
}

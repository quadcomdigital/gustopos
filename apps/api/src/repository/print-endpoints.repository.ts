import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import crypto from "node:crypto";
import { db } from "../db/client";
import { printBridges, printEndpoints } from "../db/schema";
import { getTenantIdOrDefault } from "../tenant/tenant-context.store";
import {
  printEndpointSchema,
  type PrintEndpoint,
  type PrintEndpointUpdateRequest,
} from "@gustopos/shared";
import {
  planEndpointUpsert,
  type BridgePrinterReport,
  type EndpointRow,
} from "./print-endpoints.logic";

/** Zod contract caps names at 120 chars: a pathological QZ printer name must
 *  never make the whole registry listing fail to parse. */
const safeName = (name: string): string => name.slice(0, 120).trim() || name.slice(0, 120);

/**
 * Registry of ACQUIRED printers, fed by the two reports a bridge can send:
 * the heartbeat QZ enumeration (authoritative for its machine) and LAN scan
 * results (partial). Upsert-only — rows are refreshed, never deleted — so a
 * configuration can keep referencing `ip:port` while the printer is off.
 */
@Injectable()
export class PrintEndpointsRepository {
  /** Repeated heartbeats do not rewrite an already-fresh row. */
  private static readonly SEEN_WINDOW_MS = 60_000;

  /**
   * Applies one bridge report to the registry.
   *
   * `deactivatesMissing` is true ONLY for a complete QZ enumeration: a scan
   * cannot prove a printer is gone (its host may simply be off).
   */
  async ingest(params: {
    bridgeId: string;
    instanceId: string | null;
    printers: readonly BridgePrinterReport[];
    deactivatesMissing: boolean;
    overrideTenantId?: string;
  }): Promise<void> {
    if (params.printers.length === 0 && !params.deactivatesMissing) return;
    const tenantId = params.overrideTenantId ?? getTenantIdOrDefault();

    const existing = await db
      .select({
        id: printEndpoints.id,
        kind: printEndpoints.kind,
        name: printEndpoints.name,
        ip: printEndpoints.ip,
        port: printEndpoints.port,
        instanceId: printEndpoints.instanceId,
        vendor: printEndpoints.vendor,
        mac: printEndpoints.mac,
        isActive: printEndpoints.isActive,
        lastSeenAt: printEndpoints.lastSeenAt,
      })
      .from(printEndpoints)
      .where(eq(printEndpoints.tenantId, tenantId));
    const rows: EndpointRow[] = existing.map((row) => ({
      ...row,
      kind: row.kind === "qz" ? "qz" : "net",
      isActive: row.isActive,
      lastSeenAt: row.lastSeenAt,
    }));

    const plan = planEndpointUpsert(rows, params.printers, {
      bridgeId: params.bridgeId,
      instanceId: params.instanceId,
      now: new Date(),
      seenWindowMs: PrintEndpointsRepository.SEEN_WINDOW_MS,
      deactivatesMissing: params.deactivatesMissing,
    });

    for (const upsert of plan.upserts) {
      if (upsert.existingId) {
        if (!upsert.refreshLastSeen) continue;
        await db
          .update(printEndpoints)
          .set({
            name: safeName(upsert.name),
            ip: upsert.ip,
            port: upsert.port,
            vendor: upsert.vendor,
            mac: upsert.mac,
            instanceId: upsert.instanceId,
            bridgeId: upsert.bridgeId,
            isActive: 1,
            lastSeenAt: new Date(),
            updatedAt: new Date(),
          })
          .where(
            and(eq(printEndpoints.tenantId, tenantId), eq(printEndpoints.id, upsert.existingId)),
          );
        continue;
      }
      try {
        await db.insert(printEndpoints).values({
          id: `pe_${crypto.randomUUID()}`,
          tenantId,
          kind: upsert.kind,
          name: safeName(upsert.name),
          ip: upsert.ip,
          port: upsert.port,
          vendor: upsert.vendor,
          mac: upsert.mac,
          instanceId: upsert.instanceId,
          bridgeId: upsert.bridgeId,
          isActive: 1,
        });
      } catch (error) {
        // Two heartbeats can report the same printer concurrently: the partial
        // unique index rejects the loser, which is exactly what we want.
        const code =
          typeof error === "object" && error !== null && "code" in error
            ? String((error as { code?: unknown }).code)
            : "";
        if (code !== "23505") throw error;
      }
    }

    if (plan.deactivateIds.length > 0) {
      await db
        .update(printEndpoints)
        .set({ isActive: 0, updatedAt: new Date() })
        .where(
          and(
            eq(printEndpoints.tenantId, tenantId),
            inArray(printEndpoints.id, plan.deactivateIds),
          ),
        );
    }
  }

  /** Every acquired printer of this tenant, newest sighting first. */
  async list(): Promise<PrintEndpoint[]> {
    const tenantId = getTenantIdOrDefault();
    const rows = await db
      .select({
        endpoint: printEndpoints,
        bridgeName: printBridges.name,
      })
      .from(printEndpoints)
      .leftJoin(printBridges, eq(printEndpoints.bridgeId, printBridges.id))
      .where(eq(printEndpoints.tenantId, tenantId))
      .orderBy(asc(printEndpoints.kind), desc(printEndpoints.lastSeenAt));

    return rows.map(({ endpoint, bridgeName }) =>
      printEndpointSchema.parse({
        id: endpoint.id,
        kind: endpoint.kind === "qz" ? "qz" : "net",
        name: endpoint.name,
        ip: endpoint.ip,
        port: endpoint.port,
        vendor: endpoint.vendor,
        mac: endpoint.mac,
        instanceId: endpoint.instanceId,
        bridgeId: endpoint.bridgeId,
        bridgeName: bridgeName ?? undefined,
        isActive: endpoint.isActive === 1,
        firstSeenAt: endpoint.firstSeenAt.toISOString(),
        lastSeenAt: endpoint.lastSeenAt.toISOString(),
      }),
    );
  }

  /** Rename an acquired printer, or park it without losing its history. */
  async update(id: string, payload: PrintEndpointUpdateRequest): Promise<PrintEndpoint> {
    const tenantId = getTenantIdOrDefault();
    const existing = await db.query.printEndpoints.findFirst({
      where: and(eq(printEndpoints.tenantId, tenantId), eq(printEndpoints.id, id)),
    });
    if (!existing) throw new NotFoundException("Acquired printer not found");

    const name = payload.name?.trim();
    if (payload.name !== undefined && !name) {
      throw new BadRequestException("Printer name cannot be empty");
    }

    await db
      .update(printEndpoints)
      .set({
        ...(name ? { name } : {}),
        ...(payload.isActive !== undefined ? { isActive: payload.isActive ? 1 : 0 } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(printEndpoints.tenantId, tenantId), eq(printEndpoints.id, id)));

    const updated = await db.query.printEndpoints.findFirst({
      where: and(eq(printEndpoints.tenantId, tenantId), eq(printEndpoints.id, id)),
    });
    if (!updated) throw new NotFoundException("Acquired printer not found");
    return this.toEndpoint(updated, null);
  }

  /**
   * Forget an acquired printer. Configurations that still point at it keep
   * their target (a mapping is an ip:port, not a foreign key) — the editor
   * simply stops offering it as a choice.
   */
  async remove(id: string): Promise<boolean> {
    const tenantId = getTenantIdOrDefault();
    const deleted = await db
      .delete(printEndpoints)
      .where(and(eq(printEndpoints.tenantId, tenantId), eq(printEndpoints.id, id)))
      .returning({ id: printEndpoints.id });
    return deleted.length > 0;
  }

  private toEndpoint(
    row: typeof printEndpoints.$inferSelect,
    bridgeName: string | null,
  ): PrintEndpoint {
    return printEndpointSchema.parse({
      id: row.id,
      kind: row.kind === "qz" ? "qz" : "net",
      name: row.name,
      ip: row.ip,
      port: row.port,
      vendor: row.vendor,
      mac: row.mac,
      instanceId: row.instanceId,
      bridgeId: row.bridgeId,
      bridgeName: bridgeName ?? undefined,
      isActive: row.isActive === 1,
      firstSeenAt: row.firstSeenAt.toISOString(),
      lastSeenAt: row.lastSeenAt.toISOString(),
    });
  }
}

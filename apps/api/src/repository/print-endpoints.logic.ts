// ─── Acquired printer registry: pure planning helpers ────────────────────
//
// Decides WHAT to write for a bridge report (heartbeat QZ enumeration or LAN
// scan). Kept free of database imports so the merge rules can be unit-tested:
// the repository only applies the plan.
//
// Two invariants:
//  - an endpoint is never deleted, only refreshed (upsert-only) — a printer
//    that is off today must still be selectable in a configuration;
//  - only a COMPLETE QZ enumeration for a machine may deactivate its printers.
//    A network scan is partial evidence (some hosts are off), so it never does.

export type EndpointKind = "net" | "qz";

export interface BridgePrinterReport {
  name: string;
  ip?: string | null;
  port?: number | null;
  source?: "qz" | "net" | null;
  vendor?: string | null;
  mac?: string | null;
}

/** A registry row as the planner sees it (already tenant-scoped). */
export interface EndpointRow {
  id: string;
  kind: EndpointKind;
  name: string;
  ip: string | null;
  port: number | null;
  instanceId: string | null;
  vendor: string | null;
  mac: string | null;
  isActive: number;
  lastSeenAt: Date;
}

export interface EndpointUpsert {
  existingId: string | null;
  kind: EndpointKind;
  name: string;
  ip: string | null;
  port: number | null;
  instanceId: string | null;
  bridgeId: string;
  vendor: string | null;
  mac: string | null;
  /** last_seen_at is only touched when the sighting is stale (see window). */
  refreshLastSeen: boolean;
}

export interface EndpointPlan {
  upserts: EndpointUpsert[];
  /** Rows to deactivate: QZ printers the machine no longer reports. */
  deactivateIds: string[];
}

export interface PlanOptions {
  bridgeId: string;
  /** Stable machine identity; null for browser bridges (QZ scope is lost). */
  instanceId: string | null;
  now: Date;
  /** Refetch window: repeated heartbeats do not rewrite an up-to-date row. */
  seenWindowMs: number;
  /** True only for a complete QZ enumeration of `instanceId`. */
  deactivatesMissing: boolean;
}

/** Registry key/value of one raw printer entry, or null when unusable. */
export function toSeed(printer: BridgePrinterReport): {
  kind: EndpointKind;
  name: string;
  ip: string | null;
  port: number | null;
  vendor: string | null;
  mac: string | null;
} | null {
  const name = printer.name.trim();
  if (!name) return null;

  const hasIp = typeof printer.ip === "string" && printer.ip.trim().length > 0;
  // `source: "qz"` wins: a driver installed on the PC never becomes a network
  // endpoint even if it happens to expose an IP.
  const isNet = printer.source !== "qz" && hasIp;

  if (!isNet && printer.source !== "qz" && !hasIp) return null; // nothing addressable

  if (isNet) {
    const ip = (printer.ip as string).trim();
    const port = Number(printer.port) > 0 ? Number(printer.port) : 9100;
    return { kind: "net", name, ip, port, vendor: printer.vendor ?? null, mac: printer.mac ?? null };
  }
  return { kind: "qz", name, ip: null, port: null, vendor: printer.vendor ?? null, mac: printer.mac ?? null };
}

/**
 * Diffs a bridge report against the existing registry rows and returns the
 * writes to perform. Matching: net → (ip, port), qz → (instanceId, name).
 */
export function planEndpointUpsert(
  rows: readonly EndpointRow[],
  printers: readonly BridgePrinterReport[],
  options: PlanOptions,
): EndpointPlan {
  const seeds = printers
    .map(toSeed)
    .filter((seed): seed is NonNullable<ReturnType<typeof toSeed>> => seed !== null);

  // Same printer reported twice in one payload = one endpoint.
  const unique = new Map<string, (typeof seeds)[number]>();
  for (const seed of seeds) {
    const key = seed.kind === "net" ? `net|${seed.ip}|${seed.port}` : `qz|${seed.name}`;
    if (!unique.has(key)) unique.set(key, seed);
  }

  const index = new Map<string, EndpointRow>();
  for (const row of rows) {
    const key =
      row.kind === "net"
        ? `net|${row.ip ?? ""}|${row.port ?? ""}`
        : `qz|${row.instanceId ?? ""}|${row.name}`;
    index.set(key, row);
  }

  const upserts: EndpointUpsert[] = [];
  const seenQzNames = new Set<string>();

  for (const seed of unique.values()) {
    const key =
      seed.kind === "net"
        ? `net|${seed.ip}|${seed.port}`
        : `qz|${options.instanceId ?? ""}|${seed.name}`;
    const existing = index.get(key) ?? null;

    if (seed.kind === "qz") seenQzNames.add(seed.name);

    // vendor/mac are OPTIONAL enrichment: a report that does not carry them
    // must neither wipe the known values nor count as a change (otherwise
    // every heartbeat would rewrite the row it just read).
    const vendorDiffers = seed.vendor !== null && seed.vendor !== (existing?.vendor ?? null);
    const macDiffers = seed.mac !== null && seed.mac !== (existing?.mac ?? null);
    const identityChanged =
      !existing ||
      existing.name !== seed.name ||
      vendorDiffers ||
      macDiffers ||
      existing.instanceId !== options.instanceId;

    const stale =
      !existing || options.now.getTime() - existing.lastSeenAt.getTime() >= options.seenWindowMs;

    upserts.push({
      existingId: existing?.id ?? null,
      kind: seed.kind,
      name: seed.name,
      ip: seed.ip,
      port: seed.port,
      instanceId: options.instanceId,
      bridgeId: options.bridgeId,
      vendor: seed.vendor ?? existing?.vendor ?? null,
      mac: seed.mac ?? existing?.mac ?? null,
      // Deactivated printers come back to life on the next sighting.
      refreshLastSeen: identityChanged || stale || existing?.isActive !== 1,
    });
  }

  const deactivateIds: string[] = [];
  const canDeactivate = options.deactivatesMissing && options.instanceId !== null;
  if (canDeactivate) {
    for (const row of rows) {
      if (row.kind !== "qz") continue;
      if (row.instanceId !== options.instanceId) continue;
      if (row.isActive !== 1) continue;
      if (seenQzNames.has(row.name)) continue;
      deactivateIds.push(row.id);
    }
  }

  return { upserts, deactivateIds };
}

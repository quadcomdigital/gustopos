import type {
  PrintBridge,
  PrintBridgePrinterMapping,
  PrintProfileBridge,
} from "@gustopos/shared";
import { isLegacyAreaKey, normalizeStationIds } from "./print-areas";

/** Narrowed write contract accepted by `updateBridgeMappings`. */
export interface StationPrinterTarget {
  area: string;
  name: string;
  ip?: string | null;
  port?: number | null;
}

// ─── Print configurations (profiles): pure planning helpers ───────────────
//
// Everything here is side-effect free so the snapshot/apply decisions can be
// unit-tested without a database. The repository only performs the writes.

/**
 * Captures the routing of the current pool. `bridgeIds` narrows the snapshot
 * to part of the pool; omitted/empty means the whole pool.
 */
export function snapshotBridges(
  bridges: readonly PrintBridge[],
  bridgeIds?: readonly string[],
): PrintProfileBridge[] {
  const wanted = bridgeIds && bridgeIds.length > 0 ? new Set(bridgeIds) : null;
  return bridges
    .filter((bridge) => !wanted || wanted.has(bridge.id))
    .map((bridge) => ({
      bridgeId: bridge.id,
      instanceId: bridge.instanceId ?? null,
      label: bridge.name,
      mappings: normalizeMappings(bridge.mappings ?? []),
      claimedAreas: normalizeStationIds(bridge.claimedAreas ?? []),
    }));
}

/**
 * A snapshot entry maps to a live bridge by stable machine identity first
 * (so re-pairing the same PC keeps working), then by bridge id.
 */
export function matchProfileBridge(
  entry: Pick<PrintProfileBridge, "bridgeId" | "instanceId">,
  bridges: readonly PrintBridge[],
): PrintBridge | null {
  if (entry.instanceId) {
    const byInstance = bridges.find((bridge) => bridge.instanceId === entry.instanceId);
    if (byInstance) return byInstance;
  }
  return bridges.find((bridge) => bridge.id === entry.bridgeId) ?? null;
}

/**
 * Stations requested by the profile that still exist AND are active. Anything
 * else is returned as `dropped`: applying it would silently strand jobs for a
 * station that no longer accepts a queue boundary, so callers must surface it.
 */
export function planClaimedAreas(
  claimedAreas: readonly string[],
  activeStationIds: ReadonlySet<string>,
): { areas: string[]; dropped: string[] } {
  const requested = normalizeStationIds(claimedAreas);
  const areas = requested.filter((id) => activeStationIds.has(id));
  const dropped = requested.filter((id) => !activeStationIds.has(id));
  return { areas, dropped };
}

/**
 * Mappings only make sense for stations the bridge will actually claim: a
 * target for an unclaimed station can never be reached (jobs are bounded by
 * claimedAreas), and legacy enum keys must not survive. The returned shape is
 * the narrowed write contract accepted by `updateBridgeMappings`.
 */
export function planMappings(
  mappings: readonly PrintBridgePrinterMapping[],
  areas: readonly string[],
): StationPrinterTarget[] {
  const kept = new Set(areas);
  return normalizeMappings(mappings).filter((mapping) => kept.has(mapping.area));
}

/**
 * Normalizes a FULL replacement of a profile's content (the editor's draft).
 *
 * Permissive by design: an entry whose bridge is no longer in the pool and a
 * station id that is currently unknown or deactivated are KEPT — they carry
 * the denormalised `label`/`instanceId` needed to be reported later
 * (`missing`, `droppedStations`), and a saved configuration must stay
 * editable whenever and however we want. Only unreachable printer targets are
 * dropped (mappings outside the entry's claimed areas, legacy enum keys,
 * nameless targets) — exactly the trimming activation performs.
 *
 * Duplicate entries for the same machine (matched by instanceId first, then
 * bridge id) collapse into one, and live identity fields win over stale ones.
 */
export function normalizeProfileBridges(
  entries: readonly PrintProfileBridge[],
  liveBridges: readonly PrintBridge[],
): PrintProfileBridge[] {
  const seen = new Set<string>();
  const normalized: PrintProfileBridge[] = [];

  for (const entry of entries) {
    const bridgeId = typeof entry.bridgeId === "string" ? entry.bridgeId.trim() : "";
    if (!bridgeId) continue;

    const live = matchProfileBridge(entry, liveBridges);
    const key = live ? `live:${live.id}` : `entry:${entry.instanceId ?? bridgeId}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const claimedAreas = normalizeStationIds(entry.claimedAreas ?? []);
    const label = live?.name || entry.label;
    normalized.push({
      bridgeId: live?.id ?? bridgeId,
      instanceId: live?.instanceId ?? entry.instanceId ?? null,
      ...(label ? { label } : {}),
      mappings: planMappings(entry.mappings ?? [], claimedAreas),
      claimedAreas,
    });
  }

  return normalized;
}

/**
 * Conflicts INSIDE a configuration: the same station claimed by two of its
 * bridges. Computed on the draft while editing (UI warning) and on the stored
 * content (row badge) — activation re-checks the same thing against the live
 * pool. `bridgeIds` are de-duplicated, so a machine listed twice never counts
 * as its own conflict.
 */
export function profileConflicts(
  entries: readonly Pick<PrintProfileBridge, "bridgeId" | "claimedAreas">[],
): Array<{ stationId: string; bridgeIds: string[] }> {
  return findClaimedAreaOverlaps(
    entries.map((entry) => ({ id: entry.bridgeId, claimedAreas: entry.claimedAreas ?? [] })),
  );
}

/**
 * A station claimed by two bridges makes pending jobs race between the two
 * agents (claim polling is non-deterministic), so both profiles and the live
 * pool are checked for this before/after activation.
 */
export function findClaimedAreaOverlaps(
  bridges: readonly Pick<PrintBridge, "id" | "claimedAreas">[],
): Array<{ stationId: string; bridgeIds: string[] }> {
  const byStation = new Map<string, Set<string>>();
  for (const bridge of bridges) {
    for (const stationId of normalizeStationIds(bridge.claimedAreas ?? [])) {
      const claimers = byStation.get(stationId) ?? new Set<string>();
      claimers.add(bridge.id);
      byStation.set(stationId, claimers);
    }
  }
  return [...byStation.entries()]
    .filter(([, claimers]) => claimers.size > 1)
    .map(([stationId, claimers]) => ({ stationId, bridgeIds: [...claimers] }));
}

function normalizeMappings(
  mappings: readonly PrintBridgePrinterMapping[],
): StationPrinterTarget[] {
  const targets: StationPrinterTarget[] = [];
  for (const mapping of mappings) {
    if (typeof mapping.area !== "string" || isLegacyAreaKey(mapping.area)) continue;
    if (typeof mapping.name !== "string" || mapping.name.trim().length === 0) continue;
    targets.push({
      area: mapping.area,
      name: mapping.name,
      ...(mapping.ip ? { ip: mapping.ip } : {}),
      ...(mapping.port ? { port: mapping.port } : {}),
    });
  }
  return targets;
}

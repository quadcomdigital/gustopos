import type { PrintBridge, PrintProfile, PrintProfileBridge } from '@gustopos/shared';
import { filterLegacyAreas } from './legacy-areas';

// ─── Shared helpers for print configurations (profiles) ───────────────────
//
// Kept beside the components (not in shared) because they are view logic:
// the API has its own authoritative copies in print-profiles.logic.ts.

/**
 * Where a bridge's LIVE routing stands relative to the ACTIVE configuration.
 *
 * The configuration is the single writer of routing: components never edit the
 * live routing, they only report drift and link back to the configuration.
 * `null` means there is no active configuration at all (live is authoritative).
 */
export type RoutingSourceStatus = 'aligned' | 'diverges' | 'not-in-profile';

/**
 * Full picture for one bridge: its routing vs the active configuration AND
 * whether the agent has received it yet.
 *
 * The agent picks mappings up on its next heartbeat, so "saved on the server"
 * and "printed by the machine" are two different moments — `activeAt` (when
 * the configuration was applied) compared with the last heartbeat tells them
 * apart without any extra column.
 */
export type BridgeConfigStatus =
  | 'no-config'      // no configuration active: live routing is authoritative
  | 'not-in-profile' // this bridge isn't part of the active configuration
  | 'diverges'       // live differs from the saved routing → must be applied
  | 'waiting'        // applied, agent hasn't heartbeat since
  | 'applied';       // applied and received by the agent

export function bridgeConfigStatus(
  bridge: PrintBridge,
  profile: PrintProfile | null | undefined,
  activeAt: string | null | undefined,
): BridgeConfigStatus {
  const routing = bridgeRoutingStatus(bridge, profile);
  if (routing === null) return 'no-config';
  if (routing === 'not-in-profile') return 'not-in-profile';
  if (routing === 'diverges') return 'diverges';

  const appliedMs = activeAt ? Date.parse(activeAt) : NaN;
  if (!Number.isFinite(appliedMs)) return 'applied'; // legacy state: no timestamp
  const heartbeatMs = Date.parse(bridge.lastHeartbeatAt ?? '');
  if (!Number.isFinite(heartbeatMs)) return 'waiting';
  return heartbeatMs >= appliedMs ? 'applied' : 'waiting';
}


/**
 * A profile entry resolves to a live bridge by stable machine identity first
 * (so re-pairing the same PC keeps working), then by bridge id.
 */
export function findLiveBridge(
  entry: Pick<PrintProfileBridge, 'bridgeId' | 'instanceId'>,
  bridges: readonly PrintBridge[],
): PrintBridge | null {
  if (entry.instanceId) {
    const byInstance = bridges.find((bridge) => bridge.instanceId === entry.instanceId);
    if (byInstance) return byInstance;
  }
  return bridges.find((bridge) => bridge.id === entry.bridgeId) ?? null;
}

/**
 * Compares a bridge's live routing with the entry a configuration holds for it
 * (station set + station → printer target). Order is irrelevant; a station
 * whose target changed, was added or was removed counts as divergence.
 */
export function bridgeRoutingStatus(
  bridge: PrintBridge,
  profile: PrintProfile | null | undefined,
): RoutingSourceStatus | null {
  if (!profile) return null;

  const entry = profile.bridges.find(
    (candidate) =>
      (candidate.instanceId && candidate.instanceId === bridge.instanceId) ||
      candidate.bridgeId === bridge.id,
  );
  if (!entry) return 'not-in-profile';

  const liveAreas = filterLegacyAreas(bridge.claimedAreas ?? []);
  const savedAreas = filterLegacyAreas(entry.claimedAreas ?? []);
  const sameAreas =
    liveAreas.length === savedAreas.length &&
    liveAreas.every((area) => savedAreas.includes(area));
  if (!sameAreas) return 'diverges';

  const target = (
    mappings: readonly { area?: string | null; name: string; ip?: string | null; port?: number | null }[],
    area: string,
  ): string => {
    const mapping = mappings.find((candidate) => candidate.area === area);
    if (!mapping) return '';
    if (mapping.ip) return `net:${mapping.ip}:${mapping.port ?? 9100}`;
    return `qz:${mapping.name}`;
  };

  const sameTargets = liveAreas.every(
    (area) =>
      target(bridge.mappings ?? [], area) === target(entry.mappings ?? [], area),
  );
  return sameTargets ? 'aligned' : 'diverges';
}

/**
 * The same station claimed twice — either inside one configuration (draft
 * conflicts, shown while editing) or by two live bridges (pool conflicts).
 * Duplicate entries for the same machine collapse into one claimer.
 *
 * A station on two bridges makes pending jobs race between agents: claim
 * polling is non-deterministic, so whoever polls first takes the ticket.
 */
export function findClaimedStationConflicts(
  entries: readonly Pick<PrintProfileBridge, 'bridgeId' | 'claimedAreas'>[],
): Array<{ stationId: string; bridgeIds: string[] }> {
  const byStation = new Map<string, Set<string>>();
  for (const entry of entries) {
    for (const stationId of filterLegacyAreas(entry.claimedAreas ?? [])) {
      const claimers = byStation.get(stationId) ?? new Set<string>();
      claimers.add(entry.bridgeId);
      byStation.set(stationId, claimers);
    }
  }
  return [...byStation.entries()]
    .filter(([, claimers]) => claimers.size > 1)
    .map(([stationId, claimers]) => ({ stationId, bridgeIds: [...claimers] }));
}

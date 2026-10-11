import type {
  PrintBridge,
  PrintBridgePrinterMapping,
  PrintEndpoint,
} from '@gustopos/shared';

// ─── Printer target options ───────────────────────────────────────────────
//
// The profile editor builds ONE "pick a printer for this station" select,
// encoded as `qz:<name>` (driver on a POS PC) or `net:<ip>:<port>` (raw TCP).
//
// Options = ACQUIRED endpoints (tenant registry — survives a printer being
// off and its bridge being offline) ∪ what the bridge reports RIGHT NOW
// (fills gaps for printers that were never registered). The registry wins on
// duplicates: it carries the last-seen state the live list cannot.
//
// The SELECTED value is what the configuration stores — printers themselves
// are never stored inside a configuration, only their address.

export interface PrinterTargetOption {
  value: string;
  label: string;
}

export type ParsedPrinterTarget =
  | { kind: 'net'; ip: string; port: number }
  | { kind: 'qz'; name: string };

/** Go agents only accept printers QZ Tray actually reports on that machine. */
export function isGoAgent(bridge: Pick<PrintBridge, 'version'>): boolean {
  return typeof bridge.version === 'string' && bridge.version.startsWith('go-');
}

/** QZ Tray printers installed locally, deduplicated and sorted. */
export function discoveredPrinterNames(bridge: Pick<PrintBridge, 'printers'>): string[] {
  const printers = Array.isArray(bridge.printers) ? bridge.printers : [];
  const names = printers
    .filter((printer) => printer.source !== 'net')
    .map((printer) => printer.name.trim())
    .filter(Boolean);
  return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
}

/** LAN printers found by the network scan, ordered by IP. */
export function networkDevices(bridge: Pick<PrintBridge, 'printers'>): PrintBridge['printers'] {
  const printers = Array.isArray(bridge.printers) ? bridge.printers : [];
  return printers
    .filter((printer) => printer.source === 'net' && printer.ip)
    .slice()
    .sort((a, b) => String(a.ip).localeCompare(String(b.ip)));
}

/**
 * Printer choices for one zone: the acquired registry first (always usable),
 * then whatever the bridge currently reports.
 *
 * `bridge` may be null — a configuration can be built while its bridge is
 * offline or not yet paired; in that case the registry is the only source and
 * QZ names are qualified with the machine that published them.
 */
export function printerTargetOptions(
  bridge: Pick<PrintBridge, 'printers' | 'instanceId'> | null | undefined,
  endpoints: readonly PrintEndpoint[] = [],
): PrinterTargetOption[] {
  const options = new Map<string, PrinterTargetOption>();
  const now = Date.now();

  const acquiredLabel = (endpoint: PrintEndpoint): string => {
    if (!endpoint.isActive) return ' · spenta';
    const ageMs = now - Date.parse(endpoint.lastSeenAt);
    if (!Number.isFinite(ageMs) || ageMs < 0) return '';
    const hours = Math.floor(ageMs / 3_600_000);
    if (hours < 1) return '';
    if (hours < 24) return ` · vista ${hours}h fa`;
    return ` · vista ${Math.floor(hours / 24)}g fa`;
  };

  // 1 · Acquired endpoints (registry)
  for (const endpoint of [...endpoints].sort((a, b) => a.name.localeCompare(b.name))) {
    if (endpoint.kind === 'qz') {
      // A QZ name exists only on the machine that publishes it.
      if (
        bridge?.instanceId &&
        endpoint.instanceId &&
        bridge.instanceId !== endpoint.instanceId
      ) {
        continue;
      }
      const value = `qz:${endpoint.name}`;
      if (options.has(value)) continue;
      const machine = !bridge && endpoint.bridgeName ? ` · ${endpoint.bridgeName}` : '';
      options.set(value, {
        value,
        label: `${endpoint.name} · QZ${machine}${acquiredLabel(endpoint)}`,
      });
      continue;
    }
    if (!endpoint.ip) continue;
    const port = endpoint.port ?? 9100;
    const value = `net:${endpoint.ip}:${port}`;
    options.set(value, {
      value,
      label: `${endpoint.ip}:${port}${endpoint.name ? ` · ${endpoint.name}` : ''}${acquiredLabel(endpoint)}`,
    });
  }

  // 2 · Live capabilities of the bridge (gap fill)
  if (bridge) {
    for (const name of discoveredPrinterNames(bridge)) {
      const value = `qz:${name}`;
      if (options.has(value)) continue;
      options.set(value, { value, label: `${name} · QZ locale` });
    }
    for (const device of networkDevices(bridge)) {
      const ip = device.ip as string;
      const port = device.port ?? 9100;
      const value = `net:${ip}:${port}`;
      if (options.has(value)) continue;
      options.set(value, {
        value,
        label: `${ip}:${port}${device.vendor ? ` · ${device.vendor}` : ''} · rete`,
      });
    }
  }

  return [...options.values()];
}

/** Stored mapping → select value (`''` when the station has no target yet). */
export function encodePrinterTarget(
  mapping: PrintBridgePrinterMapping | undefined,
): string {
  if (!mapping) return '';
  if (mapping.ip) return `net:${mapping.ip}:${mapping.port ?? 9100}`;
  if (mapping.name) return `qz:${mapping.name}`;
  return '';
}

/** Select value → target. Returns `null` for an empty/unparsable value. */
export function parsePrinterTarget(value: string): ParsedPrinterTarget | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('net:')) {
    const [, ip, portStr] = trimmed.split(':');
    if (!ip) return null;
    const port = Number.parseInt(portStr ?? '', 10);
    return { kind: 'net', ip, port: Number.isFinite(port) ? port : 9100 };
  }
  const name = trimmed.startsWith('qz:') ? trimmed.slice(3) : trimmed;
  return name ? { kind: 'qz', name } : null;
}

/** Target → the mapping shape stored in a profile / on a bridge. */
export function targetToMapping(
  area: string,
  target: ParsedPrinterTarget,
): PrintBridgePrinterMapping {
  return target.kind === 'net'
    ? { area, name: `${target.ip}:${target.port}`, ip: target.ip, port: target.port }
    : { area, name: target.name };
}

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  planEndpointUpsert,
  toSeed,
  type EndpointRow,
  type PlanOptions,
} from "./print-endpoints.logic";

const NOW = new Date("2026-09-27T12:00:00.000Z");
const MINUTE = 60_000;

function options(overrides: Partial<PlanOptions> = {}): PlanOptions {
  return {
    bridgeId: "br_1",
    instanceId: "inst_1",
    now: NOW,
    seenWindowMs: MINUTE,
    deactivatesMissing: false,
    ...overrides,
  };
}

function row(overrides: Partial<EndpointRow> = {}): EndpointRow {
  return {
    id: "pe_1",
    kind: "net",
    name: "EPSON TM-T20",
    ip: "192.168.1.40",
    port: 9100,
    instanceId: "inst_1",
    vendor: "Epson",
    mac: null,
    isActive: 1,
    lastSeenAt: NOW,
    ...overrides,
  };
}

// ─── toSeed ───────────────────────────────────────────────────────────────

test("toSeed keeps a LAN printer as net with the default port 9100", () => {
  assert.deepEqual(toSeed({ name: " Stampante sala ", ip: "10.0.0.5", source: "net" }), {
    kind: "net",
    name: "Stampante sala",
    ip: "10.0.0.5",
    port: 9100,
    vendor: null,
    mac: null,
  });
});

test("toSeed keeps a QZ printer as qz even when it exposes an IP", () => {
  const seed = toSeed({ name: "Cucina-EPSON", ip: "127.0.0.1", source: "qz" });
  assert.equal(seed?.kind, "qz");
  assert.equal(seed?.ip, null);
});

test("toSeed drops entries that are neither addressable nor QZ", () => {
  assert.equal(toSeed({ name: "  " }), null, "no name");
  assert.equal(toSeed({ name: "anonima" }), null, "no ip and no source");
});

// ─── planEndpointUpsert ───────────────────────────────────────────────────

test("a new report inserts one row per endpoint, deduplicated", () => {
  const plan = planEndpointUpsert(
    [],
    [
      { name: "Cucina", ip: "192.168.1.40", port: 9100, source: "net" },
      { name: "Cucina", ip: "192.168.1.40", port: 9100, source: "net" },
      { name: "Cassa-Zebra", source: "qz" },
    ],
    options(),
  );

  assert.equal(plan.upserts.length, 2);
  assert.deepEqual(
    plan.upserts.map((u) => [u.kind, u.existingId]),
    [
      ["net", null],
      ["qz", null],
    ],
  );
  assert.deepEqual(plan.deactivateIds, []);
});

test("a fresh, already-known endpoint is not rewritten", () => {
  const existing = row({ lastSeenAt: new Date(NOW.getTime() - 5_000) });
  const plan = planEndpointUpsert(
    [existing],
    [{ name: "EPSON TM-T20", ip: "192.168.1.40", port: 9100, source: "net" }],
    options(),
  );

  assert.equal(plan.upserts.length, 1);
  assert.equal(plan.upserts[0].existingId, existing.id);
  assert.equal(plan.upserts[0].refreshLastSeen, false, "no write inside the window");
});

test("a stale sighting is refreshed", () => {
  const existing = row({ lastSeenAt: new Date(NOW.getTime() - 10 * MINUTE) });
  const plan = planEndpointUpsert(
    [existing],
    [{ name: "EPSON TM-T20", ip: "192.168.1.40", port: 9100, source: "net" }],
    options(),
  );
  assert.equal(plan.upserts[0].refreshLastSeen, true);
});

test("a deactivated printer comes back on the next sighting", () => {
  const existing = row({ isActive: 0, lastSeenAt: NOW });
  const plan = planEndpointUpsert(
    [existing],
    [{ name: "EPSON TM-T20", ip: "192.168.1.40", port: 9100, source: "net" }],
    options(),
  );
  assert.equal(plan.upserts[0].refreshLastSeen, true, "revival must write isActive=1");
});

test("QZ endpoints are scoped to the machine that reports them", () => {
  const plan = planEndpointUpsert(
    [],
    [{ name: "Cassa-Zebra", source: "qz" }],
    options({ instanceId: null }),
  );
  // No machine identity → stored, but never matched against another PC's list.
  assert.equal(plan.upserts[0].instanceId, null);
  assert.deepEqual(plan.deactivateIds, []);
});

test("only a complete QZ enumeration deactivates printers the PC dropped", () => {
  const kept = row({ id: "pe_keep", kind: "qz", name: "Cassa", ip: null, port: null });
  const gone = row({ id: "pe_gone", kind: "qz", name: "Vecchia", ip: null, port: null });

  const heartbeat = planEndpointUpsert(
    [kept, gone],
    [{ name: "Cassa", source: "qz" }],
    options({ deactivatesMissing: true }),
  );
  assert.deepEqual(heartbeat.deactivateIds, ["pe_gone"]);
  assert.equal(heartbeat.upserts.length, 1);

  // A network scan is partial evidence: it can add, never take away.
  const scan = planEndpointUpsert(
    [kept, gone],
    [{ name: "Nuova rete", ip: "10.0.0.9", port: 9100, source: "net" }],
    options({ deactivatesMissing: false }),
  );
  assert.deepEqual(scan.deactivateIds, []);
});

test("the same physical printer seen by two bridges stays one endpoint", () => {
  const existing = row({ lastSeenAt: new Date(NOW.getTime() - 10 * MINUTE) });
  const plan = planEndpointUpsert(
    [existing],
    [{ name: "Nome da un altro bridge", ip: "192.168.1.40", port: 9100, source: "net" }],
    options({ bridgeId: "br_2" }),
  );

  assert.equal(plan.upserts[0].existingId, existing.id, "matched by ip:port, not by bridge");
  assert.equal(plan.upserts[0].refreshLastSeen, true, "identity (label) changed → refresh");
});

test("a report that omits vendor/mac keeps what is already known", () => {
  const existing = row({
    vendor: "Epson",
    mac: "aa:bb:cc:dd:ee:ff",
    lastSeenAt: new Date(NOW.getTime() - 10 * MINUTE),
  });
  const plan = planEndpointUpsert(
    [existing],
    [{ name: "EPSON TM-T20", ip: "192.168.1.40", port: 9100, source: "net" }],
    options(),
  );

  assert.equal(plan.upserts[0].vendor, "Epson");
  assert.equal(plan.upserts[0].mac, "aa:bb:cc:dd:ee:ff");
  assert.equal(
    plan.upserts[0].refreshLastSeen,
    true,
    "still refreshed: the sighting itself is stale",
  );
});

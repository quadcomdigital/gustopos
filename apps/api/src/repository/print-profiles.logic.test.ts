import { test } from "node:test";
import assert from "node:assert/strict";
import type { PrintBridge, PrintProfileBridge } from "@gustopos/shared";
import {
  findClaimedAreaOverlaps,
  matchProfileBridge,
  normalizeProfileBridges,
  planClaimedAreas,
  planMappings,
  profileConflicts,
  snapshotBridges,
} from "./print-profiles.logic";

function makeBridge(overrides: Partial<PrintBridge> & { id: string }): PrintBridge {
  return {
    tenantId: "tenant_franks",
    name: overrides.id,
    status: "active",
    areas: [],
    printers: [],
    mappings: [],
    claimedAreas: [],
    ...overrides,
  };
}

test("snapshotBridges captures the whole pool and keeps the stable instance id", () => {
  const bridges = [
    makeBridge({
      id: "br_cassa",
      instanceId: "inst_cassa",
      name: "PC Cassa",
      claimedAreas: ["st_kitchen"],
      mappings: [{ area: "st_kitchen", name: "EPSON TM-T88V" }],
    }),
    makeBridge({ id: "br_bar", name: "PC Bar" }),
  ];

  const snapshot = snapshotBridges(bridges);

  assert.equal(snapshot.length, 2);
  assert.deepEqual(snapshot[0], {
    bridgeId: "br_cassa",
    instanceId: "inst_cassa",
    label: "PC Cassa",
    mappings: [{ area: "st_kitchen", name: "EPSON TM-T88V" }],
    claimedAreas: ["st_kitchen"],
  });
});

test("snapshotBridges narrows to the requested bridge ids", () => {
  const bridges = [makeBridge({ id: "a" }), makeBridge({ id: "b" })];
  assert.deepEqual(
    snapshotBridges(bridges, ["b"]).map((entry) => entry.bridgeId),
    ["b"],
  );
  // Empty selection means "whole pool", never "nothing".
  assert.equal(snapshotBridges(bridges, []).length, 2);
  assert.equal(snapshotBridges(bridges, ["missing"]).length, 0);
});

test("snapshotBridges drops legacy enum keys and nameless mapping targets", () => {
  const snapshot = snapshotBridges([
    makeBridge({
      id: "br_legacy",
      claimedAreas: ["st_bar", "kitchen", "", "  "],
      mappings: [
        { area: "st_bar", name: "Star TSP100" },
        { area: "bar", name: "Should not survive" },
        { area: "st_bar", name: "" },
      ],
    }),
  ]);

  assert.deepEqual(snapshot[0].claimedAreas, ["st_bar"]);
  assert.deepEqual(snapshot[0].mappings, [{ area: "st_bar", name: "Star TSP100" }]);
});

test("matchProfileBridge prefers the stable instance identity over the bridge id", () => {
  const bridges = [
    makeBridge({ id: "br_old_id", instanceId: "inst_1", name: "Ripairato" }),
    makeBridge({ id: "br_new_id", instanceId: "inst_2" }),
  ];
  const entry: PrintProfileBridge = { bridgeId: "br_gone", instanceId: "inst_1", mappings: [], claimedAreas: [] };

  assert.equal(matchProfileBridge(entry, bridges)?.id, "br_old_id");
  assert.equal(
    matchProfileBridge({ bridgeId: "br_new_id", instanceId: "stale_instance" }, bridges)?.id,
    "br_new_id",
  );
  assert.equal(matchProfileBridge({ bridgeId: "br_gone" }, bridges), null);
  assert.equal(matchProfileBridge(entry, []), null);
});

test("planClaimedAreas separates active stations from stations deleted or deactivated", () => {
  const active = new Set(["st_kitchen", "st_bar"]);
  const plan = planClaimedAreas(["st_kitchen", "st_gone", "kitchen", ""], active);

  assert.deepEqual(plan.areas, ["st_kitchen"]);
  // Legacy keys are not reported: they were never valid routing keys.
  assert.deepEqual(plan.dropped, ["st_gone"]);
});

test("planMappings keeps only targets the bridge will actually claim", () => {
  const mappings = [
    { area: "st_kitchen", name: "EPSON" },
    { area: "st_bar", name: "Star", ip: "192.168.1.50", port: 9100 },
    { area: "st_gone", name: "Orphan" },
    { area: "cashier", name: "Legacy" },
  ];

  assert.deepEqual(planMappings(mappings, ["st_kitchen"]), [
    { area: "st_kitchen", name: "EPSON" },
  ]);
  assert.deepEqual(planMappings(mappings, ["st_bar"]), [
    { area: "st_bar", name: "Star", ip: "192.168.1.50", port: 9100 },
  ]);
  assert.deepEqual(planMappings(mappings, []), []);
});

test("findClaimedAreaOverlaps flags a station claimed by more than one bridge", () => {
  const overlaps = findClaimedAreaOverlaps([
    { id: "br_a", claimedAreas: ["st_kitchen", "st_bar"] },
    { id: "br_b", claimedAreas: ["st_kitchen"] },
    { id: "br_c", claimedAreas: ["st_bar", "st_bar"] },
    { id: "br_d", claimedAreas: [] },
  ]);

  assert.deepEqual(overlaps, [
    { stationId: "st_kitchen", bridgeIds: ["br_a", "br_b"] },
    { stationId: "st_bar", bridgeIds: ["br_a", "br_c"] },
  ]);
});

test("findClaimedAreaOverlaps ignores a station repeated inside the same bridge", () => {
  const overlaps = findClaimedAreaOverlaps([
    { id: "br_a", claimedAreas: ["st_bar", "st_bar"] },
    { id: "br_b", claimedAreas: ["st_kitchen"] },
  ]);

  assert.deepEqual(overlaps, []);
});

test("findClaimedAreaOverlaps ignores legacy keys so old rows cannot warn", () => {
  const overlaps = findClaimedAreaOverlaps([
    { id: "br_a", claimedAreas: ["kitchen"] },
    { id: "br_b", claimedAreas: ["kitchen"] },
  ]);

  assert.deepEqual(overlaps, []);
});

// ─── Editing a saved configuration (draft → PATCH) ────────────────────────

test("normalizeProfileBridges refreshes identity from the live bridge", () => {
  const entry: PrintProfileBridge = {
    bridgeId: "br_old",
    instanceId: "inst_1",
    label: "Nome vecchio",
    claimedAreas: ["st_kitchen"],
    mappings: [{ area: "st_kitchen", name: "EPSON" }],
  };
  const live = makeBridge({
    id: "br_new",
    instanceId: "inst_1",
    name: "Nome nuovo",
    host: "POS-1",
  });

  const [normalized] = normalizeProfileBridges([entry], [live]);

  assert.equal(normalized.bridgeId, "br_new");
  assert.equal(normalized.instanceId, "inst_1");
  assert.equal(normalized.label, "Nome nuovo");
  assert.deepEqual(normalized.claimedAreas, ["st_kitchen"]);
});

test("normalizeProfileBridges keeps entries of bridges that left the pool", () => {
  // A saved configuration must stay editable whenever we want: a bridge that
  // is gone is reported at activation, never rejected on save.
  const entry: PrintProfileBridge = {
    bridgeId: "br_gone",
    instanceId: "inst_gone",
    label: "PC Cucina",
    claimedAreas: ["st_kitchen"],
    mappings: [],
  };

  const [normalized] = normalizeProfileBridges([entry], []);

  assert.equal(normalized.bridgeId, "br_gone");
  assert.equal(normalized.label, "PC Cucina");
  assert.equal(normalized.instanceId, "inst_gone");
});

test("normalizeProfileBridges keeps unknown station ids but drops legacy keys and unreachable targets", () => {
  const entry: PrintProfileBridge = {
    bridgeId: "br_a",
    claimedAreas: ["st_kitchen", "st_deleted", "kitchen", "st_kitchen"],
    mappings: [
      { area: "st_kitchen", name: "EPSON" },
      { area: "st_bar", name: "Orphan (station not claimed)" },
      { area: "cashier", name: "Legacy" },
      { area: "st_deleted", name: "Kept for later" },
    ],
  };

  const [normalized] = normalizeProfileBridges([entry], []);

  assert.deepEqual(normalized.claimedAreas, ["st_kitchen", "st_deleted"]);
  assert.deepEqual(normalized.mappings, [
    { area: "st_kitchen", name: "EPSON" },
    { area: "st_deleted", name: "Kept for later" },
  ]);
});

test("normalizeProfileBridges collapses two entries of the same machine", () => {
  const entries: PrintProfileBridge[] = [
    { bridgeId: "br_a", instanceId: "inst_1", claimedAreas: ["st_kitchen"], mappings: [] },
    { bridgeId: "br_other", instanceId: "inst_1", claimedAreas: ["st_bar"], mappings: [] },
  ];

  const normalized = normalizeProfileBridges(entries, []);

  assert.equal(normalized.length, 1);
  assert.deepEqual(normalized[0].claimedAreas, ["st_kitchen"]);
});

test("normalizeProfileBridges is a no-op on a well-formed draft", () => {
  const entry: PrintProfileBridge = {
    bridgeId: "br_a",
    instanceId: "inst_1",
    label: "PC Cassa",
    claimedAreas: ["st_cassa"],
    mappings: [{ area: "st_cassa", name: "192.168.1.115:9100", ip: "192.168.1.115", port: 9100 }],
  };

  assert.deepEqual(normalizeProfileBridges([entry], []), [entry]);
});

test("profileConflicts flags a station claimed twice inside a configuration", () => {
  const conflicts = profileConflicts([
    { bridgeId: "br_a", claimedAreas: ["st_kitchen", "st_bar"] },
    { bridgeId: "br_b", claimedAreas: ["st_bar"] },
  ]);

  assert.deepEqual(conflicts, [{ stationId: "st_bar", bridgeIds: ["br_a", "br_b"] }]);
});

test("profileConflicts ignores the same machine listed twice", () => {
  const conflicts = profileConflicts([
    { bridgeId: "br_a", claimedAreas: ["st_bar"] },
    { bridgeId: "br_a", claimedAreas: ["st_bar"] },
  ]);

  assert.deepEqual(conflicts, []);
});

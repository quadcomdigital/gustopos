import { db, pool } from "../src/db/client";
import { printJobs } from "../src/db/schema";
import { buildCalibrationTicketPayload, buildStationFormatTestPayload } from "../src/repository/utils/escpos-builder";

/**
 * One-shot calibration print.
 *
 * Enqueues a single `pending` print_jobs row for a given tenant/bridge/area;
 * the bridge claims it on its next poll and prints the calibration ticket that
 * shows every ESC/POS character size.
 *
 * Usage:
 *   npx tsx apps/api/scripts/calibration-print.ts \
 *     --tenant=ten_... --area=st_... --bridge=bridge_...
 *
 * Defaults target the Franks "Bar" station.
 */
const DEFAULTS = {
  tenant: process.env.CALIBRATION_TENANT_ID ?? "ten_26ed333e-9dbd-43f7-85b1-fe57054e9e6f",
  area: process.env.CALIBRATION_AREA ?? "st_9530584fda0d07b8d6bb",
  bridge: process.env.CALIBRATION_BRIDGE_ID ?? "bridge_auto_d3cb48",
};

function arg(name: string, fallback: string): string {
  const prefix = `--${name}=`;
  const hit = process.argv.find((value) => value.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : fallback;
}

async function main() {
  const tenantId = arg("tenant", DEFAULTS.tenant);
  const area = arg("area", DEFAULTS.area);
  const bridgeId = arg("bridge", DEFAULTS.bridge);
  const payloadKind = arg("payload", "calibration");

  const now = new Date();
  const stamp = now.getTime().toString(36);
  const jobId = `pj_cal_${stamp}_${Math.random().toString(36).slice(2, 6)}`;

  const payload = payloadKind === "format-test"
    ? buildStationFormatTestPayload()
    : buildCalibrationTicketPayload();

  await db.insert(printJobs).values({
    id: jobId,
    tenantId,
    orderId: `CAL_${stamp}`,
    area,
    bridgeId,
    protocol: "escpos",
    status: "pending",
    payload,
    error: null,
    createdAt: now,
    updatedAt: now,
    dispatchedAt: null,
  });

  console.log(`Print enqueued (${payloadKind}): ${jobId}`);
  console.log(`tenant=${tenantId} area=${area} bridge=${bridgeId}`);
  console.log("The bridge claims it on its next poll and prints it.");
  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

import { config as loadEnv } from "dotenv";
import path from "node:path";
import { Pool } from "pg";

/**
 * One-off "physical" ESC/POS reset for one station of one tenant.
 *
 * The VPS cannot reach the printer LAN, so the reset is delivered as a normal
 * `print_jobs` row: the Go agent claims it and writes the bytes to the mapped
 * printer over raw TCP (9100). The payload is:
 *
 *   DLE ENQ 2 (10 05 02) real-time error recovery: clears the receive and
 *                        print buffers (Epson: works even offline / on error)
 *   ESC @   (1B 40)  initialize: clears the print buffer and resets the modes
 *   CAN     (18)     cancels any pending data in page mode
 *   FS } ' 0 (1C 7D 60 00) optional: disable auto-cut (vendor-specific,
 *                        Pyramid/Phoenix; ignored by most Epson clones)
 *   ESC d n (1B 64 n) feed n lines, so the operator sees the printer react
 *   GS V A 0 (1D 56 41 00) optional full cut, only with --cut
 *
 * No status read is possible through the current agent (PrintRawTCP is
 * write-only), so a `completed` job means "bytes reached the printer socket",
 * not "the printer printed them". A `failed` job carries the TCP error.
 *
 * Usage:
 *   npx tsx apps/api/scripts/print-reset.ts --tenant=franks --area=Bar
 *   # dry-run (default) → shows tenant, station, bridge, printer and hex
 *
 *   npx tsx apps/api/scripts/print-reset.ts --tenant=franks --area=Bar --apply
 *   # enqueues, waits for the agent and reports the outcome
 *
 * Flags:
 *   --tenant=franks|ten_...   tenant slug or id (default: franks)
 *   --area=Bar|st_...         station name or id (default: Bar)
 *   --feed=N                  lines to feed after reset (default: 3, 0 = none)
 *   --text="..."              send a short test ticket with this text
 *   --cut                     add a full cut after the feed
 *   --no-autocut              send FS } ' 0 (disable auto-cut, vendor-specific)
 *   --no-recover              omit DLE ENQ 2 (buffer/error recovery)
 *   --timeout=45              seconds to wait for the agent (default: 45)
 *   --keep                    keep the synthetic print_jobs row
 *   --apply                   actually enqueue (default: dry-run)
 */

loadEnv({ path: path.resolve(__dirname, "../.env"), quiet: true });

function arg(name: string, fallback: string): string {
  const prefix = `--${name}=`;
  const hit = process.argv.find((value) => value.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : fallback;
}

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function intArg(name: string, fallback: number): number {
  const raw = arg(name, "");
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`--${name} deve essere un intero >= 0`);
  }
  return parsed;
}

/**
 * DATABASE_URL normally comes from the shell (like every other one-off
 * script). On this box it lives in ecosystem.config.cjs, so fall back to the
 * PM2 API env instead of forcing the operator to paste a connection string.
 */
function databaseUrl(): string {
  const fromEnv = process.env.DATABASE_URL?.trim();
  if (fromEnv) return fromEnv;

  const ecosystem = path.resolve(__dirname, "../../..", "ecosystem.config.cjs");
  try {
    const config = require(ecosystem);
    const api = (config.apps ?? []).find((app: { name?: string }) => app.name === "gustopos-api");
    const url = api?.env?.DATABASE_URL;
    if (typeof url === "string" && url.trim()) {
      console.log("[print-reset] DATABASE_URL letta da ecosystem.config.cjs");
      return url.trim();
    }
  } catch {
    // ignore: the explicit error below is clearer
  }

  throw new Error("DATABASE_URL non impostata: esportala o mettila in apps/api/.env");
}

function buildResetPayload(feedLines: number, cut: boolean, noAutocut: boolean, recover: boolean): Buffer {
  const parts: Buffer[] = [];
  if (recover) {
    parts.push(Buffer.from([0x10, 0x05, 0x02])); // DLE ENQ 2 — clear receive + print buffers
  }
  parts.push(
    Buffer.from([0x1b, 0x40]), // ESC @
    Buffer.from([0x18]), // CAN
  );
  if (noAutocut) {
    parts.push(Buffer.from([0x1c, 0x7d, 0x60, 0x00])); // FS } ' 0
  }
  if (feedLines > 0) {
    parts.push(Buffer.from([0x1b, 0x64, Math.min(feedLines, 255)])); // ESC d n
  }
  if (cut) {
    parts.push(Buffer.from([0x1d, 0x56, 0x41, 0x00])); // GS V A 0
  }
  return Buffer.concat(parts);
}

/**
 * Short visible test ticket. ASCII only, so it prints on every code page:
 * ESC @ + optional autocut OFF + center + double size + text + feed (+ cut).
 */
function buildTestPayload(text: string, feedLines: number, cut: boolean, noAutocut: boolean, recover: boolean): Buffer {
  const parts: Buffer[] = [];
  if (recover) {
    parts.push(Buffer.from([0x10, 0x05, 0x02])); // DLE ENQ 2
  }
  parts.push(
    Buffer.from([0x1b, 0x40]), // ESC @
    Buffer.from([0x1b, 0x61, 0x01]), // ESC a 1 — center
    Buffer.from([0x1d, 0x21, 0x11]), // GS ! 0x11 — double width/height
    Buffer.from(`${text}\n`, "latin1"),
    Buffer.from([0x1d, 0x21, 0x00]), // GS ! 0x00 — normal
    Buffer.from(`${new Date().toISOString()}\n`, "latin1"),
    Buffer.from("Se leggi questo, la stampante riceve e stampa.\n", "latin1"),
    Buffer.from([0x1b, 0x61, 0x00]), // ESC a 0 — left
  );
  if (noAutocut) {
    parts.push(Buffer.from([0x1c, 0x7d, 0x60, 0x00])); // FS } ' 0
  }
  if (feedLines > 0) {
    parts.push(Buffer.from([0x1b, 0x64, Math.min(feedLines, 255)])); // ESC d n
  }
  if (cut) {
    parts.push(Buffer.from([0x1d, 0x56, 0x41, 0x00])); // GS V A 0
  }
  return Buffer.concat(parts);
}

function hex(buffer: Buffer): string {
  return buffer.toString("hex").replace(/(..)/g, "$1 ").trim();
}

function normalizeArea(value: string): string {
  return value.trim().replace(/[^a-z0-9_-]/gi, "_");
}

type StationRow = { id: string; name: string; kind: string; is_active: number };
type BridgeRow = {
  id: string;
  name: string;
  version: string | null;
  claimed_areas: string;
  mappings: string;
  last_heartbeat_at: Date;
};
type MappingRow = { area?: string | null; name?: string; ip?: string | null; port?: number | null };

function parseJsonArray<T>(raw: string): T[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

async function resolveTenant(pool: Pool, ref: string): Promise<{ id: string; slug: string }> {
  const { rows } = await pool.query<{ id: string; slug: string }>(
    "select id, slug from tenants where slug = $1 or id = $1 limit 1",
    [ref],
  );
  if (rows.length === 0) {
    throw new Error(`tenant "${ref}" non trovato`);
  }
  return rows[0];
}

async function main(): Promise<void> {
  const tenantRef = arg("tenant", "franks");
  const areaRef = arg("area", "Bar");
  const feedLines = intArg("feed", 3);
  const timeoutSeconds = intArg("timeout", 45);
  const cut = flag("cut");
  const noAutocut = flag("no-autocut");
  const recover = !flag("no-recover");
  const apply = flag("apply");
  const keep = flag("keep");

  const pool = new Pool({ connectionString: databaseUrl() });

  try {
    const tenant = await resolveTenant(pool, tenantRef);

    const client = await pool.connect();
    try {
      await client.query("select set_config('app.current_tenant_id', $1, false)", [tenant.id]);

      const stations = await client.query<StationRow>(
        "select id, name, kind, is_active from print_stations where tenant_id = $1 order by is_default desc, sort_order, name",
        [tenant.id],
      );

      const wanted = areaRef.trim().toLowerCase();
      const station =
        stations.rows.find((row) => row.id === areaRef) ??
        stations.rows.find((row) => row.name.trim().toLowerCase() === wanted) ??
        null;

      const areaIds = new Set<string>();
      if (station) {
        areaIds.add(station.id);
        areaIds.add(normalizeArea(station.name));
      } else {
        areaIds.add(areaRef);
      }

      const bridges = await client.query<BridgeRow>(
        "select id, name, version, claimed_areas, mappings, last_heartbeat_at from print_bridges where tenant_id = $1 order by last_heartbeat_at desc",
        [tenant.id],
      );

      const candidates = bridges.rows
        .map((row) => ({ row, claimed: parseJsonArray<string>(row.claimed_areas) }))
        .filter(({ claimed }) => [...areaIds].some((area) => claimed.includes(area)))
        .filter(({ row }) => (row.version ?? "").startsWith("go-"));

      if (candidates.length === 0) {
        throw new Error(
          `nessun bridge Go ha "${station?.name ?? areaRef}" (${[...areaIds].join(", ")}) tra le aree reclamate. ` +
            "Controlla Settings → Stampa → Aree del bridge.",
        );
      }

      const { row: bridge, claimed } = candidates[0];
      const mapping = parseJsonArray<MappingRow>(bridge.mappings).find(
        (entry) => typeof entry.area === "string" && areaIds.has(entry.area),
      );
      if (!mapping?.ip) {
        throw new Error(
          `il bridge ${bridge.id} non ha un mapping IP per "${station?.name ?? areaRef}". ` +
            "È lo stesso errore che finisce in print_jobs.error: \"no printer mapping configured\".",
        );
      }

      const heartbeatAgeMs = Date.now() - new Date(bridge.last_heartbeat_at).getTime();
      const heartbeatFresh = heartbeatAgeMs < 5 * 60 * 1000;
      const text = arg("text", "").trim();
      const isTest = text.length > 0;
      const payload = isTest
        ? buildTestPayload(text, feedLines, cut, noAutocut, recover)
        : buildResetPayload(feedLines, cut, noAutocut, recover);
      const jobId = `pj_${isTest ? "test" : "reset"}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

      console.log("");
      console.log(`Tenant : ${tenant.slug} (${tenant.id})`);
      console.log(`Area   : ${station ? `${station.name} (${station.id})` : areaRef}`);
      console.log(`Bridge : ${bridge.id} (${bridge.version ?? "?"}) — heartbeat ${Math.round(heartbeatAgeMs / 1000)}s fa`);
      console.log(`Printer: ${mapping.name ?? `${mapping.ip}:${mapping.port ?? 9100}`} (${mapping.ip}:${mapping.port ?? 9100})`);
      console.log(`Payload: ${payload.length} byte — ${hex(payload)}`);
      console.log(
        "         " +
          (recover ? "DLE ENQ 2 + " : "") +
          (isTest ? `test ticket "${text}" + ` : "") +
          "ESC @ (init)" +
          (isTest ? "" : " + CAN") +
          (noAutocut ? " + autocut OFF" : "") +
          (feedLines > 0 ? ` + feed ${feedLines}` : " + no feed") +
          (cut ? " + cut" : ""),
      );
      if (!heartbeatFresh) {
        console.log("ATTENZIONE: il bridge non manda heartbeat da >5 minuti; il job resterà in coda finché non torna online.");
      }

      if (!apply) {
        console.log("");
        console.log("Dry-run: nessun byte inviato. Aggiungi --apply per eseguire.");
        return;
      }

      await client.query(
        `insert into print_jobs
           (id, tenant_id, order_id, area, protocol, status, payload, error, bridge_id,
            claimed_by_instance_id, claimed_at, created_at, updated_at, dispatched_at)
         values ($1, $2, $3, $4, 'escpos', 'pending', $5, null, $6, null, null, now(), now(), null)`,
        [jobId, tenant.id, `RESET_${Date.now().toString(36)}`, station?.id ?? areaRef, payload.toString("base64"), bridge.id],
      );
      console.log("");
      console.log(`Job accodato: ${jobId}`);
      console.log(`In attesa del bridge (max ${timeoutSeconds}s)...`);

      const deadline = Date.now() + timeoutSeconds * 1000;
      let status = "pending";
      let error: string | null = null;
      while (Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const result = await client.query<{ status: string; error: string | null }>(
          "select status, error from print_jobs where tenant_id = $1 and id = $2",
          [tenant.id, jobId],
        );
        if (result.rows.length === 0) {
          throw new Error("il job è sparito dal database");
        }
        status = result.rows[0].status;
        error = result.rows[0].error;
        if (status === "completed" || status === "failed") break;
      }

      console.log("");
      if (status === "completed") {
        console.log(`OK: ${payload.length} byte scritti su ${mapping.ip}:${mapping.port ?? 9100} (job completed).`);
        console.log("Nota: il TCP non ha un ACK della stampante; se non esce carta controlla coperchio/carta/errore sul dispositivo.");
      } else if (status === "failed") {
        console.log(`ERRORE: il bridge non è riuscito a scrivere sulla stampante: ${error ?? "errore sconosciuto"}`);
      } else {
        console.log(`IN CODA: job ancora "${status}" dopo ${timeoutSeconds}s.`);
        console.log("Controlla che l'agente sia online (heartbeat) e che l'area sia tra le claimed areas.");
      }

      if (!keep && (status === "completed" || status === "failed")) {
        await client.query("delete from print_jobs where tenant_id = $1 and id = $2", [tenant.id, jobId]);
      }
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("");
  console.error(`[print-reset] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});

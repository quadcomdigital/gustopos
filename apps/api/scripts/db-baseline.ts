/**
 * db-baseline — marca TUTTE le migrazioni di `meta/_journal.json` come già
 * applicate su un database appena creato.
 *
 * ─── Perché serve ────────────────────────────────────────────────────────
 * La catena di migrazioni NON è riproducibile su un database vuoto:
 * `drizzle-kit migrate` fallisce subito (0 righe applicate) perché
 * `0029_brainy_johnny_blaze` ricostruisce lo schema che `0008_vivid_console`
 * ha già creato, e altre 5 migrazioni emettono errori (0031, 0033, 0046,
 * 0049, 0079_late_thunderbolts). Toccare quelle migrazioni NON è un'opzione:
 * ne cambierebbe l'hash e il database di produzione, che le ha già applicate,
 * rifiuterebbe la catena ("migrations hash mismatch").
 *
 * ─── Percorso corretto per un ambiente nuovo ─────────────────────────────
 *   npm run db:provision        # = drizzle-kit push && tsx scripts/db-baseline.ts
 *
 *   1. `drizzle-kit push` crea lo schema da `src/db/schema.ts` (verificato:
 *      69 tabelle su database vuoto);
 *   2. questo script segna le 78 migrazioni del journal come applicate,
 *      così le migrazioni FUTURE vengono applicate normalmente da
 *      `npm run db:migrate`;
 *   3. `npm run db:migrate` diventa un no-op e va a rimanere pulito.
 *
 * ─── Database ESISTENTE (produzione/staging) ─────────────────────────────
 * Non usare questo script: lì lo schema è già stato costruito per altra via
 * e `npm run db:migrate` funziona come canale di aggiornamento.
 *
 * Usage:
 *   DATABASE_URL=postgresql://… npx tsx scripts/db-baseline.ts [--force]
 *
 *   --force  sovrascrive anche se il journal ha già righe (non farlo mai su
 *            un database di produzione).
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { Client } from "pg";

type JournalEntry = { idx: number; version: string; when: number; tag: string; breakpoints: boolean };

const FORCE = process.argv.includes("--force");
const DRIZZLE_DIR = path.join(__dirname, "..", "drizzle");
const JOURNAL_PATH = path.join(DRIZZLE_DIR, "meta", "_journal.json");

/** Stessa DDL che drizzle-kit crea su un database nuovo. */
const ENSURE_MIGRATIONS_TABLE = `
CREATE SCHEMA IF NOT EXISTS "drizzle";
CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
  "id" serial PRIMARY KEY,
  "hash" text NOT NULL,
  "created_at" bigint
);`;

function fail(message: string): never {
  console.error(`\n[db-baseline] ERRORE: ${message}\n`);
  process.exit(1);
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) fail("DATABASE_URL non impostata");

  const journal = JSON.parse(fs.readFileSync(JOURNAL_PATH, "utf8")) as { entries: JournalEntry[] };
  if (!Array.isArray(journal.entries) || journal.entries.length === 0) fail("journal vuoto");

  // Hash = sha256 dei bytes del file, esattamente come calcola drizzle-kit
  // (verificato contro le righe già presenti su produzione).
  const migrations = journal.entries.map((entry) => {
    const file = path.join(DRIZZLE_DIR, `${entry.tag}.sql`);
    if (!fs.existsSync(file)) fail(`migrazione nel journal senza file: ${entry.tag}.sql`);
    return {
      tag: entry.tag,
      when: entry.when,
      hash: crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"),
    };
  });

  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query(ENSURE_MIGRATIONS_TABLE);

    const existing = Number((await client.query(`SELECT count(*)::int AS n FROM "drizzle"."__drizzle_migrations"`)).rows[0].n);
    if (existing > 0 && !FORCE) {
      fail(
        `il journal ha già ${existing} migrazioni registrate.\n` +
          "        Questo script va usato SOLO su un database appena creato (dopo `drizzle-kit push`).\n" +
          "        Su un database esistente non serve: usa `npm run db:migrate`.",
      );
    }

    // Lo schema deve già esistere: altrimenti le future `db:migrate`
    // tenterebbero di ricrearlo da zero e fallirebbero come su un DB pulito.
    const tables = Number(
      (await client.query(`SELECT count(*)::int AS n FROM pg_tables WHERE schemaname = 'public'`)).rows[0].n,
    );
    if (tables === 0) {
      fail("nessuna tabella nello schema public: esegui prima `npm run db:provision` (drizzle-kit push).");
    }

    await client.query("BEGIN");
    try {
      if (existing > 0 && FORCE) {
        await client.query(`DELETE FROM "drizzle"."__drizzle_migrations"`);
      }
      for (const migration of migrations) {
        await client.query(
          `INSERT INTO "drizzle"."__drizzle_migrations" ("hash", "created_at") VALUES ($1, $2)`,
          [migration.hash, migration.when],
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }

    const total = Number((await client.query(`SELECT count(*)::int AS n FROM "drizzle"."__drizzle_migrations"`)).rows[0].n);
    console.log(`[db-baseline] segnate ${migrations.length} migrazioni (totale righe: ${total}).`);
    console.log(`[db-baseline] schema public: ${tables} tabelle.`);
    console.log("[db-baseline] da qui in avanti gli aggiornamenti usano `npm run db:migrate`.");
  } finally {
    await client.end();
  }
}

main().catch((error) => fail(String(error?.stack ?? error)));

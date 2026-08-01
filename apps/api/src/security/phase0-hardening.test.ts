import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const controllerSource = readFileSync(join(__dirname, "..", "app.controller.ts"), "utf8");
const gatewaySource = readFileSync(join(__dirname, "..", "realtime.gateway.ts"), "utf8");
const dbClientSource = readFileSync(join(__dirname, "..", "db", "client.ts"), "utf8");
const migrationSource = readFileSync(join(__dirname, "..", "..", "drizzle", "0058_phase0_rls_fail_closed.sql"), "utf8");
const journalSource = readFileSync(join(__dirname, "..", "..", "drizzle", "meta", "_journal.json"), "utf8");
const idempotencySource = readFileSync(join(__dirname, "..", "tenant", "idempotency.middleware.ts"), "utf8");
const paymentsSource = readFileSync(join(__dirname, "..", "repository", "payments.repository.ts"), "utf8");
const inventorySource = readFileSync(join(__dirname, "..", "repository", "inventory.repository.ts"), "utf8");
const fiscalSource = readFileSync(join(__dirname, "..", "repository", "fiscal.repository.ts"), "utf8");
const fiscalMigrationSource = readFileSync(join(__dirname, "..", "..", "drizzle", "0059_crazy_masked_marvel.sql"), "utf8");
const fiscalUniqueIndexMigrationSource = readFileSync(join(__dirname, "..", "..", "drizzle", "0046_add_unique_indexes.sql"), "utf8");

function sectionBetween(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  assert.notEqual(startIndex, -1, `missing section: ${start}`);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(endIndex, -1, `missing section terminator: ${end}`);
  return source.slice(startIndex, endIndex);
}

test("legacy print completion is no longer public and requires print dispatch permission", () => {
  const section = sectionBetween(
    controllerSource,
    '  @Post("print-jobs/:id/complete")',
    '  @Post("print-jobs/:id/retry")',
  );

  assert.doesNotMatch(section, /@Public\(\)/);
  assert.match(section, /@Roles\("admin", "chef"\)/);
  assert.match(section, /@RequiresPermissions\("printing:dispatch"\)/);
});

test("QZ signing route is authenticated and rejects arbitrary signing input", () => {
  const section = sectionBetween(
    controllerSource,
    '  @Get("sign")',
    "  // ─── Prep Items",
  );

  assert.doesNotMatch(section, /@Public\(\)/);
  assert.match(section, /@Throttle\(/);
  assert.match(section, /@RequiresModule\("printing"\)/);
  assert.match(section, /!\/\^\[a-f0-9\]\{64\}\$\//);
});

test("realtime rejects anonymous sockets and isolates public group-order sockets", () => {
  assert.match(gatewaySource, /next\(new Error\("Authentication required"\)\)/);
  assert.match(gatewaySource, /socket\.data\.isGroupOrder = true/);
  assert.match(gatewaySource, /socket\.data\.authenticated !== true/);
  assert.match(gatewaySource, /event\.startsWith\("groupOrder:"\)/);
  assert.match(gatewaySource, /Only group-order sockets may join group-order rooms/);
});

test("tenant-aware DB connections set and clear the RLS context", () => {
  assert.match(dbClientSource, /set_config\(\$1, \$2, false\)/);
  assert.match(dbClientSource, /set_config\(\$1, null, false\)/);
  assert.match(dbClientSource, /pool\.connect =/);
  assert.match(dbClientSource, /client\.release =/);
});

test("Phase 0 RLS migration is fail-closed and registered in Drizzle journal", () => {
  assert.match(migrationSource, /FORCE ROW LEVEL SECURITY/);
  assert.match(migrationSource, /NULLIF\(current_setting\(''app\.current_tenant_id'', true\), ''''\)/);
  assert.match(migrationSource, /WITH CHECK/);
  assert.match(journalSource, /"idx": 58/);
  assert.match(journalSource, /"tag": "0058_phase0_rls_fail_closed"/);
});

test("Phase 1 payment and stock mutations serialize shared rows", () => {
  const refundSection = sectionBetween(paymentsSource, "  async refundPayment(", "  }\n}");
  assert.match(refundSection, /\.for\("update"\)/);

  const adjustSection = sectionBetween(inventorySource, "  async adjustInventoryItem(", "  async listStockMovements");
  assert.match(adjustSection, /Number\.isFinite\(deltaQuantity\)/);
  assert.match(adjustSection, /\.for\("update"\)/);

  const prepSection = sectionBetween(inventorySource, "  async preparePrepItem(", "  async listUnitConversions");
  assert.match(prepSection, /Number\.isFinite\(quantity\)/);
  assert.match(prepSection, /quantity <= 0/);
  assert.match(prepSection, /\.for\("update"\)/);
});

test("idempotency middleware releases failed-request locks", () => {
  const responseSection = sectionBetween(idempotencySource, "      const releaseLock =", "      next();");
  assert.match(responseSection, /res\.statusCode < 500/);
  assert.match(responseSection, /this\.redis\.del\(lockKey\)/);
  assert.match(responseSection, /res\.once\("finish"/);
  assert.match(responseSection, /res\.once\("close"/);
});

test("fiscal exports require export permission and preserve content integrity", () => {
  const listSection = sectionBetween(controllerSource, '  @Get("fiscal/exports")', '  @Get("fiscal/exports/:id/download")');
  const downloadSection = sectionBetween(controllerSource, '  @Get("fiscal/exports/:id/download")', '  @Get("customers/:id")');

  assert.match(listSection, /@RequiresPermissions\("fiscal:export"\)/);
  assert.match(downloadSection, /@RequiresPermissions\("fiscal:export"\)/);
  assert.match(downloadSection, /getFiscalExportCsvById\(id\)/);
  assert.match(downloadSection, /X-Fiscal-Checksum/);
  assert.match(fiscalSource, /return withTenantTx\(async \(tx\) =>/);
  assert.match(fiscalSource, /createHash\("sha256"\)/);
  assert.match(fiscalSource, /checksum:\s*`sha256:/);
  assert.match(fiscalSource, /checksum:\s*row\.checksum/);
  assert.match(fiscalSource, /csvContent: csv/);
  assert.match(fiscalSource, /row\.csvContent !== null/);
  assert.match(fiscalMigrationSource, /CREATE TABLE(?: IF NOT EXISTS)? "fiscal_closures_archive"/);
  assert.match(fiscalMigrationSource, /DROP INDEX IF EXISTS "fiscal_closures_tenant_date_idx"/);
  assert.match(fiscalMigrationSource, /ROW_NUMBER\(\) OVER/);
  assert.match(fiscalMigrationSource, /closed_at.*DESC NULLS LAST/);
  assert.match(fiscalMigrationSource, /INSERT INTO "fiscal_closures_archive"/);
  assert.match(fiscalMigrationSource, /DELETE FROM "fiscal_closures"/);
  assert.match(fiscalMigrationSource, /CREATE UNIQUE INDEX IF NOT EXISTS/);
  assert.match(fiscalMigrationSource, /fiscal_closures_tenant_date_idx/);
  assert.match(fiscalMigrationSource, /fiscal_closures_tenant_business_date_idx/);
  assert.match(fiscalUniqueIndexMigrationSource, /CREATE TABLE IF NOT EXISTS "fiscal_closures_archive"/);
  assert.match(fiscalUniqueIndexMigrationSource, /DROP INDEX IF EXISTS "fiscal_closures_tenant_date_idx"/);
  assert.match(fiscalUniqueIndexMigrationSource, /ROW_NUMBER\(\) OVER/);
  assert.match(fiscalUniqueIndexMigrationSource, /CREATE UNIQUE INDEX IF NOT EXISTS "fiscal_closures_tenant_date_idx"/);
});

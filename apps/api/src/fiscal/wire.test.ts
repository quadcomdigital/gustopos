import { test } from "node:test";
import assert from "node:assert/strict";
import { encodePrintfFrame } from "./dialects/printf-frame";
import {
  buildWirePayload,
  decodeWireExchanges,
  exchangesAccepted,
  getFiscalDialect,
  parseCounters,
  parseDepartmentProgram,
  parseDepartmentPrograms,
  parseLastDocumentFromStatus,
  parseReceiptProgressive,
  summarizeJobResult,
} from "./dialects";

/**
 * Risposte reali della WALL-E MEC RT catturate il 15/10/2026
 * (`docs/15_evidenze_15-10-2026/prova.jsonl`, checksum ricalcolato 54/54).
 * Sono il riferimento dei test: se il decoder si allontana dal dispositivo,
 * questi valori lo dicono subito.
 */
const RX_OK = "060230313031304e4f4e303030303030303038343503"; // =C1 / =R1 / =T1 → ON00000000
const RX_REFUSED = "060230313031304e4553303032303030303038353003"; // =o senza chiave REG → ES00200000 (E20)
const RX_STATUS_BEFORE = "060230313031334e7330303030303152453030303038323203"; // <</?s → s000001RE0000
const RX_STATUS_AFTER = "060230313031334e7330303030303052453030303138323203"; // <</?s dopo =T1 → s000000RE0001
const RX_GRAND_TOTAL = "060230313031314e383334322e3431332c323838373603"; // <</?8 → 8342.413,28

const hex = (frame: Buffer) => frame.toString("hex").toUpperCase();

test("il payload wire porta i frame già composti, in base64", () => {
  const dialect = getFiscalDialect("rch-walle");
  const document = dialect.buildHealthCheck();
  const payload = buildWirePayload(dialect, document, { purpose: "health" });

  assert.equal(payload.purpose, "health");
  assert.equal(payload.wire.protocolId, "rch-walle");
  assert.equal(payload.wire.terminator, "etx");
  assert.equal(payload.wire.pacingMs, 500);
  assert.equal(payload.wire.frames.length, document.commands.length);
  document.commands.forEach((command, index) => {
    // I byte che l'agente scriverà sono esattamente il frame del motore.
    assert.equal(Buffer.from(payload.wire.frames[index].tx, "base64").toString("hex").toUpperCase(), command.frameHex);
    assert.equal(payload.wire.frames[index].label, command.label);
  });
  // Le label sono descrizioni operative: portano la lunghezza del frame, non i
  // codici di protocollo (l'agente non deve poterli ricostruire).
  for (const frame of payload.wire.frames) {
    assert.equal(/[=<@]/.test(frame.label), false, `label sospetta: ${frame.label}`);
  }
});

test("il protocollo testuale usa frame di testo terminati da LF", () => {
  const dialect = getFiscalDialect("rt-text");
  const payload = buildWirePayload(dialect, dialect.buildDailyClose(), { purpose: "daily-close" });
  assert.equal(payload.wire.terminator, "lf");
  assert.equal(payload.wire.pacingMs, 100);
  assert.equal(Buffer.from(payload.wire.frames[0].tx, "base64").toString("ascii"), "@F\n");
});

test("gli avvisi di composizione viaggiano con il job", () => {
  const dialect = getFiscalDialect("rch-walle");
  const document = { ...dialect.buildTestDocument(), warnings: ["comando non ancora verificato dal vivo"] };
  const payload = buildWirePayload(dialect, document, { purpose: "test" });
  assert.deepEqual(payload.warnings, ["comando non ancora verificato dal vivo"]);
});

test("decodifica le risposte PrintF reali: esito, errore e dati", () => {
  const dialect = getFiscalDialect("rch-walle");
  const [accepted] = decodeWireExchanges(dialect, { exchanges: [{ label: "chiave REG", rxHex: RX_OK }] });
  assert.equal(accepted.dati, "ON00000000");
  assert.equal(accepted.checksumOk, true);
  assert.equal(accepted.ackReceived, true);
  assert.equal(accepted.answerOk, true);
  assert.equal(accepted.errorCode, null);

  const [refused] = decodeWireExchanges(dialect, { exchanges: [{ label: "apertura gestionale", rxHex: RX_REFUSED }] });
  assert.equal(refused.answerOk, false);
  assert.equal(refused.errorCode, "E20");
  assert.equal(refused.errorMessage, "Sequenza errata");

  const [transportError] = decodeWireExchanges(dialect, {
    exchanges: [{ label: "vendita", rxHex: "", error: "RT non raggiungibile" }],
  });
  assert.equal(transportError.decodeError, "RT non raggiungibile");
});

test("una risposta non incorniciata conserva il testo grezzo e l'errore", () => {
  const dialect = getFiscalDialect("rch-walle");
  const text = "R01IVA 10 bene";
  const [exchange] = decodeWireExchanges(dialect, {
    exchanges: [{ label: "programmazione reparto 1", rxHex: hex(Buffer.from(text, "ascii")) }],
  });
  assert.equal(exchange.dati, text);
  assert.equal(exchange.checksumOk, false);
  assert.match(exchange.decodeError, /STX|ETX|short|checksum/i);
});

test("decodifica le letture del protocollo testuale senza checksum", () => {
  const dialect = getFiscalDialect("rt-text");
  const [exchange] = decodeWireExchanges(dialect, {
    exchanges: [{ label: "stato RT", rxHex: hex(Buffer.from("ON00000000\n", "ascii")) }],
  });
  assert.equal(exchange.dati, "ON00000000");
  assert.equal(exchange.checksumOk, true);
  assert.equal(exchange.answerOk, null);
});

test("un rifiuto del RT non viene mai scambiato per un successo", () => {
  const dialect = getFiscalDialect("rch-walle");
  const refused = decodeWireExchanges(dialect, { exchanges: [{ label: "apertura gestionale", rxHex: RX_REFUSED }] });
  const verdict = exchangesAccepted(refused);
  assert.equal(verdict.ok, false);
  assert.equal(verdict.failures.length, 1);
  assert.match(verdict.failures[0], /E20/);

  const good = decodeWireExchanges(dialect, { exchanges: [{ label: "chiave REG", rxHex: RX_OK }] });
  assert.deepEqual(exchangesAccepted(good), { ok: true, failures: [], notes: [] });

  const nack = decodeWireExchanges(dialect, { exchanges: [{ label: "vendita", rxHex: "15" }] });
  assert.match(exchangesAccepted(nack).failures[0], /NACK/);
});

test("una lettura illeggibile non boccia il documento emesso", () => {
  const dialect = getFiscalDialect("rch-walle");
  const exchanges = decodeWireExchanges(dialect, {
    exchanges: [
      { label: "pagamento cash", rxHex: RX_OK },
      { label: "stato RT (chiave + documento)", rxHex: "", error: "nessuna risposta entro il timeout" },
    ],
  });
  // Il frame documento decide l'esito; la lettura di stato resta informativa.
  const verdict = exchangesAccepted(exchanges, [true, false]);
  assert.equal(verdict.ok, true);
  assert.deepEqual(verdict.failures, []);
  assert.equal(verdict.notes.length, 1);
  assert.match(verdict.notes[0], /timeout/);
});

test("il progressivo si legge dallo stato del RT, non lo inventa l'agente", () => {
  assert.equal(parseLastDocumentFromStatus("s000000RE0001"), "0001");
  assert.equal(parseLastDocumentFromStatus("s000200SE0000"), "0000");
  assert.equal(parseLastDocumentFromStatus("N4"), null);
  assert.equal(parseLastDocumentFromStatus("8342.413,28"), null);

  const dialect = getFiscalDialect("rch-walle");
  const before = decodeWireExchanges(dialect, { exchanges: [{ label: "stato RT", rxHex: RX_STATUS_BEFORE }] });
  assert.equal(parseReceiptProgressive(before), "0000");
  const after = decodeWireExchanges(dialect, { exchanges: [{ label: "stato RT", rxHex: RX_STATUS_AFTER }] });
  assert.equal(parseReceiptProgressive(after), "0001");
  assert.equal(parseReceiptProgressive([]), null);
});

test("i contatori di quadratura si riconoscono dalla label", () => {
  const dialect = getFiscalDialect("rch-walle");
  const exchanges = decodeWireExchanges(dialect, {
    exchanges: [
      { label: "quadratura gran totale", rxHex: RX_GRAND_TOTAL },
      { label: "altro", rxHex: RX_OK },
    ],
  });
  assert.deepEqual(parseCounters(exchanges), { "gran totale": "8342.413,28" });
});

test("la lettura reparti è prudente: testo grezzo sempre, layout non confermato", () => {
  // Layout dal manuale: R + numero(2) + descrizione(20) + prezzo(10) + … +
  // aliquota + bene/servizio. Mai verificato dal vivo: il grezzo resta.
  const dati = "R01CAFFE              000000100        10 0";
  const parsed = parseDepartmentProgram(dati);
  assert.equal(parsed.department, 1);
  assert.equal(parsed.layoutVerified, false);
  assert.equal(parsed.raw, dati.trim());

  const dialect = getFiscalDialect("rch-walle");
  const exchanges = decodeWireExchanges(dialect, {
    exchanges: [{ label: "programmazione reparto 1", rxHex: RX_OK }],
  });
  // Il RT ha risposto con ON00000000: nessun "Rnn" nella risposta → il reparto
  // resta quello interrogato e il grezzo dice che non c'era programmazione.
  const reads = parseDepartmentPrograms(exchanges, true);
  assert.equal(reads.length, 1);
  assert.equal(reads[0].department, 1);
  assert.equal(reads[0].layoutVerified, true);
  assert.equal(reads[0].raw, "ON00000000");

  const unknown = parseDepartmentProgram("risposta non prevista");
  assert.equal(unknown.department, 1);
  assert.equal(unknown.raw, "risposta non prevista");
  assert.equal(parseDepartmentProgram(undefined).raw, "");
});

test("un frame di programmazione reparto generato dal server si decodifica", () => {
  // Risposta sintetica (nessuna unità ha mai eseguito `>R…`): serve a provare
  // che il decoder regge un eco della programmazione, non a dichiararla
  // verificata.
  const dialect = getFiscalDialect("rch-walle");
  const rxHex = hex(Buffer.concat([Buffer.from([0x06]), encodePrintfFrame("R01CAFFE              000000100        10 0", "8")]));
  const exchanges = decodeWireExchanges(dialect, { exchanges: [{ label: "programmazione reparto 1", rxHex }] });
  assert.equal(exchanges[0].checksumOk, true);
  const [read] = parseDepartmentPrograms(exchanges);
  assert.equal(read.department, 1);
  assert.equal(read.raw.startsWith("R01"), true);
});

test("il result del job aggrega esiti, contatori e reparti", () => {
  const dialect = getFiscalDialect("rch-walle");
  const exchanges = decodeWireExchanges(dialect, {
    exchanges: [
      { label: "stato RT", rxHex: RX_STATUS_AFTER },
      { label: "quadratura gran totale", rxHex: RX_GRAND_TOTAL },
    ],
  });
  const result = summarizeJobResult({
    exchanges,
    progressive: parseReceiptProgressive(exchanges),
    counters: parseCounters(exchanges),
    notes: ["progressive letto dal RT dopo la chiusura del documento"],
  });
  assert.equal(result.progressive, "0001");
  assert.equal(result.counters?.["gran totale"], "8342.413,28");
  assert.equal(result.exchanges?.length, 2);
  assert.equal(result.notes?.length, 1);
  assert.equal(typeof JSON.stringify(result), "string");
});

test("il protocollo storico non compone documenti fiscali né programmazioni", () => {
  const dialect = getFiscalDialect("rt-text");
  assert.equal(dialect.capabilities.managementDocument.status, "untested");
  assert.equal(dialect.framing.kind, "text-line");
  assert.throws(() => dialect.buildDepartmentPrograms([{ department: 1, priceCents: 0, vatRate: 22 }]), /programmazione reparti/);
  const serialized = JSON.stringify(dialect.toPublicOption());
  for (const code of ["@A", "@E", "@F", "@P", "=R", "<</?"]) {
    assert.equal(serialized.includes(code), false, `il catalogo non deve contenere "${code}"`);
  }
});

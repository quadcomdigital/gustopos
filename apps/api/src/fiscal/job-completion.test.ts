import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fiscalPrinterConfigSchema,
  fiscalWirePayloadSchema,
  type FiscalJobResult,
  type FiscalPrinterConfig,
  type FiscalWireResponse,
} from "@gustopos/shared";
import { buildWirePayload, getFiscalDialect } from "./dialects";
import { encodePrintfFrame, splitPrintfFrame } from "./dialects/printf-frame";
import { planReceiptJob } from "./emission";
import { decideFiscalCompletion } from "./job-completion";

function config(): FiscalPrinterConfig {
  return fiscalPrinterConfigSchema.parse({
    enabled: true,
    host: "192.168.0.120",
    port: 23,
    dialectId: "rch-walle",
    departmentMappings: [
      {
        protocolId: "rch-walle",
        departments: [
          { department: 1, label: "PIZZE", vatRate: 10, kind: "good", categoryIds: ["cat_pizza"], isDefault: true },
        ],
      },
    ],
  });
}

function receiptPlan() {
  return planReceiptJob(
    { config: config(), agentVersions: ["go-0.15.0"] },
    {
      kind: "receipt",
      paymentId: "pay_1",
      method: "cash",
      items: [{ name: "Margherita", quantity: 1, price: 7.5, categoryId: "cat_pizza" }],
    },
  );
}

/** Risposta del RT: <ACK> + pacchetto PrintF, come nelle evidenze reali. */
function frameHex(dati: string): string {
  return Buffer.concat([Buffer.from([0x06]), encodePrintfFrame(dati, "8")]).toString("hex").toUpperCase();
}

/**
 * Costruisce le risposte che il RT darebbe ai frame del job: `ON00000000` per i
 * comandi documento, il testo previsto per le letture. `overrides` permette di
 * simulare rifiuti e risposte illeggibili.
 */
function respond(payloadJson: string, overrides: Record<string, { rxHex?: string; error?: string }> = {}): FiscalWireResponse {
  const payload = fiscalWirePayloadSchema.parse(JSON.parse(payloadJson) as unknown);
  return {
    exchanges: payload.wire.frames.map((frame) => {
      const override = overrides[frame.label];
      if (override) {
        return { label: frame.label, rxHex: override.rxHex ?? "", ...(override.error ? { error: override.error } : {}) };
      }
      const command = splitPrintfFrame(Buffer.from(frame.tx, "base64")).dati;
      const dati = command === "<</?s" ? "s000000RE0001" : command === "<</?N" ? "N5" : "ON00000000";
      return { label: frame.label, rxHex: frameHex(dati) };
    }),
  };
}

function resultOf(resultJson: string): FiscalJobResult {
  return JSON.parse(resultJson) as FiscalJobResult;
}

const LABEL_STATUS = "stato RT (chiave + documento)";

test("il corrispettivo accettato è emesso con il progressivo letto dal RT", () => {
  const plan = receiptPlan();
  const response = respond(plan.payloadJson);
  const decision = decideFiscalCompletion({ jobType: "receipt", payloadJson: plan.payloadJson, response });

  assert.equal(decision.status, "completed");
  assert.equal(decision.error, null);
  assert.equal(decision.progressive, "0001");
  assert.equal(decision.exchanges.length, fiscalWirePayloadSchema.parse(JSON.parse(plan.payloadJson) as unknown).wire.frames.length);
  assert.equal(decision.exchanges.every((exchange) => exchange.checksumOk), true);
  const result = resultOf(decision.resultJson);
  assert.equal(result.progressive, "0001");
  assert.equal(result.notes, undefined);
});

test("il rifiuto del RT non chiude il job come emesso", () => {
  const plan = receiptPlan();
  const response = respond(plan.payloadJson, {
    "pagamento cash": { rxHex: frameHex("ES00200000") },
  });
  const decision = decideFiscalCompletion({ jobType: "receipt", payloadJson: plan.payloadJson, response });

  assert.equal(decision.status, "failed");
  assert.match(decision.error ?? "", /pagamento cash: E20 Sequenza errata/);
  // L'esito e le risposte restano nel result: servono alla diagnosi.
  const result = resultOf(decision.resultJson);
  assert.equal(result.exchanges?.some((exchange) => exchange.errorCode === "E20"), true);
});

test("una lettura di stato illeggibile non boccia un corrispettivo emesso", () => {
  const plan = receiptPlan();
  const response = respond(plan.payloadJson, {
    [LABEL_STATUS]: { error: "nessuna risposta entro il timeout" },
  });
  const decision = decideFiscalCompletion({ jobType: "receipt", payloadJson: plan.payloadJson, response });

  assert.equal(decision.status, "completed");
  assert.equal(decision.progressive, null);
  const result = resultOf(decision.resultJson);
  assert.equal(result.notes?.some((note) => note.includes("progressivo")), true);
  assert.equal(result.notes?.some((note) => note.includes("timeout")), true);
});

test("senza risposta del RT il job si chiude con l'avviso sul progressivo", () => {
  const plan = receiptPlan();
  const decision = decideFiscalCompletion({ jobType: "receipt", payloadJson: plan.payloadJson });
  assert.equal(decision.status, "completed");
  assert.equal(decision.progressive, null);
  assert.equal(resultOf(decision.resultJson).notes?.length, 1);
});

test("le quadrature si salvano nel result del job", () => {
  const dialect = getFiscalDialect("rch-walle");
  const payload = buildWirePayload(dialect, dialect.buildCounterReads(), { purpose: "counters" });
  const payloadJson = JSON.stringify(payload);
  const response: FiscalWireResponse = {
    exchanges: payload.wire.frames.map((frame) => {
      const command = splitPrintfFrame(Buffer.from(frame.tx, "base64")).dati;
      const dati = command === "<</?8" ? "8342.413,29" : command === "<</?1" ? "11" : "71289";
      return { label: frame.label, rxHex: frameHex(dati) };
    }),
  };
  const decision = decideFiscalCompletion({ jobType: "read", payloadJson, response });
  assert.equal(decision.status, "completed");
  assert.equal(decision.progressive, null);
  const result = resultOf(decision.resultJson);
  assert.deepEqual(result.counters, { "gran totale": "8342.413,29", corrispettivi: "11", "chiusure giornaliere": "71289" });
  // Le letture non sono <DATA_ANSW>: nessun esito documento da valutare.
  assert.equal(result.exchanges?.every((exchange) => exchange.answerOk === null), true);
});

test("la lettura reparti porta nel result reparto, grezzo e layout non confermato", () => {
  const dialect = getFiscalDialect("rch-walle");
  const readPlan = JSON.stringify(buildWirePayload(dialect, dialect.buildDepartmentReads([1, 4]), { purpose: "departments" }));
  const readFrames = fiscalWirePayloadSchema.parse(JSON.parse(readPlan) as unknown).wire.frames;
  const response: FiscalWireResponse = {
    exchanges: readFrames.map((frame, index) => ({
      label: frame.label,
      rxHex: frameHex(index === 0 ? "R01PIZZE               000001000        10 0" : "ON00000000"),
    })),
  };
  const decision = decideFiscalCompletion({ jobType: "read", payloadJson: readPlan, response });
  assert.equal(decision.status, "completed");
  const result = resultOf(decision.resultJson);
  assert.equal(result.departments?.length, 2);
  const first = result.departments?.[0];
  assert.equal(first?.department, 1);
  assert.equal(first?.layoutVerified, false);
  assert.equal(first?.raw.startsWith("R01"), true);
  // Il reparto 4 non ha risposto con una programmazione: resta quello interrogato.
  assert.equal(result.departments?.[1]?.department, 4);
  assert.equal(result.departments?.[1]?.raw, "ON00000000");
});

test("un payload senza frame (agente precedente) resta gestibile", () => {
  const legacyJson = JSON.stringify({ paymentId: "pay_9", items: [{ name: "x", quantity: 1, price: 1 }], method: "cash" });
  const decision = decideFiscalCompletion({
    jobType: "receipt",
    payloadJson: legacyJson,
    progressive: "0042",
  });
  assert.equal(decision.status, "completed");
  assert.equal(decision.progressive, "0042");
  assert.deepEqual(decision.exchanges, []);
  assert.equal(decision.error, null);
});

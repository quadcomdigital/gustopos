import { test } from "node:test";
import assert from "node:assert/strict";
import { fiscalPrinterConfigSchema, fiscalWirePayloadSchema, type FiscalPrinterConfig } from "@gustopos/shared";
import { splitPrintfFrame } from "./dialects/printf-frame";
import { FiscalDialectUnavailableError } from "./dialects/types";
import {
  FiscalEmissionError,
  departmentsToRead,
  normalizeDepartmentPrograms,
  planFiscalJob,
  planReceiptJob,
  type FiscalEmissionContext,
} from "./emission";

const CATEGORY_PIZZA = "cat_pizza";
const CATEGORY_BEVANDE = "cat_bevande";

function config(overrides: Record<string, unknown> = {}): FiscalPrinterConfig {
  return fiscalPrinterConfigSchema.parse({
    enabled: true,
    host: "192.168.0.120",
    port: 23,
    dialectId: "rch-walle",
    dialectModel: "walle-mec-rt",
    dialectVersion: "10.0.4",
    departmentMappings: [
      {
        protocolId: "rch-walle",
        departments: [
          { department: 1, label: "PIZZE", vatRate: 10, kind: "good", categoryIds: [CATEGORY_PIZZA], isDefault: false },
          { department: 4, label: "BEVANDE", vatRate: 22, kind: "good", categoryIds: [CATEGORY_BEVANDE], isDefault: true },
        ],
      },
    ],
    ...overrides,
  });
}

function context(overrides: Record<string, unknown> = {}, agents: Array<string | null> = ["go-0.15.0"]): FiscalEmissionContext {
  return { config: config(overrides), agentVersions: agents };
}

/**
 * I frame del payload, decodificati nei comandi che l'agente scrive: i byte del
 * pacchetto PrintF per i dialetti binari, la riga di testo per `rt-text`.
 */
function framesOf(payloadJson: string) {
  const payload = fiscalWirePayloadSchema.parse(JSON.parse(payloadJson) as unknown);
  return {
    payload,
    commands: payload.wire.frames.map((frame) => {
      const bytes = Buffer.from(frame.tx, "base64");
      if (bytes[0] === 0x02) return splitPrintfFrame(Buffer.from(frame.tx, "base64")).dati;
      return bytes.toString("ascii").replace(/\n$/, "");
    }),
  };
}

test("il corrispettivo si compone con reparto risolto dalla mappatura", () => {
  const plan = planReceiptJob(context(), {
    kind: "receipt",
    paymentId: "pay_1",
    method: "cash",
    businessDate: "2026-10-15",
    items: [
      { name: "Margherita", quantity: 2, price: 7.5, categoryId: CATEGORY_PIZZA },
      { name: "Acqua", quantity: 1, price: 2, categoryId: CATEGORY_BEVANDE },
    ],
  });

  assert.equal(plan.type, "receipt");
  assert.equal(plan.protocolId, "rch-walle");
  const { payload, commands } = framesOf(plan.payloadJson);
  assert.equal(payload.purpose, "receipt");
  assert.equal(payload.paymentId, "pay_1");
  assert.equal(payload.businessDate, "2026-10-15");

  // Chiave REG → vendita reparto 1 (10%) e reparto 4 (22%, ripiego) → subtotale → pagamento.
  assert.equal(commands[0], "=C1");
  assert.match(commands[1], /^=R1\/\$750\/\*2\/\(Margherita\)$/);
  assert.match(commands[2], /^=R4\/\$200\/\(Acqua\)$/);
  assert.equal(commands[3], "=S");
  assert.equal(commands[4], "=T1");
  // Dopo l'incasso il server legge il progressivo dal RT: è il RT a dirlo.
  assert.equal(commands[commands.length - 2], "<</?s");
  assert.equal(commands[commands.length - 1], "<</?N");
  // Il ripiego è usato solo per le categorie non mappate: qui "Acqua" è mappata.
  assert.deepEqual(plan.warnings.filter((warning) => warning.includes("ripiego")), []);
});

test("la categoria non mappata usa il ripiego con un avviso", () => {
  const plan = planReceiptJob(context(), {
    kind: "receipt",
    paymentId: "pay_2",
    method: "card",
    items: [{ name: "Dolce del giorno", quantity: 1, price: 5, categoryId: "cat_dolci" }],
  });
  const { commands } = framesOf(plan.payloadJson);
  assert.match(commands[1], /^=R4\//);
  assert.equal(plan.warnings.some((warning) => warning.includes("cat_dolci") && warning.includes("ripiego")), true);
  // Pagamento elettronico: il protocollo ha una voce sola per le forme elettroniche.
  assert.equal(commands[commands.length - 3], "=T4");
});

test("senza reparto (e senza ripiego) il corrispettivo non si compone", () => {
  assert.throws(
    () =>
      planReceiptJob(
        context({
          departmentMappings: [
            { protocolId: "rch-walle", departments: [{ department: 1, label: "PIZZE", vatRate: 10, kind: "good", categoryIds: [CATEGORY_PIZZA], isDefault: false }] },
          ],
        }),
        {
          kind: "receipt",
          paymentId: "pay_3",
          method: "cash",
          items: [{ name: "Dolce", quantity: 1, price: 5, categoryId: "cat_dolci" }],
        },
      ),
    (error: unknown) => {
      assert.equal(error instanceof FiscalEmissionError, true);
      const emissionError = error as FiscalEmissionError;
      assert.match(emissionError.message, /Emissione fiscale bloccata/);
      assert.deepEqual(emissionError.issues, ["cat_dolci"]);
      return true;
    },
  );

  // Anche una riga senza categoria è un blocco, quando non c'è un ripiego: non
  // si sceglie un reparto a caso (cambierebbe l'aliquota del corrispettivo).
  const noFallback = [
    { protocolId: "rch-walle", departments: [{ department: 1, label: "PIZZE", vatRate: 10, kind: "good", categoryIds: [CATEGORY_PIZZA], isDefault: false }] },
  ];
  assert.throws(
    () =>
      planReceiptJob(context({ departmentMappings: noFallback }), {
        kind: "receipt",
        paymentId: "pay_4",
        method: "cash",
        items: [{ name: "Prodotto senza categoria", quantity: 1, price: 5, categoryId: null }],
      }),
    (error: unknown) => (error as Error).message.includes("(riga senza categoria)"),
  );
  // Con un ripiego configurato la stessa riga passa, e l'avviso lo dice.
  const withFallback = planReceiptJob(context(), {
    kind: "receipt",
    paymentId: "pay_4b",
    method: "cash",
    items: [{ name: "Prodotto senza categoria", quantity: 1, price: 5, categoryId: null }],
  });
  assert.match(framesOf(withFallback.payloadJson).commands[1], /^=R4\//);
});

test("la mappatura vuota del protocollo ferma l'emissione", () => {
  assert.throws(
    () =>
      planReceiptJob(context({ departmentMappings: [] }), {
        kind: "receipt",
        paymentId: "pay_5",
        method: "cash",
        items: [{ name: "Margherita", quantity: 1, price: 7.5, categoryId: CATEGORY_PIZZA }],
      }),
    (error: unknown) => (error as Error).message.includes("mappatura reparti"),
  );
});

test("i gate (protocollo, RT, agente) diventano errori spiegabili", () => {
  const receipt = {
    kind: "receipt" as const,
    paymentId: "pay_6",
    method: "cash" as const,
    items: [{ name: "Margherita", quantity: 1, price: 7.5, categoryId: CATEGORY_PIZZA }],
  };

  assert.throws(
    () => planReceiptJob(context({ dialectId: null }), receipt),
    (error: unknown) => (error as Error).message.includes("Nessun protocollo fiscale selezionato"),
  );
  assert.throws(
    () => planReceiptJob(context({ host: "" }), receipt),
    (error: unknown) => (error as Error).message.includes("Nessun registratore di cassa configurato"),
  );
  assert.throws(
    () => planReceiptJob(context({}, ["go-0.14.0"]), receipt),
    (error: unknown) => (error as Error).message.includes("aggiorna l'agente"),
  );
  assert.throws(
    () => planReceiptJob(context({}, []), receipt),
    (error: unknown) => (error as Error).message.includes("Nessun agente di stampa registrato"),
  );
  // Un agente più recente del richiesto passa.
  assert.equal(planReceiptJob(context({}, ["go-0.16.0"]), receipt).type, "receipt");
});

test("un dialetto mai collaudato non emette corrispettivi (le prove restano possibili)", () => {
  // `print3rt` nasce dai manuali: `emissionGated` vero finché non c'è un
  // collaudo dal vivo su questa cassa.
  const gated = {
    dialectId: "print3rt",
    departmentMappings: [
      {
        protocolId: "print3rt",
        departments: [
          { department: 1, label: "PIZZE", vatRate: 10, kind: "good", categoryIds: [CATEGORY_PIZZA], isDefault: false },
        ],
      },
    ],
  };
  const receipt = {
    kind: "receipt" as const,
    paymentId: "pay_7",
    method: "cash" as const,
    items: [{ name: "Margherita", quantity: 1, price: 7.5, categoryId: CATEGORY_PIZZA }],
  };

  assert.throws(
    () => planReceiptJob(context(gated), receipt),
    (error: unknown) => {
      assert.equal(error instanceof FiscalEmissionError, true);
      assert.match((error as Error).message, /non è ancora stato collaudato/);
      return true;
    },
  );

  // Le prove non fiscali restano possibili: sono il percorso con cui si
  // collauda. Bloccarle renderebbe il collaudo impossibile.
  assert.equal(planFiscalJob(context(gated), { kind: "test" }).type, "test");
  assert.equal(planFiscalJob(context(gated), { kind: "departments", departments: [1] }).type, "read");

  // Il collaudo vale per il suo protocollo: quello registrato sull'altro
  // dialetto non sblocca questo.
  assert.throws(
    () =>
      planReceiptJob(
        context({
          ...gated,
          liveVerifications: [
            { protocolId: "rch-walle", verifiedAt: "2026-10-16T09:00:00.000Z", testJobId: "fj_altro" },
          ],
        }),
        receipt,
      ),
    (error: unknown) => (error as Error).message.includes("non è ancora stato collaudato"),
  );

  // Registrato il collaudo del protocollo attivo, il corrispettivo si compone.
  const verified = planReceiptJob(
    context({
      ...gated,
      liveVerifications: [
        {
          protocolId: "print3rt",
          verifiedAt: "2026-10-16T09:00:00.000Z",
          verifiedByStaffId: "staff_1",
          agentVersion: "go-0.15.0",
          testJobId: "fj_prova",
          counters: { "gran totale": "8342.413,29" },
        },
      ],
    }),
    receipt,
  );
  assert.equal(verified.type, "receipt");
  assert.equal(verified.protocolId, "print3rt");
  assert.equal(framesOf(verified.payloadJson).commands[0], "=C1");
});

test("collaudo e chiusura portano con sé la lettura dello stato", () => {
  const test = framesOf(planFiscalJob(context(), { kind: "test" }).payloadJson);
  assert.equal(test.payload.purpose, "test");
  assert.equal(test.commands[0], "=o");
  assert.equal(test.commands[1], '="/?A/(GUSTOPOS - PROVA DI COLLEGAMENTO)');
  // Il collaudo è un documento gestionale e si chiude con `=o`, non con un incasso.
  assert.equal(test.commands.includes("=T1"), false);

  const chiusura = planFiscalJob(context(), { kind: "daily-close", businessDate: "2026-10-15" });
  assert.equal(chiusura.type, "chiusura");
  const close = framesOf(chiusura.payloadJson);
  assert.deepEqual(close.commands, ["=C3", "=C10", "<</?s", "<</?N"]);
  assert.equal(close.payload.businessDate, "2026-10-15");
});

test("la lettura reparti interroga i reparti della mappatura (o quelli richiesti)", () => {
  const configWithMapping = config();
  assert.deepEqual(departmentsToRead(configWithMapping), [1, 4]);
  assert.deepEqual(departmentsToRead(configWithMapping, [7, 3, 7]), [3, 7]);

  const read = planFiscalJob(context(), { kind: "departments" });
  assert.equal(read.type, "read");
  const { commands } = framesOf(read.payloadJson);
  assert.deepEqual(commands, ["<</?C/(R001)", "<</?C/(R004)"]);
  // La lettura non è mai stata confermata dal vivo: il documento lo dichiara.
  assert.equal(read.warnings.some((warning) => warning.includes("mai stata verificata dal vivo")), true);

  assert.throws(
    () => planFiscalJob(context({ departmentMappings: [] }), { kind: "departments" }),
    (error: unknown) => (error as Error).message.includes("Nessun reparto da leggere"),
  );
  // Con una richiesta esplicita si legge anche senza mappatura.
  const explicit = planFiscalJob(context({ departmentMappings: [] }), { kind: "departments", departments: [2] });
  assert.deepEqual(framesOf(explicit.payloadJson).commands, ["<</?C/(R002)"]);
});

test("la programmazione reparti entra in chiave PRG e scrive i reparti", () => {
  const plan = planFiscalJob(context(), {
    kind: "program-departments",
    programs: [
      { department: 4, priceCents: 0, vatRate: 22, service: false, description: "BEVANDE" },
      { department: 1, priceCents: 0, vatRate: 10, service: false, description: "PIZZE" },
    ],
  });
  assert.equal(plan.type, "program");
  const { commands } = framesOf(plan.payloadJson);
  assert.deepEqual(commands, ["=C4", ">R1/?A/$0/*10/(PIZZE)/@0", ">R4/?A/$0/*22/(BEVANDE)/@0"]);
  assert.equal(plan.warnings.some((warning) => warning.includes("scritte nella memoria del RT")), true);

  assert.throws(
    () => normalizeDepartmentPrograms([{ department: 1, priceCents: 0, vatRate: 10 }, { department: 1, priceCents: 0, vatRate: 22 }]),
    (error: unknown) => (error as Error).message.includes("più di una volta"),
  );
  assert.throws(
    () => planFiscalJob(context({ dialectId: "rt-text" }), { kind: "program-departments", programs: [{ department: 1, priceCents: 0, vatRate: 22 }] }),
    (error: unknown) => error instanceof FiscalDialectUnavailableError,
  );
});

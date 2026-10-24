import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FISCAL_DIALECTS,
  FISCAL_PROTOCOL_IDS,
  decodePrintfExchange,
  encodePrintfFrame,
  getFiscalDialect,
  isAgentVersionSufficient,
  listFiscalProtocolOptions,
  paymentCommand,
  saleByDepartment,
  sanitizePrintfText,
  looksLikePrintfAnswer,
  FiscalDialectUnavailableError,
} from "./dialects";

/**
 * Vettori golden: risposte reali della WALL-E MEC RT (fw 10.0.4) raccolte il
 * 15/10/2026 in `docs/15_evidenze_15-10-2026/`. `rx` è la risposta grezza
 * (prefisso <ACK> 06h) e `frameHex` il solo pacchetto <STX>…<ETX>.
 */
const EVIDENCE_VECTORS: Array<{ cmd: string; rx: string; dati: string; src: string }> = [
  { cmd: "<</?s", rx: "060230313031334E7330303032303053453030303038323003", dati: "s000200SE0000", src: "prova.jsonl" },
  { cmd: "<</?s", rx: "060230313031334E7330303030303052453030303038323303", dati: "s000000RE0000", src: "prova.jsonl" },
  { cmd: "<</?f", rx: "060230313031394E6646572020207665722E20202031302E302E3438373003", dati: "fFW   ver.   10.0.4", src: "prova.jsonl" },
  { cmd: "<</?m", rx: "060230313031324E6D373245553730343931363838304203", dati: "m72EU7049168", src: "letture-walle-1202.jsonl" },
  { cmd: "<</?8", rx: "060230313031314E383334322E3431332C323838373603", dati: "8342.413,28", src: "prova.jsonl" },
  { cmd: "=C1", rx: "060230313031304E4F4E303030303030303038343503", dati: "ON00000000", src: "prova.jsonl" },
  { cmd: "=o", rx: "060230313031304E4553303032303030303038353003", dati: "ES00200000", src: "prova.jsonl" },
  { cmd: '="/?A/(…)', rx: "060230313031304E4553303030323030303038353003", dati: "ES00020000", src: "prova.jsonl" },
];

test("encoder riproduce byte per byte il frame di richiesta accettato dal RT", () => {
  // <</?s con PACK-ID '0': frame realmente spedito e accettato il 15/10/2026.
  assert.equal(encodePrintfFrame("<</?s", "0").toString("hex").toUpperCase(), "0230313030354E3C3C2F3F7330324203");
  assert.equal(encodePrintfFrame("=C1", "0").toString("hex").toUpperCase(), "0230313030334E3D433130303103");
  assert.equal(encodePrintfFrame("<</?f", "0").toString("hex").toUpperCase(), "0230313030354E3C3C2F3F6630334503");
});

test("decoder valida le risposte reali e il re-encode è byte-identico", () => {
  for (const vector of EVIDENCE_VECTORS) {
    const exchange = decodePrintfExchange(vector.rx);
    assert.equal(exchange.ackReceived, true, `${vector.cmd} (${vector.src}) deve avere <ACK>`);
    assert.equal(exchange.nackReceived, false);
    assert.equal(exchange.packId, "8", `il RT risponde sempre PACK-ID 8 (${vector.cmd})`);
    assert.equal(exchange.checksumOk, true, `checksum XOR non valido per ${vector.cmd}`);
    assert.equal(exchange.lunghConsistent, true, `<LUNGH> incoerente per ${vector.cmd}`);
    assert.equal(exchange.dati, vector.dati);
    // Prova forte: il frame ricostruito dal DATI decodificato è identico ai
    // byte che il dispositivo ha realmente inviato.
    assert.equal(encodePrintfFrame(exchange.dati, exchange.packId).toString("hex").toUpperCase(), exchange.frameHex);
    assert.equal(exchange.frameHex, vector.rx.slice(2), "frameHex deve essere la risposta senza <ACK>");
  }
});

test("decoder interpreta la <DATA_ANSW> a 10 byte dei comandi documento", () => {
  const ok = decodePrintfExchange("060230313031304E4F4E303030303030303038343503");
  assert.ok(ok.answer);
  assert.equal(ok.answer.tipo, "O");
  assert.equal(ok.answer.ok, true);
  assert.equal(ok.answer.errorCode, null);
  assert.equal(ok.answer.statoDocumento, "00");

  const sequenceError = decodePrintfExchange("060230313031304E4553303032303030303038353003");
  assert.ok(sequenceError.answer);
  assert.equal(sequenceError.answer.ok, false);
  assert.equal(sequenceError.answer.errorCode, "E20");
  assert.equal(sequenceError.answer.errorMessage, "Sequenza errata");
  assert.equal(sequenceError.answer.famiglia, "S");

  const wrongFunction = decodePrintfExchange("060230313031304E4553303030323030303038353003");
  assert.ok(wrongFunction.answer);
  assert.equal(wrongFunction.answer.errorCode, "E02");

  // Le letture (dump-enq) non sono risposte a 10 byte: nessuna <DATA_ANSW>.
  const reading = decodePrintfExchange("060230313031314E383334322E3431332C323838373603");
  assert.equal(reading.answer, null);
  assert.equal(looksLikePrintfAnswer(reading.dati), false);
});

test("decoder segnala checksum corrotto, NACK e frame troncato", () => {
  const corrupted = "060230313031334E7330303032303053453030303038323103";
  assert.equal(decodePrintfExchange(corrupted).checksumOk, false);

  const nack = decodePrintfExchange("150230313031334E7330303032303053453030303038323003");
  assert.equal(nack.nackReceived, true);
  assert.equal(nack.checksumOk, true);

  const withoutAck = decodePrintfExchange("0230313031334E7330303032303053453030303038323003");
  assert.equal(withoutAck.ackReceived, false);
  assert.equal(withoutAck.dati, "s000200SE0000");

  assert.throws(() => decodePrintfExchange("060230313031334E73303030323030"), /no <ETX>/);
  assert.throws(() => decodePrintfExchange("0606"), /no <STX>/);
});

test("grammatica: vendita a reparto, quantita, omaggio e sanitizzazione", () => {
  assert.equal(saleByDepartment({ department: 1, amountCents: 1, description: "TEST PROTOCOLLO RCH" }).command, "=R1/$1/(TEST PROTOCOLLO RCH)");
  assert.equal(saleByDepartment({ department: 2, amountCents: 2000, quantity: 2, description: "Articolo2" }).command, "=R2/$2000/*2/(Articolo2)");
  assert.equal(saleByDepartment({ department: 2, amountCents: 2000, kind: "gift", description: "OMAGGIO B" }).command, "=R2/$2000/&1/(OMAGGIO B)");
  // Reparto 1 implicito nel protocollo, ma il motore lo scrive sempre esplicito.
  assert.equal(saleByDepartment({ department: 1, amountCents: 1000 }).command, "=R1/$1000");

  // Iniezione: i marcatori della grammatica non devono poter entrare nella descrizione.
  const injected = saleByDepartment({ department: 1, amountCents: 100, description: "Pizza (speciale) /$999999/*9" });
  assert.equal(injected.command, "=R1/$100/(Pizza speciale 9999999)");
  assert.equal(injected.warnings.length, 1);

  const totale = saleByDepartment({ department: 1, amountCents: 100, description: "MENU TOTALE" });
  assert.equal(totale.command, "=R1/$100/(MENU)");

  const tooLong = saleByDepartment({ department: 1, amountCents: 100, description: "x".repeat(60) });
  const description = /\((.*)\)/.exec(tooLong.command)?.[1] ?? "";
  assert.equal(description.length, 36);
});

test("grammatica: pagamenti e forma dei comandi di lettura", () => {
  assert.equal(paymentCommand({ method: "cash" }).command, "=T1");
  assert.equal(paymentCommand({ method: "card" }).command, "=T4");
  assert.equal(paymentCommand({ method: "uncollected", amountCents: 1000 }).command, "=T2/$1000");
  assert.equal(paymentCommand({ method: "ticket", amountCents: 500, tickets: 2 }).command, "=T5/$500/&2");
  assert.equal(paymentCommand({ method: "cash", description: "TOTALE CONTANTI" }).command, "=T1/(CONTANTI)");
});

test("ogni dialetto compone frame autocoerenti e ri-decodificabili", () => {
  for (const id of FISCAL_PROTOCOL_IDS) {
    const dialect = getFiscalDialect(id);
    if (!dialect.selectionEnabled) continue;
    const documents = [
      dialect.buildTestDocument(),
      dialect.buildDailyClose(),
      dialect.buildIdentityReads(),
      dialect.buildHealthCheck(),
      dialect.buildCounterReads(),
      dialect.buildDepartmentReads([1, 4]),
      dialect.buildDrawerKick(),
      dialect.buildReceipt({ lines: [{ department: 1, amountCents: 1, description: "PROVA" }], payment: "cash" }),
    ];
    for (const document of documents) {
      assert.ok(document.commands.length > 0, `${id}/${document.kind} senza comandi`);
      for (const entry of document.commands) {
        if (dialect.framing.kind === "text-line") {
          // Il protocollo testuale non ha checksum né PACK-ID: il frame è il
          // comando con il solo terminatore di riga, e deve ricomporlo tale.
          assert.equal(
            Buffer.from(entry.frameHex, "hex").toString("ascii"),
            `${entry.command}\n`,
            `${id}/${document.kind}: il frame testuale non ricompone il comando`,
          );
          assert.equal(entry.packId, "", `${id}/${document.kind}: il framing testuale non ha PACK-ID`);
          continue;
        }
        const decoded = decodePrintfExchange(entry.frameHex);
        assert.equal(decoded.dati, entry.command, `${id}/${document.kind}: il frame non ricompone il comando`);
        assert.equal(decoded.checksumOk, true);
        assert.equal(decoded.packId, entry.packId);
      }
      // Il PACK-ID ciclico (e quindi distinto per frame) è una regola dei soli
      // dialetti PrintF: sul testo il campo non esiste.
      if (dialect.framing.kind === "printf") {
        const packIds = document.commands.map((entry) => entry.packId);
        assert.equal(new Set(packIds).size, packIds.length, `${id}/${document.kind}: PACK-ID duplicato`);
      }
    }
  }
});

test("documento fiscale WALL-E: chiave REG, battute di vendita, incasso", () => {
  const receipt = getFiscalDialect("rch-walle").buildReceipt({
    lines: [
      { department: 1, amountCents: 100, description: "CAFFE" },
      { department: 4, amountCents: 500, quantity: 2, description: "PIZZA" },
    ],
    payment: "cash",
    printSubtotal: true,
  });
  assert.deepEqual(
    receipt.commands.map((entry) => entry.command),
    ["=C1", "=R1/$100/(CAFFE)", "=R4/$500/*2/(PIZZA)", "=S", "=T1"],
  );
});

test("il documento gestionale di prova non emette corrispettivi", () => {
  const testDocument = getFiscalDialect("print3rt").buildTestDocument();
  assert.deepEqual(testDocument.commands.map((entry) => entry.command), [
    "=o",
    '="/?A/(GUSTOPOS - PROVA DI COLLEGAMENTO)',
    '="/?A/(DOCUMENTO GESTIONALE NON FISCALE)',
    '="/?A/(NESSUNA EMISSIONE DI CORRISPETTIVO)',
    "=o",
  ]);
  assert.equal(testDocument.commands.some((entry) => entry.command.startsWith("=R")), false);
  assert.equal(testDocument.commands.some((entry) => entry.command.startsWith("=T")), false);
});

test("catalogo pubblico: solo label, nessun codice di dialetto", () => {
  const options = listFiscalProtocolOptions();
  assert.equal(options.length, FISCAL_PROTOCOL_IDS.length);
  const serialized = JSON.stringify(options);
  for (const code of ["=R1", "=T1", "=C1", "=C10", "<</?", "@A", "@P", "3001", "3004", "3011", "2002", "0020", "ES00"]) {
    assert.equal(serialized.includes(code), false, `il catalogo pubblico non deve contenere "${code}"`);
  }
  const ditron = options.find((option) => option.id === "ditron");
  assert.ok(ditron);
  assert.equal(ditron.selectionEnabled, false);
  assert.equal(ditron.status, "cataloguing");
  const walle = options.find((option) => option.id === "rch-walle");
  assert.ok(walle);
  assert.equal(walle.status, "verified");
  assert.equal(walle.defaultPort, 23);
  assert.equal(walle.selectionEnabled, true);
  for (const option of options) {
    assert.ok(option.models.length > 0, `${option.id} senza modelli`);
    assert.ok(option.statusNote.length > 0);
  }
});

test("gate a priori: l'agente deve saper eseguire i frame del dialetto", () => {
  assert.equal(isAgentVersionSufficient("go-0.15.0", "go-0.14.0"), false);
  assert.equal(isAgentVersionSufficient("go-0.15.0", "go-0.15.0"), true);
  assert.equal(isAgentVersionSufficient("go-0.15.0", "go-0.16.1"), true);
  assert.equal(isAgentVersionSufficient("go-0.15.0", null), false);
  // Un bridge storico nel browser non esegue i frame del server, anche se il
  // suo numero di versione è più alto.
  assert.equal(isAgentVersionSufficient("go-0.15.0", "v0.15.0"), false);
  assert.equal(isAgentVersionSufficient("go-0.15.0", "browser-1.0.0"), false);
  assert.equal(isAgentVersionSufficient("go-0.15.0", "1.0.0"), false);
  assert.equal(isAgentVersionSufficient(null, "go-0.1.0"), true);
});

test("Ditron: catalogato ma mai componibile", () => {
  const ditron = FISCAL_DIALECTS.ditron;
  assert.equal(ditron.selectionEnabled, false);
  for (const build of [
    () => ditron.buildReceipt({ lines: [{ department: 1, amountCents: 1 }], payment: "cash" }),
    () => ditron.buildTestDocument(),
    () => ditron.buildDailyClose(),
    () => ditron.buildHealthCheck(),
  ]) {
    assert.throws(build, FiscalDialectUnavailableError);
  }
});

test("sanitizePrintfText rimuove i caratteri di controllo e i marcatori", () => {
  assert.deepEqual(sanitizePrintfText("MENU' & C.", 36), { text: "MENU'  C.", changed: true });
  assert.equal(sanitizePrintfText("NOME\nCON A CAPO", 36).text, "NOMECON A CAPO");
  assert.equal(sanitizePrintfText("ok", 36).changed, false);
});

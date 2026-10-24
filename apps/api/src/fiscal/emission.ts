/**
 * Composizione dei job fiscali **eseguibili**: sceglie il dialetto configurato,
 * risolve la mappatura reparti e incapsula i frame già pronti nel payload
 * `wire`.
 *
 * È il punto in cui i tre pezzi si incontrano:
 *   - il **motore dialetti** (`./dialects`) compone i frame (codici riservati,
 *     solo server-side);
 *   - la **mappatura reparti** (`./department-mapping`) decide quali battute di
 *     vendita finiscono su quale reparto del RT, e su quale aliquota;
 *   - il **gate versione** verifica che l'agente installato sappia eseguire i
 *     frame prima di accodare il lavoro (un agente più vecchio non ha il
 *     trasporto generico: il job resterebbe fermo o fallirebbe in cassa).
 *
 * Nessuna funzione qui tocca il database: prende la configurazione e restituisce
 * il payload, così è testabile senza un RT e senza Postgres.
 */

import type {
  FiscalJobType,
  FiscalPrinterConfig,
  FiscalProtocolId,
  FiscalWirePayload,
} from "@gustopos/shared";
import { departmentsForProtocol, resolveFiscalSaleLines, type FiscalSaleItemInput } from "./department-mapping";
import { liveVerificationFor } from "./live-verification";
import { buildWirePayload, isAgentVersionSufficient, resolveConfiguredDialect } from "./dialects";
import type { DepartmentProgram, PaymentMethod } from "./dialects";
import type { FiscalDialectDefinition } from "./dialects/types";

/**
 * Errore di composizione: il messaggio è scritto per finire sotto gli occhi di
 * chi usa la cassa o la pagina Impostazioni ("protocollo non selezionato",
 * "aggiorna l'agente di stampa"), non per i log.
 */
export class FiscalEmissionError extends Error {
  readonly issues: string[];

  constructor(message: string, issues: string[] = []) {
    super(message);
    this.name = "FiscalEmissionError";
    this.issues = issues;
  }
}

export interface FiscalEmissionPlan {
  /** Tipo di job accodato (schema `fiscalJobTypeSchema`). */
  type: FiscalJobType;
  /** Protocollo che eseguirà i frame (per l'audit e per la decodifica). */
  protocolId: FiscalProtocolId;
  /** Payload da scrivere in `fiscal_jobs.payload`. */
  payloadJson: string;
  /** Avvisi del motore (descrizioni adattate, comandi non verificati, ripieghi). */
  warnings: string[];
}

export type FiscalJobIntent =
  | { kind: "test" }
  | { kind: "daily-close"; businessDate: string }
  | {
      kind: "receipt";
      paymentId: string;
      method: "cash" | "card" | "mixed";
      items: FiscalSaleItemInput[];
      businessDate?: string;
    }
  | { kind: "departments"; departments?: number[] }
  | { kind: "program-departments"; programs: DepartmentProgram[] };

export interface FiscalEmissionContext {
  config: FiscalPrinterConfig;
  /** Versioni degli agenti di stampa registrati per il tenant. */
  agentVersions: Array<string | null | undefined>;
}

/**
 * Il protocollo attivo, o un errore spiegabile. Senza dialetto configurato il
 * server non comporrebbe alcun frame: l'agente ha perso l'adattatore storico,
 * quindi il job non partirebbe mai (meglio dirlo subito).
 */
export function requireConfiguredDialect(config: FiscalPrinterConfig): FiscalDialectDefinition {
  if (!config.host) {
    throw new FiscalEmissionError(
      "Nessun registratore di cassa configurato: indica indirizzo e porta del RT in Impostazioni → Fiscale",
    );
  }
  const dialect = resolveConfiguredDialect(config.dialectId);
  if (!dialect) {
    throw new FiscalEmissionError(
      "Nessun protocollo fiscale selezionato: scegli il protocollo del RT in Impostazioni → Fiscale prima di emettere",
    );
  }
  return dialect;
}

/**
 * Un documento eseguito si porta dietro la lettura di stato: il progressivo del
 * documento lo dice il RT (`<</?s`), non l'agente. Sulle unità verificate la
 * risposta dopo l'incasso è `s000000RE0001` → documento 1.
 */
function appendAuditReads(
  document: ReturnType<FiscalDialectDefinition["buildTestDocument"]>,
  reads: ReturnType<FiscalDialectDefinition["buildTestDocument"]>,
) {
  return {
    ...document,
    commands: [...document.commands, ...reads.commands],
    warnings: Array.from(new Set([...document.warnings, ...reads.warnings])),
  };
}

/**
 * Gate a priori sull'agente: i frame li esegue solo un agente abbastanza
 * recente. Se nessun agente registrato lo è, il job non va accodato: in cassa
 * un corrispettivo mancante è un incidente fiscale, un avviso no.
 */
export function assertAgentCanExecute(dialect: FiscalDialectDefinition, agentVersions: Array<string | null | undefined>): void {
  if (dialect.requiresAgentVersion === null) return;
  if (agentVersions.length === 0) {
    throw new FiscalEmissionError(
      "Nessun agente di stampa registrato per questo locale: l'emissione fiscale passa dall'agente sulla postazione cassa",
    );
  }
  const capable = agentVersions.some((version) => isAgentVersionSufficient(dialect.requiresAgentVersion, version));
  if (!capable) {
    throw new FiscalEmissionError(
      `L'agente di stampa installato non sa eseguire il protocollo ${dialect.label}: aggiorna l'agente (serve ${dialect.requiresAgentVersion} o superiore)`,
    );
  }
}

/**
 * Un dialetto nato dai manuali (`emissionGated`) non emette **corrispettivi**
 * finché non è stato collaudato su questa cassa: la prova gestionale, le
 * letture e la programmazione restano sempre possibili (sono il percorso con cui
 * si collauda), a essere bloccata è la sola emissione fiscale. Senza questo
 * gate il badge in Impostazioni sarebbe una promessa non mantenuta: il primo
 * corrispettivo partirebbe su un protocollo mai provato.
 */
export function assertEmissionAllowed(dialect: FiscalDialectDefinition, config: FiscalPrinterConfig): void {
  if (!dialect.emissionGated) return;
  if (liveVerificationFor(config, dialect.id)) return;
  throw new FiscalEmissionError(
    `Emissione bloccata: ${dialect.label} non è ancora stato collaudato su questa cassa. ` +
      "Esegui la prova gestionale e le letture in Impostazioni → Fiscale, poi registra l'esito del collaudo per abilitare i corrispettivi",
  );
}

/** Reparti da leggere sul RT: quelli configurati, salvo richiesta esplicita. */
export function departmentsToRead(config: FiscalPrinterConfig, requested?: number[]): number[] {
  if (requested && requested.length > 0) {
    return Array.from(new Set(requested)).sort((a, b) => a - b);
  }
  return departmentsForProtocol(config.departmentMappings, config.dialectId).map((entry) => entry.department);
}

/** Programmi di reparto richiesti dall'admin, normalizzati per il dialetto. */
export function normalizeDepartmentPrograms(programs: DepartmentProgram[]): DepartmentProgram[] {
  const seen = new Set<number>();
  const out: DepartmentProgram[] = [];
  for (const program of programs) {
    if (seen.has(program.department)) {
      throw new FiscalEmissionError(`Reparto ${program.department} indicato più di una volta nella programmazione`);
    }
    seen.add(program.department);
    out.push({ ...program, priceCents: program.priceCents ?? 0 });
  }
  return out.sort((a, b) => a.department - b.department);
}

/**
 * Compone il job per una richiesta dell'admin (collaudo, chiusura) o della
 * pagina fiscale (letture, programmazione). Le ricevute passano da
 * `planReceiptJob`, che risolve prima la mappatura reparti.
 */
export function planFiscalJob(context: FiscalEmissionContext, intent: FiscalJobIntent): FiscalEmissionPlan {
  const dialect = requireConfiguredDialect(context.config);
  assertAgentCanExecute(dialect, context.agentVersions);

  switch (intent.kind) {
    case "test": {
      const document = dialect.buildTestDocument();
      return planFrom(dialect, "test", "test", document, {});
    }
    case "daily-close": {
      const document = appendAuditReads(dialect.buildDailyClose(), dialect.buildHealthCheck());
      return planFrom(dialect, "chiusura", "daily-close", document, { businessDate: intent.businessDate });
    }
    case "departments": {
      const departments = departmentsToRead(context.config, intent.departments);
      if (departments.length === 0) {
        throw new FiscalEmissionError(
          "Nessun reparto da leggere: configura la mappatura reparti o indica i reparti da leggere",
        );
      }
      const document = dialect.buildDepartmentReads(departments);
      return planFrom(dialect, "read", "departments", document, {});
    }
    case "program-departments": {
      const programs = normalizeDepartmentPrograms(intent.programs);
      if (programs.length === 0) {
        throw new FiscalEmissionError("Nessun reparto da programmare");
      }
      const document = dialect.buildDepartmentPrograms(programs);
      return planFrom(dialect, "program", "program-departments", document, {});
    }
    case "receipt":
      throw new FiscalEmissionError("Usa planReceiptJob per i corrispettivi: la mappatura reparti va risolta prima");
  }
}

/**
 * Corrispettivo: ogni riga viene risolta sulla mappatura del protocollo attivo.
 * Se una categoria non ha reparto (e non c'è ripiego) il job **non** viene
 * composto: un corrispettivo con l'aliquota sbagliata è peggio di un
 * corrispettivo da riemettere.
 */
export function planReceiptJob(
  context: FiscalEmissionContext,
  intent: Extract<FiscalJobIntent, { kind: "receipt" }>,
): FiscalEmissionPlan {
  const dialect = requireConfiguredDialect(context.config);
  assertAgentCanExecute(dialect, context.agentVersions);
  assertEmissionAllowed(dialect, context.config);

  const departments = departmentsForProtocol(context.config.departmentMappings, dialect.id);
  if (departments.length === 0) {
    throw new FiscalEmissionError(
      `La mappatura reparti del protocollo ${dialect.label} è vuota: senza reparti il RT non può battere alcun corrispettivo`,
    );
  }
  const resolution = resolveFiscalSaleLines(intent.items, departments);
  if (resolution.blocked) {
    throw new FiscalEmissionError(
      `Emissione fiscale bloccata: nessun reparto per ${resolution.unmappedCategories.join(", ")}. Mappa la categoria (o configura un reparto di ripiego) in Impostazioni → Fiscale`,
      resolution.unmappedCategories,
    );
  }
  const receipt = dialect.buildReceipt({
    lines: resolution.lines,
    payment: normalizeMethod(intent.method),
    printSubtotal: resolution.lines.length > 1,
    ensureRegKey: true,
  });
  const document = appendAuditReads(receipt, dialect.buildHealthCheck());
  const warnings = [...resolution.warnings, ...document.warnings];
  return planFrom(dialect, "receipt", "receipt", { ...document, warnings }, {
    paymentId: intent.paymentId,
    businessDate: intent.businessDate,
  });
}

function normalizeMethod(method: "cash" | "card" | "mixed"): PaymentMethod {
  if (method === "cash") return "cash";
  // Il protocollo ha una sola voce per le forme elettroniche: `mixed` viene
  // battuto come elettronico (il resto è incassato dall'operatore).
  return "electronic";
}

function planFrom(
  dialect: FiscalDialectDefinition,
  type: FiscalJobType,
  purpose: FiscalWirePayload["purpose"],
  document: ReturnType<FiscalDialectDefinition["buildTestDocument"]>,
  extra: { paymentId?: string; businessDate?: string },
): FiscalEmissionPlan {
  const payload = buildWirePayload(dialect, document, { purpose, ...extra });
  return {
    type,
    protocolId: dialect.id,
    payloadJson: JSON.stringify(payload),
    warnings: Array.from(new Set(document.warnings)),
  };
}

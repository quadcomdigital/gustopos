/**
 * Implementazione condivisa della famiglia PrintF (PRINT! 3.0 RT, Print! RT,
 * WALL-E MEC RT / K-BILL RT). I due dialetti condividono framing, checksum e
 * grammatica `=`: cambiano il sottoinsieme di comandi verificati, la porta
 * documentata e il livello di evidenza, non il codice.
 *
 * RISERVATO — server-side soltanto.
 */

import type { FiscalProtocolId, FiscalProtocolOption, FiscalProtocolStatus, FiscalTransport } from "@gustopos/shared";
import {
  DAILY_CLOSE_COMMAND,
  KEY_PRG_COMMAND,
  KEY_REG_COMMAND,
  KEY_Z_COMMAND,
  MANAGEMENT_DOCUMENT_COMMAND,
  OPEN_DRAWER_COMMAND,
  READ_COUNTERS,
  READ_IDENTITY_COMMANDS,
  READ_MANAGEMENT_DOC_COUNTER_COMMAND,
  READ_STATUS_COMMAND,
  SUBTOTAL_COMMAND,
  departmentProgram,
  paymentCommand,
  readDepartmentProgram,
  saleByDepartment,
  textLine,
} from "./printf-commands";
import {
  frameCommands,
  type DepartmentProgram,
  type FiscalCommandCapability,
  type FiscalDialectDefinition,
  type FiscalDocument,
  type FiscalFramedCommand,
  type FiscalFraming,
  type FiscalReceiptRequest,
  type PendingCommand,
} from "./types";

/** La famiglia PrintF usa il pacchetto binario terminato da <ETX>. */
export const PRINTF_FRAMING: FiscalFraming = { kind: "printf", terminator: "etx" };

export interface PrintfDialectConfig {
  id: FiscalProtocolId;
  label: string;
  vendor: string;
  status: FiscalProtocolStatus;
  statusNote: string;
  models: Array<{ id: string; label: string }>;
  transports: FiscalTransport[];
  defaultPort: number | null;
  defaultModel: string;
  defaultVersion: string;
  versions: string[];
  requiresAgentVersion: string | null;
  selectionEnabled: boolean;
  emissionGated: boolean;
  capabilities: Record<string, FiscalCommandCapability>;
  /** Righe del documento gestionale di prova (NON fiscale). */
  managementTestLines: string[];
  /** Framing: la famiglia PrintF usa il pacchetto binario (default). */
  framing?: FiscalFraming;
}

const TEXT_LINE_LABEL = "riga documento gestionale";

function documentOf(
  config: PrintfDialectConfig,
  kind: FiscalDocument["kind"],
  commands: FiscalFramedCommand[],
  warnings: string[],
): FiscalDocument {
  return {
    kind,
    dialectId: config.id,
    dialectLabel: config.label,
    commands,
    warnings,
  };
}

function unverifiedWarnings(config: PrintfDialectConfig, keys: string[]): string[] {
  return keys
    .map((key) => {
      const capability = config.capabilities[key];
      if (!capability || capability.status === "verified") return null;
      return `${key}: comando non ancora verificato dal vivo su questa piattaforma (${capability.note})`;
    })
    .filter((value): value is string => value !== null);
}

export function createPrintfDialect(config: PrintfDialectConfig): FiscalDialectDefinition {
  const framing = config.framing ?? PRINTF_FRAMING;

  function buildReceipt(request: FiscalReceiptRequest): FiscalDocument {
    const warnings: string[] = [];
    const pending: PendingCommand[] = [];
    // Senza chiave REG il RT rifiuta i comandi documentali con E20: la
    // selezione è parte della sequenza, non un'opzione del chiamante.
    if (request.ensureRegKey !== false) {
      pending.push({ label: "chiave REG", command: KEY_REG_COMMAND });
    }
    for (const line of request.lines) {
      const sale = saleByDepartment(line);
      warnings.push(...sale.warnings);
      pending.push({ label: `vendita reparto ${line.department}`, command: sale.command });
    }
    if (request.printSubtotal) {
      pending.push({ label: "subtotale", command: SUBTOTAL_COMMAND });
    }
    const payment = paymentCommand({ method: request.payment, ...request.paymentDetail });
    warnings.push(...payment.warnings);
    pending.push({ label: `pagamento ${request.payment}`, command: payment.command, waitMs: 500 });
    warnings.push(...unverifiedWarnings(config, ["saleByDepartment", "payment"]));
    return documentOf(config, "receipt", frameCommands(pending, framing), warnings);
  }

  /**
   * Documento gestionale: NON è un corrispettivo (non entra nel giornale
   * elettronico). È il collaudo corretto in esercizio, al posto del test
   * storico che emetteva uno scontrino fiscale di 0,01 €.
   */
  function buildTestDocument(): FiscalDocument {
    const warnings: string[] = [];
    const pending: PendingCommand[] = [{ label: "apertura gestionale", command: MANAGEMENT_DOCUMENT_COMMAND }];
    for (const line of config.managementTestLines) {
      const text = textLine(line);
      warnings.push(...text.warnings);
      pending.push({ label: TEXT_LINE_LABEL, command: text.command });
    }
    pending.push({ label: "chiusura gestionale", command: MANAGEMENT_DOCUMENT_COMMAND, waitMs: 700 });
    warnings.push(...unverifiedWarnings(config, ["managementDocument"]));
    return documentOf(config, "test", frameCommands(pending, framing), warnings);
  }

  function buildDailyClose(): FiscalDocument {
    return documentOf(
      config,
      "daily-close",
      frameCommands(
        [
          { label: "chiave Z", command: KEY_Z_COMMAND, waitMs: 500 },
          { label: "chiusura fiscale di giornata", command: DAILY_CLOSE_COMMAND, waitMs: 4000 },
        ],
        framing,
      ),
      unverifiedWarnings(config, ["dailyClose"]),
    );
  }

  function buildIdentityReads(): FiscalDocument {
    return documentOf(
      config,
      "identity",
      frameCommands(
        READ_IDENTITY_COMMANDS.map((command) => ({ label: "identificazione RT", command, waitMs: 200 })),
        framing,
      ),
      [],
    );
  }

  function buildHealthCheck(): FiscalDocument {
    return documentOf(
      config,
      "health",
      frameCommands(
        [
          { label: "stato RT (chiave + documento)", command: READ_STATUS_COMMAND, waitMs: 200 },
          { label: "progressivo documenti gestionali", command: READ_MANAGEMENT_DOC_COUNTER_COMMAND, waitMs: 200 },
        ],
        framing,
      ),
      [],
    );
  }

  function buildCounterReads(): FiscalDocument {
    return documentOf(
      config,
      "health",
      frameCommands(
        READ_COUNTERS.map((counter) => ({ label: counter.label, command: counter.command, waitMs: 200 })),
        framing,
      ),
      unverifiedWarnings(config, ["counterReads"]),
    );
  }

  function buildDepartmentReads(departments: number[]): FiscalDocument {
    return documentOf(
      config,
      "departments",
      frameCommands(
        departments.map((department) => ({
          label: `programmazione reparto ${department}`,
          command: readDepartmentProgram(department),
          waitMs: 200,
        })),
        framing,
      ),
      [
        "la risposta alla lettura reparti non è mai stata verificata dal vivo: il valore grezzo resta nel risultato finché il tecnico non conferma il layout",
        ...unverifiedWarnings(config, ["departmentProgram"]),
      ],
    );
  }

  /**
   * Programmazione reparti: si entra in chiave PRG (`=C4`) e si scrive ogni
   * reparto con `>R…`. È l'unica scrittura del percorso fiscale, quindi le
   * istruzioni vengono dall'admin (mappatura in Impostazioni) e non da un
   * automatismo: il comando è documentato ma mai eseguito dal vivo, e per
   * questo il documento dichiara in chiaro che cosa sta per modificare.
   */
  function buildDepartmentPrograms(programs: DepartmentProgram[]): FiscalDocument {
    const pending: PendingCommand[] = [
      { label: "chiave PRG", command: KEY_PRG_COMMAND, waitMs: 500 },
    ];
    for (const program of programs) {
      const command = departmentProgram(program);
      pending.push({ label: `scrittura reparto ${program.department}`, command: command.command, waitMs: 400 });
    }
    return documentOf(
      config,
      "departments",
      frameCommands(pending, framing),
      [
        `programmazione di ${programs.length} reparti: aliquota e natura bene/servizio vengono scritte nella memoria del RT`,
        ...unverifiedWarnings(config, ["departmentProgram"]),
      ],
    );
  }

  function buildDrawerKick(): FiscalDocument {
    return documentOf(
      config,
      "drawer",
      frameCommands([{ label: "apertura cassetto", command: OPEN_DRAWER_COMMAND, waitMs: 300 }], framing),
      unverifiedWarnings(config, ["drawer"]),
    );
  }

  function toPublicOption(): FiscalProtocolOption {
    return {
      id: config.id,
      label: config.label,
      vendor: config.vendor,
      status: config.status,
      statusNote: config.statusNote,
      models: config.models,
      transports: config.transports,
      defaultPort: config.defaultPort,
      defaultModel: config.defaultModel,
      defaultVersion: config.defaultVersion,
      versions: config.versions,
      requiresAgentVersion: config.requiresAgentVersion,
      selectionEnabled: config.selectionEnabled,
      emissionGated: config.emissionGated,
    };
  }

  return {
    id: config.id,
    label: config.label,
    vendor: config.vendor,
    status: config.status,
    statusNote: config.statusNote,
    models: config.models,
    transports: config.transports,
    defaultPort: config.defaultPort,
    defaultModel: config.defaultModel,
    defaultVersion: config.defaultVersion,
    versions: config.versions,
    requiresAgentVersion: config.requiresAgentVersion,
    selectionEnabled: config.selectionEnabled,
    emissionGated: config.emissionGated,
    framing,
    capabilities: config.capabilities,
    buildReceipt,
    buildTestDocument,
    buildDailyClose,
    buildIdentityReads,
    buildHealthCheck,
    buildCounterReads,
    buildDepartmentReads,
    buildDepartmentPrograms,
    buildDrawerKick,
    toPublicOption,
  };
}

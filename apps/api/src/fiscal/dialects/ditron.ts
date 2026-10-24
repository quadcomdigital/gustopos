/**
 * Dialetto `ditron` — RT Ditron.
 *
 * STATO: **catalogazione non iniziata**. Nel corpus documentale (`/srv/docs`)
 * non esiste il manuale protocollo Ditron e non è mai stata raccolta
 * un'evidenza live: senza fonti il dialetto non si implementa, perché
 * un'implementazione inventata emetterebbe documenti sbagliati su un RT
 * certificato.
 *
 * Il dialetto resta nel catalogo della UI come voce **non selezionabile**:
 * l'admin vede che la configurazione esiste, sa cosa manca e non può attivare
 * qualcosa che non funziona. Ogni tentativo di comporre un documento fallisce
 * con un errore esplicito, mai con un comando plausibile.
 */

import type { FiscalProtocolOption } from "@gustopos/shared";
import {
  FISCAL_FRAME_PASSTHROUGH_AGENT_VERSION,
  FiscalDialectUnavailableError,
  type FiscalDialectDefinition,
} from "./types";

const STATUS_NOTE =
  "Nessuna fonte tecnica disponibile: manuale protocollo e macchina di prova da reperire. Voce visibile ma non selezionabile (nessuna emissione possibile).";

const PUBLIC_OPTION: FiscalProtocolOption = {
  id: "ditron",
  label: "Ditron",
  vendor: "Ditron",
  status: "cataloguing",
  statusNote: STATUS_NOTE,
  models: [{ id: "ditron-rt", label: "Ditron RT (modello da confermare)" }],
  transports: ["tcp", "serial", "usb"],
  defaultPort: null,
  defaultModel: "ditron-rt",
  defaultVersion: "",
  versions: [],
  requiresAgentVersion: FISCAL_FRAME_PASSTHROUGH_AGENT_VERSION,
  selectionEnabled: false,
  emissionGated: true,
};

function refuse(): never {
  throw new FiscalDialectUnavailableError(
    "dialetto Ditron non ancora catalogato: servono il manuale protocollo del costruttore (o un RT di prova) prima di poter comporre documenti",
  );
}

export const ditronDialect: FiscalDialectDefinition = {
  ...PUBLIC_OPTION,
  // Il framing del RT Ditron non è noto (protocollo non catalogato): il valore
  // è segnaposto e non viene mai usato, perché il dialetto rifiuta di comporre.
  framing: { kind: "printf", terminator: "etx" },
  capabilities: {
    saleByDepartment: { status: "untested", note: "protocollo non documentato" },
    payment: { status: "untested", note: "protocollo non documentato" },
    managementDocument: { status: "untested", note: "protocollo non documentato" },
    dailyClose: { status: "untested", note: "protocollo non documentato" },
    counterReads: { status: "untested", note: "protocollo non documentato" },
  },
  buildReceipt: refuse,
  buildTestDocument: refuse,
  buildDailyClose: refuse,
  buildIdentityReads: refuse,
  buildHealthCheck: refuse,
  buildCounterReads: refuse,
  buildDepartmentReads: refuse,
  buildDepartmentPrograms: refuse,
  buildDrawerKick: refuse,
  toPublicOption: () => ({ ...PUBLIC_OPTION }),
};

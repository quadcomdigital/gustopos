/**
 * Dialetto `rch-walle` — RCH WALL-E MEC RT / K-BILL RT (piattaforma LDP33 RT,
 * protocollo "Prot. PrintF").
 *
 * Verificato dal vivo il 15/10/2026 su cassa reale (192.168.0.120, fw 10.0.4,
 * matricola 72EU7049168): 54 scambi in
 * `docs/15_evidenze_15-10-2026/prova.jsonl`, checksum ricalcolato 54/54.
 * Scheda: `docs/16_catalogo-dialetti/rch-walle.md`.
 *
 * Il dialetto parla la STESSA famiglia di protocollo di Print RT 3.0 (stesso
 * framing, stessa grammatica `=`): cambia il sottoinsieme verificato e la
 * porta, che su questa unità è la 23 (la 3000 è della modalità Access Point).
 */

import { FISCAL_FRAME_PASSTHROUGH_AGENT_VERSION } from "./types";
import { createPrintfDialect } from "./printf-dialect";

export const rchWalleDialect = createPrintfDialect({
  id: "rch-walle",
  label: "RCH WALL-E",
  vendor: "RCH",
  status: "verified",
  statusNote:
    "Verificato dal vivo il 15/10/2026: letture, documento gestionale, vendita 0,01 € con quadratura dei contatori. Porta TCP 23, protocollo RT impostato su Prot. PrintF.",
  models: [
    { id: "walle-mec-rt", label: "WALL-E MEC RT (LDP33 RT)" },
    { id: "kbill-rt", label: "K-BILL RT (LDP33 RT)" },
  ],
  transports: ["tcp", "serial"],
  defaultPort: 23,
  defaultModel: "walle-mec-rt",
  defaultVersion: "10.0.4",
  versions: ["10.0.4"],
  requiresAgentVersion: FISCAL_FRAME_PASSTHROUGH_AGENT_VERSION,
  selectionEnabled: true,
  emissionGated: false,
  capabilities: {
    saleByDepartment: { status: "verified", note: "=R1/$1/(TEST PROTOCOLLO RCH) accettata: ON00000000" },
    payment: {
      status: "verified",
      note: "verificato =T1 contanti; =T2…=T5 (non riscosso/assegni/elettronico/ticket) ancora da collaudare",
    },
    subtotal: { status: "documented", note: "=S non ancora provato su questa unità" },
    managementDocument: { status: "verified", note: "=o + righe =\"/?A/(…) + =o: ON00000000, nessun corrispettivo" },
    dailyClose: { status: "untested", note: "=C3 + =C10: da collaudare su giornata di prova" },
    counterReads: { status: "verified", note: "Gran Totale <</?8, corrispettivi <</?1, chiusure <</?7" },
    identityReads: { status: "verified", note: "<</?f, <</?m, <</?n, <</?d, <</?s" },
    departmentReads: { status: "documented", note: "<</?C/(Rnnn) da confermare su questa unità" },
    departmentProgram: { status: "documented", note: ">R… : operazione una tantum del tecnico, da collaudare" },
    drawer: { status: "untested", note: "=C86 non provato" },
  },
  managementTestLines: [
    "GUSTOPOS - PROVA DI COLLEGAMENTO",
    "DOCUMENTO GESTIONALE (NON FISCALE)",
    "NESSUNA EMISSIONE DI CORRISPETTIVO",
  ],
});

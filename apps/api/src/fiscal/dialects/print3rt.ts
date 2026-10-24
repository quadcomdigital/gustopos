/**
 * Dialetto `print3rt` — PRINT! 3.0 RT / Print! RT (famiglia PrintF).
 *
 * Fonti: `01_print3_rt/DE0095A0004_…_PRINT!_3.0_RT.pdf` (rev 4.0, 09/2026),
 * `05_print_rt/RCH_PrintRT_ManualeProtocollo_IT_DE0008A0000_Rev00.pdf`,
 * testo estratto `docs/15_evidenze_15-10-2026/prot.txt`.
 * Catalogo completo: `docs/16_catalogo-dialetti/print3rt.{md,json}`.
 *
 * NON ancora verificato dal vivo: il framing è lo stesso della WALL-E
 * (verificato il 15/10/2026), ma su questa piattaforma non è stata emessa
 * nemmeno una battuta di prova — per questo `emissionGated: true`.
 */

import { FISCAL_FRAME_PASSTHROUGH_AGENT_VERSION } from "./types";
import { createPrintfDialect } from "./printf-dialect";

export const print3rtDialect = createPrintfDialect({
  id: "print3rt",
  label: "Print RT 3.0",
  vendor: "RCH",
  status: "documented",
  statusNote:
    "Manuale protocollo PRINT! 3.0 RT rev 4.0 (09/2026): catalogo completo di documento fiscale, gestionale, reparti, letture ed errori. Verifica live su un cliente ancora da fare.",
  models: [
    { id: "print-rt-3", label: "PRINT! 3.0 RT" },
    { id: "print-rt", label: "Print! RT" },
    { id: "iron-print-rt", label: "IRON PRINT RT" },
    { id: "print-f", label: "PRINT! F (stessa famiglia)" },
  ],
  transports: ["tcp", "serial", "usb"],
  defaultPort: 23,
  defaultModel: "print-rt-3",
  defaultVersion: "",
  versions: [],
  requiresAgentVersion: FISCAL_FRAME_PASSTHROUGH_AGENT_VERSION,
  selectionEnabled: true,
  emissionGated: true,
  capabilities: {
    saleByDepartment: { status: "documented", note: "manuale §1.6/§3.1 (=R)" },
    payment: { status: "documented", note: "manuale §3.4 (=T1..=T5)" },
    subtotal: { status: "documented", note: "manuale §3.5 (=S)" },
    managementDocument: { status: "documented", note: "manuale §4 (documento non fiscale)" },
    dailyClose: { status: "documented", note: "manuale §3.6 (=C3 + =C10): mai eseguita su RT reale" },
    counterReads: { status: "documented", note: "manuale §4.2: contatori Gran Totale/corrispettivi/chiusure" },
    identityReads: { status: "documented", note: "manuale §4.2 (=<</?f, <</?m, <</?n, <</?d)" },
    departmentReads: { status: "documented", note: "manuale §5.2 (<</?C/(Rnnn))" },
    departmentProgram: { status: "documented", note: "manuale §5.1 (>R…): operazione una tantum del tecnico" },
    drawer: { status: "documented", note: "manuale §3.6 (=C86)" },
  },
  managementTestLines: [
    "GUSTOPOS - PROVA DI COLLEGAMENTO",
    "DOCUMENTO GESTIONALE (NON FISCALE)",
    "NESSUNA EMISSIONE DI CORRISPETTIVO",
  ],
});

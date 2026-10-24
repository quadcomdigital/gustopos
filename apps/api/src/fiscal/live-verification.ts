/**
 * Collaudo dal vivo di un dialetto fiscale.
 *
 * Un dialetto nato dai manuali (`emissionGated`) non emette corrispettivi
 * finché non è stato **provato su quella cassa**. La prova non è una
 * dichiarazione dell'utente: è la prova gestionale (documento non fiscale) che
 * il server ha composto e che il RT ha eseguito, completata. Questo modulo
 * tiene le due cose che rendono il collaudo verificabile e non una promessa:
 *
 *   - **quale** prova vale (l'ultima completata *per quel protocollo*, letta dal
 *     payload del job — i frame li compone il server, quindi il protocollo è
 *     scritto lì e non in un campo dichiarato dal chiamante);
 *   - **cosa** se ne conserva (id della prova e quadrature lette dal RT), così
 *     l'audit del collaudo non dipende da ciò che ricorda chi lo registra.
 *
 * Funzioni pure: la parte che tocca il database sta nel repository.
 */

import {
  fiscalWirePayloadSchema,
  type FiscalLiveVerification,
  type FiscalPrinterConfig,
  type FiscalProtocolId,
} from "@gustopos/shared";

/** Collaudo registrato per un protocollo (null = mai collaudato su questa cassa). */
export function liveVerificationFor(
  config: FiscalPrinterConfig,
  protocolId: FiscalProtocolId | null,
): FiscalLiveVerification | null {
  if (!protocolId) return null;
  return config.liveVerifications.find((entry) => entry.protocolId === protocolId) ?? null;
}

export interface FiscalTestJobRow {
  id: string;
  bridgeId: string | null;
  payload: string;
  result: string | null;
}

/**
 * Ultima prova gestionale completata **per questo protocollo**. Le righe
 * arrivano già filtrate (tipo `test`, stato `completed`, più recenti prima): qui
 * si sceglie solo quella del protocollo attivo, e si ignora una riga illeggibile
 * invece di far fallire il collaudo.
 */
export function selectVerificationEvidence(
  rows: FiscalTestJobRow[],
  protocolId: FiscalProtocolId,
): FiscalTestJobRow | null {
  for (const row of rows) {
    const payload = fiscalWirePayloadSchema.safeParse(safeJson(row.payload));
    if (payload.success && payload.data.wire.protocolId === protocolId) {
      return row;
    }
  }
  return null;
}

/** Quadrature lette dal RT nella prova, per l'evidenza del collaudo. */
export function verificationCounters(resultJson: string | null): Record<string, string> {
  const parsed = safeJson(resultJson);
  if (!parsed || typeof parsed !== "object") return {};
  const counters = (parsed as { counters?: unknown }).counters;
  if (!counters || typeof counters !== "object") return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(counters as Record<string, unknown>)) {
    if (typeof value === "string" && key !== "") out[key.slice(0, 24)] = value.slice(0, 40);
  }
  return out;
}

/** JSON letto dal database: un payload illeggibile vale come "prova assente". */
function safeJson(raw: string | null): unknown {
  try {
    return JSON.parse(raw ?? "") as unknown;
  } catch {
    return null;
  }
}

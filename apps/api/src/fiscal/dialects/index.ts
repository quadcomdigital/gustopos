/**
 * Registro dei dialetti fiscali (motore lato server).
 *
 * Espone due superfici distinte:
 *  - `listFiscalProtocolOptions()` — catalogo **pubblico** (label/modelli/
 *    versioni/limiti), l'unica cosa che può raggiungere il browser. Ogni voce
 *    passa da `fiscalProtocolOptionSchema.parse`, così nessun campo extra
 *    (e quindi nessun codice) può uscire dal server.
 *  - `getFiscalDialect()` + `build*` — composizione dei frame, riservata al
 *    server (e in futuro al percorso di emissione).
 */

import {
  fiscalProtocolOptionSchema,
  type FiscalProtocolId,
  type FiscalProtocolOption,
} from "@gustopos/shared";
import { ditronDialect } from "./ditron";
import { print3rtDialect } from "./print3rt";
import { rchWalleDialect } from "./rch-walle";
import { rtTextDialect } from "./rt-text";
import type { FiscalDialectDefinition } from "./types";

export const FISCAL_DIALECTS: Record<FiscalProtocolId, FiscalDialectDefinition> = {
  print3rt: print3rtDialect,
  "rch-walle": rchWalleDialect,
  ditron: ditronDialect,
  "rt-text": rtTextDialect,
};

/**
 * Protocollo storico: l'adattatore testuale che stava dentro l'agente. Non è
 * una delle configurazioni del cliente (Print RT 3.0 / WALL-E / Ditron / 4ª),
 * ma la via di compatibilità per i locali con un RT generico già in servizio.
 */
export const LEGACY_COMPAT_PROTOCOL_ID: FiscalProtocolId = "rt-text";

export const FISCAL_PROTOCOL_IDS = Object.keys(FISCAL_DIALECTS) as FiscalProtocolId[];

export function getFiscalDialect(id: FiscalProtocolId): FiscalDialectDefinition {
  const dialect = FISCAL_DIALECTS[id];
  if (!dialect) {
    throw new Error(`unknown fiscal dialect: ${id}`);
  }
  return dialect;
}

/** Catalogo per il selettore in Impostazioni: nessun codice di dialetto. */
export function listFiscalProtocolOptions(): FiscalProtocolOption[] {
  return FISCAL_PROTOCOL_IDS.map((id) => fiscalProtocolOptionSchema.parse(FISCAL_DIALECTS[id].toPublicOption()));
}

/** Dialetti che l'admin può davvero selezionare. */
export function selectableFiscalProtocols(): FiscalProtocolOption[] {
  return listFiscalProtocolOptions().filter((option) => option.selectionEnabled);
}

/**
 * Solo i print agent Go possono eseguire i frame del server: il prefisso `go-`
 * distingue l'agente Go dai bridge storici nel browser (stessa convenzione di
 * `print-bridge.repository`, che instrada le aree in base a `version`).
 */
function parseAgentVersion(version: string | null | undefined): number[] | null {
  if (!version || !version.startsWith("go-")) return null;
  const match = /(\d+)\.(\d+)\.(\d+)/.exec(version);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/**
 * Gate a priori: l'agente sa eseguire i frame del dialetto solo da
 * `requiresAgentVersion` in poi. Un agente più vecchio non deve ricevere il
 * job (cadrebbe sull'adattatore storico, con i codici sbagliati per il RT).
 */
export function isAgentVersionSufficient(required: string | null, agentVersion: string | null | undefined): boolean {
  if (required === null) return true;
  const requiredParts = parseAgentVersion(required);
  const agentParts = parseAgentVersion(agentVersion);
  if (requiredParts === null || agentParts === null) return false;
  for (let i = 0; i < 3; i += 1) {
    if (agentParts[i] > requiredParts[i]) return true;
    if (agentParts[i] < requiredParts[i]) return false;
  }
  return true;
}

/** Dialetto effettivo della configurazione del tenant (null = adattatore storico nel binary). */
export function resolveConfiguredDialect(dialectId: FiscalProtocolId | null | undefined): FiscalDialectDefinition | null {
  if (!dialectId) return null;
  return FISCAL_DIALECTS[dialectId] ?? null;
}

export * from "./printf-frame";
export * from "./printf-commands";
export * from "./types";
export * from "./wire";

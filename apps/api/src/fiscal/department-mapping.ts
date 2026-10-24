/**
 * Risoluzione della mappatura reparti per il percorso fiscale.
 *
 * La mappa è **per protocollo** (la numerazione dei reparti cambia da
 * piattaforma a piattaforma) e viene risolta **sul server**, unico posto che
 * compone i comandi: l'agente riceve solo frame già pronti (e, informativamente,
 * il briefing dei reparti nell'heartbeat). Cosi il binary resta senza codici e
 * senza logica fiscale.
 *
 * Regole (condivise con la UI via `@gustopos/shared`):
 *  - categoria mappata → il suo reparto;
 *  - categoria non mappata + reparto di ripiego → ripiego, con avviso;
 *  - categoria non mappata e nessun ripiego → **emissione bloccata** (mai un
 *    corrispettivo con l'aliquota sbagliata).
 */

import {
  defaultFiscalDepartment,
  fiscalDepartmentBriefingSchema,
  fiscalDepartmentMappingHasErrors,
  resolveFiscalDepartment,
  sortFiscalDepartments,
  validateFiscalDepartmentMapping,
  type FiscalDepartment,
  type FiscalDepartmentBriefing,
  type FiscalDepartmentGroup,
  type FiscalProtocolId,
} from "@gustopos/shared";
import type { SaleLine } from "./dialects";

export interface FiscalSaleItemInput {
  name: string;
  quantity: number;
  price: number;
  /** Categoria menu di gustopos: è la chiave della mappatura. */
  categoryId?: string | null;
}

export interface FiscalSaleResolution {
  lines: SaleLine[];
  warnings: string[];
  /** Categorie (o righe senza categoria) che nessun reparto copre. */
  unmappedCategories: string[];
  /** true = c'è almeno una riga senza reparto: non si emette. */
  blocked: boolean;
}

export interface FiscalDepartmentMappingError {
  protocolId: FiscalProtocolId;
  department: number | null;
  message: string;
}

/**
 * Errori che impediscono il salvataggio, con il protocollo a cui appartengono.
 * Funzione pura: la usa il repository prima di persistere (le mappe di **tutti**
 * i protocolli, non solo quello attivo) ed è testata direttamente.
 */
export function departmentMappingErrors(
  mappings: FiscalDepartmentGroup[] | undefined,
): FiscalDepartmentMappingError[] {
  const issues = (mappings ?? []).flatMap((group) =>
    validateFiscalDepartmentMapping(group.departments).map((issue) => ({ ...issue, protocolId: group.protocolId })),
  );
  if (!fiscalDepartmentMappingHasErrors(issues)) return [];
  return issues
    .filter((issue) => issue.level === "error")
    .map((issue) => ({ protocolId: issue.protocolId, department: issue.department, message: issue.message }));
}

/** Reparti configurati per il dialetto attivo (vuoto se il dialetto non è scelto). */
export function departmentsForProtocol(
  mappings: FiscalDepartmentGroup[] | undefined,
  protocolId: FiscalProtocolId | null | undefined,
): FiscalDepartment[] {
  if (!protocolId) return [];
  const group = (mappings ?? []).find((entry) => entry.protocolId === protocolId);
  return group ? sortFiscalDepartments(group.departments) : [];
}

export function resolveFiscalSaleLines(items: FiscalSaleItemInput[], departments: FiscalDepartment[]): FiscalSaleResolution {
  const warnings: string[] = [];
  const lines: SaleLine[] = [];
  const unmapped = new Set<string>();
  const mappedCategories = new Set(departments.flatMap((entry) => entry.categoryIds));

  for (const item of items) {
    const categoryId = item.categoryId ?? null;
    const match = resolveFiscalDepartment(departments, categoryId);
    if (!match.department) {
      unmapped.add(categoryId ?? `(riga senza categoria) ${item.name}`);
      continue;
    }
    if (match.matchedBy === "default" && categoryId && !mappedCategories.has(categoryId)) {
      warnings.push(
        `categoria ${categoryId} non mappata: "${item.name}" finisce sul reparto di ripiego ${match.department.department}`,
      );
    }
    lines.push({
      department: match.department.department,
      amountCents: Math.round(item.price * 100),
      quantity: item.quantity,
      description: item.name,
    });
  }

  return { lines, warnings, unmappedCategories: Array.from(unmapped).sort(), blocked: unmapped.size > 0 };
}

/**
 * Istruzioni per il gate comunicante: cosa deve sapere l'agente sul protocollo
 * attivo e sui reparti. Nessun codice di dialetto: solo il numero di reparto, la
 * sua natura e le categorie che vi confluiscono.
 */
export function buildFiscalDepartmentBriefing(args: {
  protocolId: FiscalProtocolId;
  requiresAgentVersion: string | null;
  departments: FiscalDepartment[];
}): FiscalDepartmentBriefing {
  const departments = sortFiscalDepartments(args.departments);
  const fallback = defaultFiscalDepartment(departments);
  return fiscalDepartmentBriefingSchema.parse({
    protocolId: args.protocolId,
    requiresAgentVersion: args.requiresAgentVersion,
    defaultDepartment: fallback ? fallback.department : null,
    departments,
  });
}

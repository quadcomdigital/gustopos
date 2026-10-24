import type { FiscalDepartment } from "./contracts/fiscal.schema";

/**
 * Regole della mappatura reparti (gustopos → reparto del RT).
 *
 * Vivono nella libreria condivisa perché servono **identiche** ai due lati:
 *  - l'admin UI le usa per validare prima di salvare e per mostrare gli avvisi;
 *  - l'API le usa quando risolve le righe di vendita e compone i frame.
 * Non contengono nessun codice di protocollo (quelli restano in `apps/api`).
 */

export interface FiscalDepartmentIssue {
  level: "error" | "warning";
  /** Reparto a cui si riferisce l'anomalia, quando applicabile. */
  department: number | null;
  message: string;
}

export interface FiscalDepartmentMatch {
  department: FiscalDepartment | null;
  matchedBy: "category" | "default" | null;
}

export function sortFiscalDepartments(departments: FiscalDepartment[]): FiscalDepartment[] {
  return [...departments].sort((a, b) => a.department - b.department);
}

/** Primo numero libero in 1..99 (null quando il RT è pieno). */
export function nextFreeDepartmentNumber(departments: FiscalDepartment[]): number | null {
  const used = new Set(departments.map((entry) => entry.department));
  for (let candidate = 1; candidate <= 99; candidate += 1) {
    if (!used.has(candidate)) return candidate;
  }
  return null;
}

/**
 * Valida la mappatura di **un** protocollo. Gli errori bloccano il salvataggio
 * (una mappa incoerente emetterebbe scontrini con l'aliquota sbagliata); gli
 * avvisi sono operativi e si possono accettare.
 */
export function validateFiscalDepartmentMapping(departments: FiscalDepartment[]): FiscalDepartmentIssue[] {
  const issues: FiscalDepartmentIssue[] = [];
  const seenDepartments = new Set<number>();
  const defaults = departments.filter((entry) => entry.isDefault);
  const categoryOwners = new Map<string, number[]>();

  for (const entry of departments) {
    if (seenDepartments.has(entry.department)) {
      issues.push({ level: "error", department: entry.department, message: `Reparto ${entry.department} duplicato` });
    }
    seenDepartments.add(entry.department);

    if (entry.label.trim() === "") {
      issues.push({
        level: "warning",
        department: entry.department,
        message: `Reparto ${entry.department} senza descrizione: in UI non sarà riconoscibile`,
      });
    }
    if (entry.vatRate === null) {
      issues.push({
        level: "warning",
        department: entry.department,
        message: `Reparto ${entry.department}: aliquota IVA non impostata (va letta dalla programmazione del RT)`,
      });
    }
    if (entry.categoryIds.length === 0 && !entry.isDefault) {
      issues.push({
        level: "warning",
        department: entry.department,
        message: `Reparto ${entry.department} senza categorie: non riceverà nessuna vendita`,
      });
    }
    for (const categoryId of entry.categoryIds) {
      const owners = categoryOwners.get(categoryId) ?? [];
      owners.push(entry.department);
      categoryOwners.set(categoryId, owners);
    }
  }

  if (defaults.length > 1) {
    issues.push({
      level: "error",
      department: null,
      message: `Solo un reparto può essere di ripiego: impostati ${defaults.map((entry) => entry.department).join(", ")}`,
    });
  }

  for (const [categoryId, owners] of categoryOwners) {
    if (owners.length > 1) {
      issues.push({
        level: "error",
        department: null,
        message: `La categoria ${categoryId} è assegnata a più reparti (${owners.join(", ")})`,
      });
    }
  }

  return issues;
}

export function fiscalDepartmentMappingHasErrors(issues: FiscalDepartmentIssue[]): boolean {
  return issues.some((issue) => issue.level === "error");
}

/**
 * Reparto di una categoria: corrispondenza esatta, altrimenti il reparto di
 * ripiego. `matchedBy: null` significa "serve l'intervento dell'operatore"
 * (nessuna corrispondenza e nessun ripiego configurato).
 */
export function resolveFiscalDepartment(
  departments: FiscalDepartment[],
  categoryId: string | null | undefined,
): FiscalDepartmentMatch {
  if (categoryId) {
    const exact = departments.find((entry) => entry.categoryIds.includes(categoryId));
    if (exact) return { department: exact, matchedBy: "category" };
  }
  const fallback = departments.find((entry) => entry.isDefault);
  if (fallback) return { department: fallback, matchedBy: "default" };
  return { department: null, matchedBy: null };
}

/** Reparto di ripiego configurato, se esiste. */
export function defaultFiscalDepartment(departments: FiscalDepartment[]): FiscalDepartment | null {
  return departments.find((entry) => entry.isDefault) ?? null;
}

/**
 * Categorie di vendita che non finiscono su nessun reparto e non hanno un
 * ripiego: sono quelle che **bloccano** l'emissione (meglio un errore chiaro
 * che un corrispettivo con l'aliquota sbagliata).
 */
export function unmappedFiscalCategories(
  departments: FiscalDepartment[],
  categoryIds: string[],
): string[] {
  if (defaultFiscalDepartment(departments) !== null) return [];
  const mapped = new Set(departments.flatMap((entry) => entry.categoryIds));
  return Array.from(new Set(categoryIds.filter((categoryId) => !mapped.has(categoryId)))).sort();
}

/** Riassunto compatto della mappa, per i log di assistenza. */
export function describeFiscalDepartmentMapping(departments: FiscalDepartment[]): string {
  if (departments.length === 0) return "nessun reparto mappato";
  return sortFiscalDepartments(departments)
    .map((entry) => {
      const vat = entry.vatRate === null ? "IVA?" : `IVA ${entry.vatRate}`;
      const kind = entry.kind === "service" ? "servizio" : entry.kind === "good" ? "bene" : "natura?";
      const fallback = entry.isDefault ? ", ripiego" : "";
      return `R${entry.department} (${entry.label || "senza nome"}, ${vat}, ${kind}${fallback}, ${entry.categoryIds.length} categorie)`;
    })
    .join(" | ");
}

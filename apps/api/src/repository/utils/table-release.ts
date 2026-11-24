/**
 * Rilascio di un tavolo dopo l'incasso: unica decisione, condivisa da tutti i
 * flussi (close, settle, pay-items, quote, transfer, annullo ordine).
 *
 * La regola di dominio vive in `@gustopos/shared` (`shouldRetireVirtualTable`):
 * qui si traduce in patch DB. Un conto asporto/consegna che non ha più ordini
 * aperti viene RITIRATO (`is_active=0`), non cancellato: `payments.table_id` è
 * ON DELETE RESTRICT e la riga serve allo storico fiscale. La riga ritirata
 * esce da ogni lettura operativa (`fetchAllData` e `listTables` filtrano
 * `is_active=1`), così i conti chiusi non si accumulano più nello snapshot.
 */

import { shouldRetireVirtualTable } from "@gustopos/shared";

export type TableReleasePatch = {
  retired: boolean;
  patch: {
    status: "free";
    currentOrderId: null;
    isActive?: 0;
  };
};

export function tableReleasePatch(input: {
  isVirtual: boolean;
  hasOpenOrders: boolean;
}): TableReleasePatch {
  const retired = shouldRetireVirtualTable(
    { isVirtual: input.isVirtual },
    input.hasOpenOrders,
  );

  return {
    retired,
    patch: {
      status: "free",
      currentOrderId: null,
      ...(retired ? { isActive: 0 as const } : {}),
    },
  };
}

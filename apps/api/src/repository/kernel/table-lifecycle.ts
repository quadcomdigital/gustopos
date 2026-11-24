/**
 * Ciclo vita del tavolo — helper ATOMICI, da usare solo dentro una tx già
 * aperta (`withTenantTx`). Esistono per eliminare le 9 copie sparse di
 * "libera il tavolo" e le due semantiche diverse (per id vs per numero).
 *
 * Regole:
 *  - occupare = `status='occupied'` + `current_order_id` (anche per la sala:
 *    senza puntatore la guardia di cancellazione tavolo non vedeva il conto);
 *  - liberare = `status='free'` + `current_order_id=null` + retirement dei conti
 *    virtuali senza ordini aperti (`is_active=0`, mai DELETE: FK RESTRICT da
 *    `payments`);
 *  - i conti asporto/consegna vivono su tavoli virtuali con `number = ticket`:
 *    riuso se esiste, creazione se no.
 *
 * Tutte le query sono tenant-scoped. Nessuna scrive fuori dalla tx del
 * chiamante: se il flusso fallisce, tavolo e ordini tornano indietro insieme.
 */

import { and, eq, ne } from "drizzle-orm";
import { sql } from "drizzle-orm";
import type { DbClient } from "../../db/client";
import { orders, tables } from "../../db/schema";
import { tableReleasePatch } from "../utils/table-release";

export type TableRow = typeof tables.$inferSelect;

/** Lock di riga: serializza due incassi concorrenti sullo stesso tavolo. */
export async function lockTableTx(
  tx: DbClient,
  tenantId: string,
  tableId: string,
): Promise<void> {
  await tx.execute(sql`
    SELECT id
    FROM tables
    WHERE tenant_id = ${tenantId} AND id = ${tableId}
    FOR UPDATE
  `);
}

export async function getTableByIdTx(
  tx: DbClient,
  tenantId: string,
  tableId: string,
): Promise<TableRow | null> {
  const rows = await tx
    .select()
    .from(tables)
    .where(and(eq(tables.tenantId, tenantId), eq(tables.id, tableId)))
    .limit(1);
  return rows[0] ?? null;
}

async function hasOpenOrdersOnTable(
  tx: DbClient,
  tenantId: string,
  tableNumber: string,
): Promise<boolean> {
  const rows = await tx
    .select({ id: orders.id })
    .from(orders)
    .where(and(
      eq(orders.tenantId, tenantId),
      eq(orders.tableNumber, tableNumber),
      ne(orders.status, "paid"),
      ne(orders.status, "cancelled"),
    ))
    .limit(1);
  return rows.length > 0;
}

/** Occupa il tavolo puntandolo al conto: un solo update, id-only. */
export async function occupyTableTx(
  tx: DbClient,
  tenantId: string,
  tableId: string,
  orderId: string,
): Promise<void> {
  await tx
    .update(tables)
    .set({ status: "occupied", currentOrderId: orderId })
    .where(and(eq(tables.tenantId, tenantId), eq(tables.id, tableId)));
}

/**
 * Libera il tavolo e — se virtuale senza altri ordini aperti — lo ritira.
 * Rilegge la riga dentro la tx: il chiamante può passare solo l'id.
 */
export async function freeTableTx(
  tx: DbClient,
  tenantId: string,
  tableId: string,
): Promise<{ retired: boolean }> {
  const table = await getTableByIdTx(tx, tenantId, tableId);
  if (!table) return { retired: false };

  const hasOpenOrders = await hasOpenOrdersOnTable(tx, tenantId, table.number);
  const { retired, patch } = tableReleasePatch({
    isVirtual: table.isVirtual === 1,
    hasOpenOrders,
  });

  await tx
    .update(tables)
    .set(patch)
    .where(and(eq(tables.tenantId, tenantId), eq(tables.id, table.id)));

  return { retired };
}

/**
 * Variante per i flussi che conoscono solo il NUMERO (annullo ordine, modifica
 * di un ordine già inviato). No-op se il tavolo non esiste più.
 */
export async function freeTableByNumberTx(
  tx: DbClient,
  tenantId: string,
  tableNumber: string,
): Promise<{ retired: boolean }> {
  const rows = await tx
    .select({ id: tables.id })
    .from(tables)
    .where(and(
      eq(tables.tenantId, tenantId),
      eq(tables.number, tableNumber),
      eq(tables.isActive, 1),
    ))
    .limit(1);
  const table = rows[0];
  if (!table) return { retired: false };
  return freeTableTx(tx, tenantId, table.id);
}

/**
 * Conto asporto/consegna: riusa il tavolo virtuale del numero (aggiunta voci
 * allo stesso conto) o ne apre uno nuovo. Rifiuta un tavolo FISICO con quel
 * numero invece di occuparlo per errore.
 *
 * `reuseExisting: false` per i conti NUOVI generati dal server: il numero
 * ticket non deve mai far fondere due clienti diversi. Il riuso è ammesso solo
 * quando il chiamante ha esplicitamente indicato il conto (`requestedTable`).
 */
export async function openOrReuseVirtualContoTx(
  tx: DbClient,
  tenantId: string,
  tableNumber: string,
  orderId: string,
  options: { reuseExisting?: boolean } = {},
): Promise<TableRow> {
  const reuseExisting = options.reuseExisting !== false;
  const rows = reuseExisting
    ? await tx
        .select()
        .from(tables)
        .where(and(
          eq(tables.tenantId, tenantId),
          eq(tables.number, tableNumber),
          eq(tables.isActive, 1),
        ))
        .limit(1)
    : [];
  const existing = rows[0];

  if (existing) {
    if (existing.isVirtual !== 1) {
      throw new Error(`Table "${tableNumber}" is not an open takeaway/delivery conto`);
    }
    const [updated] = await tx
      .update(tables)
      .set({ status: "occupied", currentOrderId: orderId })
      .where(and(eq(tables.tenantId, tenantId), eq(tables.id, existing.id)))
      .returning();
    return updated ?? existing;
  }

  const [created] = await tx
    .insert(tables)
    .values({
      id: `tbl_${crypto.randomUUID()}`,
      tenantId,
      number: tableNumber,
      status: "occupied",
      currentOrderId: orderId,
      isVirtual: 1,
    })
    .returning();

  // `returning()` non può essere vuoto su un insert riuscito; il fallback serve
  // solo a soddisfare il tipo senza un non-null assertion.
  return created ?? {
    id: "",
    tenantId,
    number: tableNumber,
    status: "occupied",
    currentOrderId: orderId,
    zone: null,
    isVirtual: 1,
    isActive: 1,
  };
}

/**
 * Riconciliazione: ritira i conti virtuali senza ordini aperti. Idempotente,
 * pensata per il job di manutenzione (o per un endpoint admin). Non tocca mai
 * tavoli fisici.
 */
export async function reconcileOrphanVirtualTablesTx(
  tx: DbClient,
  tenantId: string,
): Promise<{ retired: number }> {
  const retired = await tx
    .update(tables)
    .set({ isActive: 0, status: "free", currentOrderId: null })
    .where(and(
      eq(tables.tenantId, tenantId),
      eq(tables.isVirtual, 1),
      eq(tables.isActive, 1),
      sql`NOT EXISTS (
        SELECT 1 FROM orders o
        WHERE o.tenant_id = ${tenantId}
          AND o.table_number = ${tables.number}
          AND o.status NOT IN ('paid', 'cancelled')
      )`,
    ))
    .returning({ id: tables.id });

  return { retired: retired.length };
}

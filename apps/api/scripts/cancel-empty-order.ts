import { and, eq, ne } from "drizzle-orm";
import { db, pool } from "../src/db/client";
import { orderItems, orders, tables } from "../src/db/schema";

/**
 * One-off cleanup for an empty ("ghost") open order: an order with no lines
 * left that still holds its table occupied and can no longer be closed
 * ("No payable balance"). Cancels the order and frees the table when no other
 * open order shares it.
 *
 * Usage:
 *   npx tsx apps/api/scripts/cancel-empty-order.ts [orderId]
 *
 * Default targets the stuck takeaway conto TA-20260922-8394.
 */
const DEFAULT_ORDER_ID = "c75fc671-986e-4444-97a7-fe508a3693ab";

async function main() {
  const orderId = process.argv[2] ?? DEFAULT_ORDER_ID;

  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) {
    throw new Error(`Order ${orderId} not found`);
  }
  if (order.status === "paid" || order.status === "cancelled") {
    console.log(`Order ${orderId} is already "${order.status}"; nothing to do.`);
    await pool.end();
    return;
  }

  const items = await db
    .select({ id: orderItems.id })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));
  if (items.length > 0) {
    throw new Error(`Order ${orderId} still has ${items.length} line(s); refusing to cancel.`);
  }

  await db.update(orders).set({ status: "cancelled" }).where(eq(orders.id, orderId));
  console.log(`Order ${orderId} (table ${order.tableNumber ?? "-"}) -> cancelled`);

  if (order.tableNumber) {
    const otherOpen = await db
      .select({ id: orders.id })
      .from(orders)
      .where(and(
        eq(orders.tenantId, order.tenantId),
        eq(orders.tableNumber, order.tableNumber),
        ne(orders.status, "paid"),
        ne(orders.status, "cancelled"),
      ))
      .limit(1);

    if (otherOpen.length === 0) {
      const freed = await db
        .update(tables)
        .set({ status: "free", currentOrderId: null })
        .where(and(eq(tables.tenantId, order.tenantId), eq(tables.number, order.tableNumber)))
        .returning({ id: tables.id, number: tables.number, status: tables.status });
      console.log("Table freed:", freed);
    } else {
      console.log(`Table ${order.tableNumber} still has other open orders; not freeing.`);
    }
  }

  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

/**
 * Conti già saldati a voci (pay-items) possono restare aperti: incassando le
 * voci il tavolo si libera solo se in quel momento TUTTE le voci sono pagate,
 * quindi basta togliere dal carrello l'ultima voce non pagata per lasciare un
 * ordine `pending` con l'intero importo già incassato. La chiusura a saldo zero
 * deve poter liberare il tavolo senza incassare due volte: qui si calcola se
 * davvero non resta nulla da incassare.
 */

export type SettleOrderItem = {
  id: number;
  quantity: number;
  price: number | string;
};

export type SettlePaymentItem = {
  orderItemId: number;
  quantity: number;
};

export type SettleTotals = {
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
};

const money = (value: number) => Number(value.toFixed(2));

export function computeSettleTotals(
  items: SettleOrderItem[],
  paymentItems: SettlePaymentItem[],
): SettleTotals {
  const priceById = new Map(items.map((item) => [item.id, Number(item.price)]));

  const totalAmount = money(
    items.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0),
  );

  // Quantità pagate oltre la quantità ordinata (voce ridotta dopo l'incasso)
  // non devono gonfiare l'incassato: si conta al massimo la quantità residua.
  const paidQtyById = new Map<number, number>();
  for (const paymentItem of paymentItems) {
    if (!priceById.has(paymentItem.orderItemId)) continue;
    paidQtyById.set(
      paymentItem.orderItemId,
      (paidQtyById.get(paymentItem.orderItemId) ?? 0) + paymentItem.quantity,
    );
  }

  const paidAmount = money(
    items.reduce((sum, item) => {
      const paidQty = Math.min(paidQtyById.get(item.id) ?? 0, item.quantity);
      return sum + Number(item.price) * Math.max(0, paidQty);
    }, 0),
  );

  return {
    totalAmount,
    paidAmount,
    remainingAmount: money(Math.max(0, totalAmount - paidAmount)),
  };
}

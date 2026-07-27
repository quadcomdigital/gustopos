import { ChevronDown, CheckCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useCheckoutStore } from '../../store/checkout-store';
import { useAppStore } from '../../store/app-store';
import { useMemo, useState } from 'react';
import type { OrderItem } from '@gustopos/shared';

export default function CheckoutMainView() {
  const { tableId, tableNumber, paymentStatus, setStep, discountAmount, surchargeAmount, setDiscountAmount, setSurchargeAmount, closeCheckout } = useCheckoutStore();
  const [showAdjustments, setShowAdjustments] = useState(false);
  const data = useAppStore((s) => s.data);

  const modifierOptionById = useMemo(() => {
    if (!data) return new Map<string, { name: string; priceDelta: number }>();
    const map = new Map<string, { name: string; priceDelta: number }>();
    for (const mi of data.menu) {
      for (const group of mi.modifierGroups) {
        for (const opt of group.options) {
          map.set(opt.id, { name: opt.name, priceDelta: opt.priceDelta });
        }
      }
    }
    return map;
  }, [data]);

  if (!data) return null;

  const selectedTable = data.tables.find((t) => t.number === tableNumber);
  const checkoutOrders = selectedTable
    ? data.orders.filter((o) => o.table === selectedTable.number && o.status !== 'paid' && o.status !== 'cancelled')
    : [];
  const checkoutTotal = checkoutOrders.reduce((s, o) => s + o.total, 0);

  const finalTotal = Math.max(0, checkoutTotal - (Number(discountAmount) || 0) + (Number(surchargeAmount) || 0));
  const isFullyPaid = paymentStatus != null && (paymentStatus.remainingAmount ?? 0) <= 0;

  return (
    <div className="p-3 sm:p-4 space-y-4">
      <div className="space-y-3">
        {checkoutOrders.map((order) => (
          <div key={order.id}>
            <div className="flex items-center justify-between text-base font-bold text-text-muted uppercase tracking-widest mb-1">
              <span>Ordine #{order.id.slice(-4)}</span>
              <span>{new Date(order.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <div className="space-y-1">
              {order.items.map((item: OrderItem) => {
                const paidStatus = paymentStatus?.items.find((i: { orderItemId: number }) => i.orderItemId === item.orderItemId);
                const isFullyPaid = paidStatus?.fullyPaid ?? false;
                return (
                  <div key={`${order.id}-${item.id}`} className="py-1.5">
                    <div className={cn("flex justify-between items-start text-base sm:text-lg py-0.5", isFullyPaid && "line-through text-text-muted")}>
                      <span className="text-secondary">
                        <span className="font-bold text-accent mr-1">{item.quantity}x</span>
                        {item.name}
                      </span>
                      <span className="font-bold ml-2 shrink-0">€{(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                    {item.selectedModifiers && item.selectedModifiers.length > 0 && (
                      <div className="pl-5 flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5">
                        {item.selectedModifiers.map((sm) => {
                          const opt = modifierOptionById.get(sm.optionId);
                          if (!opt) return null;
                          return (
                            <span key={sm.optionId} className="text-sm sm:text-base text-text-muted">
                              {opt.name}{opt.priceDelta > 0 ? ` +€${opt.priceDelta.toFixed(2)}` : ''}
                            </span>
                          );
                        })}
                      </div>
                    )}
                    {item.notes && (
                      <p className="text-sm sm:text-base text-text-muted italic pl-5 leading-tight">{item.notes}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-border">
        <button
          onClick={() => setShowAdjustments(!showAdjustments)}
          className="sm:hidden w-full flex items-center justify-between p-3 text-sm font-bold text-text-muted uppercase tracking-widest"
        >
          <span>Regolazioni</span>
          <ChevronDown size={16} className={cn("transition-transform", showAdjustments && "rotate-180")} />
        </button>
        <div className={cn("space-y-2 p-3", !showAdjustments && "max-sm:hidden")}>
          <div className="grid grid-cols-2 gap-2">
            <input
              value={discountAmount}
              onChange={(e) => setDiscountAmount(e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.'))}
              placeholder="Sconto €"
              inputMode="decimal"
              className="px-3 py-2.5 rounded border border-border text-sm min-h-[44px]"
            />
            <input
              value={surchargeAmount}
              onChange={(e) => setSurchargeAmount(e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.'))}
              placeholder="Magg. €"
              inputMode="decimal"
              className="px-3 py-2.5 rounded border border-border text-sm min-h-[44px]"
            />
          </div>
          {(Number(discountAmount) > 0 || Number(surchargeAmount) > 0) && (
            <p className="text-base text-text-muted">
              Totale finale:{' '}
              <strong className="text-primary text-lg">
                €{finalTotal.toFixed(2)}
              </strong>
            </p>
          )}
        </div>
      </div>

      {isFullyPaid ? (
        <div className="border-t border-border p-4 bg-green-50">
          <div className="flex items-center justify-center gap-2">
            <CheckCircle size={22} className="text-green-600 shrink-0" />
            <span className="text-lg font-bold text-green-700">Tutto pagato</span>
          </div>
        </div>
      ) : paymentStatus && paymentStatus.remainingAmount > 0 ? (
        <div className="border-t border-border p-4 bg-bg/30">
          <div className="space-y-2 text-base">
            <div className="flex justify-between">
              <span className="text-text-muted">Totale</span>
              <span className="font-bold">€{paymentStatus.totalAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Pagato</span>
              <span className="font-bold text-green-600">€{paymentStatus.paidAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-2">
              <span className="font-bold">Rimanente</span>
              <span className="font-bold text-primary text-xl">€{paymentStatus.remainingAmount.toFixed(2)}</span>
            </div>
          </div>
        </div>
      ) : null}

      <div className="sticky bottom-0 -mx-3 sm:-mx-4 px-3 sm:px-4 pt-3 pb-1 border-t border-border bg-bg space-y-2">
        {isFullyPaid ? (
          <button
            onClick={() => closeCheckout()}
            className="w-full py-3 min-h-[44px] rounded bg-success text-white text-sm font-bold uppercase tracking-wider hover:bg-green-700 transition-colors"
          >
            Chiudi
          </button>
        ) : (
          <>
            <button
              onClick={() => setStep('split')}
              className="w-full py-3 min-h-[44px] rounded bg-white border-2 border-primary text-primary text-sm font-bold uppercase tracking-wider hover:bg-bg transition-colors"
            >
              Dividi il conto
            </button>
            <button
              onClick={() => setStep('pay_items')}
              className="w-full py-3 min-h-[44px] rounded bg-white border-2 border-primary text-primary text-sm font-bold uppercase tracking-wider hover:bg-bg transition-colors"
            >
              Paga selezione
            </button>
            <button
              onClick={() => setStep('close')}
              className="w-full py-3 min-h-[44px] rounded bg-success text-white text-sm font-bold uppercase tracking-wider hover:bg-green-700 transition-colors"
            >
              Paga tutto
            </button>
          </>
        )}
      </div>
    </div>
  );
}

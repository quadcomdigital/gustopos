import { Minus, Plus, CheckCircle, ArrowLeft } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useCheckoutStore } from '../../store/checkout-store';
import { useAppStore } from '../../store/app-store';
import { useMemo } from 'react';
import SegmentedChips from '../../shared/ui/atoms/SegmentedChips';
import { trackUxMetric } from '../../shared/ux/metrics';
import { formatCurrency } from '@gustopos/shared';
import { buildComponentNameById, buildModifierOptionNameById } from '../../lib/catalog-names';

export default function PayItemsView() {
  const { tableId, paymentStatus, payItemsSelected, payItemsMethod, payItemsGatewayRef, payItemsTendered, updatePayItemQuantity, setPayItemsMethod, setPayItemsGatewayRef, setPayItemsTendered, paySelectedItems, setStep, busy, fiscalEmit, setFiscalEmit, printReceipt, setPrintReceipt } = useCheckoutStore();
  const fiscalModuleEnabled = useAppStore((state) => state.enabledModules.includes('fiscal_exports'));
  const printingModuleEnabled = useAppStore((state) => state.enabledModules.includes('printing'));
  const printing = useAppStore((state) => state.uiSettings?.printing);
  const canToggleReceipt = printingModuleEnabled && printing?.protocol === 'escpos' && printing?.autoPrintOnClose === true;
  const data = useAppStore((s) => s.data);

  const modifierOptionById = useMemo(() => {
    if (!data) return new Map<string, { name: string; priceDelta: number }>();
    const nameById = buildModifierOptionNameById(data, buildComponentNameById(data));
    const map = new Map<string, { name: string; priceDelta: number }>();
    for (const mi of data.menu) {
      for (const group of mi.modifierGroups) {
        for (const opt of group.options) {
          map.set(opt.id, { name: nameById.get(opt.id) ?? opt.name, priceDelta: opt.priceDelta });
        }
      }
    }
    // Category pool options (cmpo_…) are selectable as modifiers too; without
    // this they rendered as raw ids or were dropped entirely.
    for (const pool of data.categoryModifierPools ?? []) {
      for (const opt of pool.options ?? []) {
        if (!map.has(opt.id)) {
          map.set(opt.id, { name: nameById.get(opt.id) ?? opt.name ?? opt.id, priceDelta: opt.priceDelta });
        }
      }
    }
    return map;
  }, [data]);

  const selectedModifiersByOrderItemId = useMemo(() => {
    if (!data) return new Map<number, Array<{ groupId: string; optionId: string }>>();
    const map = new Map<number, Array<{ groupId: string; optionId: string }>>();
    for (const order of data.orders) {
      for (const item of order.items) {
        if (item.orderItemId && item.selectedModifiers && item.selectedModifiers.length > 0) {
          map.set(item.orderItemId, item.selectedModifiers);
        }
      }
    }
    return map;
  }, [data]);

  const selectedTotal = paymentStatus?.items.reduce((sum: number, item: { orderItemId: number; price: number }) => {
    const selected = payItemsSelected.find((s) => s.orderItemId === item.orderItemId);
    if (!selected) return sum;
    return sum + item.price * selected.quantity;
  }, 0) ?? 0;

  const handlePayItems = async () => {
    if (!tableId) return;
    trackUxMetric('pos.checkout.pay_items.confirm');
    await paySelectedItems(tableId);
  };

  const getPayItemQuantity = (orderItemId: number) => {
    return payItemsSelected.find((i) => i.orderItemId === orderItemId)?.quantity ?? 0;
  };

  const allItemsPaid = paymentStatus != null && paymentStatus.items.length > 0 && paymentStatus.items.every((item: { fullyPaid: boolean }) => item.fullyPaid);
  // Residuo tagliato nel carrello: dopo ogni pagamento parziale il totale mostrato
  // è il rimanente (totale - pagato), non più l'importo originario.
  const tenderedNum = payItemsTendered.trim() !== '' && Number.isFinite(Number(payItemsTendered)) ? Number(payItemsTendered) : 0;
  const payChange = tenderedNum > 0 ? Math.max(0, tenderedNum - selectedTotal) : 0;
  const residualAfterPay = paymentStatus ? Math.max(0, Number((paymentStatus.remainingAmount - selectedTotal).toFixed(2))) : 0;

  return (
    <div className="p-3 sm:p-4 space-y-4">
      {paymentStatus && (
        <div className="bg-bg/30 rounded-lg p-3 space-y-1.5 text-base">
          <div className="flex justify-between">
            <span className="text-text-muted">Totale</span>
            <span className="font-bold">{formatCurrency(paymentStatus.totalAmount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">Pagato</span>
            <span className="font-bold text-green-600">{formatCurrency(paymentStatus.paidAmount)}</span>
          </div>
          {paymentStatus.remainingAmount > 0 ? (
            <>
              {paymentStatus.paidAmount > 0 && (
                <div className="flex justify-between">
                  <span className="text-text-muted">Totale residuo</span>
                  <span className="font-bold">{formatCurrency(paymentStatus.remainingAmount)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-border pt-2">
                <span className="font-bold">Rimanente da pagare</span>
                <span className="font-bold text-primary text-xl">{formatCurrency(paymentStatus.remainingAmount)}</span>
              </div>
              {payItemsSelected.length > 0 && (
                <p className="text-sm text-text-muted pt-1">Dopo questo pagamento il residuo sarà <strong className="text-primary">{formatCurrency(residualAfterPay)}</strong></p>
              )}
            </>
          ) : (
            <div className="flex justify-between border-t border-border pt-2">
              <span className="font-bold">Rimanente</span>
              <span className="font-bold text-green-600 text-xl">€0.00</span>
            </div>
          )}
        </div>
      )}

      {allItemsPaid ? (
        <div className="space-y-3">
          <div className="flex items-center justify-center gap-2 p-4 rounded-lg bg-green-50 border border-green-200">
            <CheckCircle size={20} className="text-green-600 shrink-0" />
            <div className="text-center">
              <p className="text-base font-bold text-green-700">Tutti gli item sono stati pagati</p>
              <p className="text-sm text-green-600 mt-0.5">Puoi procedere alla chiusura del conto.</p>
            </div>
          </div>
          <button
            onClick={() => setStep('main')}
            className="w-full py-3 min-h-[44px] rounded bg-primary text-white text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2"
          >
            <ArrowLeft size={16} />
            Torna al checkout
          </button>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            <label className="text-sm font-bold text-text-muted uppercase tracking-widest">Seleziona items</label>
            <div className="space-y-1">
              {paymentStatus?.items.map((item: { orderItemId: number; name: string; price: number; paidQuantity: number; totalQuantity: number; fullyPaid: boolean; availableQuantity: number }) => {
                const selectedQty = getPayItemQuantity(item.orderItemId);
                const isFullyPaid = item.fullyPaid;
                const availableQty = item.availableQuantity;
                return (
                  <div
                    key={item.orderItemId}
                    className={cn(
                      "flex items-center justify-between p-3 rounded border",
                      isFullyPaid ? "bg-bg/50 border-border/50 opacity-50" : "bg-white border-border",
                      selectedQty > 0 && "border-primary bg-primary/5"
                    )}
                  >
                    <div className="flex-1">
                      <div className={cn("text-base sm:text-lg font-medium", isFullyPaid && "line-through")}>
                        {item.name}
                      </div>
                      {selectedModifiersByOrderItemId.has(item.orderItemId) && (
                        <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5">
                          {selectedModifiersByOrderItemId.get(item.orderItemId)!.map((sm) => {
                            const opt = modifierOptionById.get(sm.optionId);
                            if (!opt) return null;
                            return (
                              <span key={sm.optionId} className="text-sm sm:text-base text-text-muted">
                                {opt.name}{opt.priceDelta > 0 ? ` +${formatCurrency(opt.priceDelta)}` : ''}
                              </span>
                            );
                          })}
                        </div>
                      )}
                      <div className="text-sm sm:text-base text-text-muted mt-0.5">
                        {formatCurrency(item.price)} · {item.paidQuantity}/{item.totalQuantity} pagati
                      </div>
                    </div>
                    {!isFullyPaid && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => updatePayItemQuantity(item.orderItemId, Math.max(0, selectedQty - 1))}
                          disabled={selectedQty === 0}
                          className="w-11 h-11 flex items-center justify-center rounded border border-border text-sm font-bold active:bg-bg disabled:opacity-30"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="w-8 text-center text-xs font-bold tabular-nums">{selectedQty}</span>
                        <button
                          onClick={() => updatePayItemQuantity(item.orderItemId, selectedQty + 1)}
                          disabled={selectedQty >= availableQty}
                          className="w-11 h-11 flex items-center justify-center rounded border border-border text-sm font-bold active:bg-bg disabled:opacity-50"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {payItemsSelected.length > 0 && (
            <>
              <div className="flex justify-between text-lg bg-bg/30 rounded-lg p-3">
                <span className="text-text-muted font-medium">Totale selezionato</span>
                <span className="font-bold text-primary">{formatCurrency(selectedTotal)}</span>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-text-muted uppercase tracking-widest">Metodo pagamento</label>
                <SegmentedChips
                  ariaLabel="Metodo pagamento items"
                  value={payItemsMethod}
                  onChange={(value) => setPayItemsMethod(value as any)}
                  options={[
                    { value: 'cash', label: 'Contanti' },
                    { value: 'card', label: 'Carta' },
                    { value: 'mixed', label: 'Misto' },
                  ]}
                  size="md"
                  className="min-h-[44px]"
                />
              </div>

              {(payItemsMethod === 'card' || payItemsMethod === 'mixed') && (
                <>
                  <input
                    value={payItemsGatewayRef}
                    onChange={(e) => setPayItemsGatewayRef(e.target.value)}
                    placeholder="Riferimento transazione POS/PSP"
                    className="w-full px-3 py-2.5 rounded border border-border text-sm min-h-[44px]"
                  />
                  {payItemsGatewayRef.trim().length < 3 && (
                    <p className="text-[11px] text-text-muted">Inserisci il riferimento della transazione (almeno 3 caratteri) per poter incassare.</p>
                  )}
                </>
              )}

              {payItemsMethod === 'cash' && (
                <>
                  <input
                    value={payItemsTendered}
                    onChange={(e) => setPayItemsTendered(e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.'))}
                    placeholder="Contanti consegnati (per il resto)"
                    inputMode="decimal"
                    className="w-full px-3 py-2.5 rounded border border-border text-sm min-h-[44px]"
                  />
                  {tenderedNum > 0 && (
                    <div className="flex justify-between text-base bg-bg/30 rounded-lg p-3">
                      <span className="text-text-muted">Resto</span>
                      <span className="font-bold text-green-600">{formatCurrency(payChange)}</span>
                    </div>
                  )}
                </>
              )}

              <div className="space-y-2">
                {canToggleReceipt && (
                  <button type="button" role="switch" aria-checked={printReceipt} onClick={() => setPrintReceipt(!printReceipt)} className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 min-h-[44px] rounded border text-sm transition-colors ${printReceipt ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-white text-text-muted'}`}>
                    <span className="font-semibold">{printReceipt ? 'Stampa conto in cassa' : 'Non stampare il conto'}</span>
                    <span className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${printReceipt ? 'bg-primary' : 'bg-border'}`}><span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${printReceipt ? 'translate-x-5' : 'translate-x-0.5'}`} /></span>
                  </button>
                )}
                {fiscalModuleEnabled && (
                  <button type="button" role="switch" aria-checked={fiscalEmit} onClick={() => setFiscalEmit(!fiscalEmit)} className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 min-h-[44px] rounded border text-sm transition-colors ${fiscalEmit ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-white text-text-muted'}`}>
                    <span className="font-semibold">{fiscalEmit ? 'Emissione fiscale attiva' : 'Non emettere scontrino fiscale'}</span>
                    <span className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${fiscalEmit ? 'bg-primary' : 'bg-border'}`}><span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${fiscalEmit ? 'translate-x-5' : 'translate-x-0.5'}`} /></span>
                  </button>
                )}
                <p className="text-[11px] text-text-muted">Lo scontrino stampa a ogni pagamento; il fiscale solo quando il conto è completo.</p>
              </div>

              <button
                onClick={handlePayItems}
                disabled={busy || payItemsSelected.length === 0 || ((payItemsMethod === 'card' || payItemsMethod === 'mixed') && payItemsGatewayRef.trim().length < 3)}
                className="w-full py-3 min-h-[44px] rounded bg-primary text-white text-sm font-bold uppercase tracking-wider disabled:opacity-50"
              >
                {busy ? 'Pagamento in corso...' : 'Paga items selezionati'}
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}

import { Minus, Plus, Check, CheckCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useCheckoutStore } from '../../store/checkout-store';
import { useAppStore } from '../../store/app-store';
import SegmentedChips from '../../shared/ui/atoms/SegmentedChips';
import { trackUxMetric } from '../../shared/ux/metrics';

export default function SplitBillView() {
  const { tableId, splitPeople, setSplitPeople, splitShares, initSplit, updateShareMethod, updateShareGatewayRef, markShareAsPaid, busy, error } = useCheckoutStore();
  const data = useAppStore((s) => s.data);

  if (!data) return null;

  const selectedTable = data.tables.find((t) => t.id === tableId);
  const checkoutOrders = selectedTable
    ? data.orders.filter((o) => o.table === selectedTable.number && o.status !== 'paid' && o.status !== 'cancelled')
    : [];
  const checkoutTotal = checkoutOrders.reduce((s, o) => s + o.total, 0);

  const allSharesPaid = splitShares.length > 0 && splitShares.every((s) => s.isPaid);

  const handleInitSplit = async () => {
    trackUxMetric('pos.checkout.split.init');
    await initSplit(splitPeople, checkoutTotal);
  };

  const handleMarkSharePaid = async (shareIndex: number) => {
    trackUxMetric('pos.checkout.split.mark_paid');
    await markShareAsPaid(shareIndex);
  };

  return (
    <div className="p-3 sm:p-4 space-y-4">
      <div className="bg-bg/30 rounded-lg p-3 space-y-2">
        <div className="flex justify-between text-lg">
          <span className="text-text-muted">Totale</span>
          <span className="font-bold">€{checkoutTotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-lg">
          <span className="text-text-muted">Persone</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSplitPeople(Math.max(2, splitPeople - 1))}
              className="w-11 h-11 flex items-center justify-center rounded border border-border text-xl font-bold active:bg-bg"
            >
              <Minus size={18} />
            </button>
            <span className="w-8 text-center text-lg font-bold tabular-nums">{splitPeople}</span>
            <button
              onClick={() => setSplitPeople(Math.min(20, splitPeople + 1))}
              className="w-11 h-11 flex items-center justify-center rounded border border-border text-xl font-bold active:bg-bg"
            >
              <Plus size={18} />
            </button>
          </div>
        </div>
        <div className="flex justify-between text-lg border-t border-border pt-2">
          <span className="font-bold">Quota per persona</span>
          <span className="font-bold text-primary text-2xl">€{(checkoutTotal / splitPeople).toFixed(2)}</span>
        </div>
      </div>

      {splitShares.length === 0 ? (
        <button
          onClick={handleInitSplit}
          disabled={busy}
          className="w-full py-3 min-h-[44px] rounded bg-primary text-white text-sm font-bold uppercase tracking-wider disabled:opacity-50"
        >
          {busy ? 'Inizializzazione...' : 'Dividi'}
        </button>
      ) : (
        <div className="space-y-2">
          <label className="text-sm font-bold text-text-muted uppercase tracking-widest">
            Quote ({splitShares.filter((s) => s.isPaid).length}/{splitShares.length} pagate)
          </label>
          {splitShares.map((share) => (
            <div
              key={share.shareIndex}
              className={cn(
                "p-3 rounded-lg border-2",
                share.isPaid ? "border-green-500 bg-green-50" : "border-border bg-white"
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold">Persona {share.shareIndex + 1}</span>
                  {share.isPaid && <Check size={18} className="text-green-600" />}
                </div>
                <span className="text-lg font-bold text-primary">€{share.amount.toFixed(2)}</span>
              </div>

              {!share.isPaid && (
                <div className="space-y-2">
                  <SegmentedChips
                    ariaLabel={`Metodo pagamento persona ${share.shareIndex + 1}`}
                    value={share.method}
                    onChange={(value) => updateShareMethod(share.shareIndex, value as any)}
                    options={[
                      { value: 'cash', label: 'Contanti' },
                      { value: 'card', label: 'Carta' },
                      { value: 'mixed', label: 'Misto' },
                    ]}
                    size="sm"
                  />

                  {(share.method === 'card' || share.method === 'mixed') && (
                    <input
                      value={share.gatewayReference}
                      onChange={(e) => updateShareGatewayRef(share.shareIndex, e.target.value)}
                      placeholder="Riferimento transazione POS/PSP"
                      className="w-full px-3 py-2.5 rounded border border-border text-sm min-h-[44px]"
                    />
                  )}

                  <button
                    onClick={() => handleMarkSharePaid(share.shareIndex)}
                    disabled={busy || ((share.method === 'card' || share.method === 'mixed') && share.gatewayReference.trim().length < 3)}
                    className="w-full py-2 min-h-[44px] rounded bg-success text-white text-sm font-bold uppercase tracking-wider disabled:opacity-50"
                  >
                    {busy ? 'In corso...' : 'Segna come pagato'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {allSharesPaid && (
        <div className="flex items-center justify-center gap-2 p-4 rounded-lg bg-green-50 border border-green-200">
          <CheckCircle size={20} className="text-green-600 shrink-0" />
          <span className="text-base font-bold text-green-700">Tutte le quote pagate — chiusura in corso...</span>
        </div>
      )}

      {error && <p className="text-sm text-danger text-center font-semibold">{error}</p>}
    </div>
  );
}

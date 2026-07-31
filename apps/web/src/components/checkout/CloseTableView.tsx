import { useState } from 'react';
import { CheckCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useCheckoutStore } from '../../store/checkout-store';
import SegmentedChips from '../../shared/ui/atoms/SegmentedChips';
import ConfirmDialog from '../ConfirmDialog';
import { trackUxMetric } from '../../shared/ux/metrics';

export default function CloseTableView() {
  const { tableId, paymentStatus, closeMethod, paidAmount, gatewayReference, setCloseMethod, setPaidAmount, setGatewayReference, closeTable, busy, error } = useCheckoutStore();
  const [showConfirm, setShowConfirm] = useState(false);

  const handlePay = async () => {
    if (!tableId) return;
    trackUxMetric('pos.checkout.close.confirm');
    await closeTable(tableId);
  };

  const remainingAmount = paymentStatus?.remainingAmount ?? 0;
  const isFullyPaid = paymentStatus != null && remainingAmount <= 0;

  return (
    <form onSubmit={(e) => { e.preventDefault(); setShowConfirm(true); }} className="p-3 sm:p-4 space-y-4">
      {isFullyPaid && (
        <div className="flex items-center justify-center gap-2 p-4 rounded-lg bg-green-50 border border-green-200">
          <CheckCircle size={20} className="text-green-600 shrink-0" />
          <div className="text-center">
            <p className="text-base font-bold text-green-700">Conto già saldato</p>
            <p className="text-sm text-green-600 mt-0.5">Tutti gli item sono stati pagati.</p>
          </div>
        </div>
      )}

      {paymentStatus && (
        <div className="bg-bg/30 rounded-lg p-3 space-y-2">
          <div className="flex justify-between text-lg">
            <span className="text-text-muted">Totale</span>
            <span className="font-bold">€{paymentStatus.totalAmount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-lg">
            <span className="text-text-muted">Pagato</span>
            <span className="font-bold text-green-600">€{paymentStatus.paidAmount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-lg border-t border-border pt-2">
            <span className="font-bold">Rimanente</span>
            <span className={cn("font-bold text-2xl", remainingAmount > 0 ? "text-primary" : "text-green-600")}>€{remainingAmount.toFixed(2)}</span>
          </div>
        </div>
      )}

      {!isFullyPaid && (
        <>
          <div className="space-y-2">
            <label className="text-sm font-bold text-text-muted uppercase tracking-widest">Metodo pagamento</label>
            <SegmentedChips
              ariaLabel="Metodo pagamento chiusura"
              value={closeMethod}
              onChange={(value) => setCloseMethod(value as any)}
              options={[
                { value: 'cash', label: 'Contanti' },
                { value: 'card', label: 'Carta' },
                { value: 'mixed', label: 'Misto' },
              ]}
              size="md"
              className="min-h-[44px]"
            />
          </div>

          <input
            value={paidAmount}
            onChange={(e) => setPaidAmount(e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.'))}
            placeholder="Importo incassato (opzionale)"
            inputMode="decimal"
            className="w-full px-3 py-2.5 rounded border border-border text-sm min-h-[44px]"
          />

          {Number(paidAmount) > 0 && (
            <div className="flex justify-between text-base bg-bg/30 rounded-lg p-3">
              <span className="text-text-muted">Resto</span>
              <span className="font-bold text-green-600">
                €{Math.max(0, Number(paidAmount) - remainingAmount).toFixed(2)}
              </span>
            </div>
          )}

          {(closeMethod === 'card' || closeMethod === 'mixed') && (
            <input
              value={gatewayReference}
              onChange={(e) => setGatewayReference(e.target.value)}
              placeholder="Riferimento transazione POS/PSP"
              className="w-full px-3 py-2.5 rounded border border-border text-sm min-h-[44px]"
            />
          )}

          {error && <p className="text-sm text-danger text-center font-semibold">{error}</p>}

          <button
            type="submit"
            disabled={busy || ((closeMethod === 'card' || closeMethod === 'mixed') && gatewayReference.trim().length < 3)}
            className="w-full py-3 min-h-[44px] rounded bg-success text-white text-sm font-bold uppercase tracking-wider disabled:opacity-50"
          >
            {busy ? 'Chiusura in corso...' : 'Conferma e chiudi'}
          </button>
        </>
      )}

      <ConfirmDialog
        open={showConfirm}
        title="Chiudi conto?"
        message={`Confermare la chiusura del conto con metodo ${closeMethod === 'cash' ? 'contanti' : closeMethod === 'card' ? 'carta' : 'misto'}? L'azione non può essere annullata.`}
        confirmLabel="Chiudi"
        onConfirm={() => {
          setShowConfirm(false);
          void handlePay();
        }}
        onCancel={() => setShowConfirm(false)}
      />
    </form>
  );
}

import { useState } from 'react';
import { CheckCircle, Unlock } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useCheckoutStore } from '../../store/checkout-store';
import { useAppStore } from '../../store/app-store';
import SegmentedChips from '../../shared/ui/atoms/SegmentedChips';
import ConfirmDialog from '../ConfirmDialog';
import { trackUxMetric } from '../../shared/ux/metrics';
import { formatCurrency } from '@gustopos/shared';

export default function CloseTableView() {
  const {
    tableId,
    paymentStatus,
    closeMethod,
    paidAmount,
    gatewayReference,
    fiscalEmit,
    setCloseMethod,
    setPaidAmount,
    setGatewayReference,
    setFiscalEmit,
    printReceipt,
    setPrintReceipt,
    closeTable,
    busy,
  } = useCheckoutStore();
  // Certified fiscal (Path B) is opt-in per transaction and only offered when
  // the tenant has the fiscal_exports module enabled.
  const fiscalModuleEnabled = useAppStore((state) => state.enabledModules.includes('fiscal_exports'));
  // Cashier close receipt can be skipped per transaction. Offered only when the
  // close would actually print (printing module on + escpos + autoPrintOnClose).
  const printingModuleEnabled = useAppStore((state) => state.enabledModules.includes('printing'));
  const printing = useAppStore((state) => state.uiSettings?.printing);
  const canToggleReceipt =
    printingModuleEnabled && printing?.protocol === 'escpos' && printing?.autoPrintOnClose === true;
  const [showConfirm, setShowConfirm] = useState(false);
  // Chiusura a saldo zero: la cassa non incassa nulla (ogni voce è già stata
  // pagata via pay-items), ma il tavolo è rimasto occupato — per esempio
  // perché l'ultima voce non pagata è stata tolta dal carrello dopo l'incasso.
  const [settling, setSettling] = useState(false);
  const [settleError, setSettleError] = useState('');
  const [showSettleConfirm, setShowSettleConfirm] = useState(false);

  const handlePay = async () => {
    if (!tableId) return;
    trackUxMetric('pos.checkout.close.confirm');
    await closeTable(tableId);
  };

  const handleSettle = async () => {
    if (!tableId) return;
    setShowSettleConfirm(false);
    setSettleError('');
    setSettling(true);
    try {
      await useAppStore.getState().settleTable(tableId);
      useCheckoutStore.getState().closeCheckout();
    } catch (error) {
      setSettleError(error instanceof Error ? error.message : 'Chiusura del tavolo non riuscita');
    } finally {
      setSettling(false);
    }
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
            <span className="font-bold">{formatCurrency(paymentStatus.totalAmount)}</span>
          </div>
          <div className="flex justify-between text-lg">
            <span className="text-text-muted">Pagato</span>
            <span className="font-bold text-green-600">{formatCurrency(paymentStatus.paidAmount)}</span>
          </div>
          <div className="flex justify-between text-lg border-t border-border pt-2">
            <span className="font-bold">Rimanente</span>
            <span className={cn("font-bold text-2xl", remainingAmount > 0 ? "text-primary" : "text-green-600")}>{formatCurrency(remainingAmount)}</span>
          </div>
        </div>
      )}

      {isFullyPaid && (
        <>
          <button
            type="button"
            onClick={() => setShowSettleConfirm(true)}
            disabled={busy || settling}
            className="w-full flex items-center justify-center gap-2 py-3 min-h-[44px] rounded bg-success text-white text-sm font-bold uppercase tracking-wider disabled:opacity-50"
          >
            <Unlock size={16} />
            {settling ? 'Chiusura in corso...' : 'Libera il tavolo'}
          </button>
          {settleError && (
            <p className="text-xs text-danger font-semibold text-center" role="alert">
              {settleError}
            </p>
          )}
          <p className="text-[11px] text-text-muted text-center">
            Nessun nuovo incasso e nessuno scontrino: gli ordini aperti risultano pagati e il tavolo torna libero.
          </p>
        </>
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
                {formatCurrency(Math.max(0, Number(paidAmount) - remainingAmount))}
              </span>
            </div>
          )}

          {(closeMethod === 'card' || closeMethod === 'mixed') && (
            <>
              <input
                value={gatewayReference}
                onChange={(e) => setGatewayReference(e.target.value)}
                placeholder="Riferimento transazione POS/PSP"
                className="w-full px-3 py-2.5 rounded border border-border text-sm min-h-[44px]"
              />
              {gatewayReference.trim().length < 3 && (
                <p className="text-[11px] text-text-muted">Inserisci il riferimento della transazione (almeno 3 caratteri) per poter chiudere.</p>
              )}
            </>
          )}

          {canToggleReceipt && (
          <div className="space-y-2">
            <label className="text-sm font-bold text-text-muted uppercase tracking-widest">Stampa conto</label>
            <button
              type="button"
              role="switch"
              aria-checked={printReceipt}
              onClick={() => setPrintReceipt(!printReceipt)}
              className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 min-h-[44px] rounded border text-sm transition-colors ${
                printReceipt ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-white text-text-muted'
              }`}
            >
              <span className="font-semibold">{printReceipt ? 'Stampa conto in cassa' : 'Non stampare il conto'}</span>
              <span
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                  printReceipt ? 'bg-primary' : 'bg-border'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                    printReceipt ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </span>
            </button>
            <p className="text-[11px] text-text-muted">
              Se disattivo, alla chiusura il conto non viene stampato dalla stampante di cassa.
            </p>
          </div>
          )}

          {fiscalModuleEnabled && (
          <div className="space-y-2">
            <label className="text-sm font-bold text-text-muted uppercase tracking-widest">Scontrino fiscale</label>
            <button
              type="button"
              role="switch"
              aria-checked={fiscalEmit}
              onClick={() => setFiscalEmit(!fiscalEmit)}
              className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 min-h-[44px] rounded border text-sm transition-colors ${
                fiscalEmit ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-white text-text-muted'
              }`}
            >
              <span className="font-semibold">{fiscalEmit ? 'Emissione fiscale attiva' : 'Non emettere scontrino fiscale'}</span>
              <span
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                  fiscalEmit ? 'bg-primary' : 'bg-border'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                    fiscalEmit ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </span>
            </button>
            <p className="text-[11px] text-text-muted">
              Se attivo, alla chiusura viene emesso lo scontrino dal registratore telematico (se configurato).
            </p>
          </div>
          )}

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
        open={showSettleConfirm}
        title="Liberare il tavolo?"
        message="Il conto è già interamente pagato: gli ordini aperti verranno marcati come pagati, nessun nuovo incasso e nessuno scontrino verrà creato, e il tavolo tornerà libero. L'azione non può essere annullata."
        confirmLabel="Libera il tavolo"
        onConfirm={() => void handleSettle()}
        onCancel={() => setShowSettleConfirm(false)}
      />

      <ConfirmDialog
        open={showConfirm}
        title="Chiudi conto?"
        message={`Confermare la chiusura del conto con metodo ${closeMethod === 'cash' ? 'contanti' : closeMethod === 'card' ? 'carta' : 'misto'}${fiscalEmit ? ' e emissione dello scontrino fiscale' : ''}${canToggleReceipt && !printReceipt ? ' senza stampa del conto' : ''}? L'azione non può essere annullata.`}
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

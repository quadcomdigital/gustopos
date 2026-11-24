import { Minus, Plus, Check, CheckCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useCheckoutStore } from '../../store/checkout-store';
import { useAppStore } from '../../store/app-store';
import SegmentedChips from '../../shared/ui/atoms/SegmentedChips';
import { trackUxMetric } from '../../shared/ux/metrics';
import { formatCurrency } from '@gustopos/shared';
import { useMemo, useState } from 'react';

export default function SplitBillView() {
  const { tableId, splitPeople, setSplitPeople, splitShares, splitDraft, initSplit, cancelSplit, updateShareMethod, updateShareGatewayRef, updateShareTendered, setSplitDraft, resetSplitDraft, saveSplitShares, markShareAsPaid, paymentStatus, fiscalEmit, setFiscalEmit, printReceipt, setPrintReceipt, busy } = useCheckoutStore();
  const [editing, setEditing] = useState(false);
  const fiscalModuleEnabled = useAppStore((state) => state.enabledModules.includes('fiscal_exports'));
  const printingModuleEnabled = useAppStore((state) => state.enabledModules.includes('printing'));
  const printing = useAppStore((state) => state.uiSettings?.printing);
  const canToggleReceipt = printingModuleEnabled && printing?.protocol === 'escpos' && printing?.autoPrintOnClose === true;
  const draftSum = useMemo(() => {
    const pending = splitShares.filter((s) => !s.isPaid).sort((a, b) => a.shareIndex - b.shareIndex);
    return pending.reduce((sum, s) => {
      const raw = splitDraft[s.shareIndex];
      const v = raw !== undefined && raw.trim() !== '' ? Number(raw) : s.amount;
      return sum + (Number.isFinite(v) ? v : 0);
    }, 0);
  }, [splitShares, splitDraft]);
  const pendingSum = useMemo(() => splitShares.filter((s) => !s.isPaid).reduce((sum, s) => sum + s.amount, 0), [splitShares]);
  const pendingDraftDirty = Object.keys(splitDraft).length > 0;
  const remainingSplit = paymentStatus?.splitShares?.filter((s) => !s.isPaid).reduce((sum, s) => sum + s.amount, 0) ?? 0;
  const paidSplitTotal = (paymentStatus?.splitShares ?? []).filter((s) => s.isPaid).reduce((sum, s) => sum + s.amount, 0);
  const draftBalanced = Math.abs(draftSum - pendingSum) <= 0.01;
  const hasCaptured = splitShares.some((s) => s.isPaid);
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
    await initSplit(splitPeople);
  };

  const handleCancelSplit = async () => {
    trackUxMetric('pos.checkout.split.cancel');
    await cancelSplit();
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
          <span className="font-bold">{formatCurrency(checkoutTotal)}</span>
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
          <span className="font-bold text-primary text-2xl">{formatCurrency((checkoutTotal / splitPeople))}</span>
        </div>
        {splitShares.length > 0 && (
          <>
            <div className="flex justify-between text-base">
              <span className="text-text-muted">Già incassato (quote)</span>
              <span className="font-bold text-green-600">{formatCurrency(paidSplitTotal)}</span>
            </div>
            <div className="flex justify-between text-base">
              <span className="text-text-muted">Rimanente quote</span>
              <span className="font-bold text-primary">{formatCurrency((remainingSplit || pendingSum))}</span>
            </div>
          </>
        )}
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
          {splitShares.map((share) => {
            const draftRaw = splitDraft[share.shareIndex];
            const draftVal = draftRaw !== undefined && draftRaw.trim() !== '' ? Number(draftRaw) : share.amount;
            const tenderedNum = share.tendered.trim() !== '' && Number.isFinite(Number(share.tendered)) ? Number(share.tendered) : 0;
            const resto = tenderedNum > 0 ? Math.max(0, tenderedNum - (editing ? draftVal : share.amount)) : 0;
            const amountShown = editing && !share.isPaid ? (draftRaw ?? String(share.amount)) : null;
            return (
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
                {amountShown !== null ? (
                  <input
                    value={amountShown}
                    onChange={(e) => setSplitDraft(share.shareIndex, e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.'))}
                    inputMode="decimal"
                    aria-label={`Importo quota persona ${share.shareIndex + 1}`}
                    className="w-28 px-2 py-1 text-right text-lg font-bold text-primary rounded border border-border min-h-[44px]"
                  />
                ) : (
                  <span className="text-lg font-bold text-primary">{formatCurrency(share.amount)}</span>
                )}
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
                    <>
                      <input
                        value={share.gatewayReference}
                        onChange={(e) => updateShareGatewayRef(share.shareIndex, e.target.value)}
                        placeholder="Riferimento transazione POS/PSP"
                        className="w-full px-3 py-2.5 rounded border border-border text-sm min-h-[44px]"
                      />
                      {share.gatewayReference.trim().length < 3 && (
                        <p className="text-[11px] text-text-muted">Inserisci il riferimento della transazione (almeno 3 caratteri) per poter incassare questa quota.</p>
                      )}
                    </>
                  )}

                  {share.method === 'cash' && (
                    <>
                      <input
                        value={share.tendered}
                        onChange={(e) => updateShareTendered(share.shareIndex, e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.'))}
                        placeholder="Contanti consegnati (per il resto)"
                        inputMode="decimal"
                        className="w-full px-3 py-2.5 rounded border border-border text-sm min-h-[44px]"
                      />
                      {tenderedNum > 0 && (
                        <div className="flex justify-between text-base bg-bg/30 rounded-lg p-2">
                          <span className="text-text-muted">Resto</span>
                          <span className="font-bold text-green-600">{formatCurrency(resto)}</span>
                        </div>
                      )}
                    </>
                  )}

                  <button
                    onClick={() => handleMarkSharePaid(share.shareIndex)}
                    disabled={busy || (editing && pendingDraftDirty) || ((share.method === 'card' || share.method === 'mixed') && share.gatewayReference.trim().length < 3) || (share.tendered.trim() !== '' && Number.isFinite(Number(share.tendered)) && Number(share.tendered) + 0.005 < share.amount)}
                    className="w-full py-2 min-h-[44px] rounded bg-success text-white text-sm font-bold uppercase tracking-wider disabled:opacity-50"
                  >
                    {busy ? 'In corso...' : 'Segna come pagato'}
                  </button>
                </div>
              )}
            </div>
            );
          })}
          {hasCaptured && (
            <p className="rounded-lg border border-warning-300 bg-warning-50 p-3 text-xs font-semibold text-warning-800" role="status">
              Una quota è già stata incassata: le quote non si possono più modificare né la divisione annullare. Completa le quote rimaste per chiudere il tavolo.
            </p>
          )}
          {!hasCaptured && (
            <>
              <div className="flex gap-2">
                <button
                  onClick={() => { if (editing) { resetSplitDraft(); setEditing(false); } else { setEditing(true); } }}
                  disabled={busy}
                  className="flex-1 py-2 min-h-[44px] rounded border border-border text-sm font-bold text-text-muted uppercase tracking-wider disabled:opacity-50"
                >
                  {editing ? 'Annulla modifica' : 'Modifica quote'}
                </button>
                {editing && (
                  <button
                    onClick={async () => { await saveSplitShares(); setEditing(false); }}
                    disabled={busy || !pendingDraftDirty || !draftBalanced}
                    className="flex-1 py-2 min-h-[44px] rounded bg-primary text-white text-sm font-bold uppercase tracking-wider disabled:opacity-50"
                  >
                    {busy ? 'Salvataggio...' : 'Salva quote'}
                  </button>
                )}
              </div>
              {editing && (
                <p className={cn("text-sm text-center font-semibold", draftBalanced ? "text-green-600" : "text-danger")}>
                  {draftBalanced ? `Somma ${formatCurrency(draftSum)} ok` : `Somma ${formatCurrency(draftSum)} \u2260 ${formatCurrency(pendingSum)}`}
                </p>
              )}
            </>
          )}
        </div>
      )}

      {splitShares.length > 0 && (
        <div className="space-y-2">
          {canToggleReceipt && (
            <button type="button" role="switch" aria-checked={printReceipt} onClick={() => setPrintReceipt(!printReceipt)} className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 min-h-[44px] rounded border text-sm transition-colors ${printReceipt ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-white text-text-muted'}`}>
              <span className="font-semibold">{printReceipt ? 'Stampa conto in cassa (ultima quota)' : 'Non stampare il conto'}</span>
              <span className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${printReceipt ? 'bg-primary' : 'bg-border'}`}><span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${printReceipt ? 'translate-x-5' : 'translate-x-0.5'}`} /></span>
            </button>
          )}
          {fiscalModuleEnabled && (
            <button type="button" role="switch" aria-checked={fiscalEmit} onClick={() => setFiscalEmit(!fiscalEmit)} className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 min-h-[44px] rounded border text-sm transition-colors ${fiscalEmit ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-white text-text-muted'}`}>
              <span className="font-semibold">{fiscalEmit ? 'Emissione fiscale attiva' : 'Non emettere scontrino fiscale'}</span>
              <span className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${fiscalEmit ? 'bg-primary' : 'bg-border'}`}><span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${fiscalEmit ? 'translate-x-5' : 'translate-x-0.5'}`} /></span>
            </button>
          )}
        </div>
      )}

      {splitShares.length > 0 && splitShares.every((s) => !s.isPaid) && (
        <button
          onClick={handleCancelSplit}
          disabled={busy}
          className="w-full py-2 min-h-[44px] rounded border border-border text-sm font-bold text-text-muted uppercase tracking-wider disabled:opacity-50"
        >
          Annulla divisione
        </button>
      )}

      {allSharesPaid && (
        <div className="flex items-center justify-center gap-2 p-4 rounded-lg bg-green-50 border border-green-200">
          <CheckCircle size={20} className="text-green-600 shrink-0" />
          <span className="text-base font-bold text-green-700">Tutte le quote pagate — chiusura in corso...</span>
        </div>
      )}

    </div>
  );
}

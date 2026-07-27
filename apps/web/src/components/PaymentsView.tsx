import { useMemo, useState } from 'react';
import type { Payment, PaymentKind, PaymentMethod, RefundPaymentResponse } from '@gustopos/shared';
import { Filter, RotateCcw } from 'lucide-react';
import { usePermission } from '../shared/authz/usePermission';
import ConfirmDialog from './ConfirmDialog';

interface PaymentsViewProps {
  payments: Payment[];
  onRefresh: (filters?: {
    kind?: PaymentKind;
    method?: PaymentMethod;
    staffId?: string;
    from?: string;
    to?: string;
  }) => Promise<void>;
  onRefund: (id: string, payload: { amount?: number; reason: string; notes?: string }) => Promise<RefundPaymentResponse>;
}

export default function PaymentsView({ payments, onRefresh, onRefund }: PaymentsViewProps) {
  const { can } = usePermission();
  const canRefund = can('paymentsRefund');
  const [kind, setKind] = useState<'' | PaymentKind>('');
  const [method, setMethod] = useState<'' | PaymentMethod>('');
  const [staffId, setStaffId] = useState('');
  const [refundTargetId, setRefundTargetId] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [refundNotes, setRefundNotes] = useState('');
  const [refundMessage, setRefundMessage] = useState('');
  const [confirmRefundOpen, setConfirmRefundOpen] = useState(false);
  const [refunding, setRefunding] = useState(false);

  const runRefund = async () => {
    const amount = refundAmount.trim().length > 0 ? Number(refundAmount) : undefined;
    setRefunding(true);
    try {
      const result = await onRefund(refundTargetId.trim(), {
        ...(amount !== undefined && Number.isFinite(amount) ? { amount } : {}),
        reason: refundReason.trim(),
        ...(refundNotes.trim().length > 0 ? { notes: refundNotes.trim() } : {}),
      });
      setRefundMessage(
        `Rimborso creato: ${result.payment.id} - rimborsati €${result.refundedAmount.toFixed(2)} (residuo €${result.remainingAmount.toFixed(2)})`,
      );
      setRefundAmount('');
      setRefundReason('');
      setRefundNotes('');
      await onRefresh({ kind: kind || undefined, method: method || undefined, staffId: staffId || undefined });
    } catch (error) {
      setRefundMessage(error instanceof Error ? error.message : 'Refund fallito');
    } finally {
      setRefunding(false);
    }
  };

  const totals = useMemo(() => {
    type Totals = { total: number; discount: number; surcharge: number };
    return payments.reduce(
      (acc: Totals, payment) => ({
        total: acc.total + payment.total,
        discount: acc.discount + payment.discountAmount,
        surcharge: acc.surcharge + payment.surchargeAmount,
      }),
      { total: 0, discount: 0, surcharge: 0 } as Totals,
    );
  }, [payments]);

  return (
    <div className="h-full flex flex-col gap-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-primary tracking-tight uppercase">Storico Pagamenti</h2>
          <p className="text-text-muted text-sm font-medium">Vista amministrativa incassi e breakdown</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() =>
              void onRefresh({
                kind: kind || undefined,
                method: method || undefined,
                staffId: staffId || undefined,
              })
            }
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-xs font-bold uppercase tracking-wider hover:bg-bg"
          >
            <Filter size={14} />
            Filtra
          </button>
          <button
            onClick={() => {
              setKind('');
              setMethod('');
              setStaffId('');
              void onRefresh();
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-xs font-bold uppercase tracking-wider hover:bg-bg"
          >
            <RotateCcw size={14} />
            Reset
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-border rounded-xl p-4">
          <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Totale incassato</p>
          <p className="text-2xl font-bold text-primary mt-2">€{totals.total.toFixed(2)}</p>
        </div>
        <div className="bg-white border border-border rounded-xl p-4">
          <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Sconti applicati</p>
          <p className="text-2xl font-bold text-danger mt-2">€{totals.discount.toFixed(2)}</p>
        </div>
        <div className="bg-white border border-border rounded-xl p-4">
          <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Maggiorazioni</p>
          <p className="text-2xl font-bold text-success mt-2">€{totals.surcharge.toFixed(2)}</p>
        </div>
      </div>

      <div className="bg-white border border-border rounded-xl p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        <select
          value={kind}
          onChange={(e) => setKind((e.target.value as PaymentKind) || '')}
          className="px-3 py-2 rounded-lg border border-border text-sm"
        >
          <option value="">Tutti i tipi</option>
          <option value="sale">Vendite</option>
          <option value="refund">Rimborsi</option>
        </select>
        <select
          value={method}
          onChange={(e) => setMethod((e.target.value as PaymentMethod) || '')}
          className="px-3 py-2 rounded-lg border border-border text-sm"
        >
          <option value="">Tutti i metodi</option>
          <option value="cash">Contanti</option>
          <option value="card">Carta</option>
          <option value="mixed">Misto</option>
        </select>
        <input
          value={staffId}
          onChange={(e) => setStaffId(e.target.value)}
          placeholder="Filtra per Staff ID"
          className="px-3 py-2 rounded-lg border border-border text-sm"
        />
      </div>

      {canRefund && (
      <div className="bg-white border border-border rounded-xl p-4 space-y-3">
        <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Rimborso pagamento</p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            value={refundTargetId}
            onChange={(e) => setRefundTargetId(e.target.value)}
            placeholder="ID pagamento"
            className="px-3 py-2 rounded-lg border border-border text-sm"
          />
          <input
            value={refundAmount}
            onChange={(e) => setRefundAmount(e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.'))}
            placeholder="Importo (opzionale)"
            className="px-3 py-2 rounded-lg border border-border text-sm"
          />
          <input
            value={refundReason}
            onChange={(e) => setRefundReason(e.target.value)}
            placeholder="Motivazione obbligatoria"
            className="px-3 py-2 rounded-lg border border-border text-sm"
          />
          <input
            value={refundNotes}
            onChange={(e) => setRefundNotes(e.target.value)}
            placeholder="Note (opzionale)"
            className="px-3 py-2 rounded-lg border border-border text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setConfirmRefundOpen(true)}
            disabled={refunding || !refundTargetId.trim() || refundReason.trim().length < 3}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-xs font-bold uppercase tracking-wider"
          >
            {refunding ? 'Rimborso...' : 'Esegui rimborso'}
          </button>
          {refundMessage && <span className="text-xs text-text-muted">{refundMessage}</span>}
        </div>
      </div>
      )}

      <div className="bg-white border border-border rounded-xl p-4 overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-text-muted border-b border-border">
              <th className="py-2">Quando</th>
              <th className="py-2 hidden lg:table-cell">Tavolo</th>
              <th className="py-2">Metodo</th>
              <th className="py-2">Tipo</th>
              <th className="py-2 hidden md:table-cell">Subtotale</th>
              <th className="py-2 hidden md:table-cell">Sconto</th>
              <th className="py-2 hidden md:table-cell">Maggiorazione</th>
              <th className="py-2">Totale</th>
              <th className="py-2 hidden lg:table-cell">Incassato</th>
              <th className="py-2 hidden lg:table-cell">Resto</th>
              <th className="py-2 hidden xl:table-cell">Riferimento</th>
              <th className="py-2 hidden xl:table-cell">Motivo rimborso</th>
              <th className="py-2 hidden xl:table-cell">Staff</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((payment) => (
              <tr key={payment.id} className="border-b border-border/60">
                <td className="py-2">{new Date(payment.createdAt).toLocaleString()}</td>
                <td className="py-2 hidden lg:table-cell">{payment.tableNumber}</td>
                <td className="py-2 uppercase">{payment.method}</td>
                <td className="py-2 uppercase">{payment.kind}</td>
                <td className="py-2 hidden md:table-cell">€{payment.subtotal.toFixed(2)}</td>
                <td className="py-2 text-danger hidden md:table-cell">€{payment.discountAmount.toFixed(2)}</td>
                <td className="py-2 text-success hidden md:table-cell">€{payment.surchargeAmount.toFixed(2)}</td>
                <td className="py-2 font-bold">€{payment.total.toFixed(2)}</td>
                <td className="py-2 hidden lg:table-cell">€{payment.paidAmount.toFixed(2)}</td>
                <td className="py-2 hidden lg:table-cell">€{payment.changeAmount.toFixed(2)}</td>
                <td className="py-2 hidden xl:table-cell">{payment.reference ?? '-'}</td>
                <td className="py-2 hidden xl:table-cell">{payment.refundReason ?? '-'}</td>
                <td className="py-2 hidden xl:table-cell">{payment.staffId}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ConfirmDialog
        open={confirmRefundOpen}
        title="Conferma rimborso"
        message="Confermi il rimborso? L'operazione crea un movimento contabile."
        confirmLabel="Conferma rimborso"
        cancelLabel="Annulla"
        onCancel={() => setConfirmRefundOpen(false)}
        onConfirm={() => {
          setConfirmRefundOpen(false);
          void runRefund();
        }}
      />
    </div>
  );
}

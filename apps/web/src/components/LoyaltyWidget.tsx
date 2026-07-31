import { useState, useEffect, useCallback } from 'react';
import { Star, TrendingUp, TrendingDown, History, AlertTriangle } from 'lucide-react';
import type { LoyaltyBalance, LoyaltyTransaction } from '@gustopos/shared';
import { fetchLoyaltyBalance, fetchLoyaltyTransactions, earnLoyaltyPoints, redeemLoyaltyPoints, fetchLoyaltyConfig } from '../shared/api/client';
import { useAppStore } from '../store/app-store';
import { pushToast } from '../shared/ui/toast';

interface LoyaltyWidgetProps {
  customerId: string;
  /** Whether to show in compact mode (e.g., inside CustomerDetailPage) */
  compact?: boolean;
}

export default function LoyaltyWidget({ customerId, compact = false }: LoyaltyWidgetProps) {
  const hasLoyalty = useAppStore((s) => s.enabledModules.includes('loyalty_points'));

  const [balance, setBalance] = useState<LoyaltyBalance | null>(null);
  const [transactions, setTransactions] = useState<LoyaltyTransaction[]>([]);
  const [loyaltyConfig, setLoyaltyConfig] = useState<{ earnRate?: number; redeemRate?: number; minRedeemPoints?: number } | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Earn form
  const [earnPoints, setEarnPoints] = useState('');
  const [earnNotes, setEarnNotes] = useState('');
  const [earnLoading, setEarnLoading] = useState(false);

  // Redeem form
  const [redeemPoints, setRedeemPoints] = useState('');
  const [redeemLoading, setRedeemLoading] = useState(false);
  const [showRedeemConfirm, setShowRedeemConfirm] = useState(false);
  const [pendingRedeemPoints, setPendingRedeemPoints] = useState(0);

  const minRedeem = loyaltyConfig?.minRedeemPoints ?? 100;
  const redeemRate = loyaltyConfig?.redeemRate ?? 100;
  const earnRate = loyaltyConfig?.earnRate ?? 1;

  // Auto-fetch tenant loyalty config on mount
  useEffect(() => {
    if (!hasLoyalty) return;
    void fetchLoyaltyConfig()
      .then((cfg) => setLoyaltyConfig(cfg))
      .catch(() => { /* silently keep defaults */ });
  }, [hasLoyalty]);

  const loadLoyalty = useCallback(async () => {
    if (!customerId || !hasLoyalty) return;
    setLoading(true);
    setError('');
    try {
      const [bal, txns] = await Promise.all([
        fetchLoyaltyBalance(customerId),
        fetchLoyaltyTransactions(customerId, 100),
      ]);
      setBalance(bal);
      setTransactions(txns);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore caricamento dati loyalty');
    } finally {
      setLoading(false);
    }
  }, [customerId, hasLoyalty]);

  useEffect(() => {
    if (customerId && hasLoyalty) {
      void loadLoyalty();
    }
  }, [customerId, hasLoyalty, loadLoyalty]);

  const handleEarn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId || !earnPoints) return;
    const pts = parseInt(earnPoints, 10);
    if (isNaN(pts) || pts <= 0) {
      setError('Inserisci un numero di punti valido');
      return;
    }
    setEarnLoading(true);
    setError('');
    try {
      await earnLoyaltyPoints(customerId, pts, undefined, earnNotes || undefined);
      setEarnPoints('');
      setEarnNotes('');
      pushToast('success', `+${pts} punti assegnati`);
      await loadLoyalty();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore assegnazione punti');
      pushToast('error', 'Errore assegnazione punti');
    } finally {
      setEarnLoading(false);
    }
  };

  const initiateRedeem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId || !redeemPoints) return;
    const pts = parseInt(redeemPoints, 10);
    if (isNaN(pts) || pts <= 0) {
      setError('Inserisci un numero di punti valido');
      return;
    }
    if (pts > (balance?.points ?? 0)) {
      setError('Punti insufficienti per il riscatto');
      return;
    }
    if (pts < minRedeem) {
      setError(`Minimo ${minRedeem} punti per il riscatto`);
      return;
    }
    setPendingRedeemPoints(pts);
    setShowRedeemConfirm(true);
  };

  const confirmRedeem = async () => {
    setShowRedeemConfirm(false);
    setRedeemLoading(true);
    setError('');
    try {
      const discountValue = (pendingRedeemPoints / redeemRate).toFixed(2);
      await redeemLoyaltyPoints(customerId, pendingRedeemPoints);
      setRedeemPoints('');
      pushToast('success', `${pendingRedeemPoints} punti riscattati (€${discountValue})`);
      await loadLoyalty();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore riscatto punti');
      pushToast('error', 'Errore riscatto punti');
    } finally {
      setRedeemLoading(false);
    }
  };

  const cancelRedeem = () => {
    setShowRedeemConfirm(false);
    setPendingRedeemPoints(0);
  };

  if (!hasLoyalty) return null;

  // Loading skeleton
  if (loading && !balance) {
    return (
      <div className={`bg-white border border-slate-200 rounded-xl ${compact ? 'p-4' : 'p-5'} space-y-4`}>
        <div className="flex items-center gap-2">
          <Star size={16} className="text-amber-500" />
          <h3 className="text-sm font-bold uppercase tracking-widest text-primary">Loyalty</h3>
        </div>
        <div className="animate-pulse space-y-3">
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-slate-100 rounded-lg h-16" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white border border-slate-200 rounded-xl ${compact ? 'p-4' : 'p-5'} space-y-4`}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <Star size={16} className="text-amber-500" />
        <h3 className="text-sm font-bold uppercase tracking-widest text-primary">Loyalty</h3>
        {loading && (
          <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex items-start gap-2">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError('')} className="font-bold shrink-0">&times;</button>
        </div>
      )}

      {/* Redeem confirmation dialog */}
      {showRedeemConfirm && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Conferma Riscatto</p>
              <p className="text-xs text-amber-700 mt-1">
                Stai per riscattare <strong>{pendingRedeemPoints} punti</strong> per uno sconto di{' '}
                <strong>€{(pendingRedeemPoints / redeemRate).toFixed(2)}</strong>.
                Questa azione non può essere annullata.
              </p>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={cancelRedeem}
              className="px-4 py-2 rounded border border-amber-300 text-xs font-bold uppercase tracking-wider text-amber-700 hover:bg-amber-100 transition-colors"
            >
              Annulla
            </button>
            <button
              onClick={() => void confirmRedeem()}
              className="px-4 py-2 rounded bg-amber-500 text-white text-xs font-bold uppercase tracking-wider hover:bg-amber-600 transition-colors"
            >
              Conferma Riscatto
            </button>
          </div>
        </div>
      )}

      {/* Balance cards */}
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="bg-slate-50 rounded-lg p-3 hover:bg-slate-100 transition-colors">
          <p className={`${compact ? 'text-xl' : 'text-2xl'} font-extrabold text-primary`}>
            {balance?.points ?? 0}
          </p>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mt-1">
            Disponibili
          </p>
        </div>
        <div className="bg-slate-50 rounded-lg p-3 hover:bg-slate-100 transition-colors">
          <div className="flex items-center justify-center gap-1">
            <TrendingUp size={14} className="text-green-500" />
            <p className={`${compact ? 'text-xl' : 'text-2xl'} font-extrabold text-green-600`}>
              {balance?.totalEarned ?? 0}
            </p>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mt-1">
            Guadagnati
          </p>
        </div>
        <div className="bg-slate-50 rounded-lg p-3 hover:bg-slate-100 transition-colors">
          <div className="flex items-center justify-center gap-1">
            <TrendingDown size={14} className="text-amber-500" />
            <p className={`${compact ? 'text-xl' : 'text-2xl'} font-extrabold text-amber-600`}>
              {balance?.totalRedeemed ?? 0}
            </p>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mt-1">
            Riscattati
          </p>
        </div>
      </div>

      {/* Rate info */}
      {loyaltyConfig && (earnRate !== 1 || redeemRate !== 100) && (
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-2 text-xs text-blue-700 text-center">
          {earnRate} punto{earnRate !== 1 ? 'i' : ''} per €1 speso &middot; {redeemRate} punti = €1 sconto
          {minRedeem > 0 && <> &middot; Min. {minRedeem} punti</>}
        </div>
      )}

      {/* Earn / Redeem forms */}
      <div className={`grid ${compact ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'} gap-3`}>
        {/* Earn form */}
        <form onSubmit={(e) => { void handleEarn(e); }} className="border border-slate-200 rounded-lg p-3 space-y-2">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Assegna Punti</p>
          <input
            type="number"
            value={earnPoints}
            onChange={(e) => setEarnPoints(e.target.value)}
            placeholder="Numero punti"
            min={1}
            className="w-full px-3 py-2 rounded border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
          {!compact && (
            <input
              value={earnNotes}
              onChange={(e) => setEarnNotes(e.target.value)}
              placeholder="Note (opzionale)"
              className="w-full px-3 py-2 rounded border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          )}
          <button
            type="submit"
            disabled={earnLoading || !earnPoints}
            className="w-full px-4 py-2 bg-green-600 text-white rounded text-sm font-bold uppercase tracking-wider hover:bg-green-700 active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100"
          >
            {earnLoading ? '...' : 'Assegna'}
          </button>
        </form>

        {/* Redeem form */}
        <form onSubmit={(e) => { void initiateRedeem(e); }} className="border border-slate-200 rounded-lg p-3 space-y-2">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
            Riscatta Punti
            <span className="text-slate-400 font-normal normal-case ml-1">
              (min. {minRedeem}, {redeemRate}pt = €1)
            </span>
          </p>
          <input
            type="number"
            value={redeemPoints}
            onChange={(e) => setRedeemPoints(e.target.value)}
            placeholder="Numero punti"
            min={minRedeem}
            max={balance?.points ?? 0}
            className="w-full px-3 py-2 rounded border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
          {balance && redeemPoints && parseInt(redeemPoints) > 0 && (
            <p className="text-xs text-slate-500 text-center">
              Sconto: <strong>€{(parseInt(redeemPoints) / redeemRate).toFixed(2)}</strong>
            </p>
          )}
          <button
            type="submit"
            disabled={redeemLoading || !redeemPoints || (!!balance && parseInt(redeemPoints || '0') > (balance.points ?? 0))}
            className="w-full px-4 py-2 bg-amber-500 text-white rounded text-sm font-bold uppercase tracking-wider hover:bg-amber-600 active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100"
          >
            {redeemLoading ? '...' : 'Riscatta'}
          </button>
        </form>
      </div>

      {/* Transaction history */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <History size={14} className="text-slate-400" />
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Storico Transazioni</p>
        </div>
        {transactions.length === 0 ? (
          <p className="text-sm text-slate-500 py-4 text-center bg-slate-50 rounded-lg">
            Nessuna transazione trovata
          </p>
        ) : (
          <div className="max-h-72 overflow-auto border border-slate-200 rounded-lg">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider sticky top-0">
                <tr>
                  <th className="p-2 text-left">Data</th>
                  <th className="p-2 text-left">Tipo</th>
                  <th className="p-2 text-right">Punti</th>
                  {!compact && <th className="p-2 text-left">Ordine</th>}
                  {!compact && <th className="p-2 text-left">Note</th>}
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="p-2 text-slate-600">
                      {new Date(tx.createdAt).toLocaleDateString('it-IT', {
                        day: '2-digit', month: '2-digit', year: '2-digit',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </td>
                    <td className="p-2">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        tx.type === 'earn'
                          ? 'bg-green-100 text-green-700'
                          : tx.type === 'redeem'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-blue-100 text-blue-700'
                      }`}>
                        {tx.type === 'earn' ? 'Guadagno' : tx.type === 'redeem' ? 'Riscatto' : 'Rettifica'}
                      </span>
                    </td>
                    <td className={`p-2 text-right font-bold ${tx.points >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {tx.points >= 0 ? '+' : ''}{tx.points}
                    </td>
                    {!compact && <td className="p-2 text-slate-500">{tx.orderId ?? '-'}</td>}
                    {!compact && <td className="p-2 text-slate-500 max-w-[120px] truncate">{tx.notes ?? '-'}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

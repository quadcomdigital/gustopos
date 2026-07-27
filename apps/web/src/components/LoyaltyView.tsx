import { useEffect, useState } from 'react';
import type { LoyaltyTransaction } from '@gustopos/shared';
import { useAppStore } from '../store/app-store';

export default function LoyaltyView() {
  const loyaltyBalance = useAppStore((state) => state.loyaltyBalance);
  const loyaltyTransactions = useAppStore((state) => state.loyaltyTransactions);
  const refreshLoyaltyBalance = useAppStore((state) => state.refreshLoyaltyBalance);
  const refreshLoyaltyTransactions = useAppStore((state) => state.refreshLoyaltyTransactions);
  const redeemLoyaltyPoints = useAppStore((state) => state.redeemLoyaltyPoints);
  const earnLoyaltyPointsAction = useAppStore((state) => state.earnLoyaltyPointsAction);

  const [customerId, setCustomerId] = useState('');
  const [searchId, setSearchId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Manual earn form
  const [earnPoints, setEarnPoints] = useState('');
  const [earnNotes, setEarnNotes] = useState('');
  const [earnLoading, setEarnLoading] = useState(false);

  // Manual redeem form
  const [redeemPoints, setRedeemPoints] = useState('');
  const [redeemLoading, setRedeemLoading] = useState(false);

  const loadCustomer = async (id: string) => {
    if (!id.trim()) return;
    setCustomerId(id.trim());
    setLoading(true);
    setError('');
    try {
      await Promise.all([
        refreshLoyaltyBalance(id.trim()),
        refreshLoyaltyTransactions(id.trim(), 100),
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore caricamento dati loyalty');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    void loadCustomer(searchId);
  };

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
      await earnLoyaltyPointsAction(customerId, pts, undefined, earnNotes || undefined);
      setEarnPoints('');
      setEarnNotes('');
      await Promise.all([
        refreshLoyaltyBalance(customerId),
        refreshLoyaltyTransactions(customerId, 100),
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore assegnazione punti');
    } finally {
      setEarnLoading(false);
    }
  };

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId || !redeemPoints) return;
    const pts = parseInt(redeemPoints, 10);
    if (isNaN(pts) || pts <= 0) {
      setError('Inserisci un numero di punti valido');
      return;
    }
    setRedeemLoading(true);
    setError('');
    try {
      await redeemLoyaltyPoints(customerId, pts);
      setRedeemPoints('');
      await Promise.all([
        refreshLoyaltyBalance(customerId),
        refreshLoyaltyTransactions(customerId, 100),
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore riscatto punti');
    } finally {
      setRedeemLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold uppercase tracking-widest text-primary">Loyalty Points</h2>
      </div>

      {/* Search bar */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          value={searchId}
          onChange={(e) => setSearchId(e.target.value)}
          placeholder="ID Cliente (es. cus_xxx)"
          className="flex-1 px-3 py-2 rounded border border-border text-sm"
        />
        <button
          type="submit"
          disabled={loading || !searchId.trim()}
          className="px-4 py-2 bg-primary text-white rounded text-sm font-bold uppercase tracking-wider disabled:opacity-50"
        >
          {loading ? 'Caricamento...' : 'Cerca'}
        </button>
      </form>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
          {error}
          <button onClick={() => setError('')} className="ml-2 font-bold">x</button>
        </div>
      )}

      {customerId && (
        <>
          {/* Balance card */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Saldo Punti</p>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-3xl font-extrabold text-primary">{loyaltyBalance?.points ?? 0}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Punti Disponibili</p>
              </div>
              <div>
                <p className="text-3xl font-extrabold text-green-600">{loyaltyBalance?.totalEarned ?? 0}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Totale Guadagnati</p>
              </div>
              <div>
                <p className="text-3xl font-extrabold text-amber-600">{loyaltyBalance?.totalRedeemed ?? 0}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Totale Riscattati</p>
              </div>
            </div>
          </div>

          {/* Manual earn/redeem forms */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Earn form */}
            <form onSubmit={handleEarn} className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Assegna Punti</p>
              <input
                type="number"
                value={earnPoints}
                onChange={(e) => setEarnPoints(e.target.value)}
                placeholder="Numero punti"
                min={1}
                className="w-full px-3 py-2 rounded border border-border text-sm"
              />
              <input
                value={earnNotes}
                onChange={(e) => setEarnNotes(e.target.value)}
                placeholder="Note (opzionale)"
                className="w-full px-3 py-2 rounded border border-border text-sm"
              />
              <button
                type="submit"
                disabled={earnLoading || !earnPoints}
                className="w-full px-4 py-2 bg-green-600 text-white rounded text-sm font-bold uppercase tracking-wider disabled:opacity-50"
              >
                {earnLoading ? 'Operazione in corso...' : 'Assegna Punti'}
              </button>
            </form>

            {/* Redeem form */}
            <form onSubmit={handleRedeem} className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Riscatta Punti</p>
              <input
                type="number"
                value={redeemPoints}
                onChange={(e) => setRedeemPoints(e.target.value)}
                placeholder="Numero punti"
                min={1}
                max={loyaltyBalance?.points ?? 0}
                className="w-full px-3 py-2 rounded border border-border text-sm"
              />
              <button
                type="submit"
                disabled={redeemLoading || !redeemPoints}
                className="w-full px-4 py-2 bg-amber-500 text-white rounded text-sm font-bold uppercase tracking-wider disabled:opacity-50"
              >
                {redeemLoading ? 'Operazione in corso...' : 'Riscatta Punti'}
              </button>
            </form>
          </div>

          {/* Transaction history */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Storico Transazioni</p>
            {loyaltyTransactions.length === 0 ? (
              <p className="text-sm text-text-muted">Nessuna transazione trovata</p>
            ) : (
              <div className="max-h-96 overflow-auto border border-slate-200 rounded">
                <table className="w-full text-xs min-w-[500px]">
                  <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider">
                    <tr>
                      <th className="p-2 text-left">Data</th>
                      <th className="p-2 text-left">Tipo</th>
                      <th className="p-2 text-right">Punti</th>
                      <th className="p-2 text-left">Ordine</th>
                      <th className="p-2 text-left">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loyaltyTransactions.map((tx: LoyaltyTransaction) => (
                      <tr key={tx.id} className="border-t border-slate-100">
                        <td className="p-2">{new Date(tx.createdAt).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                        <td className="p-2">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            tx.type === 'earn' ? 'bg-green-100 text-green-700' :
                            tx.type === 'redeem' ? 'bg-amber-100 text-amber-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {tx.type}
                          </span>
                        </td>
                        <td className={`p-2 text-right font-bold ${tx.points >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {tx.points >= 0 ? '+' : ''}{tx.points}
                        </td>
                        <td className="p-2 text-slate-500">{tx.orderId ?? '-'}</td>
                        <td className="p-2 text-slate-500">{tx.notes ?? '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

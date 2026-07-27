import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchCustomerById, fetchLoyaltyBalance, fetchLoyaltyTransactions, earnLoyaltyPoints, redeemLoyaltyPoints, fetchCustomerAddresses, createCustomerAddress, updateCustomerAddress, deleteCustomerAddress } from '../shared/api/client';
import type { Customer, LoyaltyBalance, LoyaltyTransaction, CustomerAddressCreateRequest, CustomerAddressUpdateRequest } from '@gustopos/shared';
import { useAppStore } from '../store/app-store';
import { Star, MapPin, Plus, Pencil, Trash2, X, Check } from 'lucide-react';

export default function CustomerDetailPage() {
  const { customerId = '' } = useParams();
  const navigate = useNavigate();
  const enabledModules = useAppStore((s) => s.enabledModules);
  const hasLoyalty = enabledModules.includes('loyalty_points');
  const hasDelivery = enabledModules.includes('delivery');

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [addresses, setAddresses] = useState<Customer['addresses']>([]);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [addrLabel, setAddrLabel] = useState('');
  const [addrText, setAddrText] = useState('');
  const [addrIsDefault, setAddrIsDefault] = useState(false);
  const [addrEditingId, setAddrEditingId] = useState<string | null>(null);
  const [addrEditLabel, setAddrEditLabel] = useState('');
  const [addrEditText, setAddrEditText] = useState('');
  const [addrLoading, setAddrLoading] = useState(false);
  const [addrError, setAddrError] = useState('');

  const [loyaltyBalance, setLoyaltyBalance] = useState<LoyaltyBalance | null>(null);
  const [loyaltyTransactions, setLoyaltyTransactions] = useState<LoyaltyTransaction[]>([]);
  const [loyaltyLoading, setLoyaltyLoading] = useState(false);

  const [earnPoints, setEarnPoints] = useState('');
  const [earnNotes, setEarnNotes] = useState('');
  const [earnLoading, setEarnLoading] = useState(false);

  const [redeemPoints, setRedeemPoints] = useState('');
  const [redeemLoading, setRedeemLoading] = useState(false);

  const [loyaltyError, setLoyaltyError] = useState('');

  useEffect(() => {
    if (!customerId) { setLoading(false); return; }
    setLoading(true);
    fetchCustomerById(customerId)
      .then((c) => setCustomer(c))
      .catch((e) => setError(e instanceof Error ? e.message : 'Cliente non trovato'))
      .finally(() => setLoading(false));
  }, [customerId]);

  const loadLoyalty = useCallback(async () => {
    if (!customerId || !hasLoyalty) return;
    setLoyaltyLoading(true);
    try {
      const [balance, transactions] = await Promise.all([
        fetchLoyaltyBalance(customerId),
        fetchLoyaltyTransactions(customerId, 100),
      ]);
      setLoyaltyBalance(balance);
      setLoyaltyTransactions(transactions);
    } catch {
      // Loyalty data may not exist yet for this customer
    } finally {
      setLoyaltyLoading(false);
    }
  }, [customerId, hasLoyalty]);

  useEffect(() => {
    if (customer && hasLoyalty) loadLoyalty();
  }, [customer, hasLoyalty, loadLoyalty]);

  const loadAddresses = useCallback(async () => {
    if (!customerId || !hasDelivery) return;
    try {
      const addrs = await fetchCustomerAddresses(customerId);
      setAddresses(addrs);
    } catch { /* ignore */ }
  }, [customerId, hasDelivery]);

  useEffect(() => {
    if (customer && hasDelivery) loadAddresses();
  }, [customer, hasDelivery, loadAddresses]);

  const handleCreateAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId || addrText.trim().length < 5) return;
    setAddrLoading(true);
    setAddrError('');
    try {
      await createCustomerAddress(customerId, { label: addrLabel.trim() || undefined, address: addrText.trim(), isDefault: addrIsDefault });
      setAddrLabel(''); setAddrText(''); setAddrIsDefault(false); setShowAddressForm(false);
      await loadAddresses();
    } catch (err) {
      setAddrError(err instanceof Error ? err.message : 'Errore creazione indirizzo');
    } finally {
      setAddrLoading(false);
    }
  };

  const handleUpdateAddress = async (addressId: string) => {
    if (addrEditText.trim().length < 5) return;
    setAddrError('');
    try {
      await updateCustomerAddress(customerId, addressId, { label: addrEditLabel.trim() || null, address: addrEditText.trim() });
      setAddrEditingId(null);
      await loadAddresses();
    } catch (err) {
      setAddrError(err instanceof Error ? err.message : 'Errore aggiornamento indirizzo');
    }
  };

  const handleDeleteAddress = async (addressId: string) => {
    setAddrError('');
    try {
      await deleteCustomerAddress(customerId, addressId);
      await loadAddresses();
    } catch (err) {
      setAddrError(err instanceof Error ? err.message : 'Errore eliminazione indirizzo');
    }
  };

  const handleEarn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId || !earnPoints) return;
    const pts = parseInt(earnPoints, 10);
    if (isNaN(pts) || pts <= 0) { setLoyaltyError('Numero punti non valido'); return; }
    setEarnLoading(true);
    setLoyaltyError('');
    try {
      await earnLoyaltyPoints(customerId, pts, undefined, earnNotes || undefined);
      setEarnPoints('');
      setEarnNotes('');
      await loadLoyalty();
    } catch (err) {
      setLoyaltyError(err instanceof Error ? err.message : 'Errore assegnazione punti');
    } finally {
      setEarnLoading(false);
    }
  };

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId || !redeemPoints) return;
    const pts = parseInt(redeemPoints, 10);
    if (isNaN(pts) || pts <= 0) { setLoyaltyError('Numero punti non valido'); return; }
    setRedeemLoading(true);
    setLoyaltyError('');
    try {
      await redeemLoyaltyPoints(customerId, pts);
      setRedeemPoints('');
      await loadLoyalty();
    } catch (err) {
      setLoyaltyError(err instanceof Error ? err.message : 'Errore riscatto punti');
    } finally {
      setRedeemLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="space-y-4">
        <div className="bg-white border border-border rounded-xl p-6 text-center">
          <p className="text-sm text-danger font-semibold">{error || 'Cliente non trovato'}</p>
          <button
            onClick={() => navigate('/app/customers')}
            className="mt-4 px-4 py-2 rounded border border-border text-xs font-bold uppercase tracking-wider"
          >
            ← Indietro
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Customer info */}
      <div className="bg-white border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-primary tracking-tight uppercase">{customer.fullName}</h2>
            <p className="text-xs text-text-muted font-mono">ID: {customer.id}</p>
          </div>
          <button
            onClick={() => navigate('/app/customers')}
            className="px-4 py-2 rounded border border-border text-xs font-bold uppercase tracking-wider"
          >
            ← Indietro
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-bg/50 rounded-lg p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">Telefono</p>
            <p className="text-sm font-semibold text-primary">{customer.phone ?? '—'}</p>
          </div>
          <div className="bg-bg/50 rounded-lg p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">Ordini Totali</p>
            <p className="text-sm font-semibold text-primary">{customer.totalOrders}</p>
          </div>
          <div className="bg-bg/50 rounded-lg p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">Spesa Totale</p>
            <p className="text-sm font-semibold text-primary">€{customer.totalSpent.toFixed(2)}</p>
          </div>
          <div className="bg-bg/50 rounded-lg p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">Ultimo Accesso</p>
            <p className="text-sm font-semibold text-primary">
              {customer.lastSeenAt ? new Date(customer.lastSeenAt).toLocaleString('it-IT') : '—'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-bg/50 rounded-lg p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">Registrato il</p>
            <p className="text-sm font-semibold text-primary">{new Date(customer.createdAt).toLocaleString('it-IT')}</p>
          </div>
          <div className="bg-bg/50 rounded-lg p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">Aggiornato il</p>
            <p className="text-sm font-semibold text-primary">{new Date(customer.updatedAt).toLocaleString('it-IT')}</p>
          </div>
        </div>
      </div>

      {/* Addresses section (gated by delivery module) */}
      {hasDelivery && (
        <div className="bg-white border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin size={16} className="text-accent" />
              <h3 className="text-sm font-bold uppercase tracking-widest text-primary">Indirizzi</h3>
            </div>
            <button onClick={() => { setShowAddressForm(!showAddressForm); setAddrError(''); }} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-bold uppercase tracking-wider">
              <Plus size={12} /> Aggiungi
            </button>
          </div>

          {addrError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              {addrError}
              <button onClick={() => setAddrError('')} className="ml-2 font-bold">✕</button>
            </div>
          )}

          {showAddressForm && (
            <form onSubmit={handleCreateAddress} className="border border-border rounded-lg p-3 space-y-2 bg-bg/30">
              <input type="text" value={addrLabel} onChange={(e) => setAddrLabel(e.target.value)} placeholder="Etichetta (es. Casa, Ufficio)" className="w-full px-3 py-2 rounded-lg border border-border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-accent/30" autoFocus />
              <input type="text" value={addrText} onChange={(e) => setAddrText(e.target.value)} placeholder="Indirizzo completo" className="w-full px-3 py-2 rounded-lg border border-border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-accent/30" />
              <label className="flex items-center gap-2 text-xs text-text-muted">
                <input type="checkbox" checked={addrIsDefault} onChange={(e) => setAddrIsDefault(e.target.checked)} className="rounded" />
                Imposta come predefinito
              </label>
              <div className="flex gap-2">
                <button type="button" onClick={() => { setShowAddressForm(false); setAddrLabel(''); setAddrText(''); setAddrIsDefault(false); }} className="px-3 py-2 rounded border border-border text-xs font-bold uppercase tracking-wider">Annulla</button>
                <button type="submit" disabled={addrLoading || addrText.trim().length < 5} className="px-3 py-2 rounded bg-primary text-white text-xs font-bold uppercase tracking-wider disabled:opacity-50">{addrLoading ? 'Salvataggio...' : 'Salva'}</button>
              </div>
            </form>
          )}

          {(addresses ?? []).length === 0 ? (
            <p className="text-sm text-text-muted text-center py-4">Nessun indirizzo salvato</p>
          ) : (
            <div className="space-y-2">
              {(addresses ?? []).map((addr) => (
                <div key={addr.id} className="bg-bg/50 rounded-lg p-3 space-y-1">
                  {addrEditingId === addr.id ? (
                    <>
                      <input type="text" value={addrEditLabel} onChange={(e) => setAddrEditLabel(e.target.value)} placeholder="Etichetta" className="w-full px-2 py-1 rounded border border-border text-sm bg-white" />
                      <input type="text" value={addrEditText} onChange={(e) => setAddrEditText(e.target.value)} placeholder="Indirizzo" className="w-full px-2 py-1 rounded border border-border text-sm bg-white" />
                      <div className="flex gap-2 mt-1">
                        <button onClick={() => setAddrEditingId(null)} className="p-1.5 rounded border border-border text-text-muted"><X size={12} /></button>
                        <button onClick={() => handleUpdateAddress(addr.id)} className="p-1.5 rounded bg-primary text-white"><Check size={12} /></button>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          {addr.label && <span className="text-xs font-bold text-accent">{addr.label}</span>}
                          {addr.isDefault && <span className="text-[9px] font-bold uppercase bg-accent/10 text-accent px-1.5 py-0.5 rounded">Predefinito</span>}
                        </div>
                        <p className="text-sm text-primary">{addr.address}</p>
                      </div>
                      <div className="flex gap-1 shrink-0 ml-2">
                        <button onClick={() => { setAddrEditingId(addr.id); setAddrEditLabel(addr.label ?? ''); setAddrEditText(addr.address); }} className="p-1.5 rounded hover:bg-white text-text-muted"><Pencil size={12} /></button>
                        <button onClick={() => handleDeleteAddress(addr.id)} className="p-1.5 rounded hover:bg-white text-red-500"><Trash2 size={12} /></button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Loyalty section */}
      {hasLoyalty && (
        <div className="bg-white border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Star size={16} className="text-amber-500" />
            <h3 className="text-sm font-bold uppercase tracking-widest text-primary">Loyalty</h3>
            {loyaltyLoading && <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />}
          </div>

          {loyaltyError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              {loyaltyError}
              <button onClick={() => setLoyaltyError('')} className="ml-2 font-bold">✕</button>
            </div>
          )}

          {/* Balance */}
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="bg-bg/50 rounded-lg p-3">
              <p className="text-2xl font-extrabold text-primary">{loyaltyBalance?.points ?? 0}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Punti Disponibili</p>
            </div>
            <div className="bg-bg/50 rounded-lg p-3">
              <p className="text-2xl font-extrabold text-green-600">{loyaltyBalance?.totalEarned ?? 0}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Totale Guadagnati</p>
            </div>
            <div className="bg-bg/50 rounded-lg p-3">
              <p className="text-2xl font-extrabold text-amber-600">{loyaltyBalance?.totalRedeemed ?? 0}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Totale Riscattati</p>
            </div>
          </div>

          {/* Earn / Redeem forms */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <form onSubmit={handleEarn} className="border border-border rounded-lg p-4 space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-text-muted">Assegna Punti</p>
              <input
                type="number"
                value={earnPoints}
                onChange={(e) => setEarnPoints(e.target.value)}
                placeholder="Numero punti"
                min={1}
                className="w-full px-3 py-2 rounded border border-border text-sm bg-bg/50 focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
              <input
                value={earnNotes}
                onChange={(e) => setEarnNotes(e.target.value)}
                placeholder="Note (opzionale)"
                className="w-full px-3 py-2 rounded border border-border text-sm bg-bg/50 focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
              <button
                type="submit"
                disabled={earnLoading || !earnPoints}
                className="w-full px-4 py-2 bg-green-600 text-white rounded text-sm font-bold uppercase tracking-wider disabled:opacity-50"
              >
                {earnLoading ? 'Operazione in corso...' : 'Assegna Punti'}
              </button>
            </form>

            <form onSubmit={handleRedeem} className="border border-border rounded-lg p-4 space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-text-muted">Riscatta Punti</p>
              <input
                type="number"
                value={redeemPoints}
                onChange={(e) => setRedeemPoints(e.target.value)}
                placeholder="Numero punti"
                min={1}
                max={loyaltyBalance?.points ?? 0}
                className="w-full px-3 py-2 rounded border border-border text-sm bg-bg/50 focus:outline-none focus:ring-2 focus:ring-accent/30"
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
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-text-muted mb-3">Storico Transazioni</p>
            {loyaltyTransactions.length === 0 ? (
              <p className="text-sm text-text-muted py-4 text-center">Nessuna transazione trovata</p>
            ) : (
              <div className="max-h-80 overflow-auto border border-border rounded-lg">
                <table className="w-full text-xs">
                  <thead className="bg-bg/50 text-text-muted uppercase tracking-wider">
                    <tr>
                      <th className="p-2 text-left">Data</th>
                      <th className="p-2 text-left">Tipo</th>
                      <th className="p-2 text-right">Punti</th>
                      <th className="p-2 text-left">Ordine</th>
                      <th className="p-2 text-left">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loyaltyTransactions.map((tx) => (
                      <tr key={tx.id} className="border-t border-border/50">
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
                        <td className="p-2 text-text-muted">{tx.orderId ?? '-'}</td>
                        <td className="p-2 text-text-muted">{tx.notes ?? '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

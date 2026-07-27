import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Customer, CustomerAnalytics, CustomerCreateRequest, CustomerUpdateRequest, CustomersQuery } from '@gustopos/shared';
import { Search, Plus, Pencil, Trash2, X, Check, Users } from 'lucide-react';
import ConfirmDialog from './ConfirmDialog';
import { cn } from '../lib/utils';

interface CustomersViewProps {
  customers: Customer[];
  customerAnalytics: CustomerAnalytics | null;
  onRefreshCustomers: (query?: CustomersQuery) => Promise<void>;
  onRefreshCustomerAnalytics: () => Promise<void>;
  onCreateCustomer: (payload: CustomerCreateRequest) => Promise<Customer>;
  onUpdateCustomer: (id: string, payload: CustomerUpdateRequest) => Promise<Customer>;
  onDeleteCustomer: (id: string) => Promise<void>;
}

export default function CustomersView({
  customers,
  customerAnalytics,
  onRefreshCustomers,
  onRefreshCustomerAnalytics,
  onCreateCustomer,
  onUpdateCustomer,
  onDeleteCustomer,
}: CustomersViewProps) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    const debounce = setTimeout(() => {
      onRefreshCustomers({ query: searchQuery || undefined, limit: 200 });
    }, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery]);

  const handleCreate = useCallback(async () => {
    if (newName.trim().length < 2) return;
    setCreating(true);
    setActionError('');
    try {
      await onCreateCustomer({ fullName: newName.trim(), phone: newPhone.trim() || undefined });
      setNewName('');
      setNewPhone('');
      setShowCreateForm(false);
      await onRefreshCustomers({ limit: 200 });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Errore creazione cliente');
    } finally {
      setCreating(false);
    }
  }, [newName, newPhone, onCreateCustomer, onRefreshCustomers]);

  const handleUpdate = useCallback(async (id: string) => {
    if (editName.trim().length < 2) return;
    setActionError('');
    try {
      await onUpdateCustomer(id, { fullName: editName.trim(), phone: editPhone.trim() || null });
      setEditingId(null);
      await onRefreshCustomers({ limit: 200 });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Errore aggiornamento cliente');
    }
  }, [editName, editPhone, onUpdateCustomer, onRefreshCustomers]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setActionError('');
    try {
      await onDeleteCustomer(deleteTarget.id);
      setDeleteTarget(null);
      await onRefreshCustomers({ limit: 200 });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Errore eliminazione cliente');
    }
  }, [deleteTarget, onDeleteCustomer, onRefreshCustomers]);

  const startEdit = (customer: Customer) => {
    setEditingId(customer.id);
    setEditName(customer.fullName);
    setEditPhone(customer.phone ?? '');
    setActionError('');
  };

  return (
    <div className="space-y-4">
      {actionError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
          {actionError}
          <button onClick={() => setActionError('')} className="ml-2 font-bold">✕</button>
        </div>
      )}

      {/* Analytics KPIs */}
      {customerAnalytics && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {[
            { label: 'Totale', value: customerAnalytics.totalCustomers },
            { label: 'Attivi', value: customerAnalytics.activeCustomers },
            { label: 'Nuovi', value: customerAnalytics.newCustomers },
            { label: 'Fidelity', value: `${(customerAnalytics.repeatRate * 100).toFixed(0)}%` },
            { label: 'Spesa media', value: `€${customerAnalytics.avgSpendPerCustomer.toFixed(2)}` },
            { label: 'Ordini media', value: customerAnalytics.avgOrdersPerCustomer.toFixed(1) },
          ].map((kpi) => (
            <div key={kpi.label} className="bg-white border border-border rounded-xl p-3 text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">{kpi.label}</p>
              <p className="text-lg font-bold text-primary mt-1">{kpi.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Search + Create */}
      <div className="bg-white border border-border rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cerca per nome o telefono..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-border text-sm bg-bg/50 focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>
          <button
            onClick={() => { setShowCreateForm(!showCreateForm); setActionError(''); }}
            className="shrink-0 flex items-center gap-1 px-3 py-2 rounded-lg bg-primary text-white text-xs font-bold uppercase tracking-wider"
          >
            <Plus size={14} />
            <span className="hidden sm:inline">Nuovo</span>
          </button>
        </div>

        {/* Create form */}
        {showCreateForm && (
          <div className="border border-border rounded-lg p-3 space-y-2 bg-bg/30">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nome completo"
              className="w-full px-3 py-2 rounded-lg border border-border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-accent/30"
              autoFocus
            />
            <input
              type="tel"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              placeholder="Telefono (opzionale)"
              className="w-full px-3 py-2 rounded-lg border border-border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setShowCreateForm(false); setNewName(''); setNewPhone(''); }}
                className="px-3 py-2 rounded border border-border text-xs font-bold uppercase tracking-wider"
              >
                Annulla
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || newName.trim().length < 2}
                className="px-3 py-2 rounded bg-primary text-white text-xs font-bold uppercase tracking-wider disabled:opacity-50"
              >
                {creating ? 'Creazione...' : 'Crea Cliente'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Customer list */}
      <div className="bg-white border border-border rounded-xl p-4">
        <h3 className="text-xs sm:text-sm font-bold uppercase tracking-widest text-primary mb-3">
          Clienti ({customers.length})
        </h3>

        {customers.length === 0 ? (
          <div className="text-center py-8">
            <Users size={32} className="mx-auto text-text-muted mb-2" />
            <p className="text-sm text-text-muted">Nessun cliente trovato</p>
          </div>
        ) : (
          <>
            {/* Mobile */}
            <div className="md:hidden space-y-2">
              {customers.map((customer) => (
                <div key={customer.id} className="bg-bg/50 rounded-xl p-3 space-y-2">
                  {editingId === customer.id ? (
                    <>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full px-2 py-1 rounded border border-border text-sm bg-white"
                        autoFocus
                      />
                      <input
                        type="tel"
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        placeholder="Telefono"
                        className="w-full px-2 py-1 rounded border border-border text-sm bg-white"
                      />
                      <div className="flex gap-2">
                        <button onClick={() => setEditingId(null)} className="p-1.5 rounded border border-border text-text-muted">
                          <X size={14} />
                        </button>
                        <button onClick={() => handleUpdate(customer.id)} className="p-1.5 rounded bg-primary text-white">
                          <Check size={14} />
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <button
                          onClick={() => navigate(`/app/customers/${customer.id}`)}
                          className="font-bold text-accent text-xs hover:underline truncate block text-left"
                        >
                          {customer.fullName}
                        </button>
                        <p className="text-[10px] text-text-muted">{customer.phone ?? '—'}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        <div className="text-right mr-2">
                          <p className="text-xs font-bold text-primary">{customer.totalOrders} ordini</p>
                          <p className="text-[10px] text-text-muted">€{customer.totalSpent.toFixed(2)}</p>
                        </div>
                        <button onClick={() => startEdit(customer)} className="p-1.5 rounded hover:bg-white text-text-muted">
                          <Pencil size={12} />
                        </button>
                        <button onClick={() => setDeleteTarget(customer)} className="p-1.5 rounded hover:bg-white text-red-500">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop */}
            <div className="hidden md:block overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-text-muted border-b border-border">
                    <th className="py-2">Nome</th>
                    <th className="py-2">Telefono</th>
                    <th className="py-2">Ordini</th>
                    <th className="py-2">Speso</th>
                    <th className="py-2">Ultima visita</th>
                    <th className="py-2 text-right">Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((customer) => (
                    <tr key={customer.id} className="border-b border-border/50">
                      <td className="py-2">
                        {editingId === customer.id ? (
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full px-2 py-1 rounded border border-border text-sm"
                            autoFocus
                          />
                        ) : (
                          <button
                            onClick={() => navigate(`/app/customers/${customer.id}`)}
                            className="font-bold text-accent hover:underline text-left"
                          >
                            {customer.fullName}
                          </button>
                        )}
                      </td>
                      <td className="py-2">
                        {editingId === customer.id ? (
                          <input
                            type="tel"
                            value={editPhone}
                            onChange={(e) => setEditPhone(e.target.value)}
                            className="w-full px-2 py-1 rounded border border-border text-sm"
                          />
                        ) : (
                          customer.phone ?? '-'
                        )}
                      </td>
                      <td className="py-2">{customer.totalOrders}</td>
                      <td className="py-2">€{customer.totalSpent.toFixed(2)}</td>
                      <td className="py-2">{customer.lastSeenAt ? new Date(customer.lastSeenAt).toLocaleString('it-IT') : '-'}</td>
                      <td className="py-2 text-right">
                        {editingId === customer.id ? (
                          <div className="flex justify-end gap-1">
                            <button onClick={() => setEditingId(null)} className="p-1.5 rounded border border-border text-text-muted">
                              <X size={12} />
                            </button>
                            <button onClick={() => handleUpdate(customer.id)} className="p-1.5 rounded bg-primary text-white">
                              <Check size={12} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-1">
                            <button onClick={() => startEdit(customer)} className="p-1.5 rounded hover:bg-bg text-text-muted">
                              <Pencil size={12} />
                            </button>
                            <button onClick={() => setDeleteTarget(customer)} className="p-1.5 rounded hover:bg-bg text-red-500">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Elimina Cliente"
        message={`Sei sicuro di voler eliminare "${deleteTarget?.fullName}"? L'azione è irreversibile.`}
        confirmLabel="Elimina"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

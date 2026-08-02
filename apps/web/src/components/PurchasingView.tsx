import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PurchaseOrder, PurchaseOrderStatus, SupplierIngredient } from '@gustopos/shared';
import { pushToast } from '../shared/ui/toast';
import { useAppStore } from '../store/app-store';
import ConfirmDialog from './ConfirmDialog';

const statusOrder: PurchaseOrderStatus[] = ['draft', 'sent', 'partial_received', 'received', 'cancelled'];

export default function PurchasingView() {
  const [loading, setLoading] = useState(false);
  const suppliers = useAppStore((state) => state.suppliers);
  const orders = useAppStore((state) => state.purchaseOrders);
  const refreshSuppliers = useAppStore((state) => state.refreshSuppliers);
  const refreshPurchaseOrders = useAppStore((state) => state.refreshPurchaseOrders);
  const createSupplier = useAppStore((state) => state.createSupplier);
  const refreshSupplierIngredients = useAppStore((state) => state.refreshSupplierIngredients);
  const createSupplierIngredient = useAppStore((state) => state.createSupplierIngredient);
  const updateSupplierIngredient = useAppStore((state) => state.updateSupplierIngredient);
  const deleteSupplierIngredient = useAppStore((state) => state.deleteSupplierIngredient);
  const refreshSupplierPoItems = useAppStore((state) => state.refreshSupplierPoItems);
  const createPurchaseOrder = useAppStore((state) => state.createPurchaseOrder);
  const updatePurchaseOrderStatus = useAppStore((state) => state.updatePurchaseOrderStatus);
  const createGoodsReceipt = useAppStore((state) => state.createGoodsReceipt);
  const [supplierName, setSupplierName] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [poItems, setPoItems] = useState<{ ingredientId: string; itemName: string; brandName: string; unit: string; orderedQty: number; unitCost: number }[]>([]);
  const [loadingPoItems, setLoadingPoItems] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pendingReceiptOrderId, setPendingReceiptOrderId] = useState<string | null>(null);
  const [pendingAdvance, setPendingAdvance] = useState<{ order: PurchaseOrder; target: PurchaseOrderStatus } | null>(null);

  // Supplier ingredients state
  const inventoryItems = useAppStore((state) => state.inventoryItems);
  const storeSupplierIngredients = useAppStore((state) => state.supplierIngredients);
  const storeSupplierIngredientsSupplierId = useAppStore((state) => state.supplierIngredientsSupplierId);
  const supplierIngredients = storeSupplierIngredientsSupplierId === selectedSupplierId ? storeSupplierIngredients : [];
  const [loadingIngredients, setLoadingIngredients] = useState(false);
  const [newIngredientId, setNewIngredientId] = useState('');
  const [newBrandName, setNewBrandName] = useState('');
  const [newUnitCost, setNewUnitCost] = useState('');
  const [newIsPreferred, setNewIsPreferred] = useState(false);
  const [editingIngredientId, setEditingIngredientId] = useState<string | null>(null);
  const [editBrandName, setEditBrandName] = useState('');
  const [editUnitCost, setEditUnitCost] = useState('');
  const [editIsPreferred, setEditIsPreferred] = useState(false);
  const [pendingDeleteIngredient, setPendingDeleteIngredient] = useState<SupplierIngredient | null>(null);

  const mapError = (value: unknown) => {
    const message = value instanceof Error ? value.message : 'Errore operazione acquisti';
    if (message.includes('Supplier not found')) return 'Fornitore non trovato o non attivo.';
    if (message.includes('transition not allowed')) return 'Transizione stato ordine non consentita.';
    if (message.includes('PO item not found')) return 'Riga ordine non valida per la ricezione.';
    return message;
  };

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      await Promise.all([
        refreshSuppliers({ limit: 200 }),
        refreshPurchaseOrders({ limit: 200 }),
      ]);
    } catch (loadError) {
      setError(mapError(loadError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedSupplierId && suppliers.length > 0) {
      setSelectedSupplierId(suppliers[0].id); // eslint-disable-line react-hooks/set-state-in-effect -- [form-sync] default supplier selection on load; safe because setter receives a primitive string
    }
  }, [selectedSupplierId, suppliers]);

  const loadSupplierIngredients = useCallback(async (supplierId: string) => {
    if (!supplierId) {
      return;
    }
    setLoadingIngredients(true);
    try {
      await refreshSupplierIngredients(supplierId);
    } catch {
      // The store already surfaces the mapped error; never let a failed
      // ingredients fetch become an unhandled rejection from the mount effect.
    } finally {
      setLoadingIngredients(false);
    }
  }, [refreshSupplierIngredients]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- [indirect-setstate] loadSupplierIngredients calls store set() internally via async callback
    void loadSupplierIngredients(selectedSupplierId);
  }, [selectedSupplierId, loadSupplierIngredients]);

  useEffect(() => {
    if (!selectedSupplierId) {
      setPoItems([]); // eslint-disable-line react-hooks/set-state-in-effect -- [literal-reset] reset to empty array when no supplier selected; safe because setter receives a literal []
      return;
    }
    let cancelled = false;
    setLoadingPoItems(true);
    refreshSupplierPoItems(selectedSupplierId)
      .then((items) => {
        if (cancelled) return;
        setPoItems(items.map((item) => ({
          ingredientId: item.ingredientId,
          itemName: item.name,
          brandName: item.brandName ?? '',
          unit: item.unit,
          orderedQty: 0,
          unitCost: item.supplierCost ?? item.currentCost,
        })));
      })
      .catch(() => {
        if (cancelled) return;
        setPoItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingPoItems(false);
      });
    return () => { cancelled = true; };
  }, [selectedSupplierId, refreshSupplierPoItems]);

  const createSupplierHandler = async () => {
    if (supplierName.trim().length < 2) {
      setError('Nome fornitore troppo corto');
      return;
    }
    setError('');
    setSuccess('');
    try {
      await createSupplier({ name: supplierName.trim() });
      setSupplierName('');
      if (suppliers.length > 0) {
        setSelectedSupplierId(suppliers[0].id);
      }
      await load();
      setSuccess('Fornitore creato con successo.');
      pushToast('success', 'Fornitore creato con successo.');
    } catch (createError) {
      const message = mapError(createError);
      setError(message);
      pushToast('error', message);
    }
  };

  const createOrderHandler = async () => {
    const activeItems = poItems.filter((item) => item.orderedQty > 0);
    if (!selectedSupplierId || activeItems.length === 0) {
      setError('Seleziona fornitore e imposta quantita per almeno un articolo.');
      return;
    }
    for (const item of activeItems) {
      if (item.unitCost < 0) {
        setError('Costo unitario non puo essere negativo.');
        return;
      }
    }
    setError('');
    setSuccess('');
    try {
      await createPurchaseOrder({
        supplierId: selectedSupplierId,
        items: activeItems.map((item) => ({
          inventoryId: item.ingredientId || undefined,
          itemName: item.itemName,
          unit: item.unit,
          orderedQty: item.orderedQty,
          unitCost: item.unitCost,
        })),
      });
      await load();
      setSuccess('Ordine acquisto creato.');
      pushToast('success', 'Ordine acquisto creato.');
    } catch (createError) {
      const message = mapError(createError);
      setError(message);
      pushToast('error', message);
    }
  };

  const groupedByStatus = useMemo(() => {
    const grouped = new Map<PurchaseOrderStatus, PurchaseOrder[]>();
    for (const status of statusOrder) {
      grouped.set(status, []);
    }
    for (const order of orders) {
      const bucket = grouped.get(order.status) ?? [];
      bucket.push(order);
      grouped.set(order.status, bucket);
    }
    return grouped;
  }, [orders]);

  const nextStatus = (order: PurchaseOrder) => {
    const idx = statusOrder.indexOf(order.status);
    if (idx < 0 || idx === statusOrder.length - 1) return;
    const target = statusOrder[idx + 1];
    setPendingAdvance({ order, target });
  };

  const confirmAdvance = async () => {
    if (!pendingAdvance) return;
    const { order, target } = pendingAdvance;
    setPendingAdvance(null);
    try {
      await updatePurchaseOrderStatus(order.id, { status: target });
      await load();
      setSuccess(`Ordine ${order.id} aggiornato a ${target}.`);
      pushToast('success', `Ordine ${order.id} aggiornato a ${target}.`);
    } catch (updateError) {
      const message = mapError(updateError);
      setError(message);
      pushToast('error', message);
    }
  };

  const handleAddSupplierIngredient = async () => {
    if (!selectedSupplierId || !newIngredientId) {
      setError('Seleziona un ingrediente.');
      return;
    }
    setError('');
    try {
      await createSupplierIngredient({
        supplierId: selectedSupplierId,
        ingredientId: newIngredientId,
        brandName: newBrandName.trim() || undefined,
        unitCost: newUnitCost ? Number(newUnitCost) : undefined,
        isPreferred: newIsPreferred,
      });
      setNewIngredientId('');
      setNewBrandName('');
      setNewUnitCost('');
      setNewIsPreferred(false);
      await loadSupplierIngredients(selectedSupplierId);
      setSuccess('Ingrediente collegato con successo.');
      pushToast('success', 'Ingrediente collegato con successo.');
    } catch (addError) {
      const message = mapError(addError);
      setError(message);
      pushToast('error', message);
    }
  };

  const startEditing = (ingredient: SupplierIngredient) => {
    setEditingIngredientId(ingredient.ingredientId);
    setEditBrandName(ingredient.brandName ?? '');
    setEditUnitCost(ingredient.unitCost?.toString() ?? '');
    setEditIsPreferred(ingredient.isPreferred);
  };

  const cancelEditing = () => {
    setEditingIngredientId(null);
  };

  const handleUpdateSupplierIngredient = async (ingredientId: string) => {
    if (!selectedSupplierId) return;
    setError('');
    try {
      await updateSupplierIngredient(selectedSupplierId, ingredientId, {
        brandName: editBrandName.trim() || undefined,
        unitCost: editUnitCost ? Number(editUnitCost) : undefined,
        isPreferred: editIsPreferred,
      });
      setEditingIngredientId(null);
      await loadSupplierIngredients(selectedSupplierId);
      setSuccess('Ingrediente aggiornato.');
      pushToast('success', 'Ingrediente aggiornato.');
    } catch (updateError) {
      const message = mapError(updateError);
      setError(message);
      pushToast('error', message);
    }
  };

  const handleDeleteSupplierIngredient = async () => {
    if (!pendingDeleteIngredient || !selectedSupplierId) return;
    const { ingredientId } = pendingDeleteIngredient;
    setPendingDeleteIngredient(null);
    setError('');
    try {
      await deleteSupplierIngredient(selectedSupplierId, ingredientId);
      await loadSupplierIngredients(selectedSupplierId);
      setSuccess('Ingrediente rimosso.');
      pushToast('success', 'Ingrediente rimosso.');
    } catch (deleteError) {
      const message = mapError(deleteError);
      setError(message);
      pushToast('error', message);
    }
  };

  const partialReceive = async (order: PurchaseOrder) => {
    const first = order.items[0];
    if (!first) return;
    try {
      await createGoodsReceipt(order.id, {
        receivedAt: new Date().toISOString(),
        notes: 'Ricezione parziale da UI',
        items: [
          {
            purchaseOrderItemId: first.id,
            receivedQty: Math.max(0.1, Number((first.orderedQty * 0.4).toFixed(3))),
            unitCost: first.unitCost,
          },
        ],
      });
      await load();
      setSuccess(`Ricezione parziale registrata su ${order.id}.`);
      pushToast('success', `Ricezione parziale registrata su ${order.id}.`);
    } catch (receiveError) {
      const message = mapError(receiveError);
      setError(message);
      pushToast('error', message);
    }
  };

  const pendingReceiptOrder = pendingReceiptOrderId ? orders.find((entry) => entry.id === pendingReceiptOrderId) ?? null : null;

  return (
    <div className="space-y-4">
      <div className="bg-white border border-border rounded-xl p-4 space-y-3">
        <h2 className="text-lg font-bold text-primary uppercase tracking-wide">Purchasing & Suppliers</h2>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          <input
            value={supplierName}
            onChange={(event) => setSupplierName(event.target.value)}
            placeholder="Nuovo fornitore"
            className="px-3 py-2 rounded border border-border text-sm"
          />
          <button
            onClick={() => void createSupplierHandler()}
            disabled={loading}
            className="min-h-[44px] px-4 py-2 rounded border border-border text-xs font-bold uppercase tracking-wider"
          >
            Crea fornitore
          </button>
          <select
            value={selectedSupplierId}
            onChange={(event) => setSelectedSupplierId(event.target.value)}
            className="px-3 py-2 rounded border border-border text-sm"
          >
            <option value="">Seleziona fornitore</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
            ))}
          </select>
        </div>

        <div className="border border-border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bg/50">
                <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-text-muted">Ingrediente</th>
                <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-text-muted">Marchio</th>
                <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-text-muted">Qta</th>
                <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-text-muted">Costo Unitario</th>
                <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-text-muted"></th>
              </tr>
            </thead>
            <tbody>
              {poItems.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-center text-xs text-text-muted">
                    {loadingPoItems ? 'Caricamento...' : 'Seleziona un fornitore per caricare gli articoli.'}
                  </td>
                </tr>
              )}
              {poItems.map((item, index) => (
                <tr key={item.ingredientId || `custom-${index}`} className="border-t border-border">
                  <td className="px-3 py-2 text-xs font-medium">
                    <input
                      value={item.itemName}
                      onChange={(event) => {
                        const updated = [...poItems];
                        updated[index] = { ...updated[index], itemName: event.target.value };
                        setPoItems(updated);
                      }}
                      className="px-2 py-1 rounded border border-border text-xs w-full"
                      placeholder="Nome articolo"
                    />
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <input
                      value={item.brandName}
                      onChange={(event) => {
                        const updated = [...poItems];
                        updated[index] = { ...updated[index], brandName: event.target.value };
                        setPoItems(updated);
                      }}
                      className="px-2 py-1 rounded border border-border text-xs w-full"
                      placeholder="Marchio"
                    />
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.orderedQty || ''}
                      onChange={(event) => {
                        const updated = [...poItems];
                        updated[index] = { ...updated[index], orderedQty: Number(event.target.value) || 0 };
                        setPoItems(updated);
                      }}
                      className="px-2 py-1 rounded border border-border text-xs w-full"
                      placeholder="0"
                    />
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unitCost || ''}
                      onChange={(event) => {
                        const updated = [...poItems];
                        updated[index] = { ...updated[index], unitCost: Number(event.target.value) || 0 };
                        setPoItems(updated);
                      }}
                      className="px-2 py-1 rounded border border-border text-xs w-full"
                      placeholder="0.00"
                    />
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <button
                      onClick={() => setPoItems(poItems.filter((_, i) => i !== index))}
                      className="px-2 py-1 rounded border border-danger text-danger text-[10px] font-bold uppercase"
                    >
                      Rimuovi
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPoItems([...poItems, { ingredientId: '', itemName: '', brandName: '', unit: 'kg', orderedQty: 0, unitCost: 0 }])}
            className="min-h-[44px] px-3 py-2 rounded border border-border text-xs font-bold uppercase"
          >
            + Aggiungi riga
          </button>
          <button
            onClick={() => void createOrderHandler()}
            disabled={loadingPoItems}
            className="px-4 py-2 rounded bg-primary text-white text-xs font-bold uppercase tracking-wider min-h-[44px]"
          >
            Crea PO
          </button>
        </div>

        {error && <p className="text-xs text-danger">{error}</p>}
        {success && <p className="text-xs text-emerald-600 font-semibold">{success}</p>}
      </div>

      {selectedSupplierId && (
        <div className="bg-white border border-border rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold uppercase tracking-wider text-text-muted">Ingredienti Fornitore</p>
            <button onClick={() => void loadSupplierIngredients(selectedSupplierId)} className="min-h-[44px] px-3 py-2 rounded border border-border text-xs font-bold uppercase" disabled={loadingIngredients}>
              {loadingIngredients ? '...' : 'Aggiorna'}
            </button>
          </div>

          {/* Add new ingredient form */}
          <div className="grid grid-cols-1 gap-2 md:grid-cols-5">
            <select
              value={newIngredientId}
              onChange={(event) => setNewIngredientId(event.target.value)}
              className="px-3 py-2 rounded border border-border text-sm"
            >
              <option value="">Seleziona ingrediente</option>
              {inventoryItems.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
            <input
              value={newBrandName}
              onChange={(event) => setNewBrandName(event.target.value)}
              placeholder="Marchio"
              className="px-3 py-2 rounded border border-border text-sm"
            />
            <input
              value={newUnitCost}
              onChange={(event) => setNewUnitCost(event.target.value.replace(/[^0-9.]/g, ''))}
              placeholder="Costo unitario"
              className="px-3 py-2 rounded border border-border text-sm"
            />
            <label className="flex items-center gap-2 px-3 py-2 rounded border border-border text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={newIsPreferred}
                onChange={(event) => setNewIsPreferred(event.target.checked)}
                className="rounded"
              />
              <span className="text-xs font-bold uppercase">Preferito</span>
            </label>
            <button
              onClick={() => void handleAddSupplierIngredient()}
              disabled={loadingIngredients}
              className="px-4 py-2 rounded bg-primary text-white text-xs font-bold uppercase tracking-wider min-h-[44px]"
            >
              Aggiungi
            </button>
          </div>

          {/* Ingredients table */}
          <div className="border border-border rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bg/50">
                  <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-text-muted">Ingrediente</th>
                  <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-text-muted">Marchio</th>
                  <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-text-muted">Costo Unitario</th>
                  <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-text-muted">Preferito</th>
                  <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-text-muted">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {supplierIngredients.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-4 text-center text-xs text-text-muted">
                      {loadingIngredients ? 'Caricamento...' : 'Nessun ingrediente collegato.'}
                    </td>
                  </tr>
                )}
                {supplierIngredients.map((ingredient) => (
                  <tr key={ingredient.ingredientId} className="border-t border-border">
                    <td className="px-3 py-2 text-xs font-medium">{ingredient.ingredientName}</td>
                    <td className="px-3 py-2 text-xs">
                      {editingIngredientId === ingredient.ingredientId ? (
                        <input
                          value={editBrandName}
                          onChange={(event) => setEditBrandName(event.target.value)}
                          className="px-2 py-1 rounded border border-border text-xs w-full"
                        />
                      ) : (
                        ingredient.brandName ?? '-'
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {editingIngredientId === ingredient.ingredientId ? (
                        <input
                          value={editUnitCost}
                          onChange={(event) => setEditUnitCost(event.target.value.replace(/[^0-9.]/g, ''))}
                          className="px-2 py-1 rounded border border-border text-xs w-full"
                        />
                      ) : (
                        ingredient.unitCost != null ? `${ingredient.unitCost.toFixed(2)}` : '-'
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {editingIngredientId === ingredient.ingredientId ? (
                        <input
                          type="checkbox"
                          checked={editIsPreferred}
                          onChange={(event) => setEditIsPreferred(event.target.checked)}
                          className="rounded"
                        />
                      ) : (
                        ingredient.isPreferred ? 'Sì' : 'No'
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {editingIngredientId === ingredient.ingredientId ? (
                        <div className="flex gap-1">
                          <button
                            onClick={() => void handleUpdateSupplierIngredient(ingredient.ingredientId)}
                            className="min-h-[44px] px-3 py-2 rounded bg-primary text-white text-xs font-bold uppercase"
                          >
                            Salva
                          </button>
                          <button
                            onClick={cancelEditing}
                            className="min-h-[44px] px-3 py-2 rounded border border-border text-xs font-bold uppercase"
                          >
                            Annulla
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-1">
                          <button
                            onClick={() => startEditing(ingredient)}
                            className="min-h-[44px] px-3 py-2 rounded border border-border text-xs font-bold uppercase"
                          >
                            Modifica
                          </button>
                          <button
                            onClick={() => setPendingDeleteIngredient(ingredient)}
                            className="min-h-[44px] px-3 py-2 rounded border border-danger text-danger text-xs font-bold uppercase"
                          >
                            Elimina
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-white border border-border rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold uppercase tracking-wider text-text-muted">Ordini Acquisto</p>
          <button onClick={() => void load()} className="min-h-[44px] px-3 py-2 rounded border border-border text-xs font-bold uppercase" disabled={loading}>{loading ? '...' : 'Aggiorna'}</button>
        </div>
        <div className="space-y-2">
          {statusOrder.map((status) => {
            const bucket = groupedByStatus.get(status) ?? [];
            return (
              <div key={status} className="border border-border rounded-lg p-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted mb-2">{status} ({bucket.length})</p>
                <div className="space-y-2">
                  {bucket.map((order) => (
                    <div key={order.id} className="border border-border rounded p-3 bg-bg/20 space-y-2">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-secondary">{order.id}</p>
                          <p className="text-xs text-text-muted">Supplier: {suppliers.find((s) => s.id === order.supplierId)?.name ?? order.supplierId}</p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full md:w-auto">
                          <button onClick={() => nextStatus(order)} className="px-2 py-2 rounded border border-border text-xs font-bold min-h-[44px]">Avanza stato</button>
                          <button onClick={() => setPendingReceiptOrderId(order.id)} className="px-2 py-2 rounded border border-border text-xs font-bold min-h-[44px]">Ricezione parziale</button>
                        </div>
                      </div>
                      {order.items.map((item) => (
                        <div key={item.id} className="text-xs text-text-muted">
                          {item.itemName} - ord: {item.orderedQty} {item.unit} / ric: {item.receivedQty}
                        </div>
                      ))}
                    </div>
                  ))}
                  {bucket.length === 0 && <p className="text-xs text-text-muted">Nessun ordine in questo stato.</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(pendingReceiptOrder)}
        title="Conferma ricezione"
        message={pendingReceiptOrder ? `Confermi ricezione parziale per ${pendingReceiptOrder.id}?` : ''}
        confirmLabel="Conferma"
        cancelLabel="Annulla"
        onCancel={() => setPendingReceiptOrderId(null)}
        onConfirm={() => {
          const order = pendingReceiptOrder;
          setPendingReceiptOrderId(null);
          if (order) {
            void partialReceive(order);
          }
        }}
      />

      <ConfirmDialog
        open={Boolean(pendingAdvance)}
        title="Avanza Stato Ordine"
        message={pendingAdvance ? `Passare l'ordine da ${pendingAdvance.order.status} a ${pendingAdvance.target}?` : ''}
        confirmLabel="Avanza"
        cancelLabel="Annulla"
        onCancel={() => setPendingAdvance(null)}
        onConfirm={() => void confirmAdvance()}
      />

      <ConfirmDialog
        open={Boolean(pendingDeleteIngredient)}
        title="Elimina Ingrediente"
        message={pendingDeleteIngredient ? `Rimuovere ${pendingDeleteIngredient.ingredientName} da questo fornitore?` : ''}
        confirmLabel="Elimina"
        cancelLabel="Annulla"
        onCancel={() => setPendingDeleteIngredient(null)}
        onConfirm={() => void handleDeleteSupplierIngredient()}
      />
    </div>
  );
}

import { useState } from 'react';
import { Table, TableCreateRequest, TableBulkCreateRequest, TableUpdateRequest } from '@gustopos/shared';
import { Plus, Trash2, Edit2, Save, X, Layers } from 'lucide-react';
import { cn } from '../lib/utils';

interface TablesManagementViewProps {
  tables: Table[];
  loading: boolean;
  onCreateTable: (payload: TableCreateRequest) => Promise<void>;
  onBulkCreateTables: (payload: TableBulkCreateRequest) => Promise<void>;
  onUpdateTable: (id: string, payload: TableUpdateRequest) => Promise<void>;
  onDeleteTable: (id: string) => Promise<void>;
}

export default function TablesManagementView({
  tables,
  loading: _loading,
  onCreateTable,
  onBulkCreateTables,
  onUpdateTable,
  onDeleteTable,
}: TablesManagementViewProps) {
  const [newTableNumber, setNewTableNumber] = useState('');
  const [newTableZone, setNewTableZone] = useState('');
  const [bulkCount, setBulkCount] = useState(5);
  const [bulkPrefix, setBulkPrefix] = useState('');
  const [bulkZone, setBulkZone] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNumber, setEditNumber] = useState('');
  const [editZone, setEditZone] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'single' | 'bulk'>('single');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const orderedTables = [...tables].sort((a, b) => {
    const aNum = Number(a.number);
    const bNum = Number(b.number);
    const aIsNum = Number.isFinite(aNum);
    const bIsNum = Number.isFinite(bNum);
    if (aIsNum && bIsNum) return aNum - bNum;
    return a.number.localeCompare(b.number, 'it', { numeric: true, sensitivity: 'base' });
  });

  // Existing zone labels, offered as suggestions (datalist) when editing.
  const existingZones = [...new Set(tables.map((t) => t.zone).filter((z): z is string => !!z))].sort((a, b) =>
    a.localeCompare(b, 'it', { sensitivity: 'base' })
  );

  const handleCreate = async () => {
    setError('');
    const num = newTableNumber.trim();
    if (!num) { setError('Inserisci un numero tavolo'); return; }
    setBusy(true);
    try {
      await onCreateTable({ number: num, ...(newTableZone.trim() ? { zone: newTableZone.trim() } : {}) });
      setNewTableNumber('');
      // Keep the zone pre-filled: consecutive creations usually share a zone.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore creazione tavolo');
    } finally {
      setBusy(false);
    }
  };

  const handleBulkCreate = async () => {
    setError('');
    if (bulkCount < 1 || bulkCount > 100) { setError('Numero tavoli: 1-100'); return; }
    setBusy(true);
    try {
      await onBulkCreateTables({ count: bulkCount, prefix: bulkPrefix, ...(bulkZone.trim() ? { zone: bulkZone.trim() } : {}) });
      setBulkCount(5);
      setBulkPrefix('');
      setBulkZone('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore creazione tavoli');
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (table: Table) => {
    setEditingId(table.id);
    setEditNumber(table.number);
    setEditZone(table.zone ?? '');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditNumber('');
    setEditZone('');
  };

  const saveEdit = async (id: string) => {
    setError('');
    const num = editNumber.trim();
    if (!num) { setError('Il numero tavolo non può essere vuoto'); return; }
    setBusy(true);
    try {
      // Empty zone string explicitly clears the zone on the server.
      await onUpdateTable(id, { number: num, zone: editZone.trim() });
      cancelEdit();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore aggiornamento tavolo');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    setError('');
    setBusy(true);
    try {
      await onDeleteTable(id);
      setDeleteConfirm(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore eliminazione tavolo');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-primary uppercase tracking-tight">Gestione Tavoli</h3>
          <p className="text-text-muted text-xs mt-1">{tables.length} tavoli configurati</p>
        </div>
      </div>

      {/* Create Section */}
      <div className="rounded-lg border border-border p-4 space-y-3">
        <div className="flex gap-2">
          <button
            onClick={() => setMode('single')}
            className={cn(
              'px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider',
              mode === 'single' ? 'bg-primary text-white' : 'border border-border'
            )}
          >
            Singolo
          </button>
          <button
            onClick={() => setMode('bulk')}
            className={cn(
              'px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider',
              mode === 'bulk' ? 'bg-primary text-white' : 'border border-border'
            )}
          >
            <Layers className="w-3 h-3 inline mr-1" />
            Bulk
          </button>
        </div>

        {mode === 'single' ? (
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                value={newTableNumber}
                onChange={(e) => setNewTableNumber(e.target.value.slice(0, 20))}
                placeholder="Numero tavolo (es. 13, A1, VIP-1)"
                className="flex-1 px-3 py-2 rounded border border-border text-sm"
                onKeyDown={(e) => e.key === 'Enter' && !busy && handleCreate()}
              />
              <button
                onClick={handleCreate}
                disabled={busy || !newTableNumber.trim()}
                className="px-4 py-2 rounded bg-primary text-white text-xs font-bold uppercase tracking-wider disabled:opacity-50 flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                Aggiungi
              </button>
            </div>
            <input
              value={newTableZone}
              onChange={(e) => setNewTableZone(e.target.value.slice(0, 30))}
              placeholder="Zona (opzionale, es. GAZEBO)"
              list="table-zone-suggestions"
              className="w-full px-3 py-2 rounded border border-border text-sm"
            />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                value={bulkPrefix}
                onChange={(e) => setBulkPrefix(e.target.value.slice(0, 10))}
                placeholder="Prefisso (opzionale, es. VIP-)"
                className="flex-1 px-3 py-2 rounded border border-border text-sm"
              />
              <input
                type="number"
                value={bulkCount}
                onChange={(e) => setBulkCount(Number(e.target.value))}
                min={1}
                max={100}
                className="w-24 px-3 py-2 rounded border border-border text-sm"
              />
              <button
                onClick={handleBulkCreate}
                disabled={busy}
                className="px-4 py-2 rounded bg-primary text-white text-xs font-bold uppercase tracking-wider disabled:opacity-50 flex items-center gap-1"
              >
                <Layers className="w-3 h-3" />
                Crea
              </button>
            </div>
            <input
              value={bulkZone}
              onChange={(e) => setBulkZone(e.target.value.slice(0, 30))}
              placeholder="Zona per tutti i tavoli creati (opzionale)"
              list="table-zone-suggestions"
              className="w-full px-3 py-2 rounded border border-border text-sm"
            />
            <p className="text-[10px] text-text-muted">
              Verranno creati {bulkCount} tavoli con numerazione automatica{bulkPrefix ? ` e prefisso "${bulkPrefix}"` : ''}{bulkZone.trim() ? ` nella zona "${bulkZone.trim()}"` : ''}
            </p>
          </div>
        )}
      </div>

      {/* Shared zone suggestions for every zone input on this page */}
      <datalist id="table-zone-suggestions">
        {existingZones.map((zone) => (
          <option key={zone} value={zone} />
        ))}
      </datalist>

      {/* Error */}
      {error && (
        <div className="rounded border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger font-semibold">
          {error}
        </div>
      )}

      {/* Tables List */}
      <div className="space-y-2">
        {orderedTables.map((table) => (
          <div key={table.id} className="flex items-center justify-between border border-border rounded-lg p-3">
            {editingId === table.id ? (
              <div className="flex items-center gap-2 flex-1">
                <input
                  value={editNumber}
                  onChange={(e) => setEditNumber(e.target.value.slice(0, 20))}
                  className="flex-1 px-3 py-1.5 rounded border border-border text-sm"
                  onKeyDown={(e) => e.key === 'Enter' && !busy && saveEdit(table.id)}
                />
                <input
                  value={editZone}
                  onChange={(e) => setEditZone(e.target.value.slice(0, 30))}
                  placeholder="Zona (vuoto = nessuna)"
                  list="table-zone-suggestions"
                  className="w-40 px-3 py-1.5 rounded border border-border text-sm"
                  onKeyDown={(e) => e.key === 'Enter' && !busy && saveEdit(table.id)}
                />
                <button
                  onClick={() => saveEdit(table.id)}
                  disabled={busy}
                  className="p-1.5 rounded bg-success text-white disabled:opacity-50"
                  title="Salva"
                >
                  <Save className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={cancelEdit}
                  className="p-1.5 rounded border border-border"
                  title="Annulla"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-bold text-primary">{table.number}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold">
                      Tavolo {table.number}
                      {table.zone && (
                        <span className="ml-2 inline-block rounded bg-accent/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-accent align-middle">
                          {table.zone}
                        </span>
                      )}
                    </p>
                    <p className="text-[10px] text-text-muted uppercase">
                      {table.status === 'free' ? 'Libero' : table.status === 'occupied' ? 'Occupato' : table.status}
                      {table.currentOrderId && ' • Ordine attivo'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => startEdit(table)}
                    className="p-1.5 rounded border border-border hover:bg-accent/10"
                    title="Modifica"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-text-muted" />
                  </button>
                  {table.status === 'free' && !table.currentOrderId && (
                    deleteConfirm === table.id ? (
                      <div className="flex items-center gap-1 ml-2">
                        <button
                          onClick={() => handleDelete(table.id)}
                          disabled={busy}
                          className="px-2 py-1 rounded bg-danger text-white text-[10px] font-bold uppercase disabled:opacity-50"
                        >
                          Conferma
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="px-2 py-1 rounded border border-border text-[10px] font-bold uppercase"
                        >
                          Annulla
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(table.id)}
                        className="p-1.5 rounded border border-border hover:bg-danger/10"
                        title="Elimina"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-danger" />
                      </button>
                    )
                  )}
                </div>
              </>
            )}
          </div>
        ))}
        {tables.length === 0 && (
          <p className="text-center text-text-muted text-sm py-8">Nessun tavolo configurato. Aggiungi il primo tavolo sopra.</p>
        )}
      </div>
    </div>
  );
}

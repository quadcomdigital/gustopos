import { useEffect, useMemo, useState } from 'react';
import { AppData } from '@gustopos/shared';
import { cn } from '../lib/utils';
import Modal from '../shared/ui/molecules/Modal';
import ConfirmDialog from './ConfirmDialog';

export type TableRelocateMode = 'move' | 'merge';

interface TableMoveMergeDialogProps {
  open: boolean;
  mode: TableRelocateMode;
  sourceTableId: string;
  data: AppData;
  onClose: () => void;
  onTransfer: (sourceTableId: string, targetTableId: string) => Promise<void>;
  onMerge: (sourceTableId: string, targetTableId: string) => Promise<void>;
}

interface TableSummary {
  items: number;
  total: number;
}

export default function TableMoveMergeDialog({
  open,
  mode,
  sourceTableId,
  data,
  onClose,
  onTransfer,
  onMerge,
}: TableMoveMergeDialogProps) {
  const [selectedTargetId, setSelectedTargetId] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const sourceTable = data.tables.find((t) => t.id === sourceTableId);

  // Reset transient state whenever the dialog opens.
  useEffect(() => {
    if (open) {
      setSelectedTargetId('');
      setConfirmOpen(false);
      setBusy(false);
      setError('');
    }
  }, [open]);

  const summaryByTable = useMemo(() => {
    const map = new Map<string, TableSummary>();
    for (const order of data.orders) {
      if (order.status === 'paid' || order.status === 'cancelled') continue;
      const tableNumber = order.table;
      if (!tableNumber) continue;
      const entry = map.get(tableNumber) ?? { items: 0, total: 0 };
      entry.total += order.total;
      entry.items += order.items.reduce((sum, item) => sum + item.quantity, 0);
      map.set(tableNumber, entry);
    }
    return map;
  }, [data.orders]);

  const targets = useMemo(
    () =>
      [...data.tables]
        .filter((t) => t.id !== sourceTableId)
        .sort((a, b) => a.number.localeCompare(b.number, 'it', { numeric: true, sensitivity: 'base' })),
    [data.tables, sourceTableId],
  );

  const isTargetEnabled = (status: string) =>
    mode === 'move' ? status === 'free' : status === 'occupied';

  const selectedTarget = targets.find((t) => t.id === selectedTargetId);

  const title =
    mode === 'move'
      ? `Sposta Tavolo ${sourceTable?.number ?? ''}`
      : `Unisci conto · Tavolo ${sourceTable?.number ?? ''}`;

  const sourceSummary = sourceTable ? summaryByTable.get(sourceTable.number) : undefined;
  const targetSummary = selectedTarget ? summaryByTable.get(selectedTarget.number) : undefined;

  const confirmMessage = useMemo(() => {
    if (!sourceTable || !selectedTarget) return '';
    if (mode === 'move') {
      return `Spostare ${sourceSummary?.items ?? 0} piatti dal tavolo ${sourceTable.number} al tavolo ${selectedTarget.number}?`;
    }
    return (
      `Unire il conto del tavolo ${sourceTable.number} ` +
      `(${sourceSummary?.items ?? 0} piatti · €${(sourceSummary?.total ?? 0).toFixed(2)}) ` +
      `con il tavolo ${selectedTarget.number} ` +
      `(${targetSummary?.items ?? 0} piatti · €${(targetSummary?.total ?? 0).toFixed(2)})?`
    );
  }, [mode, sourceTable, selectedTarget, sourceSummary, targetSummary]);

  const handleClose = () => {
    if (busy) return;
    setConfirmOpen(false);
    setError('');
    onClose();
  };

  const handleConfirm = async () => {
    if (!selectedTargetId || busy) return;
    setBusy(true);
    setError('');
    try {
      const action = mode === 'move' ? onTransfer : onMerge;
      await action(sourceTableId, selectedTargetId);
      setConfirmOpen(false);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operazione non riuscita');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Modal
        open={open}
        onClose={handleClose}
        title={title}
        size="md"
        footer={
          <button
            type="button"
            onClick={handleClose}
            disabled={busy}
            className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-lg border border-border text-xs font-bold uppercase tracking-wider disabled:opacity-50"
          >
            Annulla
          </button>
        }
      >
        <p className="text-xs text-text-muted">
          {mode === 'move'
            ? 'Seleziona un tavolo libero dove spostare gli ordini.'
            : 'Seleziona un tavolo occupato con cui unire il conto.'}
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {targets.map((table) => {
            const enabled = isTargetEnabled(table.status);
            const summary = summaryByTable.get(table.number);
            return (
              <button
                key={table.id}
                type="button"
                disabled={!enabled}
                onClick={() => {
                  setSelectedTargetId(table.id);
                  setConfirmOpen(true);
                }}
                className={cn(
                  'min-h-[56px] rounded-xl border px-3 py-2 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1',
                  enabled
                    ? 'bg-white border-border hover:border-accent active:scale-[0.98]'
                    : 'bg-bg/60 border-border opacity-40 cursor-not-allowed',
                )}
              >
                <p className="text-sm font-bold text-primary">Tavolo {table.number}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                  {table.status === 'occupied'
                    ? summary
                      ? `${summary.items} piatti · €${summary.total.toFixed(2)}`
                      : 'Occupato'
                    : table.status === 'reserved'
                      ? 'Prenotato'
                      : 'Libero'}
                </p>
              </button>
            );
          })}
        </div>

        {targets.length === 0 && (
          <p className="text-xs text-text-muted">Nessun tavolo disponibile.</p>
        )}

        {error && (
          <p className="text-xs text-danger font-semibold" role="alert">
            {error}
          </p>
        )}
      </Modal>

      <ConfirmDialog
        open={confirmOpen}
        title={mode === 'move' ? 'Conferma spostamento' : 'Conferma unione conti'}
        message={confirmMessage}
        confirmLabel={mode === 'move' ? 'Sposta' : 'Unisci'}
        onConfirm={() => void handleConfirm()}
        onCancel={() => {
          if (!busy) setConfirmOpen(false);
        }}
      />
    </>
  );
}

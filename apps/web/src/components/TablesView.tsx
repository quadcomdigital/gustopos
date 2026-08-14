import React, { useState, useMemo } from 'react';
import {
  AppData,
  SelfOrderSessionRotateResponse,
} from '@gustopos/shared';
import { cn } from '../lib/utils';
import { X, QrCode, Link as LinkIcon, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface TablesViewProps {
  data: AppData;
  onSelectTable: (tableNumber: string) => void;
  onRotateSelfOrderQr?: (tableId: string) => Promise<SelfOrderSessionRotateResponse>;
}

export default function TablesView({
  data,
  onSelectTable,
  onRotateSelfOrderQr,
}: TablesViewProps) {
  const [showQrSheet, setShowQrSheet] = useState(false);
  const [qrSelectedTableId, setQrSelectedTableId] = useState('');
  const [selfOrderQr, setSelfOrderQr] = useState<{ tableNumber: string; url: string; expiresAt: string } | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionSheetTableId, setActionSheetTableId] = useState('');

  const orderedTables = useMemo(() => {
    return [...data.tables].sort((a, b) => {
      const aNum = Number(a.number);
      const bNum = Number(b.number);
      const aIsNum = Number.isFinite(aNum);
      const bIsNum = Number.isFinite(bNum);
      if (aIsNum && bIsNum) return aNum - bNum;
      return a.number.localeCompare(b.number, 'it', { numeric: true, sensitivity: 'base' });
    });
  }, [data.tables]);

  const actionSheetTable = data.tables.find((t) => t.id === actionSheetTableId) ?? null;

  const handleRotateSelfOrderQr = async (tableId: string) => {
    if (!onRotateSelfOrderQr) return;
    setActionError('');
    setActionBusy(true);
    try {
      const payload = await onRotateSelfOrderQr(tableId);
      setSelfOrderQr({ tableNumber: payload.tableNumber, url: payload.publicUrl, expiresAt: payload.expiresAt });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Rigenerazione QR non riuscita');
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <div className="h-full flex flex-col relative">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-primary tracking-tight uppercase">Mappa Tavoli</h2>
        <p className="text-text-muted text-sm font-medium">Gestione occupazione</p>
      </div>

      {/* Table Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 overflow-y-auto pr-2 pb-20">
        {orderedTables.map((table) => {
          const tableOrders = data.orders.filter(o => o.table === table.number && o.status !== 'paid' && o.status !== 'cancelled');
          const tableTotal = tableOrders.reduce((sum, o) => sum + o.total, 0);
          return (
            <div
              key={table.id}
              onClick={() => setActionSheetTableId(table.id)}
              className={cn(
                "relative p-4 rounded-xl border transition-all flex flex-col items-center justify-center gap-2 h-32 cursor-pointer active:scale-95",
                table.status === 'occupied'
                  ? "bg-white border-accent shadow-sm"
                  : "bg-white border-border"
              )}
            >
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg",
                table.status === 'occupied' ? "bg-accent text-white" : "bg-bg text-secondary"
              )}>
                {table.number}
              </div>
              <div className="text-center">
                <p className={cn(
                  "text-[10px] font-bold uppercase tracking-widest",
                  table.status === 'occupied' ? "text-accent" : "text-text-muted"
                )}>
                  {table.status === 'occupied' ? `€${tableTotal.toFixed(2)}` : 'Libero'}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Table Actions Bottom Sheet */}
      <AnimatePresence>
        {actionSheetTable && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center bg-primary/40 backdrop-blur-sm"
            onClick={() => setActionSheetTableId('')}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="bg-white w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b border-border flex items-center justify-between">
                <h3 className="text-lg font-bold text-primary uppercase tracking-tight">
                  Tavolo {actionSheetTable.number}
                </h3>
                <button
                  onClick={() => setActionSheetTableId('')}
                  className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-bg rounded-full transition-colors text-text-muted"
                  aria-label="Chiudi"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="p-4 space-y-3">
                <button
                  onClick={() => {
                    setActionSheetTableId('');
                    onSelectTable(actionSheetTable.number);
                  }}
                  className="w-full min-h-[52px] flex items-center gap-3 px-4 rounded-xl border border-border hover:border-accent transition-colors text-left"
                >
                  <ArrowRight size={18} className="text-accent shrink-0" />
                  <span className="text-sm font-bold text-primary">Apri POS</span>
                </button>

              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Self-Order QR Info */}
      {selfOrderQr && (
        <div className="absolute bottom-16 left-0 right-0 px-4 z-40">
          <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-xs text-indigo-900 shadow-lg">
            <p className="font-bold uppercase tracking-wider">Self Order QR</p>
            <p className="mt-1">Tavolo {selfOrderQr.tableNumber} · scade alle {new Date(selfOrderQr.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
            <a href={selfOrderQr.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 underline font-semibold">
              <LinkIcon size={12} />
              Apri link self-order
            </a>
          </div>
        </div>
      )}

      {actionError && <p className="absolute bottom-16 left-0 right-0 px-4 z-40 text-sm text-danger font-semibold">{actionError}</p>}

      {/* Legend */}
      <div className="mt-auto pt-8 flex gap-6">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-bg border border-border" />
          <span className="text-xs font-medium text-text-muted">Libero</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-accent" />
          <span className="text-xs font-medium text-text-muted">Occupato</span>
        </div>
      </div>

      {/* Floating QR Button */}
      {onRotateSelfOrderQr && (
        <button
          onClick={() => { setShowQrSheet(true); setQrSelectedTableId(orderedTables[0]?.id ?? ''); }}
          className="fixed bottom-6 right-6 z-50 bg-indigo-600 text-white w-14 h-14 rounded-full shadow-xl flex items-center justify-center active:scale-95 transition-transform"
          aria-label="Genera QR Self-Order"
        >
          <QrCode size={24} />
        </button>
      )}

      {/* QR Table Selector Sheet */}
      <AnimatePresence>
        {showQrSheet && onRotateSelfOrderQr && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center bg-primary/40 backdrop-blur-sm"
            onClick={() => setShowQrSheet(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="bg-white w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b border-border flex items-center justify-between">
                <h3 className="text-lg font-bold text-primary uppercase tracking-tight">Genera QR Self-Order</h3>
                <button
                  onClick={() => setShowQrSheet(false)}
                  className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-bg rounded-full transition-colors text-text-muted"
                  aria-label="Chiudi"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="p-4 space-y-3">
                <label className="block">
                  <span className="text-xs font-bold text-text-muted uppercase tracking-wider">Seleziona Tavolo</span>
                  <select
                    value={qrSelectedTableId}
                    onChange={(e) => setQrSelectedTableId(e.target.value)}
                    className="mt-1 w-full px-3 py-2.5 rounded-xl border border-border text-sm min-h-[48px]"
                  >
                    {orderedTables.map((t) => (
                      <option key={t.id} value={t.id}>
                        Tavolo {t.number} {t.status === 'occupied' ? '(Occupato)' : '(Libero)'}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  onClick={() => {
                    if (!qrSelectedTableId) return;
                    void handleRotateSelfOrderQr(qrSelectedTableId);
                    setShowQrSheet(false);
                  }}
                  disabled={actionBusy || !qrSelectedTableId}
                  className="w-full py-3 min-h-[48px] bg-indigo-600 text-white rounded-xl text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2 active:scale-[0.97] transition-transform disabled:opacity-50"
                >
                  <QrCode size={16} />
                  {actionBusy ? 'Rigenero...' : 'Genera QR'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

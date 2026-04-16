import React, { useState } from 'react';
import { AppData, Table, OrderItem } from '../types';
import { cn } from '../lib/utils';
import { Users, Receipt, ArrowRight, X, CreditCard, Banknote } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface TablesViewProps {
  data: AppData;
  onSelectTable: (tableNumber: string) => void;
  onPayTable: (tableId: string) => void;
}

export default function TablesView({ data, onSelectTable, onPayTable }: TablesViewProps) {
  const [checkoutTable, setCheckoutTable] = useState<Table | null>(null);

  const handleCloseCheckout = () => setCheckoutTable(null);

  const handlePay = (tableId: string) => {
    onPayTable(tableId);
    setCheckoutTable(null);
  };

  return (
    <div className="h-full flex flex-col relative">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-primary tracking-tight uppercase">Mappa Tavoli</h2>
        <p className="text-text-muted text-sm font-medium">Gestione occupazione e conti</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 overflow-y-auto pr-2">
        {data.tables.map((table) => {
          const tableOrders = data.orders.filter(o => o.table === table.number && o.status !== 'paid');
          const tableTotal = tableOrders.reduce((sum, o) => sum + o.total, 0);

          return (
            <div
              key={table.id}
              onClick={() => onSelectTable(table.number)}
              className={cn(
                "relative group p-4 rounded-xl border transition-all flex flex-col items-center justify-center gap-2 h-32 cursor-pointer",
                table.status === 'occupied' 
                  ? "bg-white border-accent shadow-sm" 
                  : "bg-white border-border hover:border-accent/50"
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

              {/* Mobile Action Button (Always visible if occupied) */}
              {table.status === 'occupied' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setCheckoutTable(table);
                  }}
                  className="md:hidden absolute top-1 right-1 p-2 bg-success text-white rounded-lg shadow-sm active:scale-95 z-10"
                >
                  <Receipt size={18} />
                </button>
              )}

              {/* Desktop Hover Actions */}
              <div className="hidden md:flex absolute inset-0 bg-white/95 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex-col items-center justify-center gap-2 p-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectTable(table.number);
                  }}
                  className="w-full py-1.5 bg-accent text-white rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1"
                >
                  <ArrowRight size={12} />
                  Apri POS
                </button>
                {table.status === 'occupied' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setCheckoutTable(table);
                    }}
                    className="w-full py-1.5 bg-success text-white rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1"
                  >
                    <Receipt size={12} />
                    Chiudi Conto
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

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

      {/* Checkout Modal */}
      <AnimatePresence>
        {checkoutTable && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-primary/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="bg-white w-full max-w-md md:rounded-2xl shadow-2xl overflow-hidden flex flex-col h-full md:h-auto md:max-h-[90vh]"
            >
              <div className="p-6 border-b border-border flex items-center justify-between bg-bg/30">
                <div>
                  <h3 className="text-lg font-bold text-primary uppercase tracking-tight">Checkout Tavolo {checkoutTable.number}</h3>
                  <p className="text-xs text-text-muted font-medium">Riepilogo ordine e pagamento</p>
                </div>
                <button 
                  onClick={handleCloseCheckout}
                  className="p-2 hover:bg-white rounded-full transition-colors text-text-muted"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {data.orders
                  .filter(o => o.table === checkoutTable.number && o.status !== 'paid')
                  .map((order) => (
                    <div key={order.id} className="space-y-2">
                      <div className="flex items-center justify-between text-[10px] font-bold text-text-muted uppercase tracking-widest">
                        <span>Ordine #{order.id.slice(-4)}</span>
                        <span>{new Date(order.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div className="space-y-1">
                        {order.items.map((item, i) => (
                          <div key={i} className="flex justify-between text-sm">
                            <span className="text-secondary">
                              <span className="font-bold text-accent mr-2">{item.quantity}x</span>
                              {item.name}
                            </span>
                            <span className="font-medium">€{(item.price * item.quantity).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>

              <div className="p-6 bg-bg/30 border-t border-border space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-text-muted">
                    <span>Subtotale</span>
                    <span>€{(data.orders.filter(o => o.table === checkoutTable.number && o.status !== 'paid').reduce((s, o) => s + o.total, 0) * 0.9).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-text-muted">
                    <span>IVA (10%)</span>
                    <span>€{(data.orders.filter(o => o.table === checkoutTable.number && o.status !== 'paid').reduce((s, o) => s + o.total, 0) * 0.1).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-2xl font-bold text-primary pt-2 border-t border-border">
                    <span>Totale</span>
                    <span>€{data.orders.filter(o => o.table === checkoutTable.number && o.status !== 'paid').reduce((s, o) => s + o.total, 0).toFixed(2)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => handlePay(checkoutTable.id)}
                    className="flex flex-col items-center justify-center gap-2 py-4 bg-white border border-border rounded-xl hover:bg-bg transition-all shadow-sm group"
                  >
                    <Banknote size={24} className="text-success group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-bold uppercase tracking-wider">Contanti</span>
                  </button>
                  <button 
                    onClick={() => handlePay(checkoutTable.id)}
                    className="flex flex-col items-center justify-center gap-2 py-4 bg-accent text-white rounded-xl hover:bg-blue-700 shadow-md transition-all group"
                  >
                    <CreditCard size={24} className="group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-bold uppercase tracking-wider">Carta</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

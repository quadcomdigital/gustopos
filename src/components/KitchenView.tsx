import React from 'react';
import { Order } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, CheckCircle2, PlayCircle, UtensilsCrossed } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { it } from 'date-fns/locale';
import { cn } from '../lib/utils';

interface KitchenViewProps {
  orders: Order[];
  updateOrder: (id: string, updates: Partial<Order>) => Promise<any>;
}

export default function KitchenView({ orders, updateOrder }: KitchenViewProps) {
  const pendingOrders = orders.filter(o => o.status !== 'served' && o.status !== 'paid');

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'preparing': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'ready': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-primary tracking-tight uppercase">Cucina</h2>
          <p className="text-text-muted text-sm font-medium">{pendingOrders.length} ordini in attesa</p>
        </div>
        <div className="flex gap-3">
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-border text-[11px] font-bold uppercase tracking-wider">
            <div className="w-2 h-2 bg-amber-500 rounded-full" />
            In Attesa
          </div>
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-border text-[11px] font-bold uppercase tracking-wider">
            <div className="w-2 h-2 bg-blue-500 rounded-full" />
            In Preparazione
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6 overflow-y-auto pr-2">
        <AnimatePresence>
          {pendingOrders.map((order, index) => (
            <motion.div
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              key={order.id}
              className="bg-white rounded-xl border border-border shadow-sm overflow-hidden flex flex-col"
            >
              <div className={cn("p-4 border-b flex items-center justify-between", getStatusColor(order.status))}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-white/50 rounded-lg flex items-center justify-center font-bold text-lg">
                    {order.table}
                  </div>
                  <div>
                    <h3 className="font-bold text-xs uppercase tracking-widest">Tavolo {order.table}</h3>
                    <div className="flex items-center gap-1 text-[10px] opacity-70 font-bold uppercase">
                      <Clock size={10} />
                      <span>{formatDistanceToNow(new Date(order.timestamp), { addSuffix: true, locale: it })}</span>
                    </div>
                  </div>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-white/30">
                  #{order.id.slice(-4)}
                </span>
              </div>

              <div className="flex-1 p-4 space-y-2">
                {order.items.map((item, i) => (
                  <div key={i} className="flex items-start justify-between">
                    <div className="flex gap-2">
                      <span className="font-bold text-accent text-sm">x{item.quantity}</span>
                      <span className="font-medium text-secondary text-sm">{item.name}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-3 bg-bg/30 border-t border-border grid grid-cols-1 gap-2">
                {order.status === 'pending' && (
                  <button 
                    onClick={() => updateOrder(order.id, { status: 'preparing' })}
                    className="flex items-center justify-center gap-2 py-2.5 bg-accent text-white rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-blue-700 transition-all shadow-sm"
                  >
                    <PlayCircle size={16} />
                    Inizia Preparazione
                  </button>
                )}
                {order.status === 'preparing' && (
                  <button 
                    onClick={() => updateOrder(order.id, { status: 'ready' })}
                    className="flex items-center justify-center gap-2 py-2.5 bg-success text-white rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-green-700 transition-all shadow-sm"
                  >
                    <CheckCircle2 size={16} />
                    Pronto per il Servizio
                  </button>
                )}
                {order.status === 'ready' && (
                  <button 
                    onClick={() => updateOrder(order.id, { status: 'served' })}
                    className="flex items-center justify-center gap-2 py-2.5 bg-primary text-white rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-secondary transition-all"
                  >
                    <UtensilsCrossed size={16} />
                    Servito al Tavolo
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}


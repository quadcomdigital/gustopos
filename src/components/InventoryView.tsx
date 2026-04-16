import React from 'react';
import { Ingredient } from '../types';
import { AlertTriangle, ArrowUpRight, ArrowDownRight, Package, Plus } from 'lucide-react';

interface InventoryViewProps {
  inventory: Ingredient[];
}

export default function InventoryView({ inventory }: InventoryViewProps) {
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-primary tracking-tight uppercase">Magazzino</h2>
          <p className="text-text-muted text-sm font-medium">Gestione scorte e ingredienti</p>
        </div>
        <button className="flex items-center gap-2 px-5 py-2.5 bg-accent text-white rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-blue-700 transition-all shadow-sm">
          <Plus size={18} />
          Nuovo Ingrediente
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="panel-card">
          <div className="w-10 h-10 bg-blue-50 text-accent rounded-lg flex items-center justify-center mb-4">
            <Package size={20} />
          </div>
          <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1">Totale Articoli</p>
          <p className="text-2xl font-bold text-primary">{inventory.length}</p>
        </div>
        <div className="panel-card">
          <div className="w-10 h-10 bg-red-50 text-danger rounded-lg flex items-center justify-center mb-4">
            <AlertTriangle size={20} />
          </div>
          <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1">Sotto Soglia</p>
          <p className="text-2xl font-bold text-primary">
            {inventory.filter(i => i.quantity <= i.minThreshold).length}
          </p>
        </div>
        <div className="panel-card">
          <div className="w-10 h-10 bg-green-50 text-success rounded-lg flex items-center justify-center mb-4">
            <ArrowUpRight size={20} />
          </div>
          <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1">Valore Stimato</p>
          <p className="text-2xl font-bold text-primary">€2,450.00</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden flex-1 flex flex-col">
        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="bg-bg/50 border-b border-border">
                <th className="px-6 py-4 text-[10px] font-bold text-text-muted uppercase tracking-widest">Ingrediente</th>
                <th className="px-6 py-4 text-[10px] font-bold text-text-muted uppercase tracking-widest">Giacenza</th>
                <th className="px-6 py-4 text-[10px] font-bold text-text-muted uppercase tracking-widest">Soglia Minima</th>
                <th className="px-6 py-4 text-[10px] font-bold text-text-muted uppercase tracking-widest">Stato</th>
                <th className="px-6 py-4 text-[10px] font-bold text-text-muted uppercase tracking-widest text-right">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {inventory.map(item => {
                const isLow = item.quantity <= item.minThreshold;
                return (
                  <tr key={item.id} className="hover:bg-bg/30 transition-colors group">
                    <td className="px-6 py-4">
                      <p className="font-bold text-secondary text-sm">{item.name}</p>
                      <p className="text-[10px] text-text-muted uppercase font-bold">ID: {item.id}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-bold text-primary text-sm">{item.quantity}</span>
                      <span className="text-[10px] text-text-muted ml-1 uppercase font-bold">{item.unit}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-medium text-text-muted">{item.minThreshold} {item.unit}</span>
                    </td>
                    <td className="px-6 py-4">
                      {isLow ? (
                        <span className="badge badge-warning">Scorta Bassa</span>
                      ) : (
                        <span className="badge badge-success">Ottimale</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="text-accent font-bold text-[11px] uppercase tracking-wider hover:underline">Ordina</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden divide-y divide-border overflow-y-auto">
          {inventory.map(item => {
            const isLow = item.quantity <= item.minThreshold;
            return (
              <div key={item.id} className="p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-primary">{item.name}</p>
                    <p className="text-[9px] text-text-muted uppercase font-bold tracking-widest">ID: {item.id}</p>
                  </div>
                  {isLow ? (
                    <span className="badge badge-warning text-[9px]">Scorta Bassa</span>
                  ) : (
                    <span className="badge badge-success text-[9px]">Ottimale</span>
                  )}
                </div>
                <div className="flex justify-between items-end">
                  <div className="flex gap-4">
                    <div>
                      <p className="text-[9px] font-bold text-text-muted uppercase tracking-tighter">Giacenza</p>
                      <p className="font-bold text-accent">{item.quantity} <span className="text-[10px] text-text-muted font-medium">{item.unit}</span></p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-text-muted uppercase tracking-tighter">Soglia</p>
                      <p className="font-medium text-secondary text-sm">{item.minThreshold} {item.unit}</p>
                    </div>
                  </div>
                  <button className="px-3 py-1.5 bg-bg text-accent font-bold text-[10px] uppercase tracking-wider rounded-lg border border-border">
                    Ordina
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, ShoppingCart } from 'lucide-react';

interface ReorderSuggestion {
  ingredientId: string;
  name: string;
  sku: string | null;
  currentQty: number;
  minThreshold: number;
  unit: string;
  deficit: number;
  preferredSupplierName?: string;
  lastUnitCost?: number;
}

interface LowStockAlertProps {
  suggestions: ReorderSuggestion[];
  onCreateOrder?: (items: ReorderSuggestion[]) => void;
}

export default function LowStockAlert({ suggestions, onCreateOrder }: LowStockAlertProps) {
  const [expanded, setExpanded] = useState(false);

  if (suggestions.length === 0) return null;

  const totalEstimatedCost = suggestions.reduce((sum, s) => {
    const cost = s.lastUnitCost ?? 0;
    return sum + (s.deficit * cost);
  }, 0);

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 overflow-hidden">
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-amber-100/50 transition-colors"
      >
        <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center shrink-0">
          <AlertTriangle size={18} className="text-amber-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-amber-800">
            {suggestions.length} {suggestions.length === 1 ? 'articolo sotto soglia' : 'articoli sotto soglia'}
          </p>
          <p className="text-xs text-amber-600">
            {expanded ? 'Nascondi dettagli' : 'Clicca per vedere i dettagli'}
          </p>
        </div>
        {expanded ? <ChevronDown size={16} className="text-amber-600" /> : <ChevronRight size={16} className="text-amber-600" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-2 border-t border-amber-200">
          {suggestions.map((s) => (
            <div key={s.ingredientId} className="flex items-center justify-between py-2 border-b border-amber-200/50 last:border-0">
              <div className="min-w-0">
                <p className="text-sm font-bold text-secondary truncate">
                  {s.name}
                  {s.sku && <span className="text-xs text-text-muted ml-1">({s.sku})</span>}
                </p>
                <p className="text-xs text-text-muted">
                  {s.currentQty} {s.unit} / {s.minThreshold} {s.unit} — <span className="text-danger font-bold">-{s.deficit} {s.unit}</span>
                </p>
                {s.preferredSupplierName && (
                  <p className="text-[10px] text-text-muted">Fornitore: {s.preferredSupplierName}</p>
                )}
              </div>
              {s.lastUnitCost != null && (
                <p className="text-xs text-text-muted shrink-0 ml-2">
                  €{(s.deficit * s.lastUnitCost).toFixed(2)}
                </p>
              )}
            </div>
          ))}

          {totalEstimatedCost > 0 && (
            <div className="flex items-center justify-between pt-2 border-t border-amber-200">
              <span className="text-xs font-bold text-secondary">Totale stimato</span>
              <span className="text-sm font-bold text-primary">€{totalEstimatedCost.toFixed(2)}</span>
            </div>
          )}

          {onCreateOrder && (
            <button
              onClick={() => onCreateOrder(suggestions)}
              className="w-full mt-2 min-h-[44px] px-4 py-2 rounded-lg bg-accent text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2"
            >
              <ShoppingCart size={14} />
              Crea Ordine Acquisto
            </button>
          )}
        </div>
      )}
    </div>
  );
}

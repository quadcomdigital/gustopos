import { useMemo, useState } from 'react';
import type { StockMovement } from '@gustopos/shared';
import Drawer from '../../shared/ui/molecules/Drawer';
import { ArrowUpRight, ArrowDownRight, Calendar } from 'lucide-react';

interface StockMovementsDrawerProps {
  open: boolean;
  ingredientName: string;
  movements: StockMovement[];
  onClose: () => void;
}

const MOVEMENT_LABELS: Record<string, { label: string; color: string }> = {
  purchase_receipt: { label: 'Carico acquisto', color: 'text-success' },
  order_deduction: { label: 'Consumo ordine', color: 'text-danger' },
  order_reversal: { label: 'Storno ordine', color: 'text-warning' },
  manual_adjustment: { label: 'Regolazione manuale', color: 'text-accent' },
  prep_consumption: { label: 'Consumo preparazione', color: 'text-accent' },
};

export default function StockMovementsDrawer({
  open,
  ingredientName,
  movements,
  onClose,
}: StockMovementsDrawerProps) {
  const [filterType, setFilterType] = useState('');

  const filtered = useMemo(() => {
    if (!filterType) return movements;
    return movements.filter((m) => m.movementType === filterType);
  }, [movements, filterType]);

  const movementTypes = useMemo(() => {
    const types = new Set(movements.map((m) => m.movementType));
    return Array.from(types);
  }, [movements]);

  return (
    <Drawer open={open} onClose={onClose} title={`Movimenti: ${ingredientName}`} width="lg">
      {movementTypes.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setFilterType('')}
            className={`min-h-[44px] px-3 py-2 rounded text-[9px] font-bold uppercase tracking-wider border ${
              !filterType ? 'bg-primary text-white border-primary' : 'bg-white text-secondary border-border'
            }`}
          >
            Tutti
          </button>
          {movementTypes.map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`min-h-[44px] px-3 py-2 rounded text-[9px] font-bold uppercase tracking-wider border ${
                filterType === type ? 'bg-primary text-white border-primary' : 'bg-white text-secondary border-border'
              }`}
            >
              {MOVEMENT_LABELS[type]?.label ?? type}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-1.5">
        {filtered.length === 0 && (
          <p className="text-sm text-text-muted text-center py-8">Nessun movimento trovato.</p>
        )}
        {filtered.map((movement) => {
          const info = MOVEMENT_LABELS[movement.movementType] ?? { label: movement.movementType, color: 'text-text-muted' };
          const isPositive = movement.quantity > 0;
          return (
            <div key={movement.id} className="flex items-center gap-3 rounded border border-border px-3 py-2.5 bg-white">
              <div className={`${isPositive ? 'text-success' : 'text-danger'}`}>
                {isPositive ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-bold ${info.color}`}>{info.label}</p>
                <p className="text-[10px] text-text-muted flex items-center gap-1 mt-0.5">
                  <Calendar size={10} />
                  {new Date(movement.createdAt).toLocaleString('it-IT', {
                    day: '2-digit', month: '2-digit', year: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </p>
                {movement.notes && <p className="text-[10px] text-text-muted italic mt-0.5">{movement.notes}</p>}
              </div>
              <div className="text-right shrink-0">
                <p className={`text-sm font-bold ${isPositive ? 'text-success' : 'text-danger'}`}>
                  {isPositive ? '+' : ''}{movement.quantity}
                </p>
                <p className="text-[9px] text-text-muted">
                  {movement.previousQuantity} → {movement.newQuantity}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </Drawer>
  );
}

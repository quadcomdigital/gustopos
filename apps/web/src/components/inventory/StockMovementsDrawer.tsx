import { useMemo, useState } from 'react';
import type { StockMovement } from '@gustopos/shared';
import Drawer from '../../shared/ui/molecules/Drawer';
import { ArrowUpRight, ArrowDownRight, Calendar } from 'lucide-react';
import Skeleton from '../../shared/ui/atoms/Skeleton';
import EmptyState from '../../shared/ui/atoms/EmptyState';
import Button from '../../shared/ui/atoms/Button';

interface StockMovementsDrawerProps {
  open: boolean;
  ingredientName: string;
  movements: StockMovement[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
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
  loading = false,
  error = null,
  onRetry,
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

      <div className="space-y-1.5 tabular-nums">
        {loading && (
          <div className="space-y-1.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        )}
        {!loading && error && (
          <div role="alert" className="rounded border border-danger/30 bg-danger/5 p-4 text-center">
            <p className="text-sm font-bold text-danger">Impossibile caricare i movimenti.</p>
            <p className="text-[11px] text-text-muted mt-1">{error}</p>
            {onRetry && (
              <Button variant="secondary" size="sm" className="mt-3" onClick={onRetry}>Riprova</Button>
            )}
          </div>
        )}
        {!loading && !error && filtered.length === 0 && (
          <EmptyState
            icon={<Calendar size={24} />}
            title="Nessun movimento trovato."
            description="Non risultano movimenti di stock per questo ingrediente con i filtri selezionati."
          />
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

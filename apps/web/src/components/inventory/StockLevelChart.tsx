import { useState } from 'react';
import { BarChart3, ChevronDown, ChevronRight } from 'lucide-react';

interface StockLevelChartProps {
  inventory: Array<{
    id: string;
    name: string;
    quantity: number;
    minThreshold: number;
    unit: string;
  }>;
}

function getBarColor(percent: number): string {
  if (percent >= 100) return 'bg-success';
  if (percent >= 50) return 'bg-warning';
  return 'bg-danger';
}

function getTextColor(percent: number): string {
  if (percent >= 100) return 'text-success';
  if (percent >= 50) return 'text-warning';
  return 'text-danger';
}

export default function StockLevelChart({ inventory }: StockLevelChartProps) {
  const [isOpen, setIsOpen] = useState(false);

  const sorted = [...inventory]
    .filter((i) => i.minThreshold > 0)
    .sort((a, b) => (a.quantity / a.minThreshold) - (b.quantity / b.minThreshold));

  const criticalCount = sorted.filter((i) => (i.quantity / i.minThreshold) < 0.5).length;
  const warningCount = sorted.filter((i) => {
    const pct = i.quantity / i.minThreshold;
    return pct >= 0.5 && pct < 1;
  }).length;

  if (sorted.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-white overflow-hidden">
      <button
        onClick={() => setIsOpen((p) => !p)}
        className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-bg/30 transition-colors"
      >
        <div className="w-8 h-8 bg-accent/10 rounded-lg flex items-center justify-center shrink-0">
          <BarChart3 size={16} className="text-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-secondary uppercase tracking-wider">Livelli di Scorte</p>
          <p className="text-[10px] text-text-muted">
            {sorted.length} {sorted.length === 1 ? 'articolo' : 'articoli'} monitorati
            {criticalCount > 0 && <span className="text-danger font-bold"> · {criticalCount} critici</span>}
            {warningCount > 0 && <span className="text-warning font-bold"> · {warningCount} sotto soglia</span>}
          </p>
        </div>
        {isOpen
          ? <ChevronDown size={16} className="text-text-muted shrink-0" />
          : <ChevronRight size={16} className="text-text-muted shrink-0" />
        }
      </button>

      {isOpen && (
        <div className="px-4 pb-4 space-y-2 border-t border-border">
          <div className="pt-3 space-y-2">
            {sorted.map((item) => {
              const percent = Math.min((item.quantity / item.minThreshold) * 100, 200);
              const barWidth = Math.min(percent, 100);
              return (
                <div key={item.id} className="flex items-center gap-3">
                  <div className="w-24 sm:w-32 shrink-0">
                    <p className="text-xs font-bold text-secondary truncate">{item.name}</p>
                  </div>
                  <div className="flex-1 h-3 bg-bg rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${getBarColor(percent)}`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                  <div className="w-20 sm:w-24 shrink-0 text-right">
                    <p className={`text-[10px] font-bold ${getTextColor(percent)}`}>
                      {item.quantity}/{item.minThreshold} {item.unit}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

import { useState } from 'react';
import type { UnitConversion } from '@gustopos/shared';
import { Plus } from 'lucide-react';
import Button from '../../shared/ui/atoms/Button';

interface UnitConversionManagerProps {
  ingredientName: string;
  ingredientUnit: string;
  conversions: UnitConversion[];
  onCreateConversion: (fromUnit: string, factor: number) => Promise<void>;
  selectedUnit?: string;
  quantityPerUnit?: number;
}

export default function UnitConversionManager({
  ingredientName,
  ingredientUnit,
  conversions,
  onCreateConversion,
  selectedUnit,
  quantityPerUnit,
}: UnitConversionManagerProps) {
  const [showForm, setShowForm] = useState(false);
  const [fromUnit, setFromUnit] = useState('');
  const [factor, setFactor] = useState('');
  const [creating, setCreating] = useState(false);

  const convertedQty = (() => {
    if (!quantityPerUnit || !selectedUnit) return null;
    if (selectedUnit === ingredientUnit) return quantityPerUnit;
    const conv = conversions.find((c) => c.fromUnit === selectedUnit);
    if (!conv) return null;
    return quantityPerUnit * conv.factor;
  })();

  const unitRate = convertedQty !== null && quantityPerUnit ? convertedQty / quantityPerUnit : null;

  const handleCreate = async () => {
    if (!fromUnit.trim() || !factor) return;
    const f = Number(factor);
    if (isNaN(f) || f <= 0) return;
    setCreating(true);
    try {
      await onCreateConversion(fromUnit.trim(), f);
      setFromUnit('');
      setFactor('');
      setShowForm(false);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-3">
      {convertedQty !== null && selectedUnit && unitRate !== null && (
        <div className="bg-accent/5 border border-accent/20 rounded-lg p-3">
          <p className="text-sm text-accent font-medium">
            → {convertedQty.toFixed(3)} {ingredientUnit}
          </p>
          <p className="text-[10px] text-text-muted mt-0.5">
            1 {selectedUnit} = {unitRate.toFixed(4)} {ingredientUnit}
          </p>
        </div>
      )}

      {conversions.length > 0 && (
        <div className="bg-bg rounded-lg p-2 text-[10px] text-text-muted space-y-0.5">
          <p className="font-bold uppercase tracking-widest">Conversioni disponibili</p>
          {conversions.map((conv) => (
            <p key={conv.id}>
              1 {conv.fromUnit} = {conv.factor} {ingredientUnit}
            </p>
          ))}
        </div>
      )}

      <div className="border-t border-border pt-3">
        {!showForm ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowForm(true)}
            className="text-[10px]"
          >
            <Plus size={12} />
            Aggiungi conversione
          </Button>
        ) : (
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
              Nuova conversione per "{ingredientName}"
            </p>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <label className="text-[9px] text-text-muted block mb-0.5">1 unità =</label>
                <input
                  type="text"
                  value={fromUnit}
                  onChange={(e) => setFromUnit(e.target.value)}
                  placeholder="es. fette"
                  className="w-full px-2 py-1.5 rounded border border-border text-sm"
                />
              </div>
              <span className="text-sm text-text-muted pt-4">=</span>
              <div className="flex-1">
                <label className="text-[9px] text-text-muted block mb-0.5">Fattore</label>
                <input
                  type="number"
                  value={factor}
                  onChange={(e) => setFactor(e.target.value)}
                  placeholder="es. 0.05"
                  className="w-full px-2 py-1.5 rounded border border-border text-sm"
                  step="0.001"
                  min="0.001"
                />
              </div>
              <span className="text-sm text-text-muted pt-4">{ingredientUnit}</span>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => { setShowForm(false); setFromUnit(''); setFactor(''); }}>
                Annulla
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => void handleCreate()}
                disabled={creating || !fromUnit.trim() || !factor}
              >
                {creating ? 'Creazione...' : 'Salva'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

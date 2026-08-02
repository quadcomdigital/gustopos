import { useState } from 'react';
import type { UnitConversion } from '@gustopos/shared';
import { Plus, Trash2, ArrowLeftRight } from 'lucide-react';
import Button from '../../shared/ui/atoms/Button';

interface UnitConversionManagerProps {
  ingredientName: string;
  ingredientUnit: string;
  conversions: UnitConversion[];
  onCreateConversion: (fromUnit: string, factor: number) => Promise<void>;
  /** When provided, renders a delete button on every saved conversion. */
  onDeleteConversion?: (conversionId: string) => Promise<void>;
  selectedUnit?: string;
  quantityPerUnit?: number;
}

export default function UnitConversionManager({
  ingredientName,
  ingredientUnit,
  conversions,
  onCreateConversion,
  onDeleteConversion,
  selectedUnit,
  quantityPerUnit,
}: UnitConversionManagerProps) {
  const [showForm, setShowForm] = useState(false);
  const [fromUnit, setFromUnit] = useState('');
  const [factor, setFactor] = useState('');
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [createError, setCreateError] = useState('');

  const convertedQty = (() => {
    if (!quantityPerUnit || !selectedUnit) return null;
    if (selectedUnit === ingredientUnit) return quantityPerUnit;
    const conv = conversions.find((c) => c.fromUnit === selectedUnit);
    if (!conv) return null;
    return quantityPerUnit * conv.factor;
  })();

  const unitRate = convertedQty !== null && quantityPerUnit ? convertedQty / quantityPerUnit : null;

  // Live preview of the form being filled in: "1 fette = 0.05 kg"
  const preview = (() => {
    const f = Number(factor);
    if (!fromUnit.trim() || !factor || isNaN(f) || f <= 0) return null;
    return { from: fromUnit.trim(), factor: f };
  })();

  const validate = (): string | null => {
    const unit = fromUnit.trim();
    if (!unit) return 'Inserisci l\'unità di partenza (es. fette).';
    if (unit === ingredientUnit) {
      return `"${unit}" è già l'unità base di ${ingredientName}: una conversione deve usare un'unità diversa.`;
    }
    const duplicate = conversions.find((c) => c.fromUnit.trim().toLowerCase() === unit.toLowerCase());
    if (duplicate) {
      return `Esiste già una conversione per "${duplicate.fromUnit}" su questo ingrediente.`;
    }
    const f = Number(factor);
    if (!factor || isNaN(f) || f <= 0) {
      return 'Il fattore deve essere un numero maggiore di 0 (es. 0.05).';
    }
    return null;
  };

  const handleCreate = async () => {
    const error = validate();
    if (error) {
      setCreateError(error);
      return;
    }
    setCreateError('');
    setCreating(true);
    try {
      await onCreateConversion(fromUnit.trim(), Number(factor));
      setFromUnit('');
      setFactor('');
      setShowForm(false);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Errore creazione conversione');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (conversionId: string) => {
    if (!onDeleteConversion) return;
    // Two-step confirm: first click arms, second click executes.
    if (confirmDeleteId !== conversionId) {
      setConfirmDeleteId(conversionId);
      setCreateError('');
      return;
    }
    setConfirmDeleteId(null);
    setDeletingId(conversionId);
    setCreateError('');
    try {
      await onDeleteConversion(conversionId);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Errore eliminazione conversione');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-3">
      {/* Conversion preview when a non-base unit is selected (prep flow) */}
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

      {/* Saved conversions — always visible */}
      <div className="bg-bg rounded-lg border border-border p-3">
        <div className="flex items-center gap-1.5 mb-2">
          <ArrowLeftRight size={12} className="text-text-muted" />
          <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
            Conversioni ({conversions.length})
          </p>
        </div>
        {conversions.length === 0 ? (
          <p className="text-[11px] text-text-muted">
            Nessuna conversione per {ingredientName}. Aggiungine una per esprimere lo stock in un'altra unità (es. 1 fette = 0.05 {ingredientUnit}).
          </p>
        ) : (
          <ul className="space-y-1">
            {conversions.map((conv) => (
              <li key={conv.id} className="flex items-center justify-between gap-2 rounded bg-white border border-border px-2 py-1.5">
                <span className="text-xs text-secondary font-medium">
                  1 {conv.fromUnit} = <b>{conv.factor}</b> {ingredientUnit}
                </span>
                {onDeleteConversion && (
                  <Button
                    variant={confirmDeleteId === conv.id ? 'danger' : 'ghost'}
                    size="sm"
                    onClick={() => void handleDelete(conv.id)}
                    disabled={deletingId === conv.id}
                    aria-label={`Elimina conversione ${conv.fromUnit}`}
                    className="!p-1"
                  >
                    {confirmDeleteId === conv.id ? (
                      <span className="text-[10px] font-bold px-1">Conferma?</span>
                    ) : (
                      <Trash2 size={12} className="text-danger" />
                    )}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {createError && (
        <p className="text-[10px] text-danger mt-1" role="alert">{createError}</p>
      )}

      <div className="border-t border-border pt-3">
        {!showForm ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setShowForm(true); setCreateError(''); }}
            className="text-[10px]"
          >
            <Plus size={12} />
            Aggiungi conversione
          </Button>
        ) : (
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
              Nuova conversione per "{ingredientName}" (unità base: {ingredientUnit})
            </p>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="text-[9px] text-text-muted block mb-0.5">1 unità (es. fette, pz)</label>
                <input
                  type="text"
                  value={fromUnit}
                  onChange={(e) => { setFromUnit(e.target.value); setCreateError(''); }}
                  placeholder="es. fette"
                  className="w-full px-2 py-1.5 rounded border border-border text-sm"
                />
              </div>
              <span className="text-sm text-text-muted pb-2">=</span>
              <div className="flex-1">
                <label className="text-[9px] text-text-muted block mb-0.5">Fattore (in {ingredientUnit})</label>
                <input
                  type="number"
                  value={factor}
                  onChange={(e) => { setFactor(e.target.value); setCreateError(''); }}
                  placeholder="es. 0.05"
                  className="w-full px-2 py-1.5 rounded border border-border text-sm"
                  step="0.001"
                  min="0.001"
                />
              </div>
            </div>
            {preview && (
              <p className="text-[11px] text-accent font-medium bg-accent/5 border border-accent/20 rounded px-2 py-1">
                1 {preview.from} = {preview.factor} {ingredientUnit}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => { setShowForm(false); setFromUnit(''); setFactor(''); setCreateError(''); }}>
                Annulla
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => void handleCreate()}
                disabled={creating}
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

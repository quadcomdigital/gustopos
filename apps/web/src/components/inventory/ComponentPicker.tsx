import { Plus } from 'lucide-react';
import UnitSelect from '../../shared/ui/molecules/UnitSelect';
import { useMemo, useState, useRef, useEffect } from 'react';
import type { UnitConversion } from '@gustopos/shared';

interface ComponentCandidate {
  id: string;
  label: string;
  unit: string;
  stockLevel?: number;
  unitCost?: number;
}

interface ComponentPickerProps {
  candidates: ComponentCandidate[];
  type: 'ingredient' | 'bom' | 'prep';
  onTypeChange: (type: 'ingredient' | 'bom' | 'prep') => void;
  selectedId: string;
  onSelect: (id: string) => void;
  qty: string;
  onQtyChange: (qty: string) => void;
  unit: string;
  onUnitChange: (unit: string) => void;
  onAdd: () => void;
  searchPlaceholder?: string;
  disabled?: boolean;
  /** Map of ingredientId → unit conversions for the unit dropdown */
  conversionsMap?: Record<string, UnitConversion[]>;
}

export default function ComponentPicker({
  candidates,
  type,
  onTypeChange,
  selectedId,
  onSelect,
  qty,
  onQtyChange,
  unit,
  onUnitChange,
  onAdd,
  searchPlaceholder = 'Cerca componente...',
  disabled = false,
  conversionsMap = {},
}: ComponentPickerProps) {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return candidates.filter((c) => c.label.toLowerCase().includes(q));
  }, [candidates, search]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- [controlled-reset] resets highlight on search change; safe because setter receives a constant primitive
    setHighlightIndex(-1);
  }, [search]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (listRef.current && !listRef.current.contains(e.target as Node) && inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const selectedCandidate = candidates.find((c) => c.id === selectedId);

  // Build extra unit options for the UnitSelect when an ingredient is selected
  const unitExtraOptions = useMemo(() => {
    const convs = type === 'ingredient' && selectedId ? conversionsMap[selectedId] ?? [] : [];
    return convs.map((c) => ({
      value: c.fromUnit,
      label: c.fromUnit,
      category: 'Conversioni',
    }));
  }, [type, selectedId, conversionsMap]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((prev) => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightIndex >= 0 && filtered[highlightIndex]) {
        onSelect(filtered[highlightIndex].id);
        onUnitChange(filtered[highlightIndex].unit);
        setSearch('');
        setIsOpen(false);
      } else if (selectedId) {
        onAdd();
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setSearch('');
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
      <select
        value={type}
        onChange={(e) => onTypeChange(e.target.value as 'ingredient' | 'bom' | 'prep')}
        className="px-3 py-2 rounded border border-border text-sm"
      >
        <option value="ingredient">Ingrediente</option>
        <option value="bom">BoM</option>
        <option value="prep">Prep</option>
      </select>

      <div className="relative">
        <input
          ref={inputRef}
          value={isOpen ? search : (selectedCandidate?.label ?? '')}
          onChange={(e) => {
            setSearch(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={searchPlaceholder}
          className="px-3 py-2 rounded border border-border text-sm w-full"
        />
        {isOpen && filtered.length > 0 && (
          <div
            ref={listRef}
            className="absolute z-50 mt-1 w-full bg-white border border-border rounded shadow-lg max-h-60 overflow-auto"
          >
            {filtered.map((candidate, idx) => (
              <button
                key={candidate.id}
                type="button"
                onClick={() => {
                  onSelect(candidate.id);
                  onUnitChange(candidate.unit);
                  setSearch('');
                  setIsOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-bg/50 flex items-center justify-between ${
                  idx === highlightIndex ? 'bg-bg/50' : ''
                }`}
              >
                <span className="truncate">{candidate.label}</span>
                <span className="text-[10px] text-text-muted font-bold ml-2 shrink-0">
                  {candidate.stockLevel !== undefined && `${candidate.stockLevel} ${candidate.unit}`}
                  {candidate.unitCost !== undefined && candidate.unitCost > 0 && ` · €${candidate.unitCost.toFixed(2)}`}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <input
        value={qty}
        onChange={(e) => onQtyChange(e.target.value.replace(/[^0-9.]/g, ''))}
        placeholder="Qty"
        className="px-3 py-2 rounded border border-border text-sm"
      />

      <div className="flex gap-2">
        <UnitSelect
          value={unit}
          onChange={onUnitChange}
          extraUnits={unitExtraOptions}
          placeholder="Unità"
          className="flex-1"
        />
        <button
          type="button"
          onClick={onAdd}
          disabled={disabled || !selectedId}
          className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded border border-border text-xs font-bold uppercase tracking-wider disabled:opacity-50"
        >
          <Plus size={12} />
          Aggiungi
        </button>
      </div>
    </div>
  );
}
import { useState, useRef, useEffect, useMemo } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { cn } from '../../../lib/utils';

const PREDEFINED_UNITS = [
  { value: 'kg', label: 'kg', category: 'Peso' },
  { value: 'g', label: 'g', category: 'Peso' },
  { value: 'mg', label: 'mg', category: 'Peso' },
  { value: 'L', label: 'L', category: 'Volume' },
  { value: 'cl', label: 'cl', category: 'Volume' },
  { value: 'ml', label: 'ml', category: 'Volume' },
  { value: 'pz', label: 'pz', category: 'Quantità' },
  { value: 'bt', label: 'bt (bottiglie)', category: 'Quantità' },
  { value: 'mt', label: 'mt (mastelli)', category: 'Quantità' },
  { value: 'ct', label: 'ct (cartoni)', category: 'Quantità' },
  { value: 'sc', label: 'sc (sacchi)', category: 'Quantità' },
];

interface UnitSelectProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  /** Additional (dynamic) units to show in the dropdown, e.g. from ingredient unit conversions */
  extraUnits?: Array<{ value: string; label: string; category: string }>;
  /** Forwarded to the root wrapper so a sibling `<label htmlFor={id}>` can reference it. */
  id?: string;
  /** Forwarded to the main trigger button for screen-reader announcement. */
  ariaLabel?: string;
}

export default function UnitSelect({ value, onChange, placeholder = 'Unità', className, extraUnits, id, ariaLabel }: UnitSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const allUnits = useMemo(() => {
    if (!extraUnits || extraUnits.length === 0) return PREDEFINED_UNITS;
    // Merge extra units in, avoiding duplicates by value
    const existingValues = new Set(PREDEFINED_UNITS.map((u) => u.value));
    return [...PREDEFINED_UNITS, ...extraUnits.filter((u) => !existingValues.has(u.value))];
  }, [extraUnits]);

  const isCustom = value && !allUnits.some((u) => u.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allUnits;
    return allUnits.filter((u) => u.label.toLowerCase().includes(q) || u.category.toLowerCase().includes(q));
  }, [query, allUnits]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setQuery('');
      }
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- [controlled-reset] resets highlight on query change; safe because setter receives a constant primitive
    setHighlightedIndex(0);
  }, [query, filtered.length]);

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        id={id}
        aria-label={ariaLabel}
        onClick={() => {
          setIsOpen((prev) => !prev);
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
        className="w-full min-h-11 px-3 py-2 rounded border border-border bg-white text-left text-sm flex items-center justify-between focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:border-accent"
      >
        <span className={value ? 'text-secondary' : 'text-text-muted'}>
          {isCustom ? `${value} (custom)` : value || placeholder}
        </span>
        <ChevronDown size={16} className="text-text-muted shrink-0" />
      </button>
      {isOpen && (
        <div className="absolute z-30 mt-1 w-full rounded border border-border bg-white shadow-lg p-2 space-y-2">
          <div className="flex items-center gap-2 px-2 py-1 rounded border border-border">
            <Search size={14} className="text-text-muted" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label={ariaLabel ?? 'Cerca unit\u00e0'}
              onKeyDown={(e) => {
                if (e.key === 'Escape') { setIsOpen(false); setQuery(''); return; }
                if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightedIndex((p) => Math.min(p + 1, Math.max(filtered.length - 1, 0))); }
                if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightedIndex((p) => Math.max(p - 1, 0)); }
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (filtered[highlightedIndex]) {
                    onChange(filtered[highlightedIndex].value);
                    setIsOpen(false);
                    setQuery('');
                  } else if (query.trim()) {
                    onChange(query.trim());
                    setIsOpen(false);
                    setQuery('');
                  }
                }
              }}
              placeholder="Cerca o digita un'unità..."
              className="w-full text-sm outline-none bg-transparent focus-visible:ring-0"
            />
          </div>
          <div className="max-h-56 overflow-y-auto space-y-1">
            {filtered.map((unit, index) => (
              <button
                key={unit.value}
                type="button"
                onClick={() => { onChange(unit.value); setIsOpen(false); setQuery(''); }}
                className={cn(
                  'w-full flex items-center justify-between text-left px-2 py-2 rounded text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset',
                  index === highlightedIndex && 'bg-bg',
                )}
              >
                <span>{unit.label}</span>
                {value === unit.value && <Check size={14} className="text-accent" />}
              </button>
            ))}
            {filtered.length === 0 && query.trim() && (
              <button
                type="button"
                onClick={() => { onChange(query.trim()); setIsOpen(false); setQuery(''); }}
                className="w-full text-left px-2 py-2 rounded text-sm text-accent hover:bg-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
              >
                Usa "{query.trim()}" come unità personalizzata
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

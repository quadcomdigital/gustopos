import { useState, useRef, useEffect, useMemo } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { cn } from '../../../lib/utils';

interface SearchableSelectProps<T> {
  items: T[];
  getLabel: (item: T) => string;
  getValue: (item: T) => string;
  selectedValue?: string;
  onSelect: (value: string) => void;
  placeholder?: string;
  emptyText?: string;
  className?: string;
  /** Forwarded to the root wrapper so a sibling `<label htmlFor={id}>` can reference it. */
  id?: string;
  /** Forwarded to the main trigger button for screen-reader announcement. */
  ariaLabel?: string;
  /** Shown on the trigger when no item matches selectedValue but a label exists
   *  (e.g. modifier options with no inventory/component id: gusti gelato, gin a scelta). */
  fallbackLabel?: string;
}

export default function SearchableSelect<T>({
  items,
  getLabel,
  getValue,
  selectedValue,
  onSelect,
  placeholder = 'Cerca...',
  emptyText = 'Nessun risultato',
  className,
  id,
  ariaLabel,
  fallbackLabel,
}: SearchableSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const selectedLabel = useMemo(() => {
    if (!selectedValue) return null;
    const item = items.find((i) => getValue(i) === selectedValue);
    return item ? getLabel(item) : null;
  }, [items, selectedValue, getValue, getLabel]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => getLabel(item).toLowerCase().includes(q));
  }, [items, query, getLabel]);

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
        <span className={selectedLabel || fallbackLabel ? 'text-secondary' : 'text-text-muted'}>
          {selectedLabel ?? fallbackLabel ?? placeholder}
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
              aria-label={ariaLabel ?? 'Cerca'}
              onKeyDown={(e) => {
                if (e.key === 'Escape') { setIsOpen(false); setQuery(''); return; }
                if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightedIndex((p) => Math.min(p + 1, Math.max(filtered.length - 1, 0))); }
                if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightedIndex((p) => Math.max(p - 1, 0)); }
                if (e.key === 'Enter' && filtered[highlightedIndex]) {
                  e.preventDefault();
                  onSelect(getValue(filtered[highlightedIndex]));
                  setIsOpen(false);
                  setQuery('');
                }
              }}
              placeholder={placeholder}
              className="w-full text-sm outline-none bg-transparent focus-visible:ring-0"
            />
          </div>
          <div className="max-h-56 overflow-y-auto space-y-1">
            {filtered.map((item, index) => {
              const value = getValue(item);
              return (
                <button
                  key={value}
                  type="button"
                  role="option"
                  aria-selected={selectedValue === value}
                  onClick={() => { onSelect(value); setIsOpen(false); setQuery(''); }}
                  className={cn(
                    'w-full flex items-center justify-between text-left px-2 py-2 rounded text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset',
                    index === highlightedIndex && 'bg-bg',
                  )}
                >
                  <span>{getLabel(item)}</span>
                  {selectedValue === value && <Check size={14} className="text-accent" />}
                </button>
              );
            })}
            {filtered.length === 0 && <p className="text-xs text-text-muted px-2 py-1">{emptyText}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

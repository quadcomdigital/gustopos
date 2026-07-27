import { useState, useRef, useEffect, useMemo } from 'react';
import { Check, ChevronDown, Plus, Search } from 'lucide-react';
import type { Category } from '@gustopos/shared';
import { cn } from '../../lib/utils';
import Modal from '../../shared/ui/molecules/Modal';

interface InlineCategoryPickerProps {
  categories: Category[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onCreate: (name: string) => Promise<void>;
  placeholder?: string;
  label?: string;
  className?: string;
}

export default function InlineCategoryPicker({
  categories,
  selectedId,
  onSelect,
  onCreate,
  placeholder = 'Cerca categoria...',
  label = 'Categoria',
  className,
}: InlineCategoryPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createName, setCreateName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const selected = categories.find((c) => c.id === selectedId) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((c) => c.name.toLowerCase().includes(q));
  }, [categories, query]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [query, filtered.length]);

  const handleCreate = async () => {
    const name = createName.trim();
    if (name.length < 2) return;
    setIsCreating(true);
    try {
      await onCreate(name);
      setShowCreateModal(false);
      setCreateName('');
      setIsOpen(false);
    } catch {
      /* error handled by parent */
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted">{label}</label>
      <button
        type="button"
        onClick={() => {
          setIsOpen((prev) => !prev);
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
        className="w-full min-h-11 px-3 py-2 rounded border border-border bg-white text-left text-sm flex items-center justify-between mt-1"
      >
        <span className={selected ? 'text-secondary' : 'text-text-muted'}>
          {selected?.name ?? 'Seleziona categoria'}
        </span>
        <ChevronDown size={16} className="text-text-muted" />
      </button>
      {isOpen && (
        <div className="absolute z-30 mt-1 w-full rounded border border-border bg-white shadow-lg p-2 space-y-2">
          <div className="flex items-center gap-2 px-2 py-1 rounded border border-border">
            <Search size={14} className="text-text-muted" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') { setIsOpen(false); return; }
                if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightedIndex((p) => Math.min(p + 1, Math.max(filtered.length - 1, 0))); }
                if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightedIndex((p) => Math.max(p - 1, 0)); }
                if (e.key === 'Enter' && filtered[highlightedIndex]) {
                  e.preventDefault();
                  onSelect(filtered[highlightedIndex].id);
                  setIsOpen(false);
                }
              }}
              placeholder={placeholder}
              className="w-full text-sm outline-none bg-transparent"
            />
          </div>
          <div className="max-h-56 overflow-y-auto space-y-1">
            {filtered.map((entry, index) => (
              <button
                key={entry.id}
                type="button"
                role="option"
                aria-selected={selectedId === entry.id}
                onClick={() => { onSelect(entry.id); setIsOpen(false); }}
                className={`w-full flex items-center justify-between text-left px-2 py-2 rounded text-sm ${index === highlightedIndex ? 'bg-bg' : ''}`}
              >
                <span>{entry.name}</span>
                {selectedId === entry.id && <Check size={14} className="text-accent" />}
              </button>
            ))}
            {filtered.length === 0 && <p className="text-xs text-text-muted px-2 py-1">Nessuna categoria trovata.</p>}
          </div>
          <button
            type="button"
            onClick={() => { setShowCreateModal(true); setCreateName(query); }}
            className="w-full min-h-11 inline-flex items-center justify-center gap-2 px-2 py-2 rounded border border-dashed border-accent text-xs font-bold uppercase tracking-wider text-accent hover:bg-accent/5"
          >
            <Plus size={12} />
            Nuova categoria
          </button>
        </div>
      )}

      <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} title="Nuova categoria" size="sm">
        <input
          value={createName}
          onChange={(e) => setCreateName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void handleCreate(); }}
          placeholder="Nome categoria"
          className="w-full px-3 py-2 rounded border border-border text-sm"
          autoFocus
        />
        <div className="flex justify-end gap-2 mt-3">
          <button onClick={() => setShowCreateModal(false)} className="min-h-[44px] px-3 py-2 rounded border border-border text-xs font-bold uppercase tracking-wider">
            Annulla
          </button>
          <button onClick={() => void handleCreate()} disabled={isCreating || createName.trim().length < 2} className="min-h-[44px] px-3 py-2 rounded bg-accent text-white text-xs font-bold uppercase tracking-wider disabled:opacity-60">
            {isCreating ? 'Creazione...' : 'Crea'}
          </button>
        </div>
      </Modal>
    </div>
  );
}

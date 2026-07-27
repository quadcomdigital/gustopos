import type { Category } from '@gustopos/shared';
import { Plus, RotateCcw, Save, ChevronDown, Search, Tag, Package, Layers, UtensilsCrossed } from 'lucide-react';
import { useMemo, useState } from 'react';
import Modal from '../../shared/ui/molecules/Modal';
import SectionHeader from '../../shared/ui/molecules/SectionHeader';
import Button from '../../shared/ui/atoms/Button';
import StatusPill from '../../shared/ui/atoms/StatusPill';
import Skeleton from '../../shared/ui/atoms/Skeleton';
import { useDebounce } from '../../hooks/useDebounce';
import { required, minLength, getErrorClass, type ValidationErrors } from '../../shared/ui/hooks/useFieldValidation';
import { useConfirm } from '../../shared/ui/hooks/useConfirm';
import ConfirmDialog from '../ConfirmDialog';
import EmptyState from '../../shared/ui/atoms/EmptyState';

const PRINT_AREA_LABELS: Record<string, string> = {
  kitchen: 'Cucina',
  bar: 'Bar',
  cashier: 'Cassa',
};

interface CategoriesTabProps {
  categories: Category[];
  simpleCatalogMode?: boolean;
  loading?: boolean;
  onRefresh?: () => Promise<void>;
  onCreate?: (payload: { name: string; scope: Category['scope']; printAreas: Array<'kitchen' | 'bar' | 'cashier'> }) => Promise<void>;
  onUpdate?: (id: string, payload: { name?: string; isActive?: boolean; printAreas?: Array<'kitchen' | 'bar' | 'cashier'> }) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}

export default function CategoriesTab({
  categories,
  simpleCatalogMode = false,
  loading = false,
  onRefresh,
  onCreate,
  onUpdate,
  onDelete,
}: CategoriesTabProps) {
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryScope, setNewCategoryScope] = useState<Category['scope']>(simpleCatalogMode ? 'menu' : 'ingredient');
  const [newCategoryPrintAreas, setNewCategoryPrintAreas] = useState<Array<'kitchen' | 'bar' | 'cashier'>>(['kitchen']);

  const [editingCategoryId, setEditingCategoryId] = useState('');
  const [editCategoryName, setEditCategoryName] = useState('');
  const [editCategoryPrintAreas, setEditCategoryPrintAreas] = useState<Array<'kitchen' | 'bar' | 'cashier'>>(['kitchen']);
  const [createErrors, setCreateErrors] = useState<ValidationErrors>({});
  const [editErrors, setEditErrors] = useState<ValidationErrors>({});
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 250);

  const filteredCategories = useMemo(() => {
    if (!debouncedSearch.trim()) return categories;
    const q = debouncedSearch.trim().toLowerCase();
    return categories.filter((c) => c.name.toLowerCase().includes(q));
  }, [categories, debouncedSearch]);

  const editingCategory = useMemo(
    () => categories.find((c) => c.id === editingCategoryId) ?? null,
    [categories, editingCategoryId],
  );

  const editModalDirty = useMemo(() => {
    if (!editingCategory) return false;
    return (
      editCategoryName.trim() !== editingCategory.name
      || JSON.stringify(editCategoryPrintAreas) !== JSON.stringify(editingCategory.printAreas)
    );
  }, [editingCategory, editCategoryName, editCategoryPrintAreas]);

  const scopes: Category['scope'][] = ['ingredient', 'bom', 'menu'];
  const { confirm, requestConfirm, handleConfirm, handleCancel } = useConfirm();

  const createCategory = async () => {
    if (!onCreate) return;
    const errors: ValidationErrors = {};
    errors.name = required(newCategoryName, 'Nome') ?? minLength(newCategoryName, 2, 'Nome');
    setCreateErrors(errors);
    if (Object.values(errors).some(Boolean)) return;
    const name = newCategoryName.trim();
    const printAreas = (newCategoryPrintAreas.length > 0 ? newCategoryPrintAreas : ['kitchen']) as ('kitchen' | 'bar' | 'cashier')[];
    try {
      await onCreate({ name, scope: newCategoryScope, printAreas });
      setNewCategoryName('');
      setNewCategoryPrintAreas(['kitchen']);
      setCreateErrors({});
      setShowCreateForm(false);
      void onRefresh?.();
    } catch {
      // Error already handled by store
    }
  };

  const startEdit = (category: Category) => {
    setEditingCategoryId(category.id);
    setEditCategoryName(category.name);
    setEditCategoryPrintAreas([...category.printAreas]);
  };

  const saveEdit = async () => {
    if (!editingCategory || !onUpdate) return;
    const errors: ValidationErrors = {};
    errors.name = required(editCategoryName, 'Nome') ?? minLength(editCategoryName, 2, 'Nome');
    setEditErrors(errors);
    if (Object.values(errors).some(Boolean)) return;
    await onUpdate(editingCategory.id, {
      name: editCategoryName.trim(),
      printAreas: editCategoryPrintAreas.length > 0 ? editCategoryPrintAreas : ['kitchen'],
    });
    setEditingCategoryId('');
    void onRefresh?.();
  };

  const removeCategory = async (id: string) => {
    if (!onDelete) return;
    requestConfirm('Eliminare questa categoria?', async () => {
      await onDelete(id);
      if (editingCategoryId === id) setEditingCategoryId('');
      void onRefresh?.();
    });
  };

  return (
    <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
      <SectionHeader
        title={simpleCatalogMode ? 'Categorie Catalogo' : 'Categorie'}
        actions={
          <Button variant="secondary" onClick={() => void onRefresh?.()}>
            <RotateCcw size={14} />
            Refresh
          </Button>
        }
      />

      {/* Search */}
      <div className="px-4 py-2 border-b border-border bg-bg/20">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cerca categoria..."
            className="w-full pl-8 pr-3 py-2 rounded border border-border text-sm"
          />
        </div>
      </div>

      {/* Create Form Toggle */}
      <div className="border-b border-border bg-bg/20">
        <button
          onClick={() => setShowCreateForm((p) => !p)}
          className="w-full px-4 py-3 flex items-center gap-2 text-left hover:bg-bg/30 transition-colors"
        >
          <Plus size={16} className="text-accent" />
          <span className="text-xs font-bold uppercase tracking-wider text-secondary">Nuova categoria</span>
          <ChevronDown size={14} className={`ml-auto text-text-muted transition-transform ${showCreateForm ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Create Form */}
      {showCreateForm && (
      <div className="p-4 grid grid-cols-1 md:grid-cols-4 gap-2 border-b border-border">
        <div>
          <input
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder="Nuova categoria"
            className={`px-3 py-2 rounded border border-border text-sm w-full ${getErrorClass(createErrors.name)}`}
          />
          {createErrors.name && <p className="text-[9px] text-danger mt-0.5">{createErrors.name.message}</p>}
        </div>
        <select
          value={newCategoryScope}
          onChange={(e) => setNewCategoryScope(e.target.value as Category['scope'])}
          disabled={simpleCatalogMode}
          className="px-3 py-2 rounded border border-border text-sm"
        >
          {scopes.map((s) => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
        <div className="md:col-span-2 flex flex-wrap gap-2 items-center">
          {(['kitchen', 'bar', 'cashier'] as const).map((area) => (
            <button
              key={`new-cat-area-${area}`}
              onClick={() => setNewCategoryPrintAreas((prev) => prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area])}
              className={`px-3 py-2 rounded-full text-[11px] font-bold uppercase tracking-wider border ${
                newCategoryPrintAreas.includes(area) ? 'bg-accent text-white border-accent' : 'bg-white text-secondary border-border'
              }`}
            >
              {PRINT_AREA_LABELS[area] ?? area}
            </button>
          ))}
        </div>
        <Button variant="primary" onClick={() => void createCategory()}>
          <Plus size={14} />
          Crea
        </Button>

      </div>
      )}

      {/* Category list grouped by scope */}
      <div className="p-4 space-y-4">
        {filteredCategories.length === 0 && (
          loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : (
            <EmptyState
              icon={<Tag size={24} />}
              title={searchQuery ? 'Nessuna categoria corrisponde alla ricerca.' : 'Nessuna categoria configurata.'}
              description={!searchQuery ? 'Crea la prima categoria per iniziare.' : undefined}
            />
          )
        )}
        {(['ingredient', 'bom', 'menu'] as const).map((scope) => {
          const scopeCategories = filteredCategories.filter((c) => c.scope === scope);
          if (scopeCategories.length === 0) return null;
          const scopeLabel = scope === 'ingredient' ? 'Ingredienti' : scope === 'bom' ? 'BoM' : 'Menu';
          const ScopeIcon = scope === 'ingredient' ? Package : scope === 'bom' ? Layers : UtensilsCrossed;
          return (
            <div key={scope}>
              <div className="flex items-center gap-2 mb-2">
                <ScopeIcon size={14} className="text-text-muted" />
                <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
                  {scopeLabel} <span className="text-text-muted/60">({scopeCategories.length})</span>
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {scopeCategories.map((category) => (
                  <div key={category.id} className="flex items-center gap-1.5 rounded-full border border-border px-2 py-1 bg-white">
                    <StatusPill
                      label={category.name}
                      tone={category.isActive ? 'success' : 'neutral'}
                    />
                    {(['kitchen', 'bar', 'cashier'] as const).map((area) => (
                      <button
                        key={`${category.id}-${area}`}
                        onClick={() => void onUpdate?.(category.id, {
                          printAreas: category.printAreas.includes(area) ? category.printAreas.filter((a) => a !== area) : [...category.printAreas, area],
                        })}
                        className={`min-h-[44px] px-3 py-2 rounded-full text-xs font-bold uppercase tracking-wider border ${
                          category.printAreas.includes(area) ? 'bg-accent text-white border-accent' : 'bg-white text-secondary border-border'
                        }`}
                      >
                        {PRINT_AREA_LABELS[area] ?? area}
                      </button>
                    ))}
                    <Button variant="secondary" onClick={() => startEdit(category)}>
                      Modifica
                    </Button>
                    <Button variant="danger" onClick={() => void removeCategory(category.id)}>
                      Elimina
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit Modal */}
      <Modal
        open={!!editingCategory}
        onClose={() => setEditingCategoryId('')}
        title={editingCategory ? `Editor: ${editingCategory.name}` : ''}
        size="sm"
        dirty={editModalDirty}
        footer={
          <>
            <Button variant="primary" onClick={() => void saveEdit()}>
              <Save size={14} />
              Salva
            </Button>
            <Button variant="secondary" onClick={() => setEditingCategoryId('')}>
              Annulla
            </Button>
          </>
        }
      >
        {editingCategory && (
          <div className="grid grid-cols-1 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Nome</label>
              <input value={editCategoryName} onChange={(e) => setEditCategoryName(e.target.value)} className={`px-3 py-2 rounded border border-border text-sm ${getErrorClass(editErrors.name)}`} />
              {editErrors.name && <p className="text-[9px] text-danger">{editErrors.name.message}</p>}
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Aree di stampa</label>
              <div className="flex gap-2">
                {(['kitchen', 'bar', 'cashier'] as const).map((area) => (
                  <button
                    key={`edit-area-${area}`}
                    onClick={() => setEditCategoryPrintAreas((prev) => prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area])}
                    className={`px-3 py-2 rounded-full text-[11px] font-bold uppercase tracking-wider border ${
                      editCategoryPrintAreas.includes(area) ? 'bg-accent text-white border-accent' : 'bg-white text-secondary border-border'
                    }`}
                  >
                    {PRINT_AREA_LABELS[area] ?? area}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3 pt-2 border-t border-border">
              <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Stato</label>
              <Button
                variant={editingCategory.isActive ? 'primary' : 'secondary'}
                onClick={() => void onUpdate?.(editingCategory.id, { isActive: !editingCategory.isActive })}
              >
                {editingCategory.isActive ? 'Attivo' : 'Inattivo'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!confirm}
        title="Conferma"
        message={confirm?.message ?? ''}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </div>
  );
}

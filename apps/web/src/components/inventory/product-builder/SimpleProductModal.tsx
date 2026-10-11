import { useState, useMemo, useEffect } from 'react';
import type { Category, Ingredient, PrepItem, MenuItemAdmin, MenuItemCreateRequest, MenuItemUpdateRequest, CanonicalCreateMenuProductRequest, ModifierGroup, CategoryModifierPool, MenuRecipeComponent, CanonicalUnit } from '@gustopos/shared';
import { Plus, X } from 'lucide-react';
import Modal from '../../../shared/ui/molecules/Modal';
import Button from '../../../shared/ui/atoms/Button';
import SaveFooter from '../../../shared/ui/molecules/SaveFooter';
import InlineCategoryPicker from '../InlineCategoryPicker';
import ModifierGroupsEditor from '../ModifierGroupsEditor';
import FormField from '../../../shared/ui/molecules/FormField';
import { usePrintStations } from '../usePrintStations';
import { useProductionReferences } from '../useProductionReferences';
import { required, minLength, maxLength, positiveNumber, getErrorClass, type ValidationErrors } from '../../../shared/ui/hooks/useFieldValidation';
import { TICKET_NAME_MAX_LENGTH } from '@gustopos/shared';

interface SimpleProductModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  categories: Category[];
  inventory: Ingredient[];
  prepItems?: PrepItem[];
  bomItems?: import('@gustopos/shared').BomItem[];
  categoryModifierPools?: CategoryModifierPool[];
  onCreateCategory?: (name: string, scope: Category['scope']) => Promise<void>;
  onCreate?: (payload: MenuItemCreateRequest) => Promise<void>;
  onCreateMenuProduct?: (payload: CanonicalCreateMenuProductRequest) => Promise<void>;
  onUpdate?: (id: string, payload: MenuItemUpdateRequest) => Promise<void>;
  editItem?: MenuItemAdmin | null;
  /**
   * simple_catalog tenants compose a dish from plain ingredient names (the POS
   * "Togli" tab). The inventory flow keeps recipes in FoodProductModal, so the
   * section stays hidden there — one editor per flow, never two.
   */
  simpleCatalogMode?: boolean;
}

export default function SimpleProductModal({
  open, onClose, onSuccess, categories, inventory, prepItems = [], bomItems = [], categoryModifierPools = [], onCreateCategory, onCreate, onCreateMenuProduct, onUpdate, editItem, simpleCatalogMode = false,
}: SimpleProductModalProps) {
  const isEdit = !!editItem;
  const [name, setName] = useState('');
  const [ticketName, setTicketName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [price, setPrice] = useState('');
  const [stationId, setStationId] = useState('');
  const [referenceId, setReferenceId] = useState('');
  const [recipe, setRecipe] = useState<MenuRecipeComponent[]>([]);
  const [newIngredientName, setNewIngredientName] = useState('');
  const [modifierGroups, setModifierGroups] = useState<ModifierGroup[]>([]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [error, setError] = useState('');

  const { stations } = usePrintStations();
  const { references } = useProductionReferences();
  const activeReferences = references.filter((r) => r.isActive);
  const menuCategories = useMemo(() => categories.filter((c) => !c.scope || c.scope === 'menu'), [categories]);

  useEffect(() => {
    if (editItem && open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- [form-sync] initializes form fields from editItem prop on modal open
      setName(editItem.name);
      setTicketName(editItem.ticketName ?? '');
      setCategoryId(editItem.categoryId ?? '');
      setCategoryName(editItem.category);
      setPrice(String(editItem.price));
      setStationId(editItem.stationId ?? '');
      setReferenceId(editItem.referenceId ?? '');
      setRecipe(editItem.recipe ?? []);
      setModifierGroups(editItem.modifierGroups ?? []);
    } else if (!open) {
      setName('');
      setTicketName('');
      setCategoryId('');
      setCategoryName('');
      setPrice('');
      setStationId(''); setReferenceId('');
      setRecipe([]); setNewIngredientName('');
      setModifierGroups([]);
      setErrors({});
      setError('');
    }
  }, [editItem, open]);

  const dirty = useMemo(() => {
    if (!isEdit || !editItem) return name !== '' || price !== '' || categoryId !== '' || stationId !== '' || recipe.length > 0;
    return (
      name !== editItem.name
      || ticketName.trim() !== (editItem.ticketName ?? '')
      || categoryId !== (editItem.categoryId ?? '')
      || price !== String(editItem.price)
      || stationId !== (editItem.stationId ?? '')
      || referenceId !== (editItem.referenceId ?? '')
      || JSON.stringify(recipe) !== JSON.stringify(editItem.recipe ?? [])
      || JSON.stringify(modifierGroups) !== JSON.stringify(editItem.modifierGroups)
    );
  }, [isEdit, editItem, name, ticketName, categoryId, price, stationId, referenceId, recipe, modifierGroups]);

  /**
   * Compositions are free-text names (simple_catalog): `componentId` IS the
   * ingredient name, quantity/unit are placeholders the POS never shows. The
   * unique edge index is the name, so "mozzarella" and "Mozzarella" are the
   * same entry — dedupe case-insensitively on add.
   */
  const addIngredient = () => {
    const value = newIngredientName.trim();
    if (!value) return;
    const exists = recipe.some((c) => c.componentId.toLocaleLowerCase('it') === value.toLocaleLowerCase('it'));
    if (!exists) {
      setRecipe((prev) => [...prev, { componentType: 'ingredient', componentId: value, quantity: 1, unit: 'pz' }]);
    }
    setNewIngredientName('');
  };

  const handleSave = async () => {
    const errs: ValidationErrors = {};
    errs.name = required(name, 'Nome') ?? minLength(name, 2, 'Nome');
    errs.ticketName = maxLength(ticketName, TICKET_NAME_MAX_LENGTH, 'Nome interno');
    errs.price = positiveNumber(price, 'Prezzo');
    setErrors(errs);
    if (Object.values(errs).some(Boolean)) return;
    setSaving(true);
    setError('');
    try {
      const priceNum = Number(price);
      const catName = categoryId ? (menuCategories.find((c) => c.id === categoryId)?.name ?? categoryName.trim()) : categoryName.trim();
      if (isEdit && onUpdate && editItem) {
        // The simple-catalog PATCH replaces the whole component list: send it
        // only when the composition changed, so editing a price never rewrites
        // the recipe edges (and their ids).
        const compositionChanged = JSON.stringify(recipe) !== JSON.stringify(editItem.recipe ?? []);
        await onUpdate(editItem.id, {
          name: name.trim(),
          // Empty = clear the internal comanda name (print falls back to `name`).
          ticketName: ticketName.trim() || null,
          category: catName,
          categoryId: categoryId || undefined,
          price: priceNum,
          stationId: stationId || undefined,
          referenceId: referenceId || undefined,
          printAreas: [],
          ...(compositionChanged
            ? { components: recipe.map((c) => ({ componentType: c.componentType, componentId: c.componentId, quantity: c.quantity, unit: (c.unit || 'pz') as CanonicalUnit })) }
            : {}),
          modifierGroups,
        });
      } else if (onCreateMenuProduct) {
        if (!catName || catName.trim().length < 2) {
          throw new Error('Seleziona o crea una categoria per il prodotto.');
        }
        await onCreateMenuProduct({
          name: name.trim(),
          ticketName: ticketName.trim() || undefined,
          price: priceNum,
          category: catName.trim(),
          categoryId: categoryId || undefined,
          stationId: stationId || undefined,
          referenceId: referenceId || undefined,
          printAreas: [],
          components: [],
          inlineIngredients: [],
          inlinePreps: [],
          modifierGroups,
        });
      } else if (onCreate) {
        await onCreate({
          name: name.trim(),
          ticketName: ticketName.trim() || undefined,
          category: catName,
          categoryId: categoryId || undefined,
          stationId: stationId || undefined,
          referenceId: referenceId || undefined,
          printAreas: [],
          price: priceNum,
          // Compositions can be filled in the same shot as the product itself.
          recipe,
          modifiers: [],
          modifierGroups,
        });
      } else {
        throw new Error('Nessun canale di creazione disponibile.');
      }
      setSaving(false);
      onSuccess();
    } catch (e: any) {
      setSaving(false);
      setError(e?.message ?? 'Errore durante il salvataggio');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? `Modifica: ${editItem?.name}` : 'Prodotto semplice'}
      size="md"
      dirty={dirty}
      zIndex={1200}
      footer={
        <SaveFooter
          onCancel={onClose}
          onSave={() => void handleSave()}
          saving={saving}
          label={isEdit ? 'Salva' : 'Crea prodotto'}
        />
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <FormField label="Nome" error={errors.name?.message}>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome prodotto" className={`px-3 py-2 rounded border border-border text-sm w-full ${getErrorClass(errors.name)}`} />
          </FormField>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted block">Categoria</label>
            <InlineCategoryPicker
              categories={menuCategories}
              selectedId={categoryId}
              onSelect={(id) => { setCategoryId(id); const c = menuCategories.find((cat) => cat.id === id); if (c) setCategoryName(c.name); }}
              onCreate={async (n) => { if (onCreateCategory) await onCreateCategory(n, 'menu'); }}
              label=""
            />
          </div>
          <FormField label="Prezzo (€)" error={errors.price?.message}>
            <input value={price} onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="Prezzo di vendita" inputMode="decimal" min="0.01" step="0.10" className={`px-3 py-2 rounded border border-border text-sm w-full ${getErrorClass(errors.price)}`} />
          </FormField>
        </div>

        <div className="flex flex-col gap-1">
          <FormField label="Nome interno (comanda)" error={errors.ticketName?.message}>
            <input
              value={ticketName}
              onChange={(e) => setTicketName(e.target.value)}
              maxLength={TICKET_NAME_MAX_LENGTH + 8}
              placeholder="Es. MEDITERR"
              className={`px-3 py-2 rounded border border-border text-sm w-full ${getErrorClass(errors.ticketName)}`}
            />
          </FormField>
          <p className="text-[10px] text-text-muted">Stampa sulla comanda di cucina al posto del nome completo (max {TICKET_NAME_MAX_LENGTH} caratteri). Conto e menu pubblico restano col nome completo.</p>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted block">Stazione di stampa</label>
          <select
            value={stationId}
            onChange={(e) => setStationId(e.target.value)}
            className="px-3 py-2 rounded border border-border text-sm w-full min-h-[44px] bg-white"
          >
            <option value="">Stazione predefinita (dalla categoria)</option>
            {stations.filter((s) => s.isActive && s.kind !== 'cashier').map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}{s.isDefault ? ' (predefinita)' : ''}
              </option>
            ))}
          </select>
          <p className="text-[10px] text-text-muted">Un prodotto stampa su una sola stazione. Se non impostata, vale la categoria o la stazione predefinita.</p>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted block">Referenza conteggio (contenitore)</label>
          <select value={referenceId} onChange={(e) => setReferenceId(e.target.value)} className="px-3 py-2 rounded border border-border text-sm w-full min-h-[44px] bg-white">
            <option value="">Nessuna (eredita dalla categoria)</option>
            {activeReferences.map((r) => (<option key={r.id} value={r.id}>{r.name}</option>))}
          </select>
        </div>

        {simpleCatalogMode && (
          <div className="border-t border-border pt-3 space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted block">Composizione</label>
            <p className="text-[10px] text-text-muted">
              Ingredienti del piatto: compaiono nel POS sotto «Personalizza → Togli». Solo nomi liberi — nessun magazzino, nessuna BoM.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {recipe.map((component, idx) => (
                <span
                  key={`${component.componentId}-${idx}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-bg border border-border text-xs font-medium text-secondary"
                >
                  {component.componentId}
                  <button
                    type="button"
                    onClick={() => setRecipe((prev) => prev.filter((_, i) => i !== idx))}
                    className="text-text-muted hover:text-danger transition-colors"
                    aria-label={`Rimuovi ${component.componentId}`}
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
              {recipe.length === 0 && (
                <span className="text-xs text-text-muted italic">
                  Nessun ingrediente: il tab «Togli» non apparirà nel POS.
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <input
                value={newIngredientName}
                onChange={(e) => setNewIngredientName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addIngredient(); } }}
                placeholder="Aggiungi ingrediente (es: mozzarella)"
                className="flex-1 px-3 py-2 rounded border border-border text-sm"
                aria-label="Nuovo ingrediente"
              />
              <Button variant="secondary" onClick={addIngredient} disabled={!newIngredientName.trim()}>
                <Plus size={14} />
                Aggiungi
              </Button>
            </div>
          </div>
        )}

        <div className="border-t border-border pt-3">
          <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted block mb-2">Modificatori</label>
          <ModifierGroupsEditor
            value={modifierGroups}
            inventory={inventory}
            prepItems={prepItems}
            bomItems={bomItems}
            onChange={setModifierGroups}
            categoryPools={categoryId ? categoryModifierPools.filter((p) => p.categoryIds?.includes(categoryId) || p.categoryId === categoryId) : []}
          />
        </div>

        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    </Modal>
  );
}

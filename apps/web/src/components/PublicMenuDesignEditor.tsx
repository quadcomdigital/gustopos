import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { MenuItemAdmin, MenuSectionId, PublicMenuTenantEditable } from '@gustopos/shared';
import { Check, Eye, EyeOff, Flame, Star } from 'lucide-react';
import {
  fetchMenuItemsAdmin,
  fetchPublicMenuConfig,
  updatePublicMenuConfig,
} from '../shared/api/client';

const PRESET_OPTIONS: Array<{ value: PublicMenuTenantEditable['preset']; label: string }> = [
  { value: 'minimal_elegant', label: 'Minimal elegante' },
  { value: 'rich_visual', label: 'Visual ricco' },
  { value: 'modern_bistro', label: 'Bistro moderno' },
];

const SECTION_LABELS: Record<MenuSectionId, string> = {
  hero: 'Intestazione',
  highlights: 'In evidenza',
  categories_nav: 'Navigazione categorie',
  item_grid: 'Griglia piatti',
  footer_note: 'Nota a piè di pagina',
};

const DESCRIPTION_MAX = 200;

/** Adds/removes an id from a toggle list, preserving the original order. */
function toggleId(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((entry) => entry !== id) : [...list, id];
}

/**
 * Tenant-facing editor for the public digital menu. It can only touch the
 * whitelisted subset (branding, tagline, sections) plus per-dish merchandising
 * (featured / sold out / hidden / short description); structural fields are
 * superadmin-only and are preserved server-side on save.
 */
export default function PublicMenuDesignEditor() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [draft, setDraft] = useState<PublicMenuTenantEditable>({
    preset: 'minimal_elegant',
    showIngredients: true,
    showPrices: true,
    currency: 'EUR',
    accentColor: '#0f172a',
  });
  const [sections, setSections] = useState<Array<{ id: MenuSectionId; enabled: boolean; order: number }>>([]);
  const [items, setItems] = useState<MenuItemAdmin[]>([]);
  const [featuredItemIds, setFeaturedItemIds] = useState<string[]>([]);
  const [soldOutItemIds, setSoldOutItemIds] = useState<string[]>([]);
  const [hiddenItemIds, setHiddenItemIds] = useState<string[]>([]);
  const [itemDescriptions, setItemDescriptions] = useState<Record<string, string>>({});
  const [itemQuery, setItemQuery] = useState('');

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchPublicMenuConfig(), fetchMenuItemsAdmin()])
      .then(([{ config }, menuItems]) => {
        setDraft({
          preset: config.preset,
          logoUrl: config.logoUrl,
          heroImageUrl: config.heroImageUrl,
          brandTagline: config.brandTagline,
          showIngredients: config.showIngredients,
          showPrices: config.showPrices,
          currency: config.currency,
          accentColor: config.accentColor,
          content: config.content,
        });
        setSections(config.sections);
        setFeaturedItemIds(config.featuredItemIds);
        setSoldOutItemIds(config.soldOutItemIds);
        setHiddenItemIds(config.hiddenItemIds);
        setItemDescriptions(config.itemDescriptions);
        setItems(menuItems);
        setError('');
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Caricamento non riuscito'))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const config = await updatePublicMenuConfig({
        ...draft,
        sections,
        featuredItemIds,
        soldOutItemIds,
        hiddenItemIds,
        itemDescriptions,
      });
      setDraft((current) => ({ ...current, ...config }));
      setSections(config.sections);
      setFeaturedItemIds(config.featuredItemIds);
      setSoldOutItemIds(config.soldOutItemIds);
      setHiddenItemIds(config.hiddenItemIds);
      setItemDescriptions(config.itemDescriptions);
      setSuccess('Menu digitale aggiornato');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Salvataggio non riuscito');
    } finally {
      setSaving(false);
    }
  };

  const toggleSection = (id: MenuSectionId) => {
    setSections((current) =>
      current.map((section) => (section.id === id ? { ...section, enabled: !section.enabled } : section)),
    );
  };

  const setDescription = (itemId: string, value: string) => {
    setItemDescriptions((current) => {
      const next = { ...current };
      const trimmed = value.slice(0, DESCRIPTION_MAX);
      if (trimmed.length === 0) delete next[itemId];
      else next[itemId] = trimmed;
      return next;
    });
  };

  /** Items grouped by category name, following the catalogue order. */
  const groupedItems = useMemo(() => {
    const query = itemQuery.trim().toLowerCase();
    const visible = query
      ? items.filter((item) => item.name.toLowerCase().includes(query) || item.category.toLowerCase().includes(query))
      : items;
    const buckets = new Map<string, MenuItemAdmin[]>();
    for (const item of visible) {
      const bucket = buckets.get(item.category);
      if (bucket) bucket.push(item);
      else buckets.set(item.category, [item]);
    }
    return [...buckets.entries()];
  }, [items, itemQuery]);

  if (loading) {
    return <p className="text-sm text-text-muted">Caricamento design menu…</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-primary uppercase tracking-tight">Menu digitale</h3>
        <p className="text-text-muted text-sm">Personalizza l'aspetto e i contenuti del menu pubblico (asporto).</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="space-y-1 text-xs font-bold uppercase tracking-wider text-text-muted">
          Tema
          <select
            value={draft.preset}
            onChange={(event) => setDraft((current) => ({ ...current, preset: event.target.value as PublicMenuTenantEditable['preset'] }))}
            className="w-full min-h-[44px] px-3 rounded-lg border border-border text-sm font-medium text-secondary"
          >
            {PRESET_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-xs font-bold uppercase tracking-wider text-text-muted">
          Colore accento
          <input
            type="color"
            value={draft.accentColor ?? '#0f172a'}
            onChange={(event) => setDraft((current) => ({ ...current, accentColor: event.target.value }))}
            className="w-full min-h-[44px] px-1 rounded-lg border border-border"
          />
        </label>

        <label className="space-y-1 text-xs font-bold uppercase tracking-wider text-text-muted">
          Tagline
          <input
            value={draft.brandTagline ?? ''}
            onChange={(event) => setDraft((current) => ({ ...current, brandTagline: event.target.value }))}
            placeholder="Cucina contemporanea di stagione"
            className="w-full min-h-[44px] px-3 rounded-lg border border-border text-sm"
          />
        </label>

        <label className="space-y-1 text-xs font-bold uppercase tracking-wider text-text-muted">
          Valuta
          <input
            value={draft.currency ?? 'EUR'}
            onChange={(event) => setDraft((current) => ({ ...current, currency: event.target.value }))}
            className="w-full min-h-[44px] px-3 rounded-lg border border-border text-sm"
          />
        </label>

        <label className="space-y-1 text-xs font-bold uppercase tracking-wider text-text-muted">
          URL logo
          <input
            value={draft.logoUrl ?? ''}
            onChange={(event) => setDraft((current) => ({ ...current, logoUrl: event.target.value || undefined }))}
            placeholder="https://…"
            className="w-full min-h-[44px] px-3 rounded-lg border border-border text-sm"
          />
        </label>

        <label className="space-y-1 text-xs font-bold uppercase tracking-wider text-text-muted">
          URL immagine hero
          <input
            value={draft.heroImageUrl ?? ''}
            onChange={(event) => setDraft((current) => ({ ...current, heroImageUrl: event.target.value || undefined }))}
            placeholder="https://…"
            className="w-full min-h-[44px] px-3 rounded-lg border border-border text-sm"
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-4">
        <label className="flex min-h-[44px] items-center gap-2 text-sm font-semibold text-secondary">
          <input
            type="checkbox"
            checked={draft.showPrices ?? true}
            onChange={(event) => setDraft((current) => ({ ...current, showPrices: event.target.checked }))}
            className="h-5 w-5 rounded border-border"
          />
          Mostra prezzi
        </label>
        <label className="flex min-h-[44px] items-center gap-2 text-sm font-semibold text-secondary">
          <input
            type="checkbox"
            checked={draft.showIngredients ?? true}
            onChange={(event) => setDraft((current) => ({ ...current, showIngredients: event.target.checked }))}
            className="h-5 w-5 rounded border-border"
          />
          Mostra ingredienti
        </label>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider text-text-muted">Sezioni</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {sections.map((section) => (
            <button
              key={section.id}
              type="button"
              onClick={() => toggleSection(section.id)}
              aria-pressed={section.enabled}
              className={`min-h-[44px] rounded-lg border px-3 text-xs font-bold text-left transition-colors ${
                section.enabled ? 'border-accent bg-accent/10 text-accent' : 'border-border text-text-muted'
              }`}
            >
              {SECTION_LABELS[section.id]}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-xs font-bold uppercase tracking-wider text-text-muted">Piatti</p>
          <p className="text-[11px] text-text-muted">
            {featuredItemIds.length} in evidenza · {soldOutItemIds.length} esauriti · {hiddenItemIds.length} nascosti
          </p>
        </div>

        <input
          type="search"
          value={itemQuery}
          onChange={(event) => setItemQuery(event.target.value)}
          placeholder="Cerca un piatto…"
          className="w-full min-h-[44px] px-3 rounded-lg border border-border text-sm"
        />

        <div className="max-h-[26rem] space-y-4 overflow-y-auto rounded-lg border border-border p-3">
          {groupedItems.length === 0 && (
            <p className="py-6 text-center text-sm text-text-muted">Nessun piatto trovato.</p>
          )}
          {groupedItems.map(([category, categoryItems]) => (
            <div key={category} className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted">{category}</p>
              {categoryItems.map((item) => {
                const featured = featuredItemIds.includes(item.id);
                const soldOut = soldOutItemIds.includes(item.id);
                const hidden = hiddenItemIds.includes(item.id);
                return (
                  <div key={item.id} className={`rounded-lg border border-border p-3 ${item.isActive ? '' : 'opacity-60'}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-secondary">
                        {item.name}
                        {!item.isActive && <span className="ml-2 text-[10px] font-bold uppercase text-text-muted">non attivo</span>}
                      </span>
                      <ToggleChip
                        active={featured}
                        onClick={() => setFeaturedItemIds((current) => toggleId(current, item.id))}
                        icon={<Star size={13} />}
                        label="In evidenza"
                      />
                      <ToggleChip
                        active={soldOut}
                        onClick={() => setSoldOutItemIds((current) => toggleId(current, item.id))}
                        icon={<Flame size={13} />}
                        label="Esaurito"
                      />
                      <ToggleChip
                        active={hidden}
                        onClick={() => setHiddenItemIds((current) => toggleId(current, item.id))}
                        icon={hidden ? <EyeOff size={13} /> : <Eye size={13} />}
                        label="Nascosto"
                      />
                    </div>
                    <input
                      value={itemDescriptions[item.id] ?? ''}
                      onChange={(event) => setDescription(item.id, event.target.value)}
                      maxLength={DESCRIPTION_MAX}
                      placeholder="Descrizione breve (opzionale)"
                      className="mt-2 w-full min-h-[40px] px-3 rounded-lg border border-border text-sm"
                    />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => void save()}
          disabled={saving}
          className="min-h-[44px] inline-flex items-center gap-2 px-5 rounded-lg bg-accent text-white text-xs font-bold uppercase tracking-wider disabled:opacity-50"
        >
          <Check size={15} />
          {saving ? 'Salvataggio…' : 'Salva menu'}
        </button>
        {success && <span className="text-xs font-semibold text-success">{success}</span>}
        {error && <span className="text-xs font-semibold text-danger">{error}</span>}
      </div>
    </div>
  );
}

function ToggleChip({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex min-h-[32px] items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-bold transition-colors ${
        active ? 'border-accent bg-accent/10 text-accent' : 'border-border text-text-muted'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

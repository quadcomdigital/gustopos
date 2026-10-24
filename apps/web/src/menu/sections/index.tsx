import type { PublicMenuResponse } from '@gustopos/shared';
import { Plus, Search, SlidersHorizontal } from 'lucide-react';
import ItemCard from './ItemCard';
import { categoryEmoji, formatPrice } from '../lib/display';
import { itemIsCustomizable } from '../lib/customization';
import { ingredientLine } from './ItemCard';
import type { MenuShellData, MenuShellActions } from '../types';

type PublicMenuItem = PublicMenuResponse['items'][number];

/**
 * Default-shell building blocks. They are tenant-agnostic by design: all colour
 * comes from `MenuAppearance`, and there is no per-tenant branch anywhere in
 * this folder — scaffolds bring their own components instead.
 *
 * Preset-driven layout (card orientation, hero height, highlights) is read from
 * `data.appearance.layout`, so these components never switch on `preset`.
 */

export function Hero({
  data,
  onSearch,
}: {
  data: MenuShellData;
  onSearch: (query: string) => void;
}) {
  const { appearance, menu } = data;
  const tall = appearance.layout.heroHeight === 'tall';
  return (
    <div className={`flex flex-col gap-4 ${tall ? 'py-6 md:py-10' : ''}`}>
      <div className="flex items-center gap-3">
        {appearance.logoUrl && (
          <img
            src={appearance.logoUrl}
            alt={`${menu.tenant.name} logo`}
            className={tall ? 'h-14 w-auto object-contain' : 'h-10 w-auto object-contain'}
          />
        )}
        <h1
          className={tall ? 'display text-4xl font-extrabold md:text-5xl' : 'display text-3xl font-extrabold md:text-4xl'}
          style={{ color: appearance.ink }}
        >
          {menu.tenant.name}
        </h1>
      </div>
      {appearance.tagline && (
        <p className={tall ? 'text-base' : 'text-sm'} style={{ color: appearance.muted }}>
          {appearance.tagline}
        </p>
      )}
      <div className="relative w-full md:w-[26rem]">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: appearance.muted }} />
        <input
          type="search"
          placeholder="Cerca piatti..."
          onChange={(event) => onSearch(event.target.value)}
          className="w-full rounded-full border py-2.5 pl-10 pr-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)]"
          style={{ backgroundColor: appearance.surface, borderColor: appearance.border, color: appearance.ink }}
        />
      </div>
    </div>
  );
}

export function CategoryNav({
  data,
  onSelectCategory,
}: {
  data: MenuShellData;
  onSelectCategory: (categoryId: string) => void;
}) {
  const { categories, activeCategory, appearance } = data;
  return (
    <nav className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1" aria-label="Categorie">
      {[{ id: 'all', name: 'Tutti' }, ...categories].map((cat) => {
        const active = activeCategory === cat.id;
        return (
          <button
            key={cat.id}
            type="button"
            onClick={() => onSelectCategory(cat.id)}
            aria-pressed={active}
            className="inline-flex min-h-[40px] flex-none items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-bold uppercase tracking-wider transition-colors duration-200"
            style={{
              backgroundColor: active ? appearance.accent : 'transparent',
              color: active ? appearance.accentForeground : appearance.muted,
              borderColor: active ? appearance.accent : appearance.border,
            }}
          >
            <span className="text-sm leading-none">{categoryEmoji(cat.name)}</span>
            {cat.name}
          </button>
        );
      })}
    </nav>
  );
}

/**
 * Optional "In evidenza" strip, tenant-agnostic. It shows when the preset turns
 * highlights on or the tenant enabled the `highlights` section, and hides while
 * the guest searches or filters so it never duplicates the grid.
 */
export function Highlights({ data, actions }: { data: MenuShellData; actions: MenuShellActions }) {
  const { appearance, searchQuery, activeCategory, enabledSections } = data;
  const enabled = enabledSections.has('highlights') || appearance.layout.showHighlights;
  if (!enabled || searchQuery.trim() !== '' || activeCategory !== 'all') return null;

  const featured = data.menu.items.filter((item) => item.isFeatured);
  if (featured.length < 2) return null;

  return (
    <section className="mt-6" aria-label="Piatti in evidenza">
      <h2 className="display mb-3 text-xl font-extrabold" style={{ color: appearance.ink }}>
        In evidenza
      </h2>
      <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1">
        {featured.map((item) => {
          const customizable = itemIsCustomizable(item, data.menu.categoryModifierPools);
          return (
          <article
            key={item.id}
            className="flex w-56 flex-none snap-start flex-col rounded-xl border p-3"
            style={{ borderColor: appearance.border, backgroundColor: appearance.surface }}
          >
            <div
              className="mb-3 flex h-24 w-full items-center justify-center overflow-hidden rounded-lg border"
              style={{
                borderColor: appearance.border,
                backgroundImage: `linear-gradient(135deg, ${appearance.accentSoft}, ${appearance.surface})`,
              }}
            >
              <span className="text-3xl opacity-75" aria-hidden="true">
                {categoryEmoji(item.category)}
              </span>
            </div>
            <h3 className="text-sm font-bold leading-tight" style={{ color: appearance.ink }}>
              {item.name}
            </h3>
            {item.description && (
              <p className="mt-1 line-clamp-2 text-xs" style={{ color: appearance.ink }}>
                {item.description}
              </p>
            )}
            <div className="mt-2 flex items-center justify-between gap-2">
              {appearance.showPrices && (
                <span className="text-sm font-bold tabular-nums" style={{ color: appearance.ink }}>
                  {formatPrice(appearance.currency, item.price)}
                </span>
              )}
              {actions.takeawayEnabled && (
                <button
                  type="button"
                  onClick={() => actions.onAddItem(item)}
                  disabled={item.isSoldOut}
                  aria-label={customizable ? `Personalizza ${item.name}` : `Aggiungi ${item.name}`}
                  className={
                    customizable
                      ? 'flex min-h-[36px] items-center gap-1.5 rounded-full border px-3 text-[11px] font-bold uppercase tracking-wider disabled:opacity-40'
                      : 'flex h-9 w-9 items-center justify-center rounded-full border disabled:opacity-40'
                  }
                  style={{
                    backgroundColor: appearance.accent,
                    color: appearance.accentForeground,
                    borderColor: appearance.accent,
                  }}
                >
                  {customizable ? (
                    <>
                      <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
                      Personalizza
                    </>
                  ) : (
                    <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
                  )}
                </button>
              )}
            </div>
          </article>
          );
        })}
      </div>
    </section>
  );
}

export function ItemGrid({ data, actions }: { data: MenuShellData; actions: MenuShellActions }) {
  const { filteredItems, appearance } = data;
  const tiles = appearance.layout.itemLayout === 'cards';
  return (
    <>
      <div
        className={
          tiles
            ? 'grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4'
            : 'grid grid-cols-1 gap-0 md:grid-cols-2 lg:grid-cols-3'
        }
      >
        {filteredItems.map((item: PublicMenuItem) => (
          <ItemCard
            key={item.id}
            item={item}
            appearance={appearance}
            formatPrice={(value) => formatPrice(appearance.currency, value)}
            onAdd={() => actions.onAddItem(item)}
            takeawayEnabled={actions.takeawayEnabled}
            customizable={itemIsCustomizable(item, data.menu.categoryModifierPools)}
            orientation={tiles ? 'tile' : 'row'}
          />
        ))}
      </div>
      {filteredItems.length === 0 && (
        <div className="flex flex-col items-center py-16 text-center">
          <div
            className="mb-3 flex h-16 w-16 items-center justify-center rounded-full border"
            style={{ backgroundColor: appearance.accentSoft, borderColor: appearance.border }}
          >
            <Search className="h-8 w-8" style={{ color: appearance.accentText }} />
          </div>
          <h3 className="text-lg font-extrabold" style={{ color: appearance.ink }}>
            Nessun piatto trovato
          </h3>
          <p className="mx-auto mt-1 max-w-xs text-sm" style={{ color: appearance.muted }}>
            Prova a cambiare categoria o parole di ricerca.
          </p>
        </div>
      )}
    </>
  );
}

export function FooterNote({ data }: { data: MenuShellData }) {
  if (!data.config.content?.footerNote) return null;
  return (
    <p className="mt-10 text-center text-xs" style={{ color: data.appearance.muted }}>
      {data.config.content.footerNote}
    </p>
  );
}

export { formatPrice, ingredientLine };

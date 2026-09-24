import type { PublicMenuResponse } from '@gustopos/shared';
import { Search } from 'lucide-react';
import ItemCard from './ItemCard';
import { categoryEmoji, formatPrice } from '../lib/display';
import type { MenuShellData, MenuShellActions } from '../types';

type PublicMenuItem = PublicMenuResponse['items'][number];

/**
 * Default-shell building blocks. They are tenant-agnostic by design: all colour
 * comes from `MenuAppearance`, and there is no per-tenant branch anywhere in
 * this folder — scaffolds bring their own components instead.
 */

export function Hero({
  data,
  onSearch,
}: {
  data: MenuShellData;
  onSearch: (query: string) => void;
}) {
  const { appearance, menu } = data;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        {appearance.logoUrl && (
          <img
            src={appearance.logoUrl}
            alt={`${menu.tenant.name} logo`}
            className="h-10 w-auto object-contain"
          />
        )}
        <h1 className="display text-3xl font-extrabold md:text-4xl" style={{ color: appearance.ink }}>
          {menu.tenant.name}
        </h1>
      </div>
      {appearance.tagline && (
        <p className="text-sm" style={{ color: appearance.muted }}>
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

export function ItemGrid({ data, actions }: { data: MenuShellData; actions: MenuShellActions }) {
  const { filteredItems, appearance } = data;
  return (
    <>
      <div className="grid grid-cols-1 gap-0 md:grid-cols-2 lg:grid-cols-3">
        {filteredItems.map((item: PublicMenuItem) => (
          <ItemCard
            key={item.id}
            item={item}
            appearance={appearance}
            formatPrice={(value) => formatPrice(appearance.currency, value)}
            onAdd={() => actions.onAddItem(item)}
            takeawayEnabled={actions.takeawayEnabled}
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

export { formatPrice };

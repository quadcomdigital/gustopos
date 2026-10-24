import type { PublicMenuResponse } from '@gustopos/shared';
import { Plus } from 'lucide-react';
import type { MenuAppearance, MenuShellActions, MenuShellData } from '../../../types';
import { ingredientLine } from '../../../sections/ItemCard';
import { formatPrice } from '../../../lib/display';
import { Reveal } from '../Reveal';

type PublicMenuItem = PublicMenuResponse['items'][number];

/**
 * "In evidenza": a horizontal strip of the items the operator pinned as featured
 * (`config.featuredItemIds` → `item.isFeatured`). It hides itself while the guest
 * is searching or filtering, so it never duplicates the grid mid-scroll.
 */
export function FranksHighlights({ data, actions }: { data: MenuShellData; actions: MenuShellActions }) {
  const { appearance, searchQuery, activeCategory, enabledSections } = data;

  // Preset-driven, or explicitly enabled by the tenant via the section toggle.
  const enabled = enabledSections.has('highlights') || appearance.layout.showHighlights;
  // Only on the unfiltered menu: the grid already surfaces these items otherwise.
  if (!enabled || searchQuery.trim() !== '' || activeCategory !== 'all') return null;

  const featured = data.menu.items.filter((item) => item.isFeatured);
  if (featured.length < 2) return null;

  return (
    <Reveal className="mb-12">
      <section aria-label="Piatti in evidenza">
      <div className="flex items-end justify-between gap-4">
        <div>
          <span
            className="block text-[10px] font-bold uppercase tracking-[0.3em]"
            style={{ color: appearance.accentText }}
          >
            Selezione
          </span>
          <h2 className="display mt-1.5 text-2xl font-extrabold md:text-[1.75rem]" style={{ color: appearance.ink }}>
            In evidenza
          </h2>
        </div>
        <span
          className="hidden pb-1 text-[11px] font-bold uppercase tracking-[0.18em] sm:block"
          style={{ color: appearance.muted }}
        >
          I consigliati della casa
        </span>
      </div>

      <div className="fr-scroller -mx-4 mt-5 flex snap-x snap-mandatory gap-3.5 overflow-x-auto px-4 pb-2 md:-mx-8 md:px-8">
        {featured.map((item) => (
          <HighlightCard
            key={item.id}
            item={item}
            appearance={appearance}
            takeawayEnabled={actions.takeawayEnabled}
            onAdd={() => actions.onAddItem(item)}
          />
        ))}
      </div>
      </section>
    </Reveal>
  );
}

function HighlightCard({
  item,
  appearance,
  takeawayEnabled,
  onAdd,
}: {
  item: PublicMenuItem;
  appearance: MenuAppearance;
  takeawayEnabled: boolean;
  onAdd: () => void;
}) {
  const line = item.description || ingredientLine(item) || item.category;
  return (
    <article
      className="flex w-64 flex-none snap-start flex-col rounded-2xl border p-5 transition-transform duration-200 hover:-translate-y-0.5"
      style={{
        borderColor: appearance.border,
        backgroundColor: appearance.surface,
        boxShadow: '0 1px 2px rgba(16,16,18,0.04), 0 12px 30px -24px rgba(16,16,18,0.45)',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="display text-[15px] font-extrabold leading-snug" style={{ color: appearance.ink }}>
          {item.name}
        </h3>
        {appearance.showPrices && (
          <span className="whitespace-nowrap text-[15px] font-extrabold tabular-nums" style={{ color: appearance.ink }}>
            {formatPrice(appearance.currency, item.price)}
          </span>
        )}
      </div>
      {appearance.showIngredients && (
        <p className="mt-1.5 line-clamp-2 text-[12.5px] leading-relaxed" style={{ color: appearance.muted }}>
          {line}
        </p>
      )}
      <div className="mt-auto flex items-center justify-between gap-3 pt-4">
        {item.isSoldOut ? (
          <span
            className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em]"
            style={{ backgroundColor: '#fef2f2', color: '#b91c1c' }}
          >
            Esaurito
          </span>
        ) : (
          <span aria-hidden="true" />
        )}
        {takeawayEnabled && (
          <button
            type="button"
            onClick={onAdd}
            disabled={item.isSoldOut}
            aria-label={`Aggiungi ${item.name}`}
            className="fr-press flex h-9 w-9 flex-none items-center justify-center rounded-full shadow-sm transition-transform hover:brightness-[1.03] active:scale-90 disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus-visible:ring-offset-2"
            style={{ backgroundColor: appearance.accent, color: appearance.accentForeground }}
          >
            <Plus className="h-4 w-4" strokeWidth={2.75} aria-hidden="true" />
          </button>
        )}
      </div>
    </article>
  );
}

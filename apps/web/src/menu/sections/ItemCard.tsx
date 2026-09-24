import type { CSSProperties } from 'react';
import type { PublicMenuResponse } from '@gustopos/shared';
import { Plus } from 'lucide-react';
import type { MenuAppearance } from '../types';

type PublicMenuItem = PublicMenuResponse['items'][number];

/**
 * Display line for an item's composition, normalised like the POS: prefer the
 * full recipe (ingredients + preps) with resolved names, falling back to the
 * plain ingredient name list.
 */
export function ingredientLine(item: PublicMenuItem): string {
  const names = (item.recipe ?? [])
    .map((component) => component.componentName)
    .filter((name): name is string => Boolean(name && name.trim()));
  if (names.length > 0) return `Ingredienti: ${names.join(', ')}`;
  if (item.ingredients.length > 0) return `Ingredienti: ${item.ingredients.join(', ')}`;
  return '';
}

/**
 * Default-shell item card. Purely data/brand driven — it knows nothing about
 * which tenant is rendering it; scaffolds ship their own card if they want a
 * different presentation.
 */
export default function ItemCard({
  item,
  appearance,
  formatPrice,
  onAdd,
  takeawayEnabled,
}: {
  item: PublicMenuItem;
  appearance: MenuAppearance;
  formatPrice: (value: number) => string;
  onAdd: () => void;
  takeawayEnabled: boolean;
}) {
  return (
    <article
      className="group flex gap-4 rounded-xl border-b px-3 py-6 transition-colors duration-200 hover:bg-[var(--menu-card-hover)]"
      style={
        {
          borderColor: appearance.border,
          '--menu-card-hover': appearance.surface,
        } as CSSProperties
      }
    >
      <div
        className="relative h-24 w-24 flex-none overflow-hidden rounded-2xl border sm:h-28 sm:w-28"
        style={{
          borderColor: appearance.border,
          backgroundImage: `linear-gradient(135deg, ${appearance.accentSoft}, ${appearance.surface})`,
        }}
      >
        {(item.isFeatured || item.isSoldOut) && (
          <div className="absolute left-2 top-2 flex flex-col items-start gap-1">
            {item.isFeatured && (
              <span
                className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase"
                style={{ backgroundColor: appearance.accent, color: appearance.accentForeground }}
              >
                Consigliato
              </span>
            )}
            {item.isSoldOut && (
              <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-rose-700">
                Esaurito
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <div className="mb-1 flex items-start justify-between gap-3">
          <h3 className="text-base font-bold leading-tight" style={{ color: appearance.ink }}>
            {item.name}
          </h3>
          {appearance.showPrices && (
            <span className="whitespace-nowrap text-sm font-bold tabular-nums" style={{ color: appearance.ink }}>
              {formatPrice(item.price)}
            </span>
          )}
        </div>
        {appearance.showIngredients && (
          <p className="mb-3 line-clamp-2 text-xs leading-relaxed" style={{ color: appearance.muted }}>
            {ingredientLine(item) || item.category}
          </p>
        )}
        {takeawayEnabled && (
          <button
            type="button"
            onClick={onAdd}
            disabled={item.isSoldOut}
            aria-label={`Aggiungi ${item.name}`}
            className="flex h-10 w-10 items-center justify-center self-end rounded-full border transition-transform active:scale-95 disabled:opacity-40"
            style={{
              backgroundColor: appearance.accent,
              color: appearance.accentForeground,
              borderColor: appearance.accent,
            }}
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
          </button>
        )}
      </div>
    </article>
  );
}

import type { CSSProperties } from 'react';
import type { PublicMenuResponse } from '@gustopos/shared';
import { Plus, SlidersHorizontal } from 'lucide-react';
import type { MenuAppearance } from '../types';
import { categoryEmoji } from '../lib/display';

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
 *
 * `orientation` is preset-driven: `row` is the compact list form, `tile` is the
 * vertical card used by the card-based presets.
 */
export default function ItemCard({
  item,
  appearance,
  formatPrice,
  onAdd,
  takeawayEnabled,
  customizable = false,
  orientation = 'row',
}: {
  item: PublicMenuItem;
  appearance: MenuAppearance;
  formatPrice: (value: number) => string;
  onAdd: () => void;
  takeawayEnabled: boolean;
  /** Item has options or removable ingredients → the button opens the sheet
   *  with an explicit "Personalizza" label instead of silently adding. */
  customizable?: boolean;
  orientation?: 'row' | 'tile';
}) {
  const art = (
    <div
      className={
        orientation === 'tile'
          ? 'relative flex h-36 w-full flex-none items-center justify-center overflow-hidden rounded-t-xl border-b'
          : 'relative flex h-24 w-24 flex-none items-center justify-center overflow-hidden rounded-2xl border sm:h-28 sm:w-28'
      }
      style={{
        borderColor: appearance.border,
        backgroundImage: `linear-gradient(135deg, ${appearance.accentSoft}, ${appearance.surface})`,
      }}
    >
      <span className={orientation === 'tile' ? 'text-4xl opacity-70' : 'text-3xl opacity-70'} aria-hidden="true">
        {categoryEmoji(item.category)}
      </span>
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
  );

  const addButton = takeawayEnabled ? (
    <button
      type="button"
      onClick={onAdd}
      disabled={item.isSoldOut}
      aria-label={customizable ? `Personalizza ${item.name}` : `Aggiungi ${item.name}`}
      className={
        customizable
          ? 'flex min-h-[40px] items-center gap-1.5 rounded-full border px-3.5 text-xs font-bold uppercase tracking-wider transition-transform active:scale-95 disabled:opacity-40'
          : 'flex h-10 w-10 items-center justify-center rounded-full border transition-transform active:scale-95 disabled:opacity-40'
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
  ) : null;

  const heading = (
    <div className={orientation === 'tile' ? 'flex items-start justify-between gap-2' : 'mb-1 flex items-start justify-between gap-3'}>
      <h3
        className={orientation === 'tile' ? 'text-sm font-bold leading-tight' : 'text-base font-bold leading-tight'}
        style={{ color: appearance.ink }}
      >
        {item.name}
      </h3>
      {appearance.showPrices && (
        <span className="whitespace-nowrap text-sm font-bold tabular-nums" style={{ color: appearance.ink }}>
          {formatPrice(item.price)}
        </span>
      )}
    </div>
  );

  const body = (
    <>
      {item.description && (
        <p className="mt-1 line-clamp-2 text-xs leading-relaxed" style={{ color: appearance.ink }}>
          {item.description}
        </p>
      )}
      {appearance.showIngredients && (
        <p className="mt-1 line-clamp-2 text-xs leading-relaxed" style={{ color: appearance.muted }}>
          {ingredientLine(item) || item.category}
        </p>
      )}
    </>
  );

  if (orientation === 'tile') {
    return (
      <article
        className="group flex flex-col overflow-hidden rounded-xl border transition-colors duration-200 hover:bg-[var(--menu-card-hover)]"
        style={{ borderColor: appearance.border, '--menu-card-hover': appearance.surface } as CSSProperties}
      >
        {art}
        <div className="flex min-w-0 flex-1 flex-col p-3">
          {heading}
          {body}
          {addButton && <div className="mt-auto flex justify-end pt-3">{addButton}</div>}
        </div>
      </article>
    );
  }

  return (
    <article
      className="group flex gap-4 rounded-xl border-b px-3 py-6 transition-colors duration-200 hover:bg-[var(--menu-card-hover)]"
      style={{ borderColor: appearance.border, '--menu-card-hover': appearance.surface } as CSSProperties}
    >
      {art}
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        {heading}
        {body}
        {addButton && <div className="mt-3 flex justify-end">{addButton}</div>}
      </div>
    </article>
  );
}

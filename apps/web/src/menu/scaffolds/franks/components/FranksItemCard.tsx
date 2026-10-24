import type { ReactNode } from 'react';
import type { PublicMenuResponse } from '@gustopos/shared';
import { Plus, SlidersHorizontal } from 'lucide-react';
import type { MenuAppearance } from '../../../types';
import { ingredientLine } from '../../../sections/ItemCard';

type PublicMenuItem = PublicMenuResponse['items'][number];

const TILE_CLASS =
  'shadow-[0_1px_2px_rgba(16,16,18,0.04),0_12px_30px_-24px_rgba(16,16,18,0.45)] hover:shadow-[0_2px_4px_rgba(16,16,18,0.05),0_22px_44px_-26px_rgba(16,16,18,0.55)]';

function Badge({
  children,
  appearance,
  tone = 'accent',
}: {
  children: ReactNode;
  appearance: MenuAppearance;
  tone?: 'accent' | 'danger' | 'quiet';
}) {
  const style =
    tone === 'accent'
      ? { backgroundColor: appearance.accentSoft, color: appearance.accentText }
      : tone === 'danger'
        ? { backgroundColor: '#fef2f2', color: '#b91c1c' }
        : { color: appearance.muted };
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em]"
      style={style}
    >
      {children}
    </span>
  );
}

/**
 * Franks dish card. `orientation` is preset-driven: `row` is the elegant
 * dotted-leader list used by the dense preset, `tile` is the soft card grid used
 * by the card presets. No per-item artwork exists yet, so the design is
 * typography-led rather than relying on a placeholder image.
 */
export default function FranksItemCard({
  item,
  appearance,
  formatPrice,
  onAdd,
  takeawayEnabled,
  customizable,
  orientation = 'row',
}: {
  item: PublicMenuItem;
  appearance: MenuAppearance;
  formatPrice: (value: number) => string;
  onAdd: () => void;
  takeawayEnabled: boolean;
  /** Item exposes options or removable ingredients → the CTA opens the sheet. */
  customizable?: boolean;
  orientation?: 'row' | 'tile';
}) {
  const badges = (
    <>
      {item.isFeatured && (
        <Badge appearance={appearance} tone="accent">
          Consigliato
        </Badge>
      )}
      {item.isSoldOut && (
        <Badge appearance={appearance} tone="danger">
          Esaurito
        </Badge>
      )}
    </>
  );

  // Nothing is hidden behind the "+": when the dish has options or removable
  // ingredients the button says "Personalizza" and opens the sheet, so the guest
  // never has to guess whether tapping adds or asks.
  const addButton = takeawayEnabled ? (
    customizable ? (
      <button
        type="button"
        onClick={onAdd}
        disabled={item.isSoldOut}
        aria-label={`Personalizza ${item.name}`}
        className="fr-press flex min-h-[36px] flex-none items-center gap-1.5 rounded-full px-3.5 text-[11px] font-extrabold uppercase tracking-[0.12em] shadow-sm transition-transform hover:brightness-[1.03] active:scale-95 disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus-visible:ring-offset-2"
        style={{ backgroundColor: appearance.accent, color: appearance.accentForeground }}
      >
        <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
        Personalizza
      </button>
    ) : (
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
    )
  ) : null;

  const description = item.description ? (
    <p className="mt-1.5 text-[13px] leading-relaxed" style={{ color: appearance.ink }}>
      {item.description}
    </p>
  ) : null;

  const ingredients = appearance.showIngredients ? (
    <p className="mt-1 text-[12.5px] leading-relaxed" style={{ color: appearance.muted }}>
      {ingredientLine(item) || item.category}
    </p>
  ) : null;

  if (orientation === 'tile') {
    return (
      <article
        className={`flex flex-col rounded-2xl border p-5 transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 ${TILE_CLASS}`}
        style={{ borderColor: appearance.border, backgroundColor: appearance.surface }}
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="display text-[15px] font-extrabold leading-snug" style={{ color: appearance.ink }}>
            {item.name}
          </h3>
          {appearance.showPrices && (
            <span className="whitespace-nowrap text-[15px] font-extrabold tabular-nums" style={{ color: appearance.ink }}>
              {formatPrice(item.price)}
            </span>
          )}
        </div>
        {description}
        {ingredients}
        <div className="mt-auto flex items-end justify-between gap-3 pt-4">
          <div className="flex flex-wrap gap-1.5">{badges}</div>
          {addButton}
        </div>
      </article>
    );
  }

  return (
    <article className="group py-5">
      <div className="flex items-baseline gap-3">
        <h3 className="display text-[15px] font-extrabold leading-snug" style={{ color: appearance.ink }}>
          {item.name}
        </h3>
        {/* Classic dotted leader: keeps name and price visually connected. */}
        <span
          className="mb-1 hidden flex-1 border-b border-dotted sm:block"
          style={{ borderColor: appearance.border }}
        />
        {appearance.showPrices && (
          <span className="ml-auto whitespace-nowrap text-[15px] font-extrabold tabular-nums" style={{ color: appearance.ink }}>
            {formatPrice(item.price)}
          </span>
        )}
      </div>
      {description}
      {ingredients}
      {(item.isFeatured || item.isSoldOut || addButton) && (
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">{badges}</div>
          {addButton}
        </div>
      )}
    </article>
  );
}

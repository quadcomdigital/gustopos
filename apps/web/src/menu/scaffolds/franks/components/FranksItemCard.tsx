import type { PublicMenuResponse } from '@gustopos/shared';
import { Plus } from 'lucide-react';
import type { MenuAppearance } from '../../../types';
import { ingredientLine } from '../../../sections/ItemCard';

type PublicMenuItem = PublicMenuResponse['items'][number];

/**
 * Franks item row: light card on the warm canvas, accent-filled add button and
 * tabular price. Composition text comes from the normalised recipe.
 */
export default function FranksItemCard({
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
      className="group flex gap-4 border-b py-5 transition-colors duration-200"
      style={{ borderColor: appearance.border }}
    >
      <div
        className="relative h-24 w-24 flex-none overflow-hidden rounded-xl border"
        style={{
          borderColor: appearance.border,
          backgroundImage: `linear-gradient(135deg, ${appearance.accentSoft}, ${appearance.surface})`,
        }}
      >
        {(item.isFeatured || item.isSoldOut) && (
          <div className="absolute left-2 top-2 flex flex-col items-start gap-1">
            {item.isFeatured && (
              <span
                className="rounded px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider"
                style={{ backgroundColor: appearance.accent, color: appearance.accentForeground }}
              >
                Consigliato
              </span>
            )}
            {item.isSoldOut && (
              <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[9px] font-extrabold uppercase text-rose-700">
                Esaurito
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <div className="mb-1 flex items-start justify-between gap-3">
          <h3 className="display text-base font-extrabold leading-tight" style={{ color: appearance.ink }}>
            {item.name}
          </h3>
          {appearance.showPrices && (
            <span className="whitespace-nowrap text-sm font-extrabold tabular-nums" style={{ color: appearance.ink }}>
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
            className="flex h-11 w-11 items-center justify-center self-end rounded-full shadow-sm transition-transform active:scale-95 disabled:opacity-40"
            style={{ backgroundColor: appearance.accent, color: appearance.accentForeground }}
          >
            <Plus className="h-4 w-4" strokeWidth={2.75} />
          </button>
        )}
      </div>
    </article>
  );
}

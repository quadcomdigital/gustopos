import type { PublicMenuResponse } from '@gustopos/shared';
import { Search } from 'lucide-react';
import type { MenuShellActions, MenuShellData } from '../../../types';
import { formatPrice } from '../../../lib/display';
import { itemIsCustomizable } from '../../../lib/customization';
import { Reveal } from '../Reveal';
import FranksItemCard from './FranksItemCard';

type PublicMenuItem = PublicMenuResponse['items'][number];

type Group = { name: string; items: PublicMenuItem[] };

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus-visible:ring-offset-2';

/** Groups the visible items by category, following the menu's category order. */
function groupByCategory(data: MenuShellData): Group[] {
  const buckets = new Map<string, PublicMenuItem[]>();
  for (const item of data.filteredItems) {
    const key = item.category || 'Altro';
    const bucket = buckets.get(key);
    if (bucket) bucket.push(item);
    else buckets.set(key, [item]);
  }

  const ordered: Group[] = [];
  const seen = new Set<string>();
  for (const category of data.categories) {
    const items = buckets.get(category.name);
    if (items && items.length > 0) {
      ordered.push({ name: category.name, items });
      seen.add(category.name);
    }
  }
  for (const [name, items] of buckets) {
    if (!seen.has(name)) ordered.push({ name, items });
  }
  return ordered;
}

export function FranksItemGrid({ data, actions }: { data: MenuShellData; actions: MenuShellActions }) {
  const { appearance } = data;
  const groups = groupByCategory(data);
  // Preset-driven presentation (see `menu/presets.ts`).
  const { itemLayout, density } = appearance.layout;
  const tiles = itemLayout === 'cards';
  const comfortable = density === 'comfortable';

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center py-24 text-center">
        <div
          className="mb-4 flex h-14 w-14 items-center justify-center rounded-full"
          style={{ backgroundColor: appearance.accentSoft }}
        >
          <Search className="h-6 w-6" style={{ color: appearance.accentText }} aria-hidden="true" />
        </div>
        <h3 className="display text-lg font-extrabold" style={{ color: appearance.ink }}>
          Nessun piatto trovato
        </h3>
        <p className="mt-1 max-w-xs text-sm" style={{ color: appearance.muted }}>
          Prova a cambiare categoria o a modificare la ricerca.
        </p>
        <button
          type="button"
          onClick={() => {
            actions.onSearch('');
            actions.onSelectCategory('all');
          }}
          className={`fr-press mt-6 min-h-[44px] rounded-full px-5 text-xs font-bold uppercase tracking-[0.16em] ${FOCUS_RING}`}
          style={{ backgroundColor: appearance.ink, color: '#ffffff' }}
        >
          Mostra tutto
        </button>
      </div>
    );
  }

  return (
    <div className={comfortable ? 'space-y-14' : 'space-y-10'}>
      {groups.map((group, index) => (
        <Reveal key={group.name} delay={Math.min(index, 2) * 70}>
          <section aria-label={group.name}>
            <div className="flex items-end justify-between gap-4">
              <div className="min-w-0">
                <span
                  className="block text-[10px] font-bold uppercase tracking-[0.3em]"
                  style={{ color: appearance.accentText }}
                >
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h2
                  className="display mt-1.5 text-2xl font-extrabold md:text-[1.75rem]"
                  style={{ color: appearance.ink }}
                >
                  {group.name}
                </h2>
              </div>
              <span
                className="pb-1 text-[11px] font-bold uppercase tracking-[0.18em] tabular-nums"
                style={{ color: appearance.muted }}
              >
                {group.items.length} {group.items.length === 1 ? 'piatto' : 'piatti'}
              </span>
            </div>

            <div className="mt-5 h-px w-full" style={{ backgroundColor: appearance.border }} />

            <div
              className={
                tiles
                  ? `grid grid-cols-1 gap-3.5 pt-6 sm:grid-cols-2 lg:grid-cols-3 ${comfortable ? 'xl:gap-5' : ''}`
                  : 'grid grid-cols-1 gap-x-10 pt-2 md:grid-cols-2'
              }
            >
              {group.items.map((item) => (
                <FranksItemCard
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
          </section>
        </Reveal>
      ))}
    </div>
  );
}

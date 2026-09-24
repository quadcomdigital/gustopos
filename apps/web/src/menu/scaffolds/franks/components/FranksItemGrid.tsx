import type { PublicMenuResponse } from '@gustopos/shared';
import { Search } from 'lucide-react';
import type { MenuShellActions, MenuShellData } from '../../../types';
import { categoryEmoji, formatPrice } from '../../../lib/display';
import FranksItemCard from './FranksItemCard';

type PublicMenuItem = PublicMenuResponse['items'][number];

type Group = { name: string; items: PublicMenuItem[] };

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

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center py-20 text-center">
        <div
          className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border"
          style={{ backgroundColor: appearance.accentSoft, borderColor: appearance.border }}
        >
          <Search className="h-7 w-7" style={{ color: appearance.accentText }} />
        </div>
        <h3 className="text-lg font-extrabold" style={{ color: appearance.ink }}>
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
          className="mt-5 min-h-[44px] rounded-full border px-5 text-xs font-extrabold uppercase tracking-widest"
          style={{ borderColor: appearance.border, backgroundColor: appearance.surface, color: appearance.ink }}
        >
          Mostra tutto
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {groups.map((group) => (
        <section key={group.name}>
          <div
            className="mb-1 flex items-center gap-2 border-b pb-2"
            style={{ borderColor: appearance.border }}
          >
            <span className="text-base leading-none">{categoryEmoji(group.name)}</span>
            <h2 className="display text-lg font-extrabold" style={{ color: appearance.ink }}>
              {group.name}
            </h2>
            <span className="ml-auto text-[11px] font-bold tabular-nums" style={{ color: appearance.muted }}>
              {group.items.length}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-x-8 md:grid-cols-2">
            {group.items.map((item) => (
              <FranksItemCard
                key={item.id}
                item={item}
                appearance={appearance}
                formatPrice={(value) => formatPrice(appearance.currency, value)}
                onAdd={() => actions.onAddItem(item)}
                takeawayEnabled={actions.takeawayEnabled}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

import { Search, ShoppingBag } from 'lucide-react';
import type { MenuShellActions, MenuShellData } from '../../../types';
import { FRANKS_LOGO_URL } from '../brand';
import { categoryEmoji, formatPrice } from '../../../lib/display';

const onInk = 'rgba(255,255,255,0.66)';
const onInkBorder = 'rgba(255,255,255,0.14)';

/** Dark hero: local logo lockup, tagline, search and quick facts. */
export function FranksHero({ data, actions }: { data: MenuShellData; actions: MenuShellActions }) {
  const { appearance, menu } = data;
  const logo = appearance.logoUrl ?? FRANKS_LOGO_URL;

  return (
    <header style={{ backgroundColor: appearance.ink }}>
      <div className="mx-auto max-w-6xl px-4 pb-10 pt-8 md:px-8 md:pt-14">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <img src={logo} alt={menu.tenant.name} className="h-12 w-auto md:h-16" />
            <p className="mt-5 text-[11px] font-extrabold uppercase tracking-[0.3em]" style={{ color: onInk }}>
              Menu digitale
            </p>
            {appearance.tagline && (
              <p className="display mt-2 text-2xl font-extrabold text-white md:text-4xl">{appearance.tagline}</p>
            )}
          </div>

          <div className="w-full md:w-[26rem]">
            <label className="relative block">
              <span className="sr-only">Cerca nel menu</span>
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: onInk }} />
              <input
                type="search"
                placeholder="Cerca piatti, ingredienti…"
                value={data.searchQuery}
                onChange={(event) => actions.onSearch(event.target.value)}
                className="min-h-[48px] w-full rounded-full border pl-11 pr-4 text-sm text-white outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)]"
                style={{ backgroundColor: appearance.inkSoft, borderColor: onInkBorder }}
              />
            </label>
          </div>
        </div>

        <div className="mt-7 flex flex-wrap gap-2">
          <Fact label={`${menu.items.length} piatti`} />
          <Fact label={`${menu.categories.length} categorie`} />
          {actions.takeawayEnabled && <Fact label="Ordina per asporto" accent />}
        </div>
      </div>
      <div className="h-1 w-full" style={{ backgroundColor: appearance.accent }} />
    </header>
  );
}

function Fact({ label, accent }: { label: string; accent?: boolean }) {
  return (
    <span
      className="rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest"
      style={
        accent
          ? {
              backgroundColor: 'var(--brand-accent)',
              color: 'var(--brand-on-accent)',
              borderColor: 'var(--brand-accent)',
            }
          : { color: onInk, borderColor: onInkBorder }
      }
    >
      {label}
    </span>
  );
}

/**
 * Sticky navigation: category chips plus the cart affordance this scaffold owns
 * (the page hides its floating pill when `cartAffordance === 'shell'`).
 */
export function FranksNav({
  data,
  actions,
}: {
  data: MenuShellData;
  actions: MenuShellActions;
}) {
  const { categories, activeCategory, appearance } = data;

  return (
    <div
      className="sticky top-0 z-30 border-b"
      style={{
        backgroundColor: 'rgba(11,11,12,0.92)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        borderColor: onInkBorder,
      }}
    >
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 md:px-8">
        <nav className="no-scrollbar -mx-1 flex flex-1 gap-1.5 overflow-x-auto py-2.5" aria-label="Categorie">
          {[{ id: 'all', name: 'Tutti' }, ...categories].map((cat) => {
            const active = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => actions.onSelectCategory(cat.id)}
                aria-pressed={active}
                className="flex min-h-[40px] flex-none items-center gap-1.5 rounded-full px-3.5 text-xs font-bold transition-colors"
                style={{
                  backgroundColor: active ? appearance.accent : 'transparent',
                  color: active ? appearance.accentForeground : onInk,
                }}
              >
                <span className="text-sm leading-none">{categoryEmoji(cat.name)}</span>
                {cat.name}
              </button>
            );
          })}
        </nav>

        {actions.takeawayEnabled && actions.cartCount > 0 && !actions.cartOpen && (
          <button
            type="button"
            onClick={actions.openCart}
            className="flex min-h-[44px] flex-none items-center gap-2 rounded-full px-4 text-xs font-extrabold uppercase tracking-widest tabular-nums"
            style={{ backgroundColor: appearance.accent, color: appearance.accentForeground }}
            aria-label={`Apri carrello, ${actions.cartCount} articoli`}
          >
            <ShoppingBag className="h-4 w-4" />
            {actions.cartCount}
            <span className="hidden sm:inline">· {formatPrice(appearance.currency, actions.cartTotal)}</span>
          </button>
        )}
      </div>
    </div>
  );
}

export function FranksFooter({ data }: { data: MenuShellData }) {
  const note = data.config.content?.footerNote;
  return (
    <footer className="mt-10" style={{ backgroundColor: data.appearance.ink }}>
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 md:flex-row md:items-center md:justify-between md:px-8">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.24em] text-white">{data.menu.tenant.name}</p>
        <p className="text-[11px]" style={{ color: onInk }}>
          {note ?? 'Menu digitale · ordina in autonomia'}
        </p>
      </div>
      <div className="h-1 w-full" style={{ backgroundColor: data.appearance.accent }} />
    </footer>
  );
}

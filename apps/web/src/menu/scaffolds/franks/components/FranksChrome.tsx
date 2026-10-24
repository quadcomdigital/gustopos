import { Search, ShoppingBag, UsersRound } from 'lucide-react';
import type { MenuShellActions, MenuShellData } from '../../../types';
import { FRANKS_LOGO_URL } from '../brand';
import { formatPrice } from '../../../lib/display';
import { useScrolled } from '../useScrolled';

const onInkBorder = 'rgba(255,255,255,0.12)';
const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-white';

/**
 * Brand band. Deliberately small: it identifies the venue and gets out of the
 * way. Kept dark on purpose — the Franks wordmark is white and only reads on
 * ink, so this stays the single dark surface while the body goes light.
 */
export function FranksHero({ data }: { data: MenuShellData }) {
  const { appearance, menu } = data;
  const logo = appearance.logoUrl ?? FRANKS_LOGO_URL;
  const hero = appearance.heroImageUrl;

  return (
    <header className="relative overflow-hidden" style={{ backgroundColor: appearance.ink }}>
      {/* Optional tenant hero image: the band only grows when one is configured. */}
      {hero ? (
        <div className="absolute inset-0" aria-hidden="true">
          <img src={hero} alt="" className="h-full w-full object-cover" />
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(180deg, rgba(11,11,12,0.5) 0%, rgba(11,11,12,0.82) 62%, rgba(11,11,12,0.95) 100%)',
            }}
          />
        </div>
      ) : (
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden="true"
          style={{
            background: `radial-gradient(80% 130% at 50% -30%, ${appearance.accent}1a 0%, transparent 60%)`,
          }}
        />
      )}

      <div
        className={`fr-enter relative mx-auto flex max-w-6xl flex-col items-center gap-3 px-5 ${
          hero ? 'py-16 md:py-24' : 'py-7 md:py-9'
        }`}
      >
        <img
          src={logo}
          alt={menu.tenant.name}
          width={220}
          height={56}
          className="h-9 w-auto md:h-11"
        />
        {appearance.tagline && (
          <p className="display max-w-xl text-center text-[15px] font-semibold text-white/80 md:text-lg">
            {appearance.tagline}
          </p>
        )}
      </div>
      <div className="relative h-px w-full" style={{ backgroundColor: onInkBorder }} />
    </header>
  );
}

/**
 * Light sticky toolbar: search + category chips. It compacts once the brand band
 * scrolls away so the dish list keeps as much viewport as possible.
 */
export function FranksNav({ data, actions }: { data: MenuShellData; actions: MenuShellActions }) {
  const { categories, activeCategory, appearance } = data;
  const scrolled = useScrolled();

  return (
    <div
      className="sticky top-0 z-30 border-b backdrop-blur-md"
      style={{
        backgroundColor: 'rgba(255,255,255,0.9)',
        borderColor: appearance.border,
        boxShadow: scrolled ? '0 10px 30px -24px rgba(16,16,18,0.5)' : 'none',
      }}
    >
      <div className={`mx-auto max-w-6xl px-4 transition-[padding] duration-300 md:px-8 ${scrolled ? 'py-2' : 'py-3'}`}>
        <div className="flex items-center gap-3">
          <label className="relative block flex-1">
            <span className="sr-only">Cerca nel menu</span>
            <Search
              className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2"
              style={{ color: appearance.muted }}
              aria-hidden="true"
            />
            <input
              type="search"
              name="q"
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="search"
              placeholder="Cerca piatti, ingredienti…"
              value={data.searchQuery}
              onChange={(event) => actions.onSearch(event.target.value)}
              className={`fr-press fr-input min-h-[46px] w-full rounded-full border pl-11 pr-4 text-sm outline-none transition-shadow ${FOCUS_RING}`}
              style={{
                backgroundColor: appearance.surface,
                borderColor: appearance.border,
                color: appearance.ink,
              }}
            />
          </label>

          {/* Desktop: the scaffold owns the cart affordance. Mobile: bottom bar. */}
          {actions.takeawayEnabled && actions.cartCount > 0 && !actions.cartOpen && (
            <button
              type="button"
              onClick={actions.openCart}
              className="fr-press hidden min-h-[46px] flex-none items-center gap-2 rounded-full px-4 text-xs font-bold uppercase tracking-widest tabular-nums transition-transform active:scale-95 md:flex"
              style={{ backgroundColor: appearance.ink, color: '#ffffff' }}
              aria-label={`Apri carrello, ${actions.cartCount} articoli`}
            >
              <ShoppingBag className="h-4 w-4" aria-hidden="true" />
              {actions.cartCount}
              <span className="hidden sm:inline">· {formatPrice(appearance.currency, actions.cartTotal)}</span>
            </button>
          )}
        </div>

        <nav className="fr-scroller -mx-1 mt-2.5 flex gap-2 overflow-x-auto px-1 pb-0.5" aria-label="Categorie">
          {[{ id: 'all', name: 'Tutti' }, ...categories].map((cat) => {
            const active = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => actions.onSelectCategory(cat.id)}
                aria-pressed={active}
                className={`fr-press flex min-h-[38px] flex-none items-center rounded-full border px-4 text-[13px] font-semibold transition-colors duration-200 ${FOCUS_RING} ${
                  active ? '' : 'fr-chip'
                }`}
                style={
                  active
                    ? { backgroundColor: appearance.ink, color: '#ffffff', borderColor: appearance.ink }
                    : { color: appearance.muted, borderColor: appearance.border }
                }
              >
                {cat.name}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

export function FranksFooter({ data, actions }: { data: MenuShellData; actions: MenuShellActions }) {
  const note = data.config.content?.footerNote;
  const { appearance } = data;

  return (
    <footer className="mt-16 border-t" style={{ borderColor: appearance.border }}>
      <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-8 md:flex-row md:items-center md:justify-between md:px-8">
        <div className="flex flex-col gap-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.24em]" style={{ color: appearance.ink }}>
            {data.menu.tenant.name}
          </p>
          <p className="text-[11px]" style={{ color: appearance.muted }}>
            {note ?? 'Menu digitale · ordina in autonomia'}
          </p>
        </div>

        {/* The scaffold owns its chrome, so the group-order entry lives here
            instead of as a floating pill over the menu. */}
        {actions.groupOrderEnabled && (
          <button
            type="button"
            onClick={actions.onGroupOrder}
            className={`fr-press inline-flex min-h-[44px] items-center gap-2 self-start rounded-full border px-4 text-[11px] font-bold uppercase tracking-[0.16em] transition-colors md:self-auto ${FOCUS_RING}`}
            style={{ borderColor: appearance.border, color: appearance.ink }}
          >
            <UsersRound className="h-4 w-4" aria-hidden="true" />
            Ordina insieme
          </button>
        )}
      </div>
      <div className="h-1 w-full" style={{ backgroundColor: appearance.accent }} />
    </footer>
  );
}

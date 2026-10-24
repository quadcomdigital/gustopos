import type { CSSProperties } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ShoppingBag } from 'lucide-react';
import type { MenuShellProps } from '../../types';
import './franks.css';
import { FranksFooter, FranksHero, FranksNav } from './components/FranksChrome';
import { FranksHighlights } from './components/FranksHighlights';
import { FranksItemGrid } from './components/FranksItemGrid';
import { formatPrice } from '../../lib/display';

/**
 * Franks menu shell — the tenant's own layout. It deliberately shares nothing
 * with the default shell's components: the shared layer only hands it the data
 * contract (`MenuShellProps`) and the brand tokens, so nothing here can leak
 * back into another tenant's menu.
 *
 * Design language: a single dark brand band (the white wordmark needs ink) over a
 * light, airy body — soft cards, generous rhythm, accent reserved for actions.
 */
export default function FranksMenuShell({ data, actions }: MenuShellProps) {
  const { appearance, enabledSections } = data;

  // The scaffold owns the cart affordance (`cartButton: 'shell'`): a fixed bottom
  // bar on mobile (reserve room for it) plus the desktop chip inside `FranksNav`.
  const showCartBar = actions.takeawayEnabled && actions.cartCount > 0 && !actions.cartOpen;

  // Brand tokens published as CSS variables so focus rings and any CSS-only
  // states inside the scaffold stay on the same accent without inline styles.
  const rootStyle = {
    backgroundColor: appearance.pageBg,
    '--brand-accent': appearance.accent,
    '--brand-on-accent': appearance.accentForeground,
    '--brand-ink': appearance.ink,
    '--brand-border': appearance.border,
    '--brand-muted': appearance.muted,
  } as CSSProperties;

  return (
    <div
      className={`min-h-[100dvh] ${actions.takeawayEnabled ? 'pb-24 md:pb-0' : ''}`}
      style={rootStyle}
    >
      {enabledSections.has('hero') && <FranksHero data={data} />}
      {enabledSections.has('categories_nav') && <FranksNav data={data} actions={actions} />}

      <main className="mx-auto max-w-6xl px-4 py-8 md:px-8 md:py-12">
        {/* Self-gating on the preset (or an explicit section toggle). */}
        <FranksHighlights data={data} actions={actions} />
        {enabledSections.has('item_grid') && <FranksItemGrid data={data} actions={actions} />}
      </main>

      {enabledSections.has('footer_note') && <FranksFooter data={data} actions={actions} />}

      <AnimatePresence>
        {showCartBar && (
          <motion.div
            key="franks-cart-bar"
            initial={{ y: 96 }}
            animate={{ y: 0 }}
            exit={{ y: 96 }}
            transition={{ type: 'spring', damping: 26, stiffness: 240 }}
            className="fixed inset-x-0 bottom-0 z-50 md:hidden"
            style={{
              backgroundColor: 'rgba(255,255,255,0.96)',
              borderTop: `1px solid ${appearance.border}`,
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              boxShadow: '0 -14px 34px -26px rgba(16,16,18,0.55)',
            }}
          >
            <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p
                  className="text-[10px] font-bold uppercase tracking-[0.2em]"
                  style={{ color: appearance.muted }}
                >
                  {actions.cartCount} {actions.cartCount === 1 ? 'articolo' : 'articoli'}
                </p>
                <p className="text-base font-extrabold tabular-nums" style={{ color: appearance.ink }}>
                  {formatPrice(appearance.currency, actions.cartTotal)}
                </p>
              </div>
              <button
                type="button"
                onClick={actions.openCart}
                className="flex min-h-[48px] items-center gap-2 rounded-full px-5 text-xs font-extrabold uppercase tracking-[0.16em] transition-transform active:scale-[0.98]"
                style={{ backgroundColor: appearance.ink, color: '#ffffff' }}
              >
                <ShoppingBag className="h-4 w-4" aria-hidden="true" />
                Vedi carrello
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ShoppingBag, X } from 'lucide-react';
import type { CartDrawerProps } from '../../types';
import {
  AccountPrompt,
  CartEmpty,
  CartLine,
  CheckoutStepper,
  ConfirmSummary,
  CustomerFields,
} from '../../overlays/cartParts';
import { FRANKS_LOGO_URL } from './brand';
import { useDrawerChrome } from '../../lib/useDrawerChrome';

/**
 * Franks cart overlay: same ordering model as the generic drawer, re-composed
 * on the tenant's own chrome (dark header with the local logo, accent-filled
 * steps and CTA). This is the scaffold's opt-in replacement for the shared
 * drawer — no tenant logic lives outside this folder.
 */
export default function FranksCartDrawer({
  appearance,
  currency,
  formatPrice,
  onClose,
  tenantSlug,
  cart,
  cartCount,
  cartTotal,
  checkoutStep,
  setCheckoutStep,
  onIncrement,
  onDecrement,
  onRemove,
  optionNameById,
  ingredientNameById,
  takeawayConfig,
  submitting,
  successId,
  submitError,
  blockedReason,
  onSubmit,
  customer,
  auth,
}: CartDrawerProps) {
  useDrawerChrome(onClose);

  return (
    <div className="fixed inset-0 z-[60] flex justify-end overflow-hidden" role="dialog" aria-modal="true" aria-label="Il tuo ordine">
      <motion.button
        type="button"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/55 backdrop-blur-sm"
        aria-label="Chiudi carrello"
      />
      <motion.section
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 24, stiffness: 190 }}
        className="relative flex h-full w-full flex-col shadow-2xl sm:max-w-lg"
        style={{ backgroundColor: appearance.pageBg }}
      >
        <div className="flex items-center justify-between p-4" style={{ backgroundColor: appearance.ink }}>
          <div className="flex min-w-0 items-center gap-3">
            <img src={FRANKS_LOGO_URL} alt="" className="h-7 w-auto shrink-0" />
            <span className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-white/55">
              {cartCount} {cartCount === 1 ? 'articolo' : 'articoli'}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Chiudi"
            className="flex h-11 w-11 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-4 pt-4" style={{ backgroundColor: appearance.pageBg }}>
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-4 w-4" style={{ color: appearance.accentText }} />
            <h2 className="display text-xl font-extrabold" style={{ color: appearance.ink }}>
              Il tuo ordine
            </h2>
          </div>
        </div>

        {cart.length > 0 && (
          <div className="p-4 pb-0">
            <CheckoutStepper
              step={checkoutStep}
              onChange={setCheckoutStep}
              appearance={appearance}
              activeVariant="accent"
            />
          </div>
        )}

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-4">
          {cart.length === 0 ? (
            <CartEmpty appearance={appearance} onBrowse={onClose} />
          ) : checkoutStep === 'cart' ? (
            cart.map((line) => (
              <motion.div key={line.id} layout initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}>
                <CartLine
                  line={line}
                  appearance={appearance}
                  currency={currency}
                  formatPrice={formatPrice}
                  optionNameById={optionNameById}
                  ingredientNameById={ingredientNameById}
                  onIncrement={onIncrement}
                  onDecrement={onDecrement}
                  onRemove={onRemove}
                />
              </motion.div>
            ))
          ) : (
            <div className="space-y-3">
              <CustomerFields customer={customer} takeawayConfig={takeawayConfig} appearance={appearance} />
              <ConfirmSummary customer={customer} appearance={appearance} />
              {/* Accounts are offered at checkout, never required before it. */}
              <AccountPrompt auth={auth} appearance={appearance} />
            </div>
          )}
        </div>

        {cart.length > 0 && (
          <div
            className="space-y-3 border-t p-4"
            style={{
              borderColor: appearance.border,
              paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))',
            }}
          >
            <div className="flex items-end justify-between">
              <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: appearance.muted }}>
                Totale
              </span>
              <span className="text-2xl font-extrabold tabular-nums" style={{ color: appearance.ink }}>
                {formatPrice(cartTotal)}
              </span>
            </div>
            <div className="space-y-0.5 text-[11px] tabular-nums" style={{ color: appearance.muted }}>
              <p>Minimo {formatPrice(takeawayConfig.minOrderAmount)}</p>
              <p>Max {takeawayConfig.maxItems} articoli</p>
              {takeawayConfig.pickupEtaRequired && <p>Pickup ETA obbligatorio</p>}
            </div>
            <button
              type="button"
              onClick={() => (checkoutStep === 'confirm' ? onSubmit() : setCheckoutStep('confirm'))}
              disabled={submitting || (checkoutStep === 'confirm' && Boolean(blockedReason))}
              className="min-h-[52px] w-full rounded-full text-xs font-extrabold uppercase tracking-[0.16em] transition-transform active:scale-[0.99] disabled:opacity-50"
              style={{ backgroundColor: appearance.accent, color: appearance.accentForeground }}
            >
              {submitting ? 'Invio…' : checkoutStep === 'confirm' ? 'Conferma ordine' : 'Vai alla conferma'}
            </button>
            {blockedReason && <p className="text-xs text-amber-700">{blockedReason}</p>}
            {submitError && <p className="text-xs text-rose-600">{submitError}</p>}
            {successId && (
              <div className="space-y-2 text-center">
                <p className="text-xs font-semibold text-emerald-600">Ordine inviato (ID: {successId})</p>
                <Link
                  className="text-xs font-semibold underline"
                  style={{ color: appearance.accentText }}
                  to={`/${tenantSlug}/takeaway/track`}
                >
                  Traccia ordine
                </Link>
                <AccountPrompt
                  auth={auth}
                  appearance={appearance}
                  label="Crea un account per ritrovare l'ordine"
                />
              </div>
            )}
          </div>
        )}
      </motion.section>
    </div>
  );
}

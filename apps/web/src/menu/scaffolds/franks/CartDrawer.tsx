import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ShoppingBag, X } from 'lucide-react';
import type { CartDrawerProps } from '../../types';
import {
  AccountBlock,
  CartEmpty,
  CartLine,
  CheckoutStepper,
  ConfirmSummary,
  CustomerFields,
} from '../../overlays/cartParts';
import { FRANKS_LOGO_URL } from './brand';

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
  takeawayConfig,
  submitting,
  successId,
  submitError,
  blockedReason,
  onSubmit,
  customer,
  auth,
}: CartDrawerProps) {
  return (
    <div className="fixed inset-0 z-[60] flex justify-end">
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
        className="relative flex h-full w-full max-w-md flex-col shadow-2xl"
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

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
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
                  onIncrement={onIncrement}
                  onDecrement={onDecrement}
                  onRemove={onRemove}
                />
              </motion.div>
            ))
          ) : checkoutStep === 'customer' ? (
            <div className="space-y-3">
              <AccountBlock auth={auth} appearance={appearance} />
              <CustomerFields customer={customer} takeawayConfig={takeawayConfig} appearance={appearance} />
            </div>
          ) : (
            <ConfirmSummary customer={customer} appearance={appearance} />
          )}
        </div>

        {cart.length > 0 && (
          <div className="space-y-3 border-t p-4" style={{ borderColor: appearance.border }}>
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
              onClick={onSubmit}
              disabled={submitting || Boolean(blockedReason) || checkoutStep !== 'confirm'}
              className="min-h-[52px] w-full rounded-full text-xs font-extrabold uppercase tracking-[0.16em] transition-transform active:scale-[0.99] disabled:opacity-50"
              style={{ backgroundColor: appearance.accent, color: appearance.accentForeground }}
            >
              {submitting ? 'Invio…' : 'Conferma ordine'}
            </button>
            {checkoutStep !== 'confirm' && (
              <p className="text-center text-[11px]" style={{ color: appearance.muted }}>
                Apri &quot;Conferma&quot; per inviare l&apos;ordine.
              </p>
            )}
            {blockedReason && <p className="text-xs text-amber-700">{blockedReason}</p>}
            {submitError && <p className="text-xs text-rose-600">{submitError}</p>}
            {successId && (
              <div className="space-y-1 text-center">
                <p className="text-xs font-semibold text-emerald-600">Ordine inviato (ID: {successId})</p>
                <Link
                  className="text-xs font-semibold underline"
                  style={{ color: appearance.accentText }}
                  to={`/${tenantSlug}/takeaway/track`}
                >
                  Traccia ordine
                </Link>
              </div>
            )}
          </div>
        )}
      </motion.section>
    </div>
  );
}

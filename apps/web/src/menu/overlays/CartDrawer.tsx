import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ShoppingBag, X } from 'lucide-react';
import type { CartDrawerProps } from '../types';
import {
  AccountBlock,
  CartEmpty,
  CartLine,
  CheckoutStepper,
  ConfirmSummary,
  CustomerFields,
} from './cartParts';

/**
 * Generic cart / checkout overlay. Every colour comes from `MenuAppearance`,
 * so it renders correctly for any tenant; a scaffold may replace it entirely
 * via the registry while reusing the pieces in `cartParts`.
 */
export default function CartDrawer({
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
        className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm"
        aria-label="Chiudi carrello"
      />
      <motion.section
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 24, stiffness: 190 }}
        className="relative flex h-full w-full max-w-md flex-col shadow-2xl"
        style={{ backgroundColor: appearance.surface }}
      >
        <div
          className="flex items-center justify-between p-4 border-b"
          style={{ backgroundColor: appearance.ink, borderColor: 'rgba(255,255,255,0.1)' }}
        >
          <div className="flex items-center gap-3">
            <ShoppingBag className="h-5 w-5" style={{ color: appearance.accent }} />
            <h2 className="display text-xl font-extrabold text-white">Il tuo ordine</h2>
            <span className="text-[11px] font-bold tabular-nums text-white/50">{cartCount} pz</span>
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

        {cart.length > 0 && (
          <div className="border-b p-4" style={{ backgroundColor: appearance.pageBg, borderColor: appearance.border }}>
            <CheckoutStepper step={checkoutStep} onChange={setCheckoutStep} appearance={appearance} />
          </div>
        )}

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
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
          <div
            className="space-y-3 border-t p-4"
            style={{ backgroundColor: appearance.pageBg, borderColor: appearance.border }}
          >
            <div className="flex items-center justify-between text-sm">
              <span style={{ color: appearance.muted }}>Totale</span>
              <span className="text-base font-extrabold tabular-nums" style={{ color: appearance.ink }}>
                {formatPrice(cartTotal)}
              </span>
            </div>
            <div className="space-y-0.5 text-[11px] tabular-nums" style={{ color: appearance.muted }}>
              <p>Minimo ordine: {formatPrice(takeawayConfig.minOrderAmount)}</p>
              <p>Max articoli: {takeawayConfig.maxItems}</p>
              {takeawayConfig.pickupEtaRequired && <p>Pickup ETA obbligatorio</p>}
            </div>
            <button
              type="button"
              onClick={onSubmit}
              disabled={submitting || Boolean(blockedReason) || checkoutStep !== 'confirm'}
              className="min-h-[48px] w-full rounded-xl text-xs font-extrabold uppercase tracking-[0.14em] transition-colors disabled:opacity-50"
              style={{ backgroundColor: appearance.accent, color: appearance.accentForeground }}
            >
              {submitting ? 'Invio…' : 'Conferma ordine takeaway'}
            </button>
            {checkoutStep !== 'confirm' && (
              <p className="text-xs" style={{ color: appearance.muted }}>
                Completa gli step e apri &quot;Conferma&quot; per inviare l&apos;ordine.
              </p>
            )}
            {blockedReason && <p className="text-xs text-amber-700">{blockedReason}</p>}
            {submitError && <p className="text-xs text-rose-600">{submitError}</p>}
            {successId && (
              <div className="space-y-1">
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

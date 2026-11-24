import { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ArrowLeft } from 'lucide-react';
import { useCheckoutStore } from '../../store/checkout-store';
import { lockBodyScroll, unlockBodyScroll } from '../../shared/ui/utils/scrollLock';
import CheckoutMainView from './CheckoutMainView';
import SplitBillView from './SplitBillView';
import PayItemsView from './PayItemsView';
import CloseTableView from './CloseTableView';
import CheckoutErrorBanner from './CheckoutErrorBanner';

/**
 * Checkout come drawer laterale al 70% dello schermo: i riepiloghi (righe,
 * quote, totali e residuo) hanno spazio reale invece di stare schiacciati in
 * un modal centrato. Su mobile occupa tutto lo schermo.
 */
export default function CheckoutModal() {
  const { isOpen, step, tableNumber, closeCheckout, setStep } = useCheckoutStore();

  const canGoBack = step !== 'main';

  useEffect(() => {
    if (!isOpen) return;
    lockBodyScroll();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeCheckout();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      unlockBodyScroll();
    };
  }, [isOpen, closeCheckout]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[1100]" role="dialog" aria-modal="true" aria-label={`Checkout tavolo ${tableNumber ?? ''}`}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeCheckout}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
            className="absolute inset-y-0 right-0 flex w-full flex-col overflow-hidden bg-bg shadow-2xl md:w-[70vw] md:max-w-[1200px] md:rounded-l-2xl"
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-bg/50 p-3 sm:p-4">
              <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                {canGoBack && (
                  <button
                    onClick={() => setStep('main')}
                    className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full transition-colors hover:bg-white"
                    aria-label="Torna indietro"
                  >
                    <ArrowLeft size={20} />
                  </button>
                )}
                <div className="min-w-0">
                  <h3 className="truncate text-base font-bold uppercase tracking-tight text-primary sm:text-lg">
                    Tavolo {tableNumber}
                  </h3>
                  <p className="text-sm font-medium text-text-muted">
                    {step === 'main' && 'Checkout'}
                    {step === 'split' && 'Dividi il conto'}
                    {step === 'pay_items' && 'Paga selezione'}
                    {step === 'close' && 'Paga tutto'}
                  </p>
                </div>
              </div>
              <button
                onClick={closeCheckout}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-text-muted transition-colors hover:bg-white"
                aria-label="Chiudi checkout"
              >
                <X size={20} />
              </button>
            </div>

            <CheckoutErrorBanner />

            <div className="min-h-0 flex-1 overflow-y-auto">
              {step === 'main' && <CheckoutMainView />}
              {step === 'split' && <SplitBillView />}
              {step === 'pay_items' && <PayItemsView />}
              {step === 'close' && <CloseTableView />}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

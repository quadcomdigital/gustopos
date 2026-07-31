import { motion, AnimatePresence } from 'motion/react';
import { X, ArrowLeft } from 'lucide-react';
import { useCheckoutStore } from '../../store/checkout-store';
import CheckoutMainView from './CheckoutMainView';
import SplitBillView from './SplitBillView';
import PayItemsView from './PayItemsView';
import CloseTableView from './CloseTableView';

export default function CheckoutModal() {
  const { isOpen, step, tableNumber, closeCheckout, setStep } = useCheckoutStore();

  const canGoBack = step !== 'main';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-bg rounded-2xl shadow-2xl w-full max-w-3xl max-h-[95vh] flex flex-col overflow-hidden"
          >
            <div className="flex items-center justify-between p-4 border-b border-border bg-bg/50">
              <div className="flex items-center gap-3">
                {canGoBack && (
                  <button
                    onClick={() => setStep('main')}
                    className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-white rounded-full transition-colors"
                    aria-label="Torna indietro"
                  >
                    <ArrowLeft size={20} />
                  </button>
                )}
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-primary uppercase tracking-tight">
                    Tavolo {tableNumber}
                  </h3>
                  <p className="text-sm text-text-muted font-medium">
                    {step === 'main' && 'Checkout'}
                    {step === 'split' && 'Dividi il conto'}
                    {step === 'pay_items' && 'Paga selezione'}
                    {step === 'close' && 'Paga tutto'}
                  </p>
                </div>
              </div>
              <button
                onClick={closeCheckout}
                className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-white rounded-full transition-colors text-text-muted"
                aria-label="Chiudi checkout"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0">
              {step === 'main' && <CheckoutMainView />}
              {step === 'split' && <SplitBillView />}
              {step === 'pay_items' && <PayItemsView />}
              {step === 'close' && <CloseTableView />}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

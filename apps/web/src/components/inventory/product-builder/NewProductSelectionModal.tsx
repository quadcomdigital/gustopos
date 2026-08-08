import { motion, AnimatePresence } from 'motion/react';
import { X, GlassWater, Sandwich } from 'lucide-react';

interface NewProductSelectionModalProps {
  open: boolean;
  onClose: () => void;
  onSelectSimple: () => void;
  onSelectVariable: () => void;
  onSelectFood: () => void;
}

export default function NewProductSelectionModal({
  open,
  onClose,
  onSelectSimple,
  onSelectVariable,
  onSelectFood,
}: NewProductSelectionModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[1200] overflow-y-auto" role="dialog" aria-modal="true" aria-label="Seleziona tipo prodotto">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />
          <div className="min-h-full flex items-end sm:items-center justify-center py-4 sm:py-6">
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 60 }}
            transition={{ type: 'spring', damping: 28, stiffness: 350 }}
            className="relative bg-white w-full rounded-t-2xl sm:rounded-2xl shadow-2xl sm:max-w-lg max-h-[95dvh] flex flex-col overflow-hidden outline-none"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
              <p className="text-xs font-bold uppercase tracking-widest text-primary">Nuovo prodotto</p>
              <button onClick={onClose} className="min-w-[44px] min-h-[44px] flex items-center justify-center p-1.5 hover:bg-bg rounded-full transition-colors text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1" aria-label="Chiudi">
                <X size={18} />
              </button>
            </div>
            <div className="p-4 space-y-3 overflow-y-auto">
              <p className="text-xs text-text-muted text-center mb-4">Seleziona il tipo di prodotto da creare</p>

              <button
                type="button"
                onClick={onSelectSimple}
                className="w-full flex items-center gap-4 p-4 rounded-xl border border-border hover:border-accent hover:bg-accent/5 transition-all group text-left"
              >
                <div className="w-12 h-12 rounded-xl bg-info-50 flex items-center justify-center shrink-0 group-hover:bg-info-100 transition-colors">
                  <GlassWater size={24} className="text-info-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-primary">Prodotto semplice</p>
                  <p className="text-[11px] text-text-muted mt-0.5">Articoli pronti alla vendita (Coca-Cola, Acqua, ecc.)</p>
                </div>
              </button>

              <button
                type="button"
                onClick={onSelectVariable}
                className="w-full flex items-center gap-4 p-4 rounded-xl border border-border hover:border-accent hover:bg-accent/5 transition-all group text-left"
              >
                <div className="w-12 h-12 rounded-xl bg-warning-50 flex items-center justify-center shrink-0 group-hover:bg-warning-100 transition-colors">
                  <GlassWater size={24} className="text-warning-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-primary">Prodotto variabile</p>
                  <p className="text-[11px] text-text-muted mt-0.5">Stesso articolo, formati diversi (Birra 33cl/66cl, ecc.)</p>
                </div>
              </button>

              <button
                type="button"
                onClick={onSelectFood}
                className="w-full flex items-center gap-4 p-4 rounded-xl border border-border hover:border-accent hover:bg-accent/5 transition-all group text-left"
              >
                <div className="w-12 h-12 rounded-xl bg-success-50 flex items-center justify-center shrink-0 group-hover:bg-success-100 transition-colors">
                  <Sandwich size={24} className="text-success-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-primary">Prodotto food</p>
                  <p className="text-[11px] text-text-muted mt-0.5">Composto da ingredienti e preps (Smash Burger, ecc.)</p>
                </div>
              </button>
            </div>
          </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}

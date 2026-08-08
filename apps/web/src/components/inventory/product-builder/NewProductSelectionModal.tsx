import Modal from '../../../shared/ui/molecules/Modal';
import { GlassWater, Sandwich } from 'lucide-react';

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
    <Modal open={open} onClose={onClose} title="Nuovo prodotto" size="md" zIndex={1200}>
      <div className="space-y-3">
        <p className="text-xs text-text-muted text-center mb-4">Seleziona il tipo di prodotto da creare</p>

        <button
          type="button"
          onClick={onSelectSimple}
          className="w-full min-h-[76px] flex items-center gap-4 p-4 rounded-xl border border-border hover:border-accent hover:bg-accent/5 transition-all active:scale-[0.99] group text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
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
          className="w-full min-h-[76px] flex items-center gap-4 p-4 rounded-xl border border-border hover:border-accent hover:bg-accent/5 transition-all active:scale-[0.99] group text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
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
          className="w-full min-h-[76px] flex items-center gap-4 p-4 rounded-xl border border-border hover:border-accent hover:bg-accent/5 transition-all active:scale-[0.99] group text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
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
    </Modal>
  );
}

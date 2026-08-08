import { useEffect, useMemo, useState } from 'react';
import type { CartItem, CourseRoundsConfig } from '@gustopos/shared';
import { ArrowDownUp, Check, X } from 'lucide-react';
import Modal from '../shared/ui/molecules/Modal';
import { cn } from '../lib/utils';

interface RoundReorderDialogProps {
  open: boolean;
  cart: CartItem[];
  config: CourseRoundsConfig;
  onClose: () => void;
  onApply: (rounds: Record<string, number | null>) => void;
}

export default function RoundReorderDialog({
  open,
  cart,
  config,
  onClose,
  onApply,
}: RoundReorderDialogProps) {
  const [rounds, setRounds] = useState<Record<string, number | null>>({});

  useEffect(() => {
    if (!open) return;
    setRounds(Object.fromEntries(cart.map((item) => [item.cartItemId, item.round ?? null])));
  }, [cart, open]);

  const activeItems = useMemo(() => cart.filter((item) => item.quantity > 0), [cart]);
  const missingRequiredRounds = config.required && activeItems.some((item) => rounds[item.cartItemId] === null || rounds[item.cartItemId] === undefined);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Imposta ordine portate"
      size="md"
      zIndex={1450}
      footer={(
        <>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-4 py-2 rounded-lg border border-border text-xs font-bold uppercase tracking-wider text-secondary hover:bg-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Annulla
          </button>
          <button
            type="button"
            onClick={() => onApply(rounds)}
            disabled={missingRequiredRounds}
            className="min-h-[44px] w-full sm:w-auto px-5 py-2 rounded-lg bg-accent text-white text-xs font-bold uppercase tracking-wider hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
          >
            <Check size={15} className="inline-block mr-1.5 -mt-0.5" />
            Applica portate
          </button>
        </>
      )}
    >
      <div className="rounded-xl border border-accent/20 bg-accent/5 p-3 flex items-start gap-3">
        <ArrowDownUp size={17} className="text-accent shrink-0 mt-0.5" />
        <p className="text-xs text-secondary leading-relaxed">
          Assegna ogni piatto alla portata in cui vuoi servirlo. Puoi modificare
          questa scelta anche dopo aver aggiunto gli articoli.
        </p>
      </div>

      {activeItems.length === 0 ? (
        <div className="py-8 text-center text-sm text-text-muted">Il carrello è vuoto.</div>
      ) : (
        <div className="space-y-3">
          {activeItems.map((item) => {
            const selectedRound = rounds[item.cartItemId] ?? null;
            return (
              <div key={item.cartItemId} className="rounded-xl border border-border bg-white p-3">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-primary truncate">{item.quantity}× {item.name}</p>
                    <p className="text-[10px] text-text-muted mt-0.5">
                      {selectedRound === null ? 'Nessuna portata assegnata' : config.labels[selectedRound] ?? `Portata ${selectedRound + 1}`}
                    </p>
                  </div>
                  {selectedRound !== null && !config.required && (
                    <button
                      type="button"
                      onClick={() => setRounds((current) => ({ ...current, [item.cartItemId]: null }))}
                      className="min-w-[44px] min-h-[44px] -mr-2 -mt-2 flex items-center justify-center rounded-lg text-text-muted hover:bg-bg hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      aria-label={`Rimuovi portata da ${item.name}`}
                    >
                      <X size={15} />
                    </button>
                  )}
                </div>
                {config.required && selectedRound === null && (
                  <p className="mb-2 text-[10px] font-semibold text-danger" role="alert">Seleziona una portata per continuare.</p>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {config.labels.map((label, index) => (
                    <button
                      type="button"
                      key={`${item.cartItemId}-${index}`}
                      onClick={() => setRounds((current) => ({ ...current, [item.cartItemId]: index }))}
                      className={cn(
                        'min-h-[44px] rounded-lg border px-3 py-2 text-xs font-bold text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                        selectedRound === index
                          ? 'border-accent bg-accent text-white shadow-sm'
                          : 'border-border bg-bg/40 text-secondary hover:border-accent hover:text-accent',
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

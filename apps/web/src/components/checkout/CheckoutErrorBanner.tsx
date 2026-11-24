import { AlertTriangle, ArrowRight } from 'lucide-react';
import { useCheckoutStore } from '../../store/checkout-store';
import { resolveCheckoutErrorAction } from './checkout-error-action';

/**
 * Errori del checkout con recovery guidato: quando il server rifiuta la
 * chiusura perché c'è una divisione in corso (o voci già parzialmente pagate),
 * l'operatore non deve cercare a mano il flusso giusto: un bottone lo porta lì.
 */
export default function CheckoutErrorBanner() {
  const { error, setStep, step } = useCheckoutStore();
  if (!error) return null;

  const action = resolveCheckoutErrorAction(error);
  const showAction = action !== null && action.step !== step;

  return (
    <div
      role="alert"
      className="mx-3 mt-3 sm:mx-4 flex flex-col gap-2 rounded-lg border border-danger/30 bg-danger/5 p-3"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle size={18} className="mt-0.5 shrink-0 text-danger" />
        <p className="text-sm font-semibold text-danger">{error}</p>
      </div>
      {showAction && (
        <button
          type="button"
          onClick={() => setStep(action.step)}
          className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-bold uppercase tracking-wider text-white active:scale-[0.99]"
        >
          {action.label}
          <ArrowRight size={16} />
        </button>
      )}
    </div>
  );
}

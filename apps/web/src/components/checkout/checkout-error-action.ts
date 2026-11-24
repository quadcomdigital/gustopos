import type { CheckoutStep } from '../../store/checkout-store';

export interface CheckoutErrorAction {
  step: CheckoutStep;
  label: string;
}

// Ordine voluto: quando il blocco nasce da una divisione in corso, il primo
// passo è sempre chiudere la divisione (saldo quote o annullo), anche se il
// messaggio del server cita anche le singole voci.
const SPLIT_PATTERNS: RegExp[] = [
  /split/,
  /quot[ae]/,
  /divisione/,
  /diviso/,
];

const ITEMS_PATTERNS: RegExp[] = [
  /not all items/,
  /singole voci/,
  /voci residue/,
  /paga(?:te|ti)? (?:le )?voci/,
];

/** Suggerisce lo step che risolve l'errore, o null se serve un'azione fuori dal checkout. */
export function resolveCheckoutErrorAction(message: string): CheckoutErrorAction | null {
  const text = message.trim().toLowerCase();
  if (text.length === 0) return null;

  if (SPLIT_PATTERNS.some((pattern) => pattern.test(text))) {
    return { step: 'split', label: 'Vai alla divisione' };
  }
  if (ITEMS_PATTERNS.some((pattern) => pattern.test(text))) {
    return { step: 'pay_items', label: 'Paga le voci residue' };
  }
  return null;
}

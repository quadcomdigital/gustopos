import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useBackdropDismiss } from '../hooks/useBackdropDismiss';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Conferma modale.
 *
 * - Renderizzato in un PORTAL su `document.body`: dentro un antenato con
 *   `transform` (frequente con `motion.div`) un `fixed inset-0` sarebbe
 *   posizionato rispetto a quell'antenato e il modale apparirebbe spostato.
 * - Focus trap: Tab/Shift+Tab restano dentro il pannello.
 * - ESC chiude, focus iniziale sul bottone di conferma, focus restituito
 *   all'elemento che aveva il focus alla chiusura.
 * - `aria-labelledby` / `aria-describedby` collegano titolo e messaggio.
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Conferma',
  cancelLabel = 'Annulla',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const confirmButtonRef = useRef<HTMLButtonElement | null>(null);
  const titleId = useId();
  const messageId = useId();
  const backdropDismiss = useBackdropDismiss(onCancel);
  // Latest-ref pattern: parents pass inline `onCancel` closures, so putting it
  // in the effect deps would re-run the effect on EVERY parent render and
  // `focus()` would steal focus back from inputs (closing the mobile
  // soft-keyboard right after it opens). The ref keeps the handler fresh
  // without ever re-running the effect.
  // eslint-disable-next-line react-hooks/refs -- latest-ref pattern avoids stale callbacks in the keydown listener
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;

  useEffect(() => {
    if (!open) {
      return;
    }
    const previouslyFocused = document.activeElement as HTMLElement | null;
    confirmButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCancelRef.current();
        return;
      }
      if (event.key !== 'Tab') return;

      const panel = panelRef.current;
      if (!panel) return;
      const focusables = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute('disabled') && element.offsetParent !== null);
      if (focusables.length === 0) return;

      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      // Il focus non deve restare su un elemento che sta sparendo.
      previouslyFocused?.focus?.();
    };
  }, [open]);

  if (!open) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[1300] flex items-center justify-center p-4">
      <button className="fixed inset-0 bg-black/50 backdrop-blur-sm" {...backdropDismiss} aria-label="Chiudi conferma" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        className="relative w-full max-w-sm md:max-w-md bg-white border border-border rounded-xl shadow-2xl p-4 space-y-3 max-h-[95dvh] overflow-y-auto"
      >
        <h3 id={titleId} className="text-sm font-bold text-secondary uppercase tracking-wider">{title}</h3>
        <p id={messageId} className="text-sm text-text-muted">{message}</p>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={onCancel} className="min-h-[44px] px-3 py-2.5 rounded border border-border text-xs font-bold uppercase tracking-wider">
            {cancelLabel}
          </button>
          <button ref={confirmButtonRef} onClick={onConfirm} className="min-h-[44px] px-3 py-2.5 rounded bg-primary text-white text-xs font-bold uppercase tracking-wider">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

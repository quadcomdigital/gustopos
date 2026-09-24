import { useCallback, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

/**
 * Backdrop dismiss guard.
 *
 * Only closes when the pointer press STARTS and ENDS on the backdrop itself.
 * This prevents the mobile soft-keyboard "ghost click": focusing an input
 * opens the keyboard, which reflows the viewport; the browser then dispatches
 * the tap's synthetic click after the reflow and it can land on the
 * full-screen backdrop, closing the modal by itself. `pointerdown` fires at
 * press time (before the keyboard/reflow), so a tap that started on an input
 * never dismisses.
 */
export function useBackdropDismiss(onClose: () => void) {
  const pressedOnBackdrop = useRef(false);

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    pressedOnBackdrop.current = event.target === event.currentTarget;
  }, []);

  const onPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (pressedOnBackdrop.current && event.target === event.currentTarget) {
        onClose();
      }
      pressedOnBackdrop.current = false;
    },
    [onClose],
  );

  const onPointerCancel = useCallback(() => {
    pressedOnBackdrop.current = false;
  }, []);

  return { onPointerDown, onPointerUp, onPointerCancel };
}

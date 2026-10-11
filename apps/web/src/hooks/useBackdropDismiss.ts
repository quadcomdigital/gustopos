import { useCallback, useEffect, useRef } from 'react';
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
 *
 * The press state lives on `window` (capture) and is evaluated at `pointerup`,
 * never on the backdrop element itself. The old element-scoped version only
 * reset its flag from handlers attached to the backdrop: a gesture starting on
 * the backdrop whose `pointerup` landed elsewhere (drag, reflow moving the
 * panel under the finger, pointercancel delivered to another element) left a
 * stale `true`, and the NEXT gesture — a tap on a text input whose pointerup
 * hit the backdrop after the keyboard reflow — closed the modal mid-typing.
 * Window-level capture sees the whole gesture, resets on every new press and
 * on pointercancel, so the flag can never leak between gestures.
 */
export function useBackdropDismiss(onClose: () => void) {
  const backdropRef = useRef<HTMLElement | null>(null);
  const pressRef = useRef<{ pointerId: number; target: EventTarget | null } | null>(null);
  const onCloseRef = useRef(onClose);
  // eslint-disable-next-line react-hooks/refs -- latest-ref pattern avoids stale callbacks in window listeners
  onCloseRef.current = onClose;

  // React handler: records which element IS the backdrop (set on the first
  // pointerdown, so window listeners can resolve it at pointerup time).
  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    backdropRef.current = event.currentTarget;
  }, []);

  useEffect(() => {
    const isBackdrop = (node: EventTarget | null) => {
      const backdrop = backdropRef.current;
      return Boolean(backdrop && node && backdrop.contains(node as Node));
    };

    const handleDown = (event: PointerEvent) => {
      // Any new press replaces the previous gesture: no stale flag survives.
      pressRef.current = { pointerId: event.pointerId, target: event.target };
    };

    const handleUp = (event: PointerEvent) => {
      const press = pressRef.current;
      pressRef.current = null;
      if (!press) return;
      if (press.pointerId !== event.pointerId) return;
      // Evaluated here (not at pointerdown) because React's handler that
      // populates backdropRef runs during pointerdown, before pointerup.
      if (!isBackdrop(press.target)) return;
      if (!isBackdrop(event.target)) return;
      onCloseRef.current();
    };

    const handleCancel = () => {
      pressRef.current = null;
    };

    // Capture phase: the state is updated before React's handlers and no
    // matter which element the event is dispatched to after a layout reflow.
    window.addEventListener('pointerdown', handleDown, true);
    window.addEventListener('pointerup', handleUp, true);
    window.addEventListener('pointercancel', handleCancel, true);
    return () => {
      window.removeEventListener('pointerdown', handleDown, true);
      window.removeEventListener('pointerup', handleUp, true);
      window.removeEventListener('pointercancel', handleCancel, true);
    };
  }, []);

  const onPointerCancel = useCallback(() => {
    pressRef.current = null;
  }, []);

  return { onPointerDown, onPointerCancel };
}

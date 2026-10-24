import { useEffect } from 'react';

/**
 * Behavior every side drawer shares: while it is on screen the page behind it
 * must not scroll (otherwise the cart "follows" the finger on mobile), and
 * Escape must close it like the backdrop does.
 */
export function useDrawerChrome(onClose: () => void): void {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);
}

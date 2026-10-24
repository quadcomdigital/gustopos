import { useEffect, useState } from 'react';

/**
 * True once the page has scrolled past `threshold` px. Used by the Franks chrome
 * to compact the sticky nav (and add a shadow) after the hero leaves the top.
 * Passive listener + coarse boolean so it never re-renders on every pixel.
 */
export function useScrolled(threshold = 12): boolean {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);

  return scrolled;
}

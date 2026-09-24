import { useEffect, useState } from 'react';

export type ViewportBand = 'mobile' | 'tablet' | 'desktop';

export interface Viewport {
  width: number;
  height: number;
  visualHeight: number;
  band: ViewportBand;
  isPortrait: boolean;
  isShort: boolean;
}

// Cart side panel starts at tablet, matching the shell's `md` breakpoint.
const MOBILE_MAX = 768;
const DESKTOP_MIN = 1024;
const SHORT_MAX = 560;

export function getViewportBand(width: number): ViewportBand {
  if (width < MOBILE_MAX) return 'mobile';
  if (width < DESKTOP_MIN) return 'tablet';
  return 'desktop';
}

function readViewport(): Viewport {
  if (typeof window === 'undefined') {
    return { width: 0, height: 0, visualHeight: 0, band: 'desktop', isPortrait: false, isShort: false };
  }
  const width = window.innerWidth;
  const height = window.innerHeight;
  const visualHeight = window.visualViewport?.height ?? height;
  return {
    width,
    height,
    visualHeight,
    band: getViewportBand(width),
    isPortrait: height >= width,
    isShort: visualHeight < SHORT_MAX,
  };
}

/**
 * Tracks the real terminal viewport (width + height, including the visual
 * viewport so on-screen keyboards / URL bars don't break `100dvh` layouts).
 *
 * Exposes a `band` derived from both dimensions and mirrors it on
 * `<html data-app-band>` plus a `--app-vh` custom property, so CSS and JS
 * cannot drift apart. Updates are coalesced with requestAnimationFrame.
 */
export function useViewport(): Viewport {
  const [viewport, setViewport] = useState<Viewport>(readViewport);

  useEffect(() => {
    let frame = 0;

    const sync = () => {
      frame = 0;
      const next = readViewport();
      setViewport((prev) =>
        prev.width === next.width &&
        prev.height === next.height &&
        prev.visualHeight === next.visualHeight &&
        prev.band === next.band &&
        prev.isPortrait === next.isPortrait &&
        prev.isShort === next.isShort
          ? prev
          : next,
      );
      document.documentElement.dataset.appBand = next.band;
      document.documentElement.style.setProperty('--app-vh', `${next.height}px`);
    };

    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(sync);
    };

    sync();
    window.addEventListener('resize', schedule);
    window.addEventListener('orientationchange', schedule);
    const visualViewport = window.visualViewport;
    visualViewport?.addEventListener('resize', schedule);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('orientationchange', schedule);
      visualViewport?.removeEventListener('resize', schedule);
    };
  }, []);

  return viewport;
}

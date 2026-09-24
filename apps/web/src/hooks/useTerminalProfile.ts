import { useEffect, useRef, useState } from 'react';

export type TerminalInput = 'touch' | 'fine';
export type MonitorClass = 'compact' | 'hd' | 'fhd' | 'wide' | 'ultrawide';

export interface TerminalProfile {
  /** Viewport in CSS pixels. */
  innerWidth: number;
  innerHeight: number;
  /** Physical display reported by the browser. */
  screenWidth: number;
  screenHeight: number;
  availWidth: number;
  availHeight: number;
  devicePixelRatio: number;
  colorDepth: number;
  orientation: 'portrait' | 'landscape';
  /** Input capabilities. */
  maxTouchPoints: number;
  coarsePointer: boolean;
  noHover: boolean;
  standalonePwa: boolean;
  input: TerminalInput;
  /** Derived. */
  monitorClass: MonitorClass;
  /** True on a touch-only terminal (e.g. resistive POS screen in an installed PWA). */
  isTouchTerminal: boolean;
  /** Stable device signature: `WxH@dpr`. */
  signature: string;
}

const MONITOR_CLASSES: Array<{ min: number; value: MonitorClass }> = [
  { min: 3440, value: 'ultrawide' },
  { min: 2560, value: 'wide' },
  { min: 1920, value: 'fhd' },
  { min: 1366, value: 'hd' },
  { min: 0, value: 'compact' },
];

export function getMonitorClass(screenWidth: number): MonitorClass {
  return MONITOR_CLASSES.find((entry) => screenWidth >= entry.min)?.value ?? 'compact';
}

/** Stable per-device id, kept in localStorage so a terminal is recognizable. */
export function getTerminalId(): string {
  const KEY = 'gustopos:terminalId';
  try {
    let id = window.localStorage?.getItem(KEY) ?? null;
    if (!id) {
      id =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `term_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      window.localStorage?.setItem(KEY, id);
    }
    return id;
  } catch {
    return 'anon';
  }
}

/**
 * Best-effort, fire-and-forget report of the detected terminal to the API so
 * an operator can verify a specific POS remotely. Never blocks the UI.
 */
function reportTerminal(profile: TerminalProfile) {
  if (typeof window === 'undefined') return;
  try {
    void fetch('/api/client-diagnostics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        terminalId: getTerminalId(),
        signature: profile.signature,
        input: profile.input,
        monitorClass: profile.monitorClass,
        screenWidth: profile.screenWidth,
        screenHeight: profile.screenHeight,
        availWidth: profile.availWidth,
        availHeight: profile.availHeight,
        innerWidth: profile.innerWidth,
        innerHeight: profile.innerHeight,
        devicePixelRatio: profile.devicePixelRatio,
        colorDepth: profile.colorDepth,
        standalonePwa: profile.standalonePwa,
        maxTouchPoints: profile.maxTouchPoints,
        coarsePointer: profile.coarsePointer,
        noHover: profile.noHover,
        userAgent: navigator.userAgent,
        platform: (navigator as unknown as { platform?: string }).platform,
        host: window.location.host,
        path: window.location.pathname,
        reportedAt: new Date().toISOString(),
      }),
    }).catch(() => undefined);
  } catch {
    // non-blocking diagnostics
  }
}

function mq(query: string): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(query).matches;
}

export function readTerminalProfile(): TerminalProfile {
  if (typeof window === 'undefined') {
    return {
      innerWidth: 0,
      innerHeight: 0,
      screenWidth: 0,
      screenHeight: 0,
      availWidth: 0,
      availHeight: 0,
      devicePixelRatio: 1,
      colorDepth: 24,
      orientation: 'landscape',
      maxTouchPoints: 0,
      coarsePointer: false,
      noHover: false,
      standalonePwa: false,
      input: 'fine',
      monitorClass: 'compact',
      isTouchTerminal: false,
      signature: '0x0@1',
    };
  }

  const innerWidth = window.innerWidth;
  const innerHeight = window.innerHeight;
  const screenWidth = Math.round(window.screen?.width ?? innerWidth);
  const screenHeight = Math.round(window.screen?.height ?? innerHeight);
  const availWidth = Math.round(window.screen?.availWidth ?? screenWidth);
  const availHeight = Math.round(window.screen?.availHeight ?? screenHeight);
  const devicePixelRatio = window.devicePixelRatio || 1;
  const colorDepth = window.screen?.colorDepth ?? 24;

  const maxTouchPoints = navigator.maxTouchPoints ?? 0;
  const coarsePointer = mq('(pointer: coarse)') || mq('(any-pointer: coarse)');
  const noHover = mq('(hover: none)') || mq('(any-hover: none)');
  const standalonePwa = mq('(display-mode: standalone)');

  // A POS terminal is treated as touch-only when the primary pointer is coarse
  // and hover is unavailable. This also catches resistive screens that report a
  // fine pointer but expose touch points inside an installed PWA.
  const autoTouchTerminal =
    maxTouchPoints > 0 && (coarsePointer || noHover || standalonePwa);
  // Client-only escape hatch for terminals whose browser misreports the input:
  //   localStorage.setItem('gustopos.terminalInput', 'touch' | 'fine')
  let forced: TerminalInput | null = null;
  try {
    const raw = window.localStorage?.getItem('gustopos.terminalInput');
    if (raw === 'touch' || raw === 'fine') forced = raw;
  } catch {
    forced = null;
  }
  const input: TerminalInput = forced ?? (autoTouchTerminal ? 'touch' : 'fine');
  const isTouchTerminal = input === 'touch';

  return {
    innerWidth,
    innerHeight,
    screenWidth,
    screenHeight,
    availWidth,
    availHeight,
    devicePixelRatio,
    colorDepth,
    orientation: innerHeight >= innerWidth ? 'portrait' : 'landscape',
    maxTouchPoints,
    coarsePointer,
    noHover,
    standalonePwa,
    input,
    monitorClass: getMonitorClass(screenWidth),
    isTouchTerminal,
    signature: `${screenWidth}x${screenHeight}@${devicePixelRatio}`,
  };
}

/**
 * Detects the physical terminal (screen size + input kind) from the browser.
 *
 * Client-only: no backend, no persistence. Mirrors the result on
 * `<html data-input>` / `data-standalone` / `data-monitor` and a few CSS
 * variables so the POS layout and the global stylesheet (large scrollbars,
 * bigger touch targets) can adapt on touch-only devices.
 */
export function useTerminalProfile(options: { report?: boolean } = {}): TerminalProfile {
  const report = options.report ?? false;
  const reportedRef = useRef(false);
  const [profile, setProfile] = useState<TerminalProfile>(readTerminalProfile);

  useEffect(() => {
    let frame = 0;

    const sync = () => {
      frame = 0;
      const next = readTerminalProfile();
      setProfile((prev) =>
        prev.signature === next.signature &&
        prev.innerWidth === next.innerWidth &&
        prev.innerHeight === next.innerHeight &&
        prev.input === next.input &&
        prev.standalonePwa === next.standalonePwa
          ? prev
          : next,
      );
      const root = document.documentElement;
      root.dataset.input = next.input;
      root.dataset.standalone = String(next.standalonePwa);
      root.dataset.monitor = next.monitorClass;
      // Large vertical scrollbar on the actual POS terminal (installed PWA or
      // touch-only). Desktop-class browsers keep the default size.
      const largeScrollbars = next.isTouchTerminal || next.standalonePwa;
      root.dataset.scrollbars = largeScrollbars ? 'large' : 'normal';
      root.style.setProperty('--app-vw', `${next.innerWidth}px`);
      root.style.setProperty('--app-vh-real', `${next.innerHeight}px`);
      root.style.setProperty('--touch-target', next.input === 'touch' ? '44px' : '0px');
      root.style.setProperty(
        '--scrollbar-size',
        largeScrollbars ? (next.monitorClass === 'compact' ? '18px' : '22px') : '6px',
      );
      if (report && !reportedRef.current && next.screenWidth > 0) {
        reportedRef.current = true;
        reportTerminal(next);
      }
    };

    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(sync);
    };

    sync();
    window.addEventListener('resize', schedule);
    window.addEventListener('orientationchange', schedule);
    const queries = [
      '(pointer: coarse)',
      '(any-pointer: coarse)',
      '(hover: none)',
      '(any-hover: none)',
      '(display-mode: standalone)',
    ];
    const media = queries.map((query) => window.matchMedia?.(query)).filter(Boolean) as MediaQueryList[];
    for (const mql of media) mql.addEventListener?.('change', schedule);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('orientationchange', schedule);
      for (const mql of media) mql.removeEventListener?.('change', schedule);
    };
  }, [report]);

  return profile;
}

import { useEffect } from "react";

/**
 * Acquires navigator.wakeLock('screen') while `enabled` is true.
 *
 * Chrome releases the Wake Lock automatically when the tab is hidden; we
 * re-acquire it on `visibilitychange` so backgrounded print-bridge tabs
 * do not get throttled to the point where heartbeats are missed.
 *
 * Best-effort: if the browser doesn't support Wake Lock or the user
 * denies the request, we silently no-op.
 */
export function useWakeLock(enabled: boolean): { supported: boolean } {
  useEffect(() => {
    if (!enabled) return;
    if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return;

    let sentinel: WakeLockSentinel | null = null;

    const acquire = async () => {
      try {
        sentinel = await navigator.wakeLock.request("screen");
      } catch (err) {
        // Suppress: user denial or browser policy. Don't surface to UI.
        // eslint-disable-next-line no-console
        console.warn("[wakeLock] acquire failed:", err);
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        if (!sentinel || sentinel.released) void acquire();
      }
    };

    void acquire();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      sentinel?.release().catch(() => {});
      sentinel = null;
    };
  }, [enabled]);

  return { supported: typeof navigator !== "undefined" && "wakeLock" in navigator };
}

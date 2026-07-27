import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { LocalBridgeConfig } from "@gustopos/shared";

/**
 * Phase E standalone slice for browser-as-bridge state. Lives in its own
 * Zustand store + is persisted to `localStorage` so重启后 the worker's
 * heartbeat resumes automatically (no double-boot script).
 *
 * Decoupled from apps/web/src/store/app-store.ts so Phase E can ship
 * without refactoring the giant global slice in this round.
 */

interface LocalBridgeState {
  /** Persisted across reloads. The worker's primary input. */
  config: LocalBridgeConfig | null;
  /** Cosmetic — updated by BridgeWorker on successful heartbeat / qz.connect. */
  active: boolean;
  /** Cosmetic — surfaces the last failure reason (qz error, claim 401, etc.). */
  lastError: string | null;
  /** Optional hint: refresh the global print-bridges list after activate/deactivate. */
  lastRefreshedAt: string | null;

  setConfig: (config: LocalBridgeConfig | null) => void;
  setActive: (active: boolean) => void;
  setLastError: (msg: string | null) => void;
  setLastRefreshedAt: (iso: string | null) => void;
  refreshBridges: () => Promise<void>;
}

export const useLocalBridge = create<LocalBridgeState>()(
  persist(
    (set) => ({
      config: null,
      active: false,
      lastError: null,
      lastRefreshedAt: null,
      setConfig: (config) => set({ config }),
      setActive: (active) => set({ active }),
      setLastError: (msg) => set({ lastError: msg }),
      setLastRefreshedAt: (iso) => set({ lastRefreshedAt: iso }),
      refreshBridges: async () => {
        try {
          await fetch("/api/print-bridge/refresh", { method: "POST" });
          set({ lastRefreshedAt: new Date().toISOString() });
        } catch {
          /* swallow — cosmetic refresh */
        }
      },
    }),
    {
      name: "gustopos.localBridge",
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? window.localStorage : (undefined as unknown as Storage),
      ),
      partialize: (state) => ({ config: state.config }),
    },
  ),
);

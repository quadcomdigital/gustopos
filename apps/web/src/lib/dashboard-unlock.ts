/**
 * Browser-session memory of the dashboard PIN gate (see `DashboardGate`).
 *
 * Kept in `sessionStorage` so a reload during a shift does not ask again, while
 * a new login must: `logout` calls `clearDashboardUnlocks()`. The unlock is
 * only a UI convenience — the PIN itself is verified by the API on every
 * unlock attempt.
 */
const UNLOCK_STORAGE_PREFIX = 'gustopos:dashboard:unlocked';

function storageKey(staffId: string): string {
  return `${UNLOCK_STORAGE_PREFIX}:${staffId}`;
}

export function isDashboardUnlocked(staffId: string): boolean {
  try {
    return sessionStorage.getItem(storageKey(staffId)) === '1';
  } catch {
    return false;
  }
}

export function setDashboardUnlocked(staffId: string, unlocked: boolean): void {
  try {
    if (unlocked) {
      sessionStorage.setItem(storageKey(staffId), '1');
    } else {
      sessionStorage.removeItem(storageKey(staffId));
    }
  } catch {
    // Private mode / storage disabled: the gate simply asks again next mount.
  }
}

/** Drops every stored unlock: only `logout` calls this. */
export function clearDashboardUnlocks(): void {
  try {
    const stale: string[] = [];
    for (let index = 0; index < sessionStorage.length; index += 1) {
      const key = sessionStorage.key(index);
      if (key?.startsWith(`${UNLOCK_STORAGE_PREFIX}:`)) {
        stale.push(key);
      }
    }
    stale.forEach((key) => sessionStorage.removeItem(key));
  } catch {
    // Storage unavailable: nothing to clear.
  }
}

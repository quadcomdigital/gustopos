// In-memory impersonation snapshot — avoids storing superadmin tokens in localStorage
// where they would be exposed to XSS attacks.
//
// This module is the single source of truth for the impersonation snapshot.
// Both the superadmin page (writer) and the impersonation-exit hook (reader)
// import from here instead of using localStorage.

export interface ImpersonationSnapshot {
  superadminToken: string | null;
  superadminRefresh: string | null;
}

let snapshot: ImpersonationSnapshot | null = null;

export function getImpersonationSnapshot(): ImpersonationSnapshot | null {
  return snapshot;
}

export function setImpersonationSnapshot(value: ImpersonationSnapshot | null): void {
  snapshot = value;
}

export function clearImpersonationSnapshot(): void {
  snapshot = null;
}

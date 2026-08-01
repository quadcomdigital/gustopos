import { AsyncLocalStorage } from "node:async_hooks";
import type { TenantContext } from "./tenant-context";

const tenantContextStorage = new AsyncLocalStorage<TenantContext>();
const bridgeAuthStorage = new AsyncLocalStorage<true>();

export function runWithTenantContext<T>(context: TenantContext, callback: () => T): T {
  return tenantContextStorage.run(context, callback);
}

/**
 * Narrow escape hatch used only while resolving a bridge credential whose
 * tenant is not known until after the credential hash lookup. The database
 * policy permits this marker, and callers must immediately switch to the
 * resolved tenant context before touching operational data.
 */
export function runWithBridgeAuthContext<T>(callback: () => T): T {
  return bridgeAuthStorage.run(true, callback);
}

export function hasBridgeAuthContext(): boolean {
  return bridgeAuthStorage.getStore() === true;
}

export function getTenantContext(): TenantContext | undefined {
  return tenantContextStorage.getStore();
}

export function getTenantIdOrDefault(): string {
  return getTenantContext()?.tenantId ?? process.env.DEFAULT_TENANT_ID?.trim() ?? "tenant_legacy";
}

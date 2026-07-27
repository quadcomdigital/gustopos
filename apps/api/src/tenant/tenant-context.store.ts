import { AsyncLocalStorage } from "node:async_hooks";
import type { TenantContext } from "./tenant-context";

const tenantContextStorage = new AsyncLocalStorage<TenantContext>();

export function runWithTenantContext<T>(context: TenantContext, callback: () => T): T {
  return tenantContextStorage.run(context, callback);
}

export function getTenantContext(): TenantContext | undefined {
  return tenantContextStorage.getStore();
}

export function getTenantIdOrDefault(): string {
  return getTenantContext()?.tenantId ?? process.env.DEFAULT_TENANT_ID?.trim() ?? "tenant_legacy";
}

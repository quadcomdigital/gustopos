import type { ModuleKey } from "@gustopos/shared";

export interface TenantContext {
  tenantId: string;
  tenantSlug?: string;
  resolutionSource: "subdomain" | "slug" | "header" | "query" | "jwt";
  enabledModules: ModuleKey[];
}

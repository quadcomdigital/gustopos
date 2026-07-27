import type { Request } from "express";
import type { TenantContext } from "./tenant-context";

export interface TenantAwareRequest extends Request {
  tenant?: TenantContext;
}

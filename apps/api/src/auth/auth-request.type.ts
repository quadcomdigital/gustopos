import type { Request } from "express";
import type { JwtPayload } from "./jwt.types";
import type { TenantContext } from "../tenant/tenant-context";

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
  tenant?: TenantContext;
}

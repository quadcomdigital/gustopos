import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import type { ModuleKey } from "@gustopos/shared";
import { REQUIRED_MODULE_KEY } from "./requires-module.decorator";
import type { TenantAwareRequest } from "./tenant-request.type";
import type { AuthenticatedRequest } from "../auth/auth-request.type";

@Injectable()
export class FeatureFlagGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const requiredModule =
      (Reflect.getMetadata(REQUIRED_MODULE_KEY, context.getHandler()) as ModuleKey | undefined) ??
      (Reflect.getMetadata(REQUIRED_MODULE_KEY, context.getClass()) as ModuleKey | undefined);

    if (!requiredModule) {
      return true;
    }

    const request = context.switchToHttp().getRequest<TenantAwareRequest & AuthenticatedRequest>();
    const tenant = request.tenant;
    if (!tenant) {
      throw new ForbiddenException("Tenant context not resolved");
    }

    // Admin bypasses feature flag checks
    const userRole = request.user?.role;
    if (userRole === 'admin') {
      if (!tenant.enabledModules.includes(requiredModule)) {
        console.warn(`[feature-flag] Admin bypass: module "${requiredModule}" is disabled for tenant ${tenant.tenantId}`);
      }
      return true;
    }

    if (!tenant.enabledModules.includes(requiredModule)) {
      throw new ForbiddenException(`Module '${requiredModule}' is disabled for this tenant`);
    }

    return true;
  }
}

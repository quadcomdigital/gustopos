import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import type { ModuleKey } from "@gustopos/shared";
import { REQUIRED_ANY_OF_MODULES_KEY, REQUIRED_MODULE_KEY } from "./requires-module.decorator";
import type { TenantAwareRequest } from "./tenant-request.type";

@Injectable()
export class FeatureFlagGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const handler = context.getHandler();
    const handlerClass = context.getClass();
    const requiredModule =
      (Reflect.getMetadata(REQUIRED_MODULE_KEY, handler) as ModuleKey | undefined) ??
      (Reflect.getMetadata(REQUIRED_MODULE_KEY, handlerClass) as ModuleKey | undefined);
    // OR-set: passes when the tenant has at least one of these modules.
    const anyOfModules =
      (Reflect.getMetadata(REQUIRED_ANY_OF_MODULES_KEY, handler) as ModuleKey[] | undefined) ??
      (Reflect.getMetadata(REQUIRED_ANY_OF_MODULES_KEY, handlerClass) as ModuleKey[] | undefined);

    if (!requiredModule && !anyOfModules?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<TenantAwareRequest>();
    const tenant = request.tenant;
    if (!tenant) {
      throw new ForbiddenException("Tenant context not resolved");
    }

    if (requiredModule && !tenant.enabledModules.includes(requiredModule)) {
      throw new ForbiddenException(`Module '${requiredModule}' is disabled for this tenant`);
    }

    if (anyOfModules?.length && !anyOfModules.some((moduleKey) => tenant.enabledModules.includes(moduleKey))) {
      throw new ForbiddenException(`Modules '${anyOfModules.join("' / '")}' are disabled for this tenant`);
    }

    return true;
  }
}

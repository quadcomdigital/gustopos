import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { REQUIRED_PERMISSIONS_KEY } from "./permissions.decorator";
import type { AuthenticatedRequest } from "./auth-request.type";

@Injectable()
export class PermissionsGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions =
      (Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, context.getHandler()) as string[] | undefined) ??
      (Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, context.getClass()) as string[] | undefined);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userRole = request.user?.role;

    // Admin bypasses all permission checks
    if (userRole === 'admin') {
      return true;
    }

    const userPermissions = new Set(request.user?.permissions ?? []);
    const missing = requiredPermissions.filter((permission) => !userPermissions.has(permission));
    if (missing.length > 0) {
      throw new ForbiddenException(`Missing permissions: ${missing.join(", ")}`);
    }

    return true;
  }
}

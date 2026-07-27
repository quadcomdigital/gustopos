import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import type { AuthenticatedRequest } from "./auth-request.type";
import { ROLES_KEY } from "./roles.decorator";

type Role = "admin" | "waiter" | "chef" | "consumer";

@Injectable()
export class RolesGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const requiredRoles =
      (Reflect.getMetadata(ROLES_KEY, context.getHandler()) as Role[] | undefined) ??
      (Reflect.getMetadata(ROLES_KEY, context.getClass()) as Role[] | undefined);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userRole = request.user?.role;

    // Admin bypasses all role checks
    if (userRole === 'admin') {
      return true;
    }

    if (!userRole || !requiredRoles.includes(userRole)) {
      throw new ForbiddenException("Role not authorized");
    }

    return true;
  }
}

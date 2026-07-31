import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import jwt from "jsonwebtoken";
import type { AuthenticatedRequest } from "./auth-request.type";
import type { JwtPayload } from "./jwt.types";
import { IS_PUBLIC_KEY } from "./public.decorator";
import { StaffRepository } from "../repository/staff.repository";
import { getJwtSecret } from "./jwt-secret";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly jwtSecret = getJwtSecret();

  constructor(@Inject(StaffRepository) private readonly staffRepo: StaffRepository) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic =
      Reflect.getMetadata(IS_PUBLIC_KEY, context.getHandler()) === true ||
      Reflect.getMetadata(IS_PUBLIC_KEY, context.getClass()) === true;
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing bearer token");
    }

    const token = authHeader.slice("Bearer ".length);

    try {
      const payload = jwt.verify(token, this.jwtSecret) as JwtPayload;
      if (payload.tokenType !== "access" || !payload.sessionId || !payload.sub || !payload.tenantId) {
        throw new UnauthorizedException("Invalid token type");
      }

      // Reject superadmin tokens — they should only be used by SuperadminAuthGuard
      if (payload.scope === "superadmin") {
        throw new UnauthorizedException("Superadmin tokens are not valid for staff endpoints");
      }

      if (request.tenant && request.tenant.tenantId !== payload.tenantId) {
        throw new UnauthorizedException("Tenant mismatch");
      }

      const activeSession = await this.staffRepo.findActiveSessionById(payload.sessionId, payload.sub);
      if (!activeSession) {
        throw new UnauthorizedException("Session expired or revoked");
      }

      if (activeSession.tenantId !== payload.tenantId) {
        throw new UnauthorizedException("Session tenant mismatch");
      }

      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException("Invalid token");
    }
  }
}

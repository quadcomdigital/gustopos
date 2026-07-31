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
import { ConsumerRepository } from "../repository/consumer.repository";
import { getJwtSecret } from "./jwt-secret";

@Injectable()
export class ConsumerJwtAuthGuard implements CanActivate {
  private readonly jwtSecret = getJwtSecret();

  constructor(@Inject(ConsumerRepository) private readonly consumerRepo: ConsumerRepository) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing bearer token");
    }

    const token = authHeader.slice("Bearer ".length);

    try {
      const payload = jwt.verify(token, this.jwtSecret) as JwtPayload;
      if (payload.tokenType !== "consumer_access" || !payload.sessionId || !payload.sub || !payload.tenantId) {
        throw new UnauthorizedException("Invalid token type");
      }

      if (request.tenant && request.tenant.tenantId !== payload.tenantId) {
        throw new UnauthorizedException("Tenant mismatch");
      }

      const activeSession = await this.consumerRepo.findActiveConsumerSessionById(payload.sessionId, payload.sub);
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

import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import jwt from "jsonwebtoken";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "../db/client";
import { superadminSessions } from "../db/schema";
import { getJwtSecret } from "../auth/jwt-secret";
import type { SuperadminJwtPayload } from "./superadmin-auth.types";

type SuperadminRequest = {
  headers: { authorization?: string };
  superadmin?: SuperadminJwtPayload;
};

@Injectable()
export class SuperadminAuthGuard implements CanActivate {
  private readonly jwtSecret = getJwtSecret();

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<SuperadminRequest>();
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing superadmin token");
    }

    try {
      const payload = jwt.verify(authHeader.slice("Bearer ".length), this.jwtSecret) as SuperadminJwtPayload;
      if (payload.scope !== "superadmin" || payload.tokenType !== "access" || !payload.sessionId) {
        throw new UnauthorizedException("Invalid superadmin token");
      }

      const rows = await db
        .select({ id: superadminSessions.id, expiresAt: superadminSessions.expiresAt })
        .from(superadminSessions)
        .where(and(eq(superadminSessions.id, payload.sessionId), eq(superadminSessions.userId, payload.sub), isNull(superadminSessions.revokedAt)))
        .limit(1);

      const session = rows[0];
      if (!session || session.expiresAt.getTime() <= Date.now()) {
        throw new UnauthorizedException("Superadmin session expired");
      }

      request.superadmin = payload;
      return true;
    } catch {
      throw new UnauthorizedException("Invalid superadmin token");
    }
  }
}

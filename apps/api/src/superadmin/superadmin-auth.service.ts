import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from "@nestjs/common";
import {
  superadminAuthResponseSchema,
  superadminLoginRequestSchema,
  superadminRefreshRequestSchema,
  type LogoutResponse,
  type SuperadminAuthResponse,
  type SuperadminLoginRequest,
  type SuperadminRefreshRequest,
  type RefreshResponse,
  logoutResponseSchema,
} from "@gustopos/shared";
import { and, eq, isNull } from "drizzle-orm";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { db } from "../db/client";
import {
  authSessions,
  staff,
  superadminSessions,
  superadminUsers,
  tenantAuditLogs,
  tenantModules,
  tenants,
} from "../db/schema";
import { getJwtSecret } from "../auth/jwt-secret";
import { verifyPin } from "../auth/pin-hash";
import { resolveRolePermissions } from "../auth/role-permissions";
import type { SuperadminJwtPayload } from "./superadmin-auth.types";

@Injectable()
export class SuperadminAuthService {
  private readonly jwtSecret = getJwtSecret();
  private readonly accessTokenTtlSeconds = Number(process.env.ACCESS_TOKEN_TTL_SECONDS ?? 900);
  private readonly refreshTokenTtlSeconds = Number(process.env.REFRESH_TOKEN_TTL_SECONDS ?? 604800);

  async login(payload: SuperadminLoginRequest): Promise<SuperadminAuthResponse> {
    const parsed = superadminLoginRequestSchema.safeParse(payload);
    if (!parsed.success) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const rows = await db
      .select()
      .from(superadminUsers)
      .where(and(eq(superadminUsers.username, parsed.data.username), eq(superadminUsers.isActive, 1)))
      .limit(1);

    const user = rows[0];
    if (!user) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const valid = await verifyPin(parsed.data.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const refreshToken = crypto.randomBytes(48).toString("hex");
    const refreshTokenHash = this.hashRefreshToken(refreshToken);
    const sessionId = crypto.randomUUID();
    const now = new Date();
    const refreshExpiresAt = new Date(now.getTime() + this.refreshTokenTtlSeconds * 1000);

    await db.transaction(async (tx) => {
      await tx.insert(superadminSessions).values({
        id: sessionId,
        userId: user.id,
        refreshTokenHash,
        expiresAt: refreshExpiresAt,
        createdAt: now,
        revokedAt: null,
      });

      await tx
        .update(superadminUsers)
        .set({
          lastLoginAt: now,
          updatedAt: now,
        })
        .where(eq(superadminUsers.id, user.id));
    });

    const token = this.signAccessToken({
      sub: user.id,
      username: user.username,
      scope: "superadmin",
      sessionId,
      tokenType: "access",
    });

    return superadminAuthResponseSchema.parse({
      token,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        isActive: user.isActive === 1,
        lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : undefined,
      },
    });
  }

  async refresh(payload: SuperadminRefreshRequest): Promise<SuperadminAuthResponse> {
    const parsed = superadminRefreshRequestSchema.safeParse(payload);
    if (!parsed.success) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    const refreshTokenHash = this.hashRefreshToken(parsed.data.refreshToken);
    const sessionRows = await db
      .select()
      .from(superadminSessions)
      .where(and(eq(superadminSessions.refreshTokenHash, refreshTokenHash), isNull(superadminSessions.revokedAt)))
      .limit(1);

    const session = sessionRows[0];
    if (!session || session.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    const userRows = await db
      .select()
      .from(superadminUsers)
      .where(and(eq(superadminUsers.id, session.userId), eq(superadminUsers.isActive, 1)))
      .limit(1);

    const user = userRows[0];
    if (!user) {
      throw new UnauthorizedException("Superadmin not found");
    }

    const newRefreshToken = crypto.randomBytes(48).toString("hex");
    const newRefreshHash = this.hashRefreshToken(newRefreshToken);
    const newSessionId = crypto.randomUUID();
    const now = new Date();
    const refreshExpiresAt = new Date(now.getTime() + this.refreshTokenTtlSeconds * 1000);

    await db.transaction(async (tx) => {
      await tx.update(superadminSessions).set({ revokedAt: now }).where(eq(superadminSessions.id, session.id));

      await tx.insert(superadminSessions).values({
        id: newSessionId,
        userId: user.id,
        refreshTokenHash: newRefreshHash,
        expiresAt: refreshExpiresAt,
        createdAt: now,
        revokedAt: null,
      });
    });

    const token = this.signAccessToken({
      sub: user.id,
      username: user.username,
      scope: "superadmin",
      sessionId: newSessionId,
      tokenType: "access",
    });

    return superadminAuthResponseSchema.parse({
      token,
      refreshToken: newRefreshToken,
      user: {
        id: user.id,
        username: user.username,
        isActive: user.isActive === 1,
        lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : undefined,
      },
    });
  }

  async logout(sessionId: string): Promise<LogoutResponse> {
    await db
      .update(superadminSessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(superadminSessions.id, sessionId), isNull(superadminSessions.revokedAt)));

    return logoutResponseSchema.parse({ success: true });
  }

  async me(userId: string) {
    const rows = await db.select().from(superadminUsers).where(eq(superadminUsers.id, userId)).limit(1);
    const user = rows[0];
    if (!user || user.isActive !== 1) {
      throw new UnauthorizedException("Superadmin not found");
    }

    return {
      id: user.id,
      username: user.username,
      isActive: user.isActive === 1,
      lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : undefined,
    };
  }

  async impersonateTenant(tenantId: string, actorSuperadminId?: string): Promise<RefreshResponse> {
    const tenant = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
    if (tenant.length === 0 || tenant[0].isActive !== 1) {
      throw new UnauthorizedException("Tenant not found or inactive");
    }

    const adminRows = await db
      .select()
      .from(staff)
      .where(and(eq(staff.tenantId, tenantId), eq(staff.role, "admin"), eq(staff.isActive, 1)))
      .limit(1);

    const adminStaff = adminRows[0];
    if (!adminStaff) {
      throw new UnauthorizedException("No active admin staff found in tenant");
    }

    const permissions = resolveRolePermissions(adminStaff.role as "admin" | "waiter" | "chef");

    const enabledModuleRows = await db
      .select({ moduleKey: tenantModules.moduleKey })
      .from(tenantModules)
      .where(and(eq(tenantModules.tenantId, tenantId), eq(tenantModules.enabled, 1)));

    const enabledModules = enabledModuleRows
      .map((row) => row.moduleKey)
      .filter(
        (
          value,
        ): value is
          | "kitchen"
          | "inventory"
          | "customers"
          | "analytics"
          | "printing"
          | "public_menu"
          | "public_takeaway"
          | "consumer_accounts"
          | "self_order_qr"
          | "public_group_order"
          | "reservations"
          | "delivery"
          | "purchasing_suppliers"
          | "staff_shifts_timeclock"
          | "fiscal_exports"
          | "simple_catalog" =>
          value === "kitchen" ||
          value === "inventory" ||
          value === "customers" ||
          value === "analytics" ||
          value === "printing" ||
          value === "public_menu" ||
          value === "public_takeaway" ||
          value === "consumer_accounts" ||
          value === "self_order_qr" ||
          value === "public_group_order" ||
          value === "reservations" ||
          value === "delivery" ||
          value === "purchasing_suppliers" ||
          value === "staff_shifts_timeclock" ||
          value === "fiscal_exports" ||
          value === "simple_catalog",
      );

    const refreshToken = crypto.randomBytes(48).toString("hex");
    const refreshTokenHash = this.hashRefreshToken(refreshToken);
    const sessionId = crypto.randomUUID();
    const now = new Date();
    const refreshExpiresAt = new Date(now.getTime() + this.refreshTokenTtlSeconds * 1000);

    await db.insert(authSessions).values({
      id: sessionId,
      tenantId,
      staffId: adminStaff.id,
      refreshTokenHash,
      expiresAt: refreshExpiresAt,
      createdAt: now,
      revokedAt: null,
    });

    const token = jwt.sign(
      {
        sub: adminStaff.id,
        tenantId,
        role: adminStaff.role as "admin" | "waiter" | "chef",
        enabledModules,
        permissions,
        sessionId,
        tokenType: "access",
      },
      this.jwtSecret,
      { expiresIn: this.accessTokenTtlSeconds },
    );

    await db.insert(tenantAuditLogs).values({
      id: `tal_${crypto.randomUUID()}`,
      tenantId,
      actor: actorSuperadminId ? `superadmin:${actorSuperadminId}` : "superadmin",
      event: "superadmin.impersonation.started",
      payload: JSON.stringify({
        superadminId: actorSuperadminId ?? null,
        staffId: adminStaff.id,
      }),
      createdAt: now,
    });

    return {
      token,
      refreshToken,
      user: {
        id: adminStaff.id,
        tenantId,
        name: adminStaff.name,
        role: adminStaff.role as "admin" | "waiter" | "chef",
        enabledModules,
        permissions,
      },
    };
  }

  async logImpersonationStop(actorSuperadminId?: string, tenantId?: string): Promise<void> {
    await db.insert(tenantAuditLogs).values({
      id: `tal_${crypto.randomUUID()}`,
      tenantId: tenantId ?? null,
      actor: actorSuperadminId ? `superadmin:${actorSuperadminId}` : "superadmin",
      event: "superadmin.impersonation.stopped",
      payload: JSON.stringify({ superadminId: actorSuperadminId ?? null }),
      createdAt: new Date(),
    });
  }

  async stopImpersonation(actorSuperadminId?: string, tenantId?: string, sessionId?: string): Promise<void> {
    if (sessionId && tenantId) {
      await db
        .update(authSessions)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(authSessions.tenantId, tenantId),
            eq(authSessions.id, sessionId),
            isNull(authSessions.revokedAt),
          ),
        );
    } else if (tenantId && actorSuperadminId) {
      const tenant = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
      if (tenant.length > 0) {
        const adminRows = await db
          .select()
          .from(staff)
          .where(and(eq(staff.tenantId, tenantId), eq(staff.role, "admin"), eq(staff.isActive, 1)))
          .limit(1);

        if (adminRows.length > 0) {
          await db
            .update(authSessions)
            .set({ revokedAt: new Date() })
            .where(
              and(
                eq(authSessions.tenantId, tenantId),
                eq(authSessions.staffId, adminRows[0].id),
                isNull(authSessions.revokedAt),
              ),
            );
        }
      }
    }

    await this.logImpersonationStop(actorSuperadminId, tenantId);
  }

  private hashRefreshToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  private signAccessToken(payload: SuperadminJwtPayload): string {
    try {
      return jwt.sign(payload, this.jwtSecret, { expiresIn: this.accessTokenTtlSeconds });
    } catch {
      throw new InternalServerErrorException("Unable to sign superadmin token");
    }
  }
}

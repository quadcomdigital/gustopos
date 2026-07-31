import {
  Injectable,
  Inject,
  InternalServerErrorException,
  UnauthorizedException,
} from "@nestjs/common";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import {
  loginRequestSchema,
  logoutResponseSchema,
  refreshRequestSchema,
  refreshResponseSchema,
  staffListResponseSchema,
  type LoginRequest,
  type LoginResponse,
  type LogoutResponse,
  type RefreshRequest,
  type RefreshResponse,
  type StaffListResponse,
} from "@gustopos/shared";
import { StaffRepository } from "./repository/staff.repository";
import { getJwtSecret } from "./auth/jwt-secret";
import { AuditLogService } from "./audit-log.service";
import { resolveRolePermissions } from "./auth/role-permissions";

@Injectable()
export class AuthService {
  private readonly jwtSecret = getJwtSecret();
  private readonly accessTokenTtlSeconds = Number(process.env.ACCESS_TOKEN_TTL_SECONDS ?? 60 * 15);
  private readonly refreshTokenTtlSeconds = Number(process.env.REFRESH_TOKEN_TTL_SECONDS ?? 60 * 60 * 24 * 7);

  constructor(
    @Inject(StaffRepository) private readonly staffRepo: StaffRepository,
    @Inject(AuditLogService) private readonly auditLogService: AuditLogService,
  ) {}

  async listStaff(): Promise<StaffListResponse> {
    const rows = await this.staffRepo.listStaffPublic();
    return staffListResponseSchema.parse(rows);
  }

  async login(payload: LoginRequest): Promise<LoginResponse> {
    const parsed = loginRequestSchema.safeParse(payload);
    if (!parsed.success) {
      throw new UnauthorizedException("Invalid credentials payload");
    }

    const staff = await this.staffRepo.findStaffByCredentials(parsed.data.staffId, parsed.data.pin);
    if (!staff) {
      this.auditLogService.log("auth.login.failed", {
        targetId: parsed.data.staffId,
      });
      throw new UnauthorizedException("Invalid staff or pin");
    }

    const sessionId = crypto.randomUUID();
    const enabledModules = await this.staffRepo.getEnabledModulesForTenant(staff.tenantId);
    const permissions = resolveRolePermissions(staff.role, staff.customPermissions);
    const refreshToken = crypto.randomBytes(48).toString("hex");
    const refreshTokenHash = this.hashToken(refreshToken);

    await this.staffRepo.createAuthSession({
      id: sessionId,
      tenantId: staff.tenantId,
      staffId: staff.id,
      refreshTokenHash,
      expiresAt: new Date(Date.now() + this.refreshTokenTtlSeconds * 1000),
    });

    const token = this.signAccessToken({
      sub: staff.id,
      tenantId: staff.tenantId,
      role: staff.role,
      enabledModules,
      permissions,
      sessionId,
      tokenType: "access",
    });

    this.auditLogService.log("auth.login.success", {
      actorStaffId: staff.id,
    });

    return { token, refreshToken, user: { ...staff, enabledModules, permissions } };
  }

  async refresh(payload: RefreshRequest): Promise<RefreshResponse> {
    const parsed = refreshRequestSchema.safeParse(payload);
    if (!parsed.success) {
      throw new UnauthorizedException("Invalid refresh payload");
    }

    const refreshTokenHash = this.hashToken(parsed.data.refreshToken);
    const session = await this.staffRepo.findActiveSessionByRefreshHash(refreshTokenHash);
    if (!session) {
      throw new UnauthorizedException("Session expired or invalid");
    }

    const user = await this.staffRepo.findStaffById(session.staffId, session.tenantId);
    if (!user) {
      throw new UnauthorizedException("User not found");
    }

    const enabledModules = await this.staffRepo.getEnabledModulesForTenant(user.tenantId);
    const permissions = resolveRolePermissions(user.role, user.customPermissions);

    const newSessionId = crypto.randomUUID();
    const newRefreshToken = crypto.randomBytes(48).toString("hex");
    const newRefreshTokenHash = this.hashToken(newRefreshToken);

    await this.staffRepo.rotateSession(session.id, {
      id: newSessionId,
      tenantId: user.tenantId,
      staffId: user.id,
      refreshTokenHash: newRefreshTokenHash,
      expiresAt: new Date(Date.now() + this.refreshTokenTtlSeconds * 1000),
    }, session.tenantId);

    const token = this.signAccessToken({
      sub: user.id,
      tenantId: user.tenantId,
      role: user.role,
      enabledModules,
      permissions,
      sessionId: newSessionId,
      tokenType: "access",
    });

    return refreshResponseSchema.parse({
      token,
      refreshToken: newRefreshToken,
      user: { ...user, enabledModules, permissions },
    });
  }

  async logout(sessionId: string, actorStaffId?: string): Promise<LogoutResponse> {
    if (!sessionId) {
      throw new UnauthorizedException("Missing session id");
    }

    await this.staffRepo.revokeSessionByIdIfActive(sessionId);
    this.auditLogService.log("auth.logout", {
      actorStaffId,
      details: { sessionId },
    });
    return logoutResponseSchema.parse({ success: true });
  }

  private signAccessToken(payload: {
    sub: string;
    tenantId: string;
    role: "admin" | "waiter" | "chef";
    enabledModules: string[];
    permissions: string[];
    sessionId: string;
    tokenType: "access";
  }): string {
    try {
      return jwt.sign(payload, this.jwtSecret, { expiresIn: this.accessTokenTtlSeconds });
    } catch {
      throw new InternalServerErrorException("Unable to sign access token");
    }
  }

  private hashToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
  }
}

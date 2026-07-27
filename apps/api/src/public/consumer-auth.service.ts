import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import {
  consumerAuthResponseSchema,
  consumerLoginRequestSchema,
  consumerRefreshRequestSchema,
  consumerRegisterRequestSchema,
  logoutResponseSchema,
  type ConsumerAuthResponse,
  type ConsumerLoginRequest,
  type ConsumerOrderHistoryResponse,
  type ConsumerRefreshRequest,
  type ConsumerRegisterRequest,
  type ConsumerUser,
  type LogoutResponse,
} from "@gustopos/shared";
import { AppRepository } from "../repository/app.repository";
import { getJwtSecret } from "../auth/jwt-secret";

@Injectable()
export class ConsumerAuthService {
  private readonly jwtSecret = getJwtSecret();
  private readonly accessTokenTtlSeconds = Number(process.env.ACCESS_TOKEN_TTL_SECONDS ?? 60 * 15);
  private readonly refreshTokenTtlSeconds = Number(process.env.REFRESH_TOKEN_TTL_SECONDS ?? 60 * 60 * 24 * 7);

  constructor(private readonly appRepository: AppRepository) {}

  async register(tenantSlug: string, payload: ConsumerRegisterRequest): Promise<ConsumerAuthResponse> {
    const tenant = await this.appRepository.getTenantBySlug(tenantSlug);
    if (!tenant) {
      throw new NotFoundException("Tenant not found");
    }

    await this.assertConsumerAccountsEnabled(tenant.id);

    const config = await this.appRepository.getConsumerAccountsConfig(tenant.id);
    if (!config.registrationEnabled) {
      throw new ForbiddenException("Consumer registration is disabled for this tenant");
    }

    const parsed = consumerRegisterRequestSchema.parse(payload);
    const user = await this.appRepository.createConsumerUser(tenant.id, parsed);
    return this.createConsumerAuthResponse(user, tenant.id);
  }

  async login(tenantSlug: string, payload: ConsumerLoginRequest): Promise<ConsumerAuthResponse> {
    const tenant = await this.appRepository.getTenantBySlug(tenantSlug);
    if (!tenant) {
      throw new NotFoundException("Tenant not found");
    }

    await this.assertConsumerAccountsEnabled(tenant.id);

    const parsed = consumerLoginRequestSchema.parse(payload);
    const user = await this.appRepository.findConsumerUserByCredentials(tenant.id, parsed);
    if (!user) {
      throw new UnauthorizedException("Invalid consumer credentials");
    }

    return this.createConsumerAuthResponse(user, tenant.id);
  }

  async refresh(tenantSlug: string, payload: ConsumerRefreshRequest): Promise<ConsumerAuthResponse> {
    const tenant = await this.appRepository.getTenantBySlug(tenantSlug);
    if (!tenant) {
      throw new NotFoundException("Tenant not found");
    }

    await this.assertConsumerAccountsEnabled(tenant.id);

    const parsed = consumerRefreshRequestSchema.parse(payload);
    const refreshTokenHash = this.hashToken(parsed.refreshToken);
    const session = await this.appRepository.findActiveConsumerSessionByRefreshHash(refreshTokenHash);
    if (!session || session.tenantId !== tenant.id) {
      throw new UnauthorizedException("Consumer session expired or invalid");
    }

    const user = await this.appRepository.findConsumerUserById(tenant.id, session.consumerUserId);
    if (!user) {
      throw new UnauthorizedException("Consumer user not found");
    }

    await this.appRepository.revokeConsumerSessionById(session.id);
    return this.createConsumerAuthResponse(user, tenant.id);
  }

  async logout(sessionId: string): Promise<LogoutResponse> {
    await this.appRepository.revokeConsumerSessionByIdIfActive(sessionId);
    return logoutResponseSchema.parse({ success: true });
  }

  async me(tenantSlug: string, consumerUserId: string): Promise<ConsumerUser> {
    const tenant = await this.appRepository.getTenantBySlug(tenantSlug);
    if (!tenant) {
      throw new NotFoundException("Tenant not found");
    }
    const user = await this.appRepository.findConsumerUserById(tenant.id, consumerUserId);
    if (!user) {
      throw new UnauthorizedException("Consumer user not found");
    }
    return user;
  }

  async orders(tenantSlug: string, consumerUserId: string): Promise<ConsumerOrderHistoryResponse> {
    const tenant = await this.appRepository.getTenantBySlug(tenantSlug);
    if (!tenant) {
      throw new NotFoundException("Tenant not found");
    }
    return this.appRepository.listConsumerOrderHistory(tenant.id, consumerUserId);
  }

  private async assertConsumerAccountsEnabled(tenantId: string): Promise<void> {
    const enabledModules = await this.appRepository.getEnabledModulesForTenant(tenantId);
    if (!enabledModules.includes("consumer_accounts")) {
      throw new ForbiddenException("Consumer accounts disabled for tenant");
    }
  }

  private async createConsumerAuthResponse(user: ConsumerUser, tenantId: string): Promise<ConsumerAuthResponse> {
    const sessionId = crypto.randomUUID();
    const enabledModules = await this.appRepository.getEnabledModulesForTenant(tenantId);
    const refreshToken = crypto.randomBytes(48).toString("hex");
    const refreshTokenHash = this.hashToken(refreshToken);

    await this.appRepository.createConsumerSession({
      id: sessionId,
      tenantId,
      consumerUserId: user.id,
      refreshTokenHash,
      expiresAt: new Date(Date.now() + this.refreshTokenTtlSeconds * 1000),
    });

    const token = this.signAccessToken({
      sub: user.id,
      tenantId,
      role: "consumer",
      enabledModules,
      permissions: [],
      sessionId,
      tokenType: "consumer_access",
    });

    return consumerAuthResponseSchema.parse({
      token,
      refreshToken,
      user,
    });
  }

  private hashToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  private signAccessToken(payload: {
    sub: string;
    tenantId: string;
    role: "consumer";
    enabledModules: string[];
    permissions: string[];
    sessionId: string;
    tokenType: "consumer_access";
  }): string {
    try {
      return jwt.sign(payload, this.jwtSecret, { expiresIn: this.accessTokenTtlSeconds });
    } catch {
      throw new InternalServerErrorException("Unable to sign consumer access token");
    }
  }
}

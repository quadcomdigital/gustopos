import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type {
  ConsumerAuthResponse,
  ConsumerLoginRequest,
  ConsumerOrderHistoryResponse,
  ConsumerRefreshRequest,
  ConsumerRegisterRequest,
  ConsumerUser,
  LogoutResponse,
} from "@gustopos/shared";
import { Public } from "../auth/public.decorator";
import { ConsumerAuthService } from "./consumer-auth.service";
import { ConsumerJwtAuthGuard } from "../auth/consumer-jwt-auth.guard";
import type { AuthenticatedRequest } from "../auth/auth-request.type";

@Controller("api/public/:tenantSlug/auth")
export class ConsumerAuthController {
  constructor(private readonly consumerAuthService: ConsumerAuthService) {}

  @Public()
  @Post("register")
  @Throttle({ default: { limit: 5, ttl: 60 } })
  register(
    @Param("tenantSlug") tenantSlug: string,
    @Body() payload: ConsumerRegisterRequest,
  ): Promise<ConsumerAuthResponse> {
    return this.consumerAuthService.register(tenantSlug, payload);
  }

  @Public()
  @Post("login")
  @Throttle({ default: { limit: 5, ttl: 60 } })
  login(
    @Param("tenantSlug") tenantSlug: string,
    @Body() payload: ConsumerLoginRequest,
  ): Promise<ConsumerAuthResponse> {
    return this.consumerAuthService.login(tenantSlug, payload);
  }

  @Public()
  @Post("refresh")
  @Throttle({ default: { limit: 5, ttl: 60 } })
  refresh(
    @Param("tenantSlug") tenantSlug: string,
    @Body() payload: ConsumerRefreshRequest,
  ): Promise<ConsumerAuthResponse> {
    return this.consumerAuthService.refresh(tenantSlug, payload);
  }

  @UseGuards(ConsumerJwtAuthGuard)
  @Post("logout")
  logout(@Req() request: AuthenticatedRequest): Promise<LogoutResponse> {
    const sessionId = request.user?.sessionId;
    if (!sessionId) {
      throw new UnauthorizedException("Missing consumer session id");
    }
    return this.consumerAuthService.logout(sessionId);
  }

  @UseGuards(ConsumerJwtAuthGuard)
  @Get("me")
  me(@Param("tenantSlug") tenantSlug: string, @Req() request: AuthenticatedRequest): Promise<ConsumerUser> {
    const consumerUserId = request.user?.sub;
    if (!consumerUserId) {
      throw new UnauthorizedException("Missing consumer id");
    }
    return this.consumerAuthService.me(tenantSlug, consumerUserId);
  }

  @UseGuards(ConsumerJwtAuthGuard)
  @Get("orders")
  orders(@Param("tenantSlug") tenantSlug: string, @Req() request: AuthenticatedRequest): Promise<ConsumerOrderHistoryResponse> {
    const consumerUserId = request.user?.sub;
    if (!consumerUserId) {
      throw new UnauthorizedException("Missing consumer id");
    }
    return this.consumerAuthService.orders(tenantSlug, consumerUserId);
  }
}

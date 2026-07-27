import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type {
  LogoutResponse,
  SuperadminAuthResponse,
  SuperadminLoginRequest,
  SuperadminRefreshRequest,
} from "@gustopos/shared";
import { Public } from "../auth/public.decorator";
import { SuperadminAuthService } from "./superadmin-auth.service";
import { SuperadminAuthGuard } from "./superadmin-auth.guard";

type SuperadminRequest = {
  superadmin?: {
    sub: string;
    sessionId?: string;
  };
};

@Controller("api/superadmin/auth")
export class SuperadminAuthController {
  constructor(private readonly superadminAuthService: SuperadminAuthService) {}

  @Public()
  @Post("login")
  @Throttle({ default: { limit: 5, ttl: 60 } })
  login(@Body() payload: SuperadminLoginRequest): Promise<SuperadminAuthResponse> {
    return this.superadminAuthService.login(payload);
  }

  @Public()
  @Post("refresh")
  @Throttle({ default: { limit: 5, ttl: 60 } })
  refresh(@Body() payload: SuperadminRefreshRequest): Promise<SuperadminAuthResponse> {
    return this.superadminAuthService.refresh(payload);
  }

  @UseGuards(SuperadminAuthGuard)
  @Post("logout")
  logout(@Req() request: SuperadminRequest): Promise<LogoutResponse> {
    const sessionId = request.superadmin?.sessionId;
    if (!sessionId) {
      throw new UnauthorizedException("Missing superadmin session");
    }

    return this.superadminAuthService.logout(sessionId);
  }

  @UseGuards(SuperadminAuthGuard)
  @Get("me")
  me(@Req() request: SuperadminRequest) {
    const userId = request.superadmin?.sub;
    if (!userId) {
      throw new UnauthorizedException("Missing superadmin user");
    }

    return this.superadminAuthService.me(userId);
  }
}

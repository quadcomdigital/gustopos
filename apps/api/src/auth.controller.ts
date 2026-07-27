import {
  Body,
  Controller,
  Get,
  Inject,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type {
  LoginRequest,
  LoginResponse,
  LogoutResponse,
  RefreshRequest,
  RefreshResponse,
  StaffListResponse,
} from "@gustopos/shared";
import { AuthService } from "./auth.service";
import type { AuthenticatedRequest } from "./auth/auth-request.type";
import { JwtAuthGuard } from "./auth/jwt-auth.guard";
import { Public } from "./auth/public.decorator";

@Controller("api/auth")
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Public()
  @Get("staff")
  staff(): Promise<StaffListResponse> {
    return this.authService.listStaff();
  }

  @Public()
  @Post("login")
  @Throttle({ default: { limit: 5, ttl: 60 } })
  login(@Body() payload: LoginRequest): Promise<LoginResponse> {
    return this.authService.login(payload);
  }

  @Public()
  @Post("refresh")
  @Throttle({ default: { limit: 5, ttl: 60 } })
  refresh(@Body() payload: RefreshRequest): Promise<RefreshResponse> {
    return this.authService.refresh(payload);
  }

  @UseGuards(JwtAuthGuard)
  @Post("logout")
  logout(@Req() request: AuthenticatedRequest): Promise<LogoutResponse> {
    const sessionId = request.user?.sessionId;
    const actorStaffId = request.user?.sub;
    if (!sessionId) {
      throw new UnauthorizedException("Missing session id");
    }

    return this.authService.logout(sessionId, actorStaffId);
  }
}

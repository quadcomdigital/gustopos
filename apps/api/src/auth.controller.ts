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
  // Limits match the IdempotencyMiddleware's per-IP login cap (10/min) so the
  // now-enforced @Throttle does not 429 a whole restaurant sharing one NAT IP
  // during a shift change. Refresh is a frequent background call (access token
  // TTL 15 min); a 429 there logs the user out, so allow a comfortable burst.
  @Throttle({ default: { limit: 10, ttl: 60 } })
  login(@Body() payload: LoginRequest): Promise<LoginResponse> {
    return this.authService.login(payload);
  }

  @Public()
  @Post("refresh")
  @Throttle({ default: { limit: 20, ttl: 60 } })
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

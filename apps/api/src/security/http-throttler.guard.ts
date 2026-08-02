import { ExecutionContext, Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

/**
 * Global rate-limit guard, scoped to HTTP requests only.
 *
 * ThrottlerGuard.getRequestResponse() calls context.switchToHttp()
 * unconditionally; on a Socket.IO gateway message handler that would treat
 * the socket/payload as req/res and crash every realtime event. Realtime
 * group-order handlers are already token-validated, so they are intentionally
 * exempt from HTTP rate limiting.
 */
@Injectable()
export class HttpThrottlerGuard extends ThrottlerGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== "http") {
      return true;
    }
    return super.canActivate(context);
  }
}

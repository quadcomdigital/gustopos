import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import crypto from "node:crypto";
import type { SuperadminJwtPayload } from "./superadmin-auth.types";

type SuperadminRequest = {
  headers: Record<string, string | undefined>;
  superadmin?: SuperadminJwtPayload;
};

@Injectable()
export class SuperadminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<SuperadminRequest>();
    if (request.superadmin?.scope === "superadmin") {
      return true;
    }

    const configured = process.env.SUPERADMIN_API_KEY?.trim();
    if (!configured) {
      throw new ForbiddenException("SUPERADMIN_API_KEY is not configured");
    }

    const provided = request.headers["x-superadmin-key"];
    const configuredBuffer = Buffer.from(configured, "utf8");
    const providedBuffer = Buffer.from(provided ?? "", "utf8");
    const valid =
      configuredBuffer.length === providedBuffer.length &&
      crypto.timingSafeEqual(configuredBuffer, providedBuffer);

    if (!valid) {
      throw new ForbiddenException("Invalid superadmin key");
    }

    return true;
  }
}

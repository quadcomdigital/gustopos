import { Injectable, NestMiddleware, ConflictException, HttpException, HttpStatus } from "@nestjs/common";
import Redis from "ioredis";
import type { Response } from "express";
import { getRedisUrl } from "../config/redis.config";
import type { TenantAwareRequest } from "./tenant-request.type";

const TAKEAWAY_RATE_LIMIT_WINDOW_SECONDS = 60;
const TAKEAWAY_RATE_LIMIT_MAX = 40;
const LOGIN_RATE_LIMIT_WINDOW_SECONDS = 60;
const LOGIN_RATE_LIMIT_MAX = 10;

function isPublicTakeawayRoute(req: TenantAwareRequest): boolean {
  return req.method.toUpperCase() === "POST" && /^\/api\/public\/[^/]+\/takeaway\/orders(?:\?.*)?$/.test(req.originalUrl);
}

function isLoginRoute(req: TenantAwareRequest): boolean {
  return req.method.toUpperCase() === "POST" && /^\/api\/auth\/login(?:\?.*)?$/.test(req.originalUrl);
}

@Injectable()
export class IdempotencyMiddleware implements NestMiddleware {
  private readonly redis = new Redis(getRedisUrl(), { lazyConnect: false });

  async use(req: TenantAwareRequest, res: Response, next: (error?: unknown) => void): Promise<void> {
    try {
      if (!["POST", "PATCH", "PUT", "DELETE"].includes(req.method.toUpperCase())) {
        next();
        return;
      }

      const tenantId = req.tenant?.tenantId ?? process.env.DEFAULT_TENANT_ID ?? "tenant_legacy";

      if (isPublicTakeawayRoute(req)) {
        const ip = req.ip ?? "unknown";
        const rateLimitKey = `ratelimit:takeaway:${tenantId}:${ip}`;
        const rate = await this.redis.multi().incr(rateLimitKey).ttl(rateLimitKey).exec();
        const count = Number(rate?.[0]?.[1] ?? 0);
        const ttl = Number(rate?.[1]?.[1] ?? -1);
        if (ttl < 0) {
          await this.redis.expire(rateLimitKey, TAKEAWAY_RATE_LIMIT_WINDOW_SECONDS);
        }
        if (count > TAKEAWAY_RATE_LIMIT_MAX) {
          throw new HttpException("Too many takeaway requests, please retry in a minute", HttpStatus.TOO_MANY_REQUESTS);
        }
      }

      if (isLoginRoute(req)) {
        const ip = req.ip ?? "unknown";
        const rateLimitKey = `ratelimit:login:${ip}`;
        const rate = await this.redis.multi().incr(rateLimitKey).ttl(rateLimitKey).exec();
        const count = Number(rate?.[0]?.[1] ?? 0);
        const ttl = Number(rate?.[1]?.[1] ?? -1);
        if (ttl < 0) {
          await this.redis.expire(rateLimitKey, LOGIN_RATE_LIMIT_WINDOW_SECONDS);
        }
        if (count > LOGIN_RATE_LIMIT_MAX) {
          throw new HttpException("Too many login attempts, please retry in a minute", HttpStatus.TOO_MANY_REQUESTS);
        }
      }

      const idempotencyKey = req.headers["idempotency-key"];
      if (!idempotencyKey || typeof idempotencyKey !== "string") {
        next();
        return;
      }

      const lockKey = `idempotency:${tenantId}:${req.method}:${req.originalUrl}:${idempotencyKey}`;
      const responseKey = `${lockKey}:response`;
      const acquired = await this.redis.set(lockKey, "1", "EX", 120, "NX");
      if (!acquired) {
        const cachedResponse = await this.redis.get(responseKey);
        if (cachedResponse) {
          try {
            const parsed = JSON.parse(cachedResponse) as { statusCode: number; body: unknown };
            res.status(parsed.statusCode).json(parsed.body);
            return;
          } catch (error) {
            console.debug("[idempotency] failed to parse cached response, falling through", error);
          }
        }
        throw new ConflictException("Duplicate idempotent request");
      }

      const originalJson = res.json.bind(res);
      res.json = ((body: unknown) => {
        if (res.statusCode < 500) {
          void this.redis.set(
            responseKey,
            JSON.stringify({ statusCode: res.statusCode, body }),
            "EX",
            120,
          );
        }
        return originalJson(body);
      }) as Response["json"];

      next();
    } catch (error) {
      next(error);
    }
  }
}

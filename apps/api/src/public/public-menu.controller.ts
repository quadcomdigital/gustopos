import { BadRequestException, Controller, Get, HttpException, HttpStatus, NotFoundException, OnApplicationShutdown, Param, Query, Req, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import Redis from "ioredis";
import { Public } from "../auth/public.decorator";
import { getRedisUrl } from "../config/redis.config";
import { AppRepository } from "../repository/app.repository";
import type { TenantAwareRequest } from "../tenant/tenant-request.type";
import { FeatureFlagGuard } from "../tenant/feature-flag.guard";
import { RequiresModule } from "../tenant/requires-module.decorator";

@Controller()
@UseGuards(FeatureFlagGuard)
export class PublicMenuController implements OnApplicationShutdown {
  private readonly redis = new Redis(getRedisUrl(), { lazyConnect: false });

  constructor(private readonly appRepository: AppRepository) {}

  async onApplicationShutdown(): Promise<void> {
    await this.redis.quit();
  }

  private async enforceRateLimit(ip: string, slug: string): Promise<void> {
    const key = `${ip}:${slug}`;
    const redisKey = `rate:public-menu:${key}`;
    const max = 120;

    const result = await this.redis.multi().incr(redisKey).ttl(redisKey).exec();
    const count = Number(result?.[0]?.[1] ?? 0);
    const ttl = Number(result?.[1]?.[1] ?? -1);

    if (ttl < 0) {
      await this.redis.expire(redisKey, 60);
    }

    if (count > max) {
      throw new HttpException("Rate limit exceeded for public menu", HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  private setCacheHeaders(response: Response): void {
    response.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=120");
  }

  @Public()
  @RequiresModule("public_menu")
  @Get(":tenantSlug/menu")
  async getBySlug(@Param("tenantSlug") tenantSlug: string, @Req() request: TenantAwareRequest, @Res({ passthrough: true }) response: Response) {
    await this.enforceRateLimit(request.ip ?? "unknown", tenantSlug);
    this.setCacheHeaders(response);
    try {
      return await this.appRepository.getPublicMenu(tenantSlug);
    } catch (error) {
      if (error instanceof Error && (
        error.message.includes("Tenant not found") ||
        error.message.includes("disabled")
      )) {
        throw new NotFoundException("Public menu not available");
      }
      throw error;
    }
  }

  @Public()
  @RequiresModule("public_menu")
  @Get("api/public/menu")
  async getByContext(
    @Req() request: TenantAwareRequest,
    @Res({ passthrough: true }) response: Response,
    @Query("slug") slugQuery?: string,
  ) {
    const slug = slugQuery?.trim() || request.tenant?.tenantSlug || "";
    if (!slug) {
      throw new BadRequestException("Missing tenant slug for public menu");
    }

    await this.enforceRateLimit(request.ip ?? "unknown", slug);
    this.setCacheHeaders(response);
    try {
      return await this.appRepository.getPublicMenu(slug);
    } catch (error) {
      if (error instanceof Error && (
        error.message.includes("Tenant not found") ||
        error.message.includes("disabled")
      )) {
        throw new NotFoundException("Public menu not available");
      }
      throw error;
    }
  }
}

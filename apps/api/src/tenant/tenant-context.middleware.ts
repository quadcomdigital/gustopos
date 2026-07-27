import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NestMiddleware,
} from "@nestjs/common";
import jwt from "jsonwebtoken";
import { getJwtSecret } from "../auth/jwt-secret";
import type { JwtPayload } from "../auth/jwt.types";
import type { TenantAwareRequest } from "./tenant-request.type";
import type { TenantContext } from "./tenant-context";
import { TenantService } from "./tenant.service";
import { runWithTenantContext } from "./tenant-context.store";

interface ResolvedIdentity {
  tenantId: string;
  tenantSlug?: string;
  source: "subdomain" | "slug" | "header" | "query" | "jwt";
}

@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  private readonly jwtSecret = getJwtSecret();

  constructor(@Inject(TenantService) private readonly tenantService: TenantService) {}

  async use(req: TenantAwareRequest, _res: unknown, next: (error?: unknown) => void): Promise<void> {
    try {
      if (req.path.startsWith("/api/superadmin") || req.path === "/api/health") {
        next();
        return;
      }

      const resolved = await this.resolveIdentity(req);
      const fallbackTenantId = process.env.DEFAULT_TENANT_ID?.trim() || "tenant_legacy";
      const identity =
        resolved ?? {
          tenantId: fallbackTenantId,
          source: "header" as const,
        };

      const tenant = await this.tenantService.getTenantById(identity.tenantId);
      if (!tenant || !tenant.isActive) {
        throw new ForbiddenException("Tenant not found or inactive");
      }

      const enabledModules = await this.tenantService.getEnabledModulesForTenant(tenant.id);

      const context: TenantContext = {
        tenantId: tenant.id,
        tenantSlug: tenant.slug,
        resolutionSource: identity.source,
        enabledModules,
      };

      req.tenant = context;

      runWithTenantContext(context, () => next());
    } catch (error) {
      next(error);
    }
  }

  private async resolveIdentity(req: TenantAwareRequest): Promise<ResolvedIdentity | null> {
    const authHeader = req.headers.authorization;
    let jwtTenantId: string | null = null;
    if (authHeader?.startsWith("Bearer ")) {
      try {
        const token = authHeader.slice("Bearer ".length);
        const payload = jwt.verify(token, this.jwtSecret) as JwtPayload;
        if (payload.tenantId) {
          jwtTenantId = payload.tenantId;
        }
      } catch {
        console.debug("[tenant-context] JWT extraction for tenantId failed, falling through to other strategies");
      }
    }

    // If JWT resolved a tenant, ALWAYS use it and reject header mismatches
    if (jwtTenantId) {
      return { tenantId: jwtTenantId, source: "jwt" };
    }

    const configuredOrder = (process.env.TENANT_RESOLUTION_ORDER ?? "subdomain,slug,query,header,jwt")
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry): entry is "subdomain" | "slug" | "header" | "query" | "jwt" =>
        entry === "subdomain" || entry === "slug" || entry === "header" || entry === "query" || entry === "jwt",
      );

    const host = String(req.headers.host ?? "").split(":")[0].toLowerCase();
    const path = req.path;

    // Universal query param resolution: ?tenant=<slug_or_id>
    // Parse manually from req.url to avoid URL constructor issues
    const queryString = req.url.split("?")[1] ?? "";
    const params = new URLSearchParams(queryString);
    const tenantQueryParam = params.get("tenant");
    if (tenantQueryParam && tenantQueryParam.trim().length > 0) {
      const trimmed = tenantQueryParam.trim();
      const bySlug = await this.tenantService.resolveTenantBySlug(trimmed);
      if (bySlug) {
        return { tenantId: bySlug.id, tenantSlug: bySlug.slug, source: "query" };
      }
      const byId = await this.tenantService.getTenantById(trimmed);
      if (byId && byId.isActive) {
        return { tenantId: byId.id, tenantSlug: byId.slug, source: "query" };
      }
    }

    if (path === "/api/public/menu" && typeof req.query?.slug === "string" && req.query.slug.trim().length > 0) {
      const byQuerySlug = await this.tenantService.resolveTenantBySlug(req.query.slug.trim());
      if (byQuerySlug) {
        return { tenantId: byQuerySlug.id, tenantSlug: byQuerySlug.slug, source: "slug" };
      }
    }

    for (const strategy of configuredOrder) {
      if (strategy === "subdomain") {
        const subdomainCandidate = host.includes(".") ? host.split(".")[0] : undefined;
        if (subdomainCandidate && subdomainCandidate !== "www" && subdomainCandidate !== "localhost") {
          const bySubdomain = await this.tenantService.resolveTenantBySubdomain(subdomainCandidate);
          if (bySubdomain) {
            return { tenantId: bySubdomain.id, tenantSlug: bySubdomain.slug, source: "subdomain" };
          }
        }
      }

      if (strategy === "slug") {
        const slugMatch = path.match(/^\/([^/]+)\/menu(?:\/|$)/);
        if (slugMatch?.[1]) {
          const bySlug = await this.tenantService.resolveTenantBySlug(slugMatch[1]);
          if (bySlug) {
            return { tenantId: bySlug.id, tenantSlug: bySlug.slug, source: "slug" };
          }
        }

        const publicApiSlugMatch = path.match(/^\/api\/public\/([^/]+)(?:\/|$)/);
        if (publicApiSlugMatch?.[1]) {
          const byPublicApiSlug = await this.tenantService.resolveTenantBySlug(publicApiSlugMatch[1]);
          if (byPublicApiSlug) {
            return { tenantId: byPublicApiSlug.id, tenantSlug: byPublicApiSlug.slug, source: "slug" };
          }
        }

        const RESERVED_SEGMENTS = ["app", "superadmin", "api", "socket.io", "assets", "signing"];
        const backofficeSlugMatch = path.match(/^\/([^/]+)(?:\/app(?:\/|$)|\/$)/);
        if (backofficeSlugMatch?.[1] && !RESERVED_SEGMENTS.includes(backofficeSlugMatch[1])) {
          const bySlug = await this.tenantService.resolveTenantBySlug(backofficeSlugMatch[1]);
          if (bySlug) {
            return { tenantId: bySlug.id, tenantSlug: bySlug.slug, source: "slug" };
          }
        }
      }

      if (strategy === "header") {
        // Header-based resolution is only allowed as a last resort for unauthenticated requests
        if (jwtTenantId) {
          continue; // Skip — JWT tenant takes precedence
        }
        const tenantHeader = req.headers["x-tenant-id"];
        if (typeof tenantHeader === "string" && tenantHeader.trim().length > 0) {
          const value = tenantHeader.trim();
          // Try as direct ID first
          const byId = await this.tenantService.getTenantById(value);
          if (byId && byId.isActive) {
            return { tenantId: byId.id, tenantSlug: byId.slug, source: "header" };
          }
          // Try as slug
          const bySlug = await this.tenantService.resolveTenantBySlug(value);
          if (bySlug && bySlug.isActive) {
            return { tenantId: bySlug.id, tenantSlug: bySlug.slug, source: "header" };
          }
        }
      }

      if (strategy === "query") {
        // Query param resolution: ?tenant=<slug> or ?tenant=<id>
        const tenantQuery = typeof req.query?.tenant === "string" ? req.query.tenant.trim() : null;
        if (tenantQuery) {
          // Try as slug first
          const bySlug = await this.tenantService.resolveTenantBySlug(tenantQuery);
          if (bySlug) {
            return { tenantId: bySlug.id, tenantSlug: bySlug.slug, source: "slug" };
          }
          // Try as direct ID
          const byId = await this.tenantService.getTenantById(tenantQuery);
          if (byId && byId.isActive) {
            return { tenantId: byId.id, tenantSlug: byId.slug, source: "slug" };
          }
        }
      }

      if (strategy === "jwt") {
        if (authHeader?.startsWith("Bearer ")) {
          try {
            const token = authHeader.slice("Bearer ".length);
            const payload = jwt.verify(token, this.jwtSecret) as JwtPayload;
            if (payload.tenantId) {
              return { tenantId: payload.tenantId, source: "jwt" };
            }
          } catch {
            throw new BadRequestException("Invalid JWT for tenant resolution");
          }
        }
      }
    }

    return null;
  }
}

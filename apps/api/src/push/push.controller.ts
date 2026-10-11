import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import {
  pushConfigResponseSchema,
  pushSubscribeRequestSchema,
  pushSubscriptionResponseSchema,
  pushSubscriptionStateResponseSchema,
  pushTestRequestSchema,
  pushUnsubscribeRequestSchema,
  pushUpdateRequestSchema,
  type PushConfigResponse,
  type PushSubscriptionResponse,
  type PushSubscriptionStateResponse,
  type PushTestResponse,
  type PushUnsubscribeResponse,
} from "@gustopos/shared";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermissionsGuard } from "../auth/permissions.guard";
import { RequiresPermissions } from "../auth/permissions.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import type { AuthenticatedRequest } from "../auth/auth-request.type";
import { getVapidPublicKey } from "../config/push.config";
import { getTenantIdOrDefault } from "../tenant/tenant-context.store";
import { PushRepository } from "../repository/push.repository";
import { PushNotificationService } from "./push.service";
import { parseBody } from "./parse-body";

/**
 * Staff-side Web Push endpoints. Tenant comes from the JWT (the middleware
 * resolves it before the guards run), subscription is scoped to that tenant.
 *
 * The public/consumer counterpart lives in PublicPushController.
 */
@Controller("api/push")
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class PushController {
  constructor(
    @Inject(PushRepository) private readonly pushRepo: PushRepository,
    @Inject(PushNotificationService) private readonly pushService: PushNotificationService,
  ) {}

  /** VAPID public key + availability. Public key is deployment-wide, not secret. */
  @Get("config")
  config(): PushConfigResponse {
    return pushConfigResponseSchema.parse({
      configured: this.pushService.isConfigured(),
      publicKey: getVapidPublicKey(),
    });
  }

  /** The current device's record (drives the Settings → Notifiche panel). */
  @Get("subscriptions")
  async state(@Query("endpoint") endpoint?: string): Promise<PushSubscriptionStateResponse> {
    const subscription = endpoint ? await this.pushRepo.getSubscription(endpoint) : null;
    return pushSubscriptionStateResponseSchema.parse({ subscription });
  }

  @Post("subscriptions")
  async subscribe(@Req() request: AuthenticatedRequest, @Body() payload: unknown): Promise<PushSubscriptionResponse> {    const parsed = parseBody(pushSubscribeRequestSchema, payload);
    if (parsed.audience !== "staff") {
      throw new BadRequestException("Staff subscriptions must use audience 'staff'");
    }
    const staffId = request.user?.sub;
    if (!staffId) {
      throw new UnauthorizedException("Missing staff identity");
    }

    const subscription = await this.pushRepo.upsertSubscription({
      endpoint: parsed.endpoint,
      p256dh: parsed.keys.p256dh,
      auth: parsed.keys.auth,
      audience: "staff",
      staffId,
      categories: parsed.categories,
      deviceLabel: parsed.deviceLabel ?? null,
      userAgent: headerValue(request, "user-agent"),
    });
    return pushSubscriptionResponseSchema.parse({ subscription });
  }

  @Patch("subscriptions")
  async update(@Body() payload: unknown): Promise<PushSubscriptionResponse> {
    const parsed = parseBody(pushUpdateRequestSchema, payload);
    const subscription = await this.pushRepo.updateCategories(parsed.endpoint, parsed.audience, parsed.categories);
    if (!subscription) {
      throw new NotFoundException("Subscription not found");
    }
    return pushSubscriptionResponseSchema.parse({ subscription });
  }

  @Post("subscriptions/unsubscribe")
  async unsubscribe(@Body() payload: unknown): Promise<PushUnsubscribeResponse> {
    const parsed = parseBody(pushUnsubscribeRequestSchema, payload);
    const removed = await this.pushRepo.removeByEndpoint(parsed.endpoint);
    return { success: removed };
  }

  /** "Invia notifica di prova" — targets this device, or every staff terminal
   *  of the tenant when no endpoint is given. */
  @Post("test")
  @Roles("admin")
  @RequiresPermissions("settings:update")
  async test(@Body() payload: unknown): Promise<PushTestResponse> {
    if (!this.pushService.isConfigured()) {
      throw new BadRequestException("Web Push non configurato: impostare VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY");
    }
    const parsed = parseBody(pushTestRequestSchema, payload ?? {});

    let targets;
    if (parsed.endpoint) {
      const target = await this.pushRepo.findByEndpoint(parsed.endpoint);
      if (!target) {
        throw new NotFoundException("Subscription not found");
      }
      targets = [target];
    } else {
      targets = await this.pushRepo.listStaffTargets(getTenantIdOrDefault());
    }
    if (targets.length === 0) {
      throw new NotFoundException("Nessun dispositivo registrato per ricevere la notifica di prova");
    }

    const notification = {
      title: "Notifiche attive",
      body: "OmniRestaurant invierà qui ordini, prenotazioni e avvisi del locale.",
      tag: "push-test",
      url: "/app",
      whenVisible: true,
    };

    let sent = 0;
    await Promise.all(
      targets.map(async (target) => {
        const result = await this.pushService.send(target, notification);
        if (result === "gone") {
          await this.pushRepo.removeById(target.id);
        } else if (result === "sent") {
          sent += 1;
        }
      }),
    );
    return { sent };
  }
}

function headerValue(request: AuthenticatedRequest, name: string): string | null {
  const raw = request.headers[name];
  if (typeof raw === "string" && raw.trim().length > 0) return raw.slice(0, 300);
  if (Array.isArray(raw) && typeof raw[0] === "string") return raw[0].slice(0, 300);
  return null;
}

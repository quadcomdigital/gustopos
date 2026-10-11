import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import {
  pushConfigResponseSchema,
  pushSubscribeRequestSchema,
  pushSubscriptionResponseSchema,
  pushUnsubscribeRequestSchema,
  type PushConfigResponse,
  type PushSubscriptionResponse,
  type PushUnsubscribeResponse,
} from "@gustopos/shared";
import { FeatureFlagGuard } from "../tenant/feature-flag.guard";
import { RequiresModule } from "../tenant/requires-module.decorator";
import { getTenantIdOrDefault } from "../tenant/tenant-context.store";
import { getVapidPublicKey } from "../config/push.config";
import type { TenantAwareRequest } from "../tenant/tenant-request.type";
import { AppRepository } from "../repository/app.repository";
import { PushRepository } from "../repository/push.repository";
import { PushNotificationService } from "./push.service";
import { parseBody } from "./parse-body";

/**
 * Consumer-side Web Push endpoints for the public menu flows.
 *
 * There is no login here: the credential is the flow itself — a takeaway
 * tracking token (hashed, short-lived) or a group-order participant token.
 * Both are validated before the device is bound to the session, so nobody can
 * attach themselves to somebody else's order.
 *
 * Tenant is resolved from the `:tenantSlug` path segment by the middleware.
 */
@Controller("api/public/:tenantSlug/push")
@UseGuards(FeatureFlagGuard)
export class PublicPushController {
  constructor(
    @Inject(PushRepository) private readonly pushRepo: PushRepository,
    @Inject(AppRepository) private readonly appRepository: AppRepository,
    @Inject(PushNotificationService) private readonly pushService: PushNotificationService,
  ) {}

  @Get("config")
  config(): PushConfigResponse {
    return pushConfigResponseSchema.parse({
      configured: this.pushService.isConfigured(),
      publicKey: getVapidPublicKey(),
    });
  }

  @Post("subscriptions/takeaway")
  @RequiresModule("public_takeaway")
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async subscribeTakeaway(@Param("tenantSlug") tenantSlug: string, @Req() request: TenantAwareRequest, @Body() payload: unknown): Promise<PushSubscriptionResponse> {
    const parsed = parseBody(pushSubscribeRequestSchema, payload);
    const context = parsed.context;
    if (parsed.audience !== "consumer" || context?.kind !== "takeaway") {
      throw new BadRequestException("Takeaway subscriptions require a 'takeaway' context");
    }

    // Token + expiry + module flag are all validated by the tracking resolver.
    try {
      await this.appRepository.getPublicTakeawayTracking(tenantSlug, context.orderId, context.trackingToken);
    } catch {
      throw new BadRequestException("Codice di tracking non valido o scaduto");
    }

    const tenantId = getTenantIdOrDefault();
    const trackingSessionId = await this.pushRepo.findTrackingSessionId(tenantId, context.orderId);
    if (!trackingSessionId) {
      throw new BadRequestException("Sessione di tracking non trovata");
    }

    const subscription = await this.pushRepo.upsertSubscription({
      endpoint: parsed.endpoint,
      p256dh: parsed.keys.p256dh,
      auth: parsed.keys.auth,
      audience: "consumer",
      categories: parsed.categories,
      trackingSessionId,
      deviceLabel: parsed.deviceLabel ?? null,
      userAgent: headerValue(request, "user-agent"),
    });
    return pushSubscriptionResponseSchema.parse({ subscription });
  }

  @Post("subscriptions/group-order")
  @RequiresModule("public_group_order")
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async subscribeGroupOrder(@Param("tenantSlug") _tenantSlug: string, @Req() request: TenantAwareRequest, @Body() payload: unknown): Promise<PushSubscriptionResponse> {
    const parsed = parseBody(pushSubscribeRequestSchema, payload);
    const context = parsed.context;
    if (parsed.audience !== "consumer" || context?.kind !== "group_order") {
      throw new BadRequestException("Group-order subscriptions require a 'group_order' context");
    }

    const participant = await this.appRepository.findGroupOrderParticipantByToken(
      context.sessionId,
      context.participantToken,
    );
    if (!participant || participant.tenantId !== getTenantIdOrDefault()) {
      throw new BadRequestException("Sessione di ordine di gruppo non valida");
    }

    const subscription = await this.pushRepo.upsertSubscription({
      endpoint: parsed.endpoint,
      p256dh: parsed.keys.p256dh,
      auth: parsed.keys.auth,
      audience: "consumer",
      categories: parsed.categories,
      groupSessionId: context.sessionId,
      deviceLabel: parsed.deviceLabel ?? null,
      userAgent: headerValue(request, "user-agent"),
    });
    return pushSubscriptionResponseSchema.parse({ subscription });
  }

  /**
   * Unsubscribing is authenticated by the endpoint itself: it is an opaque,
   * unguessable URL issued by the push service, and the row is additionally
   * scoped to this tenant. POST (not DELETE) so no proxy ever has to forward
   * a body on DELETE.
   */
  @Post("subscriptions/unsubscribe")
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async unsubscribe(@Body() payload: unknown): Promise<PushUnsubscribeResponse> {
    const parsed = parseBody(pushUnsubscribeRequestSchema, payload);
    // Idempotent: turning notifications off twice is not an error.
    const removed = await this.pushRepo.removeByEndpoint(parsed.endpoint);
    return { success: removed };
  }
}

function headerValue(request: TenantAwareRequest, name: string): string | null {
  const raw = request.headers[name];
  if (typeof raw === "string" && raw.trim().length > 0) return raw.slice(0, 300);
  if (Array.isArray(raw) && typeof raw[0] === "string") return raw[0].slice(0, 300);
  return null;
}

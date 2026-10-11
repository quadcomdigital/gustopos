import { z } from "zod";

// ─── Web Push (notifiche PWA) ────────────────────────────────────────────
//
// One browser registration (one `endpoint`) produces ONE row per tenant: the
// same device can be both a staff terminal and a public-menu visitor, so the
// row carries the staff identity (`staffId`) and the consumer contexts
// (tracking session / group-order session) side by side, each with its own
// category list. The dispatcher picks the right rows per event.

/** Staff-only notification categories. */
export const pushStaffCategories = ["orders", "reservations", "low_stock", "printing"] as const;

/** Consumer-only notification categories (public menu flows). */
export const pushConsumerCategories = ["takeaway_status", "group_order"] as const;

export const pushCategorySchema = z.enum([
  "orders",
  "reservations",
  "low_stock",
  "printing",
  "takeaway_status",
  "group_order",
]);

export type PushCategory = z.infer<typeof pushCategorySchema>;

export const pushAudienceSchema = z.enum(["staff", "consumer"]);

export type PushAudience = z.infer<typeof pushAudienceSchema>;

const staffCategorySet: ReadonlySet<string> = new Set(pushStaffCategories);
const consumerCategorySet: ReadonlySet<string> = new Set(pushConsumerCategories);

/** Categories an audience is allowed to subscribe to. */
export function pushCategoriesFor(audience: PushAudience): readonly PushCategory[] {
  return audience === "staff" ? pushStaffCategories : pushConsumerCategories;
}

function assertCategoriesForAudience(
  audience: PushAudience,
  categories: readonly string[],
  ctx: z.RefinementCtx,
  path: (string | number)[],
): void {
  const allowed = audience === "staff" ? staffCategorySet : consumerCategorySet;
  categories.forEach((category, index) => {
    if (!allowed.has(category)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [...path, index],
        message: `Category '${category}' is not valid for the '${audience}' audience`,
      });
    }
  });
}

/**
 * Where a consumer subscription points. `takeaway` binds the row to a
 * tracking session (hashed token), `group_order` to a group-order session.
 * Both are optional on a row: a device can hold the two contexts at once.
 */
export const pushConsumerContextSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("takeaway"),
    orderId: z.string().min(1).max(120),
    trackingToken: z.string().min(12).max(400),
  }),
  z.object({
    kind: z.literal("group_order"),
    sessionId: z.string().min(1).max(120),
    participantToken: z.string().min(16).max(400),
  }),
]);

export type PushConsumerContext = z.infer<typeof pushConsumerContextSchema>;

export const pushKeysSchema = z.object({
  p256dh: z.string().min(10).max(2000),
  auth: z.string().min(10).max(500),
});

export const pushSubscribeRequestSchema = z
  .object({
    endpoint: z.string().url().max(4096),
    keys: pushKeysSchema,
    audience: pushAudienceSchema,
    categories: z.array(pushCategorySchema).min(1),
    deviceLabel: z.string().max(80).optional(),
    context: pushConsumerContextSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.audience === "consumer" && !value.context) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["context"],
        message: "A consumer subscription requires a context",
      });
    }
    if (value.audience === "staff" && value.context) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["context"],
        message: "A staff subscription must not carry a consumer context",
      });
    }
    assertCategoriesForAudience(value.audience, value.categories, ctx, ["categories"]);
  });

export type PushSubscribeRequest = z.infer<typeof pushSubscribeRequestSchema>;

export const pushUpdateRequestSchema = z
  .object({
    endpoint: z.string().url().max(4096),
    /** Which side of the subscription to update (staff vs consumer categories). */
    audience: pushAudienceSchema,
    categories: z.array(pushCategorySchema).min(1),
  })
  .superRefine((value, ctx) => {
    assertCategoriesForAudience(value.audience, value.categories, ctx, ["categories"]);
  });

export type PushUpdateRequest = z.infer<typeof pushUpdateRequestSchema>;

export const pushUnsubscribeRequestSchema = z.object({
  endpoint: z.string().url().max(4096),
});

export type PushUnsubscribeRequest = z.infer<typeof pushUnsubscribeRequestSchema>;

export const pushTestRequestSchema = z.object({
  endpoint: z.string().url().max(4096).optional(),
});

export type PushTestRequest = z.infer<typeof pushTestRequestSchema>;

export const pushSubscriptionSchema = z.object({
  id: z.string(),
  endpoint: z.string(),
  staffCategories: z.array(pushCategorySchema),
  consumerCategories: z.array(pushCategorySchema),
  /** True when the device is registered as a staff terminal. */
  staff: z.boolean(),
  /** True when the device is bound to at least one consumer flow. */
  consumer: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type PushSubscription = z.infer<typeof pushSubscriptionSchema>;

export const pushSubscriptionResponseSchema = z.object({
  subscription: pushSubscriptionSchema,
});

export type PushSubscriptionResponse = z.infer<typeof pushSubscriptionResponseSchema>;

/** Current device record (`subscription: null` when this device is not registered). */
export const pushSubscriptionStateResponseSchema = z.object({
  subscription: pushSubscriptionSchema.nullable(),
});

export type PushSubscriptionStateResponse = z.infer<typeof pushSubscriptionStateResponseSchema>;

/** VAPID availability for the current origin. `publicKey` is null when unset. */
export const pushConfigResponseSchema = z.object({
  configured: z.boolean(),
  publicKey: z.string().nullable(),
});

export type PushConfigResponse = z.infer<typeof pushConfigResponseSchema>;

export const pushTestResponseSchema = z.object({
  sent: z.number().int().nonnegative(),
});

export type PushTestResponse = z.infer<typeof pushTestResponseSchema>;

export const pushUnsubscribeResponseSchema = z.object({
  success: z.boolean(),
});

export type PushUnsubscribeResponse = z.infer<typeof pushUnsubscribeResponseSchema>;

/** Payload delivered to the service worker `push` handler. */
export const pushNotificationPayloadSchema = z.object({
  title: z.string().min(1).max(160),
  body: z.string().max(500).default(""),
  tag: z.string().max(120).optional(),
  url: z.string().max(500).optional(),
  icon: z.string().max(500).optional(),
  /**
   * When false the service worker shows the system notification even if a
   * window is focused. Defaults to true (suppress + in-app toast instead).
   */
  whenVisible: z.boolean().default(true),
});

export type PushNotificationPayload = z.infer<typeof pushNotificationPayloadSchema>;

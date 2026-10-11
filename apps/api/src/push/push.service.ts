// ─── Push sender ───────────────────────────────────────────────────────────
// Thin wrapper around `web-push`: builds the VAPID-signed request, interprets
// the push service answers and reports dead endpoints so the caller can drop
// them. Never throws — the realtime path must not fail because of a push.

import { Injectable, Logger } from "@nestjs/common";
import webpush from "web-push";
import {
  getVapidPrivateKey,
  getVapidPublicKey,
  getVapidSubject,
  isPushConfigured,
} from "../config/push.config";
import { pushNotificationPayloadSchema, type PushNotificationPayload } from "@gustopos/shared";

export type PushSendResult = "sent" | "gone" | "failed" | "unconfigured";

export interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** Four hours: long enough for an evening service, short enough not to wake
 *  a stale subscription days later. */
const PUSH_TTL_SECONDS = 60 * 60 * 4;

@Injectable()
export class PushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);
  private warnedUnconfigured = false;

  isConfigured(): boolean {
    return isPushConfigured();
  }

  async send(target: PushTarget, payload: PushNotificationPayload): Promise<PushSendResult> {
    const publicKey = getVapidPublicKey();
    const privateKey = getVapidPrivateKey();
    if (!publicKey || !privateKey) {
      if (!this.warnedUnconfigured) {
        this.warnedUnconfigured = true;
        this.logger.warn("VAPID keys missing — set VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY to enable Web Push");
      }
      return "unconfigured";
    }

    const body = pushNotificationPayloadSchema.parse(payload);

    try {
      await webpush.sendNotification(
        { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
        JSON.stringify(body),
        {
          vapidDetails: { subject: getVapidSubject(), publicKey, privateKey },
          TTL: PUSH_TTL_SECONDS,
          urgency: "normal",
        },
      );
      return "sent";
    } catch (error) {
      const statusCode = (error as { statusCode?: number }).statusCode;
      // 404/410: the push service no longer knows this subscription.
      if (statusCode === 404 || statusCode === 410) {
        return "gone";
      }
      if (statusCode === 429) {
        this.logger.warn(`[push] rate limited by the push service (endpoint ${redactEndpoint(target.endpoint)})`);
        return "failed";
      }
      this.logger.warn(
        `[push] send failed (${statusCode ?? "network"}): ${(error as Error).message}`,
      );
      return "failed";
    }
  }
}

/** Endpoints carry an opaque token — never log them in full. */
export function redactEndpoint(endpoint: string): string {
  try {
    const url = new URL(endpoint);
    const tail = url.pathname.slice(-6);
    return `${url.host}…${tail}`;
  } catch {
    return "invalid-endpoint";
  }
}

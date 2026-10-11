// ─── Web Push client ───────────────────────────────────────────────────────
// Everything the browser side needs to turn a tap into a stored subscription:
// service worker registration, permission prompt, PushManager subscribe and
// the matching server call (staff JWT endpoints or public menu endpoints).

import type { PushAudience, PushCategory, PushConsumerContext, PushSubscription } from '@gustopos/shared';
import {
  fetchPushConfig,
  fetchPublicPushConfig,
  subscribePush,
  subscribePublicPush,
  unsubscribePush,
  unsubscribePublicPush,
  updatePushCategories,
} from '../api/client';

export type PushFailureReason =
  | 'unsupported'
  | 'insecure'
  | 'denied'
  | 'not-configured'
  | 'failed';

export type PushEnableResult =
  | { ok: true; endpoint: string }
  | { ok: false; reason: PushFailureReason; message: string };

export interface PushTarget {
  audience: PushAudience;
  categories: PushCategory[];
  /** Required for the public menu flows (consumer audience). */
  tenantSlug?: string;
  context?: PushConsumerContext;
}

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  );
}

/** Web Push only exists on secure contexts; useful to explain failures on http://lan. */
export function isSecureContextForPush(): boolean {
  return typeof window !== 'undefined' && window.isSecureContext;
}

export function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    // iOS Safari exposes `navigator.standalone`, not the media query result.
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function getPermissionState(): NotificationPermission | 'unsupported' {
  return isPushSupported() ? Notification.permission : 'unsupported';
}

/**
 * `main.tsx` only registers the service worker in production builds, so a dev
 * session would otherwise hang forever on `serviceWorker.ready`. Registering
 * on demand makes the feature testable locally (the worker is served from
 * `public/` in both modes) and is a no-op when it already exists.
 */
export async function ensureServiceWorker(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration();
  if (existing) return existing;
  return navigator.serviceWorker.register('/sw.js');
}

export function urlBase64ToUint8Array(base64Url: string): Uint8Array {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

function uint8ArrayToBase64Url(bytes: Uint8Array): string {
  let raw = '';
  bytes.forEach((byte) => {
    raw += String.fromCharCode(byte);
  });
  return window.btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** VAPID availability for this origin (staff JWT endpoint or public path). */
export async function fetchConfigFor(target: PushTarget): Promise<{ configured: boolean; publicKey: string | null }> {
  return target.audience === 'staff'
    ? fetchPushConfig()
    : fetchPublicPushConfig(target.tenantSlug ?? '');
}

async function sendSubscribe(target: PushTarget, body: unknown): Promise<PushSubscription> {
  const payload = body as Parameters<typeof subscribePush>[0];
  const response =
    target.audience === 'staff'
      ? await subscribePush(payload)
      : await subscribePublicPush(
          target.tenantSlug ?? '',
          target.context?.kind === 'group_order' ? 'group-order' : 'takeaway',
          payload,
        );
  return response.subscription;
}

async function sendUnsubscribe(target: PushTarget, endpoint: string): Promise<void> {
  try {
    if (target.audience === 'staff') {
      await unsubscribePush(endpoint);
    } else {
      await unsubscribePublicPush(target.tenantSlug ?? '', endpoint);
    }
  } catch {
    // Already gone server-side: nothing to undo.
  }
}

async function removeStaleSubscription(registration: ServiceWorkerRegistration, expectedKey: string): Promise<void> {
  const existing = await registration.pushManager.getSubscription();
  if (!existing) return;
  const rawKey = existing.options.applicationServerKey;
  if (!rawKey) {
    await existing.unsubscribe();
    return;
  }
  const currentKey = uint8ArrayToBase64Url(new Uint8Array(rawKey));
  if (currentKey !== expectedKey) {
    // VAPID keys changed: the old subscription can no longer be used.
    await existing.unsubscribe();
  }
}

/**
 * Asks for permission and registers the push subscription for this device.
 * Call it from a user gesture — iOS refuses the permission prompt otherwise.
 */
export async function enablePush(target: PushTarget): Promise<PushEnableResult> {
  if (!isPushSupported()) {
    return { ok: false, reason: 'unsupported', message: 'Questo browser non supporta le notifiche push' };
  }
  if (!isSecureContextForPush()) {
    return { ok: false, reason: 'insecure', message: 'Le notifiche richiedono HTTPS' };
  }

  let publicKey: string | null;
  try {
    const config = await fetchConfigFor(target);
    publicKey = config.publicKey;
    if (!config.configured || !publicKey) {
      return {
        ok: false,
        reason: 'not-configured',
        message: 'Web Push non configurato: impostare VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY nel server',
      };
    }
  } catch (error) {
    return { ok: false, reason: 'failed', message: describe(error) };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return {
        ok: false,
        reason: permission === 'denied' ? 'denied' : 'failed',
        message:
          permission === 'denied'
            ? 'Permesso notifiche negato: riattivalo dalle impostazioni del sito'
            : 'Permesso notifiche non concesso',
      };
    }

    const registration = await ensureServiceWorker();
    await removeStaleSubscription(registration, publicKey);
    const subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      }));

    const payload = {
      endpoint: subscription.endpoint,
      keys: subscription.toJSON().keys ?? {},
      audience: target.audience,
      categories: target.categories,
      context: target.context,
      deviceLabel: deviceLabel(),
    };

    await sendSubscribe(target, payload);
    return { ok: true, endpoint: subscription.endpoint };
  } catch (error) {
    return { ok: false, reason: 'failed', message: describe(error) };
  }
}

/** Turns notifications off for this device (browser side + server side). */
export async function disablePush(target: PushTarget): Promise<boolean> {
  if (!isPushSupported()) return false;
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return false;
    await sendUnsubscribe(target, subscription.endpoint);
    await subscription.unsubscribe();
    return true;
  } catch {
    return false;
  }
}

/** Persists new categories for an already-registered device. */
export async function savePushCategories(endpoint: string, audience: PushAudience, categories: PushCategory[]): Promise<void> {
  await updatePushCategories({ endpoint, audience, categories });
}

export async function readPushSubscription(): Promise<globalThis.PushSubscription | null> {
  if (!isPushSupported()) return null;
  const registration = await navigator.serviceWorker.getRegistration();
  return (await registration?.pushManager.getSubscription()) ?? null;
}

function deviceLabel(): string {
  const parts = [navigator.platform || 'web'];
  if (isStandalonePwa()) parts.push('PWA');
  return parts.join(' ').slice(0, 80);
}

function describe(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'Registrazione notifiche fallita';
}

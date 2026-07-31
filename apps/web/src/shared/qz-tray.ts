import { fetchQzTrayConfig, type QzTrayConfig } from './api/client';

// ─── Types ────────────────────────────────────────────────────────────────

export interface QzConnectParams {
  host: string;
  usingSecure: boolean;
  port: { secure?: number[]; insecure?: number[] };
}

// ─── Script loader ────────────────────────────────────────────────────────

export function loadQzScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof (window as any).qz !== 'undefined') {
      resolve(true);
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>('script[data-qz]');
    if (existing) {
      if ((window as any).qz) { resolve(true); return; }
      existing.addEventListener('load', () => resolve(typeof (window as any).qz !== 'undefined'));
      existing.addEventListener('error', () => resolve(false));
      return;
    }
    const script = document.createElement('script');
    script.src = '/qz-tray.js';
    script.dataset.qz = '1';
    script.onload = () => resolve(typeof (window as any).qz !== 'undefined');
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

// ─── Config fetch ─────────────────────────────────────────────────────────

/**
 * Fetch QZ Tray connection config from the API.
 * Falls back to localhost defaults on error.
 */
export async function getQzConfig(): Promise<QzConnectParams> {
  try {
    const body = await fetchQzTrayConfig();
    const host = (body.qzTray?.hosts ?? ['localhost', '127.0.0.1'])[0];
    const usingSecure = typeof body.qzTray?.useSecure === 'boolean'
      ? body.qzTray.useSecure
      : window.location.protocol === 'https:';
    const ports = usingSecure
      ? (body.qzTray?.securePorts ?? [8181])
      : (body.qzTray?.insecurePorts ?? [8182]);
    return {
      host,
      usingSecure,
      port: usingSecure ? { secure: ports } : { insecure: ports },
    };
  } catch {
    const usingSecure = window.location.protocol === 'https:';
    return {
      host: 'localhost',
      usingSecure,
      port: usingSecure ? { secure: [8181] } : { insecure: [8182] },
    };
  }
}

// ─── QZ Tray signing (silent printing) ─────────────────────────────────────

const PRINT_BRIDGE_SIGNING_BASE = "http://127.0.0.1:11905";

let fallbackWarningShown = false;

async function fetchSigningText(url: string, timeoutMs = 2500): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { cache: "no-store", signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Set up QZ Tray certificate + signature promises so that printing is silent
 * (no "untrusted" approval dialog) once the signing certificate is installed
 * in QZ Tray (via install-qz-cert.sh / allowed.dat).
 *
 * Prefers the local print-bridge server's signing endpoints (whose certificate
 * fingerprint is whitelisted in allowed.dat), falling back to the API's
 * same-origin signing endpoints.
 */
export async function setupQzSecurity(): Promise<void> {
  const qz = (window as any).qz;
  if (!qz?.security) return;

  let certText: string | null = null;
  let certUrl: string | null = null;
  let signUrl: (request: string) => string;
  try {
    // Print-bridge on the same machine is the canonical signing source. Cache
    // the fetched cert so the certificate promise below avoids a second fetch.
    certText = await fetchSigningText(`${PRINT_BRIDGE_SIGNING_BASE}/signing/digital-certificate.txt`);
    signUrl = (request) =>
      `${PRINT_BRIDGE_SIGNING_BASE}/signing/sign-message?request=${encodeURIComponent(request)}`;
  } catch {
    // Fall back to same-origin API signing. NOTE: the API cert (CN=GustoPOS,
    // self-signed) is NOT whitelisted in QZ Tray's allowed.dat, so this path
    // degrades to the QZ "Allow" popup — silent printing requires the local
    // print-bridge to be reachable.
    if (!fallbackWarningShown) {
      fallbackWarningShown = true;
      console.warn("[qz-tray] print-bridge signing unreachable at 127.0.0.1:11905 — falling back to API signing (QZ Allow popup will appear)");
    }
    certUrl = "/signing/digital-certificate.txt";
    signUrl = (request) => `/api/sign?request=${encodeURIComponent(request)}`;
  }

  qz.security.setCertificatePromise((resolve: (v: string) => void, reject: (e: string) => void) => {
    if (certText) {
      resolve(certText);
      return;
    }
    fetchSigningText(certUrl as string)
      .then(resolve)
      .catch((e) => reject(String(e)));
  });
  qz.security.setSignatureAlgorithm("SHA512");
  qz.security.setSignaturePromise((toSign: string) => {
    return (resolve: (v: string) => void, reject: (e: string) => void) => {
      fetchSigningText(signUrl(toSign))
        .then(resolve)
        .catch((e) => reject(String(e)));
    };
  });
}

// ─── Connection + discovery ───────────────────────────────────────────────

/**
 * Connect to QZ Tray WebSocket and discover printers.
 * Skips connection if already active.
 * @returns discovered printers and QZ Tray version
 */
export async function connectAndDiscover(
  qzConfig: QzConnectParams,
): Promise<{ printers: string[]; version: string | null }> {
  const qz = (window as any).qz;
  if (!qz) throw new Error('QZ Tray library not loaded');

  // Configure signing before the websocket handshake so QZ Tray sees the
  // certificate + signature promises for silent (non-popup) printing.
  await setupQzSecurity();

  const isLocalHost =
    qzConfig.host === 'localhost' ||
    qzConfig.host === '127.0.0.1' ||
    qzConfig.host.startsWith('192.168.') ||
    qzConfig.host.startsWith('10.');

  if (!qz.websocket.isActive()) {
    if (isLocalHost) {
      qz.websocket.setUsingSurf(false);
    }
    await qz.websocket.connect({
      host: qzConfig.host,
      usingSecure: qzConfig.usingSecure,
      retries: 3,
      delay: 1,
      port: qzConfig.port,
    });
  }

  let version: string | null = null;
  try {
    version = await qz.api.getVersion();
  } catch {
    /* version is optional */
  }

  let printers: string[] = [];
  try {
    const found = await qz.printers.find();
    printers = Array.isArray(found) ? found : [];
  } catch {
    /* printers discovery is best-effort */
  }

  return { printers, version };
}

/**
 * Helper: extract raw QZ config object from API response.
 * Useful for components that need the full config (hosts, ports, etc.) for display.
 */
export function extractRawConfig(cfg: QzTrayConfig | null | undefined): QzTrayConfig {
  return {
    hosts: cfg?.hosts ?? ['localhost'],
    securePorts: cfg?.securePorts ?? [8181],
    insecurePorts: cfg?.insecurePorts ?? [8182],
    useSecure: cfg?.useSecure ?? false,
  };
}

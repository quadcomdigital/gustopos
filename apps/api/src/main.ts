import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { join } from "path";
import { readFileSync } from "fs";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { parseCorsOrigins } from "./config/cors.config";
import {
  resolveSigningMaterial,
  type TenantSigningMaterial,
} from "./security/signing-tenants";
import {
  renderSigningTemplate,
  signingTemplateContentType,
  SIGNING_TEMPLATES,
} from "./security/signing-templates";

async function bootstrap() {
  const corsOrigins = parseCorsOrigins(process.env.CORS_ORIGIN);

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    cors: {
      origin: corsOrigins,
      credentials: true,
    },
  });

  // The API binds to loopback and is only reachable through a local reverse
  // proxy (nginx) or the Vite dev proxy. Trusting exactly that one hop makes
  // req.ip (used by the rate limiter and idempotency middleware) reflect the
  // real client instead of the proxy IP for every tenant.
  app.set('trust proxy', 1);

  // Helmet default CSP (`default-src 'self'`) would block the QZ Tray
  // websocket (ws://localhost/127.0.0.1) and the BridgeWorker signing fetches
  // to the local print-bridge (http://127.0.0.1:11905). We only widen
  // connect-src for loopback hosts — everything else stays at default.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          ...helmet.contentSecurityPolicy.getDefaultDirectives(),
          "connect-src": [
            "'self'",
            "ws://localhost:*",
            "ws://127.0.0.1:*",
            "wss://localhost:*",
            "wss://127.0.0.1:*",
            "http://localhost:*",
            "http://127.0.0.1:*",
            "https://localhost:*",
            "https://127.0.0.1:*",
          ],
        },
      },
    }),
  );

  // NOTE: register the signing routes BEFORE app.useStaticAssets below. The web
  // build ships its own copy of signing/digital-certificate.txt (apps/web/dist/
  // signing/…) and express.static would otherwise shadow the explicit route and
  // serve a stale certificate after a rotation — which makes QZ Tray reject it.
  const frontendPath = join(__dirname, '..', '..', 'web', 'dist');

  // These are raw adapter routes (not Nest controller routes), so the request
  // and response shapes are kept structural: headers + query are all the
  // signing routes need.
  type SigningRouteRequest = {
    headers: Record<string, string | string[] | undefined>;
    query?: Record<string, unknown>;
    protocol?: string;
  };
  type SigningRouteResponse = {
    setHeader: (name: string, value: string) => void;
    send: (body: string) => void;
    status: (code: number) => { type: (contentType: string) => { send: (body: string) => void } };
  };

  // Public origin of the request — used to render the installer templates so
  // the scripts always point back at the tenant that served them.
  const requestOrigin = (req: SigningRouteRequest): string => {
    const forwarded = String(req.headers?.["x-forwarded-proto"] ?? "")
      .split(",")[0]
      ?.trim();
    const protocol = forwarded || req.protocol || "https";
    const host = String(req.headers?.host ?? "").trim();
    return host ? `${protocol}://${host}` : "";
  };

  // The Go print agent fetches the public QZ certificate from the API origin.
  // Do not statically mount apps/api/public: it also contains private-key.pem.
  // Expose only the public certificate explicitly. Keep the /api alias for
  // agents configured with an older API-prefixed origin.
  //
  // Per-tenant material wins over the legacy shared pair. The certificate a
  // machine receives and the key used to sign MUST come from the same tenant
  // (both paths call resolveSigningMaterial), otherwise QZ Tray rejects the
  // signature and falls back to the access dialog.
  const sendSigningCertificate = (req: SigningRouteRequest, res: SigningRouteResponse) => {
    const tenant: TenantSigningMaterial | null = resolveSigningMaterial(req);
    const certificatePaths = [
      // Per-tenant certificate (certs/tenants/<slug>/digital-certificate.pem).
      ...(tenant ? [tenant.certPath] : []),
      // Preferred deployment path: explicitly provisioned API public asset.
      join(__dirname, '..', 'public', 'signing', 'digital-certificate.txt'),
      // Clean-checkout fallback: this public certificate is versioned with the
      // print bridge and is identical to the API signing certificate. Never
      // fall back to or expose private-key.pem.
      join(__dirname, '..', '..', 'print-bridge', 'certs', 'digital-certificate.pem'),
    ];
    try {
      const certificate = certificatePaths
        .map((certificatePath) => {
          try {
            return readFileSync(certificatePath, 'utf8');
          } catch {
            return null;
          }
        })
        .find((value): value is string => value !== null);
      if (certificate === undefined) {
        res.status(404).type('text/plain').send('Certificate not found');
        return;
      }
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.send(certificate);
    } catch {
      res.status(404).type('text/plain').send('Certificate not found');
    }
  };
  const httpAdapter = app.getHttpAdapter().getInstance();
  httpAdapter.get('/signing/digital-certificate.txt', sendSigningCertificate);
  httpAdapter.get('/api/signing/digital-certificate.txt', sendSigningCertificate);

  // Same-origin download of the tenant's root CA, used as QZ Tray's trusted
  // root (override.crt). nginx routes /signing/* to the API, so the API must
  // serve it: the installer/diagnostics fetch it from the web origin.
  const sendSigningCaCertificate = (req: SigningRouteRequest, res: SigningRouteResponse) => {
    const tenant: TenantSigningMaterial | null = resolveSigningMaterial(req);
    const caPaths = [
      // Per-tenant anchor: only certificates issued for this tenant chain to
      // it, which is what isolates one tenant's POS machine from another.
      ...(tenant ? [tenant.rootCertPath] : []),
      join(__dirname, '..', '..', 'print-bridge', 'certs', 'override.crt'),
      join(__dirname, '..', '..', 'print-bridge', 'certs', 'ca-cert.pem'),
    ];
    try {
      const ca = caPaths
        .map((caPath) => {
          try {
            return readFileSync(caPath, 'utf8');
          } catch {
            return null;
          }
        })
        .find((value): value is string => value !== null);
      if (ca === undefined) {
        res.status(404).type('text/plain').send('CA certificate not found');
        return;
      }
      res.setHeader('Content-Type', 'application/x-x509-ca-cert');
      res.setHeader('Content-Disposition', 'attachment; filename=override.crt');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.send(ca);
    } catch {
      res.status(404).type('text/plain').send('CA certificate not found');
    }
  };
  httpAdapter.get('/signing/override.crt', sendSigningCaCertificate);
  httpAdapter.get('/api/signing/override.crt', sendSigningCaCertificate);

  // Installer + diagnostics, rendered per request with this tenant's origin
  // and the fingerprints the server publishes right now. Nothing is baked into
  // a shipped file, so a certificate rotation can never leave a script behind
  // that whitelists a fingerprint the server no longer serves.
  const sendSigningTemplate =
    (templateName: Parameters<typeof renderSigningTemplate>[0]) =>
    (req: SigningRouteRequest, res: SigningRouteResponse) => {
      const tenant: TenantSigningMaterial | null = resolveSigningMaterial(req);
      if (!tenant) {
        res
          .status(404)
          .type('text/plain')
          .send('No signing material for this host — download the installer from the tenant domain.');
        return;
      }
      try {
        const body = renderSigningTemplate(templateName, {
          origin: requestOrigin(req),
          slug: tenant.slug,
          cn: tenant.cn,
          rootFingerprintSha1: tenant.rootFingerprintSha1,
          leafFingerprintSha1: tenant.leafFingerprintSha1,
        });
        res.setHeader('Content-Type', signingTemplateContentType(templateName));
        res.setHeader('Content-Disposition', `attachment; filename="${templateName}"`);
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.send(body);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'template render failed';
        res.status(500).type('text/plain').send(message);
      }
    };

  for (const templateName of SIGNING_TEMPLATES) {
    const handler = sendSigningTemplate(templateName);
    httpAdapter.get(`/signing/${templateName}`, handler);
  }

  // Now that the explicit signing routes are registered, mount the SPA static
  // assets. Requests for /signing/* are already handled above, so express.static
  // can no longer shadow the freshly provisioned certificate.
  app.useStaticAssets(frontendPath);

  app.enableShutdownHooks();

  const port = Number(process.env.PORT ?? 11900);
  await app.listen(port, "127.0.0.1");
}
bootstrap();

import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { join } from "path";
import { readFileSync } from "fs";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { parseCorsOrigins } from "./config/cors.config";

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

  const frontendPath = join(__dirname, '..', '..', 'web', 'dist');
  app.useStaticAssets(frontendPath);

  // The Go print agent fetches the public QZ certificate from the API origin.
  // Do not statically mount apps/api/public: it also contains private-key.pem.
  // Expose only the public certificate explicitly. Keep the /api alias for
  // agents configured with an older API-prefixed origin.
  const sendSigningCertificate = (_req: unknown, res: { setHeader: (name: string, value: string) => void; send: (body: string) => void; status: (code: number) => { type: (contentType: string) => { send: (body: string) => void } } }) => {
    const certificatePaths = [
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

  app.enableShutdownHooks();

  const port = Number(process.env.PORT ?? 11900);
  await app.listen(port, "127.0.0.1");
}
bootstrap();

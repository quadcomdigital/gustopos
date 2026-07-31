import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { join } from "path";
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

  app.enableShutdownHooks();

  const port = Number(process.env.PORT ?? 11900);
  await app.listen(port, "127.0.0.1");
}
bootstrap();

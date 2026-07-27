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

  app.use(helmet());

  const frontendPath = join(__dirname, '..', '..', 'web', 'dist');
  app.useStaticAssets(frontendPath);

  app.enableShutdownHooks();

  const port = Number(process.env.PORT ?? 11900);
  await app.listen(port, "127.0.0.1");
}
bootstrap();

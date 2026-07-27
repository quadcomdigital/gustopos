import { MiddlewareConsumer, Module, NestModule, RequestMethod } from "@nestjs/common";
import { ThrottlerModule } from "@nestjs/throttler";
import { AppController } from "./app.controller";
import { AuthModule } from "./auth.module";
import { BomController } from "./bom.controller";
import { DbInitService } from "./db/db-init.service";
import { DbShutdownService } from "./db/db-shutdown.service";
import { AppRepository } from "./repository/app.repository";
import { RealtimePubSubService } from "./realtime/pubsub.service";
import { RealtimeGateway } from "./realtime.gateway";
import { StaffController } from "./staff.controller";
import { TablesController } from "./tables.controller";
import { TenantService } from "./tenant/tenant.service";
import { TenantContextMiddleware } from "./tenant/tenant-context.middleware";
import { FeatureFlagGuard } from "./tenant/feature-flag.guard";
import { IdempotencyMiddleware } from "./tenant/idempotency.middleware";
import { SuperadminController } from "./superadmin/superadmin.controller";
import { SuperadminAuthController } from "./superadmin/superadmin-auth.controller";
import { SuperadminAuthService } from "./superadmin/superadmin-auth.service";
import { SuperadminAuthGuard } from "./superadmin/superadmin-auth.guard";
import { SuperadminGuard } from "./superadmin/superadmin.guard";
import { BootstrapTenantService } from "./tenant/bootstrap-tenant.service";
import { ConsumerAuthController } from "./public/consumer-auth.controller";
import { ConsumerAuthService } from "./public/consumer-auth.service";
import { ConsumerJwtAuthGuard } from "./auth/consumer-jwt-auth.guard";
import { PublicMenuController } from "./public/public-menu.controller";

@Module({
  imports: [
    AuthModule,
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 10,
      },
    ]),
  ],
  controllers: [
    AppController,
    StaffController,
    TablesController,
    BomController,
    SuperadminController,
    SuperadminAuthController,
    PublicMenuController,
    ConsumerAuthController,
  ],
  providers: [
    AppRepository,
    DbInitService,
    DbShutdownService,
    RealtimePubSubService,
    RealtimeGateway,
    TenantService,
    TenantContextMiddleware,
    IdempotencyMiddleware,
    FeatureFlagGuard,
    SuperadminGuard,
    SuperadminAuthService,
    SuperadminAuthGuard,
    BootstrapTenantService,
    ConsumerAuthService,
    ConsumerJwtAuthGuard,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(TenantContextMiddleware)
      .exclude(
        { path: "api/superadmin/(.*)", method: RequestMethod.ALL },
        { path: "api/health", method: RequestMethod.GET },
      )
      .forRoutes({ path: "*", method: RequestMethod.ALL });

    consumer
      .apply(IdempotencyMiddleware)
      .exclude(
        { path: "api/superadmin/(.*)", method: RequestMethod.ALL },
        { path: "api/health", method: RequestMethod.GET },
      )
      .forRoutes({ path: "*", method: RequestMethod.ALL });
  }
}

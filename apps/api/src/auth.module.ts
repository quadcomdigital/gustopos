import { Module } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./auth/jwt-auth.guard";
import { RolesGuard } from "./auth/roles.guard";
import { PermissionsGuard } from "./auth/permissions.guard";
import { AppRepository } from "./repository/app.repository";
import { AuditLogService } from "./audit-log.service";

@Module({
  controllers: [AuthController],
  providers: [AuthService, AppRepository, Reflector, JwtAuthGuard, RolesGuard, PermissionsGuard, AuditLogService],
  exports: [AuthService, JwtAuthGuard, RolesGuard, PermissionsGuard, AuditLogService],
})
export class AuthModule {}

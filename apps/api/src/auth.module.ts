import { Module } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./auth/jwt-auth.guard";
import { RolesGuard } from "./auth/roles.guard";
import { PermissionsGuard } from "./auth/permissions.guard";
import { AppRepository } from "./repository/app.repository";
import { StaffRepository } from "./repository/staff.repository";
import { ShiftsRepository } from "./repository/shifts.repository";
import { SuppliersRepository } from "./repository/suppliers.repository";
import { InventoryRepository } from "./repository/inventory.repository";
import { TablesRepository } from "./repository/tables.repository";
import { ConsumerRepository } from "./repository/consumer.repository";
import { AuditLogService } from "./audit-log.service";

@Module({
  controllers: [AuthController],
  providers: [AuthService, AppRepository, StaffRepository, ShiftsRepository, SuppliersRepository, InventoryRepository, TablesRepository, ConsumerRepository, Reflector, JwtAuthGuard, RolesGuard, PermissionsGuard, AuditLogService],
  exports: [AuthService, JwtAuthGuard, RolesGuard, PermissionsGuard, AuditLogService],
})
export class AuthModule {}

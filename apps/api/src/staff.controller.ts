import {
  Body,
  Controller,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
  Get,
  UseGuards,
} from "@nestjs/common";
import type {
  LogoutResponse,
  StaffAdmin,
  StaffAdminListResponse,
  StaffCreateRequest,
  StaffResetPinRequest,
  StaffUpdateRequest,
} from "@gustopos/shared";
import { JwtAuthGuard } from "./auth/jwt-auth.guard";
import { PermissionsGuard } from "./auth/permissions.guard";
import { RequiresPermissions } from "./auth/permissions.decorator";
import { RolesGuard } from "./auth/roles.guard";
import { Roles } from "./auth/roles.decorator";
import { logoutResponseSchema } from "@gustopos/shared";
import { StaffRepository } from "./repository/staff.repository";
import { AuditLogService } from "./audit-log.service";
import { FeatureFlagGuard } from "./tenant/feature-flag.guard";
import { RequiresModule } from "./tenant/requires-module.decorator";

@Controller("api/staff")
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard, FeatureFlagGuard)
@Roles("admin")
@RequiresPermissions("staff:manage")
@RequiresModule("kitchen")
export class StaffController {
  constructor(
    @Inject(StaffRepository) private readonly staffRepo: StaffRepository,
    @Inject(AuditLogService) private readonly auditLogService: AuditLogService,
  ) {}

  @Get()
  list(): Promise<StaffAdminListResponse> {
    return this.staffRepo.listStaffAdmin();
  }

  @Post()
  create(@Body() payload: StaffCreateRequest): Promise<StaffAdmin> {
    return this.staffRepo.createStaff(payload);
  }

  @Patch(":id")
  async update(@Param("id") id: string, @Body() payload: StaffUpdateRequest): Promise<StaffAdmin> {
    const updated = await this.staffRepo.updateStaff(id, payload);
    if (!updated) {
      throw new NotFoundException("Staff not found");
    }

    return updated;
  }

  @Post(":id/reset-pin")
  async resetPin(@Param("id") id: string, @Body() payload: StaffResetPinRequest): Promise<LogoutResponse> {
    const updated = await this.staffRepo.resetStaffPin(id, payload);
    if (!updated) {
      throw new NotFoundException("Staff not found");
    }

    this.auditLogService.log("staff.pin.reset", { targetId: id });
    return logoutResponseSchema.parse({ success: true });
  }

  @Post(":id/disable")
  async disable(@Param("id") id: string): Promise<LogoutResponse> {
    const updated = await this.staffRepo.setStaffActiveState(id, false);
    if (!updated) {
      throw new NotFoundException("Staff not found");
    }

    this.auditLogService.log("staff.disabled", { targetId: id });
    return logoutResponseSchema.parse({ success: true });
  }

  @Post(":id/enable")
  async enable(@Param("id") id: string): Promise<LogoutResponse> {
    const updated = await this.staffRepo.setStaffActiveState(id, true);
    if (!updated) {
      throw new NotFoundException("Staff not found");
    }

    this.auditLogService.log("staff.enabled", { targetId: id });
    return logoutResponseSchema.parse({ success: true });
  }
}

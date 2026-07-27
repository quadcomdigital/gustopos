import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import type {
  Table,
  TableBulkCreateRequest,
  TableCreateRequest,
  TableUpdateRequest,
} from "@gustopos/shared";
import { JwtAuthGuard } from "./auth/jwt-auth.guard";
import { PermissionsGuard } from "./auth/permissions.guard";
import { RequiresPermissions } from "./auth/permissions.decorator";
import { RolesGuard } from "./auth/roles.guard";
import { Roles } from "./auth/roles.decorator";
import { AppRepository } from "./repository/app.repository";
import { AuditLogService } from "./audit-log.service";
import { FeatureFlagGuard } from "./tenant/feature-flag.guard";
import { RequiresModule } from "./tenant/requires-module.decorator";

@Controller("api/tables")
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard, FeatureFlagGuard)
@Roles("admin")
@RequiresPermissions("tables:manage")
@RequiresModule("kitchen")
export class TablesController {
  constructor(
    @Inject(AppRepository) private readonly appRepository: AppRepository,
    @Inject(AuditLogService) private readonly auditLogService: AuditLogService,
  ) {}

  @Get()
  list(): Promise<Table[]> {
    return this.appRepository.listTables();
  }

  @Post()
  create(@Body() payload: TableCreateRequest): Promise<Table> {
    return this.appRepository.createTable(payload);
  }

  @Post("bulk")
  bulkCreate(@Body() payload: TableBulkCreateRequest): Promise<Table[]> {
    return this.appRepository.bulkCreateTables(payload);
  }

  @Patch(":id")
  async update(@Param("id") id: string, @Body() payload: TableUpdateRequest): Promise<Table> {
    const updated = await this.appRepository.updateTable(id, payload);
    if (!updated) {
      throw new NotFoundException("Table not found");
    }

    this.auditLogService.log("table.updated", { targetId: id, details: { changes: payload } });
    return updated;
  }

  @Delete(":id")
  async delete(@Param("id") id: string): Promise<{ success: true }> {
    const deleted = await this.appRepository.deleteTable(id);
    if (!deleted) {
      throw new NotFoundException("Table not found");
    }

    this.auditLogService.log("table.deleted", { targetId: id });
    return { success: true };
  }
}

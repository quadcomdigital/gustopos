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
import {
  socketEvents,
  type Table,
  type TableBulkCreateRequest,
  type TableCreateRequest,
  type TableUpdateRequest,
} from "@gustopos/shared";
import { JwtAuthGuard } from "./auth/jwt-auth.guard";
import { PermissionsGuard } from "./auth/permissions.guard";
import { RequiresPermissions } from "./auth/permissions.decorator";
import { RolesGuard } from "./auth/roles.guard";
import { Roles } from "./auth/roles.decorator";
import { TablesRepository } from "./repository/tables.repository";
import { AuditLogService } from "./audit-log.service";
import { FeatureFlagGuard } from "./tenant/feature-flag.guard";
import { RequiresModule } from "./tenant/requires-module.decorator";
import { RealtimeGateway } from "./realtime.gateway";

@Controller("api/tables")
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard, FeatureFlagGuard)
@Roles("admin")
@RequiresPermissions("tables:manage")
@RequiresModule("kitchen")
export class TablesController {
  constructor(
    @Inject(TablesRepository) private readonly tablesRepo: TablesRepository,
    @Inject(AuditLogService) private readonly auditLogService: AuditLogService,
    @Inject(RealtimeGateway) private readonly realtimeGateway: RealtimeGateway,
  ) {}

  /**
   * Post-commit realtime sync for the table map. Best-effort: the mutation is
   * already persisted, so a socket/pubsub failure must never turn it into a 500.
   * Crucial for soft-delete: other terminals must learn the table is gone so the
   * POS stops binding carts to it (rename/removal → safe fallback or block).
   */
  private async emitTablesUpdate(): Promise<void> {
    try {
      const tables = await this.tablesRepo.listTables();
      await this.realtimeGateway.emit(socketEvents.tablesUpdate, tables);
    } catch (err) {
      console.warn("[realtime] tables:update emit failed:", err);
    }
  }

  @Get()
  list(): Promise<Table[]> {
    return this.tablesRepo.listTables();
  }

  @Post()
  async create(@Body() payload: TableCreateRequest): Promise<Table> {
    const created = await this.tablesRepo.createTable(payload);
    await this.emitTablesUpdate();
    return created;
  }

  @Post("bulk")
  async bulkCreate(@Body() payload: TableBulkCreateRequest): Promise<Table[]> {
    const created = await this.tablesRepo.bulkCreateTables(payload);
    await this.emitTablesUpdate();
    return created;
  }

  @Patch(":id")
  async update(@Param("id") id: string, @Body() payload: TableUpdateRequest): Promise<Table> {
    const updated = await this.tablesRepo.updateTable(id, payload);
    if (!updated) {
      throw new NotFoundException("Table not found");
    }

    this.auditLogService.log("table.updated", { targetId: id, details: { changes: payload } });
    await this.emitTablesUpdate();
    return updated;
  }

  @Delete(":id")
  async delete(@Param("id") id: string): Promise<{ success: true }> {
    const deleted = await this.tablesRepo.deleteTable(id);
    if (!deleted) {
      throw new NotFoundException("Table not found");
    }

    this.auditLogService.log("table.deleted", { targetId: id });
    await this.emitTablesUpdate();
    return { success: true };
  }
}

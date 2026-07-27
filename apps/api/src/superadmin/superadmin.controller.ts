import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import type {
  RefreshResponse,
  Tenant,
  TenantCreateRequest,
  TenantModule,
  TenantModuleConfig,
  TenantModuleConfigUpsertRequest,
  TenantModuleToggleRequest,
  TenantUpdateRequest,
} from "@gustopos/shared";
import { TenantService } from "../tenant/tenant.service";
import { SuperadminAuthGuard } from "./superadmin-auth.guard";
import { SuperadminAuthService } from "./superadmin-auth.service";

type SuperadminRequest = {
  superadmin?: {
    sub: string;
  };
};

@Controller("api/superadmin")
@UseGuards(SuperadminAuthGuard)
export class SuperadminController {
  constructor(
    private readonly tenantService: TenantService,
    private readonly superadminAuthService: SuperadminAuthService,
  ) {}

  @Get("tenants")
  listTenants(): Promise<Tenant[]> {
    return this.tenantService.listTenants();
  }

  @Post("tenants")
  createTenant(@Body() payload: TenantCreateRequest): Promise<Tenant> {
    return this.tenantService.createTenant(payload);
  }

  @Patch("tenants/:id")
  async updateTenant(@Param("id") id: string, @Body() payload: TenantUpdateRequest): Promise<Tenant> {
    const updated = await this.tenantService.updateTenant(id, payload);
    if (!updated) {
      throw new NotFoundException("Tenant not found");
    }

    return updated;
  }

  @Get("tenants/:id/modules")
  listTenantModules(@Param("id") id: string): Promise<TenantModule[]> {
    return this.tenantService.listTenantModules(id);
  }

  @Post("tenants/:id/modules/toggle")
  toggleTenantModule(
    @Param("id") id: string,
    @Body() payload: TenantModuleToggleRequest,
  ): Promise<TenantModule> {
    return this.tenantService.toggleTenantModule(id, payload);
  }

  @Post("tenants/:id/modules/config")
  upsertTenantModuleConfig(
    @Param("id") id: string,
    @Body() payload: TenantModuleConfigUpsertRequest,
  ): Promise<TenantModuleConfig> {
    return this.tenantService.upsertTenantModuleConfig(id, payload);
  }

  @Get("tenants/:id/modules/config/:moduleKey")
  async getTenantModuleConfig(
    @Param("id") id: string,
    @Param("moduleKey") moduleKey: string,
  ): Promise<TenantModuleConfig> {
    const config = await this.tenantService.getTenantModuleConfig(id, moduleKey as TenantModuleConfigUpsertRequest["moduleKey"]);
    if (!config) {
      throw new NotFoundException("Module config not found");
    }
    return config;
  }

  @Get("tenants/:id/public-menu/catalog")
  listPublicMenuCatalog(@Param("id") id: string) {
    return this.tenantService.listPublicMenuCatalog(id);
  }

  @Get("audit-logs")
  listAuditLogs() {
    return this.tenantService.listTenantAuditLogs(300);
  }

  @Get("tenants/:id/health")
  async health(@Param("id") id: string) {
    const tenant = await this.tenantService.getTenantById(id);
    const modules = await this.tenantService.listTenantModules(id);
    return {
      tenant,
      modules,
      status: tenant?.isActive ? "healthy" : "inactive",
    };
  }

  @Post("tenants/:id/impersonate")
  impersonateTenant(@Param("id") id: string, @Req() request: SuperadminRequest): Promise<RefreshResponse> {
    return this.superadminAuthService.impersonateTenant(id, request.superadmin?.sub);
  }

  @Post("impersonation/stop")
  async stopImpersonation(
    @Body() payload: { tenantId?: string; sessionId?: string },
    @Req() request: SuperadminRequest,
  ): Promise<{ success: true }> {
    await this.superadminAuthService.stopImpersonation(request.superadmin?.sub, payload?.tenantId, payload?.sessionId);
    return { success: true };
  }
}

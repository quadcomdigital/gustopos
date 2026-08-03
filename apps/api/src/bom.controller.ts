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
  BomCreateRequest,
  BomItem,
  BomUpsertComponentsRequest,
  BomUpdateRequest,
  BomAddComponentRequest,
  BomRemoveComponentRequest,
} from "@gustopos/shared";
import { JwtAuthGuard } from "./auth/jwt-auth.guard";
import { RolesGuard } from "./auth/roles.guard";
import { Roles } from "./auth/roles.decorator";
import { InventoryRepository } from "./repository/inventory.repository";
import { FeatureFlagGuard } from "./tenant/feature-flag.guard";
import { RequiresModule } from "./tenant/requires-module.decorator";

@Controller("api/bom")
@UseGuards(JwtAuthGuard, RolesGuard, FeatureFlagGuard)
@Roles("admin", "chef")
@RequiresModule("inventory")
export class BomController {
  constructor(
    @Inject(InventoryRepository) private readonly inventoryRepo: InventoryRepository,
  ) {}

  @Get()
  list(): Promise<BomItem[]> {
    return this.inventoryRepo.listBomItems();
  }

  @Post()
  create(@Body() payload: BomCreateRequest): Promise<BomItem> {
    return this.inventoryRepo.createBomItem(payload);
  }

  @Patch(":id")
  async update(@Param("id") id: string, @Body() payload: BomUpdateRequest): Promise<BomItem> {
    const updated = await this.inventoryRepo.updateBomItem(id, payload);
    if (!updated) {
      throw new NotFoundException("BoM item not found");
    }

    return updated;
  }

  @Post(":id/components")
  async replaceComponents(@Param("id") id: string, @Body() payload: BomUpsertComponentsRequest): Promise<BomItem> {
    const updated = await this.inventoryRepo.replaceBomComponents(id, payload);
    if (!updated) {
      throw new NotFoundException("BoM item not found");
    }

    return updated;
  }

  @Post(":id/components/add")
  async addComponent(@Param("id") id: string, @Body() payload: BomAddComponentRequest): Promise<BomItem> {
    const updated = await this.inventoryRepo.addBomComponent(id, payload);
    if (!updated) {
      throw new NotFoundException("BoM item not found");
    }

    return updated;
  }

  @Post(":id/components/remove")
  async removeComponent(@Param("id") id: string, @Body() payload: BomRemoveComponentRequest): Promise<BomItem> {
    const updated = await this.inventoryRepo.removeBomComponent(id, payload);
    if (!updated) {
      throw new NotFoundException("BoM item not found");
    }

    return updated;
  }

  @Delete(":id")
  async remove(@Param("id") id: string): Promise<{ success: true }> {
    const removed = await this.inventoryRepo.deleteBomItem(id);
    if (!removed) {
      throw new NotFoundException("BoM item not found");
    }

    return { success: true };
  }
}

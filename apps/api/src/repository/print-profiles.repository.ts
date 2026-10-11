import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import crypto from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "../db/client";
import { printStations } from "../db/schema";
import { getTenantIdOrDefault } from "../tenant/tenant-context.store";
import { TenantService } from "../tenant/tenant.service";
import {
  printProfilesStateSchema,
  type PrintBridge,
  type PrintProfile,
  type PrintProfileActivateResponse,
  type PrintProfileCreateRequest,
  type PrintProfileUpdateRequest,
  type PrintProfilesState,
} from "@gustopos/shared";
import { PrintBridgeRepository } from "./print-bridge.repository";
import {
  findClaimedAreaOverlaps,
  matchProfileBridge,
  normalizeProfileBridges,
  planClaimedAreas,
  planMappings,
  snapshotBridges,
} from "./print-profiles.logic";

const PRINT_PROFILES_KEY = "printProfiles";

export interface ActivatePrintProfileResult {
  result: PrintProfileActivateResponse;
  /** Bridges whose routing actually changed — used for realtime updates. */
  changedBridges: PrintBridge[];
}

/**
 * Named, switchable print configurations: a snapshot of each bridge's routing
 * (station → printer mappings + claimed stations), stored per tenant under the
 * `printing` module config next to the QZ Tray settings. Exactly ONE profile
 * is active at a time; activating re-applies the snapshot, deactivating leaves
 * the live routing untouched.
 */
@Injectable()
export class PrintProfilesRepository {
  constructor(
    private readonly tenantService: TenantService,
    private readonly printBridgeRepo: PrintBridgeRepository,
  ) {}

  // ─── Storage (read-modify-write: sibling config keys must survive) ──────

  private async readPrintingConfig(): Promise<Record<string, unknown>> {
    const tenantId = getTenantIdOrDefault();
    const existing = await this.tenantService.getTenantModuleConfig(tenantId, "printing");
    const config = existing?.config as Record<string, unknown> | undefined;
    return config && typeof config === "object" ? { ...config } : {};
  }

  async getState(): Promise<PrintProfilesState> {
    const config = await this.readPrintingConfig();
    const stored = config[PRINT_PROFILES_KEY];
    return printProfilesStateSchema.parse(stored && typeof stored === "object" ? stored : {});
  }

  private async writeState(state: PrintProfilesState): Promise<PrintProfilesState> {
    const tenantId = getTenantIdOrDefault();
    const parsed = printProfilesStateSchema.parse(state);
    const config = await this.readPrintingConfig();
    await this.tenantService.upsertTenantModuleConfig(tenantId, {
      moduleKey: "printing",
      config: { ...config, [PRINT_PROFILES_KEY]: parsed },
    });
    return parsed;
  }

  // ─── CRUD ───────────────────────────────────────────────────────────────

  /**
   * Snapshots the CURRENT live pool (optionally only `bridgeIds`) without
   * touching any bridge: creating a configuration never changes routing.
   */
  async createProfile(payload: PrintProfileCreateRequest): Promise<PrintProfilesState> {
    const state = await this.getState();
    const name = payload.name.trim();
    this.assertNameFree(state, name);

    const now = new Date().toISOString();
    const description = payload.description?.trim();
    const liveBridges = await this.printBridgeRepo.listPrintBridges();

    // COLD build: the caller supplies the content (endpoints picked from the
    // acquired-printer registry), so NOTHING has to be online — not even a
    // bridge in the pool. Entries keep their identity and are re-matched by
    // instanceId once the machine shows up again.
    if (payload.bridges) {
      const profile: PrintProfile = {
        id: `prt_${crypto.randomUUID()}`,
        name,
        ...(description ? { description } : {}),
        bridges: normalizeProfileBridges(payload.bridges, liveBridges),
        createdAt: now,
        updatedAt: now,
      };
      return this.writeState({ ...state, profiles: [...state.profiles, profile] });
    }

    const snapshot = snapshotBridges(liveBridges, payload.bridgeIds);
    if (snapshot.length === 0) {
      throw new BadRequestException(
        payload.bridgeIds?.length
          ? "None of the selected bridges are registered in this tenant"
          : "No bridge registered yet: pair a printer before saving a configuration",
      );
    }

    const profile: PrintProfile = {
      id: `prt_${crypto.randomUUID()}`,
      name,
      ...(description ? { description } : {}),
      bridges: snapshot,
      createdAt: now,
      updatedAt: now,
    };
    return this.writeState({ ...state, profiles: [...state.profiles, profile] });
  }

  /**
   * Renames, rewrites the description, replaces the content (`bridges`, i.e.
   * the editor's draft) and/or re-snapshots from live state.
   *
   * An explicit `bridges` payload wins over `snapshot`: the draft is what the
   * admin just edited, the snapshot is only a "start over from live" shortcut.
   * Neither touches live routing — that is what activation is for.
   */
  async updateProfile(
    id: string,
    payload: PrintProfileUpdateRequest,
  ): Promise<PrintProfilesState> {
    const state = await this.getState();
    const index = state.profiles.findIndex((profile) => profile.id === id);
    if (index === -1) throw new NotFoundException("Print configuration not found");
    const current = state.profiles[index];

    const name = payload.name?.trim() ?? current.name;
    if (payload.name !== undefined) this.assertNameFree(state, name, id);

    const description =
      payload.description === undefined
        ? current.description
        : payload.description?.trim() || undefined;

    let bridges = current.bridges;
    if (payload.bridges) {
      bridges = normalizeProfileBridges(
        payload.bridges,
        await this.printBridgeRepo.listPrintBridges(),
      );
    } else if (payload.snapshot) {
      bridges = snapshotBridges(await this.printBridgeRepo.listPrintBridges());
    }

    const updated: PrintProfile = {
      ...current,
      name,
      ...(description ? { description } : {}),
      bridges,
      updatedAt: new Date().toISOString(),
    };
    const profiles = [...state.profiles];
    profiles[index] = updated;
    return this.writeState({ ...state, profiles });
  }

  async deleteProfile(id: string): Promise<PrintProfilesState> {
    const state = await this.getState();
    const exists = state.profiles.some((profile) => profile.id === id);
    if (!exists) throw new NotFoundException("Print configuration not found");
    return this.writeState({
      ...state,
      activeId: state.activeId === id ? null : state.activeId,
      profiles: state.profiles.filter((profile) => profile.id !== id),
    });
  }

  /** Stops tracking a configuration; the live routing stays as it is now. */
  async deactivate(): Promise<PrintProfilesState> {
    const state = await this.getState();
    if (state.activeId === null) return state;
    // Deactivation leaves the live routing untouched: `activeAt` goes back to
    // null so the UI stops claiming any configuration is applied.
    return this.writeState({ ...state, activeId: null, activeAt: null });
  }

  // ─── Activation ─────────────────────────────────────────────────────────

  /**
   * Re-applies the profile's snapshot to every bridge it still knows about.
   *
   * Deliberate guardrails:
   *  - bridges missing from the pool are reported, never created;
   *  - entries with no routing are skipped (applying them would wipe a mapping
   *    configured after the snapshot);
   *  - stations deleted/deactivated since the snapshot are dropped by the
   *    station validation in `updateBridgeClaimedAreas` and reported, so jobs
   *    for them cannot get stranded silently;
   *  - `activeId` is written only after every bridge update succeeded.
   */
  async activateProfile(id: string): Promise<ActivatePrintProfileResult> {
    const tenantId = getTenantIdOrDefault();
    const state = await this.getState();
    const profile = state.profiles.find((entry) => entry.id === id);
    if (!profile) throw new NotFoundException("Print configuration not found");

    const liveBridges = await this.printBridgeRepo.listPrintBridges();
    const stationRows = await db
      .select({ id: printStations.id })
      .from(printStations)
      .where(and(eq(printStations.tenantId, tenantId), eq(printStations.isActive, 1)));
    const activeStationIds = new Set(stationRows.map((row) => row.id));

    const applied: PrintProfileActivateResponse["applied"] = [];
    const missing: PrintProfileActivateResponse["missing"] = [];
    const skipped: PrintProfileActivateResponse["skipped"] = [];
    const droppedStations: PrintProfileActivateResponse["droppedStations"] = [];
    const changedBridges: PrintBridge[] = [];

    for (const entry of profile.bridges) {
      const bridge = matchProfileBridge(entry, liveBridges);
      if (!bridge) {
        missing.push({ bridgeId: entry.bridgeId, ...(entry.label ? { label: entry.label } : {}) });
        continue;
      }
      const hasRouting =
        (entry.claimedAreas ?? []).length > 0 || (entry.mappings ?? []).length > 0;
      if (!hasRouting) {
        skipped.push({ bridgeId: bridge.id, label: bridge.name });
        continue;
      }

      const plan = planClaimedAreas(entry.claimedAreas ?? [], activeStationIds);
      // Both writes go through the existing bridge repo methods so the very
      // same station validation and legacy-key normalization apply as on a
      // manual edit from the mappings modal.
      await this.printBridgeRepo.updateBridgeMappings(
        bridge.id,
        planMappings(entry.mappings ?? [], plan.areas),
      );
      const updated = await this.printBridgeRepo.updateBridgeClaimedAreas(bridge.id, plan.areas);
      changedBridges.push(updated);
      applied.push({ bridgeId: bridge.id, label: bridge.name });
      if (plan.dropped.length > 0) {
        droppedStations.push({
          bridgeId: bridge.id,
          label: bridge.name,
          stationIds: plan.dropped,
        });
      }
    }

    // `activeId` is written only after every bridge update succeeded; the
    // timestamp lets the UI distinguish "applied" (agent heartbeated after
    // this) from "waiting for an offline bridge".
    const appliedAt = new Date().toISOString();
    const nextState = await this.writeState({
      ...state,
      activeId: profile.id,
      activeAt: appliedAt,
    });
    const refreshed =
      changedBridges.length > 0 ? await this.printBridgeRepo.listPrintBridges() : liveBridges;

    return {
      result: {
        activeId: profile.id,
        activeAt: appliedAt,
        applied,
        missing,
        skipped,
        droppedStations,
        overlaps: findClaimedAreaOverlaps(refreshed),
      },
      changedBridges,
    };
  }

  private assertNameFree(state: PrintProfilesState, name: string, exceptId?: string): void {
    const taken = state.profiles.some(
      (profile) =>
        profile.id !== exceptId && profile.name.toLocaleLowerCase("it-IT") === name.toLocaleLowerCase("it-IT"),
    );
    if (taken) {
      throw new BadRequestException("A configuration with this name already exists");
    }
  }
}

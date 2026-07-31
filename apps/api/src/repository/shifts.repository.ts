// ─── Shifts Repository ─────────────────────────────────────────────────────
// Extracted from AppRepository — Phase 3 of the Strangler Fig refactoring.
// Contains: shift CRUD, clock-in/out, time reports. Zero cross-domain deps.

import crypto from "node:crypto";
import { Injectable } from "@nestjs/common";
import { and, desc, eq, gte, inArray, isNull, lte, type SQL } from "drizzle-orm";
import { db } from "../db/client";
import {
  staffShifts,
  timeEntries,
  staff,
} from "../db/schema";
import { getTenantIdOrDefault } from "../tenant/tenant-context.store";
import {
  shiftSchema,
  shiftCreateRequestSchema,
  shiftUpdateRequestSchema,
  shiftStatusSchema,
  shiftsQuerySchema,
  clockInRequestSchema,
  clockOutRequestSchema,
  timeEntrySchema,
  timeEntrySourceSchema,
  timeEntryStatusSchema,
  timeReportQuerySchema,
  timeReportResponseSchema,
  type Shift,
  type ShiftCreateRequest,
  type ShiftUpdateRequest,
  type ShiftsQuery,
  type TimeEntry,
  type TimeEntryStatus,
  type ClockInRequest,
  type ClockOutRequest,
  type TimeReportQuery,
  type TimeReportResponse,
} from "@gustopos/shared";

@Injectable()
export class ShiftsRepository {

  // ─── Shift CRUD ──────────────────────────────────────────────────────

  async listShifts(query: ShiftsQuery): Promise<Shift[]> {
    const parsed = shiftsQuerySchema.parse(query);
    const tenantId = getTenantIdOrDefault();
    const conditions: SQL[] = [eq(staffShifts.tenantId, tenantId)];
    if (parsed.staffId) {
      conditions.push(eq(staffShifts.staffId, parsed.staffId));
    }
    if (parsed.status) {
      conditions.push(eq(staffShifts.status, parsed.status));
    }
    if (parsed.from) {
      conditions.push(gte(staffShifts.startAt, new Date(parsed.from)));
    }
    if (parsed.to) {
      conditions.push(lte(staffShifts.endAt, new Date(parsed.to)));
    }

    const rows = await db
      .select()
      .from(staffShifts)
      .where(and(...conditions))
      .orderBy(desc(staffShifts.startAt))
      .limit(parsed.limit ?? 200);

    return rows.map((row) =>
      shiftSchema.parse({
        id: row.id,
        staffId: row.staffId,
        shiftDate: row.shiftDate,
        startAt: row.startAt.toISOString(),
        endAt: row.endAt.toISOString(),
        toleranceEarlyMin: row.toleranceEarlyMin,
        toleranceLateMin: row.toleranceLateMin,
        status: shiftStatusSchema.parse(row.status),
        notes: row.notes ?? undefined,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      }),
    );
  }

  async createShift(payload: ShiftCreateRequest): Promise<Shift> {
    const parsed = shiftCreateRequestSchema.parse(payload);
    const tenantId = getTenantIdOrDefault();
    const now = new Date();

    const staffRows = await db
      .select({ id: staff.id })
      .from(staff)
      .where(and(eq(staff.tenantId, tenantId), eq(staff.id, parsed.staffId), eq(staff.isActive, 1)))
      .limit(1);
    if (staffRows.length === 0) {
      throw new Error("Staff not found or inactive");
    }

    const inserted = await db
      .insert(staffShifts)
      .values({
        id: `sh_${crypto.randomUUID()}`,
        tenantId,
        staffId: parsed.staffId,
        shiftDate: parsed.shiftDate,
        startAt: new Date(parsed.startAt),
        endAt: new Date(parsed.endAt),
        toleranceEarlyMin: parsed.toleranceEarlyMin,
        toleranceLateMin: parsed.toleranceLateMin,
        status: "scheduled",
        notes: parsed.notes ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    const row = inserted[0];
    return shiftSchema.parse({
      id: row.id,
      staffId: row.staffId,
      shiftDate: row.shiftDate,
      startAt: row.startAt.toISOString(),
      endAt: row.endAt.toISOString(),
      toleranceEarlyMin: row.toleranceEarlyMin,
      toleranceLateMin: row.toleranceLateMin,
      status: shiftStatusSchema.parse(row.status),
      notes: row.notes ?? undefined,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    });
  }

  async updateShift(id: string, payload: ShiftUpdateRequest): Promise<Shift | null> {
    const parsed = shiftUpdateRequestSchema.parse(payload);
    const tenantId = getTenantIdOrDefault();
    const updated = await db
      .update(staffShifts)
      .set({
        ...(parsed.startAt !== undefined ? { startAt: new Date(parsed.startAt) } : {}),
        ...(parsed.endAt !== undefined ? { endAt: new Date(parsed.endAt) } : {}),
        ...(parsed.toleranceEarlyMin !== undefined ? { toleranceEarlyMin: parsed.toleranceEarlyMin } : {}),
        ...(parsed.toleranceLateMin !== undefined ? { toleranceLateMin: parsed.toleranceLateMin } : {}),
        ...(parsed.status !== undefined ? { status: parsed.status } : {}),
        ...(parsed.notes !== undefined ? { notes: parsed.notes } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(staffShifts.tenantId, tenantId), eq(staffShifts.id, id)))
      .returning();

    if (updated.length === 0) {
      return null;
    }

    const row = updated[0];
    return shiftSchema.parse({
      id: row.id,
      staffId: row.staffId,
      shiftDate: row.shiftDate,
      startAt: row.startAt.toISOString(),
      endAt: row.endAt.toISOString(),
      toleranceEarlyMin: row.toleranceEarlyMin,
      toleranceLateMin: row.toleranceLateMin,
      status: shiftStatusSchema.parse(row.status),
      notes: row.notes ?? undefined,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    });
  }

  // ─── Clock In / Out ──────────────────────────────────────────────────

  async clockIn(payload: ClockInRequest): Promise<TimeEntry> {
    const parsed = clockInRequestSchema.parse(payload);
    const tenantId = getTenantIdOrDefault();
    const at = new Date(parsed.at);

    const staffRows = await db
      .select({ id: staff.id })
      .from(staff)
      .where(and(eq(staff.tenantId, tenantId), eq(staff.id, parsed.staffId), eq(staff.isActive, 1)))
      .limit(1);
    if (staffRows.length === 0) {
      throw new Error("Staff not found or inactive");
    }

    const openRows = await db
      .select({ id: timeEntries.id })
      .from(timeEntries)
      .where(
        and(
          eq(timeEntries.tenantId, tenantId),
          eq(timeEntries.staffId, parsed.staffId),
          isNull(timeEntries.clockOutAt),
          inArray(timeEntries.status, ["open", "anomaly"]),
        ),
      )
      .limit(1);
    if (openRows.length > 0) {
      throw new Error("Open time entry already exists");
    }

    let entryStatus: TimeEntryStatus = "open";
    if (parsed.shiftId) {
      const shiftRows = await db
        .select()
        .from(staffShifts)
        .where(and(eq(staffShifts.tenantId, tenantId), eq(staffShifts.id, parsed.shiftId)))
        .limit(1);
      const shift = shiftRows[0];
      if (shift) {
        const lateThreshold = new Date(shift.startAt.getTime() + shift.toleranceLateMin * 60_000);
        if (at > lateThreshold) {
          entryStatus = "anomaly";
        }
      }
    }

    const now = new Date();
    const inserted = await db
      .insert(timeEntries)
      .values({
        id: `te_${crypto.randomUUID()}`,
        tenantId,
        staffId: parsed.staffId,
        shiftId: parsed.shiftId ?? null,
        clockInAt: at,
        clockOutAt: null,
        status: entryStatus,
        source: timeEntrySourceSchema.parse(parsed.source),
        notes: null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    const row = inserted[0];
    return timeEntrySchema.parse({
      id: row.id,
      staffId: row.staffId,
      shiftId: row.shiftId ?? undefined,
      clockInAt: row.clockInAt.toISOString(),
      clockOutAt: null,
      status: timeEntryStatusSchema.parse(row.status),
      source: timeEntrySourceSchema.parse(row.source),
      notes: row.notes,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    });
  }

  async clockOut(payload: ClockOutRequest): Promise<TimeEntry> {
    const parsed = clockOutRequestSchema.parse(payload);
    const tenantId = getTenantIdOrDefault();

    const rows = await db
      .select()
      .from(timeEntries)
      .where(
        and(
          eq(timeEntries.tenantId, tenantId),
          eq(timeEntries.staffId, parsed.staffId),
          isNull(timeEntries.clockOutAt),
          inArray(timeEntries.status, ["open", "anomaly"]),
        ),
      )
      .orderBy(desc(timeEntries.clockInAt))
      .limit(1);
    const open = rows[0];
    if (!open) {
      throw new Error("No open time entry");
    }

    const updated = await db
      .update(timeEntries)
      .set({
        clockOutAt: new Date(parsed.at),
        status: "closed",
        updatedAt: new Date(),
      })
      .where(and(eq(timeEntries.tenantId, tenantId), eq(timeEntries.id, open.id)))
      .returning();

    const row = updated[0];
    return timeEntrySchema.parse({
      id: row.id,
      staffId: row.staffId,
      shiftId: row.shiftId ?? undefined,
      clockInAt: row.clockInAt.toISOString(),
      clockOutAt: row.clockOutAt ? row.clockOutAt.toISOString() : null,
      status: timeEntryStatusSchema.parse(row.status),
      source: timeEntrySourceSchema.parse(row.source),
      notes: row.notes,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    });
  }

  // ─── Time Report ─────────────────────────────────────────────────────

  async timeReport(query: TimeReportQuery): Promise<TimeReportResponse> {
    const parsed = timeReportQuerySchema.parse(query);
    const tenantId = getTenantIdOrDefault();
    const conditions: SQL[] = [
      eq(timeEntries.tenantId, tenantId),
      gte(timeEntries.clockInAt, new Date(parsed.from)),
      lte(timeEntries.clockInAt, new Date(parsed.to)),
    ];
    if (parsed.staffId) {
      conditions.push(eq(timeEntries.staffId, parsed.staffId));
    }

    const rows = await db
      .select()
      .from(timeEntries)
      .where(and(...conditions))
      .orderBy(desc(timeEntries.clockInAt));

    const entries = rows
      .filter((row) => row.clockOutAt)
      .map((row) => {
        const minutes = Math.max(0, Math.round((row.clockOutAt!.getTime() - row.clockInAt.getTime()) / 60000));
        return {
          staffId: row.staffId,
          minutes,
          date: row.clockInAt.toISOString().slice(0, 10),
          anomaly: row.status === "anomaly",
        };
      });

    const totalMinutes = entries.reduce((sum, entry) => sum + entry.minutes, 0);
    return timeReportResponseSchema.parse({
      totalMinutes,
      totalHours: Number((totalMinutes / 60).toFixed(2)),
      entries,
    });
  }
}

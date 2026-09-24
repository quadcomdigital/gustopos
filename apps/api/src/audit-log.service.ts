import { Injectable, Logger } from "@nestjs/common";
import { getTenantContext } from "./tenant/tenant-context.store";

type AuditEvent =
  | "auth.login.success"
  | "auth.login.failed"
  | "auth.logout"
  | "staff.pin.reset"
  | "staff.disabled"
  | "staff.enabled"
  | "table.close"
  | "table.split.persisted"
  | "table.split.share_paid"
  | "table.pay_items"
  | "table.transfer"
  | "table.merge"
  | "table.suspend"
  | "table.resume"
  | "table.updated"
  | "table.deleted"
  | "payment.refund"
  | "order.void"
  | "reservation.created"
  | "reservation.updated"
  | "reservation.confirmed"
  | "reservation.cancelled"
  | "reservation.no_show"
  | "delivery.upserted"
  | "delivery.status.updated"
  | "delivery.dispatched" | "print_bridge.first_bind" | "print_bridge.onboarding_secret.created" | "print_bridge.onboarding_secret.revoked" | "print_bridge.deleted" | "fiscal.export.retried" | "timeclock.entry.resolved";

interface AuditPayload {
  actorStaffId?: string;
  targetId?: string;
  details?: Record<string, unknown>;
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  log(event: AuditEvent, payload: AuditPayload = {}): void {
    const tenantContext = getTenantContext();
    const entry = {
      ts: new Date().toISOString(),
      level: "audit",
      event,
      tenantId: tenantContext?.tenantId ?? null,
      tenantSlug: tenantContext?.tenantSlug ?? null,
      processId: process.pid,
      actorStaffId: payload.actorStaffId ?? null,
      targetId: payload.targetId ?? null,
      details: payload.details ?? {},
    };

    this.logger.log(JSON.stringify(entry));
  }
}

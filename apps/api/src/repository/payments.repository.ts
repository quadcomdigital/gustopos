import { Injectable } from "@nestjs/common";
import { and, desc, eq, gte, lte, SQL } from "drizzle-orm";
import { db, withTenantTx } from "../db/client";
import { payments } from "../db/schema";
import { getTenantIdOrDefault } from "../tenant/tenant-context.store";
import {
  paymentFiltersSchema,
  paymentsListResponseSchema,
  refundPaymentRequestSchema,
  refundPaymentResponseSchema,
  type PaymentFilters,
  type PaymentStatus,
  type PaymentsListResponse,
  type RefundPaymentRequest,
  type RefundPaymentResponse,
} from "@gustopos/shared";

@Injectable()
export class PaymentsRepository {
  async listPayments(filters: PaymentFilters): Promise<PaymentsListResponse> {
    const parsed = paymentFiltersSchema.parse(filters);
    const tenantId = getTenantIdOrDefault();
    const conditions: SQL[] = [];

    conditions.push(eq(payments.tenantId, tenantId));

    if (parsed.from) {
      conditions.push(gte(payments.createdAt, new Date(parsed.from)));
    }

    if (parsed.to) {
      conditions.push(lte(payments.createdAt, new Date(parsed.to)));
    }

    if (parsed.method) {
      conditions.push(eq(payments.method, parsed.method));
    }

    if (parsed.staffId) {
      conditions.push(eq(payments.staffId, parsed.staffId));
    }

    if (parsed.kind) {
      conditions.push(eq(payments.kind, parsed.kind));
    }

    const baseQuery = db
      .select()
      .from(payments)
      .orderBy(desc(payments.createdAt))
      .limit(parsed.limit ?? 100);

    const rows =
      conditions.length > 0
        ? await baseQuery.where(and(...conditions))
        : await baseQuery;

    return paymentsListResponseSchema.parse(
      rows.map((row) => ({
        id: row.id,
        tableId: row.tableId,
        tableNumber: row.tableNumber,
        subtotal: Number(row.subtotal),
        discountAmount: Number(row.discountAmount),
        surchargeAmount: Number(row.surchargeAmount),
        total: Number(row.total),
        method: row.method,
        kind: row.kind as "sale" | "refund",
        paymentStatus: row.paymentStatus as PaymentStatus,
        paidAmount: Number(row.paidAmount),
        changeAmount: Number(row.changeAmount),
        reference: row.reference ?? undefined,
        gatewayReference: row.gatewayReference ?? undefined,
        capturedAt: row.capturedAt?.toISOString(),
        refundedPaymentId: row.refundedPaymentId ?? undefined,
        refundReason: row.refundReason ?? undefined,
        notes: row.notes ?? undefined,
        staffId: row.staffId,
        createdAt: row.createdAt.toISOString(),
      })),
    );
  }

  async refundPayment(
    paymentId: string,
    payload: RefundPaymentRequest,
    actorStaffId: string,
  ): Promise<RefundPaymentResponse | null> {
    const parsed = refundPaymentRequestSchema.parse(payload);
    const tenantId = getTenantIdOrDefault();

    return withTenantTx(async (tx) => {
      const paymentRows = await tx
        .select()
        .from(payments)
        .where(and(eq(payments.tenantId, tenantId), eq(payments.id, paymentId)))
        .limit(1);
      const original = paymentRows[0];
      if (!original) {
        return null;
      }

      if (original.kind !== "sale") {
        throw new Error("Only sale payments can be refunded");
      }

      const previousRefundRows = await tx
        .select()
        .from(payments)
        .where(and(eq(payments.tenantId, tenantId), eq(payments.refundedPaymentId, paymentId), eq(payments.kind, "refund")));

      const originalTotal = Number(original.total);
      const alreadyRefunded = previousRefundRows.reduce((sum, row) => sum + Number(row.total), 0);
      const remainingBefore = Number((originalTotal - alreadyRefunded).toFixed(2));
      if (remainingBefore <= 0) {
        throw new Error("Payment already fully refunded");
      }

      const requestedAmount = parsed.amount ?? remainingBefore;
      const refundAmount = Number(requestedAmount.toFixed(2));

      if (refundAmount <= 0) {
        throw new Error("Refund amount must be greater than zero");
      }

      if (refundAmount > remainingBefore) {
        throw new Error("Refund amount exceeds refundable balance");
      }

      const remainingAfter = Number((remainingBefore - refundAmount).toFixed(2));

      const [refundRow] = await tx
        .insert(payments)
        .values({
          id: `ref_${Date.now().toString(36)}`,
          tenantId,
          tableId: original.tableId,
          tableNumber: original.tableNumber,
          subtotal: String(refundAmount),
          discountAmount: "0",
          surchargeAmount: "0",
          total: String(refundAmount),
          method: original.method,
          kind: "refund",
          paymentStatus: "captured",
          paidAmount: "0",
          changeAmount: "0",
          reference: original.reference ?? `refund:${paymentId}`,
          gatewayReference: original.gatewayReference ?? null,
          capturedAt: new Date(),
          refundedPaymentId: paymentId,
          refundReason: parsed.reason,
          notes: parsed.notes ?? null,
          staffId: actorStaffId,
          createdAt: new Date(),
        })
        .returning();

      return refundPaymentResponseSchema.parse({
        success: true,
        payment: {
          id: refundRow.id,
          tableId: refundRow.tableId,
          tableNumber: refundRow.tableNumber,
          subtotal: Number(refundRow.subtotal),
          discountAmount: Number(refundRow.discountAmount),
          surchargeAmount: Number(refundRow.surchargeAmount),
          total: Number(refundRow.total),
          method: refundRow.method,
          kind: refundRow.kind as "sale" | "refund",
          paymentStatus: refundRow.paymentStatus as PaymentStatus,
          paidAmount: Number(refundRow.paidAmount),
          changeAmount: Number(refundRow.changeAmount),
          reference: refundRow.reference ?? undefined,
          gatewayReference: refundRow.gatewayReference ?? undefined,
          capturedAt: refundRow.capturedAt?.toISOString(),
          refundedPaymentId: refundRow.refundedPaymentId ?? undefined,
          refundReason: refundRow.refundReason ?? undefined,
          notes: refundRow.notes ?? undefined,
          staffId: refundRow.staffId,
          createdAt: refundRow.createdAt.toISOString(),
        },
        refundedAmount: refundAmount,
        remainingAmount: remainingAfter,
      });
    });
  }
}

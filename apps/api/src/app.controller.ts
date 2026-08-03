import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Throttle } from "@nestjs/throttler";
import {
  closeTableRequestSchema,
  createOrderRequestSchema,
  ingredientCreateRequestSchema,
  ingredientUpdateRequestSchema,
  ingredientAdjustRequestSchema,
  stockMovementsQuerySchema,
  categoryCreateRequestSchema,
  categoryUpdateRequestSchema,
  categoryModifierPoolCreateRequestSchema,
  categoryModifierPoolUpdateRequestSchema,
  customerCreateRequestSchema,
  customerUpdateRequestSchema,
  customerAddressCreateRequestSchema,
  customerAddressUpdateRequestSchema,
  customersQuerySchema,
  customerAnalyticsRequestSchema,
  operationalSummaryQuerySchema,
  refundPaymentRequestSchema,
  orderHistoryFiltersSchema,
  dispatchPrintJobRequestSchema,
  printJobsQuerySchema,
  printJobsPollQuerySchema,
  printBridgeHeartbeatRequestSchema,
  printBridgeClaimRequestSchema,
  printBridgeJobCompleteRequestSchema,
  printBridgeJobFailRequestSchema,
  printBridgeOnboardingSecretCreateRequestSchema,
  printBridgeOnboardingSecretCreateCode6DigitResponseSchema,
  printBridgeUpdateMappingsRequestSchema,
  printBridgeUpdateClaimedAreasRequestSchema,
  printBridgeTestPrintRequestSchema,
  type PrintBridgeOnboardingSecret,
  type PrintBridgeOnboardingSecretCreateRequest,
  type PrintBridgeOnboardingSecretCreateCode6DigitResponse,
  type PrintBridgeOnboardingSecretCreateResponse,
  type PrintBridgeUpdateMappingsRequest,
  type PrintBridgeUpdateClaimedAreasRequest,
  type PrintBridgeTestPrintRequest,
  type PrintBridgeTestPrintResponse,
  publicFunnelEventRequestSchema,
  publicFunnelEventResponseSchema,
  publicTakeawayCreateRequestSchema,
  publicTakeawayTrackingResponseSchema,
  groupOrderCreateSessionRequestSchema,
  groupOrderCreateSessionResponseSchema,
  groupOrderJoinSessionRequestSchema,
  groupOrderJoinSessionResponseSchema,
  groupOrderPatchCartRequestSchema,
  groupOrderPatchCartResponseSchema,
  groupOrderSubmitRequestSchema,
  groupOrderSubmitResponseSchema,
  selfOrderCreateRequestSchema,
  reservationsQuerySchema,
  reservationCreateRequestSchema,
  reservationNoShowRequestSchema,
  reservationUpdateRequestSchema,
  deliveryOrdersQuerySchema,
  deliveryUpsertRequestSchema,
  deliveryStatusUpdateRequestSchema,
  suppliersQuerySchema,
  supplierCreateRequestSchema,
  supplierUpdateRequestSchema,
  supplierIngredientCreateSchema,
  supplierIngredientUpdateSchema,
  purchaseOrdersQuerySchema,
  purchaseOrderCreateRequestSchema,
  purchaseOrderStatusUpdateRequestSchema,
  goodsReceiptCreateRequestSchema,
  shiftsQuerySchema,
  shiftCreateRequestSchema,
  shiftUpdateRequestSchema,
  clockInRequestSchema,
  clockOutRequestSchema,
  timeReportQuerySchema,
  fiscalCloseRequestSchema,
  fiscalExportCreateRequestSchema,
  fiscalExportsQuerySchema,
  fiscalPrinterConfigUpdateRequestSchema,
  fiscalJobsQuerySchema,
  fiscalBridgeClaimRequestSchema,
  fiscalChiusuraRequestSchema,
  prepItemCreateRequestSchema,
  prepItemUpdateRequestSchema,
  unitConversionCreateRequestSchema,
  updateUiSettingsRequestSchema,
  updatePrintingSettingsRequestSchema,
  printLogoUploadResponseSchema,
  menuItemCreateRequestSchema,
  canonicalCreateMenuProductRequestSchema,
  menuItemUpdateRequestSchema,
  socketEvents,
  splitBillRequestSchema,
  paySelectedItemsRequestSchema,
  markShareAsPaidRequestSchema,
  transferTableRequestSchema,
  loyaltyRedeemRequestSchema,
  loyaltyEarnRequestSchema,
  couponCreateRequestSchema,
  couponValidateRequestSchema,
  type CouponCreateRequest,
  type CouponValidateRequest,
  type CouponValidateResponse,
  type PaymentFilters,
  type VoidOrderRequest,
  type VoidOrderResponse,
  type CloseTableRequest,
  type CreateOrderRequest,
  type IngredientCreateRequest,
  type IngredientUpdateRequest,
  type IngredientAdjustRequest,
  type Category,
  type CategoryCreateRequest,
  type CategoryUpdateRequest,
  type CategoryModifierPoolCreateRequest,
  type CategoryModifierPoolUpdateRequest,
  type Customer,
  type CustomerCreateRequest,
  type CustomerUpdateRequest,
  type CustomerAddressCreateRequest,
  type CustomerAddressUpdateRequest,
  type CustomersQuery,
  type CustomerAnalytics,
  type CustomerAnalyticsRequest,
  type OperationalSummaryQuery,
  type ReservationsSummary,
  type DeliverySummary,
  type RefundPaymentRequest,
  type RefundPaymentResponse,
  type DispatchPrintJobRequest,
  type Reservation,
  type ReservationsQuery,
  type ReservationNoShowRequest,
  type ReservationCreateRequest,
  type ReservationUpdateRequest,
  type DeliveryOrder,
  type DeliveryOrdersQuery,
  type DeliveryUpsertRequest,
  type DeliveryStatusUpdateRequest,
  type Supplier,
  type SuppliersQuery,
  type SupplierCreateRequest,
  type SupplierUpdateRequest,
  type SupplierIngredient,
  type PurchaseOrder,
  type PurchaseOrdersQuery,
  type PurchaseOrderCreateRequest,
  type PurchaseOrderStatusUpdateRequest,
  type GoodsReceipt,
  type GoodsReceiptCreateRequest,
  type Shift,
  type ShiftsQuery,
  type ShiftCreateRequest,
  type ShiftUpdateRequest,
  type TimeEntry,
  type ClockInRequest,
  type ClockOutRequest,
  type TimeReportQuery,
  type TimeReportResponse,
  type FiscalClosure,
  type FiscalCloseRequest,
  type FiscalPrinterConfig,
  type FiscalPrinterConfigUpdateRequest,
  type FiscalJob,
  type FiscalBridgeJobCompleteRequest,
  type FiscalBridgeJobFailRequest,
  type FiscalChiusuraRequest,
  type FiscalExport,
  type FiscalExportCreateRequest,
  type FiscalExportsQuery,
  type PrintArea,
  type PrintJob,
  type PrintJobsQuery,
  type PrintBridge,
  type PrintBridgeHeartbeatRequest,
  type PrintBridgeClaimRequest,
  type PrintBridgeJobCompleteRequest,
  type PrintBridgeJobFailRequest,
  type PublicFunnelEventRequest,
  type PublicFunnelEventResponse,
  type PublicTakeawayCreateRequest,
  type PublicTakeawayCreateResponse,
  type PublicTakeawayTrackingResponse,
  type GroupOrderCreateSessionRequest,
  type GroupOrderCreateSessionResponse,
  type GroupOrderJoinSessionRequest,
  type GroupOrderJoinSessionResponse,
  type GroupOrderPatchCartRequest,
  type GroupOrderPatchCartResponse,
  type GroupOrderSubmitRequest,
  type GroupOrderSubmitResponse,
  type SelfOrderCreateRequest,
  type SelfOrderCreateResponse,
  type SelfOrderResolveResponse,
  type SelfOrderSessionRotateResponse,
  type OrderHistoryFilters,
  type UiSettings,
  type UpdateUiSettingsRequest,
  type UpdatePrintingSettingsRequest,
  type MenuItemCreateRequest,
  type CanonicalCreateMenuProductRequest,
  type MenuItemUpdateRequest,
  type PrepItemCreateRequest,
  type PrepItemUpdateRequest,
  type Order,
  type SplitBillRequest,
  type PaySelectedItemsRequest,
  type MarkShareAsPaidRequest,
  type TransferTableRequest,
  updateOrderItemQuantityRequestSchema,
  type UpdateOrderItemQuantityRequest,
  type UpdateOrderRequest,
  type LoyaltyBalance,
  type LoyaltyTransaction,
  type LoyaltyEarnRequest,
  type LoyaltyRedeemRequest,
  type Table,
} from "@gustopos/shared";
import { RealtimeGateway } from "./realtime.gateway";
import { AppRepository } from "./repository/app.repository";
import { StaffRepository } from "./repository/staff.repository";
import { ShiftsRepository } from "./repository/shifts.repository";
import { SuppliersRepository } from "./repository/suppliers.repository";
import { InventoryRepository } from "./repository/inventory.repository";
import { TablesRepository } from "./repository/tables.repository";
import { LoyaltyRepository } from "./repository/loyalty.repository";
import { ConsumerRepository } from "./repository/consumer.repository";
import { FiscalRepository } from "./repository/fiscal.repository";
import { FiscalBridgeRepository } from "./repository/fiscal-bridge.repository";
import { SimpleCatalogRepository } from "./repository/simple-catalog.repository";
import { CustomerRepository } from "./repository/customer.repository";
import { PaymentsRepository } from "./repository/payments.repository";
import { PrintJobsRepository } from "./repository/print-jobs.repository";
import { PrintBridgeRepository } from "./repository/print-bridge.repository";
import { JwtAuthGuard } from "./auth/jwt-auth.guard";
import { PermissionsGuard } from "./auth/permissions.guard";
import { RequiresPermissions } from "./auth/permissions.decorator";
import { RolesGuard } from "./auth/roles.guard";
import { Roles } from "./auth/roles.decorator";
import { Public } from "./auth/public.decorator";
import type { AuthenticatedRequest } from "./auth/auth-request.type";
import { AuditLogService } from "./audit-log.service";
import { imageBufferToLogoRaster, LOGO_IMAGE_MIME_TYPES, LOGO_MAX_BYTES, sniffImageType } from "./repository/utils/logo-raster";
import { FeatureFlagGuard } from "./tenant/feature-flag.guard";
import { RequiresModule } from "./tenant/requires-module.decorator";
import type { Response } from "express";
import jwt from "jsonwebtoken";
import { getJwtSecret } from "./auth/jwt-secret";
import type { JwtPayload } from "./auth/jwt.types";
import { TenantService } from "./tenant/tenant.service";
import { runWithBridgeAuthContext, runWithTenantContext } from "./tenant/tenant-context.store";
import type { ModuleKey } from "@gustopos/shared";

@Controller("api")
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard, FeatureFlagGuard)
export class AppController {
  private readonly jwtSecret = getJwtSecret();

  constructor(
    @Inject(RealtimeGateway) private readonly realtimeGateway: RealtimeGateway,
    @Inject(AppRepository) private readonly appRepository: AppRepository,
    @Inject(StaffRepository) private readonly staffRepo: StaffRepository,
    @Inject(ShiftsRepository) private readonly shiftsRepo: ShiftsRepository,
    @Inject(SuppliersRepository) private readonly suppliersRepo: SuppliersRepository,
    @Inject(InventoryRepository) private readonly inventoryRepo: InventoryRepository,
    @Inject(TablesRepository) private readonly tablesRepo: TablesRepository,
    @Inject(LoyaltyRepository) private readonly loyaltyRepo: LoyaltyRepository,
    @Inject(ConsumerRepository) private readonly consumerRepo: ConsumerRepository,
    @Inject(FiscalRepository) private readonly fiscalRepo: FiscalRepository,
    @Inject(SimpleCatalogRepository) private readonly simpleCatalogRepo: SimpleCatalogRepository,
    @Inject(CustomerRepository) private readonly customerRepo: CustomerRepository,
    @Inject(PaymentsRepository) private readonly paymentsRepo: PaymentsRepository,
    @Inject(PrintJobsRepository) private readonly printJobsRepo: PrintJobsRepository,
    @Inject(PrintBridgeRepository) private readonly printBridgeRepo: PrintBridgeRepository,
    @Inject(FiscalBridgeRepository) private readonly fiscalBridgeRepo: FiscalBridgeRepository,
    @Inject(AuditLogService) private readonly auditLogService: AuditLogService,
    @Inject(TenantService) private readonly tenantService: TenantService,
  ) {}

  /**
   * Post-commit realtime sync for tables. Runs listTables() AFTER the DB
   * mutation has already committed; a failure here must never fail the
   * request (the mutation is already persisted), so it is best-effort.
   */
  private async listTablesForRealtime(): Promise<Table[] | null> {
    try {
      return await this.tablesRepo.listTables();
    } catch (err) {
      console.warn("[realtime] listTables failed, skipping tables:update:", err);
      return null;
    }
  }

  private async emitTablesUpdateSafely(): Promise<void> {
    const tables = await this.listTablesForRealtime();
    if (tables) {
      await this.realtimeGateway.emit(socketEvents.tablesUpdate, tables);
    }
  }

  private async resolveConsumerUserId(request: AuthenticatedRequest, tenantId: string): Promise<string | null> {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return null;
    }

    try {
      const token = authHeader.slice("Bearer ".length);
      const payload = jwt.verify(token, this.jwtSecret) as JwtPayload;
      if (payload.tokenType !== "consumer_access" || !payload.sessionId || !payload.sub || !payload.tenantId) {
        return null;
      }

      if (payload.tenantId !== tenantId) {
        throw new UnauthorizedException("Consumer tenant mismatch");
      }

      const activeSession = await this.consumerRepo.findActiveConsumerSessionById(payload.sessionId, payload.sub);
      if (!activeSession || activeSession.tenantId !== tenantId) {
        throw new UnauthorizedException("Consumer session expired or revoked");
      }

      return payload.sub;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      return null;
    }
  }

  @Get("data")
  @Roles("admin", "waiter", "chef")
  @RequiresModule("kitchen")
  getData() {
    return this.appRepository.getPublicData();
  }

  @Get("bootstrap")
  @Roles("admin", "waiter", "chef")
  getBootstrap(@Query() query: { modules?: string }, @Req() request: AuthenticatedRequest) {
    const enabledModules = query.modules ? query.modules.split(',') : [];
    // C4: bootstrap per-dominio — l'API restituisce solo i domini accessibili al
    // ruolo; i domini admin vengono caricati lazy alla prima apertura della view.
    return this.appRepository.getBootstrapData(enabledModules, request.user?.role);
  }

  @Get("payments")
  @Roles("admin")
  @RequiresModule("analytics")
  listPayments(@Query() query: Record<string, string | undefined>) {
    const filters: PaymentFilters = {
      from: query.from,
      to: query.to,
      method: query.method as PaymentFilters["method"],
      kind: query.kind as PaymentFilters["kind"],
      staffId: query.staffId,
      limit: query.limit ? Number(query.limit) : undefined,
    };

    return this.paymentsRepo.listPayments(filters);
  }

  @Post("payments/:id/refund")
  @Roles("admin")
  @RequiresPermissions("payments:refund")
  @RequiresModule("analytics")
  async refundPayment(
    @Param("id") id: string,
    @Body() payload: RefundPaymentRequest,
    @Req() request: AuthenticatedRequest,
  ): Promise<RefundPaymentResponse> {
    const actorStaffId = request.user?.sub;
    if (!actorStaffId) {
      throw new UnauthorizedException("Missing authenticated user");
    }

    const parsed = refundPaymentRequestSchema.parse(payload);
    let result;
    try {
      result = await this.paymentsRepo.refundPayment(id, parsed, actorStaffId);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : "Refund failed");
    }

    if (!result) {
      throw new NotFoundException("Payment not found");
    }

    this.auditLogService.log("payment.refund", {
      actorStaffId,
      targetId: id,
      details: {
        refundPaymentId: result.payment.id,
        refundedAmount: result.refundedAmount,
        remainingAmount: result.remainingAmount,
      },
    });

    return result;
  }

  @Get("orders/history")
  @Roles("admin")
  @RequiresModule("analytics")
  listOrderHistory(@Query() query: Record<string, string | undefined>) {
    const filters = orderHistoryFiltersSchema.parse({
      from: query.from,
      to: query.to,
      status: query.status,
      orderType: query.orderType,
      staffId: query.staffId,
      table: query.table,
      customerId: query.customerId,
      limit: query.limit ? Number(query.limit) : undefined,
    }) as OrderHistoryFilters;

    return this.appRepository.listOrderHistory(filters);
  }

  @Get("orders/:id")
  @Roles("admin")
  @RequiresModule("analytics")
  async getOrderById(@Param("id") id: string) {
    const order = await this.appRepository.getOrderByIdPublic(id);
    if (!order) {
      throw new NotFoundException("Order not found");
    }

    return order;
  }

  @Get("customers")
  @Roles("admin", "waiter")
  @RequiresPermissions("customers:view")
  @RequiresModule("customers")
  listCustomers(@Query() query: Record<string, string | undefined>) {
    const parsed = customersQuerySchema.parse({
      query: query.query,
      limit: query.limit ? Number(query.limit) : undefined,
    }) as CustomersQuery;
    return this.customerRepo.listCustomers(parsed);
  }

  @Post("customers")
  @Roles("admin", "waiter")
  @RequiresPermissions("customers:manage")
  @RequiresModule("customers")
  async createOrReuseCustomer(@Body() payload: CustomerCreateRequest): Promise<Customer> {
    const parsed = customerCreateRequestSchema.parse(payload);
    const row = await this.customerRepo.createOrReuseCustomer(parsed);
    const mapped = await this.customerRepo.getCustomerById(row.id);
    if (!mapped) {
      throw new NotFoundException("Customer not found");
    }
    return mapped;
  }

  @Get("customers/analytics-summary")
  @Roles("admin")
  @RequiresModule("analytics")
  getCustomerAnalytics(@Query() query: Record<string, string | undefined>): Promise<CustomerAnalytics> {
    const parsed = customerAnalyticsRequestSchema.parse({
      from: query.from,
      to: query.to,
    }) as CustomerAnalyticsRequest;
    return this.customerRepo.getCustomerAnalytics(parsed);
  }

  @Get("analytics/reservations-summary")
  @Roles("admin")
  @RequiresModule("reservations")
  reservationsSummary(@Query() query: Record<string, string | undefined>): Promise<ReservationsSummary> {
    const parsed = operationalSummaryQuerySchema.parse({
      from: query.from,
      to: query.to,
    }) as OperationalSummaryQuery;
    return this.tablesRepo.getReservationsSummary(parsed);
  }

  @Get("analytics/delivery-summary")
  @Roles("admin")
  @RequiresModule("delivery")
  deliverySummary(@Query() query: Record<string, string | undefined>): Promise<DeliverySummary> {
    const parsed = operationalSummaryQuerySchema.parse({
      from: query.from,
      to: query.to,
    }) as OperationalSummaryQuery;
    return this.tablesRepo.getDeliverySummary(parsed);
  }

  @Get("reservations")
  @Roles("admin", "waiter")
  @RequiresModule("reservations")
  listReservations(@Query() query: Record<string, string | undefined>): Promise<Reservation[]> {
    const parsed = reservationsQuerySchema.parse({
      from: query.from,
      to: query.to,
      status: query.status,
      limit: query.limit ? Number(query.limit) : undefined,
    }) as ReservationsQuery;
    return this.tablesRepo.listReservations(parsed);
  }

  @Post("reservations")
  @Roles("admin", "waiter")
  @RequiresPermissions("reservations:manage")
  @RequiresModule("reservations")
  createReservation(@Body() payload: ReservationCreateRequest): Promise<Reservation> {
    const parsed = reservationCreateRequestSchema.parse(payload);
    return this.tablesRepo.createReservation(parsed).then((reservation) => {
      this.auditLogService.log("reservation.created", {
        targetId: reservation.id,
        details: { status: reservation.status, reservedFor: reservation.reservedFor, partySize: reservation.partySize },
      });
      return reservation;
    });
  }

  @Patch("reservations/:id")
  @Roles("admin", "waiter")
  @RequiresPermissions("reservations:manage")
  @RequiresModule("reservations")
  async updateReservation(@Param("id") id: string, @Body() payload: ReservationUpdateRequest): Promise<Reservation> {
    const parsed = reservationUpdateRequestSchema.parse(payload);
    const updated = await this.tablesRepo.updateReservation(id, parsed);
    if (!updated) {
      throw new NotFoundException("Reservation not found");
    }
    this.auditLogService.log("reservation.updated", {
      targetId: id,
      details: { status: updated.status, payload: parsed },
    });
    return updated;
  }

  @Post("reservations/:id/confirm")
  @Roles("admin", "waiter")
  @RequiresPermissions("reservations:manage")
  @RequiresModule("reservations")
  async confirmReservation(@Param("id") id: string): Promise<Reservation> {
    const updated = await this.tablesRepo.updateReservation(id, { status: "confirmed" });
    if (!updated) {
      throw new NotFoundException("Reservation not found");
    }
    this.auditLogService.log("reservation.confirmed", {
      targetId: id,
      details: { status: updated.status },
    });
    return updated;
  }

  @Post("reservations/:id/cancel")
  @Roles("admin", "waiter")
  @RequiresPermissions("reservations:manage")
  @RequiresModule("reservations")
  async cancelReservation(@Param("id") id: string): Promise<Reservation> {
    const updated = await this.tablesRepo.updateReservation(id, { status: "cancelled" });
    if (!updated) {
      throw new NotFoundException("Reservation not found");
    }
    this.auditLogService.log("reservation.cancelled", {
      targetId: id,
      details: { status: updated.status },
    });
    return updated;
  }

  @Post("reservations/:id/no-show")
  @Roles("admin", "waiter")
  @RequiresPermissions("reservations:manage")
  @RequiresModule("reservations")
  async markReservationNoShow(
    @Param("id") id: string,
    @Body() payload: ReservationNoShowRequest,
  ): Promise<Reservation> {
    const parsed = reservationNoShowRequestSchema.parse(payload);
    // Persist the enumerated code; keep an optional free-text note alongside it
    // so reporting can group causes without losing operator detail.
    const noShowReason = parsed.note ? `${parsed.reason} — ${parsed.note}` : parsed.reason;
    const updated = await this.tablesRepo.updateReservation(id, { status: "no_show", noShowReason });
    if (!updated) {
      throw new NotFoundException("Reservation not found");
    }
    this.auditLogService.log("reservation.no_show", {
      targetId: id,
      details: { status: updated.status, reason: parsed.reason },
    });
    return updated;
  }

  @Get("delivery/orders")
  @Roles("admin", "waiter", "chef")
  @RequiresModule("delivery")
  listDeliveryOrders(@Query() query: Record<string, string | undefined>): Promise<DeliveryOrder[]> {
    const parsed = deliveryOrdersQuerySchema.parse({
      status: query.status,
      from: query.from,
      to: query.to,
      limit: query.limit ? Number(query.limit) : undefined,
    }) as DeliveryOrdersQuery;
    return this.tablesRepo.listDeliveryOrders(parsed);
  }

  @Post("delivery/orders/:orderId/upsert")
  @Roles("admin", "waiter")
  @RequiresPermissions("delivery:manage")
  @RequiresModule("delivery")
  async upsertDeliveryOrder(@Param("orderId") orderId: string, @Body() payload: DeliveryUpsertRequest): Promise<DeliveryOrder> {
    const parsed = deliveryUpsertRequestSchema.parse(payload);
    let deliveryOrder: DeliveryOrder;
    try {
      deliveryOrder = await this.tablesRepo.upsertDeliveryOrder(orderId, parsed);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Delivery upsert failed";
      if (message.includes("Delivery transition not allowed")) {
        throw new ConflictException(message);
      }
      throw new BadRequestException(message);
    }
    this.auditLogService.log("delivery.upserted", {
      targetId: orderId,
      details: { status: deliveryOrder.status, deliveryFee: deliveryOrder.deliveryFee },
    });
    return deliveryOrder;
  }

  @Patch("delivery/orders/:orderId/status")
  @Roles("admin", "waiter", "chef")
  @RequiresPermissions("delivery:manage")
  @RequiresModule("delivery")
  async updateDeliveryStatus(
    @Param("orderId") orderId: string,
    @Body() payload: DeliveryStatusUpdateRequest,
  ): Promise<DeliveryOrder> {
    const parsed = deliveryStatusUpdateRequestSchema.parse(payload);
    let updated: DeliveryOrder | null;
    try {
      updated = await this.tablesRepo.updateDeliveryStatus(orderId, parsed);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Delivery update failed";
      if (message.includes("Delivery transition not allowed")) {
        throw new ConflictException(message);
      }
      throw new BadRequestException(message);
    }
    if (!updated) {
      throw new NotFoundException("Delivery order not found");
    }
    this.auditLogService.log("delivery.status.updated", {
      targetId: orderId,
      details: { status: updated.status, payload: parsed },
    });
    return updated;
  }

  @Post("delivery/orders/:orderId/dispatch")
  @Roles("admin", "waiter")
  @RequiresPermissions("delivery:manage")
  @RequiresModule("delivery")
  async dispatchDeliveryOrder(@Param("orderId") orderId: string): Promise<DeliveryOrder> {
    let updated: DeliveryOrder | null;
    try {
      updated = await this.tablesRepo.updateDeliveryStatus(orderId, { status: "out_for_delivery" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Delivery dispatch failed";
      if (message.includes("Delivery transition not allowed")) {
        throw new ConflictException(message);
      }
      throw new BadRequestException(message);
    }
    if (!updated) {
      throw new NotFoundException("Delivery order not found");
    }
    this.auditLogService.log("delivery.dispatched", {
      targetId: orderId,
      details: { status: updated.status },
    });
    return updated;
  }

  @Get("purchasing/suppliers")
  @RequiresPermissions("purchasing:manage")
  @Roles("admin")
  @RequiresModule("purchasing_suppliers")
  listSuppliers(@Query() query: Record<string, string | undefined>): Promise<Supplier[]> {
    const parsed = suppliersQuerySchema.parse({
      active: query.active === undefined ? undefined : query.active === "true",
      query: query.query,
      limit: query.limit ? Number(query.limit) : undefined,
    }) as SuppliersQuery;
    return this.suppliersRepo.listSuppliers(parsed);
  }

  @Post("purchasing/suppliers")
  @RequiresPermissions("purchasing:manage")
  @Roles("admin")
  @RequiresModule("purchasing_suppliers")
  createSupplier(@Body() payload: SupplierCreateRequest): Promise<Supplier> {
    const parsed = supplierCreateRequestSchema.parse(payload);
    return this.suppliersRepo.createSupplier(parsed);
  }

  @Patch("purchasing/suppliers/:id")
  @RequiresPermissions("purchasing:manage")
  @Roles("admin")
  @RequiresModule("purchasing_suppliers")
  async updateSupplier(@Param("id") id: string, @Body() payload: SupplierUpdateRequest): Promise<Supplier> {
    const parsed = supplierUpdateRequestSchema.parse(payload);
    const updated = await this.suppliersRepo.updateSupplier(id, parsed);
    if (!updated) {
      throw new NotFoundException("Supplier not found");
    }
    return updated;
  }

  @Get("purchasing/suppliers/:supplierId/ingredients")
  @RequiresPermissions("purchasing:manage")
  @Roles("admin")
  @RequiresModule("purchasing_suppliers")
  listSupplierIngredients(@Param("supplierId") supplierId: string): Promise<SupplierIngredient[]> {
    return this.suppliersRepo.listSupplierIngredients(supplierId);
  }

  @Get("purchasing/ingredients/:ingredientId/suppliers")
  @RequiresPermissions("purchasing:manage")
  @Roles("admin")
  @RequiresModule("purchasing_suppliers")
  listIngredientSuppliers(@Param("ingredientId") ingredientId: string): Promise<SupplierIngredient[]> {
    return this.suppliersRepo.listSupplierIngredients(undefined, ingredientId);
  }

  @Post("purchasing/supplier-ingredients")
  @RequiresPermissions("purchasing:manage")
  @Roles("admin")
  @RequiresModule("purchasing_suppliers")
  async createSupplierIngredient(@Body() payload: { supplierId: string; ingredientId: string; brandName?: string; unitCost?: number; isPreferred?: boolean }): Promise<void> {
    await this.suppliersRepo.createSupplierIngredient(payload);
  }

  @Patch("purchasing/supplier-ingredients/:supplierId/:ingredientId")
  @RequiresPermissions("purchasing:manage")
  @Roles("admin")
  @RequiresModule("purchasing_suppliers")
  async updateSupplierIngredient(
    @Param("supplierId") supplierId: string,
    @Param("ingredientId") ingredientId: string,
    @Body() payload: { brandName?: string; unitCost?: number; isPreferred?: boolean },
  ): Promise<void> {
    await this.suppliersRepo.updateSupplierIngredient(supplierId, ingredientId, payload);
  }

  @Delete("purchasing/supplier-ingredients/:supplierId/:ingredientId")
  @RequiresPermissions("purchasing:manage")
  @Roles("admin")
  @RequiresModule("purchasing_suppliers")
  async deleteSupplierIngredient(
    @Param("supplierId") supplierId: string,
    @Param("ingredientId") ingredientId: string,
  ): Promise<void> {
    await this.suppliersRepo.deleteSupplierIngredient(supplierId, ingredientId);
  }

  @Get("purchasing/suppliers/:id/po-items")
  @RequiresPermissions("purchasing:manage")
  @Roles("admin")
  @RequiresModule("purchasing_suppliers")
  getSupplierPoItems(@Param("id") id: string) {
    return this.suppliersRepo.getSupplierIngredientsForPo(id);
  }

  @Get("purchasing/orders")
  @RequiresPermissions("purchasing:manage")
  @Roles("admin")
  @RequiresModule("purchasing_suppliers")
  listPurchaseOrders(@Query() query: Record<string, string | undefined>): Promise<PurchaseOrder[]> {
    const parsed = purchaseOrdersQuerySchema.parse({
      supplierId: query.supplierId,
      status: query.status,
      from: query.from,
      to: query.to,
      limit: query.limit ? Number(query.limit) : undefined,
    }) as PurchaseOrdersQuery;
    return this.suppliersRepo.listPurchaseOrders(parsed);
  }

  @Post("purchasing/orders")
  @RequiresPermissions("purchasing:manage")
  @Roles("admin")
  @RequiresModule("purchasing_suppliers")
  createPurchaseOrder(@Body() payload: PurchaseOrderCreateRequest): Promise<PurchaseOrder> {
    const parsed = purchaseOrderCreateRequestSchema.parse(payload);
    return this.suppliersRepo.createPurchaseOrder(parsed);
  }

  @Patch("purchasing/orders/:id/status")
  @RequiresPermissions("purchasing:manage")
  @Roles("admin")
  @RequiresModule("purchasing_suppliers")
  async updatePurchaseOrderStatus(
    @Param("id") id: string,
    @Body() payload: PurchaseOrderStatusUpdateRequest,
  ): Promise<PurchaseOrder> {
    const parsed = purchaseOrderStatusUpdateRequestSchema.parse(payload);
    let updated: PurchaseOrder | null = null;
    try {
      updated = await this.suppliersRepo.updatePurchaseOrderStatus(id, parsed);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid purchase order transition";
      throw new BadRequestException(message);
    }
    if (!updated) {
      throw new NotFoundException("Purchase order not found");
    }
    return updated;
  }

  @Post("purchasing/orders/:id/receipts")
  @RequiresPermissions("purchasing:manage")
  @Roles("admin")
  @RequiresModule("purchasing_suppliers")
  async createGoodsReceipt(
    @Param("id") id: string,
    @Body() payload: GoodsReceiptCreateRequest,
    @Req() request: AuthenticatedRequest,
  ): Promise<GoodsReceipt> {
    const parsed = goodsReceiptCreateRequestSchema.parse(payload);
    const actorStaffId = request.user?.sub;
    try {
      return await this.suppliersRepo.createGoodsReceipt(id, parsed, actorStaffId);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : "Invalid goods receipt");
    }
  }

  @Get("shifts")
  @Roles("admin")
  @RequiresModule("staff_shifts_timeclock")
  listShifts(@Query() query: Record<string, string | undefined>): Promise<Shift[]> {
    const parsed = shiftsQuerySchema.parse({
      staffId: query.staffId,
      from: query.from,
      to: query.to,
      status: query.status,
      limit: query.limit ? Number(query.limit) : undefined,
    }) as ShiftsQuery;
    return this.shiftsRepo.listShifts(parsed);
  }

  @Post("shifts")
  @RequiresPermissions("shifts:manage")
  @Roles("admin")
  @RequiresModule("staff_shifts_timeclock")
  createShift(@Body() payload: ShiftCreateRequest): Promise<Shift> {
    const parsed = shiftCreateRequestSchema.parse(payload);
    return this.shiftsRepo.createShift(parsed);
  }

  @Patch("shifts/:id")
  @RequiresPermissions("shifts:manage")
  @Roles("admin")
  @RequiresModule("staff_shifts_timeclock")
  async updateShift(@Param("id") id: string, @Body() payload: ShiftUpdateRequest): Promise<Shift> {
    const parsed = shiftUpdateRequestSchema.parse(payload);
    const updated = await this.shiftsRepo.updateShift(id, parsed);
    if (!updated) {
      throw new NotFoundException("Shift not found");
    }
    return updated;
  }

  @Post("timeclock/in")
  @Roles("admin", "waiter", "chef")
  @RequiresModule("staff_shifts_timeclock")
  async clockIn(@Body() payload: ClockInRequest, @Req() request: AuthenticatedRequest): Promise<TimeEntry> {
    const parsed = clockInRequestSchema.parse(payload);
    const actorStaffId = request.user?.sub;
    const role = request.user?.role;
    if (!actorStaffId) {
      throw new UnauthorizedException("Missing authenticated user");
    }

    const resolved = role === "admin" ? parsed : { ...parsed, staffId: actorStaffId };
    try {
      return await this.shiftsRepo.clockIn(resolved);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Clock-in failed";
      if (message.includes("already exists")) {
        throw new ConflictException(message);
      }
      throw new BadRequestException(message);
    }
  }

  @Post("timeclock/out")
  @Roles("admin", "waiter", "chef")
  @RequiresModule("staff_shifts_timeclock")
  async clockOut(@Body() payload: ClockOutRequest, @Req() request: AuthenticatedRequest): Promise<TimeEntry> {
    const parsed = clockOutRequestSchema.parse(payload);
    const actorStaffId = request.user?.sub;
    const role = request.user?.role;
    if (!actorStaffId) {
      throw new UnauthorizedException("Missing authenticated user");
    }

    const resolved = role === "admin" ? parsed : { ...parsed, staffId: actorStaffId };
    try {
      return await this.shiftsRepo.clockOut(resolved);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Clock-out failed";
      if (message.includes("No open time entry")) {
        throw new ConflictException(message);
      }
      throw new BadRequestException(message);
    }
  }

  @Post("timeclock/entries/:id/resolve")
  @Roles("admin")
  @RequiresPermissions("shifts:manage")
  @RequiresModule("staff_shifts_timeclock")
  async resolveTimeEntry(@Param("id") id: string, @Req() request: AuthenticatedRequest): Promise<TimeEntry> {
    const actorStaffId = request.user?.sub;
    let resolved: TimeEntry | null;
    try {
      resolved = await this.shiftsRepo.resolveTimeEntry(id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Entry resolve failed";
      if (message.includes("Only open or anomaly entries")) {
        throw new ConflictException(message);
      }
      throw new BadRequestException(message);
    }
    if (!resolved) {
      throw new NotFoundException("Time entry not found");
    }
    this.auditLogService.log("timeclock.entry.resolved", {
      actorStaffId,
      targetId: id,
      details: { status: resolved.status },
    });
    return resolved;
  }

  @Get("timeclock/report")
  @Roles("admin")
  @RequiresModule("staff_shifts_timeclock")
  timeReport(@Query() query: Record<string, string | undefined>): Promise<TimeReportResponse> {
    const parsed = timeReportQuerySchema.parse({
      from: query.from,
      to: query.to,
      staffId: query.staffId,
    }) as TimeReportQuery;
    return this.fiscalRepo.timeReport(parsed);
  }

  @Post("fiscal/close-day")
  @Roles("admin")
  @RequiresPermissions("fiscal:close")
  @RequiresModule("fiscal_exports")
  async closeFiscalDay(@Body() payload: FiscalCloseRequest, @Req() request: AuthenticatedRequest): Promise<FiscalClosure> {
    const parsed = fiscalCloseRequestSchema.parse(payload);
    const actorStaffId = request.user?.sub;
    if (!actorStaffId) {
      throw new UnauthorizedException("Missing authenticated user");
    }
    try {
      return await this.fiscalRepo.closeFiscalDay(parsed, actorStaffId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Fiscal close failed";
      const isUniqueViolation = typeof error === "object" && error !== null && "code" in error && error.code === "23505";
      if (message.includes("already closed") || isUniqueViolation) {
        throw new ConflictException("Fiscal day already closed");
      }
      throw new BadRequestException(message);
    }
  }

  @Post("fiscal/exports")
  @Roles("admin")
  @RequiresPermissions("fiscal:export")
  @RequiresModule("fiscal_exports")
  async createFiscalExport(@Body() payload: FiscalExportCreateRequest, @Req() request: AuthenticatedRequest): Promise<FiscalExport> {
    const parsed = fiscalExportCreateRequestSchema.parse(payload);
    const actorStaffId = request.user?.sub;
    if (!actorStaffId) {
      throw new UnauthorizedException("Missing authenticated user");
    }
    return this.fiscalRepo.createFiscalExport(parsed, actorStaffId);
  }

  @Post("fiscal/exports/:id/retry")
  @Roles("admin")
  @RequiresPermissions("fiscal:export")
  @RequiresModule("fiscal_exports")
  async retryFiscalExport(@Param("id") id: string, @Req() request: AuthenticatedRequest): Promise<FiscalExport> {
    const actorStaffId = request.user?.sub;
    if (!actorStaffId) {
      throw new UnauthorizedException("Missing authenticated user");
    }
    let updated: FiscalExport | null;
    try {
      updated = await this.fiscalRepo.retryFiscalExport(id, actorStaffId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Export retry failed";
      if (message.includes("Only failed exports can be retried")) {
        throw new ConflictException(message);
      }
      throw new BadRequestException(message);
    }
    if (!updated) {
      throw new NotFoundException("Fiscal export not found");
    }
    this.auditLogService.log("fiscal.export.retried", {
      actorStaffId,
      targetId: id,
      details: { status: updated.status },
    });
    return updated;
  }

  @Get("fiscal/exports")
  @Roles("admin")
  @RequiresPermissions("fiscal:export")
  @RequiresModule("fiscal_exports")
  listFiscalExports(@Query() query: Record<string, string | undefined>): Promise<FiscalExport[]> {
    const parsed = fiscalExportsQuerySchema.parse({
      from: query.from,
      to: query.to,
      status: query.status,
      limit: query.limit ? Number(query.limit) : undefined,
    }) as FiscalExportsQuery;
    return this.fiscalRepo.listFiscalExports(parsed);
  }

  @Get("fiscal/exports/:id/download")
  @Roles("admin")
  @RequiresPermissions("fiscal:export")
  @RequiresModule("fiscal_exports")
  async downloadFiscalExport(
    @Param("id") id: string,
    @Res() response: Response,
  ): Promise<void> {
    const generated = await this.fiscalRepo.getFiscalExportCsvById(id);
    if (!generated) {
      throw new NotFoundException("Fiscal export not found");
    }

    if (generated.entry.checksum && generated.entry.checksum !== generated.checksum) {
      throw new ConflictException("Fiscal export checksum mismatch");
    }

    response.setHeader("Content-Type", "text/csv; charset=utf-8");
    response.setHeader("Content-Disposition", `attachment; filename="fiscal_${generated.entry.businessDate}.csv"`);
    response.setHeader("X-Fiscal-Checksum", generated.checksum);
    response.send(generated.csv);
  }

  // ─── Certified fiscal printer (Path B) ──────────────────────────────────
  // Config + job queue for the RT device, reached through the Go agent.

  @Get("settings/fiscal/printer")
  @Roles("admin")
  @RequiresPermissions("settings:update")
  @RequiresModule("fiscal_exports")
  async getFiscalPrinterConfig(): Promise<{ fiscalPrinter: FiscalPrinterConfig }> {
    const fiscalPrinter = await this.fiscalBridgeRepo.getFiscalPrinterConfig();
    return { fiscalPrinter };
  }

  @Patch("settings/fiscal/printer")
  @Roles("admin")
  @RequiresPermissions("settings:update")
  @RequiresModule("fiscal_exports")
  async saveFiscalPrinterConfig(@Body() payload: FiscalPrinterConfigUpdateRequest): Promise<{ fiscalPrinter: FiscalPrinterConfig }> {
    const parsed = fiscalPrinterConfigUpdateRequestSchema.parse(payload);
    const fiscalPrinter = await this.fiscalBridgeRepo.saveFiscalPrinterConfig(parsed.fiscalPrinter);
    return { fiscalPrinter };
  }

  @Post("fiscal/jobs/test")
  @Roles("admin")
  @RequiresPermissions("fiscal:export")
  @RequiresModule("fiscal_exports")
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async enqueueFiscalTestJob(): Promise<{ job: FiscalJob }> {
    const job = await this.fiscalBridgeRepo.enqueueFiscalJob({
      type: "test",
      payloadJson: JSON.stringify({ requestedAt: new Date().toISOString() }),
    });
    return { job };
  }

  @Post("fiscal/chiusura")
  @Roles("admin")
  @RequiresPermissions("fiscal:close")
  @RequiresModule("fiscal_exports")
  async enqueueFiscalChiusura(@Body() payload: FiscalChiusuraRequest): Promise<{ job: FiscalJob }> {
    const parsed = fiscalChiusuraRequestSchema.parse(payload);
    const job = await this.fiscalBridgeRepo.enqueueFiscalJob({
      type: "chiusura",
      payloadJson: JSON.stringify({ businessDate: parsed.businessDate }),
    });
    return { job };
  }

  @Get("fiscal/jobs")
  @Roles("admin")
  @RequiresPermissions("fiscal:export")
  @RequiresModule("fiscal_exports")
  async listFiscalJobs(@Query() query: Record<string, string | undefined>): Promise<{ jobs: FiscalJob[] }> {
    const parsed = fiscalJobsQuerySchema.parse({
      status: query.status,
      type: query.type,
      limit: query.limit ? Number(query.limit) : undefined,
    });
    const jobs = await this.fiscalBridgeRepo.listFiscalJobs(parsed);
    return { jobs };
  }

  @Get("fiscal/jobs/:id")
  @Roles("admin")
  @RequiresPermissions("fiscal:export")
  @RequiresModule("fiscal_exports")
  async getFiscalJob(@Param("id") id: string): Promise<{ job: FiscalJob }> {
    const job = await this.fiscalBridgeRepo.getFiscalJobById(id);
    if (!job) {
      throw new NotFoundException("Fiscal job not found");
    }
    return { job };
  }

  // Agent-facing endpoints (mirror print-bridge: bridge/onboarding auth).

  @Post("fiscal-bridge/claim")
  @Public()
  @Throttle({ default: { limit: 600, ttl: 60_000 } })
  async fiscalBridgeClaim(@Body() raw: unknown, @Req() req: any): Promise<{ jobs: FiscalJob[] }> {
    const auth = await this.verifyBridgeOrOnboardingSecret(req);
    return this.withBridgeTenantContext(auth.tenantId, async () => {
      const payload = fiscalBridgeClaimRequestSchema.parse(raw);
      // The tenant must have an RT device configured for fiscal claims to be
      // served; a misconfigured agent polling the queue must not steal jobs.
      // The enabled toggle is enforced per-job (receipts only) so connection
      // tests can run before the admin flips the switch.
      const config = await this.fiscalBridgeRepo.getFiscalPrinterConfig();
      if (!config.host) {
        return { jobs: [] };
      }
      // Area gating: mirror the print claim queue boundary — only a bridge
      // assigned to the cashier area may claim certified fiscal jobs, so a
      // kitchen/bar-only agent can never pull (and fail) a cashier receipt.
      const fiscalBridge = await this.printBridgeRepo.getPrintBridge(payload.bridgeId);
      if (!fiscalBridge) {
        return { jobs: [] };
      }
      const fiscalQueueAreas = fiscalBridge.version?.startsWith("go-")
        ? fiscalBridge.claimedAreas
        : fiscalBridge.areas;
      if (!fiscalQueueAreas.includes("cashier")) {
        return { jobs: [] };
      }
      const instanceId = (req.headers["x-bridge-instance-id"] as string | undefined)?.trim() || crypto.randomUUID();
      const jobs: FiscalJob[] = await this.fiscalBridgeRepo.claimFiscalJobsForBridge(
        payload.bridgeId,
        payload.limit ?? 10,
        instanceId,
        auth.tenantId,
      );
      return { jobs };
    });
  }

  @Post("fiscal-bridge/jobs/:id/complete")
  @Public()
  async fiscalBridgeJobComplete(
    @Param("id") id: string,
    @Body() raw: unknown,
    @Req() req: any,
  ): Promise<{ job: FiscalJob } | { success: false }> {
    const auth = await this.verifyBridgeOrOnboardingSecret(req);
    return this.withBridgeTenantContext(auth.tenantId, async () => {
      const instanceId = (req.headers["x-bridge-instance-id"] as string | undefined)?.trim() || "";
      const job = await this.fiscalBridgeRepo.completeFiscalJob(
        (raw as { bridgeId?: string })?.bridgeId ?? "",
        id,
        raw as FiscalBridgeJobCompleteRequest,
        instanceId,
        auth.tenantId,
      );
      if (!job) {
        return { success: false };
      }
      return { job };
    });
  }

  @Post("fiscal-bridge/jobs/:id/fail")
  @Public()
  async fiscalBridgeJobFail(
    @Param("id") id: string,
    @Body() raw: unknown,
    @Req() req: any,
  ): Promise<{ job: FiscalJob } | { success: false }> {
    const auth = await this.verifyBridgeOrOnboardingSecret(req);
    return this.withBridgeTenantContext(auth.tenantId, async () => {
      const instanceId = (req.headers["x-bridge-instance-id"] as string | undefined)?.trim() || "";
      const job = await this.fiscalBridgeRepo.failFiscalJob(
        (raw as { bridgeId?: string })?.bridgeId ?? "",
        id,
        raw as FiscalBridgeJobFailRequest,
        instanceId,
        auth.tenantId,
      );
      if (!job) {
        return { success: false };
      }
      return { job };
    });
  }

  @Get("customers/:id")
  @Roles("admin")
  @RequiresPermissions("customers:view")
  @RequiresModule("customers")
  async getCustomer(@Param("id") id: string): Promise<Customer> {
    const customer = await this.customerRepo.getCustomerById(id);
    if (!customer) {
      throw new NotFoundException("Customer not found");
    }
    return customer;
  }

  @Patch("customers/:id")
  @Roles("admin", "waiter")
  @RequiresPermissions("customers:manage")
  @RequiresModule("customers")
  async updateCustomer(@Param("id") id: string, @Body() payload: CustomerUpdateRequest): Promise<Customer> {
    const parsed = customerUpdateRequestSchema.parse(payload);
    const updated = await this.customerRepo.updateCustomerById(id, parsed);
    if (!updated) {
      throw new NotFoundException("Customer not found");
    }
    return updated;
  }

  @Delete("customers/:id")
  @Roles("admin")
  @RequiresPermissions("customers:manage")
  @RequiresModule("customers")
  async deleteCustomer(@Param("id") id: string) {
    const ok = await this.customerRepo.deleteCustomerById(id);
    if (!ok) {
      throw new NotFoundException("Customer not found");
    }
    return { success: true };
  }

  @Get("customers/:id/addresses")
  @Roles("admin", "waiter")
  @RequiresPermissions("customers:view")
  @RequiresModule("customers")
  async listCustomerAddresses(@Param("id") id: string) {
    const customer = await this.customerRepo.getCustomerById(id);
    if (!customer) {
      throw new NotFoundException("Customer not found");
    }
    return this.customerRepo.listCustomerAddresses(id);
  }

  @Post("customers/:id/addresses")
  @Roles("admin", "waiter")
  @RequiresPermissions("customers:manage")
  @RequiresModule("customers")
  async createCustomerAddress(@Param("id") id: string, @Body() payload: CustomerAddressCreateRequest) {
    const customer = await this.customerRepo.getCustomerById(id);
    if (!customer) {
      throw new NotFoundException("Customer not found");
    }
    return this.customerRepo.createCustomerAddress(id, payload);
  }

  @Patch("customers/:id/addresses/:addressId")
  @Roles("admin", "waiter")
  @RequiresPermissions("customers:manage")
  @RequiresModule("customers")
  async updateCustomerAddress(@Param("id") id: string, @Param("addressId") addressId: string, @Body() payload: CustomerAddressUpdateRequest) {
    const updated = await this.customerRepo.updateCustomerAddress(addressId, payload);
    if (!updated) {
      throw new NotFoundException("Address not found");
    }
    return updated;
  }

  @Delete("customers/:id/addresses/:addressId")
  @Roles("admin")
  @RequiresPermissions("customers:manage")
  @RequiresModule("customers")
  async deleteCustomerAddress(@Param("id") id: string, @Param("addressId") addressId: string) {
    const ok = await this.customerRepo.deleteCustomerAddress(addressId);
    if (!ok) {
      throw new NotFoundException("Address not found");
    }
    return { success: true };
  }

  @Get("categories")
  @Roles("admin", "chef")
  @RequiresModule("inventory")
  listCategories(@Query("scope") scope?: Category["scope"]) {
    return this.inventoryRepo.listCategories(scope);
  }

  @Get("simple-catalog/categories")
  @Roles("admin", "chef")
  @RequiresModule("simple_catalog")
  listSimpleCatalogCategories() {
    return this.inventoryRepo.listCategories("menu");
  }

  @Get("print-jobs")
  @Roles("admin", "chef")
  @RequiresModule("printing")
  listPrintJobs(@Query() query: Record<string, string | undefined>): Promise<PrintJob[]> {
    const parsed = printJobsQuerySchema.parse({
      status: query.status,
      area: query.area,
      limit: query.limit ? Number(query.limit) : undefined,
    }) as PrintJobsQuery;
    return this.printJobsRepo.listPrintJobs(parsed);
  }

  @Post("print-jobs/:id/dispatch")
  @Roles("admin", "chef")
  @RequiresPermissions("printing:dispatch")
  @RequiresModule("printing")
  async dispatchPrintJob(
    @Param("id") id: string,
    @Body() payload: DispatchPrintJobRequest = {},
  ): Promise<PrintJob> {
    const parsed = dispatchPrintJobRequestSchema.parse(payload ?? {});
    const job = await this.printJobsRepo.getPrintJobById(id);
    if (!job) {
      throw new NotFoundException("Print job not found");
    }

    const endpoint = parsed.endpoint ?? process.env.PRINT_BRIDGE_URL;
    if (!endpoint) {
      throw new BadRequestException("Missing print bridge endpoint");
    }

    // SSRF protection: only allow whitelisted endpoints
    const allowedEndpoints = new Set(
      [
        process.env.PRINT_BRIDGE_URL,
        "http://127.0.0.1:11905/print",
        "http://localhost:11905/print",
      ].filter(Boolean),
    );

    if (!allowedEndpoints.has(endpoint)) {
      throw new BadRequestException("Print endpoint not in allowlist");
    }

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: job.id,
          orderId: job.orderId,
          area: job.area,
          protocol: job.protocol,
          payload: job.payload,
        }),
      });

      if (!response.ok) {
        const raw = await response.text();
        console.error(`[print-bridge] Bridge error ${response.status}: ${raw}`);
        await this.printJobsRepo.failPrintJob(id, `Bridge error ${response.status}`);
        throw new BadRequestException(`Print bridge rejected job: ${response.status}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown print bridge error";
      await this.printJobsRepo.failPrintJob(id, message);
      throw new BadRequestException(message);
    }

    const result = await this.printJobsRepo.dispatchPrintJob(id);
    if (!result) {
      throw new NotFoundException("Print job not found");
    }
    return result;
  }

  @Get("print-jobs/poll")
  @Throttle({ default: { limit: 30, ttl: 60 } })
  @RequiresModule("printing")
  async pollPrintJobs(@Query() query: Record<string, string | undefined>): Promise<PrintJob[]> {
    const areasParam = query.areas;
    if (!areasParam) {
      throw new BadRequestException("Missing 'areas' query parameter");
    }
    const areas = areasParam
      .split(",")
      .map((a) => a.trim())
      .filter((a) => ["kitchen", "bar", "cashier"].includes(a)) as PrintArea[];
    if (areas.length === 0) {
      throw new BadRequestException("No valid areas provided");
    }
    return this.printJobsRepo.pollPrintJobs(areas);
  }

  @Post("print-jobs/:id/fail")
  @Roles("admin", "chef")
  @RequiresModule("printing")
  async failPrintJob(
    @Param("id") id: string,
    @Body() payload: { error?: string },
  ): Promise<PrintJob> {
    const result = await this.printJobsRepo.failPrintJob(id, payload.error ?? "Print failed");
    if (!result) {
      throw new NotFoundException("Print job not found");
    }
    return result;
  }

  @Post("print-jobs/:id/confirm")
  @Roles("admin", "chef")
  @RequiresModule("printing")
  async confirmPrintJob(@Param("id") id: string): Promise<PrintJob> {
    const result = await this.printJobsRepo.confirmPrintJob(id);
    if (!result) {
      throw new NotFoundException("Print job not found or already completed");
    }
    return result;
  }

  @Post("print-jobs/:id/complete")
  @Roles("admin", "chef")
  @RequiresPermissions("printing:dispatch")
  @RequiresModule("printing")
  async completePrintJob(@Param("id") id: string): Promise<PrintJob> {
    const result = await this.printJobsRepo.completePrintJob(id);
    if (!result) {
      throw new NotFoundException("Print job not found or already completed");
    }
    return result;
  }

  @Post("print-jobs/:id/retry")
  @Roles("admin", "chef")
  @RequiresModule("printing")
  async retryPrintJob(@Param("id") id: string): Promise<PrintJob> {
    const result = await this.printJobsRepo.retryPrintJob(id);
    if (!result) {
      throw new NotFoundException("Print job not found or cannot be retried");
    }
    return result;
  }

  @Post("categories")
  @RequiresPermissions("inventory:manage")
  @Roles("admin", "chef")
  @RequiresModule("inventory")
  createCategory(@Body() payload: CategoryCreateRequest) {
    const parsed = categoryCreateRequestSchema.parse(payload);
    return this.inventoryRepo.createCategory(parsed);
  }

  @Post("simple-catalog/categories")
  @Roles("admin", "chef")
  @RequiresModule("simple_catalog")
  createSimpleCatalogCategory(@Body() payload: CategoryCreateRequest) {
    const parsed = categoryCreateRequestSchema.parse({ ...payload, scope: "menu" });
    return this.inventoryRepo.createCategory(parsed);
  }

  @Patch("categories/:id")
  @RequiresPermissions("inventory:manage")
  @Roles("admin", "chef")
  @RequiresModule("inventory")
  async updateCategory(@Param("id") id: string, @Body() payload: CategoryUpdateRequest) {
    const parsed = categoryUpdateRequestSchema.parse(payload);
    const updated = await this.inventoryRepo.updateCategory(id, parsed);
    if (!updated) {
      throw new NotFoundException("Category not found");
    }
    return updated;
  }

  @Patch("simple-catalog/categories/:id")
  @Roles("admin", "chef")
  @RequiresModule("simple_catalog")
  async updateSimpleCatalogCategory(@Param("id") id: string, @Body() payload: CategoryUpdateRequest) {
    const existing = await this.appRepository.getCategoryById(id);
    if (!existing || existing.scope !== "menu") {
      throw new NotFoundException("Category not found");
    }

    const parsed = categoryUpdateRequestSchema.parse(payload);
    const updated = await this.inventoryRepo.updateCategory(id, parsed);
    if (!updated) {
      throw new NotFoundException("Category not found");
    }
    return updated;
  }

  @Delete("categories/:id")
  @RequiresPermissions("inventory:manage")
  @Roles("admin", "chef")
  @RequiresModule("inventory")
  async deleteCategory(@Param("id") id: string) {
    try {
      const ok = await this.inventoryRepo.deleteCategory(id);
      if (!ok) {
        throw new NotFoundException("Category not found");
      }
      return { success: true };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(error instanceof Error ? error.message : "Cannot delete category");
    }
  }

  @Get("category-modifier-pools")
  @Roles("admin", "chef")
  @RequiresModule("inventory")
  listCategoryModifierPools(@Query("categoryId") categoryId?: string) {
    return this.inventoryRepo.listCategoryModifierPools(categoryId);
  }

  @Post("category-modifier-pools")
  @RequiresPermissions("inventory:manage")
  @Roles("admin", "chef")
  @RequiresModule("inventory")
  createCategoryModifierPool(@Body() payload: CategoryModifierPoolCreateRequest) {
    const parsed = categoryModifierPoolCreateRequestSchema.parse(payload);
    return this.inventoryRepo.createCategoryModifierPool(parsed);
  }

  @Patch("category-modifier-pools/:id")
  @RequiresPermissions("inventory:manage")
  @Roles("admin", "chef")
  @RequiresModule("inventory")
  async updateCategoryModifierPool(@Param("id") id: string, @Body() payload: CategoryModifierPoolUpdateRequest) {
    const parsed = categoryModifierPoolUpdateRequestSchema.parse(payload);
    const updated = await this.inventoryRepo.updateCategoryModifierPool(id, parsed);
    if (!updated) {
      throw new NotFoundException("Category modifier pool not found");
    }
    return updated;
  }

  @Delete("category-modifier-pools/:id")
  @RequiresPermissions("inventory:manage")
  @Roles("admin", "chef")
  @RequiresModule("inventory")
  async deleteCategoryModifierPool(@Param("id") id: string) {
    const ok = await this.inventoryRepo.deleteCategoryModifierPool(id);
    if (!ok) {
      throw new NotFoundException("Category modifier pool not found");
    }
    return { success: true };
  }

  @Get("inventory")
  @Roles("admin", "chef")
  @RequiresModule("inventory")
  listInventory() {
    return this.inventoryRepo.listInventoryItems();
  }

  @Get("inventory/reorder-suggestions")
  @Roles("admin", "chef")
  @RequiresModule("inventory")
  getReorderSuggestions() {
    return this.appRepository.getReorderSuggestions();
  }

  @Get("inventory/:id/audit")
  @Roles("admin", "chef")
  @RequiresModule("inventory")
  listInventoryAudit(
    @Param("id") id: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    return this.appRepository.listInventoryAudit(
      id,
      limit ? Number(limit) : 50,
      offset ? Number(offset) : 0,
    );
  }

  @Get("settings")
  @Roles("admin")
  getUiSettings(): Promise<UiSettings> {
    return this.appRepository.getUiSettings();
  }

  @Patch("settings")
  @Roles("admin")
  @RequiresPermissions("settings:update")
  async updateUiSettings(@Body() payload: UpdateUiSettingsRequest): Promise<UiSettings> {
    try {
      const parsed = updateUiSettingsRequestSchema.parse(payload);
      const updated = await this.appRepository.updateUiSettings(parsed);
      await this.realtimeGateway.emit(socketEvents.settingsUpdate, updated);
      return updated;
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : "Invalid settings payload");
    }
  }

  @Patch("settings/printing")
  @Roles("admin")
  @RequiresPermissions("settings:update")
  @RequiresModule("printing")
  async updatePrintingSettings(@Body() payload: UpdatePrintingSettingsRequest): Promise<UiSettings> {
    try {
      const parsed = updatePrintingSettingsRequestSchema.parse(payload);
      const updated = await this.appRepository.updatePrintingSettings(parsed);
      await this.realtimeGateway.emit(socketEvents.settingsUpdate, updated);
      return updated;
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : "Invalid printing settings payload");
    }
  }

  // Upload a logo image for thermal receipts. Converts it to a 1-bit
  // monochrome bitmap and packs it as a GS v 0 raster command, returned as
  // base64 so the client stores it in settings.printing.logoBitmap.
  @Post("settings/printing/logo")
  @Roles("admin")
  @RequiresPermissions("settings:update")
  @RequiresModule("printing")
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: LOGO_MAX_BYTES, files: 1 },
    }),
  )
  async uploadPrintLogo(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: Record<string, unknown>,
  ): Promise<{ logoBitmap: string; logoWidth: number; logoHeight: number; byteLength: number }> {
    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new BadRequestException("Logo file is required");
    }
    if (file.size > LOGO_MAX_BYTES) {
      throw new BadRequestException("Logo file exceeds the 2 MB limit");
    }
    const sniffed = sniffImageType(file.buffer);
    if (!sniffed) {
      throw new BadRequestException("Unsupported file: upload a PNG, JPEG, BMP or GIF image");
    }
    if (file.mimetype && !LOGO_IMAGE_MIME_TYPES.has(file.mimetype)) {
      // Extension/mimetype mismatch with actual content — reject rather than
      // let a disguised payload reach the decoder. `application/octet-stream`
      // (some clients send it for any binary) is allowed through because the
      // magic bytes already passed the sniff check above.
      if (file.mimetype !== "application/octet-stream") {
        throw new BadRequestException("File type does not match its content");
      }
    }

    const width = Number(body?.width);
    const threshold = Number(body?.threshold);
    try {
      const result = await imageBufferToLogoRaster(file.buffer, {
        width: Number.isFinite(width) && width > 0 ? width : 384,
        threshold: Number.isFinite(threshold) ? threshold : 160,
      });
      return printLogoUploadResponseSchema.parse(result);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : "Logo conversion failed");
    }
  }

  // ─── QZ Tray Configuration ─────────────────────────────────────────────

  @Get("printing/qz-config")
  @Roles("admin")
  @RequiresModule("printing")
  async getQzTrayConfig(@Req() request: AuthenticatedRequest) {
    const tenantId = request.user?.tenantId;
    if (!tenantId) {
      throw new UnauthorizedException("Missing tenant context");
    }
    const config = await this.tenantService.getTenantModuleConfig(tenantId, "printing" as ModuleKey);
    return {
      qzTray: config?.config?.qzTray ?? {
        hosts: ["localhost"],
        securePorts: [8181],
        insecurePorts: [8182],
        useSecure: false,
      },
    };
  }

  @Patch("printing/qz-config")
  @Roles("admin")
  @RequiresPermissions("settings:update")
  @RequiresModule("printing")
  async updateQzTrayConfig(
    @Req() request: AuthenticatedRequest,
    @Body() payload: { qzTray: { hosts?: string[]; securePorts?: number[]; insecurePorts?: number[]; useSecure?: boolean } },
  ) {
    const tenantId = request.user?.tenantId;
    if (!tenantId) {
      throw new UnauthorizedException("Missing tenant context");
    }

    const existing = await this.tenantService.getTenantModuleConfig(tenantId, "printing" as ModuleKey);
    const baseConfig = existing?.config as Record<string, unknown> ?? {};
    const existingQz = (baseConfig.qzTray || {}) as Record<string, unknown>;

    const updated = await this.tenantService.upsertTenantModuleConfig(tenantId, {
      moduleKey: "printing" as ModuleKey,
      config: {
        ...baseConfig,
        qzTray: {
          hosts: payload.qzTray.hosts ?? (existingQz.hosts as string[] | undefined) ?? ["localhost", "localhost.qz.io"],
          securePorts: payload.qzTray.securePorts ?? (existingQz.securePorts as number[] | undefined) ?? [8181, 8282, 8383, 8484],
          insecurePorts: payload.qzTray.insecurePorts ?? (existingQz.insecurePorts as number[] | undefined) ?? [8182, 8283, 8384, 8385],
          useSecure: payload.qzTray.useSecure ?? (existingQz.useSecure as boolean | undefined) ?? true,
        },
      },
    });

    return { qzTray: updated.config.qzTray };
  }

  @Post("inventory")
  @RequiresPermissions("inventory:manage")
  @Roles("admin", "chef")
  @RequiresModule("inventory")
  async createInventoryItem(@Body() payload: IngredientCreateRequest) {
    const parsed = ingredientCreateRequestSchema.parse(payload);
    const created = await this.inventoryRepo.createInventoryItem(parsed);
    const inventory = await this.inventoryRepo.listInventoryItems();
    await this.realtimeGateway.emit(socketEvents.inventoryUpdate, inventory);
    return created;
  }

  @Patch("inventory/:id")
  @RequiresPermissions("inventory:manage")
  @Roles("admin", "chef")
  @RequiresModule("inventory")
  async updateInventoryItem(@Param("id") id: string, @Body() payload: IngredientUpdateRequest) {
    const parsed = ingredientUpdateRequestSchema.parse(payload);
    const updated = await this.inventoryRepo.updateInventoryItem(id, parsed);
    if (!updated) {
      throw new NotFoundException("Ingredient not found");
    }
    const inventory = await this.inventoryRepo.listInventoryItems();
    await this.realtimeGateway.emit(socketEvents.inventoryUpdate, inventory);
    return updated;
  }

  @Delete("inventory/:id")
  @RequiresPermissions("inventory:manage")
  @Roles("admin", "chef")
  @RequiresModule("inventory")
  async deleteInventoryItem(@Param("id") id: string) {
    try {
      const ok = await this.inventoryRepo.deleteInventoryItem(id);
      if (!ok) {
        throw new NotFoundException("Ingredient not found");
      }
      const inventory = await this.inventoryRepo.listInventoryItems();
      await this.realtimeGateway.emit(socketEvents.inventoryUpdate, inventory);
      return { success: true };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(error instanceof Error ? error.message : "Cannot delete ingredient");
    }
  }

  @Post("inventory/:id/adjust")
  @RequiresPermissions("inventory:manage")
  @Roles("admin", "chef")
  @RequiresModule("inventory")
  async adjustInventoryItem(
    @Param("id") id: string,
    @Body() payload: IngredientAdjustRequest,
    @Req() request: AuthenticatedRequest,
  ) {
    const parsed = ingredientAdjustRequestSchema.parse(payload);
    try {
      const updated = await this.inventoryRepo.adjustInventoryItem(
        id,
        parsed.quantity,
        parsed.notes,
        request.user?.sub,
      );
      const inventory = await this.inventoryRepo.listInventoryItems();
      await this.realtimeGateway.emit(socketEvents.inventoryUpdate, inventory);
      return updated;
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : "Adjustment failed");
    }
  }

  @Get("stock-movements")
  @Roles("admin", "chef")
  @RequiresModule("inventory")
  async listStockMovements(
    @Query("ingredientId") ingredientId?: string,
    @Query("orderId") orderId?: string,
    @Query("movementType") movementType?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    const parsed = stockMovementsQuerySchema.parse({
      ingredientId: ingredientId || undefined,
      orderId: orderId || undefined,
      movementType: movementType || undefined,
      limit: limit ? Number(limit) : 50,
      offset: offset ? Number(offset) : 0,
    });
    return this.inventoryRepo.listStockMovements(parsed);
  }

  @Get("menu")
  @Roles("admin", "chef")
  @RequiresModule("inventory")
  listMenuAdmin() {
    return this.inventoryRepo.listMenuItemsAdmin();
  }

  @Get("simple-catalog/items")
  @Roles("admin", "chef")
  @RequiresModule("simple_catalog")
  listSimpleCatalogItems() {
    return this.simpleCatalogRepo.listSimpleCatalogItems();
  }

  @Post("simple-catalog/items")
  @Roles("admin", "chef")
  @RequiresModule("simple_catalog")
  createSimpleCatalogItem(@Body() payload: MenuItemCreateRequest) {
    const parsed = menuItemCreateRequestSchema
      .omit({ recipe: true })
      .extend({ recipe: menuItemCreateRequestSchema.shape.recipe.optional() })
      .parse(payload);
    return this.simpleCatalogRepo.createSimpleCatalogItem(parsed).catch((error) => {
      throw new BadRequestException(error instanceof Error ? error.message : "Invalid simple catalog payload");
    });
  }

  @Patch("simple-catalog/items/:id")
  @Roles("admin", "chef")
  @RequiresModule("simple_catalog")
  async updateSimpleCatalogItem(@Param("id") id: string, @Body() payload: MenuItemUpdateRequest) {
    const parsed = menuItemUpdateRequestSchema.parse(payload);
    const updated = await this.simpleCatalogRepo.updateSimpleCatalogItem(id, parsed);
    if (!updated) {
      throw new NotFoundException("Simple catalog item not found");
    }
    return updated;
  }

  @Post("simple-catalog/items/:id/enable")
  @Roles("admin", "chef")
  @RequiresModule("simple_catalog")
  async enableSimpleCatalogItem(@Param("id") id: string) {
    const ok = await this.simpleCatalogRepo.setMenuItemActiveState(id, true);
    if (!ok) {
      throw new NotFoundException("Simple catalog item not found");
    }
    return { success: true };
  }

  @Post("simple-catalog/items/:id/disable")
  @Roles("admin", "chef")
  @RequiresModule("simple_catalog")
  async disableSimpleCatalogItem(@Param("id") id: string) {
    const ok = await this.simpleCatalogRepo.setMenuItemActiveState(id, false);
    if (!ok) {
      throw new NotFoundException("Simple catalog item not found");
    }
    return { success: true };
  }

  @Post("menu-products")
  @RequiresPermissions("inventory:manage")
  @Roles("admin", "chef")
  @RequiresModule("inventory")
  async createMenuProduct(@Body() payload: CanonicalCreateMenuProductRequest) {
    const parsed = canonicalCreateMenuProductRequestSchema.parse(payload);
    try {
      return await this.inventoryRepo.createMenuProduct(parsed);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : "Invalid menu product payload");
    }
  }

  @Patch("menu/:id")
  @RequiresPermissions("inventory:manage")
  @Roles("admin", "chef")
  @RequiresModule("inventory")
  async updateMenuItem(@Param("id") id: string, @Body() payload: MenuItemUpdateRequest) {
    const parsed = menuItemUpdateRequestSchema.parse(payload);
    const updated = await this.inventoryRepo.updateMenuItem(id, parsed);
    if (!updated) {
      throw new NotFoundException("Menu item not found");
    }

    return updated;
  }

  @Post("menu/:id/enable")
  @RequiresPermissions("inventory:manage")
  @Roles("admin", "chef")
  @RequiresModule("inventory")
  async enableMenuItem(@Param("id") id: string) {
    const ok = await this.simpleCatalogRepo.setMenuItemActiveState(id, true);
    if (!ok) {
      throw new NotFoundException("Menu item not found");
    }

    return { success: true };
  }

  @Post("menu/:id/disable")
  @RequiresPermissions("inventory:manage")
  @Roles("admin", "chef")
  @RequiresModule("inventory")
  async disableMenuItem(@Param("id") id: string) {
    const ok = await this.simpleCatalogRepo.setMenuItemActiveState(id, false);
    if (!ok) {
      throw new NotFoundException("Menu item not found");
    }

    return { success: true };
  }

  @Delete("menu/:id")
  @RequiresPermissions("inventory:manage")
  @Roles("admin", "chef")
  @RequiresModule("inventory")
  async deleteMenuItem(@Param("id") id: string) {
    const ok = await this.inventoryRepo.deleteMenuItem(id);
    if (!ok) {
      throw new NotFoundException("Menu item not found");
    }
    return { success: true };
  }

  @Post("orders")
  @Roles("admin", "waiter")
  @RequiresModule("kitchen")
  async createOrder(@Body() payload: CreateOrderRequest) {
    const parsed = createOrderRequestSchema.parse(payload);
    let created;
    try {
      created = await this.appRepository.createOrder(parsed);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : "Order creation failed");
    }
    await this.realtimeGateway.emit(socketEvents.orderNew, created.order);
    await this.realtimeGateway.emit(socketEvents.inventoryUpdate, created.inventory);
    // Tavolo occupato per ordini dine-in: evento targeted invece del full data:update.
    if ((parsed.orderType ?? "dine_in") === "dine_in") {
      await this.emitTablesUpdateSafely();
    }
    return created.order;
  }

  @Patch("orders/:id/items/:orderItemId")
  @Roles("admin", "chef", "waiter")
  @RequiresPermissions("orders:update")
  @RequiresModule("kitchen")
  async updateOrderItemQuantity(
    @Param("id") id: string,
    @Param("orderItemId") orderItemId: string,
    @Body() payload: UpdateOrderItemQuantityRequest,
  ): Promise<Order> {
    const parsed = updateOrderItemQuantityRequestSchema.parse(payload);
    let updated;
    try {
      updated = await this.appRepository.updateOrderItemQuantity(id, Number(orderItemId), parsed.quantity);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : "Order item update failed");
    }
    if (!updated) throw new NotFoundException("Order not found");
    await this.realtimeGateway.emit(socketEvents.orderUpdate, updated);
    return updated;
  }

  @Patch("orders/:id")
  @Roles("admin", "chef")
  @RequiresPermissions("orders:update")
  @RequiresModule("kitchen")
  async updateOrder(@Param("id") id: string, @Body() payload: UpdateOrderRequest): Promise<Order> {
    let updatedOrder;
    try {
      updatedOrder = await this.appRepository.updateOrder(id, payload);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : "Order update failed");
    }
    if (!updatedOrder) {
      throw new NotFoundException("Order not found");
    }

    await this.realtimeGateway.emit(socketEvents.orderUpdate, updatedOrder);
    return updatedOrder;
  }

  @Post("orders/:id/void")
  @Roles("admin", "waiter")
  @RequiresPermissions("orders:void")
  @RequiresModule("kitchen")
  async voidOrder(
    @Param("id") id: string,
    @Body() payload: VoidOrderRequest,
    @Req() request: AuthenticatedRequest,
  ): Promise<VoidOrderResponse> {
    const actorStaffId = request.user?.sub;
    if (!actorStaffId) {
      throw new UnauthorizedException("Missing authenticated user");
    }

    let result;
    try {
      result = await this.appRepository.voidOrder(id, payload, actorStaffId);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : "Order void failed");
    }

    if (!result) {
      throw new NotFoundException("Order not found");
    }

    await this.realtimeGateway.emit(socketEvents.orderUpdate, result.order);
    const inventory = await this.inventoryRepo.listInventoryItems();
    await this.realtimeGateway.emit(socketEvents.inventoryUpdate, inventory);
    this.auditLogService.log("order.void", {
      actorStaffId,
      targetId: id,
      details: { reason: payload.reason },
    });

    return result;
  }

  @Post("tables/:id/pay")
  @Roles("admin", "waiter")
  @RequiresPermissions("tables:pay")
  @RequiresModule("kitchen")
  async closeTable(
    @Param("id") id: string,
    @Body() payload: CloseTableRequest,
    @Req() request: AuthenticatedRequest,
  ) {
    const actorStaffId = request.user?.sub;
    if (!actorStaffId) {
      throw new UnauthorizedException("Missing authenticated user");
    }

    const closePayload = closeTableRequestSchema.parse({
      method: payload?.method ?? "cash",
      paidAmount: payload?.paidAmount,
      discountAmount: payload?.discountAmount,
      surchargeAmount: payload?.surchargeAmount,
      gatewayReference: payload?.gatewayReference,
      paymentStatus: payload?.paymentStatus,
      notes: payload?.notes,
    });

    let result;
    try {
      result = await this.tablesRepo.closeTable(id, closePayload, actorStaffId);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : "Close table failed");
    }

    if (!result) {
      throw new NotFoundException("Table not found");
    }

    // Eventi targeted: ordini pagati + tavolo libero. Niente full data:update.
    await this.realtimeGateway.emit(socketEvents.ordersUpdate, { action: "set_paid", tableNumber: result.payment.tableNumber });
    await this.emitTablesUpdateSafely();
    this.auditLogService.log("table.close", {
      actorStaffId,
      targetId: id,
      details: {
        paymentId: result.payment.id,
        total: result.payment.total,
        method: result.payment.method,
      },
    });
    return result;
  }

  @Post("tables/:id/split-bill")
  @Roles("admin", "waiter")
  @RequiresPermissions("tables:pay")
  @RequiresModule("kitchen")
  async splitBill(@Param("id") id: string, @Body() payload: SplitBillRequest, @Req() request: AuthenticatedRequest) {
    const actorStaffId = request.user?.sub;
    if (!actorStaffId) {
      throw new UnauthorizedException("Missing authenticated user");
    }

    const splitPayload = splitBillRequestSchema.parse(payload);
    let result;
    try {
      result = await this.tablesRepo.splitBill(id, splitPayload, actorStaffId);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : "Invalid split bill request");
    }

    if (!result) {
      throw new NotFoundException("Table not found");
    }

    if (result.persisted) {
      // Split non cambia ordini/tavoli: nessun evento necessario (solo payments).
      this.auditLogService.log("table.split.persisted", {
        actorStaffId,
        targetId: id,
        details: {
          people: result.people,
          total: result.total,
          payments: result.payments?.length ?? 0,
        },
      });
    }

    return result;
  }

  @Post("tables/:id/split-pay/:shareIndex")
  @Roles("admin", "waiter")
  @RequiresPermissions("tables:pay")
  @RequiresModule("kitchen")
  async markShareAsPaid(
    @Param("id") id: string,
    @Param("shareIndex") shareIndex: string,
    @Body() payload: MarkShareAsPaidRequest,
    @Req() request: AuthenticatedRequest,
  ) {
    const actorStaffId = request.user?.sub;
    if (!actorStaffId) {
      throw new UnauthorizedException("Missing authenticated user");
    }

    const shareIndexNum = parseInt(shareIndex, 10);
    if (isNaN(shareIndexNum) || shareIndexNum < 0) {
      throw new BadRequestException("Invalid share index");
    }

    let result;
    try {
      result = await this.tablesRepo.markShareAsPaid(id, shareIndexNum, payload, actorStaffId);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : "Invalid mark share as paid request");
    }

    if (!result) {
      throw new NotFoundException("Table not found");
    }

    // Quando tutte le share sono pagate il tavolo si libera e gli ordini passano a paid.
    if (result.allSharesPaid) {
      await this.realtimeGateway.emit(socketEvents.ordersUpdate, { action: "set_paid", tableNumber: result.payment.tableNumber });
      await this.emitTablesUpdateSafely();
    }
    this.auditLogService.log("table.split.share_paid", {
      actorStaffId,
      targetId: id,
      details: {
        shareIndex: shareIndexNum,
        paymentId: result.payment.id,
        allSharesPaid: result.allSharesPaid,
      },
    });

    return result;
  }

  @Get("tables/:id/payment-status")
  @Roles("admin", "waiter")
  @RequiresModule("kitchen")
  async getTablePaymentStatus(@Param("id") id: string) {
    const result = await this.tablesRepo.getTablePaymentStatus(id);
    if (!result) {
      throw new NotFoundException("Table not found");
    }
    return result;
  }

  @Post("tables/:id/pay-items")
  @Roles("admin", "waiter")
  @RequiresPermissions("tables:pay")
  @RequiresModule("kitchen")
  async paySelectedItems(@Param("id") id: string, @Body() payload: PaySelectedItemsRequest, @Req() request: AuthenticatedRequest) {
    const actorStaffId = request.user?.sub;
    if (!actorStaffId) {
      throw new UnauthorizedException("Missing authenticated user");
    }

    const payPayload = paySelectedItemsRequestSchema.parse(payload);
    let result;
    try {
      result = await this.tablesRepo.paySelectedItems(id, payPayload, actorStaffId);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : "Invalid pay items request");
    }

    if (!result) {
      throw new NotFoundException("Table not found");
    }

    // Quando tutti gli item sono pagati il tavolo si libera e gli ordini passano a paid.
    if (result.allItemsPaid) {
      await this.realtimeGateway.emit(socketEvents.ordersUpdate, { action: "set_paid", tableNumber: result.payment.tableNumber });
      await this.emitTablesUpdateSafely();
    }
    this.auditLogService.log("table.pay_items", {
      actorStaffId,
      targetId: id,
      details: {
        paymentId: result.payment.id,
        total: result.payment.total,
        itemsCount: result.paidItems.length,
      },
    });

    return result;
  }

  @Post("tables/:id/transfer")
  @Roles("admin", "waiter")
  @RequiresModule("kitchen")
  async transferTable(@Param("id") id: string, @Body() payload: TransferTableRequest) {
    const transferPayload = transferTableRequestSchema.parse(payload);

    let result;
    try {
      result = await this.tablesRepo.transferTable(id, transferPayload);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : "Transfer failed");
    }

    if (!result) {
      throw new NotFoundException("Source or target table not found");
    }

    // Eventi targeted: stato tavoli + ordini spostati. Niente full data:update.
    // Degrado intenzionale: se listTables fallisce (post-commit best-effort) o
    // source/target non sono nella lista fresca, l'evento move viene saltato e i
    // client riallineano i numeri tavolo al prossimo refresh — mai un 500.
    const tables = await this.listTablesForRealtime();
    if (tables) {
      await this.realtimeGateway.emit(socketEvents.tablesUpdate, tables);
      const sourceTable = tables.find((t) => t.id === id);
      const targetTable = tables.find((t) => t.id === result.targetTableId);
      if (sourceTable && targetTable) {
        await this.realtimeGateway.emit(socketEvents.ordersUpdate, {
          action: "move",
          fromTableNumber: sourceTable.number,
          toTableNumber: targetTable.number,
        });
      }
    }
    this.auditLogService.log("table.transfer", {
      targetId: id,
      details: {
        targetTableId: result.targetTableId,
        movedOrders: result.movedOrders,
      },
    });
    return result;
  }

  @Get("health")
  @Public()
  health() {
    return { status: "ok" };
  }

  @Post("self-order/tables/:id/qr/rotate")
  @Roles("admin")
  @RequiresModule("self_order_qr")
  async rotateSelfOrderQr(@Param("id") id: string): Promise<SelfOrderSessionRotateResponse> {
    try {
      const rotated = await this.appRepository.rotateSelfOrderSessionForTable(id);
      if (!rotated) {
        throw new NotFoundException("Table not found");
      }
      return rotated;
    } catch (error) {
      if (error instanceof Error && error.message.includes("disabled")) {
        throw new ForbiddenException("Self order disabled for tenant");
      }
      throw error;
    }
  }

  // ─── Loyalty Points ─────────────────────────────────────────────────────

  @Get("loyalty/config")
  @Roles("admin", "waiter")
  @RequiresModule("loyalty_points")
  async getLoyaltyConfig(@Req() request: AuthenticatedRequest) {
    const tenantId = request.user?.tenantId;
    if (!tenantId) {
      throw new UnauthorizedException("Missing tenant context");
    }
    const config = await this.tenantService.getTenantModuleConfig(tenantId, "loyalty_points" as ModuleKey);
    const loyaltyConfig = (config?.config ?? {}) as Record<string, unknown>;
    return {
      earnRate: typeof loyaltyConfig.earnRate === "number" ? loyaltyConfig.earnRate : 1,
      redeemRate: typeof loyaltyConfig.redeemRate === "number" ? loyaltyConfig.redeemRate : 100,
      minRedeemPoints: typeof loyaltyConfig.minRedeemPoints === "number" ? loyaltyConfig.minRedeemPoints : 100,
    };
  }

  @Get("loyalty/:customerId")
  @RequiresPermissions("loyalty:manage")
  @Roles("admin", "waiter")
  @RequiresModule("loyalty_points")
  async getLoyaltyBalance(@Param("customerId") customerId: string): Promise<LoyaltyBalance> {
    return this.loyaltyRepo.getLoyaltyBalance(customerId);
  }

  @Post("loyalty/earn")
  @RequiresPermissions("loyalty:manage")
  @Roles("admin")
  @RequiresModule("loyalty_points")
  async earnLoyaltyPoints(@Body() payload: LoyaltyEarnRequest): Promise<LoyaltyTransaction> {
    const parsed = loyaltyEarnRequestSchema.parse(payload);
    return this.loyaltyRepo.earnLoyaltyPoints(parsed.customerId, parsed.points, parsed.orderId, parsed.notes);
  }

  @Post("loyalty/redeem")
  @RequiresPermissions("loyalty:manage")
  @Roles("admin", "waiter")
  @RequiresModule("loyalty_points")
  async redeemLoyaltyPoints(@Body() payload: LoyaltyRedeemRequest): Promise<LoyaltyTransaction> {
    const parsed = loyaltyRedeemRequestSchema.parse(payload);
    return this.loyaltyRepo.redeemLoyaltyPoints(parsed.customerId, parsed.points, parsed.orderId);
  }

  @Get("loyalty/:customerId/transactions")
  @RequiresPermissions("loyalty:manage")
  @Roles("admin", "waiter")
  @RequiresModule("loyalty_points")
  async listLoyaltyTransactions(
    @Param("customerId") customerId: string,
    @Query("limit") limit?: string,
  ): Promise<LoyaltyTransaction[]> {
    return this.loyaltyRepo.listLoyaltyTransactions(customerId, limit ? Number(limit) : 50);
  }

  // ─── Coupons ──────────────────────────────────────────────────────────

  @Post("coupons")
  @Roles("admin")
  async createCoupon(@Body() payload: CouponCreateRequest) {
    const parsed = couponCreateRequestSchema.parse(payload);
    const id = `coup_${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const now = new Date().toISOString();
    const coupon = { id, ...parsed, usedCount: 0, isActive: true, createdAt: now };
    // Store in memory for now (production would use DB)
    return coupon;
  }

  @Post("coupons/validate")
  @Roles("admin", "waiter")
  async validateCoupon(@Body() payload: CouponValidateRequest) {
    const parsed = couponValidateRequestSchema.parse(payload);
    // For now return a simple validation response
    return { valid: false, coupon: null, discount: 0, error: 'Coupon system not yet fully implemented' } as CouponValidateResponse;
  }

  @Get("public/:tenantSlug/self-order/session")
  @Public()
  @RequiresModule("self_order_qr")
  async resolveSelfOrderSession(
    @Param("tenantSlug") tenantSlug: string,
    @Query("token") token?: string,
  ): Promise<SelfOrderResolveResponse> {
    if (!token || token.trim().length < 12) {
      throw new BadRequestException("Missing or invalid self-order token");
    }

    try {
      return await this.appRepository.resolveSelfOrderSessionByToken(token.trim(), tenantSlug);
    } catch (error) {
      if (error instanceof Error && error.message.includes("disabled")) {
        throw new ForbiddenException("Self order disabled for tenant");
      }
      if (error instanceof Error && (error.message.includes("not found") || error.message.includes("expired"))) {
        throw new NotFoundException("Self order session not found");
      }
      throw new BadRequestException(error instanceof Error ? error.message : "Self order session invalid");
    }
  }

  @Post("public/:tenantSlug/self-order/orders")
  @Public()
  @RequiresModule("self_order_qr")
  async createSelfOrder(
    @Param("tenantSlug") tenantSlug: string,
    @Req() request: AuthenticatedRequest,
    @Body() payload: SelfOrderCreateRequest,
  ): Promise<SelfOrderCreateResponse> {
    const parsed = selfOrderCreateRequestSchema.parse(payload);
    try {
      const tenant = await this.staffRepo.getTenantBySlug(tenantSlug);
      if (!tenant) {
        throw new NotFoundException("Tenant not found");
      }

      const consumerUserId = await this.resolveConsumerUserId(request, tenant.id);
      const config = await this.consumerRepo.getConsumerAccountsConfig(tenant.id);
      if (config.requireAccountForSelfOrder && !consumerUserId) {
        throw new ForbiddenException("Consumer account required for self order");
      }

      return await this.appRepository.createSelfOrder(tenantSlug, parsed, consumerUserId ?? undefined);
    } catch (error) {
      if (
        error instanceof ForbiddenException ||
        error instanceof UnauthorizedException ||
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      if (error instanceof Error && error.message.includes("disabled")) {
        throw new ForbiddenException("Self order disabled for tenant");
      }
      if (error instanceof Error && (error.message.includes("not found") || error.message.includes("expired"))) {
        throw new NotFoundException("Self order session not found");
      }
      throw new BadRequestException(error instanceof Error ? error.message : "Self order create failed");
    }
  }

  @Post("public/:tenantSlug/reservations")
  @Public()
  @RequiresModule("reservations")
  async createPublicReservation(
    @Param("tenantSlug") tenantSlug: string,
    @Body() payload: ReservationCreateRequest,
  ): Promise<Reservation> {
    const tenant = await this.staffRepo.getTenantBySlug(tenantSlug);
    if (!tenant) {
      throw new NotFoundException("Tenant not found");
    }

    const parsed = reservationCreateRequestSchema.parse({
      ...payload,
      source: "online",
    });

    try {
      return await this.tablesRepo.createReservation(parsed);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : "Reservation create failed");
    }
  }

  @Post("public/:tenantSlug/takeaway/orders")
  @Public()
  @RequiresModule("public_takeaway")
  async createPublicTakeawayOrder(
    @Param("tenantSlug") tenantSlug: string,
    @Req() request: AuthenticatedRequest,
    @Body() payload: PublicTakeawayCreateRequest,
  ): Promise<PublicTakeawayCreateResponse> {
    const parsed = publicTakeawayCreateRequestSchema.parse(payload);

    try {
      const tenant = await this.staffRepo.getTenantBySlug(tenantSlug);
      if (!tenant) {
        throw new NotFoundException("Tenant not found");
      }

      const consumerUserId = await this.resolveConsumerUserId(request, tenant.id);
      const config = await this.consumerRepo.getConsumerAccountsConfig(tenant.id);
      if (config.requireAccountForTakeaway && !consumerUserId) {
        throw new ForbiddenException("Consumer account required for takeaway");
      }

      return await this.appRepository.createPublicTakeawayOrder(tenantSlug, parsed, consumerUserId ?? undefined);
    } catch (error) {
      if (
        error instanceof ForbiddenException ||
        error instanceof UnauthorizedException ||
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      if (error instanceof Error && error.message.includes("disabled")) {
        throw new ForbiddenException("Public takeaway disabled for tenant");
      }
      if (error instanceof Error && error.message.includes("not found")) {
        throw new NotFoundException("Public takeaway tenant not found");
      }
      throw new BadRequestException(error instanceof Error ? error.message : "Public takeaway create failed");
    }
  }

  @Post("public/:tenantSlug/group-orders")
  @Public()
  @RequiresModule("public_group_order")
  async createPublicGroupOrderSession(
    @Param("tenantSlug") tenantSlug: string,
    @Body() payload: GroupOrderCreateSessionRequest,
  ): Promise<GroupOrderCreateSessionResponse> {
    const parsed = groupOrderCreateSessionRequestSchema.parse(payload);
    try {
      const created = await this.appRepository.createPublicGroupOrderSession(tenantSlug, parsed);
      await this.realtimeGateway.emitToRoom(`groupOrder:${created.session.id}`, socketEvents.groupOrderJoined, {
        session: created.session,
        participant: created.participant,
      });
      return created;
    } catch (error) {
      if (error instanceof Error && error.message.includes("disabled")) {
        throw new ForbiddenException("Public group order disabled for tenant");
      }
      if (error instanceof Error && error.message.includes("not found")) {
        throw new NotFoundException("Public group order tenant not found");
      }
      throw new BadRequestException(error instanceof Error ? error.message : "Public group order create failed");
    }
  }

  @Post("public/:tenantSlug/group-orders/:joinCode/join")
  @Public()
  @RequiresModule("public_group_order")
  async joinPublicGroupOrderSession(
    @Param("tenantSlug") tenantSlug: string,
    @Param("joinCode") joinCode: string,
    @Body() payload: GroupOrderJoinSessionRequest,
  ): Promise<GroupOrderJoinSessionResponse> {
    const parsed = groupOrderJoinSessionRequestSchema.parse(payload);
    try {
      const joined = await this.appRepository.joinPublicGroupOrderSession(tenantSlug, joinCode, parsed);
      await this.realtimeGateway.emitToRoom(`groupOrder:${joined.session.id}`, socketEvents.groupOrderJoined, {
        session: joined.session,
        participant: joined.participant,
      });
      return joined;
    } catch (error) {
      if (error instanceof Error && error.message.includes("disabled")) {
        throw new ForbiddenException("Public group order disabled for tenant");
      }
      if (error instanceof Error && (error.message.includes("not found") || error.message.includes("expired"))) {
        throw new NotFoundException("Group order session not available");
      }
      throw new BadRequestException(error instanceof Error ? error.message : "Group order join failed");
    }
  }

  @Patch("public/:tenantSlug/group-orders/:sessionId/cart")
  @Public()
  @RequiresModule("public_group_order")
  async patchPublicGroupOrderCart(
    @Param("tenantSlug") tenantSlug: string,
    @Param("sessionId") sessionId: string,
    @Req() request: AuthenticatedRequest,
    @Body() payload: GroupOrderPatchCartRequest,
  ): Promise<GroupOrderPatchCartResponse> {
    const parsed = groupOrderPatchCartRequestSchema.parse(payload);
    const joinCode = String(request.headers["x-group-order-code"] ?? "").trim().toLowerCase();
    const participantToken = String(request.headers["x-group-order-token"] ?? "").trim();
    if (!joinCode || !participantToken) {
      throw new UnauthorizedException("Missing group order session credentials");
    }
    try {
      const updated = await this.appRepository.patchPublicGroupOrderCart(
        tenantSlug,
        sessionId,
        joinCode,
        participantToken,
        parsed,
      );
      await this.realtimeGateway.emitToRoom(`groupOrder:${sessionId}`, socketEvents.groupOrderCartUpdated, {
        session: updated.session,
        byParticipantId: updated.session.participants.find((entry) => entry.lastSeenAt === updated.session.updatedAt)?.id ?? "",
        reconciled: updated.reconciled,
      });
      return updated;
    } catch (error) {
      if (error instanceof Error && error.message.includes("authorized")) {
        throw new UnauthorizedException("Invalid group order participant token");
      }
      if (error instanceof Error && (error.message.includes("not found") || error.message.includes("expired"))) {
        throw new NotFoundException("Group order session not available");
      }
      if (error instanceof Error && error.message.includes("conflict")) {
        throw new ConflictException("Group order cart version conflict");
      }
      throw new BadRequestException(error instanceof Error ? error.message : "Group order cart update failed");
    }
  }

  @Post("public/:tenantSlug/group-orders/:sessionId/submit")
  @Public()
  @RequiresModule("public_group_order")
  async submitPublicGroupOrder(
    @Param("tenantSlug") tenantSlug: string,
    @Param("sessionId") sessionId: string,
    @Req() request: AuthenticatedRequest,
    @Body() payload: GroupOrderSubmitRequest,
  ): Promise<GroupOrderSubmitResponse> {
    const parsed = groupOrderSubmitRequestSchema.parse(payload);
    const joinCode = String(request.headers["x-group-order-code"] ?? "").trim().toLowerCase();
    const participantToken = String(request.headers["x-group-order-token"] ?? "").trim();
    if (!joinCode || !participantToken) {
      throw new UnauthorizedException("Missing group order session credentials");
    }
    try {
      const submitted = await this.appRepository.submitPublicGroupOrder(
        tenantSlug,
        sessionId,
        joinCode,
        participantToken,
        parsed,
      );
      await this.realtimeGateway.emitToRoom(`groupOrder:${sessionId}`, socketEvents.groupOrderSubmitted, submitted);
      return submitted;
    } catch (error) {
      if (error instanceof Error && error.message.includes("Only master")) {
        throw new ForbiddenException("Only master can submit group order");
      }
      if (error instanceof Error && error.message.includes("conflict")) {
        throw new ConflictException("Group order submit version conflict");
      }
      if (error instanceof Error && error.message.includes("not found")) {
        throw new NotFoundException("Group order session not available");
      }
      throw new BadRequestException(error instanceof Error ? error.message : "Group order submit failed");
    }
  }

  @Get("public/:tenantSlug/takeaway/orders/:orderId/track")
  @Public()
  @RequiresModule("public_takeaway")
  async trackPublicTakeawayOrder(
    @Param("tenantSlug") tenantSlug: string,
    @Param("orderId") orderId: string,
    @Query("token") token?: string,
  ): Promise<PublicTakeawayTrackingResponse> {
    if (!token || token.trim().length < 12) {
      throw new BadRequestException("Missing or invalid tracking token");
    }

    try {
      const payload = await this.appRepository.getPublicTakeawayTracking(tenantSlug, orderId, token.trim());
      return publicTakeawayTrackingResponseSchema.parse(payload);
    } catch (error) {
      if (error instanceof Error && error.message.includes("disabled")) {
        throw new ForbiddenException("Public takeaway disabled for tenant");
      }
      if (error instanceof Error && (error.message.includes("not found") || error.message.includes("invalid") || error.message.includes("expired"))) {
        throw new NotFoundException("Takeaway tracking not available");
      }
      throw new BadRequestException(error instanceof Error ? error.message : "Takeaway tracking failed");
    }
  }

  @Post("public/:tenantSlug/funnel/events")
  @Public()
  @RequiresModule("public_menu")
  async trackPublicFunnelEvent(
    @Param("tenantSlug") tenantSlug: string,
    @Body() payload: PublicFunnelEventRequest,
  ): Promise<PublicFunnelEventResponse> {
    const parsed = publicFunnelEventRequestSchema.parse(payload);
    await this.appRepository.trackPublicFunnelEvent(tenantSlug, parsed);
    return publicFunnelEventResponseSchema.parse({ success: true });
  }

  // ─── QZ Tray Signing Endpoint ────────────────────────────────────────────
  // Signs requests for QZ Tray message signing (silent printing).
  // The certificate must be served as a static file from /signing/digital-certificate.txt

  private async signQzDigest(request: string): Promise<string> {
    // QZ Tray sends the lowercase SHA-256 hex digest of its canonical request.
    // Never allow this endpoint to become an arbitrary signing oracle.
    if (!request || !/^[a-f0-9]{64}$/.test(request)) {
      throw new BadRequestException("'request' must be a SHA-256 hex digest");
    }

    const fs = await import("fs");
    const path = await import("path");
    const crypto = await import("crypto");
    // Keep the private signing key outside every statically served directory.
    // Deployments may provision it at an explicit path; the default resolves
    // to apps/api/signing from both src (tests) and dist (production).
    const configuredKeyPath = process.env.QZ_SIGNING_KEY_PATH?.trim();
    const keyPath = configuredKeyPath
      ? path.resolve(configuredKeyPath)
      : path.join(__dirname, "..", "signing", "private-key.pem");

    let privateKey: string;
    try {
      privateKey = fs.readFileSync(keyPath, "utf-8");
    } catch {
      throw new NotFoundException("Signing key not found. Run: openssl req -x509 -newkey rsa:2048 -keyout private-key.pem -out certificate.txt -days 365 -nodes -subj '/CN=GustoPOS'");
    }

    const sign = crypto.createSign("SHA512");
    sign.update(request);
    sign.end();
    return sign.sign(privateKey, "base64");
  }

  @Get("sign")
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @RequiresModule("printing")
  async signQzRequest(@Query("request") request: string): Promise<string> {
    return this.signQzDigest(request);
  }

  // Dedicated bridge-authenticated signing route for the Go agent. The
  // browser/JWT route above remains unchanged; the Go agent cannot use JWT.
  @Get("print-bridge/sign")
  @Public()
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  async signQzRequestForBridge(@Query("request") request: string, @Req() req: any): Promise<string> {
    const auth = await this.verifyBridgeOrOnboardingSecret(req);
    return this.withBridgeTenantContext(auth.tenantId, () => this.signQzDigest(request));
  }

  // ─── Prep Items ────────────────────────────────────────────────────────

  @Get("prep-items")
  @Roles("admin", "chef", "waiter")
  @RequiresModule("inventory")
  async getPrepItems() {
    return this.inventoryRepo.listPrepItems();
  }

  @Post("prep-items")
  @RequiresPermissions("inventory:manage")
  @Roles("admin", "chef")
  @RequiresModule("inventory")
  async createPrepItem(@Body() payload: PrepItemCreateRequest) {
    const parsed = prepItemCreateRequestSchema.parse(payload);
    try {
      return await this.inventoryRepo.createPrepItem(parsed);
    } catch (e: any) {
      throw new BadRequestException(e.message);
    }
  }

  @Patch("prep-items/:id")
  @RequiresPermissions("inventory:manage")
  @Roles("admin", "chef")
  @RequiresModule("inventory")
  async updatePrepItem(@Param("id") id: string, @Body() payload: PrepItemUpdateRequest) {
    const parsed = prepItemUpdateRequestSchema.parse(payload);
    try {
      return await this.inventoryRepo.updatePrepItem(id, parsed);
    } catch (e: any) {
      throw new BadRequestException(e.message);
    }
  }

  @Delete("prep-items/:id")
  @RequiresPermissions("inventory:manage")
  @Roles("admin", "chef")
  @RequiresModule("inventory")
  async deletePrepItem(@Param("id") id: string) {
    await this.inventoryRepo.deletePrepItem(id);
    return { success: true };
  }

  @Post("prep-items/:id/prepare")
  @RequiresPermissions("inventory:manage")
  @Roles("admin", "chef")
  @RequiresModule("inventory")
  async preparePrepItem(@Param("id") id: string, @Body() payload: { quantity: number }) {
    if (!payload.quantity || payload.quantity <= 0) {
      throw new BadRequestException("Quantity must be positive");
    }
    try {
      return await this.inventoryRepo.preparePrepItem(id, payload.quantity);
    } catch (e: any) {
      throw new BadRequestException(e.message);
    }
  }

  @Get("inventory/:id/conversions")
  @Roles("admin", "chef")
  @RequiresModule("inventory")
  async getUnitConversions(@Param("id") id: string) {
    return this.inventoryRepo.listUnitConversions(id);
  }

  @Post("inventory/:id/conversions")
  @RequiresPermissions("inventory:manage")
  @Roles("admin", "chef")
  @RequiresModule("inventory")
  async createUnitConversion(@Param("id") id: string, @Body() payload: { fromUnit: string; toUnit: string; factor: number }) {
    const parsed = unitConversionCreateRequestSchema.parse(payload);
    try {
      return await this.inventoryRepo.createUnitConversion(id, parsed);
    } catch (e: any) {
      throw new BadRequestException(e.message);
    }
  }

  @Delete("inventory/:id/conversions/:conversionId")
  @RequiresPermissions("inventory:manage")
  @Roles("admin", "chef")
  @RequiresModule("inventory")
  async deleteUnitConversion(@Param("id") id: string, @Param("conversionId") conversionId: string) {
    const ok = await this.inventoryRepo.deleteUnitConversion(id, conversionId);
    if (!ok) {
      throw new NotFoundException("Conversione non trovata");
    }
    return { success: true };
  }

  // ─── Food Cost Matrix ─────────────────────────────────────────────────

  @Get("food-cost-matrix")
  @RequiresPermissions("inventory:manage")
  @Roles("admin", "chef")
  @RequiresModule("inventory")
  async getFoodCostMatrix() {
    return this.inventoryRepo.getFoodCostMatrix();
  }

  @Patch("food-cost-matrix/cell")
  @RequiresPermissions("inventory:manage")
  @Roles("admin", "chef")
  @RequiresModule("inventory")
  async updateFoodCostMatrixCell(
    @Body() body: { menuItemId: string; ingredientId: string; quantity: number; unit: string },
  ) {
    await this.inventoryRepo.updateFoodCostMatrixCell(
      body.menuItemId,
      body.ingredientId,
      body.quantity,
      body.unit,
    );
    return { success: true };
  }

  @Post("food-cost-matrix/import")
  @RequiresPermissions("inventory:manage")
  @Roles("admin", "chef")
  @RequiresModule("inventory")
  async importFoodCostMatrix(
    @Body() body: { rows: Array<{ ingredientName: string; menuItemName: string; quantity: number; unit: string }> },
  ) {
    return this.inventoryRepo.importFoodCostMatrix(body.rows);
  }

  @Post("food-cost-matrix/import-full")
  @RequiresPermissions("inventory:manage")
  @Roles("admin", "chef")
  @RequiresModule("inventory")
  async importFoodCostFull(
    @Body() body: {
      ingredientCosts: Array<{ name: string; costPerKg: number; costPerPiece: number; gramsPerPortion: number; piecesPerPortion: number }>;
      recipeRows: Array<{ ingredientName: string; menuItemName: string; quantity: number; unit: string }>;
    },
  ) {
    return this.inventoryRepo.importFoodCostFull(body.ingredientCosts, body.recipeRows);
  }

  @Post("food-cost-matrix/import-xlsx")
  @RequiresPermissions("inventory:manage")
  @Roles("admin", "chef")
  @RequiresModule("inventory")
  async importFoodCostXlsx(
    @Body() body: { xlsxBase64: string },
  ) {
    if (!body.xlsxBase64) {
      throw new BadRequestException("xlsxBase64 is required");
    }
    const buffer = Buffer.from(body.xlsxBase64, 'base64');
    return this.inventoryRepo.importFromXlsx(buffer);
  }

  // ─── Print Bridge (server-side) ─────────────────────────────────────────────

  private get printBridgeSecret(): string | null {
    const raw = process.env.PRINT_BRIDGE_SECRET?.trim();
    return raw && raw.length > 0 ? raw : null;
  }

  private verifyBridgeSecret(req: { headers: Record<string, string | string[] | undefined> }): void {
    const expected = this.printBridgeSecret;
    if (!expected) {
      throw new UnauthorizedException("Print bridge auth not configured (PRINT_BRIDGE_SECRET)");
    }
    const provided = req.headers["x-print-bridge-key"];
    const providedStr = Array.isArray(provided) ? provided[0] : provided;
    if (!providedStr || providedStr !== expected) {
      throw new UnauthorizedException("Invalid or missing X-Print-Bridge-Key");
    }
  }

  /**
   * Disambiguate: a 6-character all-digit key is treated as an ephemeral pairing code;
   * any other length/format is the long-lived plaintext onboarding secret. The two
   * namespaces are disjoint by construction (long secrets are 38+ chars).
   */
  private isShortCode(value: string): boolean {
    return value.length === 6 && /^\d{6}$/.test(value);
  }

  /**
   * Dual auth: per-tenant onboarding secret (preferred, either long-secret or 6-digit
   * ephemeral code) OR legacy env-var (fallback). Returns the resolved tenantId so
   * the controller can upsert under the right tenant scope.
   */
  private async verifyBridgeOrOnboardingSecret(
    req: { headers: Record<string, string | string[] | undefined> },
  ): Promise<{
    tenantId: string;
    path: "onboarding" | "onboarding-short-code" | "legacy";
    plaintext?: string;
    expectedBridgeId: string;
  }> {
    const provided = req.headers["x-print-bridge-key"];
    const providedStr = Array.isArray(provided) ? provided[0] : provided;

    if (providedStr) {
      if (this.isShortCode(providedStr)) {
        const resolved = await runWithBridgeAuthContext(() =>
          this.printBridgeRepo.resolveOnboardingSecretByShortCode(providedStr),
        );
        if (resolved) {
          if (resolved.revokedAt) {
            throw new UnauthorizedException("Onboarding secret has been revoked");
          }
          return {
            tenantId: resolved.tenantId,
            path: "onboarding-short-code",
            plaintext: providedStr,
            expectedBridgeId: resolved.suggestedBridgeId,
          };
        }
      } else {
        const resolved = await runWithBridgeAuthContext(() =>
          this.printBridgeRepo.resolveOnboardingSecret(providedStr),
        );
        if (resolved) {
          if (resolved.revokedAt) {
            throw new UnauthorizedException("Onboarding secret has been revoked");
          }
          return {
            tenantId: resolved.tenantId,
            path: "onboarding",
            plaintext: providedStr,
            expectedBridgeId: resolved.suggestedBridgeId,
          };
        }
      }
    }

    this.verifyBridgeSecret(req);
    // Legacy env-var auth: use X-Bridge-Tenant-Id header if provided (multi-tenant support).
    // Fall back to DEFAULT_TENANT_ID / "tenant_legacy" for backward compatibility.
    const bridgeTenantId =
      (Array.isArray(req.headers['x-bridge-tenant-id'])
        ? req.headers['x-bridge-tenant-id'][0]
        : req.headers['x-bridge-tenant-id'])?.trim() || '';
    const fallbackTenantId = process.env.DEFAULT_TENANT_ID?.trim() || 'tenant_legacy';
    return { tenantId: bridgeTenantId || fallbackTenantId, path: "legacy", expectedBridgeId: "" };
  }

  private async withBridgeTenantContext<T>(tenantId: string, work: () => Promise<T>): Promise<T> {
    const tenant = await this.tenantService.getTenantById(tenantId);
    if (!tenant || !tenant.isActive) {
      throw new UnauthorizedException("Invalid or inactive bridge tenant");
    }
    return runWithTenantContext(
      {
        tenantId: tenant.id,
        tenantSlug: tenant.slug,
        resolutionSource: "header",
        enabledModules: [],
      },
      work,
    );
  }

  @Post("print-bridge/heartbeat")
  @Public()
  // Bridge traffic is authenticated by verifyBridgeOrOnboardingSecret; the
  // throttle is an abuse backstop, not a functional cap (a busy restaurant
  // can run several bridges behind one NAT/IP).
  @Throttle({ default: { limit: 300, ttl: 60_000 } })
  async bridgeHeartbeat(@Body() raw: unknown, @Req() req: any): Promise<{ bridge: PrintBridge; serverTime: string; fiscalPrinter?: FiscalPrinterConfig }> {
    const auth = await this.verifyBridgeOrOnboardingSecret(req);
    return this.withBridgeTenantContext(auth.tenantId, async () => {
      const heartbeatInput = raw && typeof raw === "object" && !Array.isArray(raw)
        ? {
            ...(raw as Record<string, unknown>),
            // Older browser bridges persisted null for these collection fields.
            // Normalize that legacy shape before strict contract validation.
            areas: (raw as Record<string, unknown>).areas ?? [],
            printers: (raw as Record<string, unknown>).printers ?? [],
          }
        : raw;
      const payload = printBridgeHeartbeatRequestSchema.parse(heartbeatInput);
      let bridge;
      const instanceId = (req.headers["x-bridge-instance-id"] as string | undefined)?.trim() || crypto.randomUUID();
      // Short-code pairing creates the bridge identity server-side. The Go
      // agent generates a temporary local id before it knows the suggested id;
      // canonicalize it here so the persisted bridge, onboarding record and
      // frontend wizard all refer to the same id.
      const bridgeId = auth.expectedBridgeId &&
        (auth.path === "onboarding-short-code" || auth.path === "onboarding")
        ? auth.expectedBridgeId
        : payload.bridgeId;
      try {
        bridge = await this.printBridgeRepo.upsertPrintBridge(
          {
            ...payload,
            bridgeId,
            printers: payload.printers.map((printer) => ({
              ...printer,
              area: printer.area ?? "kitchen",
              port: printer.port ?? undefined,
            })),
          },
          instanceId,
          auth.tenantId,
        );
      } catch (e) {
        if (e instanceof Error && e.message.includes("already used by another tenant")) {
          throw new ConflictException(e.message);
        }
        throw e;
      }

      if (auth.path === "onboarding" && auth.plaintext) {
        const { firstBind } = await this.printBridgeRepo.markOnboardingSecretUsed(auth.plaintext, bridge.id);
        if (firstBind) {
          try {
            this.auditLogService.log("print_bridge.first_bind", {
              targetId: bridge.id,
              details: { tenantId: bridge.tenantId, authPath: "long-secret" },
            });
          } catch {}
        }
      } else if (auth.path === "onboarding-short-code" && auth.plaintext) {
        const bindResult = await this.printBridgeRepo.markShortCodeFirstBind(auth.plaintext, bridge.id);
        if (bindResult?.firstBind) {
          try {
            this.auditLogService.log("print_bridge.first_bind", {
              targetId: bridge.id,
              details: { tenantId: bridge.tenantId, authPath: "short-code" },
            });
          } catch {}
        }
      }

      void this.realtimeGateway.emit(socketEvents.bridgeStatus, bridge, bridge.tenantId).catch((err) => console.warn('[realtime] bridge:status emit failed:', err));
      // Certified fiscal (Path B): hand the tenant's RT printer config to the
      // agent on every heartbeat so the web UI's "Salva configurazione" takes
      // effect without touching the agent's local file. Omitted when the
      // tenant never configured a device, so the agent keeps its local config.
      const fiscalPrinter = await this.fiscalBridgeRepo.getFiscalPrinterConfig();
      return {
        bridge,
        serverTime: new Date().toISOString(),
        ...(fiscalPrinter.host ? { fiscalPrinter } : {}),
      };
    });
  }

  @Post("print-bridge/claim")
  @Public()
  // See bridgeHeartbeat: claim polls every ~3s per bridge and multiple
  // bridges share the office IP; keep this a generous abuse backstop.
  @Throttle({ default: { limit: 600, ttl: 60_000 } })
  async bridgeClaim(@Body() raw: unknown, @Req() req: any): Promise<{ jobs: PrintJob[] }> {
    const auth = await this.verifyBridgeOrOnboardingSecret(req);
    return this.withBridgeTenantContext(auth.tenantId, async () => {
      const payload = printBridgeClaimRequestSchema.parse(raw);
      const instanceId = (req.headers["x-bridge-instance-id"] as string | undefined)?.trim() || crypto.randomUUID();
      const jobs: PrintJob[] = await this.printBridgeRepo.claimPrintJobsForBridge(payload.bridgeId, payload.limit ?? 50, instanceId, auth.tenantId);
      for (const job of jobs) {
        if (job.bridgeId) {
          void this.realtimeGateway.emit(socketEvents.jobClaimed, job, auth.tenantId).catch((err) => console.warn('[realtime] job:claimed emit failed:', err));
        }
      }
      return { jobs };
    });
  }

  @Post("print-bridge/jobs/:id/complete")
  @Public()
  async bridgeJobComplete(
    @Param("id") id: string,
    @Body() raw: unknown,
    @Req() req: any,
  ): Promise<{ job: PrintJob } | { success: false }> {
    const auth = await this.verifyBridgeOrOnboardingSecret(req);
    return this.withBridgeTenantContext(auth.tenantId, async () => {
      const payload = printBridgeJobCompleteRequestSchema.parse(raw);
      const instanceId = (req.headers["x-bridge-instance-id"] as string | undefined)?.trim() || crypto.randomUUID();
      const job = await this.printBridgeRepo.completeBridgeJob(payload.bridgeId, id, payload.notes, instanceId, auth.tenantId);
      if (!job) {
        return { success: false };
      }
      void this.realtimeGateway.emit(socketEvents.jobCompleted, job, auth.tenantId).catch((err) => console.warn('[realtime] job:completed emit failed:', err));
      return { job };
    });
  }

  @Post("print-bridge/jobs/:id/fail")
  @Public()
  async bridgeJobFail(
    @Param("id") id: string,
    @Body() raw: unknown,
    @Req() req: any,
  ): Promise<{ job: PrintJob } | { success: false }> {
    const auth = await this.verifyBridgeOrOnboardingSecret(req);
    return this.withBridgeTenantContext(auth.tenantId, async () => {
      const payload = printBridgeJobFailRequestSchema.parse(raw);
      const instanceId = (req.headers["x-bridge-instance-id"] as string | undefined)?.trim() || crypto.randomUUID();
      const job = await this.printBridgeRepo.failBridgeJob(payload.bridgeId, id, payload.error, instanceId, auth.tenantId);
      if (!job) {
        return { success: false };
      }
      void this.realtimeGateway.emit(socketEvents.jobFailed, job, auth.tenantId).catch((err) => console.warn('[realtime] job:failed emit failed:', err));
      return { job };
    });
  }

  @Get("print-bridge/onboarding-secret")
  @Roles("admin")
  @RequiresModule("printing")
  async listOnboardingSecrets(@Req() request: AuthenticatedRequest): Promise<PrintBridgeOnboardingSecret[]> {
    const tenantId = request.user?.tenantId ?? "tenant_legacy";
    return this.printBridgeRepo.listOnboardingSecrets(tenantId);
  }

  @Post("print-bridge/onboarding-secret")
  @Roles("admin")
  @RequiresPermissions("settings:update")
  @RequiresModule("printing")
  async createOnboardingSecret(
    @Body() raw: unknown,
    @Req() request: AuthenticatedRequest,
  ): Promise<PrintBridgeOnboardingSecretCreateResponse | PrintBridgeOnboardingSecretCreateCode6DigitResponse> {
    const parsed = printBridgeOnboardingSecretCreateRequestSchema.parse(raw ?? {});
    const tenantId = (this.appRepository as any).currentTenantId?.() ?? "tenant_legacy";
    const actorStaffId = request.user?.sub ?? null;
    let created;
    try {
      created = await this.printBridgeRepo.createOnboardingSecret(
        tenantId,
        actorStaffId,
        parsed.bridgeIdHint,
        parsed.mode ?? "long",
        { publicBaseUrl: parsed.publicBaseUrl },
      );
    } catch (e: any) {
      if (e instanceof Error && e.message.includes("SHORT_CODE_PEPPER")) {
        throw new BadRequestException(
          "Server is not configured to issue 6-digit pairing codes (missing SHORT_CODE_PEPPER env var). Use mode='long' or set the env var.",
        );
      }
      throw e;
    }
    try {
      this.auditLogService.log("print_bridge.onboarding_secret.created", {
        actorStaffId: actorStaffId ?? undefined,
        targetId: created.mode === "code-6digit" ? created.secretId : created.secret.id,
        details: {
          tenantId,
          mode: created.mode,
          suggestedBridgeId: created.suggestedBridgeId,
        },
      });
    } catch {}
    return created;
  }

  @Delete("print-bridge/onboarding-secret/:id")
  @Roles("admin")
  @RequiresPermissions("settings:update")
  @RequiresModule("printing")
  async revokeOnboardingSecret(
    @Param("id") id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<{ success: true; id: string }> {
    const tenantId = request.user?.tenantId ?? "tenant_legacy";
    await this.printBridgeRepo.revokeOnboardingSecret(tenantId, id);
    try {
      this.auditLogService.log("print_bridge.onboarding_secret.revoked", {
        actorStaffId: request.user?.sub ?? undefined,
        targetId: id,
        details: { tenantId },
      });
    } catch {}
    return { success: true, id };
  }

  @Get("print-bridge")
  @Roles("admin")
  @RequiresModule("printing")
  async listPrintBridges(): Promise<PrintBridge[]> {
    return this.printBridgeRepo.listPrintBridges();
  }

  @Patch("print-bridge/:id/mappings")
  @Roles("admin")
  @RequiresModule("printing")
  async updateBridgeMappings(
    @Param("id") id: string,
    @Body() payload: PrintBridgeUpdateMappingsRequest,
  ): Promise<{ bridge: PrintBridge }> {
    const parsed = printBridgeUpdateMappingsRequestSchema.parse(payload);
    const bridge = await this.printBridgeRepo.updateBridgeMappings(id, parsed.mappings as any);
    this.realtimeGateway
      .emit(socketEvents.bridgeStatus, bridge, bridge.tenantId ?? "tenant_legacy")
      .catch((err: unknown) => console.warn("[realtime] bridge:status emit failed:", err));
    return { bridge };
  }

  @Patch("print-bridge/:id/claimed-areas")
  @Roles("admin")
  @RequiresModule("printing")
  async updateBridgeClaimedAreas(
    @Param("id") id: string,
    @Body() payload: PrintBridgeUpdateClaimedAreasRequest,
  ): Promise<{ bridge: PrintBridge }> {
    const parsed = printBridgeUpdateClaimedAreasRequestSchema.parse(payload);
    const bridge = await this.printBridgeRepo.updateBridgeClaimedAreas(id, parsed.claimedAreas as any);
    this.realtimeGateway
      .emit(socketEvents.bridgeStatus, bridge, bridge.tenantId ?? "tenant_legacy")
      .catch((err: unknown) => console.warn("[realtime] bridge:status emit failed:", err));
    return { bridge };
  }

  @Delete("print-bridge/:id")
  @Roles("admin")
  @RequiresPermissions("settings:update")
  @RequiresModule("printing")
  async deletePrintBridge(
    @Param("id") id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<{ success: true; id: string }> {
    const ok = await this.printBridgeRepo.deletePrintBridge(id);
    if (!ok) {
      throw new NotFoundException("Print bridge not found");
    }
    try {
      this.auditLogService.log("print_bridge.deleted", {
        actorStaffId: request.user?.sub ?? undefined,
        targetId: id,
        details: { tenantId: request.user?.tenantId },
      });
    } catch {}
    // Keep other admin sessions in sync: the revoked agent will not heartbeat
    // anymore, so without this event the pool would keep a stale offline card.
    void this.realtimeGateway
      .emit(socketEvents.bridgeRemoved, { id }, request.user?.tenantId)
      .catch((err: unknown) => console.warn("[realtime] bridge:removed emit failed:", err));
    return { success: true, id };
  }

  @Post("print-bridge/:id/test-print")
  @Roles("admin")
  @RequiresModule("printing")
  async testPrintFromBridge(
    @Param("id") id: string,
    @Body() payload: PrintBridgeTestPrintRequest,
  ): Promise<PrintBridgeTestPrintResponse> {
    const parsed = printBridgeTestPrintRequestSchema.parse(payload);
    const result = await this.appRepository.testPrintFromBridge(id, (parsed.area ?? 'kitchen') as any, parsed.message);
// CASCADE_APPCONTROLLER_TESTPRINT_AREA_DONE
    return { ...result, success: true } as PrintBridgeTestPrintResponse;
    /* CASCADE2_TESTPRINT_RETURN_DONE */
  }
}

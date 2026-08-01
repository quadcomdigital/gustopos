import { create } from 'zustand';
import { authorizedFetch, API_URL } from '../shared/api/client';
import { persist } from 'zustand/middleware';
import {
  socketEvents,
  type OrdersUpdatePatch,
  type Table,
  type AppData,
  type BomCreateRequest,
  type BomItem,
  type BomUpdateRequest,
  type BomUpsertComponentsRequest,
  type Category,
  type CategoryCreateRequest,
  type CategoryUpdateRequest,
  type CreateOrderRequest,
  type CloseTableRequest,
  type CloseTableResponse,
  type Ingredient,
  type IngredientCreateRequest,
  type IngredientUpdateRequest,
  type LogoutResponse,
  type MenuItemAdmin,
  type ModuleKey,
  type MenuItemCreateRequest,
  type MenuItemReplaceRecipeRequest,
  type MenuItemUpdateRequest,
  type Order,
  type PayTableResponse,
  type Payment,
  type PaymentFilters,
  type RefundPaymentRequest,
  type RefundPaymentResponse,
  type DispatchPrintJobRequest,
  type DeliveryUpsertRequest,
  type Reservation,
  type ReservationCreateRequest,
  type ReservationUpdateRequest,
  type ReservationsQuery,
  type DeliveryOrder,
  type DeliveryOrdersQuery,
  type DeliveryStatusUpdateRequest,
  type Supplier,
  type SupplierCreateRequest,
  type SupplierUpdateRequest,
  type SuppliersQuery,
  type PurchaseOrder,
  type PurchaseOrderCreateRequest,
  type PurchaseOrderStatusUpdateRequest,
  type PurchaseOrdersQuery,
  type GoodsReceipt,
  type GoodsReceiptCreateRequest,
  type Shift,
  type ShiftCreateRequest,
  type ShiftUpdateRequest,
  type ShiftsQuery,
  type TimeEntry,
  type ClockInRequest,
  type ClockOutRequest,
  type TimeReportQuery,
  type TimeReportResponse,
  type FiscalExport,
  type FiscalCloseRequest,
  type FiscalClosure,
  type FiscalExportCreateRequest,
  type FiscalExportsQuery,
  type PrintJob,
  type PrintJobsQuery,
  type Customer,
  type CustomerCreateRequest,
  type CustomerUpdateRequest,
  type CustomerAddressCreateRequest,
  type CustomerAddressUpdateRequest,
  type CustomersQuery,
  type CustomerAnalytics,
  type CustomerAnalyticsRequest,
  type OrderHistoryFilters,
  type SplitBillRequest,
  type SplitBillResponse,
  type PaySelectedItemsRequest,
  type PaySelectedItemsResponse,
  type MarkShareAsPaidRequest,
  type MarkShareAsPaidResponse,
  type StaffAdmin,
  type StaffCreateRequest,
  type StaffResetPinRequest,
  type Staff,
  type StaffUpdateRequest,
  type TransferTableRequest,
  type TransferTableResponse,
  type SelfOrderSessionRotateResponse,
  type UiSettings,
  defaultUiSettings,
  updateUiSettingsRequestSchema,
  type UpdateOrderRequest,
  type VoidOrderRequest,
  type VoidOrderResponse,
  type LoyaltyBalance,
  type LoyaltyTransaction,
  type TableCreateRequest,
  type TableUpdateRequest,
  type TableBulkCreateRequest,
  type CategoryModifierPool,
  type CategoryModifierPoolCreateRequest,
  type CategoryModifierPoolUpdateRequest,
  type CartItem,
  type LocalBridgeConfig,
  type LocalBridgeArea,
  type PrintBridge,
  type PrintBridgeOnboardingSecret,
  type PrintBridgeOnboardingSecretCreateCode6DigitResponse,
  type PrepItem,
  type PrepItemUpdateRequest,
  type UnitConversion,
  type UnitConversionCreateRequest,
  type PreparePrepItemResponse,
  type PrintBridgePrinterMapping,

} from '@gustopos/shared';
import {
  clearAuthSession,
  createBomItem as createBomItemRequest,
  createCategory as createCategoryRequest,
  createSimpleCatalogCategory as createSimpleCatalogCategoryRequest,
  createOrReuseCustomer as createOrReuseCustomerRequest,
  updateCustomer as updateCustomerRequest,
  deleteCustomer as deleteCustomerRequest,
  fetchCustomerAddresses as fetchCustomerAddressesRequest,
  createCustomerAddress as createCustomerAddressRequest,
  updateCustomerAddress as updateCustomerAddressRequest,
  deleteCustomerAddress as deleteCustomerAddressRequest,
  createIngredient as createIngredientRequest,
  createAdminStaff,
  createMenuItem as createMenuItemRequest,
  createSimpleCatalogItem as createSimpleCatalogItemRequest,
  closeTable as closeTableRequest,
  createOrder,
  fetchBomItems,
  fetchData,
  fetchBootstrap,
  fetchInventory,
  fetchCategories,
  fetchSimpleCatalogCategories,
  fetchCustomers,
  fetchCustomerAnalytics,
  fetchAdminStaff,
  fetchMenuItemsAdmin,
  fetchSimpleCatalogItemsAdmin,
  fetchOrderHistory,
  fetchPayments,
  fetchPrintJobs,
  fetchUiSettings,
  fetchStaff,
  getStoredUser,
  hasAuthSession,
  login,
  type TablePaymentStatus,
  logout as logoutRequest,
  payTable,
  splitBill as splitBillRequest,
  paySelectedItems as paySelectedItemsRequest,
  markShareAsPaid as markShareAsPaidRequest,
  getTablePaymentStatus as getTablePaymentStatusRequest,
  transferTable as transferTableRequest,
  rotateSelfOrderQrSession,
  replaceBomComponents as replaceBomComponentsRequest,
  addBomComponent as addBomComponentRequest,
  removeBomComponent as removeBomComponentRequest,
  updateBomItem as updateBomItemRequest,
  deleteBomItem as deleteBomItemRequest,
  replaceMenuItemRecipe as replaceMenuItemRecipeRequest,
  addMenuItemRecipeComponent as addMenuItemRecipeComponentRequest,
  removeMenuItemRecipeComponent as removeMenuItemRecipeComponentRequest,
  refreshSession,
  refundPayment as refundPaymentRequest,
  resetAdminStaffPin,
  setAdminStaffActiveState,
  setMenuItemActiveState,
  setSimpleCatalogItemActiveState,
  updateAdminStaff,
  updateIngredient as updateIngredientRequest,
  updateCategory as updateCategoryRequest,
  updateSimpleCatalogCategory as updateSimpleCatalogCategoryRequest,
  fetchCategoryModifierPools,
  createCategoryModifierPool as createCategoryModifierPoolRequest,
  updateCategoryModifierPool as updateCategoryModifierPoolRequest,
  deleteCategoryModifierPool as deleteCategoryModifierPoolRequest,
  updateMenuItem as updateMenuItemRequest,
  updateSimpleCatalogItem as updateSimpleCatalogItemRequest,
  updatePrintingSettings as updatePrintingSettingsRequest,
  updateUiSettings as updateUiSettingsRequest,
  updateOrder,
  updateOrderItemQuantity,
  voidOrder as voidOrderRequest,
  dispatchPrintJob as dispatchPrintJobRequest,
  upsertDeliveryOrder as upsertDeliveryOrderRequest,
  deleteIngredient as deleteIngredientRequest,
  adjustIngredient as adjustIngredientRequest,
  deleteMenuItem as deleteMenuItemRequest,
  fetchReservations,
  createReservation as createReservationRequest,
  updateReservation as updateReservationRequest,
  confirmReservation as confirmReservationRequest,
  cancelReservation as cancelReservationRequest,
  markReservationNoShow as markReservationNoShowRequest,
  fetchDeliveryOrders as fetchDeliveryOrdersRequest,
  updateDeliveryOrderStatus as updateDeliveryOrderStatusRequest,
  dispatchDeliveryOrder as dispatchDeliveryOrderRequest,
  fetchSuppliers,
  createSupplier as createSupplierRequest,
  updateSupplier as updateSupplierRequest,
  fetchPurchaseOrders,
  createPurchaseOrder as createPurchaseOrderRequest,
  updatePurchaseOrderStatus as updatePurchaseOrderStatusRequest,
  createGoodsReceipt as createGoodsReceiptRequest,
  fetchShifts,
  createShift as createShiftRequest,
  updateShift as updateShiftRequest,
  clockIn as clockInRequest,
  clockOut as clockOutRequest,
  fetchTimeReport,
  fetchFiscalExports,
  closeFiscalDay as closeFiscalDayRequest,
  createFiscalExport as createFiscalExportRequest,
  downloadFiscalExportCsv,
  fetchLoyaltyBalance,
  earnLoyaltyPoints,
  redeemLoyaltyPoints,
  fetchLoyaltyTransactions,
  fetchTables,
  createTable as createTableRequest,
  bulkCreateTables as bulkCreateTablesRequest,
  updateTable as updateTableRequest,
  deleteTable as deleteTableRequest,
  deleteCategory as deleteCategoryRequest,
  createOnboardingSecret as createOnboardingSecretRequest,
  createShortCodePairingRequest,
  revokeOnboardingSecret as revokeOnboardingSecretRequest,
  updateBridgeMappings,
  updateBridgeClaimedAreas,
  listOnboardingSecrets as listOnboardingSecretsRequest,
  triggerBridgeTestPrint as triggerBridgeTestPrintRequest,

} from '../shared/api/client';
import { disconnectSocket, getSocket } from '../shared/api/socket';
import { applyUiTheme } from '../lib/theme';
import { uiActionPolicyMatrix } from '../shared/authz/policy';
import {
  isReservationsQueryFresh,
  normalizeReservationsQuery,
  reservationsQueryKey,
} from './reservations-cache';

let reservationsRequestSequence = 0;
const reservationsInFlight = new Map<string, { requestId: number; promise: Promise<void> }>();

function invalidateReservationsCache(): Pick<AppState, 'reservations' | 'reservationsQuery' | 'reservationsQueryKey' | 'reservationsFetchedAt'> {
  reservationsRequestSequence += 1;
  reservationsInFlight.clear();
  return {
    reservations: [],
    reservationsQuery: null,
    reservationsQueryKey: null,
    reservationsFetchedAt: null,
  };
}

async function refreshCurrentReservations(get: () => AppState): Promise<void> {
  const state = get();
  await state.refreshReservations(state.reservationsQuery ?? { limit: 200 }, true);
}

type StoreSet = (
  partial: Partial<AppState> | ((state: AppState) => Partial<AppState>),
  replace?: false | undefined,
) => void;

function normalizeEnabledModules(enabledModules: ModuleKey[]): ModuleKey[] {
  let result = enabledModules;
  if (result.includes('inventory')) {
    result = result.filter((moduleKey) => moduleKey !== 'simple_catalog');
  }
  if (!result.includes('customers')) {
    result = result.filter((moduleKey) => moduleKey !== 'loyalty_points');
  }
  return result;
}

function createEmptyAppData(): AppData {
  return {
    orders: [],
    inventory: [],
    bomItems: [],
    menu: [],
    staff: [],
    tables: [],
    categories: [],
    categoryModifierPools: [],
  };
}

function attachSocketListeners(set: StoreSet, get: () => AppState) {
  const socket = getSocket();

  socket.off(socketEvents.orderNew);
  socket.off(socketEvents.orderUpdate);
  socket.off(socketEvents.ordersUpdate);
  socket.off(socketEvents.inventoryUpdate);
  socket.off(socketEvents.tablesUpdate);
  socket.off(socketEvents.dataUpdate);
  socket.off(socketEvents.settingsUpdate);
  socket.off(socketEvents.bridgeStatus);
  socket.off(socketEvents.jobClaimed);
  socket.off(socketEvents.jobCompleted);
  socket.off(socketEvents.jobFailed);

  socket.on(socketEvents.orderNew, (newOrder: Order) => {
    if (!hasModuleEnabled(get(), 'kitchen')) {
      return;
    }
    // Audio alert for new orders (chef/admin only)
    const role = get().currentUser?.role;
    if (role === 'chef' || role === 'admin') {
      try {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 800;
        gain.gain.value = 0.3;
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.stop(ctx.currentTime + 0.3);
      } catch { /* Audio not available */ }
    }
    set((state: AppState) =>
      state.data
        ? { data: { ...state.data, orders: [...state.data.orders, newOrder] } }
        : state,
    );
  });

  socket.on(socketEvents.orderUpdate, (updatedOrder: Order) => {
    if (!hasModuleEnabled(get(), 'kitchen')) {
      return;
    }
    set((state: AppState) => {
      if (!state.data) return state;
      // Mirror getPublicData: paid/cancelled orders are excluded from the list.
      if (updatedOrder.status === 'paid' || updatedOrder.status === 'cancelled') {
        return {
          data: {
            ...state.data,
            orders: state.data.orders.filter((order) => order.id !== updatedOrder.id),
          },
        };
      }
      return {
        data: {
          ...state.data,
          orders: state.data.orders.map((order) =>
            order.id === updatedOrder.id ? updatedOrder : order,
          ),
        },
      };
    });
  });

  // Targeted order patches (set_paid / move) — sostituiscono il full data:update.
  socket.on(socketEvents.ordersUpdate, (patch: OrdersUpdatePatch) => {
    if (!hasModuleEnabled(get(), 'kitchen')) {
      return;
    }
    set((state: AppState) => {
      if (!state.data) return state;
      if (patch.action === 'set_paid') {
        return {
          data: {
            ...state.data,
            // Mirror getPublicData: every order on a paid table is excluded.
            // Invariant: the server emits set_paid ONLY when the whole table is
            // paid (closeTable / allItemsPaid / allSharesPaid), never partial.
            orders: state.data.orders.filter((order) => order.table !== patch.tableNumber),
          },
        };
      }
      if (patch.action === 'move') {
        return {
          data: {
            ...state.data,
            orders: state.data.orders.map((order) =>
              order.table === patch.fromTableNumber
                ? { ...order, table: patch.toTableNumber }
                : order,
            ),
          },
        };
      }
      return state;
    });
  });

  socket.on(socketEvents.tablesUpdate, (tables: Table[]) => {
    if (!hasModuleEnabled(get(), 'kitchen')) {
      return;
    }
    set((state: AppState) =>
      state.data ? { data: { ...state.data, tables } } : state,
    );
  });

  socket.on(socketEvents.inventoryUpdate, (inventory) => {
    if (!hasModuleEnabled(get(), 'inventory')) {
      return;
    }
    set((state: AppState) =>
      state.data ? { data: { ...state.data, inventory }, inventoryItems: inventory } : { inventoryItems: inventory },
    );
  });

  // Compatibility fallback: the API no longer emits full data:update snapshots
  // (mutations now send targeted orders:update/tables:update), but keep this
  // handler so a mixed-version deployment never leaves a client stale.
  socket.on(socketEvents.dataUpdate, (payload: AppData) => {
    set({ data: payload, inventoryItems: payload.inventory });
  });

  socket.on(socketEvents.settingsUpdate, (payload: UiSettings) => {
    const parsed = updateUiSettingsRequestSchema.parse(payload);
    applyUiTheme(parsed);
    set({ uiSettings: parsed });
  });

  // ─── Print-bridge pool (Phase E) realtime ────────────────────────────────
  // The server emits fully-typed PrintBridge / PrintJob on these events.
  // We narrow with an explicit runtime id guard so the helpers can accept
  // the full types and the spread in printJobUpsert is type-safe end-to-end.
  socket.on(socketEvents.bridgeStatus, (incoming: PrintBridge | undefined | null) => {
    if (!incoming || typeof incoming.id !== 'string') return;
    set((state: AppState) => ({
      printBridges: printBridgesUpsert(state.printBridges, incoming),
      printBridgesLastFetchedAt: new Date().toISOString(),
    }));
  });

  socket.on(socketEvents.jobClaimed, (incoming: PrintJob | undefined | null) => {
    if (!incoming || typeof incoming.id !== 'string') return;
    set((state: AppState) => ({
      printJobs: printJobUpsert(state.printJobs, incoming),
    }));
  });

  socket.on(socketEvents.jobCompleted, (incoming: PrintJob | undefined | null) => {
    if (!incoming || typeof incoming.id !== 'string') return;
    set((state: AppState) => ({
      printJobs: printJobUpsert(state.printJobs, { ...incoming, status: 'completed' }),
    }));
  });

  socket.on(socketEvents.jobFailed, (incoming: PrintJob | undefined | null) => {
    if (!incoming || typeof incoming.id !== 'string') return;
    set((state: AppState) => ({
      printJobs: printJobUpsert(state.printJobs, { ...incoming, status: 'failed' }),
    }));
  });
}

// Rolling-window cap for realtime job events in the store. The Print Jobs
// admin tab also has its own pagination; this just keeps the in-memory list
// bounded so mobile sessions don't grow without limit.
const PRINT_JOB_ROLLING_WINDOW = 200;

// Upsert helper for realtime job events: replace by id, append otherwise.
// Trims to PRINT_JOB_ROLLING_WINDOW, most-recent first.
function printJobUpsert(existing: PrintJob[], incoming: PrintJob): PrintJob[] {
  const idx = existing.findIndex((j) => j.id === incoming.id);
  const merged = idx >= 0
    ? existing.map((j, i) => (i === idx ? { ...j, ...incoming } : j))
    : [...existing, incoming];
  merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return merged.slice(0, PRINT_JOB_ROLLING_WINDOW);
}

// Upsert helper for realtime bridge status: replace by id, append when the
// bridge is brand-new (its first event is one of these pushes rather than a
// refreshPrintBridges() result). No rolling window needed — the bridge pool
// is bounded by tenant size.
function printBridgesUpsert(existing: PrintBridge[], incoming: PrintBridge): PrintBridge[] {
  const idx = existing.findIndex((b) => b.id === incoming.id);
  if (idx >= 0) {
    return existing.map((b, i) => (i === idx ? { ...b, ...incoming } : b));
  }
  return [...existing, incoming];
}

function areSameModules(left: ModuleKey[], right: ModuleKey[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  return left.every((moduleKey) => right.includes(moduleKey));
}

function areSamePermissions(left: string[] = [], right: string[] = []): boolean {
  if (left.length !== right.length) {
    return false;
  }
  return left.every((permission) => right.includes(permission));
}

function areSameUsers(left: Staff | null, right: Staff | null): boolean {
  if (left === right) {
    return true;
  }
  if (!left || !right) {
    return false;
  }
  return left.id === right.id
    && left.tenantId === right.tenantId
    && left.role === right.role
    && left.name === right.name
    && areSameModules(left.enabledModules ?? [], right.enabledModules ?? [])
    && areSamePermissions(left.permissions ?? [], right.permissions ?? []);
}

interface AppState {
  loading: boolean;
  error: string | null;
  tenantContext: { tenantId: string; tenantSlug?: string } | null;
  enabledModules: ModuleKey[];
  permissions: string[];
  offlineQueue: Array<{ id: string; moduleKey: ModuleKey; payload: unknown; createdAt: string }>;
  data: AppData | null;
  staff: Staff[];
  staffAdmin: StaffAdmin[];
  payments: Payment[];
  printJobs: PrintJob[];
  reservations: Reservation[];
  reservationsQuery: ReservationsQuery | null;
  reservationsQueryKey: string | null;
  reservationsFetchedAt: number | null;
  deliveryOrders: DeliveryOrder[];
  categories: Category[];
  customers: Customer[];
  orderHistory: Order[];
  customerAnalytics: CustomerAnalytics | null;
  suppliers: Supplier[];
  purchaseOrders: PurchaseOrder[];
  shifts: Shift[];
  timeEntries: TimeEntry[];
  fiscalExports: FiscalExport[];
  inventoryItems: Ingredient[];
  bomItems: BomItem[];
  bomStock: any[];
  menuItemsAdmin: MenuItemAdmin[];
  currentUser: Staff | null;
  uiSettings: UiSettings;
  loyaltyBalance: LoyaltyBalance | null;
  loyaltyTransactions: LoyaltyTransaction[];
  posCart: CartItem[];
  cartStore: Record<string, CartItem[]>;
  cartContextKey: string;
  posOrderMode: 'dine_in' | 'takeaway' | 'delivery';
  posTableNumber: string;
  posMenuSearch: string;
  initDone: boolean;
  hydrate: () => Promise<void>;
  syncSessionModules: () => Promise<void>;
  loginWithPin: (staffId: string, pin: string) => Promise<boolean>;
  logout: () => Promise<void>;
  createOrder: (order: CreateOrderRequest) => Promise<Order>;
  upsertDeliveryOrder: (orderId: string, payload: DeliveryUpsertRequest) => Promise<void>;
  updateOrderItemQuantity: (orderId: string, orderItemId: number, quantity: number) => Promise<Order>;
  updateOrder: (id: string, updates: UpdateOrderRequest) => Promise<Order>;
  voidOrder: (id: string, payload: VoidOrderRequest) => Promise<VoidOrderResponse>;
  payTable: (tableId: string) => Promise<PayTableResponse>;
  closeTable: (tableId: string, payload: CloseTableRequest) => Promise<CloseTableResponse>;
  splitBill: (tableId: string, payload: SplitBillRequest) => Promise<SplitBillResponse>;
  paySelectedItems: (tableId: string, payload: PaySelectedItemsRequest) => Promise<PaySelectedItemsResponse>;
  markShareAsPaid: (tableId: string, shareIndex: number, payload: MarkShareAsPaidRequest) => Promise<MarkShareAsPaidResponse>;
  getTablePaymentStatus: (tableId: string) => Promise<TablePaymentStatus>;
  transferTable: (
    sourceTableId: string,
    payload: TransferTableRequest,
  ) => Promise<TransferTableResponse>;
  rotateSelfOrderQrForTable: (tableId: string) => Promise<SelfOrderSessionRotateResponse>;
  refreshStaffAdmin: () => Promise<void>;
  createStaffAdmin: (payload: StaffCreateRequest) => Promise<void>;
  updateStaffAdmin: (id: string, payload: StaffUpdateRequest) => Promise<void>;
  resetStaffPinAdmin: (id: string, payload: StaffResetPinRequest) => Promise<LogoutResponse>;
  setStaffActiveAdmin: (id: string, active: boolean) => Promise<LogoutResponse>;
  refreshPayments: (filters?: PaymentFilters) => Promise<void>;
  refundPayment: (id: string, payload: RefundPaymentRequest) => Promise<RefundPaymentResponse>;
  refreshPrintJobs: (query?: PrintJobsQuery) => Promise<void>;
  dispatchPrintJob: (id: string, payload?: DispatchPrintJobRequest) => Promise<void>;
  refreshCategories: (scope?: Category['scope']) => Promise<void>;
  createCategory: (payload: CategoryCreateRequest) => Promise<void>;
  updateCategory: (id: string, payload: CategoryUpdateRequest) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  categoryModifierPools: CategoryModifierPool[];
  refreshCategoryModifierPools: () => Promise<void>;
  createCategoryModifierPool: (payload: CategoryModifierPoolCreateRequest) => Promise<void>;
  updateCategoryModifierPool: (id: string, payload: CategoryModifierPoolUpdateRequest) => Promise<void>;
  deleteCategoryModifierPool: (id: string) => Promise<void>;
  refreshTables: () => Promise<void>;
  createTable: (payload: TableCreateRequest) => Promise<void>;
  bulkCreateTables: (payload: TableBulkCreateRequest) => Promise<void>;
  updateTable: (id: string, payload: TableUpdateRequest) => Promise<void>;
  deleteTable: (id: string) => Promise<void>;
  refreshCustomers: (query?: CustomersQuery) => Promise<void>;
  createOrReuseCustomer: (payload: CustomerCreateRequest) => Promise<Customer>;
  updateCustomer: (id: string, payload: CustomerUpdateRequest) => Promise<Customer>;
  deleteCustomer: (id: string) => Promise<void>;
  refreshCustomerAddresses: (customerId: string) => Promise<void>;
  createCustomerAddress: (customerId: string, payload: CustomerAddressCreateRequest) => Promise<void>;
  updateCustomerAddress: (customerId: string, addressId: string, payload: CustomerAddressUpdateRequest) => Promise<void>;
  deleteCustomerAddress: (customerId: string, addressId: string) => Promise<void>;
  refreshOrderHistory: (filters?: OrderHistoryFilters) => Promise<void>;
  refreshCustomerAnalytics: (payload?: CustomerAnalyticsRequest) => Promise<void>;
  refreshBomItems: () => Promise<void>;
  createBomItem: (payload: BomCreateRequest) => Promise<void>;
  updateBomItem: (id: string, payload: BomUpdateRequest) => Promise<void>;
  replaceBomComponents: (id: string, payload: BomUpsertComponentsRequest) => Promise<void>;
  addBomComponent: (id: string, payload: { componentType: 'ingredient' | 'bom' | 'prep'; componentId: string; quantity: number; unit: string }) => Promise<void>;
  removeBomComponent: (id: string, payload: { componentType: 'ingredient' | 'bom' | 'prep'; componentId: string }) => Promise<void>;
  deleteBomItem: (id: string) => Promise<void>;
  refreshInventoryItems: () => Promise<void>;
  createIngredient: (payload: IngredientCreateRequest) => Promise<void>;
  updateIngredient: (id: string, payload: IngredientUpdateRequest) => Promise<void>;
  deleteIngredient: (id: string) => Promise<void>;
  adjustIngredient: (id: string, payload: { quantity: number; notes?: string }) => Promise<void>;
  refreshMenuItemsAdmin: () => Promise<void>;
  createMenuItem: (payload: MenuItemCreateRequest) => Promise<void>;
  updateMenuItem: (id: string, payload: MenuItemUpdateRequest) => Promise<void>;
  replaceMenuItemRecipe: (id: string, payload: MenuItemReplaceRecipeRequest) => Promise<void>;
  addMenuItemRecipeComponent: (id: string, payload: { componentType: 'ingredient' | 'bom' | 'prep'; componentId: string; quantity: number; unit: string }) => Promise<void>;
  removeMenuItemRecipeComponent: (id: string, payload: { componentType: 'ingredient' | 'bom' | 'prep'; componentId: string }) => Promise<void>;
  setMenuItemActiveAdmin: (id: string, active: boolean) => Promise<void>;
  deleteMenuItemAdmin: (id: string) => Promise<void>;
  refreshUiSettings: () => Promise<void>;
  updateUiSettings: (payload: UiSettings) => Promise<void>;
  updatePrintingSettings: (payload: { printing: Partial<UiSettings['printing']> }) => Promise<void>;
  refreshReservations: (query?: ReservationsQuery, force?: boolean) => Promise<void>;
  createReservation: (payload: ReservationCreateRequest) => Promise<void>;
  updateReservation: (id: string, payload: ReservationUpdateRequest) => Promise<void>;
  confirmReservation: (id: string) => Promise<void>;
  cancelReservation: (id: string) => Promise<void>;
  markReservationNoShow: (id: string, reason: string) => Promise<void>;
  refreshDeliveryOrders: (query?: DeliveryOrdersQuery) => Promise<void>;
  updateDeliveryOrderStatus: (orderId: string, payload: DeliveryStatusUpdateRequest) => Promise<void>;
  dispatchDeliveryOrder: (orderId: string) => Promise<void>;

  refreshSuppliers: (query?: SuppliersQuery) => Promise<void>;
  createSupplier: (payload: SupplierCreateRequest) => Promise<void>;
  updateSupplier: (id: string, payload: SupplierUpdateRequest) => Promise<void>;
  refreshPurchaseOrders: (query?: PurchaseOrdersQuery) => Promise<void>;
  createPurchaseOrder: (payload: PurchaseOrderCreateRequest) => Promise<void>;
  updatePurchaseOrderStatus: (id: string, payload: PurchaseOrderStatusUpdateRequest) => Promise<void>;
  createGoodsReceipt: (orderId: string, payload: GoodsReceiptCreateRequest) => Promise<GoodsReceipt>;
  refreshShifts: (query?: ShiftsQuery) => Promise<void>;
  createShift: (payload: ShiftCreateRequest) => Promise<void>;
  updateShift: (id: string, payload: ShiftUpdateRequest) => Promise<void>;
  clockIn: (payload: ClockInRequest) => Promise<TimeEntry>;
  clockOut: (payload: ClockOutRequest) => Promise<TimeEntry>;
  refreshTimeReport: (query: TimeReportQuery) => Promise<TimeReportResponse>;
  refreshFiscalExports: (query?: FiscalExportsQuery) => Promise<void>;
  closeFiscalDay: (payload: FiscalCloseRequest) => Promise<FiscalClosure>;
  createFiscalExport: (payload: FiscalExportCreateRequest) => Promise<FiscalExport>;
  downloadFiscalExportCsv: (id: string) => Promise<string>;
  refreshLoyaltyBalance: (customerId: string) => Promise<void>;
  redeemLoyaltyPoints: (customerId: string, points: number, orderId?: string) => Promise<void>;
  earnLoyaltyPointsAction: (customerId: string, points: number, orderId?: string, notes?: string) => Promise<void>;
  refreshLoyaltyTransactions: (customerId: string, limit?: number) => Promise<void>;
  clearError: () => void;
  addToPosCart: (item: Omit<CartItem, 'cartItemId'>) => void;
  updatePosCartItem: (cartItemId: string, updates: Partial<CartItem>) => void;
  removeFromPosCart: (cartItemId: string) => void;
  clearPosCart: () => void;
  setCartContext: (key: string) => void;

  // ─── Print-bridge pool (Phase E) ───────────────────────────────────────
  printBridges: PrintBridge[];
  printBridgesLastFetchedAt: string | null;
  onboardingSecrets: PrintBridgeOnboardingSecret[];
  refreshPrintBridges: () => Promise<void>;
  updateBridgeMappings: (bridgeId: string, mappings: PrintBridgePrinterMapping[]) => Promise<void>;
  updateBridgeClaimedAreas: (bridgeId: string, claimedAreas: LocalBridgeArea[]) => Promise<void>;
  triggerBridgeTestPrint: (bridgeId: string, area: LocalBridgeArea) => Promise<void>;
  refreshOnboardingSecrets: () => Promise<void>;
  createOnboardingSecret: (hint?: { bridgeIdHint?: string }) => Promise<{ plaintext: string; suggestedBridgeId: string; bootstrapSnippet: string }>;
  createShortCodePairing: (input?: { bridgeIdHint?: string; publicBaseUrl?: string }) => Promise<PrintBridgeOnboardingSecretCreateCode6DigitResponse>;
  revokeOnboardingSecret: (id: string) => Promise<void>;
  // ─── Local browser-bridge slice (Phase E) ──────────────────────────────────
  localBridgeConfig: LocalBridgeConfig | null;
  localBridgeLastError: string | null;
  setLocalBridgeConfig: (config: LocalBridgeConfig | null) => void;
  setLocalBridgeActive: (active: boolean) => void;
  setLocalBridgeLastError: (msg: string | null) => void;
  authToken: string | null;
  // ─── Prep items (Phase E) ───────────────────────────────────
  prepItems: PrepItem[];
  prepItemsLastFetchedAt: string | null;
  refreshPrepItems: () => Promise<void>;
  fetchUnitConversions: (inventoryId: string) => Promise<UnitConversion[]>;
  createUnitConversion: (inventoryId: string, payload: UnitConversionCreateRequest) => Promise<UnitConversion>;
  createPrepItem: (payload: { ingredientId: string; name: string; quantityPerUnit: number; unit: string }) => Promise<PrepItem>;
  updatePrepItem: (id: string, payload: PrepItemUpdateRequest) => Promise<PrepItem>;
  deletePrepItem: (id: string) => Promise<void>;
  preparePrepItem: (id: string, quantity: number) => Promise<PreparePrepItemResponse>;
}

function hasModuleEnabled(state: AppState, moduleKey: ModuleKey): boolean {
  return state.enabledModules.includes(moduleKey);
}

function hasPermission(state: Pick<AppState, 'permissions'>, permission: string): boolean {
  return state.permissions.includes(permission);
}

function isSimpleCatalogOnly(state: Pick<AppState, 'enabledModules'>): boolean {
  return state.enabledModules.includes('simple_catalog') && !state.enabledModules.includes('inventory');
}

function enqueueBlockedAction(set: StoreSet, moduleKey: ModuleKey, payload: unknown): void {
  set((state: AppState) => ({
    offlineQueue: [
      ...state.offlineQueue,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        moduleKey,
        payload,
        createdAt: new Date().toISOString(),
      },
    ],
  }));
}

/**
 * Replay offline queue when connection is restored.
 * Dispatches queued actions one by one, removing successful ones.
 * Failed actions are kept in the queue for retry.
 */
export function replayOfflineQueue(): void {
  const { offlineQueue } = useAppStore.getState();
  if (offlineQueue.length === 0) return;

  const state = useAppStore.getState();
  const _get = () => useAppStore.getState();
  const set = useAppStore.setState;

  // Clear queue first to prevent infinite loops, then replay
  set({ offlineQueue: [] });

  void (async () => {
    for (const entry of offlineQueue) {
      try {
        const action = entry.payload as Record<string, unknown>;
        switch (entry.moduleKey) {
          case 'kitchen':
            if (action.action === 'createOrder') {
              await state.createOrder(action.orderPayload as CreateOrderRequest);
            } else if (action.action === 'updateOrder') {
              await state.updateOrder(action.id as string, action.updates as UpdateOrderRequest);
            } else if (action.action === 'voidOrder') {
              await state.voidOrder(action.id as string, action.payload as VoidOrderRequest);
            } else if (action.action === 'payTable') {
              await state.payTable(action.tableId as string);
            } else if (action.action === 'closeTable') {
              await state.closeTable(action.tableId as string, action.payload as CloseTableRequest);
            }
            break;
          case 'delivery':
            if (action.action === 'upsertDeliveryOrder') {
              await state.upsertDeliveryOrder(action.orderId as string, action.payload as DeliveryUpsertRequest);
            } else if (action.action === 'updateDeliveryOrderStatus') {
              await state.updateDeliveryOrderStatus(action.orderId as string, action.payload as DeliveryStatusUpdateRequest);
            } else if (action.action === 'dispatchDeliveryOrder') {
              await state.dispatchDeliveryOrder(action.orderId as string);
            }
            break;
          case 'reservations':
            if (action.action === 'createReservation') {
              await state.createReservation(action.payload as ReservationCreateRequest);
            } else if (action.action === 'updateReservation') {
              await state.updateReservation(action.id as string, action.payload as ReservationUpdateRequest);
            }
            break;
          case 'inventory':
            if (action.action === 'createIngredient') {
              await state.createIngredient(action.payload as IngredientCreateRequest);
            } else if (action.action === 'updateIngredient') {
              await state.updateIngredient(action.id as string, action.payload as IngredientUpdateRequest);
            } else if (action.action === 'deleteIngredient') {
              await state.deleteIngredient(action.id as string);
            } else if (action.action === 'createBomItem') {
              await state.createBomItem(action.payload as BomCreateRequest);
            } else if (action.action === 'updateBomItem') {
              await state.updateBomItem(action.id as string, action.payload as BomUpdateRequest);
            } else if (action.action === 'deleteBomItem') {
              await state.deleteBomItem(action.id as string);
            } else if (action.action === 'replaceBomComponents') {
              await state.replaceBomComponents(action.id as string, action.payload as BomUpsertComponentsRequest);
            } else if (action.action === 'createMenuItem') {
              await state.createMenuItem(action.payload as MenuItemCreateRequest);
            } else if (action.action === 'updateMenuItem') {
              await state.updateMenuItem(action.id as string, action.payload as MenuItemUpdateRequest);
            } else if (action.action === 'deleteMenuItemAdmin') {
              await state.deleteMenuItemAdmin(action.id as string);
            } else if (action.action === 'createCategory') {
              await state.createCategory(action.payload as CategoryCreateRequest);
            } else if (action.action === 'updateCategory') {
              await state.updateCategory(action.id as string, action.payload as CategoryUpdateRequest);
            } else if (action.action === 'deleteCategory') {
              await state.deleteCategory(action.id as string);
            }
            break;
          case 'customers':
            if (action.action === 'createOrReuseCustomer') {
              await state.createOrReuseCustomer(action.payload as CustomerCreateRequest);
            } else if (action.action === 'updateCustomer') {
              await state.updateCustomer(action.id as string, action.payload as CustomerUpdateRequest);
            } else if (action.action === 'deleteCustomer') {
              await state.deleteCustomer(action.id as string);
            }
            break;
          case 'purchasing_suppliers':
            if (action.action === 'createSupplier') {
              await state.createSupplier(action.payload as SupplierCreateRequest);
            } else if (action.action === 'updateSupplier') {
              await state.updateSupplier(action.id as string, action.payload as SupplierUpdateRequest);
            } else if (action.action === 'createPurchaseOrder') {
              await state.createPurchaseOrder(action.payload as PurchaseOrderCreateRequest);
            } else if (action.action === 'updatePurchaseOrderStatus') {
              await state.updatePurchaseOrderStatus(action.id as string, action.payload as PurchaseOrderStatusUpdateRequest);
            } else if (action.action === 'createGoodsReceipt') {
              await state.createGoodsReceipt(action.orderId as string, action.payload as GoodsReceiptCreateRequest);
            }
            break;
          case 'staff_shifts_timeclock':
            if (action.action === 'createShift') {
              await state.createShift(action.payload as ShiftCreateRequest);
            } else if (action.action === 'updateShift') {
              await state.updateShift(action.id as string, action.payload as ShiftUpdateRequest);
            } else if (action.action === 'clockIn') {
              await state.clockIn(action.payload as ClockInRequest);
            } else if (action.action === 'clockOut') {
              await state.clockOut(action.payload as ClockOutRequest);
            }
            break;
          case 'printing':
            if (action.action === 'dispatchPrintJob') {
              await state.dispatchPrintJob(action.id as string, action.payload as DispatchPrintJobRequest | undefined);
            }
            break;
          default:
            // Other modules: silently skip
            break;
        }
      } catch {
        // Re-queue failed action
        set((s: AppState) => ({
          offlineQueue: [...s.offlineQueue, entry],
        }));
      }
    }
  })();
}

function handleActionError(error: unknown): string {
  if (error instanceof Error) {
    if (error.message.includes('401') || error.message.toLowerCase().includes('unauthorized')) {
      return 'Sessione scaduta. Effettua nuovamente il login.';
    }
    if (error.message.includes('403') || error.message.toLowerCase().includes('forbidden') || error.message.toLowerCase().includes('permessi insufficienti')) {
      return 'Permessi insufficienti per questa operazione.';
    }
    return error.message;
  }
  return 'Errore sconosciuto. Riprova.';
}

async function _loadAdminBootstrap(enabledModules: ModuleKey[]) {
  const inventoryEnabled = enabledModules.includes('inventory');
  const simpleCatalogOnly = enabledModules.includes('simple_catalog') && !inventoryEnabled;

  const [staffAdmin, payments, printJobs, inventoryItems, bomItems, uiSettings, categories, customers, orderHistory, customerAnalytics] = await Promise.all([
    enabledModules.includes('kitchen') ? fetchAdminStaff().catch(() => []) : Promise.resolve([]),
    enabledModules.includes('analytics') ? fetchPayments().catch(() => []) : Promise.resolve([]),
    enabledModules.includes('printing') ? fetchPrintJobs({ limit: 100 }).catch(() => []) : Promise.resolve([]),
    inventoryEnabled ? fetchInventory().catch(() => []) : Promise.resolve([]),
    inventoryEnabled ? fetchBomItems().catch(() => []) : Promise.resolve([]),
    fetchUiSettings().catch(() => defaultUiSettings),
    inventoryEnabled
      ? fetchCategories().catch(() => [])
      : simpleCatalogOnly
        ? fetchSimpleCatalogCategories().catch(() => [])
        : Promise.resolve([]),
    enabledModules.includes('customers') ? fetchCustomers({ limit: 100 }).catch(() => []) : Promise.resolve([]),
    enabledModules.includes('analytics') ? fetchOrderHistory({ limit: 200 }).catch(() => []) : Promise.resolve([]),
    enabledModules.includes('analytics') ? fetchCustomerAnalytics({}).catch(() => null) : Promise.resolve(null),
  ]);

  const menuItemsAdmin = inventoryEnabled
    ? await fetchMenuItemsAdmin().catch(() => [])
    : simpleCatalogOnly
      ? await fetchSimpleCatalogItemsAdmin().catch(() => [])
      : [];

  return {
    staffAdmin,
    payments,
    printJobs,
    inventoryItems,
    bomItems,
    menuItemsAdmin,
    uiSettings,
    categories,
    customers,
    orderHistory,
    customerAnalytics,
  };
}

export const useAppStore = create<AppState>()(persist((set, get) => ({
  loading: true,
  error: null,
  tenantContext: null,
  enabledModules: [],
  permissions: [],
  offlineQueue: [],
  data: null,
  staff: [],
  staffAdmin: [],
  payments: [],
  printJobs: [],
  reservations: [],
  reservationsQuery: null,
  reservationsQueryKey: null,
  reservationsFetchedAt: null,
  deliveryOrders: [],
  categories: [],
  customers: [],
  orderHistory: [],
  customerAnalytics: null,
  suppliers: [],
  purchaseOrders: [],
  shifts: [],
  timeEntries: [],
  fiscalExports: [],
  inventoryItems: [],
  bomItems: [],
  bomStock: [],
  menuItemsAdmin: [],
  currentUser: null,
  uiSettings: defaultUiSettings,
  loyaltyBalance: null,
  loyaltyTransactions: [],
  posCart: [],
  cartStore: {},
  cartContextKey: '',
  posOrderMode: 'dine_in',
  posTableNumber: '1',
  posMenuSearch: '',
  // ─── Print-bridge pool (Phase E) ──────────────────────────────
  printBridges: [],
  printBridgesLastFetchedAt: null,
  onboardingSecrets: [],
  prepItems: [],
  prepItemsLastFetchedAt: null,
  // ─── Local browser-bridge slice (Phase E) ────────────────────
  localBridgeConfig: null,
  localBridgeLastError: null,
  authToken: null,
  initDone: false,

  hydrate: async () => {
    if (get().initDone) {
      return;
    }

    // ─── Migrate localBridgeConfig from old standalone persist key ──────────
    if (typeof window !== 'undefined' && !get().localBridgeConfig) {
      try {
        const raw = localStorage.getItem('gustopos.localBridge');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object' && parsed.enabled) {
            set({ localBridgeConfig: parsed as LocalBridgeConfig });
          }
        }
      } catch { /* corrupted – ignore */ }
    }
    set({ initDone: true });
    applyUiTheme(defaultUiSettings);

    if (!hasAuthSession()) {
      try {
        const staffList = await fetchStaff();
        set({ staff: staffList });
      } catch {
        set({ staff: [] });
      }
      set({ loading: false });
      return;
    }

    try {
      const refreshed = await refreshSession();
      if (!refreshed) {
        disconnectSocket();
        set({ ...invalidateReservationsCache(), loading: false, data: null, currentUser: null, tenantContext: null, enabledModules: [], permissions: [] });
        return;
      }

      const currentUser = getStoredUser();
      if (!currentUser) {
        // Refresh succeeded but user payload is missing/corrupted: this is a real auth-session corruption.
        clearAuthSession();
        disconnectSocket();
        set({ ...invalidateReservationsCache(), loading: false, data: null, currentUser: null, tenantContext: null, enabledModules: [], permissions: [] });
        return;
      }

      const tenantContext = { tenantId: currentUser.tenantId, tenantSlug: undefined };
      const enabledModules = normalizeEnabledModules(currentUser.enabledModules ?? []);
      attachSocketListeners(set as StoreSet, get);

      // Single bootstrap call instead of sequential fetches
      const bootstrap = await fetchBootstrap(enabledModules).catch(() => null);

      if (bootstrap) {
        applyUiTheme(bootstrap.uiSettings);
        set({
          data: bootstrap.data,
          staff: bootstrap.staff,
          uiSettings: bootstrap.uiSettings,
          staffAdmin: bootstrap.staffAdmin,
          payments: bootstrap.payments,
          printJobs: bootstrap.printJobs,
          inventoryItems: enabledModules.includes('inventory') ? bootstrap.inventoryItems : [],
          bomItems: enabledModules.includes('inventory') ? bootstrap.bomItems : [],
          menuItemsAdmin: bootstrap.menuItemsAdmin,
          categories: bootstrap.categories,
          customers: bootstrap.customers,
          orderHistory: bootstrap.orderHistory,
          customerAnalytics: bootstrap.customerAnalytics,
          categoryModifierPools: bootstrap.data.categoryModifierPools ?? [],
          currentUser,
          tenantContext,
          enabledModules,
          permissions: currentUser.permissions ?? [],
          loading: false,
        });
      } else {
        // Fallback to individual fetches if bootstrap fails
        const staffList = await fetchStaff().catch(() => []);
        const data = enabledModules.includes('kitchen')
          ? await fetchData().catch(() => createEmptyAppData())
          : createEmptyAppData();
        const uiSettings = await fetchUiSettings().catch(() => defaultUiSettings);
        applyUiTheme(uiSettings);

        set({
          data,
          staff: staffList,
          uiSettings,
          inventoryItems: enabledModules.includes('inventory') ? data.inventory : [],
          categoryModifierPools: data.categoryModifierPools ?? [],
          currentUser,
          tenantContext,
          enabledModules,
          permissions: currentUser.permissions ?? [],
          loading: false,
        });
      }
    } catch {
      disconnectSocket();
      set({ loading: false });
    }
  },

  syncSessionModules: async () => {
    try {
      if (!hasAuthSession()) return;

      const refreshed = await refreshSession();
      if (!refreshed) {
        disconnectSocket();
        set({
          ...invalidateReservationsCache(),
          currentUser: null,
          tenantContext: null,
          enabledModules: [],
          permissions: [],
          data: null,
          loading: false,
        });
        return;
      }

      const previousModules = get().enabledModules;
      const currentUser = getStoredUser();
      const normalizedModules = normalizeEnabledModules(currentUser?.enabledModules ?? []);
      const activeModules = new Set(normalizedModules);
      const shouldLoadCoreData = normalizedModules.includes('kitchen');
      const shouldReloadData = shouldLoadCoreData && !get().data;

      const previousTenantId = get().tenantContext?.tenantId;
      const tenantChanged = Boolean(previousTenantId && currentUser?.tenantId && previousTenantId !== currentUser.tenantId);
      const reservationsDisabled = previousModules.includes('reservations') && !activeModules.has('reservations');
      const reservationsCacheReset = tenantChanged || reservationsDisabled
        ? invalidateReservationsCache()
        : null;

      if (!areSameModules(previousModules, normalizedModules)) {
        disconnectSocket();
        attachSocketListeners(set as StoreSet, get);
      }

      const nextData = shouldReloadData
        ? await fetchData().catch(() => createEmptyAppData())
        : shouldLoadCoreData
          ? (get().data ?? createEmptyAppData())
          : createEmptyAppData();

      set((state) => ({
        currentUser: areSameUsers(state.currentUser, currentUser) ? state.currentUser : currentUser,
        tenantContext: currentUser ? { tenantId: currentUser.tenantId, tenantSlug: undefined } : null,
        enabledModules: normalizedModules,
        permissions: currentUser?.permissions ?? [],
        data: nextData,
        inventoryItems: activeModules.has('inventory') ? nextData.inventory : [],
        payments: activeModules.has('analytics') ? state.payments : [],
        printJobs: activeModules.has('printing') ? state.printJobs : [],
        reservations: reservationsCacheReset ? reservationsCacheReset.reservations : (activeModules.has('reservations') ? state.reservations : []),
        reservationsQuery: reservationsCacheReset ? reservationsCacheReset.reservationsQuery : (activeModules.has('reservations') ? state.reservationsQuery : null),
        reservationsQueryKey: reservationsCacheReset ? reservationsCacheReset.reservationsQueryKey : (activeModules.has('reservations') ? state.reservationsQueryKey : null),
        reservationsFetchedAt: reservationsCacheReset ? reservationsCacheReset.reservationsFetchedAt : (activeModules.has('reservations') ? state.reservationsFetchedAt : null),
        deliveryOrders: activeModules.has('delivery') ? state.deliveryOrders : [],
        categories: activeModules.has('inventory') || activeModules.has('simple_catalog') ? state.categories : [],
        customers: activeModules.has('customers') ? state.customers : [],
        orderHistory: activeModules.has('analytics') ? state.orderHistory : [],
        customerAnalytics: activeModules.has('analytics') ? state.customerAnalytics : null,
        suppliers: activeModules.has('purchasing_suppliers') ? state.suppliers : [],
        purchaseOrders: activeModules.has('purchasing_suppliers') ? state.purchaseOrders : [],
        shifts: activeModules.has('staff_shifts_timeclock') ? state.shifts : [],
        timeEntries: activeModules.has('staff_shifts_timeclock') ? state.timeEntries : [],
        fiscalExports: activeModules.has('fiscal_exports') ? state.fiscalExports : [],
        bomItems: activeModules.has('inventory') ? state.bomItems : [],
        bomStock: activeModules.has('inventory') ? state.bomStock : [],
        menuItemsAdmin: activeModules.has('inventory') || activeModules.has('simple_catalog') ? state.menuItemsAdmin : [],
        categoryModifierPools: nextData.categoryModifierPools ?? [],
      }));
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  loginWithPin: async (staffId, pin) => {
    try {
      const response = await login(staffId, pin);

      const normalizedModules = normalizeEnabledModules(response.user.enabledModules ?? []);
      attachSocketListeners(set as StoreSet, get);

      // Single bootstrap call instead of sequential fetches
      const bootstrap = await fetchBootstrap(normalizedModules).catch(() => null);

      if (bootstrap) {
        applyUiTheme(bootstrap.uiSettings);
        set({
          ...invalidateReservationsCache(),
          currentUser: response.user,
          tenantContext: { tenantId: response.user.tenantId, tenantSlug: undefined },
          enabledModules: normalizedModules,
          permissions: response.user.permissions ?? [],
          data: bootstrap.data,
          staff: bootstrap.staff,
          uiSettings: bootstrap.uiSettings,
          staffAdmin: bootstrap.staffAdmin,
          payments: bootstrap.payments,
          printJobs: bootstrap.printJobs,
          inventoryItems: normalizedModules.includes('inventory') ? bootstrap.inventoryItems : [],
          bomItems: normalizedModules.includes('inventory') ? bootstrap.bomItems : [],
          menuItemsAdmin: bootstrap.menuItemsAdmin,
          categories: bootstrap.categories,
          customers: bootstrap.customers,
          orderHistory: bootstrap.orderHistory,
          customerAnalytics: bootstrap.customerAnalytics,
          categoryModifierPools: bootstrap.data.categoryModifierPools ?? [],
          loading: false,
        });
      } else {
        // Fallback to individual fetches
        const data = normalizedModules.includes('kitchen')
          ? await fetchData().catch(() => createEmptyAppData())
          : createEmptyAppData();
        const uiSettings = await fetchUiSettings().catch(() => defaultUiSettings);
        applyUiTheme(uiSettings);

        set({
          ...invalidateReservationsCache(),
          currentUser: response.user,
          tenantContext: { tenantId: response.user.tenantId, tenantSlug: undefined },
          enabledModules: normalizedModules,
          permissions: response.user.permissions ?? [],
          data,
          uiSettings,
          inventoryItems: normalizedModules.includes('inventory') ? data.inventory : [],
          categoryModifierPools: data.categoryModifierPools ?? [],
          loading: false,
        });
      }
      return true;
    } catch {
      return false;
    }
  },

  logout: async () => {
    try {
      await logoutRequest();
    } catch {
      // Best-effort: local cleanup proceeds even if server call fails
    }
    disconnectSocket();
    applyUiTheme(defaultUiSettings);
    set({
      currentUser: null,
      tenantContext: null,
      enabledModules: [],
      permissions: [],
      data: null,
      staffAdmin: [],
      payments: [],
      printJobs: [],
      ...invalidateReservationsCache(),
      deliveryOrders: [],
      suppliers: [],
      purchaseOrders: [],
      shifts: [],
      timeEntries: [],
      fiscalExports: [],
      inventoryItems: [],
      bomItems: [],
      bomStock: [],
      menuItemsAdmin: [],
      categories: [],
      customers: [],
      orderHistory: [],
      customerAnalytics: null,
      loyaltyBalance: null,
      loyaltyTransactions: [],
      categoryModifierPools: [],
      uiSettings: defaultUiSettings,
      loading: false,
      offlineQueue: [],
      error: null,
    });
  },

  clearError: () => set({ error: null }),

  setCartContext: (key) => {
    const state = get();
    if (key === state.cartContextKey) return;
    const updated = { ...state.cartStore, [state.cartContextKey]: [...state.posCart] };
    if (updated[key] === undefined) delete updated[key];
    set({ cartStore: updated, cartContextKey: key, posCart: updated[key] ?? [] });
  },

  addToPosCart: (item) => {
    const cartItemId = `ci_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    set((state) => {
      const newPosCart = [...state.posCart, { ...item, cartItemId }];
      return { posCart: newPosCart, cartStore: { ...state.cartStore, [state.cartContextKey]: newPosCart } };
    });
  },
  updatePosCartItem: (cartItemId, updates) => {
    set((state) => {
      const newPosCart = state.posCart.map((ci) => (ci.cartItemId === cartItemId ? { ...ci, ...updates } : ci));
      return { posCart: newPosCart, cartStore: { ...state.cartStore, [state.cartContextKey]: newPosCart } };
    });
  },
  removeFromPosCart: (cartItemId) => {
    set((state) => {
      const newPosCart = state.posCart.filter((ci) => ci.cartItemId !== cartItemId);
      return { posCart: newPosCart, cartStore: { ...state.cartStore, [state.cartContextKey]: newPosCart } };
    });
  },
  clearPosCart: () => {
    set((state) => {
      const newCartStore = { ...state.cartStore };
      delete newCartStore[state.cartContextKey];
      return { posCart: [], cartStore: newCartStore };
    });
  },

  createOrder: async (orderPayload) => {
    try {
      const state = get();
      const requiredModule: ModuleKey = orderPayload.orderType === 'delivery' ? 'delivery' : 'kitchen';
      if (!hasModuleEnabled(state, requiredModule)) {
        enqueueBlockedAction(set as StoreSet, requiredModule, { action: 'createOrder', orderPayload });
        throw new Error(`Modulo ${requiredModule} disabilitato per questo tenant`);
      }
      const created = await createOrder(orderPayload);
      // Socket-first: order:new + tables:update aggiornano lo store in realtime.
      // Refetch completo solo come fallback quando il socket è disconnesso.
      if (!getSocket().connected) {
        const data = await fetchData();
        set({ data });
      }
      set((state) => {
        const newCartStore = { ...state.cartStore };
        delete newCartStore[state.cartContextKey];
        return { posCart: [], cartStore: newCartStore };
      });
      return created;
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  upsertDeliveryOrder: async (orderId, payload) => {
    try {
      if (!hasModuleEnabled(get(), 'delivery')) {
        enqueueBlockedAction(set as StoreSet, 'delivery', { action: 'upsertDeliveryOrder', orderId, payload });
        throw new Error('Modulo delivery disabilitato per questo tenant');
      }
      await upsertDeliveryOrderRequest(orderId, payload);
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  refreshReservations: async (query, force = false) => {
    const currentUser = get().currentUser;
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'waiter')) return;
    if (!hasModuleEnabled(get(), 'reservations')) return;

    const normalizedQuery = normalizeReservationsQuery(query);
    const key = reservationsQueryKey(normalizedQuery);
    const state = get();
    if (!force && state.reservationsQueryKey === key && isReservationsQueryFresh(state.reservationsFetchedAt)) {
      return;
    }
    const inFlight = reservationsInFlight.get(key);
    if (inFlight && !force) {
      return inFlight.promise;
    }
    if (force) {
      reservationsInFlight.delete(key);
    }

    const requestId = ++reservationsRequestSequence;
    const requestPromise = (async () => {
      try {
        const reservations = await fetchReservations(normalizedQuery);
        // A newer query must win even if an older request resolves later.
        if (requestId !== reservationsRequestSequence) return;
        set({
          reservations,
          reservationsQuery: normalizedQuery,
          reservationsQueryKey: key,
          reservationsFetchedAt: Date.now(),
        });
      } catch (err) {
        if (requestId === reservationsRequestSequence) {
          set({ error: handleActionError(err) });
        }
        throw err;
      } finally {
        if (reservationsInFlight.get(key)?.requestId === requestId) {
          reservationsInFlight.delete(key);
        }
      }
    })();

    reservationsInFlight.set(key, { requestId, promise: requestPromise });
    return requestPromise;
  },

  createReservation: async (payload) => {
    try {
      if (!hasModuleEnabled(get(), 'reservations')) {
        enqueueBlockedAction(set as StoreSet, 'reservations', { action: 'createReservation', payload });
        throw new Error('Modulo reservations disabilitato per questo tenant');
      }
      await createReservationRequest(payload);
      await refreshCurrentReservations(get);
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  updateReservation: async (id, payload) => {
    try {
      if (!hasModuleEnabled(get(), 'reservations')) {
        enqueueBlockedAction(set as StoreSet, 'reservations', { action: 'updateReservation', id, payload });
        throw new Error('Modulo reservations disabilitato per questo tenant');
      }
      await updateReservationRequest(id, payload);
      await refreshCurrentReservations(get);
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  confirmReservation: async (id) => {
    try {
      if (!hasModuleEnabled(get(), 'reservations')) {
        throw new Error('Modulo reservations disabilitato per questo tenant');
      }
      await confirmReservationRequest(id);
      await refreshCurrentReservations(get);
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  cancelReservation: async (id) => {
    try {
      if (!hasModuleEnabled(get(), 'reservations')) {
        throw new Error('Modulo reservations disabilitato per questo tenant');
      }
      await cancelReservationRequest(id);
      await refreshCurrentReservations(get);
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  markReservationNoShow: async (id, reason) => {
    try {
      if (!hasModuleEnabled(get(), 'reservations')) {
        throw new Error('Modulo reservations disabilitato per questo tenant');
      }
      await markReservationNoShowRequest(id, reason);
      await refreshCurrentReservations(get);
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  refreshDeliveryOrders: async (query) => {
    try {
      const currentUser = get().currentUser;
      if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'waiter' && currentUser.role !== 'chef')) return;
      if (!hasModuleEnabled(get(), 'delivery')) return;
      const deliveryOrders = await fetchDeliveryOrdersRequest(query ?? { limit: 200 });
      set({ deliveryOrders });
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  updateDeliveryOrderStatus: async (orderId, payload) => {
    try {
      if (!hasModuleEnabled(get(), 'delivery')) {
        enqueueBlockedAction(set as StoreSet, 'delivery', { action: 'updateDeliveryOrderStatus', orderId, payload });
        throw new Error('Modulo delivery disabilitato per questo tenant');
      }
      await updateDeliveryOrderStatusRequest(orderId, payload);
      const deliveryOrders = await fetchDeliveryOrdersRequest({ limit: 200 });
      set({ deliveryOrders });
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  dispatchDeliveryOrder: async (orderId) => {
    try {
      if (!hasModuleEnabled(get(), 'delivery')) {
        enqueueBlockedAction(set as StoreSet, 'delivery', { action: 'dispatchDeliveryOrder', orderId });
        throw new Error('Modulo delivery disabilitato per questo tenant');
      }
      await dispatchDeliveryOrderRequest(orderId);
      const deliveryOrders = await fetchDeliveryOrdersRequest({ limit: 200 });
      set({ deliveryOrders });
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  updateOrderItemQuantity: async (orderId, orderItemId, quantity) => {
    try {
      const state = get();
      if (!hasModuleEnabled(state, 'kitchen')) {
        throw new Error('Modulo kitchen disabilitato per questo tenant');
      }
      if (!hasPermission(state, uiActionPolicyMatrix.ordersUpdate.permission)) {
        throw new Error('Permessi insufficienti per aggiornare ordine');
      }
      const updated = await updateOrderItemQuantity(orderId, orderItemId, quantity);
      set((s) =>
        s.data
          ? { data: { ...s.data, orders: s.data.orders.map((o) => (o.id === updated.id ? updated : o)) } }
          : s,
      );
      return updated;
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  updateOrder: async (id, updates) => {
    try {
      const state = get();
      if (!hasModuleEnabled(state, 'kitchen')) {
        enqueueBlockedAction(set as StoreSet, 'kitchen', { action: 'updateOrder', id, updates });
        throw new Error('Modulo kitchen disabilitato per questo tenant');
      }
      if (!hasPermission(state, uiActionPolicyMatrix.ordersUpdate.permission)) {
        throw new Error('Permessi insufficienti per aggiornare lo stato ordine');
      }
      const updated = await updateOrder(id, updates);
      set((s) =>
        s.data
          ? { data: { ...s.data, orders: s.data.orders.map((o) => (o.id === updated.id ? updated : o)) } }
          : s,
      );
      return updated;
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  voidOrder: async (id, payload) => {
    try {
      const state = get();
      if (!hasModuleEnabled(state, 'kitchen')) {
        enqueueBlockedAction(set as StoreSet, 'kitchen', { action: 'voidOrder', id, payload });
        throw new Error('Modulo kitchen disabilitato per questo tenant');
      }
      if (!hasPermission(state, uiActionPolicyMatrix.ordersVoid.permission)) {
        throw new Error('Permessi insufficienti per annullare ordini');
      }
      const result = await voidOrderRequest(id, payload);
      // Socket-first: order:update (status cancelled) aggiorna lo store.
      if (!getSocket().connected) {
        const data = await fetchData();
        set({ data });
      }
      return result;
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  payTable: async (tableId) => {
    try {
      const state = get();
      if (!hasModuleEnabled(state, 'kitchen')) {
        enqueueBlockedAction(set as StoreSet, 'kitchen', { action: 'payTable', tableId });
        throw new Error('Modulo kitchen disabilitato per questo tenant');
      }
      if (!hasPermission(state, uiActionPolicyMatrix.tablesPay.permission)) {
        throw new Error('Permessi insufficienti per chiudere il tavolo');
      }
      const result = await payTable(tableId);
      if (result.success && !getSocket().connected) {
        const data = await fetchData();
        set({ data });
      }
      return result;
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  closeTable: async (tableId, payload) => {
    try {
      const state = get();
      if (!hasModuleEnabled(state, 'kitchen')) {
        enqueueBlockedAction(set as StoreSet, 'kitchen', { action: 'closeTable', tableId, payload });
        throw new Error('Modulo kitchen disabilitato per questo tenant');
      }
      if (!hasPermission(state, uiActionPolicyMatrix.tablesPay.permission)) {
        throw new Error('Permessi insufficienti per chiudere il tavolo');
      }
      const result = await closeTableRequest(tableId, payload);
      if (result.success) {
        // Socket-first: orders:update + tables:update aggiornano ordini/tavoli.
        // Payments: refresh mirato solo per admin con analytics (nessun evento socket dedicato).
        const shouldRefreshPayments = state.currentUser?.role === 'admin' && hasModuleEnabled(state, 'analytics');
        if (!getSocket().connected) {
          const data = await fetchData();
          set({ data });
        }
        if (shouldRefreshPayments) {
          const payments = await fetchPayments({ limit: 200 });
          set({ payments });
        }
      }
      return result;
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  splitBill: async (tableId, payload) => {
    try {
      const state = get();
      if (!hasModuleEnabled(state, 'kitchen')) {
        enqueueBlockedAction(set as StoreSet, 'kitchen', { action: 'splitBill', tableId, payload });
        throw new Error('Modulo kitchen disabilitato per questo tenant');
      }
      const result = await splitBillRequest(tableId, payload);
      if (result.persisted) {
        // Split non cambia ordini/tavoli: nessun refetch dati necessario.
        const shouldRefreshPayments = state.currentUser?.role === 'admin' && hasModuleEnabled(state, 'analytics');
        if (shouldRefreshPayments) {
          const payments = await fetchPayments({ limit: 200 });
          set({ payments });
        }
      }
      return result;
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  paySelectedItems: async (tableId, payload) => {
    try {
      const state = get();
      if (!hasModuleEnabled(state, 'kitchen')) {
        enqueueBlockedAction(set as StoreSet, 'kitchen', { action: 'paySelectedItems', tableId, payload });
        throw new Error('Modulo kitchen disabilitato per questo tenant');
      }
      if (!hasPermission(state, uiActionPolicyMatrix.tablesPay.permission)) {
        throw new Error('Permessi insufficienti per effettuare il pagamento');
      }
      const result = await paySelectedItemsRequest(tableId, payload);
      // Socket-first: il server emette orders:update + tables:update quando allItemsPaid.
      const shouldRefreshPayments = state.currentUser?.role === 'admin' && hasModuleEnabled(state, 'analytics');
      if (!getSocket().connected) {
        const data = await fetchData();
        set({ data });
      }
      if (shouldRefreshPayments) {
        const payments = await fetchPayments({ limit: 200 });
        set({ payments });
      }
      return result;
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  markShareAsPaid: async (tableId, shareIndex, payload) => {
    try {
      const state = get();
      if (!hasModuleEnabled(state, 'kitchen')) {
        enqueueBlockedAction(set as StoreSet, 'kitchen', { action: 'markShareAsPaid', tableId, shareIndex, payload });
        throw new Error('Modulo kitchen disabilitato per questo tenant');
      }
      if (!hasPermission(state, uiActionPolicyMatrix.tablesPay.permission)) {
        throw new Error('Permessi insufficienti per effettuare il pagamento');
      }
      const result = await markShareAsPaidRequest(tableId, shareIndex, payload);
      // Socket-first: il server emette orders:update + tables:update quando allSharesPaid.
      const shouldRefreshPayments = state.currentUser?.role === 'admin' && hasModuleEnabled(state, 'analytics');
      if (!getSocket().connected) {
        const data = await fetchData();
        set({ data });
      }
      if (shouldRefreshPayments) {
        const payments = await fetchPayments({ limit: 200 });
        set({ payments });
      }
      return result;
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  getTablePaymentStatus: async (tableId) => {
    try {
      const result = await getTablePaymentStatusRequest(tableId);
      return result;
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  transferTable: async (sourceTableId, payload) => {
    try {
      const state = get();
      if (!hasModuleEnabled(state, 'kitchen')) {
        enqueueBlockedAction(set as StoreSet, 'kitchen', { action: 'transferTable', sourceTableId, payload });
        throw new Error('Modulo kitchen disabilitato per questo tenant');
      }
      const result = await transferTableRequest(sourceTableId, payload);
      // Socket-first: tables:update + orders:update (move) aggiornano lo store.
      if (!getSocket().connected) {
        const data = await fetchData();
        set({ data });
      }
      return result;
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  rotateSelfOrderQrForTable: async (tableId) => {
    try {
      const state = get();
      if (!state.currentUser || state.currentUser.role !== 'admin') {
        throw new Error('Permessi insufficienti per rigenerare QR self-order');
      }
      if (!hasModuleEnabled(state, 'self_order_qr')) {
        enqueueBlockedAction(set as StoreSet, 'self_order_qr', { action: 'rotateSelfOrderQrForTable', tableId });
        throw new Error('Modulo self_order_qr disabilitato per questo tenant');
      }
      return rotateSelfOrderQrSession(tableId);
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  refreshStaffAdmin: async () => {
    try {
      const currentUser = get().currentUser;
      if (!currentUser) return;
      if (!hasModuleEnabled(get(), 'kitchen')) return;
      const staffAdmin = await fetchAdminStaff();
      set({ staffAdmin });
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  refreshPayments: async (filters) => {
    try {
      const currentUser = get().currentUser;
      if (!currentUser || currentUser.role !== 'admin') return;
      if (!hasModuleEnabled(get(), 'analytics')) return;
      const payments = await fetchPayments(filters);
      set({ payments });
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  refundPayment: async (id, payload) => {
    try {
      const state = get();
      if (!hasModuleEnabled(state, 'analytics')) {
        enqueueBlockedAction(set as StoreSet, 'analytics', { action: 'refundPayment', id, payload });
        throw new Error('Modulo analytics disabilitato per questo tenant');
      }
      if (!hasPermission(state, uiActionPolicyMatrix.paymentsRefund.permission)) {
        throw new Error('Permessi insufficienti per rimborsi');
      }
      return await refundPaymentRequest(id, payload);
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  refreshPrintJobs: async (query) => {
    try {
      const currentUser = get().currentUser;
      if (!currentUser) return;
      if (!hasModuleEnabled(get(), 'printing')) return;
      const printJobs = await fetchPrintJobs(query);
      set({ printJobs });
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  dispatchPrintJob: async (id, payload) => {
    try {
      const state = get();
      if (!hasModuleEnabled(state, 'printing')) {
        enqueueBlockedAction(set as StoreSet, 'printing', { action: 'dispatchPrintJob', id, payload });
        throw new Error('Modulo printing disabilitato per questo tenant');
      }
      if (!hasPermission(state, uiActionPolicyMatrix.printingDispatch.permission)) {
        throw new Error('Permessi insufficienti per dispatch stampa');
      }
      await dispatchPrintJobRequest(id, payload);
      const printJobs = await fetchPrintJobs({ limit: 100 });
      set({ printJobs });
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  refreshCategories: async (scope) => {
    try {
      const currentUser = get().currentUser;
      if (!currentUser) return;
      if (!hasModuleEnabled(get(), 'inventory') && !hasModuleEnabled(get(), 'simple_catalog')) return;
      const categories = await (isSimpleCatalogOnly(get()) ? fetchSimpleCatalogCategories() : fetchCategories(scope));
      set({ categories });
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  createCategory: async (payload) => {
    try {
      if (!hasModuleEnabled(get(), 'inventory') && !hasModuleEnabled(get(), 'simple_catalog')) {
        enqueueBlockedAction(set as StoreSet, isSimpleCatalogOnly(get()) ? 'simple_catalog' : 'inventory', { action: 'createCategory', payload });
        throw new Error('Modulo non disponibile per questo tenant');
      }
      await (isSimpleCatalogOnly(get()) ? createSimpleCatalogCategoryRequest(payload) : createCategoryRequest(payload));
      const categories = await (isSimpleCatalogOnly(get()) ? fetchSimpleCatalogCategories() : fetchCategories());
      set({ categories });
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  updateCategory: async (id, payload) => {
    try {
      if (!hasModuleEnabled(get(), 'inventory') && !hasModuleEnabled(get(), 'simple_catalog')) {
        enqueueBlockedAction(set as StoreSet, isSimpleCatalogOnly(get()) ? 'simple_catalog' : 'inventory', { action: 'updateCategory', id, payload });
        throw new Error('Modulo non disponibile per questo tenant');
      }
      await (isSimpleCatalogOnly(get()) ? updateSimpleCatalogCategoryRequest(id, payload) : updateCategoryRequest(id, payload));
      const categories = await (isSimpleCatalogOnly(get()) ? fetchSimpleCatalogCategories() : fetchCategories());
      set({ categories });
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  deleteCategory: async (id) => {
    try {
      if (!hasModuleEnabled(get(), 'inventory') && !hasModuleEnabled(get(), 'simple_catalog')) {
        enqueueBlockedAction(set as StoreSet, isSimpleCatalogOnly(get()) ? 'simple_catalog' : 'inventory', { action: 'deleteCategory', id });
        throw new Error('Modulo non disponibile per questo tenant');
      }
      await deleteCategoryRequest(id);
      const categories = await (isSimpleCatalogOnly(get()) ? fetchSimpleCatalogCategories() : fetchCategories());
      set({ categories });
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  categoryModifierPools: [],
  refreshCategoryModifierPools: async () => {
    try {
      if (!hasModuleEnabled(get(), 'inventory') && !hasModuleEnabled(get(), 'simple_catalog')) return;
      const pools = await fetchCategoryModifierPools();
      set({ categoryModifierPools: pools });
    } catch (err) {
      set({ error: handleActionError(err) });
    }
  },
  createCategoryModifierPool: async (payload) => {
    try {
      if (!hasModuleEnabled(get(), 'inventory') && !hasModuleEnabled(get(), 'simple_catalog')) {
        enqueueBlockedAction(set as StoreSet, isSimpleCatalogOnly(get()) ? 'simple_catalog' : 'inventory', { action: 'createCategoryModifierPool', payload });
        throw new Error('Modulo non disponibile per questo tenant');
      }
      await createCategoryModifierPoolRequest(payload);
      const pools = await fetchCategoryModifierPools();
      set({ categoryModifierPools: pools });
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },
  updateCategoryModifierPool: async (id, payload) => {
    try {
      if (!hasModuleEnabled(get(), 'inventory') && !hasModuleEnabled(get(), 'simple_catalog')) {
        enqueueBlockedAction(set as StoreSet, isSimpleCatalogOnly(get()) ? 'simple_catalog' : 'inventory', { action: 'updateCategoryModifierPool', id, payload });
        throw new Error('Modulo non disponibile per questo tenant');
      }
      await updateCategoryModifierPoolRequest(id, payload);
      const pools = await fetchCategoryModifierPools();
      set({ categoryModifierPools: pools });
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },
  deleteCategoryModifierPool: async (id) => {
    try {
      if (!hasModuleEnabled(get(), 'inventory') && !hasModuleEnabled(get(), 'simple_catalog')) {
        enqueueBlockedAction(set as StoreSet, isSimpleCatalogOnly(get()) ? 'simple_catalog' : 'inventory', { action: 'deleteCategoryModifierPool', id });
        throw new Error('Modulo non disponibile per questo tenant');
      }
      await deleteCategoryModifierPoolRequest(id);
      const pools = await fetchCategoryModifierPools();
      set({ categoryModifierPools: pools });
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  refreshTables: async () => {
    try {
      const currentUser = get().currentUser;
      if (!currentUser) return;
      if (!hasModuleEnabled(get(), 'kitchen')) return;
      const tables = await fetchTables();
      const data = get().data;
      if (data) {
        set({ data: { ...data, tables } });
      }
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  createTable: async (payload) => {
    try {
      if (!hasModuleEnabled(get(), 'kitchen')) {
        enqueueBlockedAction(set as StoreSet, 'kitchen', { action: 'createTable', payload });
        throw new Error('Modulo non disponibile per questo tenant');
      }
      await createTableRequest(payload);
      const tables = await fetchTables();
      const data = get().data;
      if (data) {
        set({ data: { ...data, tables } });
      }
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  bulkCreateTables: async (payload) => {
    try {
      if (!hasModuleEnabled(get(), 'kitchen')) {
        enqueueBlockedAction(set as StoreSet, 'kitchen', { action: 'bulkCreateTables', payload });
        throw new Error('Modulo non disponibile per questo tenant');
      }
      await bulkCreateTablesRequest(payload);
      const tables = await fetchTables();
      const data = get().data;
      if (data) {
        set({ data: { ...data, tables } });
      }
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  updateTable: async (id, payload) => {
    try {
      if (!hasModuleEnabled(get(), 'kitchen')) {
        enqueueBlockedAction(set as StoreSet, 'kitchen', { action: 'updateTable', id, payload });
        throw new Error('Modulo non disponibile per questo tenant');
      }
      await updateTableRequest(id, payload);
      const tables = await fetchTables();
      const data = get().data;
      if (data) {
        set({ data: { ...data, tables } });
      }
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  deleteTable: async (id) => {
    try {
      if (!hasModuleEnabled(get(), 'kitchen')) {
        enqueueBlockedAction(set as StoreSet, 'kitchen', { action: 'deleteTable', id });
        throw new Error('Modulo non disponibile per questo tenant');
      }
      await deleteTableRequest(id);
      const tables = await fetchTables();
      const data = get().data;
      if (data) {
        set({ data: { ...data, tables } });
      }
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  refreshCustomers: async (query) => {
    try {
      const currentUser = get().currentUser;
      if (!currentUser) return;
      if (!hasModuleEnabled(get(), 'customers')) return;
      const customers = await fetchCustomers(query);
      set({ customers });
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  createOrReuseCustomer: async (payload) => {
    try {
      if (!hasModuleEnabled(get(), 'customers')) {
        enqueueBlockedAction(set as StoreSet, 'customers', { action: 'createOrReuseCustomer', payload });
        throw new Error('Modulo customers disabilitato per questo tenant');
      }
      return await createOrReuseCustomerRequest(payload);
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  updateCustomer: async (id, payload) => {
    try {
      if (!hasModuleEnabled(get(), 'customers')) {
        throw new Error('Modulo customers disabilitato per questo tenant');
      }
      const updated = await updateCustomerRequest(id, payload);
      const customers = get().customers.map((c) => (c.id === id ? updated : c));
      set({ customers });
      return updated;
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  deleteCustomer: async (id) => {
    try {
      if (!hasModuleEnabled(get(), 'customers')) {
        throw new Error('Modulo customers disabilitato per questo tenant');
      }
      await deleteCustomerRequest(id);
      set({ customers: get().customers.filter((c) => c.id !== id) });
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  refreshCustomerAddresses: async (customerId) => {
    try {
      if (!hasModuleEnabled(get(), 'customers')) return;
      const addresses = await fetchCustomerAddressesRequest(customerId);
      const customers = get().customers.map((c) => (c.id === customerId ? { ...c, addresses } : c));
      set({ customers });
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  createCustomerAddress: async (customerId, payload) => {
    try {
      if (!hasModuleEnabled(get(), 'customers')) {
        throw new Error('Modulo customers disabilitato per questo tenant');
      }
      await createCustomerAddressRequest(customerId, payload);
      const addresses = await fetchCustomerAddressesRequest(customerId);
      const customers = get().customers.map((c) => (c.id === customerId ? { ...c, addresses } : c));
      set({ customers });
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  updateCustomerAddress: async (customerId, addressId, payload) => {
    try {
      if (!hasModuleEnabled(get(), 'customers')) {
        throw new Error('Modulo customers disabilitato per questo tenant');
      }
      await updateCustomerAddressRequest(customerId, addressId, payload);
      const addresses = await fetchCustomerAddressesRequest(customerId);
      const customers = get().customers.map((c) => (c.id === customerId ? { ...c, addresses } : c));
      set({ customers });
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  deleteCustomerAddress: async (customerId, addressId) => {
    try {
      if (!hasModuleEnabled(get(), 'customers')) {
        throw new Error('Modulo customers disabilitato per questo tenant');
      }
      await deleteCustomerAddressRequest(customerId, addressId);
      const addresses = await fetchCustomerAddressesRequest(customerId);
      const customers = get().customers.map((c) => (c.id === customerId ? { ...c, addresses } : c));
      set({ customers });
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  refreshOrderHistory: async (filters) => {
    try {
      const currentUser = get().currentUser;
      if (!currentUser || currentUser.role !== 'admin') return;
      if (!hasModuleEnabled(get(), 'analytics')) return;
      const orderHistory = await fetchOrderHistory(filters);
      set({ orderHistory });
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  refreshCustomerAnalytics: async (payload) => {
    try {
      const currentUser = get().currentUser;
      if (!currentUser || currentUser.role !== 'admin') return;
      if (!hasModuleEnabled(get(), 'analytics')) return;
      const customerAnalytics = await fetchCustomerAnalytics(payload);
      set({ customerAnalytics });
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  refreshBomItems: async () => {
    try {
      const currentUser = get().currentUser;
      if (!currentUser) return;
      if (!hasModuleEnabled(get(), 'inventory')) return;
      const bomItems = await fetchBomItems();
      set({ bomItems });
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  refreshInventoryItems: async () => {
    try {
      const currentUser = get().currentUser;
      if (!currentUser) return;
      if (!hasModuleEnabled(get(), 'inventory')) return;
      const inventoryItems = await fetchInventory();
      set((state) => ({
        inventoryItems,
        data: state.data ? { ...state.data, inventory: inventoryItems } : state.data,
      }));
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  createBomItem: async (payload) => {
    try {
      if (!hasModuleEnabled(get(), 'inventory')) {
        enqueueBlockedAction(set as StoreSet, 'inventory', { action: 'createBomItem', payload });
        throw new Error('Modulo inventory disabilitato per questo tenant');
      }
      await createBomItemRequest(payload);
      const bomItems = await fetchBomItems();
      set({ bomItems });
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  updateBomItem: async (id, payload) => {
    try {
      if (!hasModuleEnabled(get(), 'inventory')) {
        enqueueBlockedAction(set as StoreSet, 'inventory', { action: 'updateBomItem', id, payload });
        throw new Error('Modulo inventory disabilitato per questo tenant');
      }
      await updateBomItemRequest(id, payload);
      const bomItems = await fetchBomItems();
      set({ bomItems });
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  replaceBomComponents: async (id, payload) => {
    try {
      if (!hasModuleEnabled(get(), 'inventory')) {
        enqueueBlockedAction(set as StoreSet, 'inventory', { action: 'replaceBomComponents', id, payload });
        throw new Error('Modulo inventory disabilitato per questo tenant');
      }
      await replaceBomComponentsRequest(id, payload);
      const bomItems = await fetchBomItems();
      set({ bomItems });
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  addBomComponent: async (id, payload) => {
    try {
      if (!hasModuleEnabled(get(), 'inventory')) {
        enqueueBlockedAction(set as StoreSet, 'inventory', { action: 'addBomComponent', id, payload });
        throw new Error('Modulo inventory disabilitato per questo tenant');
      }
      await addBomComponentRequest(id, payload);
      const bomItems = await fetchBomItems();
      set({ bomItems });
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  removeBomComponent: async (id, payload) => {
    try {
      if (!hasModuleEnabled(get(), 'inventory')) {
        enqueueBlockedAction(set as StoreSet, 'inventory', { action: 'removeBomComponent', id, payload });
        throw new Error('Modulo inventory disabilitato per questo tenant');
      }
      await removeBomComponentRequest(id, payload);
      const bomItems = await fetchBomItems();
      set({ bomItems });
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  deleteBomItem: async (id) => {
    try {
      if (!hasModuleEnabled(get(), 'inventory')) {
        enqueueBlockedAction(set as StoreSet, 'inventory', { action: 'deleteBomItem', id });
        throw new Error('Modulo inventory disabilitato per questo tenant');
      }
      await deleteBomItemRequest(id);
      const bomItems = await fetchBomItems();
      set({ bomItems });
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  createIngredient: async (payload) => {
    try {
      if (!hasModuleEnabled(get(), 'inventory')) {
        enqueueBlockedAction(set as StoreSet, 'inventory', { action: 'createIngredient', payload });
        throw new Error('Modulo inventory disabilitato per questo tenant');
      }
      await createIngredientRequest(payload);
      const inventoryItems = await fetchInventory();
      set((state) => ({
        inventoryItems,
        data: state.data ? { ...state.data, inventory: inventoryItems } : state.data,
      }));
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  deleteIngredient: async (id) => {
    try {
      if (!hasModuleEnabled(get(), 'inventory')) {
        enqueueBlockedAction(set as StoreSet, 'inventory', { action: 'deleteIngredient', id });
        throw new Error('Modulo inventory disabilitato per questo tenant');
      }
      await deleteIngredientRequest(id);
      const inventoryItems = await fetchInventory();
      set((state) => ({
        inventoryItems,
        data: state.data ? { ...state.data, inventory: inventoryItems } : state.data,
      }));
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  updateIngredient: async (id, payload) => {
    try {
      if (!hasModuleEnabled(get(), 'inventory')) {
        enqueueBlockedAction(set as StoreSet, 'inventory', { action: 'updateIngredient', id, payload });
        throw new Error('Modulo inventory disabilitato per questo tenant');
      }
      await updateIngredientRequest(id, payload);
      const inventoryItems = await fetchInventory();
      set((state) => ({
        inventoryItems,
        data: state.data ? { ...state.data, inventory: inventoryItems } : state.data,
      }));
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  adjustIngredient: async (id, payload) => {
    try {
      if (!hasModuleEnabled(get(), 'inventory')) {
        enqueueBlockedAction(set as StoreSet, 'inventory', { action: 'adjustIngredient', id, payload });
        throw new Error('Modulo inventory disabilitato per questo tenant');
      }
      await adjustIngredientRequest(id, payload);
      const inventoryItems = await fetchInventory();
      set((state) => ({
        inventoryItems,
        data: state.data ? { ...state.data, inventory: inventoryItems } : state.data,
      }));
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  refreshMenuItemsAdmin: async () => {
    try {
      const currentUser = get().currentUser;
      if (!currentUser) return;
      if (!hasModuleEnabled(get(), 'inventory') && !hasModuleEnabled(get(), 'simple_catalog')) return;
      const menuItemsAdmin = await (isSimpleCatalogOnly(get()) ? fetchSimpleCatalogItemsAdmin() : fetchMenuItemsAdmin());
      set({ menuItemsAdmin });
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  createMenuItem: async (payload) => {
    try {
      if (!hasModuleEnabled(get(), 'inventory') && !hasModuleEnabled(get(), 'simple_catalog')) {
        enqueueBlockedAction(set as StoreSet, isSimpleCatalogOnly(get()) ? 'simple_catalog' : 'inventory', { action: 'createMenuItem', payload });
        throw new Error('Modulo non disponibile per questo tenant');
      }
      await (isSimpleCatalogOnly(get()) ? createSimpleCatalogItemRequest(payload) : createMenuItemRequest(payload));
      const menuItemsAdmin = await (isSimpleCatalogOnly(get()) ? fetchSimpleCatalogItemsAdmin() : fetchMenuItemsAdmin());
      set({ menuItemsAdmin });
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  updateMenuItem: async (id, payload) => {
    try {
      if (!hasModuleEnabled(get(), 'inventory') && !hasModuleEnabled(get(), 'simple_catalog')) {
        enqueueBlockedAction(set as StoreSet, isSimpleCatalogOnly(get()) ? 'simple_catalog' : 'inventory', { action: 'updateMenuItem', id, payload });
        throw new Error('Modulo non disponibile per questo tenant');
      }
      await (isSimpleCatalogOnly(get()) ? updateSimpleCatalogItemRequest(id, payload) : updateMenuItemRequest(id, payload));
      const menuItemsAdmin = await (isSimpleCatalogOnly(get()) ? fetchSimpleCatalogItemsAdmin() : fetchMenuItemsAdmin());
      set({ menuItemsAdmin });
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  replaceMenuItemRecipe: async (id, payload) => {
    try {
      if (!hasModuleEnabled(get(), 'inventory')) {
        enqueueBlockedAction(set as StoreSet, 'inventory', { action: 'replaceMenuItemRecipe', id, payload });
        throw new Error('Modulo inventory disabilitato per questo tenant');
      }
      await replaceMenuItemRecipeRequest(id, payload);
      const menuItemsAdmin = isSimpleCatalogOnly(get())
        ? await fetchSimpleCatalogItemsAdmin()
        : await fetchMenuItemsAdmin();
      set({ menuItemsAdmin });
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  addMenuItemRecipeComponent: async (id, payload) => {
    try {
      if (!hasModuleEnabled(get(), 'inventory')) {
        enqueueBlockedAction(set as StoreSet, 'inventory', { action: 'addMenuItemRecipeComponent', id, payload });
        throw new Error('Modulo inventory disabilitato per questo tenant');
      }
      await addMenuItemRecipeComponentRequest(id, payload);
      const menuItemsAdmin = isSimpleCatalogOnly(get())
        ? await fetchSimpleCatalogItemsAdmin()
        : await fetchMenuItemsAdmin();
      set({ menuItemsAdmin });
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  removeMenuItemRecipeComponent: async (id, payload) => {
    try {
      if (!hasModuleEnabled(get(), 'inventory')) {
        enqueueBlockedAction(set as StoreSet, 'inventory', { action: 'removeMenuItemRecipeComponent', id, payload });
        throw new Error('Modulo inventory disabilitato per questo tenant');
      }
      await removeMenuItemRecipeComponentRequest(id, payload);
      const menuItemsAdmin = isSimpleCatalogOnly(get())
        ? await fetchSimpleCatalogItemsAdmin()
        : await fetchMenuItemsAdmin();
      set({ menuItemsAdmin });
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  setMenuItemActiveAdmin: async (id, active) => {
    try {
      if (!hasModuleEnabled(get(), 'inventory') && !hasModuleEnabled(get(), 'simple_catalog')) {
        enqueueBlockedAction(set as StoreSet, isSimpleCatalogOnly(get()) ? 'simple_catalog' : 'inventory', { action: 'setMenuItemActiveAdmin', id, active });
        throw new Error('Modulo non disponibile per questo tenant');
      }
      await (isSimpleCatalogOnly(get()) ? setSimpleCatalogItemActiveState(id, active) : setMenuItemActiveState(id, active));
      const menuItemsAdmin = await (isSimpleCatalogOnly(get()) ? fetchSimpleCatalogItemsAdmin() : fetchMenuItemsAdmin());
      set({ menuItemsAdmin });
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  deleteMenuItemAdmin: async (id) => {
    try {
      if (!hasModuleEnabled(get(), 'inventory') && !hasModuleEnabled(get(), 'simple_catalog')) {
        enqueueBlockedAction(set as StoreSet, isSimpleCatalogOnly(get()) ? 'simple_catalog' : 'inventory', { action: 'deleteMenuItemAdmin', id });
        throw new Error('Modulo non disponibile per questo tenant');
      }
      await deleteMenuItemRequest(id);
      const menuItemsAdmin = await (isSimpleCatalogOnly(get()) ? fetchSimpleCatalogItemsAdmin() : fetchMenuItemsAdmin());
      set({ menuItemsAdmin });
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  refreshUiSettings: async () => {
    try {
      const currentUser = get().currentUser;
      if (!currentUser || currentUser.role !== 'admin') return;
      const uiSettings = await fetchUiSettings();
      set({ uiSettings });
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  updateUiSettings: async (payload) => {
    try {
      const state = get();
      if (!hasPermission(state, uiActionPolicyMatrix.settingsUpdate.permission)) {
        throw new Error('Permessi insufficienti per aggiornare le impostazioni');
      }
      const updated = await updateUiSettingsRequest(payload);
      applyUiTheme(updated);
      set({ uiSettings: updated });
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  updatePrintingSettings: async (payload) => {
    try {
      const state = get();
      if (!hasPermission(state, uiActionPolicyMatrix.settingsUpdate.permission)) {
        throw new Error('Permessi insufficienti per aggiornare le impostazioni');
      }
      const updated = await updatePrintingSettingsRequest(payload);
      set({ uiSettings: updated });
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  refreshSuppliers: async (query) => {
    try {
      const currentUser = get().currentUser;
      if (!currentUser || currentUser.role !== 'admin') return;
      if (!hasModuleEnabled(get(), 'purchasing_suppliers')) return;
      const suppliers = await fetchSuppliers(query ?? { limit: 200 });
      set({ suppliers });
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  createSupplier: async (payload) => {
    try {
      if (!hasModuleEnabled(get(), 'purchasing_suppliers')) {
        enqueueBlockedAction(set as StoreSet, 'purchasing_suppliers', { action: 'createSupplier', payload });
        throw new Error('Modulo purchasing_suppliers disabilitato per questo tenant');
      }
      await createSupplierRequest(payload);
      const suppliers = await fetchSuppliers({ limit: 200 });
      set({ suppliers });
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  updateSupplier: async (id, payload) => {
    try {
      if (!hasModuleEnabled(get(), 'purchasing_suppliers')) {
        enqueueBlockedAction(set as StoreSet, 'purchasing_suppliers', { action: 'updateSupplier', id, payload });
        throw new Error('Modulo purchasing_suppliers disabilitato per questo tenant');
      }
      await updateSupplierRequest(id, payload);
      const suppliers = await fetchSuppliers({ limit: 200 });
      set({ suppliers });
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  refreshPurchaseOrders: async (query) => {
    try {
      const currentUser = get().currentUser;
      if (!currentUser || currentUser.role !== 'admin') return;
      if (!hasModuleEnabled(get(), 'purchasing_suppliers')) return;
      const purchaseOrders = await fetchPurchaseOrders(query ?? { limit: 200 });
      set({ purchaseOrders });
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  createPurchaseOrder: async (payload) => {
    try {
      if (!hasModuleEnabled(get(), 'purchasing_suppliers')) {
        enqueueBlockedAction(set as StoreSet, 'purchasing_suppliers', { action: 'createPurchaseOrder', payload });
        throw new Error('Modulo purchasing_suppliers disabilitato per questo tenant');
      }
      await createPurchaseOrderRequest(payload);
      const purchaseOrders = await fetchPurchaseOrders({ limit: 200 });
      set({ purchaseOrders });
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  updatePurchaseOrderStatus: async (id, payload) => {
    try {
      if (!hasModuleEnabled(get(), 'purchasing_suppliers')) {
        enqueueBlockedAction(set as StoreSet, 'purchasing_suppliers', { action: 'updatePurchaseOrderStatus', id, payload });
        throw new Error('Modulo purchasing_suppliers disabilitato per questo tenant');
      }
      await updatePurchaseOrderStatusRequest(id, payload);
      const purchaseOrders = await fetchPurchaseOrders({ limit: 200 });
      set({ purchaseOrders });
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  createGoodsReceipt: async (orderId, payload) => {
    try {
      if (!hasModuleEnabled(get(), 'purchasing_suppliers')) {
        enqueueBlockedAction(set as StoreSet, 'purchasing_suppliers', { action: 'createGoodsReceipt', orderId, payload });
        throw new Error('Modulo purchasing_suppliers disabilitato per questo tenant');
      }
      return await createGoodsReceiptRequest(orderId, payload);
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  refreshShifts: async (query) => {
    try {
      const currentUser = get().currentUser;
      if (!currentUser || currentUser.role !== 'admin') return;
      if (!hasModuleEnabled(get(), 'staff_shifts_timeclock')) return;
      const shifts = await fetchShifts(query);
      set({ shifts });
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  createShift: async (payload) => {
    try {
      if (!hasModuleEnabled(get(), 'staff_shifts_timeclock')) {
        enqueueBlockedAction(set as StoreSet, 'staff_shifts_timeclock', { action: 'createShift', payload });
        throw new Error('Modulo staff_shifts_timeclock disabilitato per questo tenant');
      }
      await createShiftRequest(payload);
      const shifts = await fetchShifts({ limit: 200 });
      set({ shifts });
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  updateShift: async (id, payload) => {
    try {
      if (!hasModuleEnabled(get(), 'staff_shifts_timeclock')) {
        enqueueBlockedAction(set as StoreSet, 'staff_shifts_timeclock', { action: 'updateShift', id, payload });
        throw new Error('Modulo staff_shifts_timeclock disabilitato per questo tenant');
      }
      await updateShiftRequest(id, payload);
      const shifts = await fetchShifts({ limit: 200 });
      set({ shifts });
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  clockIn: async (payload) => {
    try {
      if (!hasModuleEnabled(get(), 'staff_shifts_timeclock')) {
        enqueueBlockedAction(set as StoreSet, 'staff_shifts_timeclock', { action: 'clockIn', payload });
        throw new Error('Modulo staff_shifts_timeclock disabilitato per questo tenant');
      }
      const entry = await clockInRequest(payload);
      set((state) => ({ timeEntries: [...state.timeEntries, entry] }));
      return entry;
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  clockOut: async (payload) => {
    try {
      if (!hasModuleEnabled(get(), 'staff_shifts_timeclock')) {
        enqueueBlockedAction(set as StoreSet, 'staff_shifts_timeclock', { action: 'clockOut', payload });
        throw new Error('Modulo staff_shifts_timeclock disabilitato per questo tenant');
      }
      const entry = await clockOutRequest(payload);
      set((state) => ({
        timeEntries: state.timeEntries.map((e) => (e.id === entry.id ? entry : e)),
      }));
      return entry;
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  refreshTimeReport: async (query) => {
    try {
      const currentUser = get().currentUser;
      if (!currentUser || currentUser.role !== 'admin') throw new Error('Non autorizzato');
      return await fetchTimeReport(query);
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  refreshFiscalExports: async (query) => {
    try {
      const currentUser = get().currentUser;
      if (!currentUser || currentUser.role !== 'admin') return;
      if (!hasModuleEnabled(get(), 'fiscal_exports')) return;
      const fiscalExports = await fetchFiscalExports(query);
      set({ fiscalExports });
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  closeFiscalDay: async (payload) => {
    try {
      const state = get();
      if (!hasModuleEnabled(state, 'fiscal_exports')) {
        enqueueBlockedAction(set as StoreSet, 'fiscal_exports', { action: 'closeFiscalDay', payload });
        throw new Error('Modulo fiscal_exports disabilitato per questo tenant');
      }
      if (!hasPermission(state, uiActionPolicyMatrix.fiscalClose.permission)) {
        throw new Error('Permessi insufficienti per chiusura fiscale');
      }
      return await closeFiscalDayRequest(payload);
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  createFiscalExport: async (payload) => {
    try {
      const state = get();
      if (!hasModuleEnabled(state, 'fiscal_exports')) {
        enqueueBlockedAction(set as StoreSet, 'fiscal_exports', { action: 'createFiscalExport', payload });
        throw new Error('Modulo fiscal_exports disabilitato per questo tenant');
      }
      if (!hasPermission(state, uiActionPolicyMatrix.fiscalExport.permission)) {
        throw new Error('Permessi insufficienti per export fiscale');
      }
      return await createFiscalExportRequest(payload);
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  downloadFiscalExportCsv: async (id) => {
    try {
      return await downloadFiscalExportCsv(id);
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  createStaffAdmin: async (payload) => {
    try {
      const state = get();
      if (!hasModuleEnabled(state, 'kitchen')) {
        enqueueBlockedAction(set as StoreSet, 'kitchen', { action: 'createStaffAdmin', payload });
        throw new Error('Modulo kitchen disabilitato per questo tenant');
      }
      if (!hasPermission(state, uiActionPolicyMatrix.staffManage.permission)) {
        throw new Error('Permessi insufficienti per gestire lo staff');
      }
      await createAdminStaff(payload);
      const staffAdmin = await fetchAdminStaff();
      set({ staffAdmin });
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  updateStaffAdmin: async (id, payload) => {
    try {
      const state = get();
      if (!hasModuleEnabled(state, 'kitchen')) {
        enqueueBlockedAction(set as StoreSet, 'kitchen', { action: 'updateStaffAdmin', id, payload });
        throw new Error('Modulo kitchen disabilitato per questo tenant');
      }
      if (!hasPermission(state, uiActionPolicyMatrix.staffManage.permission)) {
        throw new Error('Permessi insufficienti per gestire lo staff');
      }
      await updateAdminStaff(id, payload);
      const staffAdmin = await fetchAdminStaff();
      set({ staffAdmin });
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  resetStaffPinAdmin: async (id, payload) => {
    try {
      const state = get();
      if (!hasModuleEnabled(state, 'kitchen')) {
        enqueueBlockedAction(set as StoreSet, 'kitchen', { action: 'resetStaffPinAdmin', id, payload });
        throw new Error('Modulo kitchen disabilitato per questo tenant');
      }
      if (!hasPermission(state, uiActionPolicyMatrix.staffManage.permission)) {
        throw new Error('Permessi insufficienti per gestire lo staff');
      }
      return await resetAdminStaffPin(id, payload);
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  setStaffActiveAdmin: async (id, active) => {
    try {
      const state = get();
      if (!hasModuleEnabled(state, 'kitchen')) {
        enqueueBlockedAction(set as StoreSet, 'kitchen', { action: 'setStaffActiveAdmin', id, active });
        throw new Error('Modulo kitchen disabilitato per questo tenant');
      }
      if (!hasPermission(state, uiActionPolicyMatrix.staffManage.permission)) {
        throw new Error('Permessi insufficienti per gestire lo staff');
      }
      const result = await setAdminStaffActiveState(id, active);
      const staffAdmin = await fetchAdminStaff();
      set({ staffAdmin });
      return result;
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  refreshLoyaltyBalance: async (customerId) => {
    try {
      if (!hasModuleEnabled(get(), 'loyalty_points')) return;
      const balance = await fetchLoyaltyBalance(customerId);
      set({ loyaltyBalance: balance });
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  redeemLoyaltyPoints: async (customerId, points, orderId) => {
    try {
      if (!hasModuleEnabled(get(), 'loyalty_points')) {
        throw new Error('Modulo loyalty_points disabilitato per questo tenant');
      }
      await redeemLoyaltyPoints(customerId, points, orderId);
      const balance = await fetchLoyaltyBalance(customerId);
      set({ loyaltyBalance: balance });
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  earnLoyaltyPointsAction: async (customerId, points, orderId, notes) => {
    try {
      if (!hasModuleEnabled(get(), 'loyalty_points')) {
        throw new Error('Modulo loyalty_points disabilitato per questo tenant');
      }
      await earnLoyaltyPoints(customerId, points, orderId, notes);
      const balance = await fetchLoyaltyBalance(customerId);
      set({ loyaltyBalance: balance });
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },

  refreshLoyaltyTransactions: async (customerId, limit) => {
    try {
      if (!hasModuleEnabled(get(), 'loyalty_points')) return;
      const transactions = await fetchLoyaltyTransactions(customerId, limit);
      set({ loyaltyTransactions: transactions });
    } catch (err) {
      set({ error: handleActionError(err) });
      throw err;
    }
  },
  // ─── Print-bridge pool (Phase E) ──────────────────────────────
  refreshPrintBridges: async () => {
    set({ printBridgesLastFetchedAt: new Date().toISOString() });
  },
  updateBridgeMappings: async (bridgeId, mappings) => {
    await updateBridgeMappings(bridgeId, mappings);
    set({ printBridgesLastFetchedAt: new Date().toISOString() });
  },
  updateBridgeClaimedAreas: async (bridgeId, claimedAreas) => {
    await updateBridgeClaimedAreas(bridgeId, claimedAreas);
    set({ printBridgesLastFetchedAt: new Date().toISOString() });
  },
  triggerBridgeTestPrint: async (bridgeId, area) => {
    await triggerBridgeTestPrintRequest(bridgeId, area);
    set({ printBridgesLastFetchedAt: new Date().toISOString() });
  },
  refreshOnboardingSecrets: async () => {
    const secrets = await listOnboardingSecretsRequest();
    set({ onboardingSecrets: secrets });
  },
  createOnboardingSecret: async (hint) => {
    const res = await createOnboardingSecretRequest(hint ?? {});
    return { plaintext: res.plaintext, suggestedBridgeId: res.suggestedBridgeId, bootstrapSnippet: '' };
  },
  createShortCodePairing: async (input) => {
    return await createShortCodePairingRequest(input ?? {});
  },
  revokeOnboardingSecret: async (id) => {
    await revokeOnboardingSecretRequest(id);
  },
  refreshPrepItems: async () => {
    set({ prepItemsLastFetchedAt: new Date().toISOString() });
  },
  fetchUnitConversions: async (inventoryId) => {
    const data = await authorizedFetch(`${API_URL}/api/inventory/${encodeURIComponent(inventoryId)}/conversions`).then((r: Response) => r.json());
    return data?.conversions ?? [];
  },
  createUnitConversion: async (inventoryId, payload) => {
    const data = await authorizedFetch(`${API_URL}/api/inventory/${encodeURIComponent(inventoryId)}/conversions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then((r: Response) => r.json());
    return data;
  },
  createPrepItem: async (payload) => {
    const data = await authorizedFetch(`${API_URL}/api/prep-items`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then((r: Response) => r.json());
    return data;
  },
  updatePrepItem: async (id, payload) => {
    const data = await authorizedFetch(`${API_URL}/api/prep-items/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then((r: Response) => r.json());
    return data;
  },
  deletePrepItem: async (id) => {
    await authorizedFetch(`${API_URL}/api/prep-items/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
  preparePrepItem: async (id, quantity) => {
    const data = await authorizedFetch(`${API_URL}/api/prep-items/${encodeURIComponent(id)}/prepare`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quantity }) }).then((r: Response) => r.json());
    return data;
  },
  setLocalBridgeConfig: (config) => {
    set({ localBridgeConfig: config });
  },
  setLocalBridgeActive: (active) => {
    set((s) => ({
      localBridgeConfig: s.localBridgeConfig ? { ...s.localBridgeConfig, active } : null,
    }));
  },
  setLocalBridgeLastError: (msg) => {
    set({ localBridgeLastError: msg });
  },
}), {
  name: 'gustopos-cart',
  partialize: (state) => ({
    posCart: state.posCart,
    cartStore: state.cartStore,
    cartContextKey: state.cartContextKey,
    posOrderMode: state.posOrderMode,
    posTableNumber: state.posTableNumber,
    localBridgeConfig: state.localBridgeConfig,
  }),
}));

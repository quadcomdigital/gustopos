import { z } from 'zod';
import {
  appDataSchema,
  bomCreateRequestSchema,
  bomItemSchema,
  bomListResponseSchema,
  bomStockItemSchema,
  bomUpdateRequestSchema,
  bomUpsertComponentsRequestSchema,
  createOrderRequestSchema,
  closeTableRequestSchema,
  closeTableResponseSchema,
  ingredientCreateRequestSchema,
  ingredientSchema,
  ingredientUpdateRequestSchema,
  categorySchema,
  categoriesListResponseSchema,
  categoryCreateRequestSchema,
  categoryUpdateRequestSchema,
  categoryModifierPoolSchema,
  categoryModifierPoolCreateRequestSchema,
  categoryModifierPoolUpdateRequestSchema,
  tableSchema,
  tableCreateRequestSchema,
  tableUpdateRequestSchema,
  tableBulkCreateRequestSchema,
  customerSchema,
  customerListResponseSchema,
  customerCreateRequestSchema,
  customerUpdateRequestSchema,
  customerAddressCreateRequestSchema,
  customerAddressUpdateRequestSchema,
  customersQuerySchema,
  customerAnalyticsSchema,
  customerAnalyticsRequestSchema,
  operationalSummaryQuerySchema,
  reservationsSummarySchema,
  deliverySummarySchema,
  orderHistoryFiltersSchema,
  orderHistoryListResponseSchema,
  loginRequestSchema,
  loginResponseSchema,
  logoutResponseSchema,
  menuItemAdminListResponseSchema,
  menuItemAdminSchema,
  menuItemCreateRequestSchema,
  menuItemReplaceRecipeRequestSchema,
  menuItemUpdateRequestSchema,
  orderSchema,
  payTableResponseSchema,
  paymentFiltersSchema,
  refundPaymentRequestSchema,
  refundPaymentResponseSchema,
  paymentsListResponseSchema,
  printJobSchema,
  printJobsListResponseSchema,
  printJobsQuerySchema,
  dispatchPrintJobRequestSchema,
  reservationSchema,
  reservationListResponseSchema,
  reservationCreateRequestSchema,
  reservationUpdateRequestSchema,
  reservationsQuerySchema,
  deliveryOrderSchema,
  deliveryOrdersListResponseSchema,
  deliveryUpsertRequestSchema,
  deliveryStatusUpdateRequestSchema,
  deliveryOrdersQuerySchema,
  supplierSchema,
  supplierCreateRequestSchema,
  supplierUpdateRequestSchema,
  suppliersQuerySchema,
  supplierIngredientSchema,
  supplierIngredientCreateSchema,
  supplierIngredientUpdateSchema,
  supplierPoItemSchema,
  purchaseOrderSchema,
  purchaseOrderCreateRequestSchema,
  purchaseOrderStatusUpdateRequestSchema,
  purchaseOrdersQuerySchema,
  goodsReceiptSchema,
  goodsReceiptCreateRequestSchema,
  shiftSchema,
  shiftCreateRequestSchema,
  shiftUpdateRequestSchema,
  shiftsQuerySchema,
  timeEntrySchema,
  clockInRequestSchema,
  clockOutRequestSchema,
  timeReportQuerySchema,
  timeReportResponseSchema,
  fiscalClosureSchema,
  fiscalCloseRequestSchema,
  fiscalExportSchema,
  fiscalExportCreateRequestSchema,
  fiscalExportsQuerySchema,
  publicTakeawayCreateRequestSchema,
  publicTakeawayCreateResponseSchema,
  publicFunnelEventRequestSchema,
  publicFunnelEventResponseSchema,
  publicTakeawayTrackingResponseSchema,
  groupOrderCreateSessionRequestSchema,
  groupOrderCreateSessionResponseSchema,
  groupOrderJoinSessionRequestSchema,
  groupOrderJoinSessionResponseSchema,
  groupOrderPatchCartRequestSchema,
  groupOrderPatchCartResponseSchema,
  groupOrderSubmitRequestSchema,
  groupOrderSubmitResponseSchema,
  consumerAuthResponseSchema,
  consumerLoginRequestSchema,
  consumerOrderHistoryResponseSchema,
  consumerRefreshRequestSchema,
  consumerRegisterRequestSchema,
  consumerUserSchema,
  selfOrderCreateRequestSchema,
  selfOrderCreateResponseSchema,
  selfOrderResolveResponseSchema,
  selfOrderSessionRotateResponseSchema,
  refreshRequestSchema,
  refreshResponseSchema,
  splitBillRequestSchema,
  splitBillResponseSchema,
  paySelectedItemsRequestSchema,
  paySelectedItemsResponseSchema,
  markShareAsPaidRequestSchema,
  markShareAsPaidResponseSchema,
  transferTableRequestSchema,
  transferTableResponseSchema,
  voidOrderRequestSchema,
  voidOrderResponseSchema,
  uiSettingsSchema,
  updatePrintingSettingsRequestSchema,
  updateUiSettingsRequestSchema,
  staffAdminSchema,
  staffAdminListResponseSchema,
  staffCreateRequestSchema,
  staffResetPinRequestSchema,
  staffListResponseSchema,
  staffSchema,
  staffUpdateRequestSchema,
  updateOrderRequestSchema,
  loyaltyBalanceSchema,
  loyaltyTransactionSchema,
  loyaltyTransactionsListSchema,
  type AppData,
  type BomCreateRequest,
  type BomItem,
  type BomStockItem,
  type BomUpdateRequest,
  type BomUpsertComponentsRequest,
  type CreateOrderRequest,
  type CloseTableRequest,
  type CloseTableResponse,
  type Ingredient,
  type IngredientCreateRequest,
  type IngredientUpdateRequest,
  type Category,
  type CategoryCreateRequest,
  type CategoryUpdateRequest,
  type CategoryModifierPool,
  type CategoryModifierPoolCreateRequest,
  type CategoryModifierPoolUpdateRequest,
  type Table,
  type TableCreateRequest,
  type TableUpdateRequest,
  type TableBulkCreateRequest,
  type Customer,
  type CustomerCreateRequest,
  type CustomerUpdateRequest,
  type CustomerAddressCreateRequest,
  type CustomerAddressUpdateRequest,
  type CustomerAnalytics,
  type CustomerAnalyticsRequest,
  type OperationalSummaryQuery,
  type ReservationsSummary,
  type DeliverySummary,
  type CustomersQuery,
  type OrderHistoryFilters,
  type LoginResponse,
  type LogoutResponse,
  type MenuItemAdmin,
  type MenuItemCreateRequest,
  type MenuItemReplaceRecipeRequest,
  type MenuItemUpdateRequest,
  type Order,
  type PayTableResponse,
  type Payment,
  type PaymentFilters,
  type RefundPaymentRequest,
  type RefundPaymentResponse,
  type PrintJob,
  type PrintJobsQuery,
  type DispatchPrintJobRequest,
  type Reservation,
  type ReservationCreateRequest,
  type ReservationUpdateRequest,
  type ReservationsQuery,
  type DeliveryOrder,
  type DeliveryUpsertRequest,
  type DeliveryStatusUpdateRequest,
  type DeliveryOrdersQuery,
  type Supplier,
  type SupplierCreateRequest,
  type SupplierUpdateRequest,
  type SuppliersQuery,
  type SupplierIngredient,
  type SupplierIngredientCreate,
  type SupplierIngredientUpdate,
  type SupplierPoItem,
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
  type FiscalClosure,
  type FiscalCloseRequest,
  type FiscalExport,
  type FiscalExportCreateRequest,
  type FiscalExportsQuery,
  type PublicTakeawayCreateRequest,
  type PublicTakeawayCreateResponse,
  type PublicFunnelEventRequest,
  type PublicFunnelEventResponse,
  type PublicTakeawayTrackingResponse,
  type GroupOrderCreateSessionRequest,
  type GroupOrderCreateSessionResponse,
  type GroupOrderJoinSessionRequest,
  type GroupOrderJoinSessionResponse,
  type GroupOrderPatchCartRequest,
  type GroupOrderPatchCartResponse,
  type GroupOrderSubmitRequest,
  type GroupOrderSubmitResponse,
  type ConsumerAuthResponse,
  type ConsumerLoginRequest,
  type ConsumerOrderHistoryResponse,
  type ConsumerRefreshRequest,
  type ConsumerRegisterRequest,
  type ConsumerUser,
  type SelfOrderCreateRequest,
  type SelfOrderCreateResponse,
  type SelfOrderResolveResponse,
  type SelfOrderSessionRotateResponse,
  type RefreshResponse,
  type SplitBillRequest,
  type SplitBillResponse,
  type PaySelectedItemsRequest,
  type PaySelectedItemsResponse,
  type MarkShareAsPaidRequest,
  type MarkShareAsPaidResponse,
  type StaffAdmin,
  type StaffCreateRequest,
  type StaffResetPinRequest,
  type StaffListResponse,
  type Staff,
  type StaffUpdateRequest,
  type TransferTableRequest,
  type TransferTableResponse,
  type VoidOrderRequest,
  type VoidOrderResponse,
  type UiSettings,
  type UpdatePrintingSettingsRequest,
  type UpdateUiSettingsRequest,
  type UpdateOrderRequest,
  type LoyaltyBalance,
  type LoyaltyTransaction,
  type PrepItem,
  type PrepItemUpdateRequest,
  type UnitConversion,
  type UnitConversionCreateRequest,
  type PreparePrepItemResponse,
} from '@gustopos/shared';

export const API_URL = '';

// SECURITY NOTE: Tokens are stored in localStorage for SPA persistence.
// This is vulnerable to XSS if an attacker can execute arbitrary JS on the page.
// Mitigation: Add CSP headers (script-src 'self') at the server/nginx level.
// Consumer tokens are short-lived; backoffice tokens use refresh rotation.
const ACCESS_TOKEN_KEY = 'gustopos:token';
const REFRESH_TOKEN_KEY = 'gustopos:refreshToken';
const USER_KEY = 'gustopos:user';
const TENANT_KEY = 'gustopos:tenantId';
const CONSUMER_ACCESS_TOKEN_PREFIX = 'gustopos:consumer:token:';
const CONSUMER_REFRESH_TOKEN_PREFIX = 'gustopos:consumer:refreshToken:';

function consumerAccessTokenKey(tenantSlug: string): string {
  return `${CONSUMER_ACCESS_TOKEN_PREFIX}${tenantSlug}`;
}

function consumerRefreshTokenKey(tenantSlug: string): string {
  return `${CONSUMER_REFRESH_TOKEN_PREFIX}${tenantSlug}`;
}

export function getConsumerAccessToken(tenantSlug: string): string | null {
  return localStorage.getItem(consumerAccessTokenKey(tenantSlug));
}

function getConsumerRefreshToken(tenantSlug: string): string | null {
  return localStorage.getItem(consumerRefreshTokenKey(tenantSlug));
}

function persistConsumerSession(tenantSlug: string, payload: ConsumerAuthResponse) {
  localStorage.setItem(consumerAccessTokenKey(tenantSlug), payload.token);
  localStorage.setItem(consumerRefreshTokenKey(tenantSlug), payload.refreshToken);
}

export function clearConsumerSession(tenantSlug: string) {
  localStorage.removeItem(consumerAccessTokenKey(tenantSlug));
  localStorage.removeItem(consumerRefreshTokenKey(tenantSlug));
}

function consumerAuthHeaders(tenantSlug: string): Record<string, string> {
  const token = getConsumerAccessToken(tenantSlug);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function getStoredUser(): Staff | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as Staff;
  } catch {
    return null;
  }
}

export function hasAuthSession(): boolean {
  return Boolean(getAccessToken() && getRefreshToken());
}

export function clearAuthSession() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(TENANT_KEY);
}

export async function logout(): Promise<void> {
  const response = await authorizedFetch(`${API_URL}/api/auth/logout`, {
    method: 'POST',
  });

  if (response.ok) {
    await readJson(response, logoutResponseSchema);
  }

  clearAuthSession();
}

export function persistAuthSession(payload: RefreshResponse) {
  localStorage.setItem(ACCESS_TOKEN_KEY, payload.token);
  localStorage.setItem(REFRESH_TOKEN_KEY, payload.refreshToken);
  localStorage.setItem(USER_KEY, JSON.stringify(payload.user));
  if (payload.user.tenantId) {
    localStorage.setItem(TENANT_KEY, payload.user.tenantId);
  }
}

function authHeaders(): Record<string, string> {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

let _cachedTenantId: string | null = undefined as unknown as string;
let _tenantIdResolved = false;

function inferTenantId(): string | null {
  if (_tenantIdResolved) return _cachedTenantId;
  // 0. URL path /<slug>/... (highest priority — enforces tenant via URL)
  const RESERVED_PATH_SEGMENTS = ['app', 'superadmin', 'api', 'socket.io', 'assets', 'signing'];
  const pathMatch = window.location.pathname.match(/^\/([a-zA-Z0-9_-]+)(?:\/|$)/);
  if (pathMatch?.[1]) {
    const slug = pathMatch[1];
    if (!RESERVED_PATH_SEGMENTS.includes(slug)) {
      localStorage.setItem(TENANT_KEY, slug);
      _cachedTenantId = slug;
      _tenantIdResolved = true;
      return slug;
    }
  }

  // 1. Check URL query param ?tenant=<slug_or_id>
  const params = new URLSearchParams(window.location.search);
  const urlTenant = params.get('tenant');
  if (urlTenant && urlTenant.trim().length > 0) {
    const normalized = urlTenant.trim();
    localStorage.setItem(TENANT_KEY, normalized);
    _cachedTenantId = normalized;
    _tenantIdResolved = true;
    return normalized;
  }

  // 2. Check stored user tenant
  const storedUser = getStoredUser();
  if (storedUser?.tenantId) {
    const currentStored = localStorage.getItem(TENANT_KEY);
    if (currentStored !== storedUser.tenantId) {
      localStorage.setItem(TENANT_KEY, storedUser.tenantId);
    }
    _cachedTenantId = storedUser.tenantId;
    _tenantIdResolved = true;
    return storedUser.tenantId;
  }

  // 3. Check localStorage
  const stored = localStorage.getItem(TENANT_KEY);
  if (stored && stored.trim().length > 0) {
    _cachedTenantId = stored;
    _tenantIdResolved = true;
    return stored;
  }

  // 4. Subdomain inference (skip for IP addresses)
  const hostname = window.location.hostname.toLowerCase();
  if (hostname.includes('.')) {
    const isIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname);
    if (!isIp) {
      const subdomain = hostname.split('.')[0];
      if (subdomain && subdomain !== 'www' && subdomain !== 'localhost') {
        _cachedTenantId = `tenant_${subdomain}`;
        _tenantIdResolved = true;
        return _cachedTenantId;
      }
    }
  }

  _cachedTenantId = null;
  _tenantIdResolved = true;
  return null;
}

function tenantHeaders(): Record<string, string> {
  const tenantId = inferTenantId();
  if (!tenantId) {
    return {};
  }

  localStorage.setItem(TENANT_KEY, tenantId);
  return { 'X-Tenant-Id': tenantId };
}

async function readJson<T>(response: Response, parser: { parse: (x: unknown) => T }): Promise<T> {
  const payload = await response.json();
  if (!response.ok) {
    const message = typeof payload === 'object' && payload && 'message' in payload
      ? String((payload as { message: string }).message)
      : 'Request failed';
    throw new Error(message);
  }

  return parser.parse(payload);
}

export async function authorizedFetch(url: string, init?: RequestInit, retried = false, existingIdempotencyKey?: string): Promise<Response> {
  const method = (init?.method ?? 'GET').toUpperCase();
  const idempotencyKey = existingIdempotencyKey ?? (
    ['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)
      ? (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`)
      : undefined
  );

  const response = await fetch(url, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      ...authHeaders(),
      ...tenantHeaders(),
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    },
  });

  if (response.status !== 401 || retried) {
    return response;
  }

  const refreshed = await refreshSession();
  if (!refreshed) {
    return response;
  }

  return authorizedFetch(url, init, true, idempotencyKey);
}


// Thin wrapper for authed JSON calls (used by bridge-zone helpers below).
async function authedJson<T>(url: string, init?: RequestInit & { json?: unknown; skipTenant?: boolean }): Promise<T> {
  const opts: RequestInit = { ...(init ?? {}) };
  if (init?.json !== undefined) {
    opts.body = JSON.stringify(init.json);
    opts.headers = { 'Content-Type': 'application/json', ...(opts.headers as Record<string, string> | undefined) };
  }
  delete (opts as Record<string, unknown>).json;
  delete (opts as Record<string, unknown>).skipTenant;
  if (init?.skipTenant) {
    // Bridge protocol: use X-Print-Bridge-Key instead of tenant prefix.
    const response = await fetch(`${API_URL}${url}`, { ...opts, headers: { ...authHeaders(), ...(opts.headers as Record<string, string> | undefined) } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return (await response.json()) as T;
  }
  const response = await authorizedFetch(`${API_URL}${url}`, opts);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as T;
}

export async function fetchStaff(): Promise<StaffListResponse> {
  const response = await fetch(`${API_URL}/api/auth/staff`, {
    headers: {
      ...tenantHeaders(),
    },
  });
  return readJson(response, staffListResponseSchema);
}

export async function login(staffId: string, pin: string): Promise<LoginResponse> {
  const request = loginRequestSchema.parse({ staffId, pin });
  const response = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...tenantHeaders() },
    body: JSON.stringify(request),
  });

  const payload = await readJson(response, loginResponseSchema);
  persistAuthSession(payload);
  return payload;
}

export async function refreshSession(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    clearAuthSession();
    return false;
  }

  const request = refreshRequestSchema.parse({ refreshToken });
  const response = await fetch(`${API_URL}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...tenantHeaders() },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    clearAuthSession();
    return false;
  }

  const payload = await readJson(response, refreshResponseSchema);
  persistAuthSession(payload);
  return true;
}

export async function fetchData(): Promise<AppData> {
  const response = await authorizedFetch(`${API_URL}/api/data`);

  return readJson(response, appDataSchema);
}

export interface BootstrapResponse {
  data: AppData;
  staff: Staff[];
  uiSettings: UiSettings;
  staffAdmin: StaffAdmin[];
  payments: Payment[];
  printJobs: PrintJob[];
  inventoryItems: Ingredient[];
  bomItems: BomItem[];
  menuItemsAdmin: MenuItemAdmin[];
  categories: Category[];
  customers: Customer[];
  orderHistory: Order[];
  customerAnalytics: CustomerAnalytics | null;
}

const bootstrapResponseSchema = z.object({
  data: appDataSchema,
  staff: staffListResponseSchema,
  uiSettings: uiSettingsSchema,
  staffAdmin: staffAdminListResponseSchema,
  payments: paymentsListResponseSchema,
  printJobs: printJobsListResponseSchema,
  inventoryItems: z.array(ingredientSchema),
  bomItems: bomListResponseSchema,
  menuItemsAdmin: menuItemAdminListResponseSchema,
  categories: categoriesListResponseSchema,
  customers: customerListResponseSchema,
  orderHistory: orderHistoryListResponseSchema,
  customerAnalytics: customerAnalyticsSchema.nullable(),
});

export async function fetchBootstrap(enabledModules: string[]): Promise<BootstrapResponse> {
  const modules = enabledModules.join(',');
  const response = await authorizedFetch(`${API_URL}/api/bootstrap?modules=${encodeURIComponent(modules)}`);
  return readJson(response, bootstrapResponseSchema);
}

export async function createIngredient(payload: IngredientCreateRequest): Promise<Ingredient> {
  const request = ingredientCreateRequestSchema.parse(payload);
  const response = await authorizedFetch(`${API_URL}/api/inventory`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  return readJson(response, ingredientSchema);
}

export async function fetchInventory(): Promise<Ingredient[]> {
  const response = await authorizedFetch(`${API_URL}/api/inventory`);
  return readJson(response, z.array(ingredientSchema));
}

export async function updateIngredient(id: string, payload: IngredientUpdateRequest): Promise<Ingredient> {
  const request = ingredientUpdateRequestSchema.parse(payload);
  const response = await authorizedFetch(`${API_URL}/api/inventory/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  return readJson(response, ingredientSchema);
}

export async function deleteIngredient(id: string): Promise<LogoutResponse> {
  const response = await authorizedFetch(`${API_URL}/api/inventory/${id}`, {
    method: 'DELETE',
  });

  return readJson(response, logoutResponseSchema);
}

export async function adjustIngredient(id: string, payload: { quantity: number; notes?: string }): Promise<Ingredient> {
  const response = await authorizedFetch(`${API_URL}/api/inventory/${id}/adjust`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  return readJson(response, ingredientSchema);
}

export async function fetchStockMovements(filters?: {
  ingredientId?: string;
  orderId?: string;
  movementType?: string;
  limit?: number;
  offset?: number;
}): Promise<{ items: Array<{
  id: string;
  tenantId: string;
  ingredientId: string;
  orderId: string | null;
  movementType: string;
  quantity: number;
  previousQuantity: number;
  newQuantity: number;
  notes: string | null;
  staffId: string | null;
  createdAt: string;
}>; total: number }> {
  const params = new URLSearchParams();
  if (filters?.ingredientId) params.set('ingredientId', filters.ingredientId);
  if (filters?.orderId) params.set('orderId', filters.orderId);
  if (filters?.movementType) params.set('movementType', filters.movementType);
  if (filters?.limit) params.set('limit', String(filters.limit));
  if (filters?.offset) params.set('offset', String(filters.offset));
  const suffix = params.toString().length > 0 ? `?${params.toString()}` : '';
  const response = await authorizedFetch(`${API_URL}/api/stock-movements${suffix}`);
  return readJson(response, z.object({
    items: z.array(z.object({
      id: z.string(),
      tenantId: z.string(),
      ingredientId: z.string(),
      orderId: z.string().nullable(),
      movementType: z.string(),
      quantity: z.number(),
      previousQuantity: z.number(),
      newQuantity: z.number(),
      notes: z.string().nullable(),
      staffId: z.string().nullable(),
      createdAt: z.string(),
    })),
    total: z.number(),
  }));
}

export async function fetchCategories(scope?: Category['scope']): Promise<Category[]> {
  const query = new URLSearchParams();
  if (scope) query.set('scope', scope);
  const suffix = query.toString().length > 0 ? `?${query.toString()}` : '';
  const response = await authorizedFetch(`${API_URL}/api/categories${suffix}`);
  return readJson(response, categoriesListResponseSchema);
}

export async function fetchSimpleCatalogCategories(): Promise<Category[]> {
  const response = await authorizedFetch(`${API_URL}/api/simple-catalog/categories`);
  return readJson(response, categoriesListResponseSchema);
}

export async function createCategory(payload: CategoryCreateRequest): Promise<Category> {
  const request = categoryCreateRequestSchema.parse(payload);
  const response = await authorizedFetch(`${API_URL}/api/categories`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  return readJson(response, categorySchema);
}

export async function createSimpleCatalogCategory(payload: Omit<CategoryCreateRequest, 'scope'>): Promise<Category> {
  const request = categoryCreateRequestSchema.parse({ ...payload, scope: 'menu' });
  const response = await authorizedFetch(`${API_URL}/api/simple-catalog/categories`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  return readJson(response, categorySchema);
}

export async function updateCategory(id: string, payload: CategoryUpdateRequest): Promise<Category> {
  const request = categoryUpdateRequestSchema.parse(payload);
  const response = await authorizedFetch(`${API_URL}/api/categories/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  return readJson(response, categorySchema);
}

export async function updateSimpleCatalogCategory(id: string, payload: CategoryUpdateRequest): Promise<Category> {
  const request = categoryUpdateRequestSchema.parse(payload);
  const response = await authorizedFetch(`${API_URL}/api/simple-catalog/categories/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  return readJson(response, categorySchema);
}

// ─── Tables CRUD ──────────────────────────────────────────────

export async function fetchTables(): Promise<Table[]> {
  const response = await authorizedFetch(`${API_URL}/api/tables`);
  const data = await response.json();
  return z.array(tableSchema).parse(data);
}

export async function createTable(payload: TableCreateRequest): Promise<Table> {
  const request = tableCreateRequestSchema.parse(payload);
  const response = await authorizedFetch(`${API_URL}/api/tables`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  const data = await response.json();
  return tableSchema.parse(data);
}

export async function bulkCreateTables(payload: TableBulkCreateRequest): Promise<Table[]> {
  const request = tableBulkCreateRequestSchema.parse(payload);
  const response = await authorizedFetch(`${API_URL}/api/tables/bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  const data = await response.json();
  return z.array(tableSchema).parse(data);
}

export async function updateTable(id: string, payload: TableUpdateRequest): Promise<Table> {
  const request = tableUpdateRequestSchema.parse(payload);
  const response = await authorizedFetch(`${API_URL}/api/tables/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  const data = await response.json();
  return tableSchema.parse(data);
}

export async function deleteTable(id: string): Promise<{ success: true }> {
  const response = await authorizedFetch(`${API_URL}/api/tables/${id}`, {
    method: 'DELETE',
  });
  return response.json() as Promise<{ success: true }>;
}

export async function deleteCategory(id: string): Promise<{ success: true }> {
  const response = await authorizedFetch(`${API_URL}/api/categories/${id}`, {
    method: 'DELETE',
  });
  return response.json() as Promise<{ success: true }>;
}

export async function fetchCategoryModifierPools(categoryId?: string): Promise<CategoryModifierPool[]> {
  const query = new URLSearchParams();
  if (categoryId) query.set('categoryId', categoryId);
  const suffix = query.toString().length > 0 ? `?${query.toString()}` : '';
  const response = await authorizedFetch(`${API_URL}/api/category-modifier-pools${suffix}`);
  return readJson(response, z.array(categoryModifierPoolSchema));
}

export async function createCategoryModifierPool(payload: CategoryModifierPoolCreateRequest): Promise<CategoryModifierPool> {
  const request = categoryModifierPoolCreateRequestSchema.parse(payload);
  const response = await authorizedFetch(`${API_URL}/api/category-modifier-pools`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  return readJson(response, categoryModifierPoolSchema);
}

export async function updateCategoryModifierPool(id: string, payload: CategoryModifierPoolUpdateRequest): Promise<CategoryModifierPool> {
  const request = categoryModifierPoolUpdateRequestSchema.parse(payload);
  const response = await authorizedFetch(`${API_URL}/api/category-modifier-pools/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  return readJson(response, categoryModifierPoolSchema);
}

export async function deleteCategoryModifierPool(id: string): Promise<{ success: true }> {
  const response = await authorizedFetch(`${API_URL}/api/category-modifier-pools/${id}`, {
    method: 'DELETE',
  });
  return response.json() as Promise<{ success: true }>;
}

export async function fetchCustomers(queryPayload: CustomersQuery = {}): Promise<Customer[]> {
  const parsed = customersQuerySchema.parse(queryPayload);
  const query = new URLSearchParams();
  if (parsed.query) query.set('query', parsed.query);
  if (parsed.limit) query.set('limit', String(parsed.limit));
  const suffix = query.toString().length > 0 ? `?${query.toString()}` : '';
  const response = await authorizedFetch(`${API_URL}/api/customers${suffix}`);
  return readJson(response, customerListResponseSchema);
}

export async function fetchCustomerById(id: string): Promise<Customer> {
  const response = await authorizedFetch(`${API_URL}/api/customers/${encodeURIComponent(id)}`);
  return readJson(response, customerSchema);
}

export async function createOrReuseCustomer(payload: CustomerCreateRequest): Promise<Customer> {
  const request = customerCreateRequestSchema.parse(payload);
  const response = await authorizedFetch(`${API_URL}/api/customers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  return readJson(response, customerSchema);
}

export async function updateCustomer(id: string, payload: CustomerUpdateRequest): Promise<Customer> {
  const request = customerUpdateRequestSchema.parse(payload);
  const response = await authorizedFetch(`${API_URL}/api/customers/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  return readJson(response, customerSchema);
}

export async function deleteCustomer(id: string): Promise<{ success: true }> {
  const response = await authorizedFetch(`${API_URL}/api/customers/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  return readJson(response, z.object({ success: z.literal(true) }));
}

const customerAddressSchema = z.object({
  id: z.string(),
  label: z.string().nullable(),
  address: z.string(),
  isDefault: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export async function fetchCustomerAddresses(customerId: string): Promise<Array<z.infer<typeof customerAddressSchema>>> {
  const response = await authorizedFetch(`${API_URL}/api/customers/${encodeURIComponent(customerId)}/addresses`);
  return readJson(response, z.array(customerAddressSchema));
}

export async function createCustomerAddress(customerId: string, payload: CustomerAddressCreateRequest): Promise<z.infer<typeof customerAddressSchema>> {
  const request = customerAddressCreateRequestSchema.parse(payload);
  const response = await authorizedFetch(`${API_URL}/api/customers/${encodeURIComponent(customerId)}/addresses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  return readJson(response, customerAddressSchema);
}

export async function updateCustomerAddress(customerId: string, addressId: string, payload: CustomerAddressUpdateRequest): Promise<z.infer<typeof customerAddressSchema>> {
  const request = customerAddressUpdateRequestSchema.parse(payload);
  const response = await authorizedFetch(`${API_URL}/api/customers/${encodeURIComponent(customerId)}/addresses/${encodeURIComponent(addressId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  return readJson(response, customerAddressSchema);
}

export async function deleteCustomerAddress(customerId: string, addressId: string): Promise<{ success: true }> {
  const response = await authorizedFetch(`${API_URL}/api/customers/${encodeURIComponent(customerId)}/addresses/${encodeURIComponent(addressId)}`, {
    method: 'DELETE',
  });
  return readJson(response, z.object({ success: z.literal(true) }));
}

export async function fetchCustomerAnalytics(payload: CustomerAnalyticsRequest = {}): Promise<CustomerAnalytics> {
  const parsed = customerAnalyticsRequestSchema.parse(payload);
  const query = new URLSearchParams();
  if (parsed.from) query.set('from', parsed.from);
  if (parsed.to) query.set('to', parsed.to);
  const suffix = query.toString().length > 0 ? `?${query.toString()}` : '';
  const response = await authorizedFetch(`${API_URL}/api/customers/analytics-summary${suffix}`);
  return readJson(response, customerAnalyticsSchema);
}

export async function fetchReservationsSummary(queryPayload: OperationalSummaryQuery = {}): Promise<ReservationsSummary> {
  const parsed = operationalSummaryQuerySchema.parse(queryPayload);
  const query = new URLSearchParams();
  if (parsed.from) query.set('from', parsed.from);
  if (parsed.to) query.set('to', parsed.to);
  const suffix = query.toString().length > 0 ? `?${query.toString()}` : '';
  const response = await authorizedFetch(`${API_URL}/api/analytics/reservations-summary${suffix}`);
  return readJson(response, reservationsSummarySchema);
}

export async function fetchDeliverySummary(queryPayload: OperationalSummaryQuery = {}): Promise<DeliverySummary> {
  const parsed = operationalSummaryQuerySchema.parse(queryPayload);
  const query = new URLSearchParams();
  if (parsed.from) query.set('from', parsed.from);
  if (parsed.to) query.set('to', parsed.to);
  const suffix = query.toString().length > 0 ? `?${query.toString()}` : '';
  const response = await authorizedFetch(`${API_URL}/api/analytics/delivery-summary${suffix}`);
  return readJson(response, deliverySummarySchema);
}

export async function fetchOrderHistory(filters: OrderHistoryFilters = {}): Promise<Order[]> {
  const parsed = orderHistoryFiltersSchema.parse(filters);
  const query = new URLSearchParams();
  if (parsed.from) query.set('from', parsed.from);
  if (parsed.to) query.set('to', parsed.to);
  if (parsed.status) query.set('status', parsed.status);
  if (parsed.orderType) query.set('orderType', parsed.orderType);
  if (parsed.staffId) query.set('staffId', parsed.staffId);
  if (parsed.table) query.set('table', parsed.table);
  if (parsed.customerId) query.set('customerId', parsed.customerId);
  if (parsed.limit) query.set('limit', String(parsed.limit));
  const suffix = query.toString().length > 0 ? `?${query.toString()}` : '';
  const response = await authorizedFetch(`${API_URL}/api/orders/history${suffix}`);
  return readJson(response, orderHistoryListResponseSchema);
}

export async function fetchUiSettings(): Promise<UiSettings> {
  const response = await authorizedFetch(`${API_URL}/api/settings`);
  return readJson(response, uiSettingsSchema);
}

export async function updateUiSettings(payload: UpdateUiSettingsRequest): Promise<UiSettings> {
  const request = updateUiSettingsRequestSchema.parse(payload);
  const response = await authorizedFetch(`${API_URL}/api/settings`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  return readJson(response, uiSettingsSchema);
}

export async function updatePrintingSettings(payload: UpdatePrintingSettingsRequest): Promise<UiSettings> {
  const request = updatePrintingSettingsRequestSchema.parse(payload);
  const response = await authorizedFetch(`${API_URL}/api/settings/printing`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  return readJson(response, uiSettingsSchema);
}

// ─── QZ Tray Configuration ─────────────────────────────────────────────

export type QzTrayConfig = {
  hosts: string[];
  securePorts: number[];
  insecurePorts: number[];
  useSecure: boolean;
};

export type QzTrayConfigResponse = { qzTray: QzTrayConfig };

export async function fetchQzTrayConfig(): Promise<QzTrayConfigResponse> {
  const response = await authorizedFetch(`${API_URL}/api/printing/qz-config`);
  return response.json() as Promise<QzTrayConfigResponse>;
}

export async function updateQzTrayConfig(payload: { qzTray: Partial<QzTrayConfig> }): Promise<QzTrayConfigResponse> {
  const response = await authorizedFetch(`${API_URL}/api/printing/qz-config`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  return response.json() as Promise<QzTrayConfigResponse>;
}

export async function createOrder(payload: CreateOrderRequest): Promise<Order> {
  const request = createOrderRequestSchema.parse(payload);
  const response = await authorizedFetch(`${API_URL}/api/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  return readJson(response, orderSchema);
}

export async function updateOrder(id: string, payload: UpdateOrderRequest): Promise<Order> {
  const request = updateOrderRequestSchema.parse(payload);
  const response = await authorizedFetch(`${API_URL}/api/orders/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  return readJson(response, orderSchema);
}

export async function voidOrder(id: string, payload: VoidOrderRequest): Promise<VoidOrderResponse> {
  const request = voidOrderRequestSchema.parse(payload);
  const response = await authorizedFetch(`${API_URL}/api/orders/${id}/void`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  return readJson(response, voidOrderResponseSchema);
}

export async function payTable(tableId: string): Promise<PayTableResponse> {
  const response = await authorizedFetch(`${API_URL}/api/tables/${tableId}/pay`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(closeTableRequestSchema.parse({ method: 'cash' })),
  });

  const closeResponse = await readJson(response, closeTableResponseSchema);
  return payTableResponseSchema.parse({ success: closeResponse.success });
}

export async function closeTable(tableId: string, payload: CloseTableRequest): Promise<CloseTableResponse> {
  const request = closeTableRequestSchema.parse(payload);
  const response = await authorizedFetch(`${API_URL}/api/tables/${tableId}/pay`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  return readJson(response, closeTableResponseSchema);
}

export async function splitBill(tableId: string, payload: SplitBillRequest): Promise<SplitBillResponse> {
  const request = splitBillRequestSchema.parse(payload);
  const response = await authorizedFetch(`${API_URL}/api/tables/${tableId}/split-bill`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  return readJson(response, splitBillResponseSchema);
}

export async function paySelectedItems(tableId: string, payload: PaySelectedItemsRequest): Promise<PaySelectedItemsResponse> {
  const request = paySelectedItemsRequestSchema.parse(payload);
  const response = await authorizedFetch(`${API_URL}/api/tables/${tableId}/pay-items`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  return readJson(response, paySelectedItemsResponseSchema);
}

export interface TablePaymentStatus {
  items: Array<{
    orderItemId: number;
    name: string;
    price: number;
    totalQuantity: number;
    paidQuantity: number;
    availableQuantity: number;
    fullyPaid: boolean;
  }>;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  splitShares?: Array<{
    shareIndex: number;
    amount: number;
    method: string;
    gatewayReference: string | null;
    isPaid: boolean;
    paymentId: string;
  }>;
}

export async function getTablePaymentStatus(tableId: string): Promise<TablePaymentStatus> {
  const response = await authorizedFetch(`${API_URL}/api/tables/${tableId}/payment-status`);
  if (!response.ok) {
    throw new Error('Failed to fetch payment status');
  }
  return response.json();
}

export async function markShareAsPaid(
  tableId: string,
  shareIndex: number,
  payload: MarkShareAsPaidRequest,
): Promise<MarkShareAsPaidResponse> {
  const request = markShareAsPaidRequestSchema.parse(payload);
  const response = await authorizedFetch(`${API_URL}/api/tables/${tableId}/split-pay/${shareIndex}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  return readJson(response, markShareAsPaidResponseSchema);
}

export async function transferTable(
  sourceTableId: string,
  payload: TransferTableRequest,
): Promise<TransferTableResponse> {
  const request = transferTableRequestSchema.parse(payload);
  const response = await authorizedFetch(`${API_URL}/api/tables/${sourceTableId}/transfer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  return readJson(response, transferTableResponseSchema);
}

export async function fetchBomItems(): Promise<BomItem[]> {
  const response = await authorizedFetch(`${API_URL}/api/bom`);
  return readJson(response, bomListResponseSchema);
}

export async function createBomItem(payload: BomCreateRequest): Promise<BomItem> {
  const request = bomCreateRequestSchema.parse(payload);
  const response = await authorizedFetch(`${API_URL}/api/bom`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  return readJson(response, bomItemSchema);
}

export async function updateBomItem(id: string, payload: BomUpdateRequest): Promise<BomItem> {
  const request = bomUpdateRequestSchema.parse(payload);
  const response = await authorizedFetch(`${API_URL}/api/bom/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  return readJson(response, bomItemSchema);
}

export async function replaceBomComponents(id: string, payload: BomUpsertComponentsRequest): Promise<BomItem> {
  const request = bomUpsertComponentsRequestSchema.parse(payload);
  const response = await authorizedFetch(`${API_URL}/api/bom/${id}/components`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  return readJson(response, bomItemSchema);
}

export async function addBomComponent(id: string, payload: { componentType: 'ingredient' | 'bom' | 'prep'; componentId: string; quantity: number; unit: string }): Promise<BomItem> {
  const response = await authorizedFetch(`${API_URL}/api/bom/${id}/components/add`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  return readJson(response, bomItemSchema);
}

export async function removeBomComponent(id: string, payload: { componentType: 'ingredient' | 'bom' | 'prep'; componentId: string }): Promise<BomItem> {
  const response = await authorizedFetch(`${API_URL}/api/bom/${id}/components/remove`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  return readJson(response, bomItemSchema);
}

export async function deleteBomItem(id: string): Promise<LogoutResponse> {
  const response = await authorizedFetch(`${API_URL}/api/bom/${id}`, {
    method: 'DELETE',
  });

  return readJson(response, logoutResponseSchema);
}

export async function fetchBomStock(): Promise<BomStockItem[]> {
  const response = await authorizedFetch(`${API_URL}/api/bom/stock`);
  return readJson(response, z.array(bomStockItemSchema));
}

export async function prepareBom(id: string, quantity: number): Promise<{
  bomId: string;
  name: string;
  previousStock: number;
  newStock: number;
  ingredientsDeducted: Array<{ id: string; name: string; quantity: number; unit: string }>;
}> {
  const response = await authorizedFetch(`${API_URL}/api/bom/${id}/prepare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quantity }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message || 'Failed to prepare BOM');
  }

  return response.json();
}

export async function updateBomPreBatched(id: string, isPreBatched: boolean): Promise<void> {
  await authorizedFetch(`${API_URL}/api/bom/${id}/pre-batched`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isPreBatched }),
  });
}

export async function fetchPayments(filters: PaymentFilters = {}): Promise<Payment[]> {
  const parsed = paymentFiltersSchema.parse(filters);
  const query = new URLSearchParams();

  if (parsed.from) query.set('from', parsed.from);
  if (parsed.to) query.set('to', parsed.to);
  if (parsed.method) query.set('method', parsed.method);
  if (parsed.kind) query.set('kind', parsed.kind);
  if (parsed.staffId) query.set('staffId', parsed.staffId);
  if (parsed.limit) query.set('limit', String(parsed.limit));

  const suffix = query.toString().length > 0 ? `?${query.toString()}` : '';
  const response = await authorizedFetch(`${API_URL}/api/payments${suffix}`);
  return readJson(response, paymentsListResponseSchema);
}

export async function refundPayment(id: string, payload: RefundPaymentRequest): Promise<RefundPaymentResponse> {
  const request = refundPaymentRequestSchema.parse(payload);
  const response = await authorizedFetch(`${API_URL}/api/payments/${id}/refund`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  return readJson(response, refundPaymentResponseSchema);
}

export async function fetchPrintJobs(queryPayload: PrintJobsQuery = {}): Promise<PrintJob[]> {
  const parsed = printJobsQuerySchema.parse(queryPayload);
  const query = new URLSearchParams();
  if (parsed.status) query.set('status', parsed.status);
  if (parsed.area) query.set('area', parsed.area);
  if (parsed.limit) query.set('limit', String(parsed.limit));
  const suffix = query.toString().length > 0 ? `?${query.toString()}` : '';
  const response = await authorizedFetch(`${API_URL}/api/print-jobs${suffix}`);
  return readJson(response, printJobsListResponseSchema);
}

export async function dispatchPrintJob(id: string, payload: DispatchPrintJobRequest = {}): Promise<PrintJob> {
  const request = dispatchPrintJobRequestSchema.parse(payload);
  const response = await authorizedFetch(`${API_URL}/api/print-jobs/${id}/dispatch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });
  return readJson(response, printJobSchema);
}

export async function completePrintJob(id: string): Promise<PrintJob> {
  const response = await authorizedFetch(`${API_URL}/api/print-jobs/${id}/complete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  return readJson(response, printJobSchema);
}

export async function fetchReservations(queryPayload: ReservationsQuery = {}): Promise<Reservation[]> {
  const parsed = reservationsQuerySchema.parse(queryPayload);
  const query = new URLSearchParams();
  if (parsed.from) query.set('from', parsed.from);
  if (parsed.to) query.set('to', parsed.to);
  if (parsed.status) query.set('status', parsed.status);
  if (parsed.limit) query.set('limit', String(parsed.limit));
  const suffix = query.toString().length > 0 ? `?${query.toString()}` : '';
  const response = await authorizedFetch(`${API_URL}/api/reservations${suffix}`);
  return readJson(response, reservationListResponseSchema);
}

export async function createReservation(payload: ReservationCreateRequest): Promise<Reservation> {
  const request = reservationCreateRequestSchema.parse(payload);
  const response = await authorizedFetch(`${API_URL}/api/reservations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });
  return readJson(response, reservationSchema);
}

export async function updateReservation(id: string, payload: ReservationUpdateRequest): Promise<Reservation> {
  const request = reservationUpdateRequestSchema.parse(payload);
  const response = await authorizedFetch(`${API_URL}/api/reservations/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });
  return readJson(response, reservationSchema);
}

export async function confirmReservation(id: string): Promise<Reservation> {
  const response = await authorizedFetch(`${API_URL}/api/reservations/${id}/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  return readJson(response, reservationSchema);
}

export async function cancelReservation(id: string): Promise<Reservation> {
  const response = await authorizedFetch(`${API_URL}/api/reservations/${id}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  return readJson(response, reservationSchema);
}

export async function markReservationNoShow(id: string, reason: string): Promise<Reservation> {
  const response = await authorizedFetch(`${API_URL}/api/reservations/${id}/no-show`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
  return readJson(response, reservationSchema);
}

export async function createPublicReservation(
  tenantSlug: string,
  payload: ReservationCreateRequest,
): Promise<Reservation> {
  const request = reservationCreateRequestSchema.parse(payload);
  const response = await fetch(`${API_URL}/api/public/${encodeURIComponent(tenantSlug)}/reservations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  return readJson(response, reservationSchema);
}

export async function fetchDeliveryOrders(queryPayload: DeliveryOrdersQuery = {}): Promise<DeliveryOrder[]> {
  const parsed = deliveryOrdersQuerySchema.parse(queryPayload);
  const query = new URLSearchParams();
  if (parsed.status) query.set('status', parsed.status);
  if (parsed.from) query.set('from', parsed.from);
  if (parsed.to) query.set('to', parsed.to);
  if (parsed.limit) query.set('limit', String(parsed.limit));
  const suffix = query.toString().length > 0 ? `?${query.toString()}` : '';
  const response = await authorizedFetch(`${API_URL}/api/delivery/orders${suffix}`);
  return readJson(response, deliveryOrdersListResponseSchema);
}

export async function upsertDeliveryOrder(orderId: string, payload: DeliveryUpsertRequest): Promise<DeliveryOrder> {
  const request = deliveryUpsertRequestSchema.parse(payload);
  const response = await authorizedFetch(`${API_URL}/api/delivery/orders/${orderId}/upsert`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });
  return readJson(response, deliveryOrderSchema);
}

export async function updateDeliveryOrderStatus(orderId: string, payload: DeliveryStatusUpdateRequest): Promise<DeliveryOrder> {
  const request = deliveryStatusUpdateRequestSchema.parse(payload);
  const response = await authorizedFetch(`${API_URL}/api/delivery/orders/${orderId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });
  return readJson(response, deliveryOrderSchema);
}

export async function dispatchDeliveryOrder(orderId: string): Promise<DeliveryOrder> {
  const response = await authorizedFetch(`${API_URL}/api/delivery/orders/${orderId}/dispatch`, {
    method: 'POST',
  });
  return readJson(response, deliveryOrderSchema);
}

export async function fetchSuppliers(queryPayload: SuppliersQuery = {}): Promise<Supplier[]> {
  const parsed = suppliersQuerySchema.parse(queryPayload);
  const query = new URLSearchParams();
  if (parsed.active !== undefined) query.set('active', String(parsed.active));
  if (parsed.query) query.set('query', parsed.query);
  if (parsed.limit) query.set('limit', String(parsed.limit));
  const suffix = query.toString().length > 0 ? `?${query.toString()}` : '';
  const response = await authorizedFetch(`${API_URL}/api/purchasing/suppliers${suffix}`);
  return readJson(response, z.array(supplierSchema));
}

export async function createSupplier(payload: SupplierCreateRequest): Promise<Supplier> {
  const request = supplierCreateRequestSchema.parse(payload);
  const response = await authorizedFetch(`${API_URL}/api/purchasing/suppliers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });
  return readJson(response, supplierSchema);
}

export async function updateSupplier(id: string, payload: SupplierUpdateRequest): Promise<Supplier> {
  const request = supplierUpdateRequestSchema.parse(payload);
  const response = await authorizedFetch(`${API_URL}/api/purchasing/suppliers/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });
  return readJson(response, supplierSchema);
}

export async function fetchSupplierIngredients(supplierId: string): Promise<SupplierIngredient[]> {
  const response = await authorizedFetch(`${API_URL}/api/purchasing/suppliers/${supplierId}/ingredients`);
  return readJson(response, z.array(supplierIngredientSchema));
}

export async function fetchIngredientSuppliers(ingredientId: string): Promise<SupplierIngredient[]> {
  const response = await authorizedFetch(`${API_URL}/api/purchasing/ingredients/${ingredientId}/suppliers`);
  return readJson(response, z.array(supplierIngredientSchema));
}

export async function createSupplierIngredient(payload: SupplierIngredientCreate): Promise<void> {
  const request = supplierIngredientCreateSchema.parse(payload);
  await authorizedFetch(`${API_URL}/api/purchasing/supplier-ingredients`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
}

export async function updateSupplierIngredient(supplierId: string, ingredientId: string, payload: SupplierIngredientUpdate): Promise<void> {
  const request = supplierIngredientUpdateSchema.parse(payload);
  await authorizedFetch(`${API_URL}/api/purchasing/supplier-ingredients/${supplierId}/${ingredientId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
}

export async function deleteSupplierIngredient(supplierId: string, ingredientId: string): Promise<void> {
  await authorizedFetch(`${API_URL}/api/purchasing/supplier-ingredients/${supplierId}/${ingredientId}`, {
    method: 'DELETE',
  });
}

export async function fetchSupplierPoItems(supplierId: string): Promise<SupplierPoItem[]> {
  const response = await authorizedFetch(`${API_URL}/api/purchasing/suppliers/${supplierId}/po-items`);
  return readJson(response, z.array(supplierPoItemSchema));
}

export async function fetchPurchaseOrders(queryPayload: PurchaseOrdersQuery = {}): Promise<PurchaseOrder[]> {
  const parsed = purchaseOrdersQuerySchema.parse(queryPayload);
  const query = new URLSearchParams();
  if (parsed.supplierId) query.set('supplierId', parsed.supplierId);
  if (parsed.status) query.set('status', parsed.status);
  if (parsed.from) query.set('from', parsed.from);
  if (parsed.to) query.set('to', parsed.to);
  if (parsed.limit) query.set('limit', String(parsed.limit));
  const suffix = query.toString().length > 0 ? `?${query.toString()}` : '';
  const response = await authorizedFetch(`${API_URL}/api/purchasing/orders${suffix}`);
  return readJson(response, z.array(purchaseOrderSchema));
}

export async function createPurchaseOrder(payload: PurchaseOrderCreateRequest): Promise<PurchaseOrder> {
  const request = purchaseOrderCreateRequestSchema.parse(payload);
  const response = await authorizedFetch(`${API_URL}/api/purchasing/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });
  return readJson(response, purchaseOrderSchema);
}

export async function updatePurchaseOrderStatus(id: string, payload: PurchaseOrderStatusUpdateRequest): Promise<PurchaseOrder> {
  const request = purchaseOrderStatusUpdateRequestSchema.parse(payload);
  const response = await authorizedFetch(`${API_URL}/api/purchasing/orders/${id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });
  return readJson(response, purchaseOrderSchema);
}

export async function createGoodsReceipt(orderId: string, payload: GoodsReceiptCreateRequest): Promise<GoodsReceipt> {
  const request = goodsReceiptCreateRequestSchema.parse(payload);
  const response = await authorizedFetch(`${API_URL}/api/purchasing/orders/${orderId}/receipts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });
  return readJson(response, goodsReceiptSchema);
}

export async function fetchShifts(queryPayload: ShiftsQuery = {}): Promise<Shift[]> {
  const parsed = shiftsQuerySchema.parse(queryPayload);
  const query = new URLSearchParams();
  if (parsed.staffId) query.set('staffId', parsed.staffId);
  if (parsed.from) query.set('from', parsed.from);
  if (parsed.to) query.set('to', parsed.to);
  if (parsed.status) query.set('status', parsed.status);
  if (parsed.limit) query.set('limit', String(parsed.limit));
  const suffix = query.toString().length > 0 ? `?${query.toString()}` : '';
  const response = await authorizedFetch(`${API_URL}/api/shifts${suffix}`);
  return readJson(response, z.array(shiftSchema));
}

export async function createShift(payload: ShiftCreateRequest): Promise<Shift> {
  const request = shiftCreateRequestSchema.parse(payload);
  const response = await authorizedFetch(`${API_URL}/api/shifts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });
  return readJson(response, shiftSchema);
}

export async function updateShift(id: string, payload: ShiftUpdateRequest): Promise<Shift> {
  const request = shiftUpdateRequestSchema.parse(payload);
  const response = await authorizedFetch(`${API_URL}/api/shifts/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });
  return readJson(response, shiftSchema);
}

export async function clockIn(payload: ClockInRequest): Promise<TimeEntry> {
  const request = clockInRequestSchema.parse(payload);
  const response = await authorizedFetch(`${API_URL}/api/timeclock/in`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });
  return readJson(response, timeEntrySchema);
}

export async function clockOut(payload: ClockOutRequest): Promise<TimeEntry> {
  const request = clockOutRequestSchema.parse(payload);
  const response = await authorizedFetch(`${API_URL}/api/timeclock/out`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });
  return readJson(response, timeEntrySchema);
}

export async function fetchTimeReport(queryPayload: TimeReportQuery): Promise<TimeReportResponse> {
  const parsed = timeReportQuerySchema.parse(queryPayload);
  const query = new URLSearchParams();
  query.set('from', parsed.from);
  query.set('to', parsed.to);
  if (parsed.staffId) query.set('staffId', parsed.staffId);
  const response = await authorizedFetch(`${API_URL}/api/timeclock/report?${query.toString()}`);
  return readJson(response, timeReportResponseSchema);
}

export async function closeFiscalDay(payload: FiscalCloseRequest): Promise<FiscalClosure> {
  const request = fiscalCloseRequestSchema.parse(payload);
  const response = await authorizedFetch(`${API_URL}/api/fiscal/close-day`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });
  return readJson(response, fiscalClosureSchema);
}

export async function createFiscalExport(payload: FiscalExportCreateRequest): Promise<FiscalExport> {
  const request = fiscalExportCreateRequestSchema.parse(payload);
  const response = await authorizedFetch(`${API_URL}/api/fiscal/exports`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });
  return readJson(response, fiscalExportSchema);
}

export async function fetchFiscalExports(queryPayload: FiscalExportsQuery = {}): Promise<FiscalExport[]> {
  const parsed = fiscalExportsQuerySchema.parse(queryPayload);
  const query = new URLSearchParams();
  if (parsed.from) query.set('from', parsed.from);
  if (parsed.to) query.set('to', parsed.to);
  if (parsed.status) query.set('status', parsed.status);
  if (parsed.limit) query.set('limit', String(parsed.limit));
  const suffix = query.toString().length > 0 ? `?${query.toString()}` : '';
  const response = await authorizedFetch(`${API_URL}/api/fiscal/exports${suffix}`);
  return readJson(response, z.array(fiscalExportSchema));
}

export async function downloadFiscalExportCsv(id: string): Promise<string> {
  const response = await authorizedFetch(`${API_URL}/api/fiscal/exports/${id}/download`);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.text();
}

export async function fetchAdminStaff(): Promise<StaffAdmin[]> {
  const response = await authorizedFetch(`${API_URL}/api/staff`);
  return readJson(response, staffAdminListResponseSchema);
}

export async function createAdminStaff(payload: StaffCreateRequest): Promise<StaffAdmin> {
  const request = staffCreateRequestSchema.parse(payload);
  const response = await authorizedFetch(`${API_URL}/api/staff`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  return readJson(response, staffAdminSchema);
}

export async function updateAdminStaff(id: string, payload: StaffUpdateRequest): Promise<StaffAdmin> {
  const request = staffUpdateRequestSchema.parse(payload);
  const response = await authorizedFetch(`${API_URL}/api/staff/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  return readJson(response, staffAdminSchema);
}

export async function resetAdminStaffPin(id: string, payload: StaffResetPinRequest): Promise<LogoutResponse> {
  const request = staffResetPinRequestSchema.parse(payload);
  const response = await authorizedFetch(`${API_URL}/api/staff/${id}/reset-pin`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  return readJson(response, logoutResponseSchema);
}

export async function setAdminStaffActiveState(id: string, active: boolean): Promise<LogoutResponse> {
  const endpoint = active ? 'enable' : 'disable';
  const response = await authorizedFetch(`${API_URL}/api/staff/${id}/${endpoint}`, {
    method: 'POST',
  });

  return readJson(response, logoutResponseSchema);
}

export async function fetchMenuItemsAdmin(): Promise<MenuItemAdmin[]> {
  const response = await authorizedFetch(`${API_URL}/api/menu`);
  return readJson(response, menuItemAdminListResponseSchema);
}

export async function fetchSimpleCatalogItemsAdmin(): Promise<MenuItemAdmin[]> {
  const response = await authorizedFetch(`${API_URL}/api/simple-catalog/items`);
  return readJson(response, menuItemAdminListResponseSchema);
}

export async function createMenuItem(payload: MenuItemCreateRequest): Promise<MenuItemAdmin> {
  const request = menuItemCreateRequestSchema.parse(payload);
  const response = await authorizedFetch(`${API_URL}/api/menu`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  return readJson(response, menuItemAdminSchema);
}

export async function createSimpleCatalogItem(payload: Omit<MenuItemCreateRequest, 'recipe'> & { recipe?: unknown }): Promise<MenuItemAdmin> {
  const request = menuItemCreateRequestSchema
    .omit({ recipe: true })
    .extend({ recipe: menuItemCreateRequestSchema.shape.recipe.optional() })
    .parse(payload);
  const response = await authorizedFetch(`${API_URL}/api/simple-catalog/items`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  return readJson(response, menuItemAdminSchema);
}

export async function updateMenuItem(id: string, payload: MenuItemUpdateRequest): Promise<MenuItemAdmin> {
  const request = menuItemUpdateRequestSchema.parse(payload);
  const response = await authorizedFetch(`${API_URL}/api/menu/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  return readJson(response, menuItemAdminSchema);
}

export async function updateSimpleCatalogItem(id: string, payload: MenuItemUpdateRequest): Promise<MenuItemAdmin> {
  const request = menuItemUpdateRequestSchema.parse(payload);
  const response = await authorizedFetch(`${API_URL}/api/simple-catalog/items/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  return readJson(response, menuItemAdminSchema);
}

export async function replaceMenuItemRecipe(
  id: string,
  payload: MenuItemReplaceRecipeRequest,
): Promise<MenuItemAdmin> {
  const request = menuItemReplaceRecipeRequestSchema.parse(payload);
  const response = await authorizedFetch(`${API_URL}/api/menu/${id}/recipe`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  return readJson(response, menuItemAdminSchema);
}

export async function addMenuItemRecipeComponent(
  id: string,
  payload: { componentType: 'ingredient' | 'bom' | 'prep'; componentId: string; quantity: number; unit: string },
): Promise<MenuItemAdmin> {
  const response = await authorizedFetch(`${API_URL}/api/menu/${id}/recipe/add`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  return readJson(response, menuItemAdminSchema);
}

export async function removeMenuItemRecipeComponent(
  id: string,
  payload: { componentType: 'ingredient' | 'bom' | 'prep'; componentId: string },
): Promise<MenuItemAdmin> {
  const response = await authorizedFetch(`${API_URL}/api/menu/${id}/recipe/remove`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  return readJson(response, menuItemAdminSchema);
}

export async function updateMenuItemContainer(
  menuItemId: string,
  defaultContainerId: string | null,
): Promise<void> {
  await authorizedFetch(`${API_URL}/api/menu/${menuItemId}/container`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ defaultContainerId }),
  });
}

export async function setMenuItemActiveState(id: string, active: boolean): Promise<LogoutResponse> {
  const endpoint = active ? 'enable' : 'disable';
  const response = await authorizedFetch(`${API_URL}/api/menu/${id}/${endpoint}`, {
    method: 'POST',
  });

  return readJson(response, logoutResponseSchema);
}

export async function deleteMenuItem(id: string): Promise<LogoutResponse> {
  const response = await authorizedFetch(`${API_URL}/api/menu/${id}`, {
    method: 'DELETE',
  });

  return readJson(response, logoutResponseSchema);
}

export async function setSimpleCatalogItemActiveState(id: string, active: boolean): Promise<LogoutResponse> {
  const endpoint = active ? 'enable' : 'disable';
  const response = await authorizedFetch(`${API_URL}/api/simple-catalog/items/${id}/${endpoint}`, {
    method: 'POST',
  });

  return readJson(response, logoutResponseSchema);
}

export async function rotateSelfOrderQrSession(tableId: string): Promise<SelfOrderSessionRotateResponse> {
  const response = await authorizedFetch(`${API_URL}/api/self-order/tables/${tableId}/qr/rotate`, {
    method: 'POST',
  });

  return readJson(response, selfOrderSessionRotateResponseSchema);
}

export async function resolvePublicSelfOrderSession(tenantSlug: string, token: string): Promise<SelfOrderResolveResponse> {
  const response = await fetch(
    `${API_URL}/api/public/${encodeURIComponent(tenantSlug)}/self-order/session?token=${encodeURIComponent(token)}`,
  );

  return readJson(response, selfOrderResolveResponseSchema);
}

export async function createPublicSelfOrder(tenantSlug: string, payload: SelfOrderCreateRequest): Promise<SelfOrderCreateResponse> {
  const request = selfOrderCreateRequestSchema.parse(payload);
  const response = await fetch(`${API_URL}/api/public/${encodeURIComponent(tenantSlug)}/self-order/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...consumerAuthHeaders(tenantSlug),
    },
    body: JSON.stringify(request),
  });

  return readJson(response, selfOrderCreateResponseSchema);
}

export async function createPublicTakeawayOrder(
  tenantSlug: string,
  payload: PublicTakeawayCreateRequest,
  idempotencyKey?: string,
): Promise<PublicTakeawayCreateResponse> {
  const request = publicTakeawayCreateRequestSchema.parse(payload);
  const response = await fetch(`${API_URL}/api/public/${encodeURIComponent(tenantSlug)}/takeaway/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...consumerAuthHeaders(tenantSlug),
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    },
    body: JSON.stringify(request),
  });

  return readJson(response, publicTakeawayCreateResponseSchema);
}

export async function getPublicTakeawayTracking(
  tenantSlug: string,
  orderId: string,
  trackingToken: string,
): Promise<PublicTakeawayTrackingResponse> {
  const response = await fetch(
    `${API_URL}/api/public/${encodeURIComponent(tenantSlug)}/takeaway/orders/${encodeURIComponent(orderId)}/track?token=${encodeURIComponent(trackingToken)}`,
  );

  return readJson(response, publicTakeawayTrackingResponseSchema);
}

export async function trackPublicFunnelEvent(
  tenantSlug: string,
  payload: PublicFunnelEventRequest,
): Promise<PublicFunnelEventResponse> {
  const request = publicFunnelEventRequestSchema.parse(payload);
  const response = await fetch(`${API_URL}/api/public/${encodeURIComponent(tenantSlug)}/funnel/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  return readJson(response, publicFunnelEventResponseSchema);
}

export async function createPublicGroupOrderSession(
  tenantSlug: string,
  payload: GroupOrderCreateSessionRequest,
): Promise<GroupOrderCreateSessionResponse> {
  const request = groupOrderCreateSessionRequestSchema.parse(payload);
  const response = await fetch(`${API_URL}/api/public/${encodeURIComponent(tenantSlug)}/group-orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  return readJson(response, groupOrderCreateSessionResponseSchema);
}

export async function joinPublicGroupOrderSession(
  tenantSlug: string,
  joinCode: string,
  payload: GroupOrderJoinSessionRequest,
): Promise<GroupOrderJoinSessionResponse> {
  const request = groupOrderJoinSessionRequestSchema.parse(payload);
  const response = await fetch(`${API_URL}/api/public/${encodeURIComponent(tenantSlug)}/group-orders/${encodeURIComponent(joinCode)}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  return readJson(response, groupOrderJoinSessionResponseSchema);
}

export async function patchPublicGroupOrderCart(
  tenantSlug: string,
  sessionId: string,
  sessionCode: string,
  participantToken: string,
  payload: GroupOrderPatchCartRequest,
): Promise<GroupOrderPatchCartResponse> {
  const request = groupOrderPatchCartRequestSchema.parse(payload);
  const response = await fetch(`${API_URL}/api/public/${encodeURIComponent(tenantSlug)}/group-orders/${encodeURIComponent(sessionId)}/cart`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'X-Group-Order-Code': sessionCode,
      'X-Group-Order-Token': participantToken,
    },
    body: JSON.stringify(request),
  });
  return readJson(response, groupOrderPatchCartResponseSchema);
}

export async function submitPublicGroupOrder(
  tenantSlug: string,
  sessionId: string,
  sessionCode: string,
  participantToken: string,
  payload: GroupOrderSubmitRequest,
): Promise<GroupOrderSubmitResponse> {
  const request = groupOrderSubmitRequestSchema.parse(payload);
  const response = await fetch(`${API_URL}/api/public/${encodeURIComponent(tenantSlug)}/group-orders/${encodeURIComponent(sessionId)}/submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Group-Order-Code': sessionCode,
      'X-Group-Order-Token': participantToken,
    },
    body: JSON.stringify(request),
  });
  return readJson(response, groupOrderSubmitResponseSchema);
}

export async function registerConsumer(tenantSlug: string, payload: ConsumerRegisterRequest): Promise<ConsumerAuthResponse> {
  const request = consumerRegisterRequestSchema.parse(payload);
  const response = await fetch(`${API_URL}/api/public/${encodeURIComponent(tenantSlug)}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  const auth = await readJson(response, consumerAuthResponseSchema);
  persistConsumerSession(tenantSlug, auth);
  return auth;
}

export async function loginConsumer(tenantSlug: string, payload: ConsumerLoginRequest): Promise<ConsumerAuthResponse> {
  const request = consumerLoginRequestSchema.parse(payload);
  const response = await fetch(`${API_URL}/api/public/${encodeURIComponent(tenantSlug)}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  const auth = await readJson(response, consumerAuthResponseSchema);
  persistConsumerSession(tenantSlug, auth);
  return auth;
}

export async function refreshConsumerSession(tenantSlug: string): Promise<boolean> {
  const refreshToken = getConsumerRefreshToken(tenantSlug);
  if (!refreshToken) {
    clearConsumerSession(tenantSlug);
    return false;
  }

  const request = consumerRefreshRequestSchema.parse({ refreshToken } as ConsumerRefreshRequest);
  const response = await fetch(`${API_URL}/api/public/${encodeURIComponent(tenantSlug)}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    clearConsumerSession(tenantSlug);
    return false;
  }

  const auth = await readJson(response, consumerAuthResponseSchema);
  persistConsumerSession(tenantSlug, auth);
  return true;
}

export async function logoutConsumer(tenantSlug: string): Promise<void> {
  await fetch(`${API_URL}/api/public/${encodeURIComponent(tenantSlug)}/auth/logout`, {
    method: 'POST',
    headers: {
      ...consumerAuthHeaders(tenantSlug),
    },
  });
  clearConsumerSession(tenantSlug);
}

export async function fetchConsumerMe(tenantSlug: string, retried = false): Promise<ConsumerUser> {
  const response = await fetch(`${API_URL}/api/public/${encodeURIComponent(tenantSlug)}/auth/me`, {
    headers: {
      ...consumerAuthHeaders(tenantSlug),
    },
  });

  if (response.status === 401) {
    if (retried) {
      throw new Error('Consumer session expired');
    }
    const refreshed = await refreshConsumerSession(tenantSlug);
    if (!refreshed) {
      throw new Error('Consumer session expired');
    }
    return fetchConsumerMe(tenantSlug, true);
  }

  return readJson(response, consumerUserSchema);
}

export async function fetchConsumerOrders(tenantSlug: string, retried = false): Promise<ConsumerOrderHistoryResponse> {
  const response = await fetch(`${API_URL}/api/public/${encodeURIComponent(tenantSlug)}/auth/orders`, {
    headers: {
      ...consumerAuthHeaders(tenantSlug),
    },
  });

  if (response.status === 401) {
    if (retried) {
      throw new Error('Consumer session expired');
    }
    const refreshed = await refreshConsumerSession(tenantSlug);
    if (!refreshed) {
      throw new Error('Consumer session expired');
    }
    return fetchConsumerOrders(tenantSlug, true);
  }

  return readJson(response, consumerOrderHistoryResponseSchema);
}

export async function fetchLoyaltyBalance(customerId: string): Promise<LoyaltyBalance> {
  const response = await authorizedFetch(`${API_URL}/api/loyalty/${encodeURIComponent(customerId)}`);
  return readJson(response, loyaltyBalanceSchema);
}

export async function earnLoyaltyPoints(customerId: string, points: number, orderId?: string, notes?: string): Promise<LoyaltyTransaction> {
  const response = await authorizedFetch(`${API_URL}/api/loyalty/earn`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ customerId, points, orderId, notes }),
  });
  return readJson(response, loyaltyTransactionSchema);
}

export async function redeemLoyaltyPoints(customerId: string, points: number, orderId?: string): Promise<LoyaltyTransaction> {
  const response = await authorizedFetch(`${API_URL}/api/loyalty/redeem`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ customerId, points, orderId }),
  });
  return readJson(response, loyaltyTransactionSchema);
}

export async function fetchLoyaltyTransactions(customerId: string, limit?: number): Promise<LoyaltyTransaction[]> {
  const query = new URLSearchParams();
  if (limit) query.set('limit', String(limit));
  const suffix = query.toString().length > 0 ? `?${query.toString()}` : '';
  const response = await authorizedFetch(`${API_URL}/api/loyalty/${encodeURIComponent(customerId)}/transactions${suffix}`);
  return readJson(response, loyaltyTransactionsListSchema);
}

// ─── Food Cost Matrix ─────────────────────────────────────────────────

export interface FoodCostMatrixResponse {
  rows: Array<{
    menuItemId: string;
    menuItemName: string;
    category: string;
    ingredientId: string;
    ingredientName: string;
    quantity: number;
    unit: string;
    ingredientCost: number;
    totalCost: number;
    menuItemPrice: number;
    margin: number;
    marginPercent: number;
    recommendedPrice: number;
    status: 'ok' | 'needs_change';
  }>;
  summary: Array<{
    menuItemId: string;
    menuItemName: string;
    category: string;
    totalCost: number;
    currentPrice: number;
    recommendedPrice: number;
    margin: number;
    marginPercent: number;
    status: 'ok' | 'needs_change';
    ingredientCount: number;
  }>;
}

export async function fetchFoodCostMatrix(): Promise<FoodCostMatrixResponse> {
  const response = await authorizedFetch(`${API_URL}/api/food-cost-matrix`);
  return readJson(response, { parse: (x: unknown) => x as FoodCostMatrixResponse });
}

export async function updateFoodCostMatrixCell(
  menuItemId: string,
  ingredientId: string,
  quantity: number,
  unit: string,
): Promise<void> {
  const response = await authorizedFetch(`${API_URL}/api/food-cost-matrix/cell`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ menuItemId, ingredientId, quantity, unit }),
  });
  await readJson(response, { parse: (x: unknown) => x as { success: boolean } });
}

export async function importFoodCostMatrix(
  rows: Array<{ ingredientName: string; menuItemName: string; quantity: number; unit: string }>,
): Promise<{ imported: number; skipped: number; errors: string[] }> {
  const response = await authorizedFetch(`${API_URL}/api/food-cost-matrix/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows }),
  });
  return readJson(response, { parse: (x: unknown) => x as { imported: number; skipped: number; errors: string[] } });
}

export async function importFoodCostFull(
  ingredientCosts: Array<{ name: string; costPerKg: number; costPerPiece: number; gramsPerPortion: number; piecesPerPortion: number }>,
  recipeRows: Array<{ ingredientName: string; menuItemName: string; quantity: number; unit: string }>,
): Promise<{ costsUpdated: number; recipesImported: number; recipesSkipped: number; errors: string[] }> {
  const response = await authorizedFetch(`${API_URL}/api/food-cost-matrix/import-full`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ingredientCosts, recipeRows }),
  });
  return readJson(response, { parse: (x: unknown) => x as { costsUpdated: number; recipesImported: number; recipesSkipped: number; errors: string[] } });
}

export async function importFoodCostXlsx(
  xlsxBase64: string,
): Promise<{
  costsUpdated: number;
  costsSkipped: number;
  recipesImported: number;
  recipesSkipped: number;
  costMatches: Array<{ xlsxName: string; matchedTo: string; unitCost: number }>;
  recipeMatches: Array<{ ingredient: string; menuItem: string; qty: number }>;
  errors: string[];
}> {
  const response = await authorizedFetch(`${API_URL}/api/food-cost-matrix/import-xlsx`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ xlsxBase64 }),
  });
  return readJson(response, {
    parse: (x: unknown) => x as {
      costsUpdated: number;
      costsSkipped: number;
      recipesImported: number;
      recipesSkipped: number;
      costMatches: Array<{ xlsxName: string; matchedTo: string; unitCost: number }>;
      recipeMatches: Array<{ ingredient: string; menuItem: string; qty: number }>;
      errors: string[];
    },
  });
}

// ─── Prep items (Phase E) ───────────────────────────────────────────────────
export async function fetchPrepItems(): Promise<PrepItem[]> {
  const response = await authorizedFetch(`${API_URL}/api/prep-items`);
  const data = await response.json();
  return Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : []);
}
export async function createPrepItem(payload: { ingredientId: string; name: string; quantityPerUnit: number; unit: string }): Promise<PrepItem> {
  const response = await authorizedFetch(`${API_URL}/api/prep-items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return response.json();
}
export async function updatePrepItem(id: string, payload: PrepItemUpdateRequest): Promise<PrepItem> {
  const response = await authorizedFetch(`${API_URL}/api/prep-items/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return response.json();
}
export async function deletePrepItem(id: string): Promise<void> {
  await authorizedFetch(`${API_URL}/api/prep-items/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
export async function preparePrepItem(id: string, quantity: number): Promise<PreparePrepItemResponse> {
  const response = await authorizedFetch(`${API_URL}/api/prep-items/${encodeURIComponent(id)}/prepare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quantity }),
  });
  return response.json();
}
export async function fetchUnitConversions(inventoryId: string): Promise<UnitConversion[]> {
  const response = await authorizedFetch(`${API_URL}/api/inventory/${encodeURIComponent(inventoryId)}/conversions`);
  const data = await response.json();
  return Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : []);
}
export async function createUnitConversion(inventoryId: string, payload: UnitConversionCreateRequest): Promise<UnitConversion> {
  const response = await authorizedFetch(`${API_URL}/api/inventory/${encodeURIComponent(inventoryId)}/conversions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return response.json();
}
export async function failPrintJob(id: string, errorMsg?: string): Promise<PrintJob> {
  const response = await authorizedFetch(`${API_URL}/api/print-jobs/${encodeURIComponent(id)}/fail`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: errorMsg ?? 'failed' }),
  });
  return response.json();
}

// ─── Print-bridge pool (Phase E) ────────────────────────────────────────────────────
import type {
  LocalBridgeConfig,
  PrintBridge,
  PrintBridgeHeartbeatRequest,
  PrintBridgeHeartbeatResponse,
  PrintBridgeClaimRequest,
  PrintBridgeClaimResponse,
  PrintBridgeJobCompleteRequest,
  PrintBridgeJobCompleteResponse,
  PrintBridgeJobFailRequest,
  PrintBridgeJobFailResponse,
  PrintBridgeOnboardingSecret,
  PrintBridgeOnboardingSecretCreateCode6DigitResponse,
  PrintBridgeOnboardingSecretCreateRequest,
  PrintBridgeOnboardingSecretCreateResponse,
  PrintBridgeOnboardingSecretsListResponse,
  PrintBridgePrintBridgesListResponse,
  PrintBridgeUpdateMappingsRequest,
  PrintBridgeUpdateClaimedAreasRequest,
  PrintBridgeTestPrintRequest,
  PrintBridgeTestPrintResponse,
  PrintArea,
} from '@gustopos/shared';

type PrintBridgeHeartbeatResponseType = PrintBridgeHeartbeatResponse;
type PrintAreaType = PrintArea;

export async function listPrintBridgesRequest(): Promise<PrintBridge[]> {
  const res = await authedJson<PrintBridgePrintBridgesListResponse>('/api/print-bridge', { method: 'GET' });
  return ((res as PrintBridge[] | { bridges?: PrintBridge[] } | undefined) as { bridges?: PrintBridge[] } | undefined)?.bridges ?? (res as PrintBridge[] | undefined) ?? [];
// CASCADE_CLIENT_LIST_BRIDGES_BODY_DONE
}

export async function updateBridgeMappingsRequest(
  bridgeId: string,
  mappings: PrintBridgeUpdateMappingsRequest['mappings'],
): Promise<PrintBridge> {
  const res = await authedJson<{ bridge: PrintBridge }>(
    `/api/print-bridge/${encodeURIComponent(bridgeId)}/mappings`,
    { method: 'PATCH', json: { mappings } },
  );
  return res.bridge;
}

export async function updateBridgeClaimedAreasRequest(
  bridgeId: string,
  claimedAreas: PrintBridgeUpdateClaimedAreasRequest['claimedAreas'],
): Promise<PrintBridge> {
  const res = await authedJson<{ bridge: PrintBridge }>(
    `/api/print-bridge/${encodeURIComponent(bridgeId)}/claimed-areas`,
    { method: 'PATCH', json: { claimedAreas } },
  );
  return res.bridge;
}

export async function triggerBridgeTestPrintRequest(
  bridgeId: string,
  area: PrintAreaType,
): Promise<PrintBridgeTestPrintResponse> {
  return authedJson<PrintBridgeTestPrintResponse>(
    `/api/print-bridge/${encodeURIComponent(bridgeId)}/test-print`,
    { method: 'POST', json: { area } },
  );
}

export async function listOnboardingSecretsRequest(): Promise<PrintBridgeOnboardingSecret[]> {
  const res = await authedJson<PrintBridgeOnboardingSecretsListResponse>(
    '/api/print-bridge/onboarding-secret',
    { method: 'GET' },
  );
  return Array.isArray(res?.secrets) ? res.secrets : [];
}

export async function createOnboardingSecretRequest(
  payload?: PrintBridgeOnboardingSecretCreateRequest,
): Promise<PrintBridgeOnboardingSecretCreateResponse> {
  return authedJson<PrintBridgeOnboardingSecretCreateResponse>(
    '/api/print-bridge/onboarding-secret',
    { method: 'POST', json: payload ?? {} },
  );
}

export async function createShortCodePairingRequest(
  payload?: PrintBridgeOnboardingSecretCreateRequest,
): Promise<PrintBridgeOnboardingSecretCreateCode6DigitResponse> {
  return authedJson<PrintBridgeOnboardingSecretCreateCode6DigitResponse>(
    '/api/print-bridge/onboarding-secret',
    {
      method: 'POST',
      json: {
        mode: 'code-6digit',
        ...((payload ?? {}) as Record<string, unknown>),
      },
    },
  );
}

export async function revokeOnboardingSecretRequest(id: string): Promise<{ success: true; id: string }> {
  return authedJson<{ success: true; id: string }>(
    `/api/print-bridge/onboarding-secret/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  );
}

export async function sendBridgeHeartbeatRequest(
  payload: PrintBridgeHeartbeatRequest,
): Promise<PrintBridgeHeartbeatResponseType> {
  return authedJson<PrintBridgeHeartbeatResponseType>('/api/print-bridge/heartbeat', {
    method: 'POST',
    json: payload,
    skipTenant: true,
  });
}

export async function claimBridgeJobsRequest(
  payload: PrintBridgeClaimRequest,
): Promise<PrintBridgeClaimResponse> {
  return authedJson<PrintBridgeClaimResponse>('/api/print-bridge/claim', {
    method: 'POST',
    json: payload,
    skipTenant: true,
  });
}

export async function completeBridgeJobRequest(
  jobId: string,
  payload: PrintBridgeJobCompleteRequest,
): Promise<PrintBridgeJobCompleteResponse | { success: false }> {
  return authedJson<PrintBridgeJobCompleteResponse | { success: false }>(
    `/api/print-bridge/jobs/${encodeURIComponent(jobId)}/complete`,
    { method: 'POST', json: payload, skipTenant: true },
  );
}

export async function failBridgeJobRequest(
  jobId: string,
  payload: PrintBridgeJobFailRequest,
): Promise<PrintBridgeJobFailResponse | { success: false }> {
  return authedJson<PrintBridgeJobFailResponse | { success: false }>(
    `/api/print-bridge/jobs/${encodeURIComponent(jobId)}/fail`,
    { method: 'POST', json: payload, skipTenant: true },
  );
}

export async function fetchRefreshBridge(
  _tenantHeaders?: Record<string, string>,
): Promise<{ success: boolean }> {
  return authedJson<{ success: boolean }>('/api/print-bridge/refresh', { method: 'POST' });
}

export async function saveLocalBridgeConfig(
  config: LocalBridgeConfig | null,
  setToken?: (token: string | null) => void,
  _opts?: { replaceState?: boolean },
): Promise<{ ok: true }> {
  // Persistence is handled by the dedicated localBridgeSlice; this stub returns
  // success so callers can use it as an awaited Promise.
  return { ok: true };
}

export type {
  PrintBridge,
  PrintBridgeHeartbeatRequest,
  PrintBridgeHeartbeatResponse,
  PrintBridgeClaimRequest,
  PrintBridgeClaimResponse,
  PrintBridgeJobCompleteRequest,
  PrintBridgeJobCompleteResponse,
  PrintBridgeJobFailRequest,
  PrintBridgeJobFailResponse,
  PrintBridgeOnboardingSecret,
  PrintBridgeOnboardingSecretCreateRequest,
  PrintBridgeOnboardingSecretCreateResponse,
  PrintBridgePrintBridgesListResponse,
  PrintBridgeOnboardingSecretsListResponse,
  PrintBridgeUpdateMappingsRequest,
  PrintBridgeUpdateClaimedAreasRequest,
  PrintBridgeTestPrintRequest,
  PrintBridgeTestPrintResponse,
} from '@gustopos/shared';


// ─── Bare-name re-exports (Phase E: Pool) ───────────────────────────────────
export {
  listPrintBridgesRequest as listPrintBridges,
  triggerBridgeTestPrintRequest as triggerBridgeTestPrint,
  listOnboardingSecretsRequest as listOnboardingSecrets,
  createOnboardingSecretRequest as createOnboardingSecret,
  revokeOnboardingSecretRequest as revokeOnboardingSecret,
  updateBridgeMappingsRequest as updateBridgeMappings,
  updateBridgeClaimedAreasRequest as updateBridgeClaimedAreas,
};
// CASCADE_CLIENT_PHASE_E_BLOCK_DONE

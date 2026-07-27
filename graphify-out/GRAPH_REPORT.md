# Graph Report - /srv/gustopos  (2026-07-21)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 2071 nodes · 6362 edges · 100 communities (77 shown, 23 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 9 edges (avg confidence: 0.77)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `c37e53f3`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Core App Controller
- TypeScript Data Schemas
- API Client Utilities
- Repository & Utilities
- Request Validation Schemas
- Auth Hashing & Schema
- Superadmin Tenant Management
- App Repository Methods
- App State & UI Theme
- Tables CRUD Controller
- Checkout & Payment Views
- Consumer Auth Controller
- Order Status & Consumer UI
- Frontend Dependencies
- Staff Auth Controller
- BOM & Category UI Tabs
- App Module & Database Setup
- Main App Routing Views
- Inventory & Category Editors
- Staff Management Controller
- Audit Logging & Auth Guards
- Superadmin Auth Controller
- Product Recipe Builder
- BOM CRUD Controller
- Node.js Dev Dependencies
- Web TypeScript Configuration
- Realtime WebSocket Gateway
- Backoffice Route Guards
- Print Bridge Dependencies
- API TypeScript Configuration
- Fiscal & Status Views
- Modifier Editor Components
- JWT Auth Middleware
- Transactional Repository Methods
- Print & Settings Service
- Staff
- Shared Package Configuration
- Public Menu API
- Backoffice Shell & PWA
- Backoffice Data Fetching
- Shared TypeScript Config
- API Server Dependencies
- ESC/POS Receipt Builder
- Dashboard Analytics View
- Print Bridge Server
- Impersonation & Logging
- Kitchen Display View
- Public Group Ordering
- Redis & Idempotency
- Print Bridge TS Config
- Order Processing Service
- Delivery Status View
- Unit Conversion Utilities
- Print Bridge QZ Tray
- Web QZ Tray Client
- App Router & Error Handling
- Food Cost Matrix UI
- Superadmin Session Management
- Staff Auth Session
- Table Checkout Payments
- Build & Migration Scripts
- API Dev Dependencies
- Public Reservation Page
- Consumer JWT Auth Guard
- POS Tables View
- Customer Detail Page
- ModuleKey
- API Package Configuration
- Customer CRUD Service
- Build TypeScript Config
- Server Test Utilities
- Purchase Order Service
- Food Cost Analysis UI
- Simple Catalog Routing
- Vite Build Configuration
- Dependency Graph Plugin
- Security Headers Middleware
- Environment Variables
- Redis Client Library
- JWT Token Library
- NestJS Common Module
- NestJS Core Module
- NestJS Express Platform
- NestJS Socket.IO Platform
- NestJS Rate Throttler
- NestJS WebSockets Module
- Decorator Metadata Reflection
- Dependency Injection Decorators
- Public Funnel Tracking

## God Nodes (most connected - your core abstractions)
1. `AppRepository` - 194 edges
2. `AppController` - 119 edges
3. `readJson()` - 119 edges
4. `getTenantIdOrDefault()` - 118 edges
5. `RequiresModule()` - 117 edges
6. `authorizedFetch()` - 115 edges
7. `Roles()` - 108 edges
8. `AppState` - 95 edges
9. `cn()` - 52 edges
10. `Ingredient` - 43 edges

## Surprising Connections (you probably didn't know these)
- `TenantContext` --references--> `ModuleKey`  [EXTRACTED]
  apps/api/src/tenant/tenant-context.ts → packages/shared/src/contracts.ts
- `UseBackofficeSessionLifecycleParams` --references--> `Staff`  [EXTRACTED]
  apps/web/src/app/backoffice/hooks/useBackofficeSessionLifecycle.ts → packages/shared/src/contracts.ts
- `UseOperationalSummariesParams` --references--> `ModuleKey`  [EXTRACTED]
  apps/web/src/app/backoffice/hooks/useOperationalSummaries.ts → packages/shared/src/contracts.ts
- `BackofficeRouteMeta` --references--> `ModuleKey`  [EXTRACTED]
  apps/web/src/app/backoffice/route-guards.ts → packages/shared/src/contracts.ts
- `DashboardViewProps` --references--> `AppData`  [EXTRACTED]
  apps/web/src/components/DashboardView.tsx → packages/shared/src/contracts.ts

## Import Cycles
- None detected.

## Communities (100 total, 23 thin omitted)

### Community 0 - "Core App Controller"
Cohesion: 0.07
Nodes (21): AppController, Body, Controller, Delete, Get, Param, Patch, Post (+13 more)

### Community 1 - "TypeScript Data Schemas"
Cohesion: 0.02
Nodes (113): BomComponent, bomComponentSchema, BomComponentType, bomComponentTypeSchema, BomListResponse, bomListResponseSchema, cartItemSchema, CategoriesListResponse (+105 more)

### Community 2 - "API Client Utilities"
Cohesion: 0.05
Nodes (105): InventoryRoute(), PublicTakeawayTrackingPage(), addBomComponent(), addMenuItemRecipeComponent(), adjustIngredient(), authHeaders(), authorizedFetch(), bulkCreateTables() (+97 more)

### Community 3 - "Repository & Utilities"
Cohesion: 0.02
Nodes (100): ACCENT_MAP, BomComponentRow, BomRow, channelToLinear(), contrastRatio(), deliveryTransitions, escPosEncode(), InventoryRow (+92 more)

### Community 4 - "Request Validation Schemas"
Cohesion: 0.02
Nodes (89): categoryCreateRequestSchema, categoryModifierPoolCreateRequestSchema, categoryModifierPoolUpdateRequestSchema, categoryUpdateRequestSchema, clockInRequestSchema, clockOutRequestSchema, closeTableRequestSchema, CouponCreateRequest (+81 more)

### Community 5 - "Auth Hashing & Schema"
Cohesion: 0.04
Nodes (64): hashPin(), isHashedPin(), SCRYPT_PARAMS, scryptAsync(), verifyPin(), appSettings, authSessions, bomComponents (+56 more)

### Community 6 - "Superadmin Tenant Management"
Cohesion: 0.06
Nodes (33): tenantModuleConfigs, SuperadminController, SuperadminRequest, Body, Controller, Get, Param, Patch (+25 more)

### Community 7 - "App Repository Methods"
Cohesion: 0.07
Nodes (9): AppRepository, Injectable, getTenantIdOrDefault(), FiscalExport, LoyaltyTransaction, OperationalSummaryQuery, PrintJob, Shift (+1 more)

### Community 8 - "App State & UI Theme"
Cohesion: 0.06
Nodes (53): applyUiTheme(), themeVariableMap, AppState, areSameModules(), areSamePermissions(), areSameUsers(), attachSocketListeners(), hasModuleEnabled() (+45 more)

### Community 9 - "Tables CRUD Controller"
Cohesion: 0.07
Nodes (45): TablesController, Body, Controller, Delete, Get, Inject, Param, Patch (+37 more)

### Community 10 - "Checkout & Payment Views"
Cohesion: 0.08
Nodes (41): react, CheckoutMainView(), CheckoutModal(), CloseTableView(), PayItemsView(), SplitBillView(), DashboardView(), ToggleRow() (+33 more)

### Community 11 - "Consumer Auth Controller"
Cohesion: 0.09
Nodes (25): consumerUsers, ConsumerAuthController, Body, Controller, Get, Param, Post, Req (+17 more)

### Community 12 - "Order Status & Consumer UI"
Cohesion: 0.08
Nodes (40): assertOrderStatusTransition(), canTransitionOrderStatus(), TRANSITIONS, AuthMode, ConsumerAuthPage(), ConsumerOrdersPage(), formatDateTime(), STATUS_COLOR (+32 more)

### Community 13 - "Frontend Dependencies"
Cohesion: 0.04
Nodes (45): dependencies, clsx, date-fns, @gustopos/shared, lucide-react, motion, react-dom, react-router-dom (+37 more)

### Community 14 - "Staff Auth Controller"
Cohesion: 0.08
Nodes (26): AuthController, Body, Controller, Get, Inject, Post, Req, Throttle (+18 more)

### Community 15 - "BOM & Category UI Tabs"
Cohesion: 0.10
Nodes (24): BomTab(), BomTabProps, componentTypeLabel(), CategoriesTabProps, CategoryComboboxProps, IngredientsTab(), IngredientsTabProps, InlineCategoryPicker() (+16 more)

### Community 16 - "App Module & Database Setup"
Cohesion: 0.08
Nodes (22): AppModule, Module, AuthModule, Module, parseCorsOrigins(), db, DbClient, pool (+14 more)

### Community 17 - "Main App Routing Views"
Cohesion: 0.10
Nodes (30): App(), useBackofficeContext(), DashboardRoute(), DashboardView, DeliveryRoute(), DeliveryView, FiscalExportsView, FiscalRoute() (+22 more)

### Community 18 - "Inventory & Category Editors"
Cohesion: 0.17
Nodes (26): CategoryPoolEditorProps, CustomerPreviewProps, InventoryTabKey, InventoryTabsProps, SIMPLE_TABS, TabKey, TABS, MenuItemsTabProps (+18 more)

### Community 19 - "Staff Management Controller"
Cohesion: 0.11
Nodes (18): StaffController, Body, Controller, Get, Inject, Param, Patch, Post (+10 more)

### Community 20 - "Audit Logging & Auth Guards"
Cohesion: 0.14
Nodes (14): AuditEvent, AuditLogService, AuditPayload, Injectable, JwtAuthGuard, Inject, Injectable, PermissionsGuard (+6 more)

### Community 21 - "Superadmin Auth Controller"
Cohesion: 0.13
Nodes (14): SuperadminAuthController, SuperadminRequest, Body, Controller, Get, Post, Req, Throttle (+6 more)

### Community 22 - "Product Recipe Builder"
Cohesion: 0.09
Nodes (17): ComponentCandidate, ComponentPickerProps, ProductComposerProps, RecipeCandidate, RecipeCandidate, RecipeBuilderProps, BomItem, Ingredient (+9 more)

### Community 23 - "BOM CRUD Controller"
Cohesion: 0.16
Nodes (12): BomController, Body, Controller, Delete, Get, Param, Patch, Post (+4 more)

### Community 24 - "Node.js Dev Dependencies"
Cohesion: 0.08
Nodes (23): concurrently, devDependencies, concurrently, tsx, @types/express, @types/node, typescript, name (+15 more)

### Community 25 - "Web TypeScript Configuration"
Cohesion: 0.09
Nodes (21): compilerOptions, allowImportingTsExtensions, allowJs, experimentalDecorators, isolatedModules, jsx, lib, module (+13 more)

### Community 26 - "Realtime WebSocket Gateway"
Cohesion: 0.12
Nodes (12): Inject, canReceiveEvent(), RealtimeGateway, Inject, Injectable, RealtimePubSubService, Injectable, ConnectedSocket (+4 more)

### Community 27 - "Backoffice Route Guards"
Cohesion: 0.28
Nodes (17): BackofficeEntry(), BackofficeRouteGuard(), BackofficeRouteGuardProps, useOperationalSummaries(), BACKOFFICE_ROUTES, BackofficeRouteKey, canAccessRoute(), getAccessibleRoutes() (+9 more)

### Community 28 - "Print Bridge Dependencies"
Cohesion: 0.11
Nodes (18): dependencies, express, devDependencies, supertest, @types/supertest, name, private, scripts (+10 more)

### Community 29 - "API TypeScript Configuration"
Cohesion: 0.11
Nodes (17): compilerOptions, emitDecoratorMetadata, esModuleInterop, experimentalDecorators, forceConsistentCasingInFileNames, module, moduleResolution, outDir (+9 more)

### Community 30 - "Fiscal & Status Views"
Cohesion: 0.18
Nodes (14): ConfirmDialog(), ConfirmDialogProps, escapeHtml(), FiscalExportsView(), PaymentsView(), PurchasingView(), statusOrder, ShiftsView() (+6 more)

### Community 31 - "Modifier Editor Components"
Cohesion: 0.20
Nodes (13): ModifierEditor(), ModifierEditorProps, createGroup(), createOption(), ModifierGroupsEditor(), ModifierGroupsEditorProps, ModifierToggleList(), ModifierToggleListProps (+5 more)

### Community 32 - "JWT Auth Middleware"
Cohesion: 0.27
Nodes (7): getJwtSecret(), JwtPayload, EVENT_MODULE_MAP, ResolvedIdentity, getTenantContext(), tenantContextStorage, TenantContext

### Community 34 - "Print & Settings Service"
Cohesion: 0.23
Nodes (3): parsePrintAreas(), UiSettings, UpdateUiSettingsRequest

### Community 35 - "Staff"
Cohesion: 0.19
Nodes (11): BackofficeContext, BackofficeContextValue, DeliverySummaryState, ReservationsSummaryState, useBackofficeSessionLifecycle(), UseBackofficeSessionLifecycleParams, UseOperationalSummariesParams, LoginView() (+3 more)

### Community 36 - "Shared Package Configuration"
Cohesion: 0.13
Nodes (14): dependencies, zod, devDependencies, exports, main, name, private, scripts (+6 more)

### Community 37 - "Public Menu API"
Cohesion: 0.22
Nodes (8): PublicMenuController, Controller, Get, Param, Query, Req, Res, UseGuards

### Community 39 - "Backoffice Shell & PWA"
Cohesion: 0.21
Nodes (10): BackofficeShellProps, ICONS, BackofficeRouteMeta, BeforeInstallPromptEvent, PwaInstallPrompt(), ToastHost(), ToastItem, subscribeToasts() (+2 more)

### Community 40 - "Backoffice Data Fetching"
Cohesion: 0.14
Nodes (14): fetchAdminStaff(), fetchBomItems(), fetchCategories(), fetchCustomerAnalytics(), fetchCustomers(), fetchInventory(), fetchMenuItemsAdmin(), fetchOrderHistory() (+6 more)

### Community 41 - "Shared TypeScript Config"
Cohesion: 0.14
Nodes (13): compilerOptions, declaration, declarationMap, module, moduleResolution, outDir, rootDir, skipLibCheck (+5 more)

### Community 42 - "API Server Dependencies"
Cohesion: 0.15
Nodes (13): dependencies, drizzle-orm, @gustopos/shared, pg, rxjs, socket.io, xlsx, @gustopos/shared (+5 more)

### Community 44 - "Dashboard Analytics View"
Cohesion: 0.26
Nodes (8): DashboardViewProps, Customer, CustomerAnalytics, CustomerAnalyticsRequest, DeliverySummary, OrderHistoryFilters, ReservationsSummary, VoidOrderResponse

### Community 45 - "Print Bridge Server"
Cohesion: 0.17
Nodes (7): app, FALLBACK_SPOOL_DIR, port, printBridgeSecret, PrintRequest, spoolDir, { app }

### Community 46 - "Impersonation & Logging"
Cohesion: 0.23
Nodes (10): useImpersonationExit(), UseImpersonationExitParams, formatTimestamp(), log(), LogContext, logger, LogLevel, clearImpersonationSnapshot() (+2 more)

### Community 47 - "Kitchen Display View"
Cohesion: 0.23
Nodes (11): getNextStatus(), getOrderAgeClass(), getOrderAgeMinutes(), getStatusMeta(), KitchenStatusFilter, KitchenView(), KitchenViewProps, ContextToolbar() (+3 more)

### Community 48 - "Public Group Ordering"
Cohesion: 0.22
Nodes (11): keyFor(), LocalIdentity, PublicGroupOrderPage(), createPublicGroupOrderSession(), joinPublicGroupOrderSession(), patchPublicGroupOrderCart(), submitPublicGroupOrder(), GroupOrderSession (+3 more)

### Community 49 - "Redis & Idempotency"
Cohesion: 0.27
Nodes (6): getRedisUrl(), IdempotencyMiddleware, isLoginRoute(), isPublicTakeawayRoute(), Injectable, TenantAwareRequest

### Community 51 - "Print Bridge TS Config"
Cohesion: 0.17
Nodes (11): compilerOptions, esModuleInterop, module, moduleResolution, outDir, rootDir, skipLibCheck, strict (+3 more)

### Community 52 - "Order Processing Service"
Cohesion: 0.29
Nodes (3): parseIngredientOverrides(), toNumeric(), Order

### Community 53 - "Delivery Status View"
Cohesion: 0.27
Nodes (9): allowedTransitions, canTransition(), DeliveryView(), getNextStatus(), getNextStatusLabel(), statusLabels, statusOptions, statusTones (+1 more)

### Community 54 - "Unit Conversion Utilities"
Cohesion: 0.33
Nodes (9): areUnitsCompatible(), convertUnit(), formatQuantity(), FROM_BASE, getDefaultInventoryUnit(), getUnitFamily(), normalizeUnitKey(), spreadsheetToInventory() (+1 more)

### Community 57 - "App Router & Error Handling"
Cohesion: 0.25
Nodes (4): AppRouter(), ErrorBoundary, Props, State

### Community 58 - "Food Cost Matrix UI"
Cohesion: 0.25
Nodes (6): FoodCostImportModal(), FoodCostImportModalProps, ImportResult, FoodCostMatrixRow, FoodCostMatrixSummary, FoodCostMatrixTabProps

### Community 59 - "Superadmin Session Management"
Cohesion: 0.31
Nodes (6): getToken(), MODULES, setSession(), superadminFetch(), SuperadminPage(), setImpersonationSnapshot()

### Community 60 - "Staff Auth Session"
Cohesion: 0.25
Nodes (9): clearAuthSession(), fetchStaff(), getStoredUser(), inferTenantId(), login(), logout(), persistAuthSession(), refreshSession() (+1 more)

### Community 61 - "Table Checkout Payments"
Cohesion: 0.25
Nodes (8): getTablePaymentStatus(), markShareAsPaid(), TablePaymentStatus, CheckoutState, CheckoutStep, PayItemSelection, MarkShareAsPaidRequest, MarkShareAsPaidResponse

### Community 62 - "Build & Migration Scripts"
Cohesion: 0.25
Nodes (8): scripts, build, db:generate, db:migrate, dev, lint, start, test

### Community 63 - "API Dev Dependencies"
Cohesion: 0.29
Nodes (7): devDependencies, drizzle-kit, @types/jsonwebtoken, @types/pg, drizzle-kit, @types/jsonwebtoken, @types/pg

### Community 64 - "Public Reservation Page"
Cohesion: 0.48
Nodes (6): BookingForm, buildReservedFor(), formatDateTime(), PublicReservationPage(), todayStr(), createPublicReservation()

### Community 65 - "Consumer JWT Auth Guard"
Cohesion: 0.33
Nodes (3): ConsumerJwtAuthGuard, Inject, Injectable

### Community 67 - "POS Tables View"
Cohesion: 0.47
Nodes (5): POSViewProps, TablesView(), TablesViewProps, AppData, SelfOrderSessionRotateResponse

### Community 69 - "ModuleKey"
Cohesion: 0.53
Nodes (4): UiActionKey, UiActionPolicy, uiActionPolicyMatrix, ModuleKey

### Community 70 - "API Package Configuration"
Cohesion: 0.40
Nodes (4): name, private, type, version

### Community 72 - "Build TypeScript Config"
Cohesion: 0.40
Nodes (4): compilerOptions, noEmit, extends, ./tsconfig.json

### Community 73 - "Server Test Utilities"
Cohesion: 0.60
Nodes (3): getPort(), httpGet(), httpPost()

### Community 77 - "Simple Catalog Routing"
Cohesion: 0.67
Nodes (3): SimpleCatalogRoute(), createCategory(), createMenuItem()

## Knowledge Gaps
- **393 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+388 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **23 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `AppRepository` connect `App Repository Methods` to `Core App Controller`, `Repository & Utilities`, `Request Validation Schemas`, `Auth Hashing & Schema`, `Tables CRUD Controller`, `Consumer Auth Controller`, `Staff Auth Controller`, `App Module & Database Setup`, `Staff Management Controller`, `Audit Logging & Auth Guards`, `BOM CRUD Controller`, `Realtime WebSocket Gateway`, `JWT Auth Middleware`, `Transactional Repository Methods`, `Print & Settings Service`, `Public Menu API`, `Public Ordering Service`, `ESC/POS Receipt Builder`, `Dashboard Analytics View`, `Redis & Idempotency`, `Group Order Service`, `Order Processing Service`, `Consumer JWT Auth Guard`, `Food Cost Import Service`, `Customer CRUD Service`, `Session Refresh Service`, `Purchase Order Service`, `Dependency Injection Decorators`, `Public Funnel Tracking`?**
  _High betweenness centrality (0.091) - this node is a cross-community bridge._
- **Why does `dependencies` connect `Frontend Dependencies` to `Checkout & Payment Views`?**
  _High betweenness centrality (0.079) - this node is a cross-community bridge._
- **Why does `react` connect `Checkout & Payment Views` to `Frontend Dependencies`, `Kitchen Display View`?**
  _High betweenness centrality (0.079) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _393 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Core App Controller` be split into smaller, more focused modules?**
  _Cohesion score 0.0671079242507814 - nodes in this community are weakly interconnected._
- **Should `TypeScript Data Schemas` be split into smaller, more focused modules?**
  _Cohesion score 0.017543859649122806 - nodes in this community are weakly interconnected._
- **Should `API Client Utilities` be split into smaller, more focused modules?**
  _Cohesion score 0.051490037030506086 - nodes in this community are weakly interconnected._
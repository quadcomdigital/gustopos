# Graph Report - gustopos  (2026-07-30)

## Corpus Check
- 353 files · ~468,165 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2974 nodes · 8396 edges · 151 communities (118 shown, 33 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 11 edges (avg confidence: 0.75)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `9d95392b`
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
- Public Ordering Service
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
- Group Order Service
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
- Food Cost Import Service
- POS Tables View
- Customer Detail Page
- ModuleKey
- API Package Configuration
- Customer CRUD Service
- Build TypeScript Config
- Server Test Utilities
- Session Refresh Service
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
- PM2 HMR Config
- Global Constraints
- .listInventoryItems
- Food Cost Container Selector — Implementation Plan
- devDependencies
- Fix Modifier Stock Deduction & Container Counting — Implementation Plan
- Modules and API routes
- GustoPOS Monorepo
- QzTrayWorker.tsx
- PrintJob
- Fix Ingredient References in Kitchen Receipts — Implementation Plan
- Design
- Customer
- BridgeWorker.tsx
- StatusPill.tsx
- RecipeTreeView.tsx
- AGENTS.md — GustoPOS
- TablesController
- Multi-tenant Upgrade Notes
- reservations.schema.ts
- FiscalExportsView.tsx
- scripts
- LoadingOrEmpty.tsx
- web/package.json
- StockLevelChart.tsx
- StockMovementsDrawer.tsx
- fiscal.schema.ts
- LowStockAlert.tsx
- useDirtyState.ts
- ErrorBoundary
- Module Audit Matrix
- delivery.schema.ts
- socket.io
- xlsx
- PaymentsView.tsx
- install-qz-cert.sh
- lucide-react
- tables.schema.ts
- socket.io-client
- prep.schema.ts
- @tailwindcss/vite
- BootstrapTenantService
- xlsx
- verify_patch.sh
- NewProductSelectionModal.tsx

## God Nodes (most connected - your core abstractions)
1. `AppRepository` - 240 edges
2. `AppController` - 158 edges
3. `RequiresModule()` - 147 edges
4. `getTenantIdOrDefault()` - 141 edges
5. `authorizedFetch()` - 140 edges
6. `Roles()` - 138 edges
7. `readJson()` - 130 edges
8. `AppState` - 111 edges
9. `useAppStore` - 67 edges
10. `Ingredient` - 67 edges

## Surprising Connections (you probably didn't know these)
- `MenuCardsProps` --references--> `MenuItemAdmin`  [EXTRACTED]
  apps/web/src/components/inventory/MenuCards.tsx → packages/shared/src/contracts/menu.schema.ts
- `UnitConversionManagerProps` --references--> `UnitConversion`  [EXTRACTED]
  apps/web/src/components/inventory/UnitConversionManager.tsx → packages/shared/src/contracts/prep.schema.ts
- `UiActionPolicy` --references--> `ModuleKey`  [EXTRACTED]
  apps/web/src/shared/authz/policy.ts → packages/shared/src/contracts/auth.schema.ts
- `UseBackofficeSessionLifecycleParams` --references--> `Staff`  [EXTRACTED]
  apps/web/src/app/backoffice/hooks/useBackofficeSessionLifecycle.ts → packages/shared/src/contracts/auth.schema.ts
- `UseOperationalSummariesParams` --references--> `ModuleKey`  [EXTRACTED]
  apps/web/src/app/backoffice/hooks/useOperationalSummaries.ts → packages/shared/src/contracts/auth.schema.ts

## Import Cycles
- None detected.

## Communities (151 total, 33 thin omitted)

### Community 0 - "Core App Controller"
Cohesion: 0.05
Nodes (22): AppController, Body, Controller, Delete, Get, Param, Patch, Post (+14 more)

### Community 1 - "TypeScript Data Schemas"
Cohesion: 0.04
Nodes (51): appDataSchema, staffSchema, bomAddComponentRequestSchema, BomComponent, bomComponentSchema, bomCreateRequestSchema, bomItemSchema, BomListResponse (+43 more)

### Community 2 - "API Client Utilities"
Cohesion: 0.04
Nodes (73): Coupon, CouponCreateRequest, couponCreateRequestSchema, couponSchema, CouponUpdateRequest, couponUpdateRequestSchema, CouponValidateRequest, couponValidateRequestSchema (+65 more)

### Community 3 - "Repository & Utilities"
Cohesion: 0.29
Nodes (5): channelToLinear(), contrastRatio(), luminance(), parseHexColor(), UiSettings

### Community 4 - "Request Validation Schemas"
Cohesion: 0.04
Nodes (112): InventoryRoute(), SimpleCatalogRoute(), addBomComponent(), addMenuItemRecipeComponent(), adjustIngredient(), authorizedFetch(), bulkCreateTables(), cancelReservation() (+104 more)

### Community 5 - "Auth Hashing & Schema"
Cohesion: 0.26
Nodes (10): Body, Patch, Post, SettingsViewProps, TablesManagementView(), TablesManagementViewProps, Table, TableBulkCreateRequest (+2 more)

### Community 6 - "Superadmin Tenant Management"
Cohesion: 0.15
Nodes (18): CheckoutMainView(), CheckoutModal(), CloseTableView(), PayItemsView(), SplitBillView(), ReservationsView(), statusOptions, SegmentedChipOption (+10 more)

### Community 7 - "App Repository Methods"
Cohesion: 0.07
Nodes (30): ConsumerAuthController, Body, Controller, Get, Param, Post, Req, Throttle (+22 more)

### Community 8 - "App State & UI Theme"
Cohesion: 0.06
Nodes (7): AppRepository, Injectable, getTenantIdOrDefault(), OperationalSummaryQuery, FiscalExport, Shift, Supplier

### Community 9 - "Tables CRUD Controller"
Cohesion: 0.04
Nodes (86): db, DbClient, appSettings, authSessions, bomComponents, bomItems, categories, categoryModifierPoolCategories (+78 more)

### Community 10 - "Checkout & Payment Views"
Cohesion: 0.08
Nodes (22): SuperadminController, SuperadminRequest, Body, Controller, Get, Param, Patch, Post (+14 more)

### Community 11 - "Consumer Auth Controller"
Cohesion: 0.09
Nodes (23): dependencies, clsx, date-fns, motion, qrcode.react, react-dom, react-router-dom, recharts (+15 more)

### Community 12 - "Order Status & Consumer UI"
Cohesion: 0.26
Nodes (8): hashPin(), isHashedPin(), SCRYPT_PARAMS, scryptAsync(), verifyPin(), DbInitService, Injectable, seedInitialData()

### Community 13 - "Frontend Dependencies"
Cohesion: 0.03
Nodes (63): ConsumerAccountsConfig, consumerAccountsConfigSchema, consumerOrderHistoryItemSchema, consumerOrderHistoryResponseSchema, ConsumerRefreshResponse, consumerUserSchema, GroupOrderCartItem, groupOrderCartItemSchema (+55 more)

### Community 14 - "Staff Auth Controller"
Cohesion: 0.08
Nodes (26): AuthController, Body, Controller, Get, Inject, Post, Req, Throttle (+18 more)

### Community 15 - "BOM & Category UI Tabs"
Cohesion: 0.07
Nodes (39): App(), useBackofficeContext(), CustomersRoute(), CustomersView, DashboardRoute(), DashboardView, DeliveryRoute(), DeliveryView (+31 more)

### Community 16 - "App Module & Database Setup"
Cohesion: 0.12
Nodes (38): ConfirmDialog(), ConfirmDialogProps, BomTab(), componentTypeLabel(), CategoriesTab(), PRINT_AREA_LABELS, IngredientsTab(), EditTab (+30 more)

### Community 17 - "Main App Routing Views"
Cohesion: 0.30
Nodes (9): ModifierEditor(), ModifierEditorProps, createGroup(), createOption(), ModifierGroupsEditor(), ModifierGroupsEditorProps, generateId(), MenuItemModifier (+1 more)

### Community 18 - "Inventory & Category Editors"
Cohesion: 0.10
Nodes (20): AuditEvent, AuditLogService, AuditPayload, Injectable, JwtAuthGuard, Inject, Injectable, AuthModule (+12 more)

### Community 19 - "Staff Management Controller"
Cohesion: 0.09
Nodes (20): SuperadminAuthController, SuperadminRequest, Body, Controller, Get, Post, Req, Throttle (+12 more)

### Community 20 - "Audit Logging & Auth Guards"
Cohesion: 0.08
Nodes (44): AuthMode, ConsumerAuthPage(), ConsumerOrdersPage(), formatDateTime(), STATUS_COLOR, STATUS_LABEL, CartItem, formatPrice() (+36 more)

### Community 21 - "Superadmin Auth Controller"
Cohesion: 0.14
Nodes (16): StaffController, Body, Controller, Inject, Param, Patch, Post, UseGuards (+8 more)

### Community 22 - "Product Recipe Builder"
Cohesion: 0.19
Nodes (22): BackofficeEntry(), BackofficeRouteGuard(), BackofficeRouteGuardProps, BackofficeShellProps, ICONS, useOperationalSummaries(), BACKOFFICE_ROUTES, BackofficeRouteKey (+14 more)

### Community 23 - "BOM CRUD Controller"
Cohesion: 0.14
Nodes (38): CategoriesTabProps, CategoryPoolEditorProps, IngredientsTabProps, InlineCategoryPickerProps, InventoryTabKey, InventoryTabsProps, TODO: navigate to PurchasingView with pre-filled data, SIMPLE_TABS (+30 more)

### Community 24 - "Node.js Dev Dependencies"
Cohesion: 0.18
Nodes (11): BomController, Body, Controller, Delete, Inject, Param, Patch, Post (+3 more)

### Community 25 - "Web TypeScript Configuration"
Cohesion: 0.08
Nodes (40): Get, BomCards(), BomCardsProps, BomTabProps, ComponentCandidate, ComponentPickerProps, ConversionHint(), ConversionHintProps (+32 more)

### Community 26 - "Realtime WebSocket Gateway"
Cohesion: 0.43
Nodes (4): AppModule, Module, parseCorsOrigins(), bootstrap()

### Community 27 - "Backoffice Route Guards"
Cohesion: 0.08
Nodes (24): concurrently, devDependencies, concurrently, tsx, @types/express, @types/node, typescript, name (+16 more)

### Community 28 - "Print Bridge Dependencies"
Cohesion: 0.09
Nodes (21): compilerOptions, allowImportingTsExtensions, allowJs, experimentalDecorators, isolatedModules, jsx, lib, module (+13 more)

### Community 29 - "API TypeScript Configuration"
Cohesion: 0.24
Nodes (6): getToken(), MODULES, setSession(), superadminFetch(), ImpersonationSnapshot, setImpersonationSnapshot()

### Community 30 - "Fiscal & Status Views"
Cohesion: 0.13
Nodes (18): useImpersonationExit(), UseImpersonationExitParams, ShiftsView(), ShiftsViewProps, statuses, ToastHost(), ToastItem, formatTimestamp() (+10 more)

### Community 31 - "Modifier Editor Components"
Cohesion: 0.11
Nodes (18): dependencies, express, devDependencies, supertest, @types/supertest, name, private, scripts (+10 more)

### Community 32 - "JWT Auth Middleware"
Cohesion: 0.11
Nodes (17): compilerOptions, emitDecoratorMetadata, esModuleInterop, experimentalDecorators, forceConsistentCasingInFileNames, module, moduleResolution, outDir (+9 more)

### Community 33 - "Transactional Repository Methods"
Cohesion: 0.08
Nodes (27): CustomersViewProps, CustomerAddress, customerAddressCreateRequestSchema, customerAddressUpdateRequestSchema, CustomerAnalytics, customerAnalyticsRequestSchema, customerAnalyticsSchema, CustomerCreateRequest (+19 more)

### Community 34 - "Print & Settings Service"
Cohesion: 0.16
Nodes (5): parseIngredientOverrides(), parseSelectedModifiers(), toNumeric(), BootstrapResponse, Order

### Community 35 - "Staff"
Cohesion: 0.15
Nodes (16): SuperadminPage(), authHeaders(), clearAuthSession(), fetchStaff(), getAccessToken(), getRefreshToken(), getStoredUser(), hasAuthSession() (+8 more)

### Community 36 - "Shared Package Configuration"
Cohesion: 0.09
Nodes (17): Inject, getRedisUrl(), canReceiveEvent(), RealtimeGateway, Inject, Injectable, RealtimePubSubService, Injectable (+9 more)

### Community 37 - "Public Menu API"
Cohesion: 0.09
Nodes (22): assertOrderStatusTransition(), canTransitionOrderStatus(), TRANSITIONS, DashboardView(), DashboardViewProps, CustomerAnalyticsRequest, DeliverySummary, ReservationsSummary (+14 more)

### Community 38 - "Public Ordering Service"
Cohesion: 0.06
Nodes (52): applyUiTheme(), themeVariableMap, TablePaymentStatus, AppState, areSameModules(), areSamePermissions(), areSameUsers(), attachSocketListeners() (+44 more)

### Community 39 - "Backoffice Shell & PWA"
Cohesion: 0.13
Nodes (14): dependencies, zod, devDependencies, exports, zod, main, name, private (+6 more)

### Community 40 - "Backoffice Data Fetching"
Cohesion: 0.07
Nodes (27): FoodCostAnalysis, foodCostAnalysisSchema, FoodCostFullImport, foodCostFullImportSchema, FoodCostMatrixCell, foodCostMatrixCellSchema, FoodCostMatrixImport, FoodCostMatrixImportRow (+19 more)

### Community 41 - "Shared TypeScript Config"
Cohesion: 0.05
Nodes (51): react, allowedTransitions, canTransition(), DeliveryView(), getNextStatus(), getNextStatusLabel(), statusLabels, statusOptions (+43 more)

### Community 42 - "API Server Dependencies"
Cohesion: 0.14
Nodes (13): compilerOptions, declaration, declarationMap, module, moduleResolution, outDir, rootDir, skipLibCheck (+5 more)

### Community 43 - "ESC/POS Receipt Builder"
Cohesion: 0.13
Nodes (15): dependencies, dotenv, jsonwebtoken, @nestjs/websockets, pg, reflect-metadata, rxjs, zod (+7 more)

### Community 45 - "Print Bridge Server"
Cohesion: 0.08
Nodes (23): API_URL, app, BRIDGE_AREAS, BRIDGE_HOSTNAME, BRIDGE_PRINTERS, bridgeApi(), CA_CERT_PATH, CERT_PATH (+15 more)

### Community 46 - "Impersonation & Logging"
Cohesion: 0.22
Nodes (11): keyFor(), LocalIdentity, PublicGroupOrderPage(), createPublicGroupOrderSession(), joinPublicGroupOrderSession(), patchPublicGroupOrderCart(), submitPublicGroupOrder(), GroupOrderSession (+3 more)

### Community 47 - "Kitchen Display View"
Cohesion: 0.17
Nodes (11): devDependencies, drizzle-kit, @types/jsonwebtoken, @types/pg, name, private, type, version (+3 more)

### Community 50 - "Group Order Service"
Cohesion: 0.17
Nodes (11): compilerOptions, esModuleInterop, module, moduleResolution, outDir, rootDir, skipLibCheck, strict (+3 more)

### Community 51 - "Print Bridge TS Config"
Cohesion: 0.24
Nodes (13): getNextStatus(), getOrderAgeClass(), getOrderAgeMinutes(), getOrderLabel(), getPrepByTime(), getPrevStatus(), getStatusMeta(), isScheduled() (+5 more)

### Community 52 - "Order Processing Service"
Cohesion: 0.08
Nodes (24): Get, loginResponseSchema, moduleKeySchema, QzTrayConfig, qzTrayConfigSchema, StaffAdminListResponse, staffAdminListResponseSchema, staffAdminSchema (+16 more)

### Community 53 - "Delivery Status View"
Cohesion: 0.04
Nodes (76): authedJson(), bootstrapResponseSchema, _cachedTenantId, claimBridgeJobsRequest(), completeBridgeJobRequest(), createOnboardingSecretRequest(), createShortCodePairingRequest(), customerAddressSchema (+68 more)

### Community 54 - "Unit Conversion Utilities"
Cohesion: 0.33
Nodes (9): areUnitsCompatible(), convertUnit(), formatQuantity(), FROM_BASE, getDefaultInventoryUnit(), getUnitFamily(), normalizeUnitKey(), spreadsheetToInventory() (+1 more)

### Community 57 - "App Router & Error Handling"
Cohesion: 0.12
Nodes (16): clockInRequestSchema, clockOutRequestSchema, shiftCreateRequestSchema, shiftSchema, shiftsQuerySchema, shiftStatusSchema, shiftUpdateRequestSchema, timeEntrySchema (+8 more)

### Community 58 - "Food Cost Matrix UI"
Cohesion: 0.25
Nodes (6): FoodCostImportModal(), FoodCostImportModalProps, ImportResult, FoodCostMatrixRow, FoodCostMatrixSummary, FoodCostMatrixTabProps

### Community 59 - "Superadmin Session Management"
Cohesion: 0.25
Nodes (8): scripts, build, db:generate, db:migrate, dev, lint, start, test

### Community 60 - "Staff Auth Session"
Cohesion: 0.05
Nodes (41): Audit Findings Reference, Execution Order, Global Constraints, Inventory Enterprise Overhaul — Implementation Plan, Phase 0: Foundation — Design System + Schema, Phase 1: Dashboard — From Data List to Decision Tool, Phase 2: Mobile/Tablet Parity, Phase 3: Interaction Improvements (+33 more)

### Community 62 - "Build & Migration Scripts"
Cohesion: 0.22
Nodes (12): PurchasingView(), statusOrder, createGoodsReceipt(), createPurchaseOrder(), createSupplier(), createSupplierIngredient(), deleteSupplierIngredient(), fetchSupplierIngredients() (+4 more)

### Community 63 - "API Dev Dependencies"
Cohesion: 0.48
Nodes (6): BookingForm, buildReservedFor(), formatDateTime(), PublicReservationPage(), todayStr(), createPublicReservation()

### Community 64 - "Public Reservation Page"
Cohesion: 0.22
Nodes (10): BackofficeContext, BackofficeContextValue, DeliverySummaryState, ReservationsSummaryState, useBackofficeSessionLifecycle(), UseBackofficeSessionLifecycleParams, UseOperationalSummariesParams, LoginViewProps (+2 more)

### Community 66 - "Food Cost Import Service"
Cohesion: 0.06
Nodes (34): €0.50 tier (cheese, vegetables, small items), €1.00 tier (proteins, sides), €2.00 tier, AGOSTO BURGER — €7.00, ANTI PASTI, BASE OPTIONS (Panini/Burgers/Special only), BURGERS, BURRO — €7.00 (+26 more)

### Community 67 - "POS Tables View"
Cohesion: 0.09
Nodes (24): PrepView(), CreatePrepInlineModal(), PrepVariant, UnitConversionManagerProps, createPrepItem(), createUnitConversion(), deletePrepItem(), fetchUnitConversions() (+16 more)

### Community 68 - "Customer Detail Page"
Cohesion: 0.40
Nodes (4): compilerOptions, noEmit, extends, ./tsconfig.json

### Community 69 - "ModuleKey"
Cohesion: 0.60
Nodes (3): getPort(), httpGet(), httpPost()

### Community 71 - "Customer CRUD Service"
Cohesion: 0.07
Nodes (29): A. Sicurezza (P0) — SKIP in fase development, B-Q1: Frontend TypeScript Strict Mode, B-Q1 step 3-5: Fix restanti strict errors (se presenti), B-Q2: ESLint + Prettier, B-Q3: Backend stricter TS options, B-Q4: Hoist devDeps, B-Q5 + E-A4: Structured logger + Toast, B. Qualità Codice / Type Safety (P1) — COMPLETATO (+21 more)

### Community 72 - "Build TypeScript Config"
Cohesion: 0.29
Nodes (6): checkoutStoreState, mockCloseCheckout, mockData, mockSetDiscountAmount, mockSetStep, mockSetSurchargeAmount

### Community 73 - "Server Test Utilities"
Cohesion: 0.07
Nodes (26): 1. Access the Print Station, 1. Install Java (OpenJDK 11+), 1. Install QZ Tray, 2. Configure Settings, 2. Download and Install QZ Tray, 2. Verify QZ Tray is Running, 3. Configure Windows Firewall, 3. Connect to QZ Tray (+18 more)

### Community 74 - "Session Refresh Service"
Cohesion: 0.07
Nodes (26): Audit Follow-up Plan (moduli ON/OFF), Dipendenze principali, Focus, Focus, Focus, Focus, GustoPOS - Roadmap Operativa 4 Settimane, KPI di successo (fine 4 settimane) (+18 more)

### Community 75 - "Purchase Order Service"
Cohesion: 0.08
Nodes (25): `bom_items` — nuovi campi, BOM Stock Levels Design, BomTab, `createOrder` — modifica, Esempio flusso, `explodeBomRequirements` — modifica, `GET /api/bom/stock`, In scope (+17 more)

### Community 76 - "Food Cost Analysis UI"
Cohesion: 0.35
Nodes (10): CustomerDetailPage(), createCustomerAddress(), deleteCustomerAddress(), earnLoyaltyPoints(), fetchCustomerAddresses(), fetchCustomerById(), fetchLoyaltyBalance(), fetchLoyaltyTransactions() (+2 more)

### Community 78 - "Vite Build Configuration"
Cohesion: 0.16
Nodes (12): ConsumerJwtAuthGuard, Inject, Injectable, getJwtSecret(), JwtPayload, EVENT_MODULE_MAP, ResolvedIdentity, runWithTenantContext() (+4 more)

### Community 80 - "Security Headers Middleware"
Cohesion: 0.09
Nodes (22): Errori standard, Fiscal Exports (CSV only), `GET /api/fiscal/exports`, `GET /api/fiscal/exports/:id/download`, `GET /api/purchasing/orders`, `GET /api/purchasing/suppliers`, `GET /api/shifts`, `GET /api/timeclock/report` (+14 more)

### Community 83 - "JWT Token Library"
Cohesion: 0.07
Nodes (32): EscPosBuilder, padRight(), AREA_LABELS, BindBridgeMappingModalProps, AREA_LABELS, BridgeCard(), BridgeCardProps, classifyFreshness() (+24 more)

### Community 89 - "NestJS WebSockets Module"
Cohesion: 0.10
Nodes (19): 1. RICEVUTA CUCINA (Kitchen), 2. RICEVUTA BAR, 3. RICEVUTA CASSA (Cashier — Ricevuta Cliente), 4. STAMPA DI TEST, 5. LOGO BITMAP, 6. CODICE ESC/POS GENERATO, 7. FLUSSO DI STAMPA, 8. CONFIGURAZIONE STAMPANTI (+11 more)

### Community 90 - "Decorator Metadata Reflection"
Cohesion: 0.11
Nodes (18): Assunzioni di pianificazione, Backlog trasversale (in parallelo), Epic 1: Hardening autenticazione staff, Epic 2: Quality gate minimo (test automatici), Epic 3: Split bill persistente e pagamenti multipli, Epic 4: Refund/storno tracciato, Epic 5: Modificatori e note cucina, Epic 6: Gestione turni cassa (+10 more)

### Community 91 - "Dependency Injection Decorators"
Cohesion: 0.27
Nodes (11): BackofficeShell(), useQzTrayStatus(), channelToLinear(), contrastRatio(), luminance(), parseHexColor(), QzTrayDebugPanel(), SettingsView() (+3 more)

### Community 99 - "PM2 HMR Config"
Cohesion: 0.11
Nodes (18): BOM Stock Levels Implementation Plan, Global Constraints, Task 10: Web — Create BomStockCard Component, Task 11: Web — Add BomStockCard to Inventory Dashboard, Task 12: Web — Add Pre-Batched Toggle to BomTab, Task 13: Web — Add Stock Badge to BomTab Cards, Task 14: Web — Update App Store for BOM Stock, Task 15: Mark Cartoccio and Carbocrema as Pre-Batched (+10 more)

### Community 100 - "Global Constraints"
Cohesion: 0.11
Nodes (18): Execution Order, Global Constraints, Inventory UX Overhaul — Implementation Plan, Task 10: Split MenuItems Modal into Focused Views, Task 11: Styled ConfirmDialog + Undo Toast, Task 12: Unit Dropdown with Autocomplete, Task 13: Native HTML5 Input Semantics, Task 14: Bulk Operations on Inventory Lists (+10 more)

### Community 102 - "Food Cost Container Selector — Implementation Plan"
Cohesion: 0.11
Nodes (17): Expected Result, Expected UI, Food Cost Container Selector — Implementation Plan, Food Cost Matrix (Smash Burger), Global Constraints, Summary of Changes, Task 1: Add defaultContainerId to menu_items, Task 2: Update Zod schemas for defaultContainerId (+9 more)

### Community 103 - "devDependencies"
Cohesion: 0.08
Nodes (25): devDependencies, eslint, eslint-plugin-jsx-a11y, eslint-plugin-react-hooks, globals, jsdom, @testing-library/jest-dom, @testing-library/react (+17 more)

### Community 104 - "Fix Modifier Stock Deduction & Container Counting — Implementation Plan"
Cohesion: 0.12
Nodes (15): Current State, Data Statistics, Expected Behavior After Fix, Fix Modifier Stock Deduction & Container Counting — Implementation Plan, Global Constraints, Smash Burger + Bun Order (default), Smash Burger + Piadina Order, Summary of Changes (+7 more)

### Community 105 - "Modules and API routes"
Cohesion: 0.12
Nodes (15): analytics, customers, delivery, Frontend tab gating, inventory, kitchen, Module Coverage Matrix, Modules and API routes (+7 more)

### Community 106 - "GustoPOS Monorepo"
Cohesion: 0.12
Nodes (15): Avvio locale, Endpoint disponibili (fase 1-2), Flussi waiter (fase attuale), GustoPOS Monorepo, Magazzino BoM, Note operative HMR, PM2, Porte pubbliche configurate (+7 more)

### Community 107 - "QzTrayWorker.tsx"
Cohesion: 0.26
Nodes (10): addDebugLog(), globalState, listeners, loadQzTrayScript(), notifyListeners(), PrinterTarget, QzConnectionStatus, QzTrayWorker() (+2 more)

### Community 109 - "Fix Ingredient References in Kitchen Receipts — Implementation Plan"
Cohesion: 0.14
Nodes (13): Expected Receipt Output After Fix, Fix Ingredient References in Kitchen Receipts — Implementation Plan, Global Constraints, Summary of Changes, Task 1: Add `is_container` flag to inventory table, Task 2: Add `is_container` flag to bom_items table, Task 3: Update Zod schemas for container fields, Task 4: Update repository to handle container fields (+5 more)

### Community 110 - "Design"
Cohesion: 0.14
Nodes (13): Data Model, Design, Existing Tables, Expected Flow (End-to-End), File Structure, Supplier-Ingredient Wiring Plan, Task 1: Add `brandName` to supplier_ingredients, Task 2: PO auto-fill from supplier_ingredients (+5 more)

### Community 113 - "BridgeWorker.tsx"
Cohesion: 0.40
Nodes (8): BridgeWorker(), completeJobApi(), failJobApi(), loadQzLibraryIfNeeded(), printAndComplete(), safeListPrinters(), safeStr(), useWakeLock()

### Community 115 - "RecipeTreeView.tsx"
Cohesion: 0.22
Nodes (7): BomItem, Ingredient, PrepItem, RecipeComponent, RecipeTreeView(), RecipeTreeViewProps, TreeNodeProps

### Community 116 - "AGENTS.md — GustoPOS"
Cohesion: 0.29
Nodes (6): AGENTS.md — GustoPOS, Architecture, Dev Gotchas, Infrastructure, Key Files, Quick Commands

### Community 118 - "TablesController"
Cohesion: 0.18
Nodes (7): TablesController, Controller, Delete, Get, Inject, Param, UseGuards

### Community 119 - "Multi-tenant Upgrade Notes"
Cohesion: 0.29
Nodes (6): Backend structure, Database changes, Example module toggle, Multi-tenant Upgrade Notes, Production checklist, Public menu API

### Community 120 - "reservations.schema.ts"
Cohesion: 0.18
Nodes (10): reservationCreateRequestSchema, ReservationListResponse, reservationListResponseSchema, ReservationNoShowRequest, reservationNoShowRequestSchema, reservationSchema, reservationsQuerySchema, ReservationStatus (+2 more)

### Community 121 - "FiscalExportsView.tsx"
Cohesion: 0.31
Nodes (7): escapeHtml(), FiscalExportsView(), PaymentsView(), UiActionKey, UiActionPolicy, uiActionPolicyMatrix, usePermission()

### Community 122 - "scripts"
Cohesion: 0.25
Nodes (8): scripts, build, dev, lint, lint:eslint, preview, test, test:watch

### Community 123 - "LoadingOrEmpty.tsx"
Cohesion: 0.40
Nodes (3): EmptyState(), EmptyStateProps, LoadingOrEmptyProps

### Community 125 - "web/package.json"
Cohesion: 0.40
Nodes (4): name, private, type, version

### Community 126 - "StockLevelChart.tsx"
Cohesion: 0.60
Nodes (4): getBarColor(), getTextColor(), StockLevelChart(), StockLevelChartProps

### Community 127 - "StockMovementsDrawer.tsx"
Cohesion: 0.50
Nodes (4): MOVEMENT_LABELS, StockMovementsDrawer(), StockMovementsDrawerProps, StockMovement

### Community 128 - "fiscal.schema.ts"
Cohesion: 0.20
Nodes (9): fiscalCloseRequestSchema, fiscalClosureSchema, fiscalExportCreateRequestSchema, FiscalExportFormat, fiscalExportFormatSchema, fiscalExportSchema, fiscalExportsQuerySchema, FiscalExportStatus (+1 more)

### Community 131 - "ErrorBoundary"
Cohesion: 0.25
Nodes (4): AppRouter(), ErrorBoundary, Props, State

### Community 133 - "delivery.schema.ts"
Cohesion: 0.25
Nodes (7): deliveryOrderSchema, DeliveryOrdersListResponse, deliveryOrdersListResponseSchema, deliveryOrdersQuerySchema, deliveryStatusSchema, deliveryStatusUpdateRequestSchema, deliveryUpsertRequestSchema

### Community 136 - "PaymentsView.tsx"
Cohesion: 0.43
Nodes (6): PaymentsViewProps, CheckoutState, SplitShare, PaymentKind, PaymentMethod, RefundPaymentResponse

### Community 140 - "tables.schema.ts"
Cohesion: 0.29
Nodes (6): tableBulkCreateRequestSchema, tableCreateRequestSchema, tableSchema, TableStatus, tableStatusSchema, tableUpdateRequestSchema

### Community 143 - "prep.schema.ts"
Cohesion: 0.33
Nodes (5): preparePrepItemResponseSchema, prepItemSchema, prepItemUpdateRequestSchema, unitConversionCreateRequestSchema, unitConversionSchema

## Knowledge Gaps
- **831 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+826 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **33 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `AppRepository` connect `App State & UI Theme` to `Core App Controller`, `API Client Utilities`, `Repository & Utilities`, `Auth Hashing & Schema`, `App Repository Methods`, `Tables CRUD Controller`, `Order Status & Consumer UI`, `.hashBridgeSecret`, `Staff Auth Controller`, `Frontend Dependencies`, `Inventory & Category Editors`, `Superadmin Auth Controller`, `Node.js Dev Dependencies`, `Print & Settings Service`, `Shared Package Configuration`, `Dashboard Analytics View`, `Public Group Ordering`, `Redis & Idempotency`, `Table Checkout Payments`, `Consumer JWT Auth Guard`, `API Package Configuration`, `Vite Build Configuration`, `JWT Token Library`, `TablesController`?**
  _High betweenness centrality (0.047) - this node is a cross-community bridge._
- **Why does `react` connect `Shared TypeScript Config` to `Print Bridge TS Config`, `Consumer Auth Controller`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **Why does `dependencies` connect `Consumer Auth Controller` to `Shared TypeScript Config`, `lucide-react`, `PrintJob`, `socket.io-client`, `@tailwindcss/vite`, `xlsx`, `web/package.json`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _831 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Core App Controller` be split into smaller, more focused modules?**
  _Cohesion score 0.054759106933019976 - nodes in this community are weakly interconnected._
- **Should `TypeScript Data Schemas` be split into smaller, more focused modules?**
  _Cohesion score 0.04155844155844156 - nodes in this community are weakly interconnected._
- **Should `API Client Utilities` be split into smaller, more focused modules?**
  _Cohesion score 0.036226930963773066 - nodes in this community are weakly interconnected._
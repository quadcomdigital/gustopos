# Module Coverage Matrix

## Modules and API routes

### kitchen
- `GET /api/data`
- `POST /api/orders`
- `PATCH /api/orders/:id`
- `POST /api/orders/:id/void`
- `POST /api/tables/:id/pay`
- `POST /api/tables/:id/split-bill`
- `POST /api/tables/:id/transfer`

### inventory
- `GET /api/inventory`
- `POST /api/inventory`
- `PATCH /api/inventory/:id`
- `GET /api/menu`
- `POST /api/menu`
- `PATCH /api/menu/:id`
- `POST /api/menu/:id/recipe`
- `POST /api/menu/:id/enable`
- `POST /api/menu/:id/disable`
- `GET /api/categories`
- `POST /api/categories`
- `PATCH /api/categories/:id`
- `GET/POST/PATCH/POST components /api/bom*`

### customers
- `GET /api/customers`
- `POST /api/customers`

### analytics
- `GET /api/payments`
- `POST /api/payments/:id/refund`
- `GET /api/orders/history`
- `GET /api/orders/:id`
- `GET /api/customers/analytics-summary`

### printing
- `GET /api/print-jobs`
- `POST /api/print-jobs/:id/dispatch`

### public_menu
- `GET /:tenantSlug/menu`
- `GET /api/public/menu`
- config supports category ordering, category visibility, featured items, sold-out flags via `public_menu` module config

### public_takeaway
- `POST /api/public/:tenantSlug/takeaway/orders`
- `GET /api/public/:tenantSlug/takeaway/orders/:orderId/track?token=...`
- `POST /api/public/:tenantSlug/funnel/events`
- `/:tenantSlug/menu` (UI checkout takeaway pubblico, capability-based)
- `/:tenantSlug/takeaway/track` (tracking pubblico stato ordine)

### self_order_qr
- `POST /api/self-order/tables/:id/qr/rotate`
- `GET /api/public/:tenantSlug/self-order/session?token=...`
- `POST /api/public/:tenantSlug/self-order/orders`

### reservations
- `GET /api/reservations`
- `POST /api/reservations`
- `PATCH /api/reservations/:id`
- `POST /api/reservations/:id/confirm`
- `POST /api/reservations/:id/cancel`

### delivery
- `GET /api/delivery/orders`
- `POST /api/delivery/orders/:orderId/upsert`
- `PATCH /api/delivery/orders/:orderId/status`
- `POST /api/delivery/orders/:orderId/dispatch`

### simple_catalog
- `GET /api/simple-catalog/items`
- `POST /api/simple-catalog/items`
- `PATCH /api/simple-catalog/items/:id`
- `POST /api/simple-catalog/items/:id/enable`
- `POST /api/simple-catalog/items/:id/disable`
- `GET /api/simple-catalog/categories`
- `POST /api/simple-catalog/categories`
- `PATCH /api/simple-catalog/categories/:id`

## Frontend tab gating

- `dashboard` -> `analytics`
- `tables` -> `kitchen`
- `pos` -> `kitchen`
- `kitchen` -> `kitchen`
- `inventory` -> `inventory`
- `simple-catalog` -> `simple_catalog` (hidden if `inventory` is enabled)
- `settings` -> always visible for admin role
- `reservations` -> `reservations`
- `delivery` -> `delivery`
- `purchasing` -> `purchasing_suppliers`
- `shifts` -> `staff_shifts_timeclock`
- `fiscal` -> `fiscal_exports`

## Notes

- Backend enforcement uses `@RequiresModule` + `FeatureFlagGuard` and returns 403 when module is disabled.
- Frontend hides tabs based on enabled modules and user role.
- Policy: when both `inventory` and `simple_catalog` are present, runtime behavior prioritizes `inventory`.
- Runtime session sync periodically refreshes enabled modules to reduce stale access after superadmin toggles.
- Policy: `self_order_qr` requires `public_menu` enabled; otherwise endpoints return `403`.
- Policy: `public_takeaway` requires `public_menu` and `kitchen` enabled; otherwise endpoints return `403`.

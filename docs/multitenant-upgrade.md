# Multi-tenant Upgrade Notes

## Backend structure

- `apps/api/src/tenant/tenant-context.middleware.ts`: risoluzione tenant da subdomain, slug menu, header, JWT.
- `apps/api/src/tenant/feature-flag.guard.ts`: blocco moduli disabilitati con 403.
- `apps/api/src/tenant/requires-module.decorator.ts`: annotazione route per modulo richiesto.
- `apps/api/src/tenant/tenant.service.ts`: CRUD tenant, toggle moduli, config override, cache Redis moduli.
- `apps/api/src/superadmin/superadmin.controller.ts`: API master superadmin.
- `apps/api/src/public/public-menu.controller.ts`: API menu pubblico tenant-based.

## Database changes

- Nuove tabelle: `tenants`, `tenant_modules`, `tenant_module_configs`, `roles`, `permissions`, `role_permissions`, `tenant_audit_logs`.
- Aggiunto `tenant_id` su tabelle operative.
- Migrazione principale: `apps/api/drizzle/0015_multitenancy_rls.sql`.

## Example module toggle

`POST /api/superadmin/tenants/:id/modules/toggle`

Payload:

```json
{
  "moduleKey": "inventory",
  "enabled": false
}
```

Effetto:

- update `tenant_modules`
- invalidazione cache Redis `tenant:{id}:modules`
- audit row in `tenant_audit_logs`

## Public menu API

- `GET /api/public/menu` (risoluzione tenant via contesto)
- `GET /:tenantSlug/menu` (fallback slug)

Response:

- `tenant` meta
- `categories`
- `items` con ingredienti e bom ids

## Production checklist

- [ ] test isolamento RLS con query cross-tenant
- [ ] test toggle modulo => 403 immediato
- [ ] test invalidazione cache Redis moduli
- [ ] test refresh JWT con moduli aggiornati
- [ ] test URL menu pubblico su subdomain + slug
- [ ] validare policy rollout/rollback moduli in produzione

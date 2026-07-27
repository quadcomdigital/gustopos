INSERT INTO "tenant_modules" ("id", "tenant_id", "module_key", "enabled", "created_at", "updated_at")
SELECT 'tm_' || md5(t.id || ':simple_catalog'), t.id, 'simple_catalog', 0, now(), now()
FROM "tenants" t
WHERE NOT EXISTS (
  SELECT 1 FROM "tenant_modules" tm WHERE tm."tenant_id" = t.id AND tm."module_key" = 'simple_catalog'
);

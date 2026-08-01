-- 0058_phase0_rls_fail_closed.sql
-- Phase 0 security hardening: an unset tenant context must match no rows.
-- The application DB wrapper sets app.current_tenant_id on the same pooled
-- connection for requests resolved by TenantContextMiddleware.

DO $$
DECLARE
  table_record RECORD;
BEGIN
  FOR table_record IN
    SELECT DISTINCT c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN information_schema.columns col
      ON col.table_schema = n.nspname
     AND col.table_name = c.relname
     AND col.column_name = 'tenant_id'
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_record.table_name);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', table_record.table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_policy ON public.%I', table_record.table_name);
    EXECUTE format(
      'CREATE POLICY tenant_isolation_policy ON public.%I USING (tenant_id = NULLIF(current_setting(''app.current_tenant_id'', true), '''')) WITH CHECK (tenant_id = NULLIF(current_setting(''app.current_tenant_id'', true), ''''))',
      table_record.table_name
    );
  END LOOP;
END
$$;

-- Credential verification needs one narrowly-scoped pre-tenant lookup. It is
-- enabled only by the short-lived AsyncLocalStorage bridge-auth marker; all
-- operational bridge reads/writes run after switching to the resolved tenant.
DO $$
BEGIN
  IF to_regclass('public.print_bridge_onboarding_secrets') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS bridge_onboarding_lookup ON public.print_bridge_onboarding_secrets';
    EXECUTE 'CREATE POLICY bridge_onboarding_lookup ON public.print_bridge_onboarding_secrets FOR SELECT USING (current_setting(''app.bridge_auth'', true) = ''on'')';
  END IF;
END
$$;

--> statement-breakpoint

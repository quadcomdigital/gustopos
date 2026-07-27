CREATE OR REPLACE FUNCTION apply_tenant_id_rls_adjusted(table_name text) RETURNS void AS $$
BEGIN
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
  EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_policy ON %I', table_name);
  EXECUTE format(
    'CREATE POLICY tenant_isolation_policy ON %I USING (tenant_id = COALESCE(current_setting(''app.current_tenant_id'', true), tenant_id)) WITH CHECK (tenant_id = COALESCE(current_setting(''app.current_tenant_id'', true), tenant_id))',
    table_name
  );
END;
$$ LANGUAGE plpgsql;

SELECT apply_tenant_id_rls_adjusted('staff');
SELECT apply_tenant_id_rls_adjusted('tables');
SELECT apply_tenant_id_rls_adjusted('inventory');
SELECT apply_tenant_id_rls_adjusted('menu_items');
SELECT apply_tenant_id_rls_adjusted('menu_item_ingredients');
SELECT apply_tenant_id_rls_adjusted('menu_item_bom_requirements');
SELECT apply_tenant_id_rls_adjusted('bom_items');
SELECT apply_tenant_id_rls_adjusted('bom_components');
SELECT apply_tenant_id_rls_adjusted('orders');
SELECT apply_tenant_id_rls_adjusted('order_items');
SELECT apply_tenant_id_rls_adjusted('auth_sessions');
SELECT apply_tenant_id_rls_adjusted('payments');
SELECT apply_tenant_id_rls_adjusted('app_settings');
SELECT apply_tenant_id_rls_adjusted('print_jobs');
SELECT apply_tenant_id_rls_adjusted('customers');
SELECT apply_tenant_id_rls_adjusted('categories');

DROP FUNCTION apply_tenant_id_rls_adjusted(text);

import { lazy, useCallback, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAppStore } from '../../../store/app-store';
import { useBackofficeContext } from '../BackofficeContext';
import { fetchStockMovements, fetchFoodCostMatrix, updateFoodCostMatrixCell, importFoodCostFull, importFoodCostXlsx, type FoodCostMatrixResponse } from '../../../shared/api/client';
import type { InventoryTabKey } from '../../../components/inventory/InventoryTabs';

const POSView = lazy(() => import('../../../components/POSView'));
const KitchenView = lazy(() => import('../../../components/KitchenView'));
const InventoryView = lazy(() => import('../../../components/InventoryView'));
const DashboardView = lazy(() => import('../../../components/DashboardView'));
const TablesView = lazy(() => import('../../../components/TablesView'));
const ReservationsView = lazy(() => import('../../../components/ReservationsView'));
const DeliveryView = lazy(() => import('../../../components/DeliveryView'));
const PurchasingView = lazy(() => import('../../../components/PurchasingView'));
const ShiftsView = lazy(() => import('../../../components/ShiftsView'));
const FiscalExportsView = lazy(() => import('../../../components/FiscalExportsView'));
const SettingsView = lazy(() => import('../../../components/SettingsView'));
const CustomersView = lazy(() => import('../../../components/CustomersView'));

export function TablesRoute() {
  const data = useAppStore((s) => s.data);
  const currentUser = useAppStore((s) => s.currentUser);
  const enabledModules = useAppStore((s) => s.enabledModules);
  const rotateSelfOrderQrForTable = useAppStore((s) => s.rotateSelfOrderQrForTable);
  const suspendTable = useAppStore((s) => s.suspendTable);
  const resumeTable = useAppStore((s) => s.resumeTable);
  const { setSelectedTable } = useBackofficeContext();
  const navigate = useNavigate();
  if (!data || !currentUser) return null;
  const canRotateSelfOrderQr = currentUser.role === 'admin' && enabledModules.includes('self_order_qr');
  return (
    <TablesView
      data={data}
      onSelectTable={(tableNumber) => {
        setSelectedTable(tableNumber);
        // Selecting a table means a dine-in order: reset the persisted POS mode
        // so the cart binds to `dine_in:<table>` instead of the last-used
        // takeaway/delivery context (which would show an empty cart).
        useAppStore.setState({ posOrderMode: 'dine_in' });
        navigate('/app/pos');
      }}
      onRotateSelfOrderQr={canRotateSelfOrderQr ? rotateSelfOrderQrForTable : undefined}
      onSuspendTable={
        enabledModules.includes('kitchen') && (currentUser.role === 'admin' || currentUser.role === 'waiter' || currentUser.permissions?.includes('tables:pay'))
          ? suspendTable
          : undefined
      }
      onResumeTable={
        enabledModules.includes('kitchen') && (currentUser.role === 'admin' || currentUser.role === 'waiter' || currentUser.permissions?.includes('tables:pay'))
          ? async (tableId) => { await resumeTable(tableId); }
          : undefined
      }
      onSelectOrder={(orderId) => {
        setSelectedTable(null);
        navigate(`/app/pos?order=${encodeURIComponent(orderId)}`);
      }}
    />
  );
}

export function PosRoute() {
  const data = useAppStore((s) => s.data);
  const currentUser = useAppStore((s) => s.currentUser);
  const createOrder = useAppStore((s) => s.createOrder);
  const upsertDeliveryOrder = useAppStore((s) => s.upsertDeliveryOrder);
  const customers = useAppStore((s) => s.customers);
  const refreshCustomers = useAppStore((s) => s.refreshCustomers);
  const createOrReuseCustomer = useAppStore((s) => s.createOrReuseCustomer);
  const uiSettings = useAppStore((s) => s.uiSettings);
  const _closeTable = useAppStore((s) => s.closeTable);
  const _splitBill = useAppStore((s) => s.splitBill);
  const _paySelectedItems = useAppStore((s) => s.paySelectedItems);
  const _getTablePaymentStatus = useAppStore((s) => s.getTablePaymentStatus);
  const transferTable = useAppStore((s) => s.transferTable);
  const mergeTable = useAppStore((s) => s.mergeTable);
  const suspendTable = useAppStore((s) => s.suspendTable);
  const resumeTable = useAppStore((s) => s.resumeTable);
  const enabledModules = useAppStore((s) => s.enabledModules);
  const { selectedTable, setSelectedTable } = useBackofficeContext();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialOrderId = searchParams.get('order');
  if (!data || !currentUser) return null;
  const canCloseTable = enabledModules.includes('kitchen') &&
    (currentUser.role === 'admin' || currentUser.role === 'waiter' || currentUser.permissions?.includes('tables:pay'));
  const canRelocateTables = enabledModules.includes('kitchen') &&
    (currentUser.role === 'admin' || currentUser.role === 'waiter');
  return (
    <POSView
      data={data}
      currentStaffId={currentUser.id}
      currentStaffName={currentUser.name}
      createOrder={createOrder}
      upsertDeliveryOrder={upsertDeliveryOrder}
      customers={customers}
      uiSettings={uiSettings}
      categories={data.categories}
      categoryModifierPools={data.categoryModifierPools}
      onSearchCustomers={refreshCustomers}
      onCreateOrReuseCustomer={createOrReuseCustomer}
      initialTable={selectedTable || '1'}
      initialOrderId={initialOrderId}
      onOrderContextChange={(orderId) => {
        const next = new URLSearchParams(searchParams);
        if (orderId) next.set('order', orderId);
        else next.delete('order');
        setSearchParams(next, { replace: true });
      }}
      onOpenTablesView={(tableNumber) => {
        setSelectedTable(tableNumber);
        navigate('/app/tables');
      }}
      canCloseTable={canCloseTable}
      onTransferTable={canRelocateTables
        ? async (sourceId, targetId) => { await transferTable(sourceId, { targetTableId: targetId }); }
        : undefined}
      onMergeTable={canRelocateTables
        ? async (sourceId, targetId) => { await mergeTable(sourceId, { targetTableId: targetId }); }
        : undefined}
      onSuspendTable={canCloseTable
        ? async (tableId, options) => { await suspendTable(tableId, options); }
        : undefined}
      onResumeTable={canCloseTable
        ? async (tableId) => { await resumeTable(tableId); }
        : undefined}
    />
  );
}

export function KitchenRoute() {
  const data = useAppStore((s) => s.data);
  const updateOrder = useAppStore((s) => s.updateOrder);
  if (!data) return null;
  return <KitchenView orders={data.orders} updateOrder={updateOrder} />;
}

export function InventoryRoute() {
  const data = useAppStore((s) => s.data);
  const loading = useAppStore((s) => s.loading);
  const error = useAppStore((s) => s.error);
  const clearError = useAppStore((s) => s.clearError);
  const refreshAllData = useAppStore((s) => s.refreshAllData);
  const inventoryItems = useAppStore((s) => s.inventoryItems);
  const bomItems = useAppStore((s) => s.bomItems);
  const prepItems = useAppStore((s) => s.prepItems);
  const menuItemsAdmin = useAppStore((s) => s.menuItemsAdmin);
  const categories = useAppStore((s) => s.categories);
  const categoryModifierPools = useAppStore((s) => s.categoryModifierPools);
  const refreshInventoryItems = useAppStore((s) => s.refreshInventoryItems);
  const refreshBomItems = useAppStore((s) => s.refreshBomItems);
  const refreshPrepItems = useAppStore((s) => s.refreshPrepItems);
  const refreshCategories = useAppStore((s) => s.refreshCategories);
  const createCategory = useAppStore((s) => s.createCategory);
  const updateCategory = useAppStore((s) => s.updateCategory);
  const deleteCategory = useAppStore((s) => s.deleteCategory);
  const createBomItem = useAppStore((s) => s.createBomItem);
  const updateBomItem = useAppStore((s) => s.updateBomItem);
  const replaceBomComponents = useAppStore((s) => s.replaceBomComponents);
  const deleteBomItem = useAppStore((s) => s.deleteBomItem);
  const createIngredient = useAppStore((s) => s.createIngredient);
  const updateIngredient = useAppStore((s) => s.updateIngredient);
  const deleteIngredient = useAppStore((s) => s.deleteIngredient);
  const adjustIngredient = useAppStore((s) => s.adjustIngredient);
  const refreshMenuItemsAdmin = useAppStore((s) => s.refreshMenuItemsAdmin);
  const createMenuProduct = useAppStore((s) => s.createMenuProduct);
  const updateMenuItem = useAppStore((s) => s.updateMenuItem);
  const setMenuItemActiveAdmin = useAppStore((s) => s.setMenuItemActiveAdmin);
  const deleteMenuItemAdmin = useAppStore((s) => s.deleteMenuItemAdmin);
  const refreshCategoryModifierPools = useAppStore((s) => s.refreshCategoryModifierPools);
  const createCategoryModifierPool = useAppStore((s) => s.createCategoryModifierPool);
  const updateCategoryModifierPool = useAppStore((s) => s.updateCategoryModifierPool);
  const deleteCategoryModifierPool = useAppStore((s) => s.deleteCategoryModifierPool);

  // Food cost matrix state — lazy loaded only when tab is active
  const [foodCostMatrix, setFoodCostMatrix] = useState<FoodCostMatrixResponse | null>(null);

  const refreshFoodCost = useCallback(async () => {
    try {
      const data = await fetchFoodCostMatrix();
      setFoodCostMatrix(data);
    } catch (error) {
      console.error('Failed to fetch food cost matrix:', error);
    }
  }, []);

  const handleActiveTabChange = useCallback((tab: InventoryTabKey) => {
    if (tab === 'foodcost' && !foodCostMatrix) {
      refreshFoodCost();
    }
  }, [foodCostMatrix, refreshFoodCost]);

  // Update food cost matrix cell
  const handleUpdateFoodCostCell = useCallback(async (
    menuItemId: string,
    ingredientId: string,
    quantity: number,
    unit: string,
  ) => {
    await updateFoodCostMatrixCell(menuItemId, ingredientId, quantity, unit);
    await refreshFoodCost();
  }, [refreshFoodCost]);

  // Import food cost matrix from file
  const handleImportFoodCost = useCallback(async (
    ingredientCosts: Array<{ name: string; costPerKg: number; costPerPiece: number; gramsPerPortion: number; piecesPerPortion: number }>,
    recipeRows: Array<{ ingredientName: string; menuItemName: string; quantity: number; unit: string }>,
  ) => {
    const result = await importFoodCostFull(ingredientCosts, recipeRows);
    await refreshFoodCost();
    return result;
  }, [refreshFoodCost]);

  const handleImportFoodCostXlsx = useCallback(async (xlsxBase64: string) => {
    const result = await importFoodCostXlsx(xlsxBase64);
    await refreshFoodCost();
    return result;
  }, [refreshFoodCost]);

  const onFetchMovements = useCallback(async (ingredientId: string) => {
    const res = await fetchStockMovements({ ingredientId, limit: 200 });
    return { movements: res.items };
  }, []);

  if (!data) return null;

  return (
    <InventoryView
      inventory={inventoryItems}
      bomItems={bomItems.length > 0 ? bomItems : data.bomItems}
      prepItems={prepItems}
      menuItems={menuItemsAdmin}
      categories={categories}
      loading={loading}
      error={error}
      onClearError={clearError}
      onRetryAll={() => { clearError(); void refreshAllData(); }}
      categoryModifierPools={categoryModifierPools}
      foodCostMatrix={foodCostMatrix || undefined}
      onRefreshFoodCost={refreshFoodCost}
      onUpdateFoodCostCell={handleUpdateFoodCostCell}
      onImportFoodCost={handleImportFoodCost}
      onImportFoodCostXlsx={handleImportFoodCostXlsx}
      onActiveTabChange={handleActiveTabChange}
      onRefreshInventory={refreshInventoryItems}
      onRefreshBom={refreshBomItems}
      onRefreshPrepItems={refreshPrepItems}
      onRefreshCategories={refreshCategories}
      onCreateCategory={createCategory}
      onUpdateCategory={updateCategory}
      onDeleteCategory={deleteCategory}
      onCreateBom={createBomItem}
      onUpdateBom={updateBomItem}
      onReplaceBomComponents={replaceBomComponents}
      onDeleteBom={deleteBomItem}
      onCreateIngredient={createIngredient}
      onUpdateIngredient={updateIngredient}
      onDeleteIngredient={deleteIngredient}
      onAdjustIngredient={adjustIngredient}
      onFetchMovements={onFetchMovements}
      onRefreshMenu={refreshMenuItemsAdmin}
      onCreateMenuProduct={createMenuProduct}
      onUpdateMenuItem={updateMenuItem}
      onSetMenuItemActive={setMenuItemActiveAdmin}
      onDeleteMenuItem={deleteMenuItemAdmin}
      onRefreshCategoryModifierPools={refreshCategoryModifierPools}
      onCreateCategoryModifierPool={createCategoryModifierPool}
      onUpdateCategoryModifierPool={updateCategoryModifierPool}
      onDeleteCategoryModifierPool={deleteCategoryModifierPool}
    />
  );
}

export function SimpleCatalogRoute() {
  const loading = useAppStore((s) => s.loading);
  const error = useAppStore((s) => s.error);
  const clearError = useAppStore((s) => s.clearError);
  const refreshAllData = useAppStore((s) => s.refreshAllData);
  const menuItemsAdmin = useAppStore((s) => s.menuItemsAdmin);
  const categories = useAppStore((s) => s.categories);
  const categoryModifierPools = useAppStore((s) => s.categoryModifierPools);
  const refreshCategories = useAppStore((s) => s.refreshCategories);
  const createCategory = useAppStore((s) => s.createCategory);
  const updateCategory = useAppStore((s) => s.updateCategory);
  const deleteCategory = useAppStore((s) => s.deleteCategory);
  const refreshMenuItemsAdmin = useAppStore((s) => s.refreshMenuItemsAdmin);
  const createSimpleCatalogItem = useAppStore((s) => s.createSimpleCatalogItem);
  const updateMenuItem = useAppStore((s) => s.updateMenuItem);
  const setMenuItemActiveAdmin = useAppStore((s) => s.setMenuItemActiveAdmin);
  const refreshCategoryModifierPools = useAppStore((s) => s.refreshCategoryModifierPools);
  const createCategoryModifierPool = useAppStore((s) => s.createCategoryModifierPool);
  const updateCategoryModifierPool = useAppStore((s) => s.updateCategoryModifierPool);
  const deleteCategoryModifierPool = useAppStore((s) => s.deleteCategoryModifierPool);
  return (
    <InventoryView
      inventory={[]}
      bomItems={[]}
      menuItems={menuItemsAdmin}
      categories={categories.filter((entry) => entry.scope === 'menu')}
      categoryModifierPools={categoryModifierPools}
      onRefreshCategories={() => refreshCategories('menu')}
      onCreateCategory={(payload) => createCategory({ ...payload, scope: 'menu' })}
      onUpdateCategory={updateCategory}
      onDeleteCategory={deleteCategory}
      onRefreshMenu={refreshMenuItemsAdmin}
      onCreateMenuItem={(payload) => createSimpleCatalogItem(payload)}
      onUpdateMenuItem={updateMenuItem}
      onSetMenuItemActive={setMenuItemActiveAdmin}
      // Category modifier pools (e.g. MAXI) must be manageable in
      // simple_catalog too — the "Mod. Categoria" tab is in SIMPLE_TABS and
      // the API gates on RequiresAnyOfModules("inventory","simple_catalog").
      // Without these props the editor rendered empty and "Crea Pool" no-oped.
      onRefreshCategoryModifierPools={refreshCategoryModifierPools}
      onCreateCategoryModifierPool={createCategoryModifierPool}
      onUpdateCategoryModifierPool={updateCategoryModifierPool}
      onDeleteCategoryModifierPool={deleteCategoryModifierPool}
      simpleCatalogMode
      loading={loading}
      error={error}
      onClearError={clearError}
      onRetryAll={() => { clearError(); void refreshAllData(); }}
    />
  );
}

export function DashboardRoute() {
  const data = useAppStore((s) => s.data);
  const orderHistory = useAppStore((s) => s.orderHistory);
  const customers = useAppStore((s) => s.customers);
  const customerAnalytics = useAppStore((s) => s.customerAnalytics);
  const refreshOrderHistory = useAppStore((s) => s.refreshOrderHistory);
  const refreshCustomerAnalytics = useAppStore((s) => s.refreshCustomerAnalytics);
  const voidOrder = useAppStore((s) => s.voidOrder);
  const enabledModules = useAppStore((s) => s.enabledModules);
  const currentUser = useAppStore((s) => s.currentUser);
  const { reservationsSummary, deliverySummary, refreshOperationalSummaries } = useBackofficeContext();
  const navigate = useNavigate();
  if (!data || !currentUser) return null;
  const canVoidOrders = enabledModules.includes('kitchen') &&
    (currentUser.role === 'admin' || currentUser.permissions?.includes('orders:void'));
  return (
    <DashboardView
      data={data}
      orderHistory={orderHistory}
      customers={customers}
      customerAnalytics={customerAnalytics}
      onRefreshOrderHistory={refreshOrderHistory}
      onRefreshCustomerAnalytics={refreshCustomerAnalytics}
      onVoidOrder={voidOrder}
      reservationsSummary={reservationsSummary}
      deliverySummary={deliverySummary}
      onRefreshOperationalSummaries={refreshOperationalSummaries}
      canVoidOrders={canVoidOrders}
      onViewCustomer={(customerId) => navigate(`/app/customers/${customerId}`)}
    />
  );
}

export function SettingsRoute() {
  const uiSettings = useAppStore((s) => s.uiSettings);
  const staffAdmin = useAppStore((s) => s.staffAdmin);
  const loading = useAppStore((s) => s.loading);
  const payments = useAppStore((s) => s.payments);
  const printJobs = useAppStore((s) => s.printJobs);
  const refreshUiSettings = useAppStore((s) => s.refreshUiSettings);
  const updateUiSettings = useAppStore((s) => s.updateUiSettings);
  const updatePrintingSettings = useAppStore((s) => s.updatePrintingSettings);
  const refreshStaffAdmin = useAppStore((s) => s.refreshStaffAdmin);
  const createStaffAdmin = useAppStore((s) => s.createStaffAdmin);
  const updateStaffAdmin = useAppStore((s) => s.updateStaffAdmin);
  const resetStaffPinAdmin = useAppStore((s) => s.resetStaffPinAdmin);
  const setStaffActiveAdmin = useAppStore((s) => s.setStaffActiveAdmin);
  const refreshPayments = useAppStore((s) => s.refreshPayments);
  const refundPayment = useAppStore((s) => s.refundPayment);
  const refreshPrintJobs = useAppStore((s) => s.refreshPrintJobs);
  const dispatchPrintJob = useAppStore((s) => s.dispatchPrintJob);
  const data = useAppStore((s) => s.data);
  const refreshTables = useAppStore((s) => s.refreshTables);
  const createTable = useAppStore((s) => s.createTable);
  const bulkCreateTables = useAppStore((s) => s.bulkCreateTables);
  const updateTable = useAppStore((s) => s.updateTable);
  const deleteTable = useAppStore((s) => s.deleteTable);
  return (
    <SettingsView
      settings={uiSettings}
      staff={staffAdmin}
      loading={loading}
      payments={payments}
      printJobs={printJobs}
      onRefreshSettings={refreshUiSettings}
      onUpdateSettings={updateUiSettings}
      onUpdatePrintingSettings={updatePrintingSettings}
      onRefreshStaff={refreshStaffAdmin}
      onCreateStaff={createStaffAdmin}
      onUpdateStaff={updateStaffAdmin}
      onResetStaffPin={resetStaffPinAdmin}
      onSetStaffActive={setStaffActiveAdmin}
      onRefreshPayments={refreshPayments}
      onRefundPayment={refundPayment}
      onRefreshPrintJobs={() => refreshPrintJobs({ limit: 100 })}
      onDispatchPrintJob={dispatchPrintJob}
      tables={(data?.tables ?? []).filter((table) => !table.isVirtual)}
      onRefreshTables={refreshTables}
      onCreateTable={createTable}
      onBulkCreateTables={bulkCreateTables}
      onUpdateTable={updateTable}
      onDeleteTable={deleteTable}
    />
  );
}

export function ReservationsRoute() {
  return <ReservationsView />;
}

export function DeliveryRoute() {
  return <DeliveryView />;
}

export function PurchasingRoute() {
  return <PurchasingView />;
}

export function ShiftsRoute() {
  const currentUser = useAppStore((s) => s.currentUser);
  if (!currentUser) return null;
  return <ShiftsView currentUserId={currentUser.id} />;
}

export function FiscalRoute() {
  return <FiscalExportsView />;
}

export function CustomersRoute() {
  const customers = useAppStore((s) => s.customers);
  const customerAnalytics = useAppStore((s) => s.customerAnalytics);
  const refreshCustomers = useAppStore((s) => s.refreshCustomers);
  const refreshCustomerAnalytics = useAppStore((s) => s.refreshCustomerAnalytics);
  const createOrReuseCustomer = useAppStore((s) => s.createOrReuseCustomer);
  const updateCustomer = useAppStore((s) => s.updateCustomer);
  const deleteCustomer = useAppStore((s) => s.deleteCustomer);
  return (
    <CustomersView
      customers={customers}
      customerAnalytics={customerAnalytics}
      onRefreshCustomers={refreshCustomers}
      onRefreshCustomerAnalytics={refreshCustomerAnalytics}
      onCreateCustomer={createOrReuseCustomer}
      onUpdateCustomer={updateCustomer}
      onDeleteCustomer={deleteCustomer}
    />
  );
}

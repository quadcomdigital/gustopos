import type { ModuleKey } from '@gustopos/shared';

export type UiActionKey =
  | 'ordersUpdate'
  | 'ordersVoid'
  | 'tablesPay'
  | 'printingDispatch'
  | 'paymentsRefund'
  | 'fiscalClose'
  | 'fiscalExport'
  | 'settingsUpdate'
  | 'staffManage'
  | 'loyaltyManage'
  | 'customersView'
  | 'customersManage'
  | 'inventoryManage'
  | 'purchasingManage'
  | 'shiftsManage'
  | 'reservationsManage'
  | 'deliveryManage';

export interface UiActionPolicy {
  action: UiActionKey;
  endpoint: string;
  module: ModuleKey | null;
  roles: Array<'admin' | 'waiter' | 'chef'>;
  permission: string;
}

export const uiActionPolicyMatrix: Record<UiActionKey, UiActionPolicy> = {
  ordersUpdate: {
    action: 'ordersUpdate',
    endpoint: 'PATCH /api/orders/:id',
    module: 'kitchen',
    roles: ['admin', 'chef', 'waiter'],
    permission: 'orders:update',
  },
  ordersVoid: {
    action: 'ordersVoid',
    endpoint: 'POST /api/orders/:id/void',
    module: 'kitchen',
    roles: ['admin', 'waiter'],
    permission: 'orders:void',
  },
  tablesPay: {
    action: 'tablesPay',
    endpoint: 'POST /api/tables/:id/pay',
    module: 'kitchen',
    roles: ['admin', 'waiter'],
    permission: 'tables:pay',
  },
  printingDispatch: {
    action: 'printingDispatch',
    endpoint: 'POST /api/print-jobs/:id/dispatch',
    module: 'printing',
    roles: ['admin', 'chef'],
    permission: 'printing:dispatch',
  },
  paymentsRefund: {
    action: 'paymentsRefund',
    endpoint: 'POST /api/payments/:id/refund',
    module: 'analytics',
    roles: ['admin'],
    permission: 'payments:refund',
  },
  fiscalClose: {
    action: 'fiscalClose',
    endpoint: 'POST /api/fiscal/close-day',
    module: 'fiscal_exports',
    roles: ['admin'],
    permission: 'fiscal:close',
  },
  fiscalExport: {
    action: 'fiscalExport',
    endpoint: 'POST /api/fiscal/exports',
    module: 'fiscal_exports',
    roles: ['admin'],
    permission: 'fiscal:export',
  },
  settingsUpdate: {
    action: 'settingsUpdate',
    endpoint: 'PATCH /api/settings',
    module: null,
    roles: ['admin'],
    permission: 'settings:update',
  },
  staffManage: {
    action: 'staffManage',
    endpoint: 'POST/PATCH /api/staff/*',
    module: 'kitchen',
    roles: ['admin'],
    permission: 'staff:manage',
  },
  loyaltyManage: {
    action: 'loyaltyManage',
    endpoint: 'POST /api/loyalty/earn|redeem',
    module: 'loyalty_points',
    roles: ['admin', 'waiter'],
    permission: 'loyalty:manage',
  },
  customersView: {
    action: 'customersView',
    endpoint: 'GET /api/customers',
    module: 'customers',
    roles: ['admin', 'waiter'],
    permission: 'customers:view',
  },
  customersManage: {
    action: 'customersManage',
    endpoint: 'POST/PATCH/DELETE /api/customers/*',
    module: 'customers',
    roles: ['admin', 'waiter'],
    permission: 'customers:manage',
  },
  inventoryManage: {
    action: 'inventoryManage',
    endpoint: 'POST/PATCH/DELETE /api/inventory|menu|categories/*',
    module: 'inventory',
    roles: ['admin', 'chef'],
    permission: 'inventory:manage',
  },
  purchasingManage: {
    action: 'purchasingManage',
    endpoint: 'POST/PATCH/DELETE /api/purchasing/*',
    module: 'purchasing_suppliers',
    roles: ['admin'],
    permission: 'purchasing:manage',
  },
  shiftsManage: {
    action: 'shiftsManage',
    endpoint: 'POST/PATCH /api/shifts/*',
    module: 'staff_shifts_timeclock',
    roles: ['admin'],
    permission: 'shifts:manage',
  },
  reservationsManage: {
    action: 'reservationsManage',
    endpoint: 'POST/PATCH /api/reservations/*',
    module: 'reservations',
    roles: ['admin', 'waiter'],
    permission: 'reservations:manage',
  },
  deliveryManage: {
    action: 'deliveryManage',
    endpoint: 'POST/PATCH /api/delivery/*',
    module: 'delivery',
    roles: ['admin', 'waiter'],
    permission: 'delivery:manage',
  },
};

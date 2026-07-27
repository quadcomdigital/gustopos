import type { ModuleKey, Staff } from '@gustopos/shared';

export type BackofficeRouteKey =
  | 'dashboard'
  | 'tables'
  | 'pos'
  | 'kitchen'
  | 'inventory'
  | 'simple-catalog'
  | 'reservations'
  | 'delivery'
  | 'purchasing'
  | 'shifts'
  | 'fiscal'
  | 'settings'
  | 'customers';

type RoleKey = 'admin' | 'waiter' | 'chef';

export interface BackofficeRouteMeta {
  key: BackofficeRouteKey;
  path: string;
  label: string;
  roles: RoleKey[];
  module: ModuleKey | null;
  permission?: string;
}

export const BACKOFFICE_ROUTES: BackofficeRouteMeta[] = [
  { key: 'dashboard', path: '/app/dashboard', label: 'Dashboard', roles: ['admin'], module: 'analytics' },
  { key: 'tables', path: '/app/tables', label: 'Tavoli', roles: ['admin', 'waiter'], module: 'kitchen' },
  { key: 'pos', path: '/app/pos', label: 'Cassa', roles: ['admin', 'waiter'], module: 'kitchen' },
  { key: 'kitchen', path: '/app/kitchen', label: 'Cucina', roles: ['admin', 'chef', 'waiter'], module: 'kitchen' },
  { key: 'inventory', path: '/app/inventory', label: 'Magazzino', roles: ['admin', 'chef'], module: 'inventory' },
  { key: 'simple-catalog', path: '/app/simple-catalog', label: 'Catalogo', roles: ['admin', 'chef'], module: 'simple_catalog' },
  { key: 'reservations', path: '/app/reservations', label: 'Prenotazioni', roles: ['admin', 'waiter'], module: 'reservations' },
  { key: 'delivery', path: '/app/delivery', label: 'Delivery', roles: ['admin', 'waiter'], module: 'delivery' },
  { key: 'purchasing', path: '/app/purchasing', label: 'Acquisti', roles: ['admin'], module: 'purchasing_suppliers' },
  { key: 'shifts', path: '/app/shifts', label: 'Turni', roles: ['admin'], module: 'staff_shifts_timeclock' },
  { key: 'fiscal', path: '/app/fiscal', label: 'Fiscale', roles: ['admin'], module: 'fiscal_exports' },
  { key: 'customers', path: '/app/customers', label: 'Clienti', roles: ['admin', 'waiter'], module: 'customers' },
  { key: 'settings', path: '/app/settings', label: 'Impostazioni', roles: ['admin'], module: null },
];

const RESERVED_PATH_SEGMENTS = ['app', 'superadmin', 'api', 'socket.io', 'assets', 'signing'];

export function resolveTenantSlugFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/([a-zA-Z0-9_-]+)(?:\/|$)/);
  if (match?.[1] && !RESERVED_PATH_SEGMENTS.includes(match[1])) {
    return match[1];
  }
  return null;
}

function stripTenantPrefix(pathname: string): string {
  const slug = resolveTenantSlugFromPath(pathname);
  if (slug) {
    return pathname.slice(1 + slug.length) || '/';
  }
  return pathname;
}

export function normalizeEffectiveModules(enabledModules: ModuleKey[]): ModuleKey[] {
  let result = enabledModules;
  if (result.includes('inventory')) {
    result = result.filter((moduleKey) => moduleKey !== 'simple_catalog');
  }
  if (!result.includes('customers')) {
    result = result.filter((moduleKey) => moduleKey !== 'loyalty_points');
  }
  return result;
}

export function getRouteByKey(routeKey: BackofficeRouteKey): BackofficeRouteMeta {
  const route = BACKOFFICE_ROUTES.find((entry) => entry.key === routeKey);
  if (!route) {
    throw new Error(`Unknown backoffice route ${routeKey}`);
  }
  return route;
}

export function getTenantRoutePath(routeKey: BackofficeRouteKey, tenantSlug?: string): string {
  const route = getRouteByKey(routeKey);
  return tenantSlug ? `/${tenantSlug}${route.path}` : route.path;
}

export function getRouteByPath(pathname: string): BackofficeRouteMeta | null {
  const stripped = stripTenantPrefix(pathname).replace(/\/+$/, '');
  const exact = BACKOFFICE_ROUTES.find((entry) => entry.path === stripped);
  if (exact) return exact;
  return BACKOFFICE_ROUTES.find((entry) => entry.path !== '/' && stripped.startsWith(entry.path + '/')) ?? null;
}

export function canAccessRoute(
  route: BackofficeRouteMeta,
  user: Staff | null,
  enabledModules: ModuleKey[],
): boolean {
  if (!user) {
    return false;
  }
  const role = user.role.toLowerCase() as RoleKey;
  if (role !== 'admin' && !route.roles.includes(role)) {
    return false;
  }
  if (route.module && !enabledModules.includes(route.module)) {
    return false;
  }
  if (route.permission && role !== 'admin' && !(user.permissions ?? []).includes(route.permission)) {
    return false;
  }
  return true;
}

export function getAccessibleRoutes(user: Staff | null, enabledModules: ModuleKey[]): BackofficeRouteMeta[] {
  return BACKOFFICE_ROUTES.filter((route) => canAccessRoute(route, user, enabledModules));
}

export function getDefaultRoute(user: Staff | null, routes: BackofficeRouteMeta[]): BackofficeRouteMeta | null {
  if (routes.length === 0) {
    return null;
  }
  const preferredKey: BackofficeRouteKey = user?.role === 'chef'
    ? 'kitchen'
    : user?.role === 'waiter'
      ? 'tables'
      : 'dashboard';
  return routes.find((route) => route.key === preferredKey) ?? routes[0];
}

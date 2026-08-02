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

// Mobile IA grouping for the secondary-module sheet (UX-001).
export type RouteDomain = 'operations' | 'finance' | 'admin';

export interface BackofficeRouteMeta {
  key: BackofficeRouteKey;
  path: string;
  label: string;
  roles: RoleKey[];
  module: ModuleKey | null;
  permission?: string;
  domain: RouteDomain;
}

export const BACKOFFICE_ROUTES: BackofficeRouteMeta[] = [
  { key: 'dashboard', path: '/app/dashboard', label: 'Dashboard', roles: ['admin'], module: 'analytics', domain: 'finance' },
  { key: 'tables', path: '/app/tables', label: 'Tavoli', roles: ['admin', 'waiter'], module: 'kitchen', domain: 'operations' },
  { key: 'pos', path: '/app/pos', label: 'Cassa', roles: ['admin', 'waiter'], module: 'kitchen', domain: 'operations' },
  { key: 'kitchen', path: '/app/kitchen', label: 'Cucina', roles: ['admin', 'chef', 'waiter'], module: 'kitchen', domain: 'operations' },
  { key: 'inventory', path: '/app/inventory', label: 'Magazzino', roles: ['admin', 'chef'], module: 'inventory', domain: 'operations' },
  { key: 'simple-catalog', path: '/app/simple-catalog', label: 'Catalogo', roles: ['admin', 'chef'], module: 'simple_catalog', domain: 'operations' },
  { key: 'reservations', path: '/app/reservations', label: 'Prenotazioni', roles: ['admin', 'waiter'], module: 'reservations', domain: 'operations' },
  { key: 'delivery', path: '/app/delivery', label: 'Delivery', roles: ['admin', 'waiter'], module: 'delivery', domain: 'operations' },
  { key: 'purchasing', path: '/app/purchasing', label: 'Acquisti', roles: ['admin'], module: 'purchasing_suppliers', domain: 'operations' },
  { key: 'shifts', path: '/app/shifts', label: 'Turni', roles: ['admin'], module: 'staff_shifts_timeclock', domain: 'operations' },
  { key: 'fiscal', path: '/app/fiscal', label: 'Fiscale', roles: ['admin'], module: 'fiscal_exports', domain: 'finance' },
  { key: 'customers', path: '/app/customers', label: 'Clienti', roles: ['admin', 'waiter'], module: 'customers', domain: 'operations' },
  { key: 'settings', path: '/app/settings', label: 'Impostazioni', roles: ['admin'], module: null, domain: 'admin' },
];

const LAST_MODULE_KEY = 'gustopos:last-module';

export function rememberLastModule(routeKey: BackofficeRouteKey): void {
  try {
    localStorage.setItem(LAST_MODULE_KEY, routeKey);
  } catch {
    // Storage can be unavailable (private mode); last-module is a nice-to-have.
  }
}

export function getLastModuleRouteKey(): BackofficeRouteKey | null {
  try {
    const stored = localStorage.getItem(LAST_MODULE_KEY);
    return stored && (BACKOFFICE_ROUTES.some((route) => route.key === stored as BackofficeRouteKey))
      ? stored as BackofficeRouteKey
      : null;
  } catch {
    return null;
  }
}

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
  // UX-001: restore the last opened module when it is still accessible,
  // so operators land where they left off instead of on the role default.
  const lastModuleKey = getLastModuleRouteKey();
  if (lastModuleKey) {
    const lastRoute = routes.find((route) => route.key === lastModuleKey);
    if (lastRoute) {
      return lastRoute;
    }
  }
  const preferredKey: BackofficeRouteKey = user?.role === 'chef'
    ? 'kitchen'
    : user?.role === 'waiter'
      ? 'tables'
      : 'dashboard';
  return routes.find((route) => route.key === preferredKey) ?? routes[0];
}

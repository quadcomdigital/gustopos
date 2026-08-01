import { Navigate, useLocation } from 'react-router-dom';
import type { ReactElement } from 'react';
import { useAppStore } from '../../store/app-store';
import {
  type BackofficeRouteKey,
  canAccessRoute,
  getAccessibleRoutes,
  getDefaultRoute,
  getRouteByKey,
  normalizeEffectiveModules,
} from './route-guards';

interface BackofficeRouteGuardProps {
  routeKey: BackofficeRouteKey;
  children: ReactElement;
}

export default function BackofficeRouteGuard({ routeKey, children }: BackofficeRouteGuardProps) {
  const location = useLocation();
  const currentUser = useAppStore((state) => state.currentUser);
  const enabledModules = useAppStore((state) => state.enabledModules);
  if (!currentUser) {
    return <Navigate to="/" replace />;
  }
  const effectiveModules = normalizeEffectiveModules(enabledModules);
  const route = getRouteByKey(routeKey);
  if (canAccessRoute(route, currentUser, effectiveModules)) {
    return children;
  }
  const accessibleRoutes = getAccessibleRoutes(currentUser, effectiveModules);
  const fallbackRoute = getDefaultRoute(currentUser, accessibleRoutes);
  if (!fallbackRoute) {
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }
  return <Navigate to={fallbackRoute.path} replace state={{ from: location.pathname }} />;
}

import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import LoginView from '../../components/LoginView';
import BackofficeShell from './BackofficeShell';
import { BackofficeContextProvider } from './BackofficeContext';
import {
  type BackofficeRouteKey,
  getAccessibleRoutes,
  getDefaultRoute,
  getRouteByPath,
  getTenantRoutePath,
  resolveTenantSlugFromPath,
  normalizeEffectiveModules,
} from './route-guards';
import { useBackofficeSessionLifecycle } from './hooks/useBackofficeSessionLifecycle';
import { useOperationalSummaries } from './hooks/useOperationalSummaries';
import { useImpersonationExit } from './hooks/useImpersonationExit';
import { useAppStore } from '../../store/app-store';
import BridgeWorker from "../../components/print/BridgeWorker";

export default function BackofficeEntry() {
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedTable, setSelectedTable] = useState<string | null>(null);

  // Individual selectors to prevent unnecessary re-renders
  const data = useAppStore((s) => s.data);
  const loading = useAppStore((s) => s.loading);
  const staff = useAppStore((s) => s.staff);
  const currentUser = useAppStore((s) => s.currentUser);
  const enabledModules = useAppStore((s) => s.enabledModules);
  const offlineQueue = useAppStore((s) => s.offlineQueue);
  const hydrate = useAppStore((s) => s.hydrate);
  const syncSessionModules = useAppStore((s) => s.syncSessionModules);
  const loginWithPin = useAppStore((s) => s.loginWithPin);
  const logout = useAppStore((s) => s.logout);
  const orderHistory = useAppStore((s) => s.orderHistory);
  const uiSettings = useAppStore((s) => s.uiSettings);

  const { isOnline } = useBackofficeSessionLifecycle({
    currentUser,
    hydrate,
    syncSessionModules,
  });
  const {
    reservationsSummary,
    deliverySummary,
    refreshOperationalSummaries,
  } = useOperationalSummaries({ currentUser, enabledModules });
  const {
    hasImpersonationSnapshot,
    exitImpersonation,
  } = useImpersonationExit({
    currentTenantId: currentUser?.tenantId,
    onSuperadminReady: () => navigate('/superadmin', { replace: true }),
  });

  useEffect(() => {
    if (window.location.pathname === '/' && localStorage.getItem('gustopos:superadmin:return') === '1') {
      localStorage.removeItem('gustopos:superadmin:return');
      navigate('/superadmin', { replace: true });
    }
  }, [navigate]);

  const effectiveModules = normalizeEffectiveModules(enabledModules);
  const accessibleRoutes = getAccessibleRoutes(currentUser, effectiveModules);
  const activeRoute = getRouteByPath(location.pathname);
  const defaultRoute = getDefaultRoute(currentUser, accessibleRoutes);
  const tenantSlug = resolveTenantSlugFromPath(location.pathname) ?? undefined;

  useEffect(() => {
    if (!currentUser || !defaultRoute) {
      return;
    }
    if (location.pathname === '/' || location.pathname === '/app' || location.pathname === '/app/') {
      navigate(getTenantRoutePath(defaultRoute.key, tenantSlug), { replace: true });
      return;
    }
    if (location.pathname === `/${tenantSlug}` || location.pathname === `/${tenantSlug}/`) {
      navigate(getTenantRoutePath(defaultRoute.key, tenantSlug), { replace: true });
      return;
    }
    const isBackofficePath = location.pathname.startsWith('/app/') || (tenantSlug && location.pathname.startsWith(`/${tenantSlug}/app/`));
    if (isBackofficePath && (!activeRoute || !accessibleRoutes.some((route) => route.key === activeRoute.key))) {
      navigate(getTenantRoutePath(defaultRoute.key, tenantSlug), { replace: true });
    }
  }, [currentUser, defaultRoute, location.pathname, activeRoute, accessibleRoutes, navigate, tenantSlug]);

  const handleLogin = async (staffId: string, pin: string) => loginWithPin(staffId, pin);
  const handleLogout = () => {
    logout();
    setSelectedTable(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-bg">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin" />
          <p className="text-text-muted font-medium animate-pulse">Caricamento GustoPOS...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginView staff={staff} onLogin={handleLogin} />;
  }

  if (!data) {
    return (
      <BackofficeContextProvider
        value={{
          selectedTable,
          setSelectedTable,
          reservationsSummary,
          deliverySummary,
          refreshOperationalSummaries,
        }}
      >
      <BackofficeShell
          uiBrandName={uiSettings?.brandName ?? ''}
          userName={currentUser.name}
          userTenantId={currentUser.tenantId}
          isOnline={isOnline}
          offlineQueueCount={offlineQueue.length}
          hasImpersonationSnapshot={hasImpersonationSnapshot}
          onExitImpersonation={() => void exitImpersonation()}
          onLogout={handleLogout}
          pendingOrdersCount={0}
          orderHistoryCount={orderHistory.length}
          analyticsEnabled={enabledModules.includes('analytics')}
          routes={accessibleRoutes}
          activeRouteKey={(activeRoute?.key ?? defaultRoute?.key ?? 'dashboard') as BackofficeRouteKey}
          onNavigate={(routeKey) => navigate(getTenantRoutePath(routeKey, tenantSlug))}
          reservationsPending={reservationsSummary?.pending ?? 0}
          deliveryActive={deliverySummary?.active ?? 0}
        >
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin" />
              <p className="text-text-muted text-sm font-medium animate-pulse">Sincronizzazione dati...</p>
            </div>
          </div>
        </BackofficeShell>
      </BackofficeContextProvider>
    );
  }

  const pendingOrdersCount = data.orders.filter((o) => o.status !== 'served' && o.status !== 'paid' && o.status !== 'cancelled').length;
  if (accessibleRoutes.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen bg-bg">
        <div className="bg-white border border-border rounded-xl p-6 max-w-lg w-full text-center space-y-3">
          <h2 className="text-xl font-bold text-primary">Nessun modulo operativo abilitato</h2>
          <p className="text-sm text-text-muted">
            Per questo tenant non risultano moduli attivi compatibili con il tuo ruolo. Contatta il Superadmin per abilitare
            i moduli necessari.
          </p>
          <button
            onClick={handleLogout}
            className="px-4 py-2 rounded bg-primary text-white text-xs font-bold uppercase tracking-wider"
          >
            Esci
          </button>
        </div>
      </div>
    );
  }

  return (
    <BackofficeContextProvider
      value={{
        selectedTable,
        setSelectedTable,
        reservationsSummary,
        deliverySummary,
        refreshOperationalSummaries,
      }}
    >
      {/* Browser-side printing is handled by the print-bridge BridgeWorker.
          The standalone print-bridge server (port 11905) and the manual
          Dispatch flow in Settings still operate independently. */}
      <BridgeWorker />
      <BackofficeShell
        uiBrandName={uiSettings.brandName}
        userName={currentUser.name}
        userTenantId={currentUser.tenantId}
        isOnline={isOnline}
        offlineQueueCount={offlineQueue.length}
        hasImpersonationSnapshot={hasImpersonationSnapshot}
        onExitImpersonation={() => void exitImpersonation()}
        onLogout={handleLogout}
        pendingOrdersCount={pendingOrdersCount}
        orderHistoryCount={orderHistory.length}
        analyticsEnabled={enabledModules.includes('analytics')}
        routes={accessibleRoutes}
        activeRouteKey={(activeRoute?.key ?? defaultRoute?.key ?? 'dashboard') as BackofficeRouteKey}
        onNavigate={(routeKey) => navigate(getTenantRoutePath(routeKey, tenantSlug))}
        reservationsPending={reservationsSummary?.pending ?? 0}
        deliveryActive={deliverySummary?.active ?? 0}
      />
    </BackofficeContextProvider>
  );
}

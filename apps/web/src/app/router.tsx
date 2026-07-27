import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import App from '../App';
import BackofficeRouteGuard from './backoffice/BackofficeRouteGuard';
import {
  DashboardRoute,
  DeliveryRoute,
  FiscalRoute,
  InventoryRoute,
  KitchenRoute,
  PosRoute,
  PurchasingRoute,
  ReservationsRoute,
  SettingsRoute,
  ShiftsRoute,
  SimpleCatalogRoute,
  TablesRoute,
  CustomersRoute,
} from './backoffice/routes/module-routes';

const SuperadminPage = lazy(() => import('../pages/SuperadminPage'));
const PublicSelfOrderPage = lazy(() => import('../pages/PublicSelfOrderPage'));
const PublicGroupOrderPage = lazy(() => import('../pages/PublicGroupOrderPage'));
const PublicReservationPage = lazy(() => import('../pages/PublicReservationPage'));
const TenantMenuPage = lazy(() => import('../pages/TenantMenuPage'));
const ConsumerAuthPage = lazy(() => import('../pages/ConsumerAuthPage'));
const ConsumerOrdersPage = lazy(() => import('../pages/ConsumerOrdersPage'));
const CustomerDetailPage = lazy(() => import('../pages/CustomerDetailPage'));
const PublicTakeawayTrackingPage = lazy(() => import('../pages/PublicTakeawayTrackingPage'));

function PageFallback() {
  return (
    <div className="h-screen flex items-center justify-center">
      <div className="animate-pulse text-text-muted text-sm">Caricamento...</div>
    </div>
  );
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<App />} />
      <Route path="/app" element={<App />}>
        <Route index element={<Navigate to="/app/dashboard" replace />} />
        <Route path="dashboard" element={<BackofficeRouteGuard routeKey="dashboard"><DashboardRoute /></BackofficeRouteGuard>} />
        <Route path="tables" element={<BackofficeRouteGuard routeKey="tables"><TablesRoute /></BackofficeRouteGuard>} />
        <Route path="pos" element={<BackofficeRouteGuard routeKey="pos"><PosRoute /></BackofficeRouteGuard>} />
        <Route path="kitchen" element={<BackofficeRouteGuard routeKey="kitchen"><KitchenRoute /></BackofficeRouteGuard>} />
        <Route path="inventory" element={<BackofficeRouteGuard routeKey="inventory"><InventoryRoute /></BackofficeRouteGuard>} />
        <Route path="simple-catalog" element={<BackofficeRouteGuard routeKey="simple-catalog"><SimpleCatalogRoute /></BackofficeRouteGuard>} />
        <Route path="reservations" element={<BackofficeRouteGuard routeKey="reservations"><ReservationsRoute /></BackofficeRouteGuard>} />
        <Route path="delivery" element={<BackofficeRouteGuard routeKey="delivery"><DeliveryRoute /></BackofficeRouteGuard>} />
        <Route path="purchasing" element={<BackofficeRouteGuard routeKey="purchasing"><PurchasingRoute /></BackofficeRouteGuard>} />
        <Route path="shifts" element={<BackofficeRouteGuard routeKey="shifts"><ShiftsRoute /></BackofficeRouteGuard>} />
        <Route path="fiscal" element={<BackofficeRouteGuard routeKey="fiscal"><FiscalRoute /></BackofficeRouteGuard>} />
        <Route path="customers" element={<BackofficeRouteGuard routeKey="customers"><CustomersRoute /></BackofficeRouteGuard>} />
        <Route path="settings" element={<BackofficeRouteGuard routeKey="settings"><SettingsRoute /></BackofficeRouteGuard>} />
        <Route path="customers/:customerId" element={<BackofficeRouteGuard routeKey="customers"><Suspense fallback={<PageFallback />}><CustomerDetailPage /></Suspense></BackofficeRouteGuard>} />
      </Route>

      <Route path="/superadmin" element={<Suspense fallback={<PageFallback />}><SuperadminPage /></Suspense>} />
      <Route path="/superadmin/*" element={<Suspense fallback={<PageFallback />}><SuperadminPage /></Suspense>} />

      <Route path="/:tenantSlug" element={<App />}>
        <Route index element={<Navigate to="app" replace />} />
        <Route path="app">
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<BackofficeRouteGuard routeKey="dashboard"><DashboardRoute /></BackofficeRouteGuard>} />
          <Route path="tables" element={<BackofficeRouteGuard routeKey="tables"><TablesRoute /></BackofficeRouteGuard>} />
          <Route path="pos" element={<BackofficeRouteGuard routeKey="pos"><PosRoute /></BackofficeRouteGuard>} />
          <Route path="kitchen" element={<BackofficeRouteGuard routeKey="kitchen"><KitchenRoute /></BackofficeRouteGuard>} />
          <Route path="inventory" element={<BackofficeRouteGuard routeKey="inventory"><InventoryRoute /></BackofficeRouteGuard>} />
          <Route path="simple-catalog" element={<BackofficeRouteGuard routeKey="simple-catalog"><SimpleCatalogRoute /></BackofficeRouteGuard>} />
          <Route path="reservations" element={<BackofficeRouteGuard routeKey="reservations"><ReservationsRoute /></BackofficeRouteGuard>} />
          <Route path="delivery" element={<BackofficeRouteGuard routeKey="delivery"><DeliveryRoute /></BackofficeRouteGuard>} />
          <Route path="purchasing" element={<BackofficeRouteGuard routeKey="purchasing"><PurchasingRoute /></BackofficeRouteGuard>} />
          <Route path="shifts" element={<BackofficeRouteGuard routeKey="shifts"><ShiftsRoute /></BackofficeRouteGuard>} />
          <Route path="fiscal" element={<BackofficeRouteGuard routeKey="fiscal"><FiscalRoute /></BackofficeRouteGuard>} />
          <Route path="customers" element={<BackofficeRouteGuard routeKey="customers"><CustomersRoute /></BackofficeRouteGuard>} />
          <Route path="settings" element={<BackofficeRouteGuard routeKey="settings"><SettingsRoute /></BackofficeRouteGuard>} />
          <Route path="customers/:customerId" element={<BackofficeRouteGuard routeKey="customers"><Suspense fallback={<PageFallback />}><CustomerDetailPage /></Suspense></BackofficeRouteGuard>} />
        </Route>
      </Route>

      <Route path="/:tenantSlug/menu" element={<Suspense fallback={<PageFallback />}><TenantMenuPage /></Suspense>} />
      <Route path="/:tenantSlug/menu/*" element={<Suspense fallback={<PageFallback />}><TenantMenuPage /></Suspense>} />
      <Route path="/:tenantSlug/reserve" element={<Suspense fallback={<PageFallback />}><PublicReservationPage /></Suspense>} />
      <Route path="/:tenantSlug/group-order/:joinCode" element={<Suspense fallback={<PageFallback />}><PublicGroupOrderPage /></Suspense>} />
      <Route path="/:tenantSlug/group-order/:joinCode/*" element={<Suspense fallback={<PageFallback />}><PublicGroupOrderPage /></Suspense>} />
      <Route path="/:tenantSlug/self-order/:token" element={<Suspense fallback={<PageFallback />}><PublicSelfOrderPage /></Suspense>} />
      <Route path="/:tenantSlug/self-order/:token/*" element={<Suspense fallback={<PageFallback />}><PublicSelfOrderPage /></Suspense>} />
      <Route path="/:tenantSlug/takeaway/track" element={<Suspense fallback={<PageFallback />}><PublicTakeawayTrackingPage /></Suspense>} />
      <Route path="/:tenantSlug/takeaway/track/*" element={<Suspense fallback={<PageFallback />}><PublicTakeawayTrackingPage /></Suspense>} />
      <Route path="/:tenantSlug/account" element={<Suspense fallback={<PageFallback />}><ConsumerAuthPage /></Suspense>} />
      <Route path="/:tenantSlug/account/orders" element={<Suspense fallback={<PageFallback />}><ConsumerOrdersPage /></Suspense>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

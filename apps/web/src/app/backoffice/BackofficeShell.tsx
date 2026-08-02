import { Suspense, useEffect, useMemo, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  BarChart3,
  ShoppingCart,
  ChefHat,
  Package,
  Settings,
  Utensils,
  CalendarDays,
  Bike,
  Truck,
  ClipboardCheck,
  Receipt,
  Users,
  Menu,
  X,
  LogOut,
  ChevronDown,
  Check,
  Search,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import ToastHost from '../../components/ToastHost';
import PwaInstallPrompt from '../../components/PwaInstallPrompt';
import { useAppStore } from '../../store/app-store';
import type { BackofficeRouteKey, BackofficeRouteMeta, RouteDomain } from './route-guards';

const DOMAIN_LABELS: Record<RouteDomain, string> = {
  operations: 'Operazioni',
  finance: 'Finanza',
  admin: 'Amministrazione',
};

const DOMAIN_ORDER: RouteDomain[] = ['operations', 'finance', 'admin'];

const ICONS: Record<BackofficeRouteKey, LucideIcon> = {
  dashboard: BarChart3,
  tables: Utensils,
  pos: ShoppingCart,
  kitchen: ChefHat,
  inventory: Package,
  'simple-catalog': Package,
  reservations: CalendarDays,
  delivery: Bike,
  purchasing: Truck,
  shifts: ClipboardCheck,
  fiscal: Receipt,
  customers: Users,
  settings: Settings,
};

interface BackofficeShellProps {
  uiBrandName: string;
  userName: string;
  userTenantId: string;
  isOnline: boolean;
  offlineQueueCount: number;
  hasImpersonationSnapshot: boolean;
  onExitImpersonation: () => void;
  onLogout: () => void;
  pendingOrdersCount: number;
  orderHistoryCount: number;
  analyticsEnabled: boolean;
  routes: BackofficeRouteMeta[];
  activeRouteKey: BackofficeRouteKey;
  onNavigate: (routeKey: BackofficeRouteKey) => void;
  reservationsPending: number;
  deliveryActive: number;
  children?: React.ReactNode;
}

export default function BackofficeShell(props: BackofficeShellProps) {
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [showModePicker, setShowModePicker] = useState(false);
  const [showTablePicker, setShowTablePicker] = useState(false);
  const posOrderMode = useAppStore((s) => s.posOrderMode);
  const posTableNumber = useAppStore((s) => s.posTableNumber);
  const posMenuSearch = useAppStore((s) => s.posMenuSearch);
  const data = useAppStore((s) => s.data);
  const {
    uiBrandName,
    userName,
    userTenantId,
    isOnline,
    offlineQueueCount,
    hasImpersonationSnapshot,
    onExitImpersonation,
    onLogout,
    pendingOrdersCount,
    orderHistoryCount,
    analyticsEnabled,
    routes,
    activeRouteKey,
    onNavigate,
    reservationsPending,
    deliveryActive,
    children,
  } = props;

  const [clock, setClock] = useState(() => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  useEffect(() => {
    const id = window.setInterval(() => {
      setClock(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }, 60_000);
    return () => window.clearInterval(id);
  }, []);

  const mobilePrimaryRouteKeys: BackofficeRouteKey[] = ['tables', 'pos', 'kitchen', 'dashboard'];
  const activeRoute = routes.find((route) => route.key === activeRouteKey) ?? null;

  const { mobilePrimaryRoutes, mobileExtraRoutes } = useMemo(() => {
    const preferredPrimaryRoutes = routes.filter((route) => mobilePrimaryRouteKeys.includes(route.key));
    const merged: BackofficeRouteMeta[] = [];
    for (const route of preferredPrimaryRoutes) {
      if (merged.length >= 4) break;
      merged.push(route);
    }
    if (activeRoute && !merged.some((route) => route.key === activeRoute.key)) {
      if (merged.length >= 4) {
        merged[merged.length - 1] = activeRoute;
      } else {
        merged.push(activeRoute);
      }
    }
    if (merged.length < 4) {
      for (const route of routes) {
        if (merged.length >= 4) break;
        if (!merged.some((entry) => entry.key === route.key)) {
          merged.push(route);
        }
      }
    }
    const primary = merged.length > 0 ? merged : routes.slice(0, 4);
    const extra = routes.filter((route) => !primary.some((entry) => entry.key === route.key));
    return { mobilePrimaryRoutes: primary, mobileExtraRoutes: extra };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- routes reference (outer-scope memoized Set/array) is stable; activeRoute is the only dynamic trigger
  }, [routes, activeRoute]);

  const renderRouteBadge = (routeKey: BackofficeRouteKey, mobile = false) => {
    if (routeKey === 'reservations' && reservationsPending > 0) {
      return (
        <span
          className={cn(
            'text-[9px] min-w-4 h-4 rounded-full bg-amber-500 text-white font-bold flex items-center justify-center px-1',
            mobile ? 'absolute top-1 right-3' : 'absolute -top-1 -right-1',
          )}
        >
          {reservationsPending}
        </span>
      );
    }
    if (routeKey === 'delivery' && deliveryActive > 0) {
      return (
        <span
          className={cn(
            'text-[9px] min-w-4 h-4 rounded-full bg-accent text-white font-bold flex items-center justify-center px-1',
            mobile ? 'absolute top-1 right-3' : 'absolute -top-1 -right-1 border border-white',
          )}
        >
          {deliveryActive}
        </span>
      );
    }
    return null;
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-bg text-text-main font-sans overflow-hidden">
      {!isOnline && (
        <div className="md:hidden bg-rose-500 text-white text-center py-1.5 px-4 text-[11px] font-bold uppercase tracking-wider shrink-0">
          ⚠ Offline — Le operazioni verranno accodate
        </div>
      )}
      <header className="h-14 md:h-16 bg-primary text-white flex items-center justify-between px-4 md:px-6 shadow-md z-50 shrink-0">
        {/* Left side: brand on desktop, POS pills on mobile */}
        <div className="flex items-center gap-2">
          {/* Desktop: brand name */}
          <div className="hidden md:flex font-bold text-lg md:text-xl tracking-wider items-center gap-2">
            {(uiBrandName || 'GUSTOPOS').toUpperCase()} <span className="font-light opacity-70 text-xs md:text-sm">| ENTERPRISE</span>
          </div>
          {/* POS pills (only when on POS route) — visible on mobile + tablet */}
          {activeRouteKey === 'pos' && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowModePicker(true)}
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] md:text-xs font-bold uppercase tracking-wider transition-all',
                  posOrderMode === 'dine_in' ? 'bg-white/20 text-white' :
                  posOrderMode === 'takeaway' ? 'bg-amber-400/30 text-amber-100' :
                  'bg-emerald-400/30 text-emerald-100',
                )}
              >
                {posOrderMode === 'dine_in' ? 'Sala' : posOrderMode === 'takeaway' ? 'Asporto' : 'Delivery'}
                <ChevronDown size={10} />
              </button>
              {posOrderMode === 'dine_in' && (
                <button
                  onClick={() => setShowTablePicker(true)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] md:text-xs font-bold bg-white/10 text-white/80 transition-all"
                >
                  Tavolo {posTableNumber}
                  <ChevronDown size={10} />
                </button>
              )}
            </div>
          )}
          {/* Mobile: brand name when not on POS */}
          {activeRouteKey !== 'pos' && (
            <div className="md:hidden font-bold text-lg tracking-wider">
              {(uiBrandName || 'GUSTOPOS').toUpperCase()}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 md:gap-4 text-[10px] md:text-xs">
          {/* POS: search bar — visible on mobile + tablet */}
          {activeRouteKey === 'pos' && (
            <div className="flex items-center flex-1 max-w-[200px]">
              <div className="relative w-full">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/50" />
                <input
                  value={posMenuSearch}
                  onChange={(e) => useAppStore.setState({ posMenuSearch: e.target.value })}
                  placeholder="Cerca..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-white/15 text-white text-xs placeholder:text-white/40 outline-none focus:bg-white/25 transition-colors"
                />
              </div>
            </div>
          )}
          {/* Desktop: online status */}
          <div className="hidden md:flex px-2 md:px-3 py-1 rounded-full bg-white/15 items-center gap-1 md:gap-2">
            <div className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full ${isOnline ? 'bg-green-400 animate-pulse' : 'bg-rose-400'}`} />
            <span>{isOnline ? 'Online' : 'Offline'}</span>
          </div>

          <div className="hidden md:flex px-2 md:px-3 py-1 rounded-full bg-white/15 items-center gap-1 md:gap-2">
            <span className="hidden md:inline">Ora:</span>
            {clock}
          </div>
          {offlineQueueCount > 0 && (
            <div className="px-2 md:px-3 py-1 rounded-full bg-amber-500/20 text-amber-100 flex items-center gap-1 md:gap-2">
              <span>⚠</span>
              <span className="hidden md:inline">Operazioni bloccate:</span>
              <strong>{offlineQueueCount}</strong>
            </div>
          )}
          <button
            onClick={onLogout}
            className={cn(
              'px-2 md:px-3 py-1 rounded-full bg-white/15 hover:bg-white/25 transition-colors flex items-center gap-1 md:gap-2',
              activeRouteKey === 'pos' && 'hidden md:flex',
            )}
            aria-label="Esci dal backoffice"
          >
            <span className="hidden md:inline">Esci:</span>
            <span className="font-bold max-w-20 truncate md:max-w-none">{userName}</span>
          </button>
          {hasImpersonationSnapshot && (
            <button
              onClick={onExitImpersonation}
              className="px-2 md:px-3 py-1 rounded-full bg-amber-500/20 hover:bg-amber-500/30 transition-colors flex items-center gap-1 md:gap-2 text-amber-100"
            >
              <span>↩</span>
              <span className="hidden md:inline">Esci impersonazione</span>
            </button>
          )}
        </div>
      </header>

      {hasImpersonationSnapshot && (
        <div className="bg-amber-100 border-b border-amber-300 px-4 py-2 text-[11px] md:text-xs text-amber-900 flex items-center justify-between gap-3">
          <span className="font-semibold">Sessione in impersonazione tenant ({userTenantId})</span>
          <button
            onClick={onExitImpersonation}
            className="px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 transition-colors font-bold"
          >
            Torna al Superadmin
          </button>
        </div>
      )}

      <div className="flex-1 min-h-0 flex overflow-hidden relative">
        <nav className="hidden md:flex w-20 bg-white border-r border-border flex-col items-center py-6 gap-6 z-40">
          {routes.map((route) => {
            const Icon = ICONS[route.key];
            const isActive = activeRouteKey === route.key;
            return (
              <button
                key={route.key}
                onClick={() => onNavigate(route.key)}
                onMouseEnter={() => {}}
                title={route.label}
                className={cn(
                  'w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200 relative',
                  isActive ? 'bg-accent text-white shadow-sm' : 'text-secondary hover:bg-bg',
                )}
              >
                <Icon size={22} />
                {renderRouteBadge(route.key)}
              </button>
            );
          })}
        </nav>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 pb-24 md:pb-6">
          <Suspense
            fallback={(
              <div className="flex items-center justify-center h-full text-text-muted">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm font-medium">Caricamento modulo...</p>
                </div>
              </div>
            )}
          >
            {children ?? <Outlet />}
          </Suspense>
        </div>
      </div>

      <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-border z-[999] flex shadow-[0_-4px_10px_rgba(0,0,0,0.1)]">
        {(mobilePrimaryRoutes.length > 0 ? mobilePrimaryRoutes : routes.slice(0, 4)).map((route) => {
          const Icon = ICONS[route.key];
          const isActive = activeRouteKey === route.key;
          return (
            <button
              key={route.key}
              onClick={() => onNavigate(route.key)}
              className={cn(
                'flex-1 flex flex-col items-center justify-center gap-1 transition-all relative',
                isActive ? 'text-accent bg-accent/5' : 'text-text-muted hover:bg-gray-50',
              )}
            >
              <Icon size={22} className={cn('transition-transform', isActive && 'scale-110')} />
              <span className="text-[8px] font-bold uppercase tracking-tighter text-center px-0.5">{route.label}</span>
              {renderRouteBadge(route.key, true)}
              {isActive && <div className="absolute top-0 left-0 right-0 h-0.5 bg-accent" />}
            </button>
          );
        })}
        <button
          onClick={() => setIsMoreOpen(true)}
          aria-label="Apri menu moduli aggiuntivi"
          className={cn(
            'flex-1 flex flex-col items-center justify-center gap-1 transition-all border-l border-border',
            isMoreOpen ? 'text-accent bg-accent/5' : 'text-text-muted hover:bg-gray-50',
          )}
        >
          <Menu size={22} />
          <span className="text-[8px] font-bold uppercase tracking-tighter">Altro</span>
        </button>
      </div>

      {isMoreOpen && (
        <div className="md:hidden fixed inset-0 z-[1100] flex items-end">
          <button className="absolute inset-0 bg-black/40" onClick={() => setIsMoreOpen(false)} aria-label="Chiudi menu altro" />
          <div className="relative w-full bg-white rounded-t-2xl border-t border-border shadow-2xl p-4 max-h-[70dvh] overflow-auto">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold uppercase tracking-wider text-text-muted">Altri moduli</p>
              <button onClick={() => setIsMoreOpen(false)} className="min-w-[44px] min-h-[44px] flex items-center justify-center p-2 rounded border border-border">
                <X size={16} />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-4">
              {DOMAIN_ORDER.map((domain) => {
                const domainRoutes = mobileExtraRoutes.filter((route) => route.domain === domain);
                if (domainRoutes.length === 0) {
                  return null;
                }
                return (
                  <div key={domain} className="space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted px-1">{DOMAIN_LABELS[domain]}</p>
                    <div className="grid grid-cols-1 gap-2">
                      {domainRoutes.map((route) => {
                        const Icon = ICONS[route.key];
                        const isActive = activeRouteKey === route.key;
                        return (
                          <button
                            key={`more-${route.key}`}
                            onClick={() => {
                              onNavigate(route.key);
                              setIsMoreOpen(false);
                            }}
                            className={cn(
                              'w-full px-3 py-3 rounded-lg border text-left flex items-center justify-between gap-3',
                              isActive ? 'bg-accent/10 border-accent text-accent' : 'bg-white border-border text-text-main',
                            )}
                          >
                            <span className="flex items-center gap-2">
                              <Icon size={16} />
                              <span className="text-sm font-semibold">{route.label}</span>
                            </span>
                            {renderRouteBadge(route.key)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              <div className="pt-2 border-t border-border">
                <button
                  onClick={onLogout}
                  className="w-full px-3 py-3 rounded-lg border border-red-300 bg-red-50 text-red-700 text-left flex items-center gap-2"
                >
                  <LogOut size={16} />
                  <span className="text-sm font-semibold">Esci</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <footer className="hidden md:flex h-12 bg-white border-t border-border items-center px-6 gap-8 text-[13px] text-text-muted shrink-0">
        <div className="flex gap-1">Ordini in Attesa: <strong className="text-primary">{pendingOrdersCount}</strong></div>
        {analyticsEnabled && (
          <div className="flex gap-1">
            Ordini Totali Oggi: <strong className="text-primary">{orderHistoryCount}</strong>
          </div>
        )}
        <div className="ml-auto text-accent font-semibold">Tema Tenant Attivo</div>
      </footer>
      <ToastHost />
      <PwaInstallPrompt />

      {/* ============ MODE PICKER MODAL ============ */}
      <AnimatePresence>
        {showModePicker && (
          <div className="fixed inset-0 z-[1000] flex items-end justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-4 border-b border-border flex items-center justify-between">
                <h3 className="text-sm font-bold text-primary uppercase tracking-tight">Modalità Ordine</h3>
                <button onClick={() => setShowModePicker(false)} className="min-w-[44px] min-h-[44px] flex items-center justify-center p-2 hover:bg-bg rounded-full text-text-muted">
                  <X size={18} />
                </button>
              </div>
              <div className="p-4 space-y-2">
                {([
                  { key: 'dine_in' as const, label: 'Sala', desc: 'Ordine al tavolo', dot: 'bg-primary' },
                  { key: 'takeaway' as const, label: 'Asporto', desc: 'Ordine da ritirare', dot: 'bg-amber-500' },
                  { key: 'delivery' as const, label: 'Delivery', desc: 'Consegna a domicilio', dot: 'bg-emerald-500' },
                ]).map(({ key, label, desc, dot }) => (
                  <button
                    key={key}
                    onClick={() => {
                      useAppStore.setState({ posOrderMode: key });
                      setShowModePicker(false);
                    }}
                    className={cn(
                      'w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left',
                      posOrderMode === key
                        ? 'border-accent bg-accent/5'
                        : 'border-border hover:border-accent/50',
                    )}
                  >
                    <div className={cn('w-3 h-3 rounded-full shrink-0', dot)} />
                    <div className="flex-1">
                      <p className="text-sm font-bold text-primary">{label}</p>
                      <p className="text-[10px] text-text-muted uppercase tracking-wider">{desc}</p>
                    </div>
                    {posOrderMode === key && <Check size={18} className="text-accent shrink-0" />}
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ============ TABLE PICKER MODAL ============ */}
      <AnimatePresence>
        {showTablePicker && data && (
          <div className="fixed inset-0 z-[1000] flex items-end justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden max-h-[70vh] flex flex-col"
            >
              <div className="p-4 border-b border-border flex items-center justify-between shrink-0">
                <h3 className="text-sm font-bold text-primary uppercase tracking-tight">Seleziona Tavolo</h3>
                <button onClick={() => setShowTablePicker(false)} className="min-w-[44px] min-h-[44px] flex items-center justify-center p-2 hover:bg-bg rounded-full text-text-muted">
                  <X size={18} />
                </button>
              </div>
              <div className="p-4 overflow-y-auto flex-1">
                <div className="grid grid-cols-4 gap-2">
                  {data.tables
                    .slice()
                    .sort((a, b) => a.number.localeCompare(b.number, 'it', { numeric: true, sensitivity: 'base' }))
                    .map((table) => (
                      <button
                        key={table.id}
                        onClick={() => {
                          useAppStore.setState({ posTableNumber: table.number });
                          setShowTablePicker(false);
                        }}
                        className={cn(
                          'aspect-square rounded-xl border-2 flex flex-col items-center justify-center transition-all text-xs font-bold',
                          table.number === posTableNumber
                            ? 'border-accent bg-accent text-white shadow-md'
                            : table.status === 'occupied'
                              ? 'border-red-200 bg-red-50 text-red-700'
                              : table.status === 'reserved'
                                ? 'border-amber-200 bg-amber-50 text-amber-700'
                                : 'border-border bg-white text-secondary hover:border-accent',
                        )}
                      >
                        <span className="text-sm">{table.number}</span>
                        <span className="text-[8px] uppercase tracking-wider mt-0.5 opacity-70">
                          {table.status === 'occupied' ? 'occ.' : table.status === 'reserved' ? 'pren.' : 'libero'}
                        </span>
                      </button>
                    ))}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

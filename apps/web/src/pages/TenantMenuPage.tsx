import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle } from 'lucide-react';
import type { ConsumerUser, PublicMenuResponse } from '@gustopos/shared';
import {
  API_URL,
  createPublicTakeawayOrder,
  fetchConsumerMe,
  getConsumerAccessToken,
  loginConsumer,
  logoutConsumer,
  isDuplicateIdempotentError,
  registerConsumer,
  resolveOrderIdempotencyKey,
  trackPublicFunnelEvent,
} from '../shared/api/client';
import MenuRenderer from '../menu/MenuRenderer';
import GenericCartDrawer from '../menu/overlays/CartDrawer';
import GenericModifierSheet from '../menu/overlays/ModifierSheet';
import { resolvePublicBrand } from '../menu/brand';
import { resolveCartAffordance, resolveCartDrawer, resolveModifierSheet } from '../menu/scaffolds';
import { formatPrice } from '../menu/lib/display';
import { resolveEnabledSections, resolveSectionOrder } from '../menu/useMenuConfig';
import type { CartDrawerProps, MenuShellActions, MenuShellData, PublicCartLine } from '../menu/types';

const TAKEAWAY_CART_STORAGE_PREFIX = 'gustopos:public-takeaway-cart:';

type PublicMenuItem = PublicMenuResponse['items'][number];

function cartStorageKey(tenantSlug: string): string {
  return `${TAKEAWAY_CART_STORAGE_PREFIX}${tenantSlug}`;
}

/** Stable line id: same item + same modifier set collapses into one line. */
function buildLineId(menuItemId: string, selectedModifiers: Array<{ groupId: string; optionId: string }>): string {
  const key = selectedModifiers
    .map((selection) => `${selection.groupId}:${selection.optionId}`)
    .sort()
    .join('|');
  return key ? `${menuItemId}#${key}` : menuItemId;
}

export default function TenantMenuPage() {
  const { tenantSlug = '' } = useParams();
  const [menu, setMenu] = useState<PublicMenuResponse | null>(null);
  const [loadingMenu, setLoadingMenu] = useState(true);
  const [menuError, setMenuError] = useState('');
  const [takeawayError, setTakeawayError] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<PublicCartLine[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [submittingTakeaway, setSubmittingTakeaway] = useState(false);
  const [takeawaySuccessId, setTakeawaySuccessId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [pickupEta, setPickupEta] = useState('');
  const [takeawayNotes, setTakeawayNotes] = useState('');
  const [consumerUser, setConsumerUser] = useState<ConsumerUser | null>(null);
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authFullName, setAuthFullName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPhone, setAuthPhone] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [checkoutStep, setCheckoutStep] = useState<'cart' | 'customer' | 'confirm'>('cart');
  const [modifierItem, setModifierItem] = useState<PublicMenuItem | null>(null);

  const pendingTakeawayOrderKeys = useRef(new Map<string, string>());

  useEffect(() => {
    const endpoint = tenantSlug
      ? `${API_URL}/api/public/menu?slug=${encodeURIComponent(tenantSlug)}`
      : `${API_URL}/api/public/menu`;

    void fetch(endpoint)
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload?.message ?? 'Menu fetch failed');
        }
        return payload as PublicMenuResponse;
      })
      .then((payload) => {
        setMenu(payload);
        setMenuError('');
      })
      .catch((loadError) => {
        setMenuError(loadError instanceof Error ? loadError.message : 'Menu load error');
      })
      .finally(() => {
        setLoadingMenu(false);
      });
  }, [tenantSlug]);

  useEffect(() => {
    if (!tenantSlug || !menu) return;
    void trackPublicFunnelEvent(tenantSlug, {
      event: 'public_menu_view',
      details: { itemCount: menu.items.length, categoryCount: menu.categories.length },
    }).catch(() => undefined);
  }, [tenantSlug, menu]);

  useEffect(() => {
    if (!tenantSlug || !getConsumerAccessToken(tenantSlug)) {
      setConsumerUser(null); // eslint-disable-line react-hooks/set-state-in-effect
      return;
    }
    void fetchConsumerMe(tenantSlug)
      .then((user) => {
        setConsumerUser(user);
        setAuthError('');
      })
      .catch(() => setConsumerUser(null));
  }, [tenantSlug]);

  useEffect(() => {
    if (!tenantSlug) return;
    try {
      const raw = localStorage.getItem(cartStorageKey(tenantSlug));
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return;
      const hydrated = parsed
        .filter((entry): entry is PublicCartLine => (
          typeof entry === 'object' && entry !== null &&
          'id' in entry && 'name' in entry && 'basePrice' in entry && 'quantity' in entry
        ))
        .map((entry) => ({
          ...entry,
          quantity: Math.max(1, Math.floor(entry.quantity)),
          selectedModifiers: Array.isArray(entry.selectedModifiers) ? entry.selectedModifiers : [],
          modifierPriceDelta: typeof entry.modifierPriceDelta === 'number' ? entry.modifierPriceDelta : 0,
          ingredients: Array.isArray(entry.ingredients) ? entry.ingredients : [],
        }));
      setCart(hydrated); // eslint-disable-line react-hooks/set-state-in-effect
    } catch {
      setCart([]);
    }
  }, [tenantSlug]);

  useEffect(() => {
    if (!tenantSlug) return;
    localStorage.setItem(cartStorageKey(tenantSlug), JSON.stringify(cart));
  }, [cart, tenantSlug]);

  useEffect(() => {
    if (isCartOpen) {
      document.body.style.overflow = 'hidden';
      return;
    }
    document.body.style.overflow = 'unset';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isCartOpen]);

  const takeawayEnabled = menu?.capabilities.takeawayOrder ?? false;
  const takeawayConfig = menu?.capabilities.takeawayConfig ?? {
    minOrderAmount: 0,
    maxItems: 20,
    pickupEtaRequired: false,
    allowNotes: true,
  };

  const appearance = useMemo(() => (menu ? resolvePublicBrand(menu) : null), [menu]);
  const currency = appearance?.currency ?? 'EUR';
  const scaffoldKey = menu?.scaffoldKey ?? null;
  const CartDrawerView = useMemo(() => resolveCartDrawer(scaffoldKey) ?? GenericCartDrawer, [scaffoldKey]);
  const ModifierSheetView = useMemo(() => resolveModifierSheet(scaffoldKey) ?? GenericModifierSheet, [scaffoldKey]);
  const cartAffordance = useMemo(() => resolveCartAffordance(scaffoldKey), [scaffoldKey]);

  /** Lookup of every option name (item groups + category pools) for the cart. */
  const optionNameById = useMemo(() => {
    const map = new Map<string, string>();
    if (!menu) return map;
    for (const item of menu.items) {
      for (const group of item.modifierGroups ?? []) {
        for (const option of group.options) map.set(option.id, option.name);
      }
    }
    for (const pool of menu.categoryModifierPools) {
      for (const option of pool.options) map.set(option.id, option.name || option.componentId || option.id);
    }
    return map;
  }, [menu]);

  const filteredItems = useMemo(() => {
    if (!menu) return [] as PublicMenuResponse['items'];
    const query = searchQuery.trim().toLowerCase();
    return menu.items.filter((item) => {
      const byCategory = activeCategory === 'all' || item.categoryId === activeCategory;
      const recipeNames = (item.recipe ?? []).map((component) => component.componentName ?? '').join(' ');
      const haystack = `${item.name} ${item.category} ${item.ingredients.join(' ')} ${recipeNames}`.toLowerCase();
      const bySearch = !query || haystack.includes(query);
      return byCategory && bySearch;
    });
  }, [menu, activeCategory, searchQuery]);

  const cartTotal = useMemo(
    () => cart.reduce((sum, item) => sum + (item.basePrice + item.modifierPriceDelta) * item.quantity, 0),
    [cart],
  );
  const cartCount = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);

  const submitBlockedReason = useMemo(() => {
    if (cart.length === 0) return 'Aggiungi almeno un prodotto al carrello';
    if (customerName.trim().length < 2) return 'Inserisci un nome cliente valido';
    if (cartTotal < takeawayConfig.minOrderAmount) {
      return `Ordine minimo richiesto: ${formatPrice(currency, takeawayConfig.minOrderAmount)}`;
    }
    if (cartCount > takeawayConfig.maxItems) return `Numero massimo articoli: ${takeawayConfig.maxItems}`;
    if (takeawayConfig.pickupEtaRequired && !pickupEta) return 'Seleziona orario di ritiro (ETA)';
    return '';
  }, [cart.length, customerName, cartTotal, takeawayConfig, pickupEta, currency, cartCount]);

  const pushLine = (
    item: PublicMenuItem,
    selectedModifiers: Array<{ groupId: string; optionId: string }>,
    modifierPriceDelta: number,
  ) => {
    if (item.isSoldOut) return;
    const lineId = buildLineId(item.id, selectedModifiers);
    setCart((prev) => {
      const existing = prev.find((entry) => entry.id === lineId);
      if (existing) {
        return prev.map((entry) => entry.id === lineId ? { ...entry, quantity: entry.quantity + 1 } : entry);
      }
      return [...prev, {
        id: lineId,
        name: item.name,
        basePrice: item.price,
        modifierPriceDelta,
        quantity: 1,
        category: item.category,
        ingredients: item.ingredients,
        isSoldOut: item.isSoldOut,
        isFeatured: item.isFeatured,
        selectedModifiers,
      }];
    });
    if (tenantSlug) {
      void trackPublicFunnelEvent(tenantSlug, {
        event: 'public_menu_add_to_cart',
        details: { itemId: item.id, itemName: item.name, itemPrice: item.price + modifierPriceDelta },
      }).catch(() => undefined);
    }
  };

  const onAddItem = (item: PublicMenuItem) => {
    const hasModifiers = (item.modifierGroups?.length ?? 0) > 0 || (menu?.categoryModifierPools.length ?? 0) > 0;
    if (hasModifiers) {
      setModifierItem(item);
      return;
    }
    pushLine(item, [], 0);
  };

  const incrementLine = (lineId: string) =>
    setCart((prev) => prev.map((entry) => entry.id === lineId ? { ...entry, quantity: entry.quantity + 1 } : entry));
  const decrementLine = (lineId: string) =>
    setCart((prev) => prev.flatMap((entry) => {
      if (entry.id !== lineId) return [entry];
      if (entry.quantity > 1) return [{ ...entry, quantity: entry.quantity - 1 }];
      return [];
    }));
  const removeLine = (lineId: string) => setCart((prev) => prev.filter((entry) => entry.id !== lineId));

  const submitTakeawayOrder = async () => {
    if (!tenantSlug || !takeawayEnabled || cart.length === 0 || submitBlockedReason) return;
    try {
      setSubmittingTakeaway(true);
      setTakeawaySuccessId('');
      setTakeawayError('');
      void trackPublicFunnelEvent(tenantSlug, {
        event: 'public_menu_checkout_start',
        details: { cartItemCount: cartCount, cartTotal },
      }).catch(() => undefined);

      const takeawayPayload = {
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || undefined,
        items: cart.map((line) => ({
          id: line.id.split('#')[0],
          name: line.name,
          price: line.basePrice + line.modifierPriceDelta,
          quantity: line.quantity,
          selectedModifiers: line.selectedModifiers.length > 0 ? line.selectedModifiers : undefined,
        })),
        total: cartTotal,
        pickupEta: pickupEta ? new Date(pickupEta).toISOString() : undefined,
        notes: takeawayConfig.allowNotes ? (takeawayNotes.trim() || undefined) : undefined,
      };
      const fingerprint = JSON.stringify(takeawayPayload);
      const { key, pending } = resolveOrderIdempotencyKey(fingerprint, pendingTakeawayOrderKeys.current);
      pendingTakeawayOrderKeys.current = pending;
      const payload = await createPublicTakeawayOrder(tenantSlug, takeawayPayload, key);

      pendingTakeawayOrderKeys.current = new Map();
      setTakeawaySuccessId(payload.order.id);
      localStorage.setItem(`gustopos:public-takeaway-tracking:${tenantSlug}`, JSON.stringify({
        orderId: payload.order.id,
        trackingToken: payload.trackingToken,
      }));
      void trackPublicFunnelEvent(tenantSlug, {
        event: 'public_takeaway_submit_success',
        details: { orderId: payload.order.id, cartItemCount: cartCount, cartTotal },
      }).catch(() => undefined);
      setCart([]);
      setTakeawayNotes('');
      setIsCartOpen(false);
      setCheckoutStep('cart');
    } catch (submitError) {
      setTakeawayError(
        isDuplicateIdempotentError(submitError)
          ? 'Ordine già inviato'
          : (submitError instanceof Error ? submitError.message : 'Invio ordine takeaway fallito'),
      );
    } finally {
      setSubmittingTakeaway(false);
    }
  };

  const submitConsumerAuth = async () => {
    if (!tenantSlug) return;
    try {
      setAuthLoading(true);
      setAuthError('');
      const payload = authMode === 'register'
        ? await registerConsumer(tenantSlug, {
          fullName: authFullName.trim(),
          email: authEmail.trim() || undefined,
          phone: authPhone.trim() || undefined,
          password: authPassword,
        })
        : await loginConsumer(tenantSlug, {
          email: authEmail.trim() || undefined,
          phone: authPhone.trim() || undefined,
          password: authPassword,
        });
      setConsumerUser(payload.user);
      if (payload.user.fullName && customerName.trim().length === 0) setCustomerName(payload.user.fullName);
      if (payload.user.phone && customerPhone.trim().length === 0) setCustomerPhone(payload.user.phone);
      setAuthPassword('');
    } catch (submitError) {
      setAuthError(submitError instanceof Error ? submitError.message : 'Autenticazione non riuscita');
    } finally {
      setAuthLoading(false);
    }
  };

  const submitConsumerLogout = async () => {
    if (!tenantSlug) return;
    await logoutConsumer(tenantSlug).catch(() => undefined);
    setConsumerUser(null);
  };

  useEffect(() => {
    if (!tenantSlug || takeawayEnabled) return;
    setIsCartOpen(false); // eslint-disable-line react-hooks/set-state-in-effect
    setCheckoutStep('cart');
    setCart([]);
    localStorage.removeItem(cartStorageKey(tenantSlug));
  }, [takeawayEnabled, tenantSlug]);

  if (menuError) {
    return (
      <div className="menu-brand flex min-h-[100dvh] items-center justify-center bg-slate-100 p-6">
        <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-50">
            <AlertTriangle className="h-7 w-7 text-amber-600" aria-hidden="true" />
          </div>
          <h1 className="text-lg font-bold text-slate-900">Menu non disponibile</h1>
          <p className="mt-2 text-sm text-slate-600">{menuError}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 min-h-[48px] w-full rounded-xl bg-slate-900 text-xs font-bold uppercase tracking-widest text-white transition active:scale-[0.99]"
          >
            Riprova
          </button>
        </div>
      </div>
    );
  }

  if (loadingMenu || !menu || !appearance) {
    return (
      <div className="menu-brand min-h-[100dvh] bg-slate-100">
        <div className="mx-auto max-w-6xl space-y-5 p-6" role="status" aria-live="polite">
          <div className="sr-only">Caricamento menu in corso…</div>
          <div className="h-9 w-40 animate-pulse rounded bg-slate-200" />
          <div className="h-4 w-64 animate-pulse rounded bg-slate-200" />
          <div className="h-12 w-full max-w-md animate-pulse rounded-full bg-slate-200" />
          <div className="flex gap-2 pt-1">
            <div className="h-9 w-24 animate-pulse rounded-full bg-slate-200" />
            <div className="h-9 w-28 animate-pulse rounded-full bg-slate-200" />
            <div className="h-9 w-20 animate-pulse rounded-full bg-slate-200" />
          </div>
          <div className="grid gap-4 pt-4 md:grid-cols-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="flex gap-4 rounded-xl bg-white p-4">
                <div className="h-24 w-24 flex-none animate-pulse rounded-xl bg-slate-200" />
                <div className="flex-1 space-y-2 py-2">
                  <div className="h-4 w-2/3 animate-pulse rounded bg-slate-200" />
                  <div className="h-3 w-full animate-pulse rounded bg-slate-100" />
                  <div className="h-3 w-1/2 animate-pulse rounded bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const shellData: MenuShellData = {
    menu,
    config: menu.config,
    appearance,
    categories: menu.categories.map((category) => ({ id: category.id, name: category.name })),
    filteredItems,
    activeCategory,
    searchQuery,
    sectionOrder: resolveSectionOrder(menu.config),
    enabledSections: resolveEnabledSections(menu.config),
    cartAffordance,
  };

  const shellActions: MenuShellActions = {
    onSelectCategory: setActiveCategory,
    onSearch: setSearchQuery,
    onAddItem,
    openCart: () => setIsCartOpen(true),
    closeCart: () => setIsCartOpen(false),
    cartOpen: isCartOpen,
    cartCount,
    cartTotal,
    cartLines: cart,
    onIncrementLine: incrementLine,
    onDecrementLine: decrementLine,
    onRemoveLine: removeLine,
    takeawayEnabled,
  };

  const floatingVisible = cartAffordance === 'floating' && takeawayEnabled && cartCount > 0 && !isCartOpen;
  const rootPadding = cartAffordance === 'floating' ? 'pb-24 lg:pb-0' : '';

  const cartOverlay: CartDrawerProps = {
    appearance,
    currency,
    formatPrice: (value) => formatPrice(currency, value),
    open: isCartOpen,
    onClose: () => setIsCartOpen(false),
    tenantSlug,
    cart,
    cartCount,
    cartTotal,
    checkoutStep,
    setCheckoutStep,
    onIncrement: incrementLine,
    onDecrement: decrementLine,
    onRemove: removeLine,
    optionNameById,
    takeawayConfig,
    submitting: submittingTakeaway,
    successId: takeawaySuccessId,
    submitError: takeawayError,
    blockedReason: submitBlockedReason,
    onSubmit: () => void submitTakeawayOrder(),
    customer: {
      name: customerName,
      phone: customerPhone,
      pickupEta,
      notes: takeawayNotes,
      setName: setCustomerName,
      setPhone: setCustomerPhone,
      setPickupEta,
      setNotes: setTakeawayNotes,
    },
    auth: {
      user: consumerUser,
      mode: authMode,
      setMode: setAuthMode,
      fullName: authFullName,
      email: authEmail,
      phone: authPhone,
      password: authPassword,
      setFullName: setAuthFullName,
      setEmail: setAuthEmail,
      setPhone: setAuthPhone,
      setPassword: setAuthPassword,
      error: authError,
      loading: authLoading,
      submit: submitConsumerAuth,
      logout: submitConsumerLogout,
    },
  };

  return (
    <main
      className={`menu-brand min-h-[100dvh] ${rootPadding}`}
      style={{ backgroundColor: appearance.pageBg, color: appearance.ink }}
    >
      <MenuRenderer data={shellData} actions={shellActions} />

      <AnimatePresence>
        {floatingVisible && (
          <motion.button
            key="floating-cart"
            initial={{ y: 90, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 90, opacity: 0 }}
            onClick={() => setIsCartOpen(true)}
            className="fixed bottom-6 left-4 right-4 z-50 flex items-center justify-between rounded-xl px-5 py-4 shadow-lg md:left-auto md:right-8 md:w-[22rem]"
            style={{ backgroundColor: appearance.accent, color: appearance.accentForeground }}
          >
            <span className="flex items-center gap-3">
              <span
                className="flex h-6 w-6 items-center justify-center rounded text-[10px] font-bold tabular-nums"
                style={{ backgroundColor: appearance.accentForeground, color: appearance.accent }}
              >
                {cartCount}
              </span>
              <span className="text-xs font-semibold uppercase tracking-[0.18em]">Carrello</span>
            </span>
            <span className="text-sm font-bold tabular-nums">{formatPrice(currency, cartTotal)}</span>
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isCartOpen && <CartDrawerView key="cart-drawer" {...cartOverlay} />}
      </AnimatePresence>

      {modifierItem && (
        <ModifierSheetView
          item={modifierItem}
          categoryPools={menu.categoryModifierPools}
          appearance={appearance}
          currency={currency}
          formatPrice={(value) => formatPrice(currency, value)}
          onClose={() => setModifierItem(null)}
          onConfirm={({ selectedModifiers, modifierPriceDelta }) => {
            pushLine(modifierItem, selectedModifiers, modifierPriceDelta);
            setModifierItem(null);
          }}
        />
      )}
    </main>
  );
}

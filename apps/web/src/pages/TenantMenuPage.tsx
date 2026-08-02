import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ShoppingBag, Plus, Minus, X, Search, ChevronRight, UtensilsCrossed, Wind, Wine, IceCream } from 'lucide-react';
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

const TAKEAWAY_CART_STORAGE_PREFIX = 'gustopos:public-takeaway-cart:';

type TakeawayCartItem = { id: string; name: string; price: number; quantity: number; category: string; ingredients: string[]; isSoldOut?: boolean; isFeatured?: boolean };

type CategoryChip = { id: string; name: string; icon: keyof typeof ICONS };

const ICONS = {
  UtensilsCrossed,
  Wind,
  Wine,
  IceCream,
  ChevronRight,
} as const;

function cartStorageKey(tenantSlug: string): string {
  return `${TAKEAWAY_CART_STORAGE_PREFIX}${tenantSlug}`;
}

function formatPrice(currency: string, value: number): string {
  if (currency.toUpperCase() === 'EUR') {
    return `EUR ${value.toFixed(2)}`;
  }
  return `${currency.toUpperCase()} ${value.toFixed(2)}`;
}

const IT_MONTHS = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
const IT_DAYS = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];

function formatDatetimeLocal(value: string): string {
  // value is "YYYY-MM-DDTHH:MM" from datetime-local input
  const [datePart, timePart] = value.split('T');
  if (!datePart || !timePart) return value;
  const [y, m, d] = datePart.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const dayName = IT_DAYS[date.getDay()];
  const monthName = IT_MONTHS[m - 1];
  return `${dayName} ${d} ${monthName}, ${timePart}`;
}

function categoryIconByName(name: string): keyof typeof ICONS {
  const key = name.toLowerCase();
  if (key.includes('antipast')) return 'Wind';
  if (key.includes('dolc')) return 'IceCream';
  if (key.includes('bevand') || key.includes('drink') || key.includes('vino')) return 'Wine';
  if (key.includes('primi') || key.includes('second')) return 'ChevronRight';
  return 'UtensilsCrossed';
}

export default function TenantMenuPage() {
  const { tenantSlug = '' } = useParams();
  const [menu, setMenu] = useState<PublicMenuResponse | null>(null);
  const [error, setError] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<TakeawayCartItem[]>([]);
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

  // H2: one idempotency key per logical takeaway submission. A retry of the
  // same cart (network blip after the server committed) reuses the key so the
  // API middleware dedupes instead of creating a duplicate takeaway order.
  // The key is dropped on success so a fresh identical order gets a new key.
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
        setError('');
      })
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : 'Menu load error');
      });
  }, [tenantSlug]);

  useEffect(() => {
    if (!tenantSlug || !menu) {
      return;
    }
    void trackPublicFunnelEvent(tenantSlug, {
      event: 'public_menu_view',
      details: {
        itemCount: menu.items.length,
        categoryCount: menu.categories.length,
      },
    }).catch(() => undefined);
  }, [tenantSlug, menu]);

  useEffect(() => {
    if (!tenantSlug || !getConsumerAccessToken(tenantSlug)) {
      setConsumerUser(null); // eslint-disable-line react-hooks/set-state-in-effect -- [async-fetch] reset user when no auth; literal null, no stale-closure risk
      return;
    }

    void fetchConsumerMe(tenantSlug)
      .then((user) => {
        setConsumerUser(user);  
        setAuthError('');  
      })
      .catch(() => {
        setConsumerUser(null);
      });
  }, [tenantSlug]);

  useEffect(() => {
    if (!tenantSlug) {
      return;
    }

    try {
      const raw = localStorage.getItem(cartStorageKey(tenantSlug));
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) {
        return;
      }

      const hydrated = parsed
        .filter((entry): entry is TakeawayCartItem => (
          typeof entry === 'object' &&
          entry !== null &&
          'id' in entry &&
          'name' in entry &&
          'price' in entry &&
          'quantity' in entry &&
          'category' in entry &&
          'ingredients' in entry &&
          typeof entry.id === 'string' &&
          typeof entry.name === 'string' &&
          typeof entry.price === 'number' &&
          typeof entry.quantity === 'number' &&
          typeof entry.category === 'string' &&
          Array.isArray(entry.ingredients)
        ))
        .map((entry) => ({ ...entry, quantity: Math.max(1, Math.floor(entry.quantity)) }));

      setCart(hydrated); // eslint-disable-line react-hooks/set-state-in-effect -- [async-fetch] cart restored from localStorage in async effect
    } catch {
      setCart([]);  
    }
  }, [tenantSlug]);

  useEffect(() => {
    if (!tenantSlug) {
      return;
    }

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

  const currency = menu?.branding.currency ?? 'EUR';
  const takeawayEnabled = menu?.capabilities.takeawayOrder ?? false;
  const groupOrderEnabled = menu?.capabilities.groupOrder ?? false;
  const takeawayConfig = menu?.capabilities.takeawayConfig ?? {
    minOrderAmount: 0,
    maxItems: 20,
    pickupEtaRequired: false,
    allowNotes: true,
  };

  const categoryChips = useMemo(() => {
    if (!menu) {
      return [] as CategoryChip[];
    }
    return [
      { id: 'all', name: 'Tutti', icon: 'UtensilsCrossed' as const },
      ...menu.categories.map((category) => ({
        id: category.id,
        name: category.name,
        icon: categoryIconByName(category.name),
      })),
    ];
  }, [menu]);

  const filteredItems = useMemo(() => {
    if (!menu) {
      return [] as PublicMenuResponse['items'];
    }

    const query = searchQuery.trim().toLowerCase();
    return menu.items.filter((item) => {
      const byCategory = activeCategory === 'all' || item.categoryId === activeCategory;
      const haystack = `${item.name} ${item.category} ${item.ingredients.join(' ')}`.toLowerCase();
      const bySearch = !query || haystack.includes(query);
      return byCategory && bySearch;
    });
  }, [menu, activeCategory, searchQuery]);

  const cartTotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cart],
  );

  const cartCount = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart],
  );

  const submitBlockedReason = useMemo(() => {
    if (cart.length === 0) {
      return 'Aggiungi almeno un prodotto al carrello';
    }
    if (customerName.trim().length < 2) {
      return 'Inserisci un nome cliente valido';
    }
    if (cartTotal < takeawayConfig.minOrderAmount) {
      return `Ordine minimo richiesto: ${formatPrice(currency, takeawayConfig.minOrderAmount)}`;
    }
    if (cartCount > takeawayConfig.maxItems) {
      return `Numero massimo articoli: ${takeawayConfig.maxItems}`;
    }
    if (takeawayConfig.pickupEtaRequired && !pickupEta) {
      return 'Seleziona orario di ritiro (ETA)';
    }

    return '';
  }, [cart.length, customerName, cartTotal, takeawayConfig.minOrderAmount, takeawayConfig.maxItems, takeawayConfig.pickupEtaRequired, pickupEta, currency, cartCount]);

  const addToCart = (item: PublicMenuResponse['items'][number] | TakeawayCartItem) => {
    if (item.isSoldOut) {
      return;
    }

    setCart((prev) => {
      const existing = prev.find((entry) => entry.id === item.id);
      if (existing) {
        return prev.map((entry) => entry.id === item.id ? { ...entry, quantity: entry.quantity + 1 } : entry);
      }
      return [...prev, {
        id: item.id,
        name: item.name,
        price: item.price,
        quantity: 1,
        category: item.category,
        ingredients: item.ingredients,
        isSoldOut: item.isSoldOut,
        isFeatured: item.isFeatured,
      }];
    });

    if (tenantSlug) {
      void trackPublicFunnelEvent(tenantSlug, {
        event: 'public_menu_add_to_cart',
        details: {
          itemId: item.id,
          itemName: item.name,
          itemPrice: item.price,
        },
      }).catch(() => undefined);
    }
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => {
      const existing = prev.find((entry) => entry.id === id);
      if (!existing) {
        return prev;
      }
      if (existing.quantity > 1) {
        return prev.map((entry) => entry.id === id ? { ...entry, quantity: entry.quantity - 1 } : entry);
      }
      return prev.filter((entry) => entry.id !== id);
    });
  };

  const clearCartItem = (id: string) => {
    setCart((prev) => prev.filter((entry) => entry.id !== id));
  };

  const submitTakeawayOrder = async () => {
    if (!tenantSlug || !takeawayEnabled || cart.length === 0 || submitBlockedReason) {
      return;
    }

    try {
      setSubmittingTakeaway(true);
      setTakeawaySuccessId('');
      setError('');

      void trackPublicFunnelEvent(tenantSlug, {
        event: 'public_menu_checkout_start',
        details: {
          cartItemCount: cartCount,
          cartTotal,
        },
      }).catch(() => undefined);

      const takeawayPayload = {
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || undefined,
        items: cart,
        total: cartTotal,
        pickupEta: pickupEta ? new Date(pickupEta).toISOString() : undefined,
        notes: takeawayConfig.allowNotes ? (takeawayNotes.trim() || undefined) : undefined,
      };
      const fingerprint = JSON.stringify(takeawayPayload);
      const { key, pending } = resolveOrderIdempotencyKey(fingerprint, pendingTakeawayOrderKeys.current);
      pendingTakeawayOrderKeys.current = pending;
      const payload = await createPublicTakeawayOrder(tenantSlug, takeawayPayload, key);

      // Success: this logical submission is resolved — a future identical
      // order must get a fresh key.
      pendingTakeawayOrderKeys.current = new Map();
      setTakeawaySuccessId(payload.order.id);
      localStorage.setItem(`gustopos:public-takeaway-tracking:${tenantSlug}`, JSON.stringify({
        orderId: payload.order.id,
        trackingToken: payload.trackingToken,
      }));

      void trackPublicFunnelEvent(tenantSlug, {
        event: 'public_takeaway_submit_success',
        details: {
          orderId: payload.order.id,
          cartItemCount: cartCount,
          cartTotal,
        },
      }).catch(() => undefined);

      setCart([]);
      setTakeawayNotes('');
      setIsCartOpen(false);
      setCheckoutStep('cart');
    } catch (submitError) {
      // Double-tap on "Conferma ordine takeaway": the API middleware rejects
      // the second identical request with 409 — the order was already sent.
      setError(
        isDuplicateIdempotentError(submitError)
          ? 'Ordine già inviato'
          : (submitError instanceof Error ? submitError.message : 'Invio ordine takeaway fallito'),
      );
    } finally {
      setSubmittingTakeaway(false);
    }
  };

  const submitConsumerAuth = async () => {
    if (!tenantSlug) {
      return;
    }

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
      if (payload.user.fullName && customerName.trim().length === 0) {
        setCustomerName(payload.user.fullName);
      }
      if (payload.user.phone && customerPhone.trim().length === 0) {
        setCustomerPhone(payload.user.phone);
      }
      setAuthPassword('');
    } catch (submitError) {
      setAuthError(submitError instanceof Error ? submitError.message : 'Autenticazione non riuscita');
    } finally {
      setAuthLoading(false);
    }
  };

  const submitConsumerLogout = async () => {
    if (!tenantSlug) {
      return;
    }

    await logoutConsumer(tenantSlug).catch(() => undefined);
    setConsumerUser(null);
  };

  const openCartAtStep = (step: 'cart' | 'customer' | 'confirm') => {
    if (!takeawayEnabled) {
      return;
    }
    setCheckoutStep(step);
    setIsCartOpen(true);
  };

  useEffect(() => {
    if (!tenantSlug || takeawayEnabled) {
      return;
    }
    setIsCartOpen(false); // eslint-disable-line react-hooks/set-state-in-effect -- [literal-reset] reset cart UI state when takeaway mode changes; all values are literals
    setCheckoutStep('cart');  
    setCart([]);  
    localStorage.removeItem(cartStorageKey(tenantSlug));
  }, [takeawayEnabled, tenantSlug]);

  if (error) {
    return <div className="min-h-screen p-6 text-red-600">{error}</div>;
  }

  if (!menu) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="animate-pulse text-slate-600 text-sm font-medium">Caricamento menu in corso...</div>
      </div>
    );
  }

  const accent = menu.branding.accentColor;
  const isBistro = menu.branding.preset === 'modern_bistro';
  const headerTagline = menu.branding.brandTagline || 'Cucina contemporanea di stagione';
  const floatingVisible = takeawayEnabled && cartCount > 0 && !isCartOpen;

  return (
    <main className="min-h-screen pb-24 lg:pb-0 bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 pt-8 px-4 md:px-6 pb-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-4">
            <span className="text-[10px] tracking-[0.2em] uppercase font-bold text-slate-400">
              {menu.tenant.slug.toUpperCase()} MENU
            </span>
            <div className="flex items-center gap-3">
              {takeawayEnabled ? (
                <Link className="text-xs text-indigo-700 underline font-semibold" to={`/${tenantSlug}/takeaway/track`}>
                  Traccia ordine
                </Link>
              ) : null}
              {groupOrderEnabled ? (
                <Link className="text-xs text-indigo-700 underline font-semibold" to={`/${tenantSlug}/group-order/new`}>
                  Carrello condiviso
                </Link>
              ) : null}
              {consumerUser ? (
                <button
                  onClick={() => void submitConsumerLogout()}
                  className="text-xs text-slate-700 underline font-semibold"
                >
                  {consumerUser.fullName} (Logout)
                </button>
              ) : (
                <button
                  onClick={() => openCartAtStep('customer')}
                  className="text-xs text-slate-700 underline font-semibold"
                >
                  Accedi
                </button>
              )}
              <button
                onClick={() => {
                  if (!takeawayEnabled) {
                    return;
                  }
                  setIsCartOpen(true);
                }}
                disabled={!takeawayEnabled}
                className="relative p-2 rounded-full bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                <ShoppingBag className="w-5 h-5 text-slate-800" />
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-slate-900 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full font-bold">
                    {cartCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 mb-4">
            {menu.branding.logoUrl && <img src={menu.branding.logoUrl} alt={`${menu.tenant.name} logo`} className="h-9 w-9 rounded object-cover border border-slate-200" />}
            <h1 className="font-serif text-3xl md:text-4xl font-bold" style={{ color: accent }}>
              {menu.tenant.name}
            </h1>
          </div>
          <p className="text-sm text-slate-500 italic mb-4">{headerTagline}</p>

          <div className="relative w-full md:w-[26rem]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Cerca piatti..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-full bg-slate-100 border border-slate-200 rounded-full py-2 pl-10 pr-4 text-xs focus:ring-1 focus:ring-slate-300 outline-none"
            />
          </div>

          <div className="mt-4 overflow-x-auto scrollbar-hide -mx-4 px-4 flex gap-2 pb-1 text-[10px] uppercase tracking-widest font-bold">
            {categoryChips.map((cat) => {
              const Icon = ICONS[cat.icon];
              const active = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`whitespace-nowrap px-3 py-2 rounded-full border transition-all duration-200 inline-flex items-center gap-1.5 ${
                    active
                      ? 'text-white border-slate-900'
                      : 'bg-transparent text-slate-500 border-slate-200 hover:border-slate-400 hover:text-slate-800'
                  }`}
                  style={{ backgroundColor: active ? accent : 'transparent' }}
                >
                  <Icon className="w-3 h-3" />
                  {cat.name}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-4 md:p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0">
          <AnimatePresence mode="popLayout">
            {filteredItems.map((item, index) => (
              <motion.article
                key={item.id}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3, delay: Math.min(index * 0.02, 0.25) }}
                className="group bg-transparent py-6 border-b border-slate-200 flex gap-4 px-2 rounded-xl hover:bg-white/70 transition-colors"
              >
                <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden flex-shrink-0 border border-slate-200 bg-slate-100">
                  <div className="w-full h-full bg-gradient-to-br from-slate-200 to-slate-100" />
                  {(item.isFeatured || item.isSoldOut) && (
                    <div className="absolute top-2 left-2 flex flex-col gap-1">
                      {item.isFeatured && <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold uppercase">Featured</span>}
                      {item.isSoldOut && <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 font-bold uppercase">Sold out</span>}
                    </div>
                  )}
                </div>

                <div className="flex-1 flex flex-col justify-center">
                  <div className="flex justify-between items-start mb-1 gap-3">
                    <h3 className="font-sans text-base font-semibold leading-tight group-hover:text-slate-900 transition-colors" style={{ fontFamily: isBistro ? 'Georgia, serif' : 'inherit' }}>
                      {item.name}
                    </h3>
                    <span className="font-semibold text-sm whitespace-nowrap" style={{ color: accent }}>{formatPrice(currency, item.price)}</span>
                  </div>
                  <p className="text-neutral-500 text-xs leading-relaxed mb-3 line-clamp-2">
                    {item.ingredients.length > 0 ? `Ingredienti: ${item.ingredients.join(', ')}` : item.category}
                  </p>
                  {takeawayEnabled && (
                    <button
                      onClick={() => addToCart(item)}
                      disabled={item.isSoldOut}
                      className="self-end w-8 h-8 md:w-10 md:h-10 border border-slate-200 rounded-full flex items-center justify-center text-xl font-light hover:bg-slate-100 transition-colors active:scale-90 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </motion.article>
            ))}
          </AnimatePresence>
        </div>

        {filteredItems.length === 0 && (
          <div className="text-center py-16 flex flex-col items-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-3 text-slate-300">
              <Search className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-serif font-bold text-slate-700">Nessun piatto trovato</h3>
            <p className="text-slate-500 mt-1 max-w-xs mx-auto text-sm">Prova a cambiare categoria o parole di ricerca.</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {floatingVisible && (
          <motion.button
            initial={{ y: 90, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 90, opacity: 0 }}
            onClick={() => setIsCartOpen(true)}
            className="fixed bottom-6 left-4 right-4 md:left-auto md:right-8 md:w-[22rem] z-50 text-white py-4 rounded-xl shadow-lg flex justify-between items-center px-5"
            style={{ backgroundColor: accent }}
          >
            <div className="flex items-center gap-3">
              <span className="bg-white/20 w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold">{cartCount}</span>
              <span className="text-xs font-semibold uppercase tracking-[0.18em]">Carrello</span>
            </div>
            <span className="font-bold text-sm">{formatPrice(currency, cartTotal)}</span>
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isCartOpen && (
          <div className="fixed inset-0 z-[60] flex justify-end">
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCartOpen(false)}
              className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm"
              aria-label="Chiudi carrello"
            />

            <motion.section
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 24, stiffness: 190 }}
              className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col"
            >
              <div className="p-5 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ShoppingBag className="w-5 h-5" style={{ color: accent }} />
                  <h2 className="font-serif text-2xl font-bold">Il tuo ordine</h2>
                </div>
                <button onClick={() => setIsCartOpen(false)} className="p-2 rounded-full hover:bg-slate-100 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              {cart.length > 0 && (
                <div className="px-5 py-3 border-b border-slate-200 bg-slate-50">
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => setCheckoutStep('cart')}
                      className={`px-2 py-1.5 rounded text-[11px] font-bold uppercase tracking-wider border ${checkoutStep === 'cart' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-300'}`}
                    >
                      Carrello
                    </button>
                    <button
                      onClick={() => setCheckoutStep('customer')}
                      className={`px-2 py-1.5 rounded text-[11px] font-bold uppercase tracking-wider border ${checkoutStep === 'customer' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-300'}`}
                    >
                      Dati
                    </button>
                    <button
                      onClick={() => setCheckoutStep('confirm')}
                      className={`px-2 py-1.5 rounded text-[11px] font-bold uppercase tracking-wider border ${checkoutStep === 'confirm' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-300'}`}
                    >
                      Conferma
                    </button>
                  </div>
                </div>
              )}

              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center opacity-60">
                    <ShoppingBag className="w-12 h-12 mb-3" />
                    <p className="text-base font-medium">Il carrello è vuoto</p>
                    <button onClick={() => setIsCartOpen(false)} className="mt-3 text-sm font-semibold underline" style={{ color: accent }}>
                      Inizia a ordinare
                    </button>
                  </div>
                ) : checkoutStep === 'cart' ? (
                  cart.map((item) => (
                    <motion.div key={item.id} layout initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} className="flex gap-3 border border-slate-200 rounded-xl p-3">
                      <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-slate-200 to-slate-100 flex-shrink-0" />
                      <div className="flex-1">
                        <div className="flex justify-between items-start mb-1">
                          <h4 className="font-semibold text-sm text-slate-800">{item.name}</h4>
                          <span className="font-bold text-xs">{formatPrice(currency, item.price * item.quantity)}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mb-2">Prezzo unitario: {formatPrice(currency, item.price)}</p>

                        <div className="flex items-center gap-2">
                          <div className="flex items-center bg-slate-100 rounded-lg p-1">
                            <button onClick={() => removeFromCart(item.id)} className="p-1.5 rounded hover:bg-white transition-colors">
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="w-8 text-center text-xs font-bold">{item.quantity}</span>
                            <button onClick={() => addToCart(item)} className="p-1.5 rounded hover:bg-white transition-colors">
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <button onClick={() => clearCartItem(item.id)} className="text-[10px] font-bold uppercase tracking-widest text-rose-600/70 hover:text-rose-600 transition-colors">
                            Rimuovi
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))
                ) : checkoutStep === 'customer' ? (
                  <div className="space-y-3">
                    {!consumerUser && (
                      <div className="rounded border border-slate-200 bg-white p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-700">Account cliente</p>
                          <button
                            onClick={() => setAuthMode((current) => current === 'login' ? 'register' : 'login')}
                            className="text-[11px] text-indigo-700 underline"
                          >
                            {authMode === 'login' ? 'Registrati' : 'Login'}
                          </button>
                        </div>
                        {authMode === 'register' && (
                          <input
                            value={authFullName}
                            onChange={(event) => setAuthFullName(event.target.value)}
                            placeholder="Nome e cognome"
                            className="w-full px-3 py-2 rounded border border-slate-300 text-sm"
                          />
                        )}
                        <input
                          value={authEmail}
                          onChange={(event) => setAuthEmail(event.target.value)}
                          placeholder="Email (opzionale)"
                          className="w-full px-3 py-2 rounded border border-slate-300 text-sm"
                        />
                        <input
                          value={authPhone}
                          onChange={(event) => setAuthPhone(event.target.value)}
                          placeholder="Telefono (opzionale)"
                          className="w-full px-3 py-2 rounded border border-slate-300 text-sm"
                        />
                        <input
                          type="password"
                          value={authPassword}
                          onChange={(event) => setAuthPassword(event.target.value)}
                          placeholder="Password"
                          className="w-full px-3 py-2 rounded border border-slate-300 text-sm"
                        />
                        <button
                          onClick={() => void submitConsumerAuth()}
                          disabled={authLoading}
                          className="w-full px-3 py-2 rounded bg-slate-900 text-white text-xs font-bold uppercase tracking-wider disabled:opacity-50"
                        >
                          {authLoading ? 'Attendi...' : authMode === 'login' ? 'Login cliente' : 'Registra account'}
                        </button>
                        {authError && <p className="text-xs text-rose-600">{authError}</p>}
                      </div>
                    )}
                    {consumerUser && (
                      <div className="rounded border border-emerald-200 bg-emerald-50 p-3">
                        <p className="text-xs text-emerald-700 font-semibold">Account collegato: {consumerUser.fullName}</p>
                      </div>
                    )}
                    <input
                      value={customerName}
                      onChange={(event) => setCustomerName(event.target.value)}
                      placeholder="Nome cliente"
                      className="w-full px-3 py-2 rounded border border-slate-300 text-sm"
                    />
                    <input
                      value={customerPhone}
                      onChange={(event) => setCustomerPhone(event.target.value)}
                      placeholder="Telefono (opzionale)"
                      className="w-full px-3 py-2 rounded border border-slate-300 text-sm"
                    />
                    <input
                      type="datetime-local"
                      value={pickupEta}
                      onChange={(event) => setPickupEta(event.target.value)}
                      className="w-full px-3 py-2 rounded border border-slate-300 text-sm"
                    />
                    {takeawayConfig.allowNotes && (
                      <textarea
                        value={takeawayNotes}
                        onChange={(event) => setTakeawayNotes(event.target.value)}
                        placeholder="Note ordine (opzionale)"
                        className="w-full px-3 py-2 rounded border border-slate-300 text-sm min-h-[72px]"
                      />
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="rounded border border-slate-200 bg-white p-3 space-y-2">
                      <p className="text-xs text-slate-600">Controlla i dati prima di inviare l'ordine.</p>
                      <p className="text-sm"><strong>Cliente:</strong> {customerName || '-'}</p>
                      <p className="text-sm"><strong>Telefono:</strong> {customerPhone || '-'}</p>
                      <p className="text-sm"><strong>ETA:</strong> {pickupEta ? formatDatetimeLocal(pickupEta) : '-'}</p>
                      <p className="text-sm"><strong>Note:</strong> {takeawayNotes || '-'}</p>
                    </div>
                  </div>
                )}
              </div>

              {cart.length > 0 && (
                <div className="p-5 border-t border-slate-200 bg-slate-50/70 space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-600">Totale</span>
                    <span className="font-bold" style={{ color: accent }}>{formatPrice(currency, cartTotal)}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 space-y-0.5">
                    <p>Minimo ordine: {formatPrice(currency, takeawayConfig.minOrderAmount)}</p>
                    <p>Max articoli: {takeawayConfig.maxItems}</p>
                    {takeawayConfig.pickupEtaRequired && <p>Pickup ETA obbligatorio</p>}
                  </div>

                  <button
                    onClick={() => void submitTakeawayOrder()}
                    disabled={submittingTakeaway || Boolean(submitBlockedReason) || checkoutStep !== 'confirm'}
                    className="w-full text-white py-3 rounded-xl font-bold text-xs uppercase tracking-[0.14em] disabled:opacity-50"
                    style={{ backgroundColor: accent }}
                  >
                    {submittingTakeaway ? 'Invio...' : 'Conferma ordine takeaway'}
                  </button>
                  {checkoutStep !== 'confirm' && (
                    <p className="text-xs text-slate-600">Completa gli step e apri \"Conferma\" per inviare l'ordine.</p>
                  )}
                  {submitBlockedReason && <p className="text-xs text-amber-700">{submitBlockedReason}</p>}
                  {takeawaySuccessId && (
                    <div className="space-y-1">
                      <p className="text-xs text-emerald-600 font-semibold">Ordine inviato (ID: {takeawaySuccessId})</p>
                      <Link className="text-xs text-indigo-700 underline font-semibold" to={`/${tenantSlug}/takeaway/track`}>
                        Traccia ordine
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </motion.section>
          </div>
        )}
      </AnimatePresence>
    </main>
  );
}

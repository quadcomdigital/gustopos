import React, { useState, useMemo, useEffect } from 'react';
import { AppData, CartItem, Category, CategoryModifierPool, CreateOrderRequest, Customer, CustomerAddress, DeliveryUpsertRequest, MenuItem, Order, OrderItem, UiSettings } from '@gustopos/shared';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Minus, Trash2, User, ShoppingCart, ChefHat, ChevronDown, X, ArrowRight, Search, Receipt, Printer } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAppStore } from '../store/app-store';
import { trackUxMetric } from '../shared/ux/metrics';
import POSProductModal from './POSProductModal';
import ModifierModal from './ModifierModal';
import ConfirmDialog from './ConfirmDialog';
import { CheckoutModal } from './checkout';
import { useCheckoutStore } from '../store/checkout-store';
import { fetchCustomerAddresses, createCustomerAddress, isDuplicateIdempotentError } from '../shared/api/client';

interface POSViewProps {
  data: AppData;
  currentStaffId: string;
  currentStaffName: string;
  createOrder: (order: CreateOrderRequest) => Promise<Order>;
  upsertDeliveryOrder?: (orderId: string, payload: DeliveryUpsertRequest) => Promise<void>;
  customers: Customer[];
  uiSettings?: UiSettings;
  categories?: Category[];
  categoryModifierPools?: CategoryModifierPool[];
  onSearchCustomers?: (query?: { query?: string; limit?: number }) => Promise<void>;
  onCreateOrReuseCustomer?: (payload: { fullName: string; phone?: string }) => Promise<Customer>;
  initialTable?: string;
  onOpenTablesView?: (tableNumber: string) => void;
  canCloseTable?: boolean;
}

export default function POSView({
  data,
  currentStaffId,
  currentStaffName,
  createOrder,
  upsertDeliveryOrder,
  customers,
  uiSettings,
  categories = [],
  categoryModifierPools = [],
  onSearchCustomers,
  onCreateOrReuseCustomer,
  initialTable = '1',
  onOpenTablesView,
  canCloseTable = false,
}: POSViewProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('Tutti');
  const orderMode = useAppStore((s) => s.posOrderMode);
  const setOrderMode = (mode: 'dine_in' | 'takeaway' | 'delivery') => useAppStore.setState({ posOrderMode: mode });
  const posTableNumber = useAppStore((s) => s.posTableNumber);
  const setTableNumber = (num: string) => useAppStore.setState({ posTableNumber: num });
  const posCart = useAppStore((s) => s.posCart);
  const addToPosCart = useAppStore((s) => s.addToPosCart);
  const updatePosCartItem = useAppStore((s) => s.updatePosCartItem);
  const removeFromPosCart = useAppStore((s) => s.removeFromPosCart);
  const clearPosCart = useAppStore((s) => s.clearPosCart);
  const setCartContext = useAppStore((s) => s.setCartContext);
  const prepItems = useAppStore((s) => s.prepItems);
  const [takeawayCustomerName, setTakeawayCustomerName] = useState('');
  const [takeawayCustomerPhone, setTakeawayCustomerPhone] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryCourierName, setDeliveryCourierName] = useState('');
  const [deliveryCourierPhone, setDeliveryCourierPhone] = useState('');
  const [customerAddresses, setCustomerAddresses] = useState<CustomerAddress[]>([]);
  const [deliveryFee, setDeliveryFee] = useState('0');
  const [pickupEta, setPickupEta] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isEditingOrdered, setIsEditingOrdered] = useState(false);
  const [confirmedEditKey, setConfirmedEditKey] = useState<string | null>(null);
  const [showSendConfirm, setShowSendConfirm] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [showCartMobile, setShowCartMobile] = useState(false);
  const [showTableActions, setShowTableActions] = useState(false);
  const menuSearch = useAppStore((s) => s.posMenuSearch);
  const setMenuSearch = (v: string) => useAppStore.setState({ posMenuSearch: v });

  // Per-item "Salta stampa cucina" toggles (set of cart item IDs)
  const [skipKitchenById, setSkipKitchenById] = useState<Set<string>>(new Set());

  // Product/modifier modal state. The draft keeps inline Base selections while
  // the secondary modifier modal is open, including for a not-yet-carted item.
  type ModifierDraft = {
    quantity: number;
    notes: string;
    ingredientOverrides: Array<{ ingredientId: string; action: 'add' | 'remove' }>;
    selectedModifiers: Array<{ groupId: string; optionId: string }>;
    modifierPriceDelta: number;
    cartItemId?: string;
  };
  const [modalItem, setModalItem] = useState<{ item: MenuItem; editCartItem?: CartItem } | null>(null);
  const [modifierModalItem, setModifierModalItem] = useState<MenuItem | null>(null);
  const [modifierDraft, setModifierDraft] = useState<ModifierDraft | null>(null);

  // Sync table from external navigation (e.g. tables view → POS)
  React.useEffect(() => {
    if (initialTable && initialTable !== posTableNumber) {
      setTableNumber(initialTable);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTable]);

  // Fetch customer addresses when customer is selected for delivery
  useEffect(() => {
    if (orderMode !== 'delivery' || !selectedCustomerId) {
      setCustomerAddresses([]); // eslint-disable-line react-hooks/set-state-in-effect -- [literal-reset] reset addresses when not in delivery mode; literal []
      return;
    }
    fetchCustomerAddresses(selectedCustomerId)
      .then((addrs) => {
        setCustomerAddresses(addrs);
        if (addrs.length > 0 && !deliveryAddress) {
          const defaultAddr = addrs.find((a) => a.isDefault) ?? addrs[0];
          setDeliveryAddress(defaultAddr.address);
        }
      })
      .catch(() => setCustomerAddresses([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deliveryAddress is read+written inside the effect (default pick on first load); adding to deps would cause infinite re-run loop
  }, [orderMode, selectedCustomerId]);

  // Sync cart context when mode or table changes
  const cartContextKey = orderMode === 'dine_in'
    ? `dine_in:${posTableNumber}`
    : orderMode;

  React.useEffect(() => {
    setCartContext(cartContextKey);
  }, [cartContextKey, setCartContext]);

  // Clear skip-kitchen-print toggles when order mode changes
  React.useEffect(() => {
    setSkipKitchenById(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset on mode change only; literal Set
  }, [orderMode]);

  React.useEffect(() => {
    if (data.tables.length === 0) return;
    const exists = data.tables.some((table) => table.number === posTableNumber);
    if (!exists) {
      const fallback = [...data.tables]
        .sort((a, b) => a.number.localeCompare(b.number, 'it', { numeric: true, sensitivity: 'base' }))[0]
        ?.number;
      if (fallback) setTableNumber(fallback);
    }
  }, [data.tables, posTableNumber]);

  React.useEffect(() => {
    if (!['takeaway', 'delivery'].includes(orderMode) || !onSearchCustomers) return;
    const handle = window.setTimeout(() => {
      void onSearchCustomers({ query: takeawayCustomerName.trim(), limit: 20 });
    }, 250);
    return () => window.clearTimeout(handle);
  }, [orderMode, takeawayCustomerName, onSearchCustomers]);

  // Auto-clear success/error messages
  React.useEffect(() => {
    if (!actionSuccess && !actionError) return;
    const handle = window.setTimeout(() => {
      setActionSuccess('');
      setActionError('');
    }, 4000);
    return () => window.clearTimeout(handle);
  }, [actionSuccess, actionError]);

  const menuCategories = useMemo(() => {
    if (categories.length > 0) {
      return categories.filter((c) => c.scope === 'menu' && c.isActive);
    }
    const cats = new Set(data.menu.map((item) => item.category));
    return Array.from(cats).map((name) => ({ id: name, name, scope: 'menu' as const, isActive: true, printAreas: ['kitchen' as const], createdAt: '', updatedAt: '' }));
  }, [categories, data.menu]);

  const categoryFilterOptions = useMemo(() => {
    return ['Tutti', ...menuCategories.map((c) => c.name)];
  }, [menuCategories]);

  const filteredMenu = useMemo(() => {
    let items = data.menu;
    if (selectedCategory !== 'Tutti') items = items.filter((item) => item.category === selectedCategory);
    if (menuSearch.trim()) {
      const q = menuSearch.trim().toLowerCase();
      items = items.filter((item) => item.name.toLowerCase().includes(q));
    }
    return items;
  }, [data.menu, selectedCategory, menuSearch]);

  // Track order context for inline editing (orderId + orderItemId per item)
  type OrderedItem = OrderItem & { _orderId: string; _orderItemId: number };
  const alreadyOrdered = useMemo((): OrderedItem[] => {
    if (orderMode === 'takeaway' || orderMode === 'delivery') return [];
    const openOrders = data.orders.filter(
      (o) => o.table === posTableNumber && o.status !== 'paid' && o.status !== 'cancelled',
    );
    const grouped: Record<string, OrderedItem> = {};
    for (const order of openOrders) {
      for (const item of order.items) {
        const key = `${order.id}:${item.orderItemId ?? item.id}`;
        if (grouped[key]) {
          grouped[key].quantity += item.quantity;
        } else {
          grouped[key] = {
            ...item,
            _orderId: order.id,
            _orderItemId: item.orderItemId ?? 0,
          };
        }
      }
    }
    return Object.values(grouped);
  }, [data.orders, orderMode, posTableNumber]);

  // --- Cart operations (using store) ---
  const cartTotal = posCart.reduce((sum, item) => sum + (item.basePrice + item.modifierPriceDelta) * item.quantity, 0);
  const alreadyOrderedTotal = alreadyOrdered.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const grandTotal = cartTotal + alreadyOrderedTotal;

  // --- Modal handlers ---
  const openProductModal = (item: MenuItem, existingCartItem?: CartItem) => {
    setModalItem({ item, editCartItem: existingCartItem });
  };

  const handleModalAddToCart = (
    item: MenuItem,
    quantity: number,
    notes: string,
    ingredientOverrides: Array<{ ingredientId: string; action: 'add' | 'remove' }>,
    selectedModifiers: Array<{ groupId: string; optionId: string }>,
    modifierPriceDelta: number = 0,
    customPrice?: number,
  ) => {
    if (modalItem?.editCartItem) {
      updatePosCartItem(modalItem.editCartItem.cartItemId, {
        quantity,
        notes,
        ingredientOverrides,
        selectedModifiers,
        modifierPriceDelta,
        ...(customPrice !== undefined ? { basePrice: customPrice } : {}),
      });
    } else {
      addToPosCart({
        menuItemId: item.id,
        name: item.name,
        basePrice: customPrice !== undefined ? customPrice : item.price,
        quantity,
        notes,
        ingredientOverrides,
        selectedModifiers,
        modifierPriceDelta,
      });
    }
    setModalItem(null);
  };

  const handleModifierConfirm = (payload: {
    ingredientOverrides: Array<{ ingredientId: string; action: 'add' | 'remove' }>;
    selectedModifiers: Array<{ groupId: string; optionId: string }>;
    modifierPriceDelta: number;
  }) => {
    if (!modifierModalItem) return;
    const draft = modifierDraft;
    if (draft?.cartItemId) {
      updatePosCartItem(draft.cartItemId, {
        ...(draft ? { quantity: draft.quantity, notes: draft.notes } : {}),
        ingredientOverrides: payload.ingredientOverrides,
        selectedModifiers: payload.selectedModifiers,
        modifierPriceDelta: payload.modifierPriceDelta,
      });
    } else {
      addToPosCart({
        menuItemId: modifierModalItem.id,
        name: modifierModalItem.name,
        basePrice: modifierModalItem.price,
        quantity: draft?.quantity ?? 1,
        notes: draft?.notes ?? '',
        ingredientOverrides: payload.ingredientOverrides,
        selectedModifiers: payload.selectedModifiers,
        modifierPriceDelta: payload.modifierPriceDelta,
      });
    }
    setModifierDraft(null);
    setModifierModalItem(null);
  };

  // --- Inline quantity edit on already-sent items ---
  const handleUpdateOrderedItem = async (orderId: string, orderItemId: number, newQty: number) => {
    if (isEditingOrdered) return;
    setIsEditingOrdered(true);
    try {
      await useAppStore.getState().updateOrderItemQuantity(orderId, orderItemId, newQty);
      const key = `${orderId}:${orderItemId}`;
      setConfirmedEditKey(key);
      setTimeout(() => setConfirmedEditKey((prev) => (prev === key ? null : prev)), 1500);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Modifica non riuscita');
    } finally {
      setIsEditingOrdered(false);
    }
  };

  // --- Order submission ---
  const handleSendToKitchen = async () => {
    if (posCart.length === 0) return;
    setIsProcessing(true);
    setActionError('');
    setActionSuccess('');
    try {
      let customerId = selectedCustomerId || undefined;
      if (
        (orderMode === 'takeaway' || orderMode === 'delivery') &&
        !customerId &&
        takeawayCustomerName.trim().length >= 2 &&
        onCreateOrReuseCustomer
      ) {
        const created = await onCreateOrReuseCustomer({
          fullName: takeawayCustomerName.trim(),
          ...(takeawayCustomerPhone.trim().length > 0 ? { phone: takeawayCustomerPhone.trim() } : {}),
        });
        customerId = created.id;
        setSelectedCustomerId(created.id);
        setTakeawayCustomerName(created.fullName);
        setTakeawayCustomerPhone(created.phone ?? takeawayCustomerPhone);
      }

      const createdOrder = await createOrder({
        orderType: orderMode,
        ...(orderMode === 'dine_in' ? { table: posTableNumber } : {}),
        ...(orderMode === 'takeaway' || orderMode === 'delivery'
          ? {
              customerId,
              customerName: takeawayCustomerName.trim() || undefined,
              customerPhone: takeawayCustomerPhone.trim() || undefined,
              pickupEta: pickupEta ? new Date(pickupEta).toISOString() : undefined,
            }
          : {}),
        items: posCart.map((ci) => ({
          id: ci.menuItemId,
          name: ci.name,
          price: ci.basePrice + ci.modifierPriceDelta,
          quantity: ci.quantity,
          notes: ci.notes || undefined,
          skipKitchenPrint: skipKitchenById.has(ci.cartItemId) || undefined,
          ingredientOverrides: ci.ingredientOverrides.length > 0 ? ci.ingredientOverrides : undefined,
          selectedModifiers: ci.selectedModifiers.length > 0 ? ci.selectedModifiers : undefined,
        })),
        total: cartTotal,
        staffId: currentStaffId,
      });

      if (orderMode === 'delivery' && createdOrder?.id && upsertDeliveryOrder) {
        await upsertDeliveryOrder(createdOrder.id, {
          customerAddress: deliveryAddress.trim(),
          courierName: deliveryCourierName.trim() || undefined,
          courierPhone: deliveryCourierPhone.trim() || undefined,
          deliveryFee: Number(deliveryFee) || 0,
          status: 'new',
        });

        // Persist address to customer if not already saved
        if (customerId && deliveryAddress.trim().length >= 5) {
          const alreadySaved = customerAddresses.some(
            (a) => a.address.toLowerCase() === deliveryAddress.trim().toLowerCase(),
          );
          if (!alreadySaved) {
            createCustomerAddress(customerId, {
              address: deliveryAddress.trim(),
              isDefault: customerAddresses.length === 0,
            }).catch(() => {});
          }
        }
      }

      clearPosCart();
      setSkipKitchenById(new Set());
      setShowCartMobile(false);
      setActionSuccess(orderMode === 'delivery' ? 'Delivery creato con successo' : 'Ordine inviato in cucina');
    } catch (error) {
      // A double-tap on "Invia" makes the API middleware reject the second
      // request with 409 (same idempotency key). The order was already
      // submitted — show a clear message instead of the raw English error.
      setActionError(
        isDuplicateIdempotentError(error)
          ? 'Ordine già inviato'
          : (error instanceof Error ? error.message : 'Invio ordine non riuscito'),
      );
    } finally {
      setIsProcessing(false);
    }
  };

  // --- Checkout handlers ---
  const inventoryById = useMemo(() => new Map(data.inventory.map((e) => [e.id, e])), [data.inventory]);

  const modifierOptionNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const mi of data.menu) {
      for (const group of (mi.modifierGroups ?? []) as Array<{ id: string; options: Array<{ id: string; name: string }> }>) {
        for (const opt of group.options) {
          map.set(opt.id, opt.name);
        }
      }
    }
    return map;
  }, [data.menu]);

  const selectedTable = data.tables.find((t) => t.number === posTableNumber);

  const filteredCustomers = customers
    .filter((customer) =>
      takeawayCustomerName.trim().length === 0
        ? true
        : customer.fullName.toLowerCase().includes(takeawayCustomerName.toLowerCase()) ||
          (customer.phone ?? '').includes(takeawayCustomerPhone.trim()),
    )
    .slice(0, 8);

  return (
    <div className="flex h-full gap-4 lg:gap-8 relative">
      {/* ============ MENU SECTION ============ */}
      <div
        className={cn(
          'flex-1 flex flex-col min-w-0 transition-all duration-300',
          showCartMobile ? 'hidden lg:flex' : 'flex',
        )}
      >
        {/* ============ MOBILE HEADER ============ */}
        <div className="lg:hidden space-y-3 mb-4">
          {/* Category Pills */}
          <div className="overflow-x-auto no-scrollbar">
            <div className="flex gap-1.5">
              {categoryFilterOptions.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={cn(
                    'min-h-[44px] px-3 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap shrink-0',
                    selectedCategory === cat
                      ? 'bg-accent text-white shadow-sm'
                      : 'bg-white text-secondary border border-border',
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Customer fields (takeaway / delivery only) */}
          {orderMode !== 'dine_in' && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  value={takeawayCustomerName}
                  onChange={(e) => {
                    setTakeawayCustomerName(e.target.value);
                    setSelectedCustomerId('');
                  }}
                  placeholder="Cliente"
                  className="flex-1 px-3 py-2.5 rounded-lg border border-border text-sm bg-white"
                />
                <input
                  value={takeawayCustomerPhone}
                  onChange={(e) => setTakeawayCustomerPhone(e.target.value)}
                  placeholder="Telefono"
                  className="w-28 px-3 py-2.5 rounded-lg border border-border text-sm bg-white"
                />
              </div>
              <input
                type="datetime-local"
                value={pickupEta}
                onChange={(e) => setPickupEta(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-border text-sm bg-white"
              />
              {/* Customer dropdown */}
              {filteredCustomers.length > 0 && takeawayCustomerName.trim().length > 0 && (
                <div className="bg-white border border-border rounded-lg shadow-lg max-h-40 overflow-auto">
                  {filteredCustomers.map((customer) => (
                    <button
                      key={customer.id}
                      onClick={() => {
                        setSelectedCustomerId(customer.id);
                        setTakeawayCustomerName(customer.fullName);
                        setTakeawayCustomerPhone(customer.phone ?? '');
                        if (orderMode === 'delivery' && customer.addresses && customer.addresses.length > 0) {
                          const def = customer.addresses.find((a) => a.isDefault) ?? customer.addresses[0];
                          setDeliveryAddress(def.address);
                        }
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-bg border-b last:border-b-0 border-border/60"
                    >
                      <p className="text-sm font-bold text-secondary">{customer.fullName}</p>
                      <p className="text-[10px] text-text-muted">{customer.phone ?? 'Nessun telefono'}</p>
                    </button>
                  ))}
                </div>
              )}
              {/* Delivery-specific fields */}
              {orderMode === 'delivery' && (
                <>
                  {customerAddresses.length > 0 && (
                    <select
                      value={customerAddresses.some((a) => a.address === deliveryAddress) ? deliveryAddress : ''}
                      onChange={(e) => {
                        if (e.target.value) setDeliveryAddress(e.target.value);
                      }}
                      className="w-full px-3 py-2.5 rounded-lg border border-border text-sm bg-white"
                    >
                      {customerAddresses.map((a) => (
                        <option key={a.id} value={a.address}>{a.label ? `${a.label} — ` : ''}{a.address}</option>
                      ))}
                      <option value="">Altro indirizzo...</option>
                    </select>
                  )}
                  <input value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} placeholder="Indirizzo consegna" className="w-full px-3 py-2.5 rounded-lg border border-border text-sm bg-white" />
                  <div className="flex gap-2">
                    <input value={deliveryCourierName} onChange={(e) => setDeliveryCourierName(e.target.value)} placeholder="Corriere" className="flex-1 px-3 py-2.5 rounded-lg border border-border text-sm bg-white" />
                    <input value={deliveryCourierPhone} onChange={(e) => setDeliveryCourierPhone(e.target.value)} placeholder="Tel. corriere" className="w-28 px-3 py-2.5 rounded-lg border border-border text-sm bg-white" />
                  </div>
                  <input value={deliveryFee} onChange={(e) => setDeliveryFee(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="Delivery fee" className="w-full px-3 py-2.5 rounded-lg border border-border text-sm bg-white" />
                </>
              )}
            </div>
          )}
        </div>

        {/* Desktop Header */}
        <div className="hidden lg:flex items-center justify-between mb-6">
          <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar flex-1 mr-4">
            {categoryFilterOptions.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={cn(
                  'px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap',
                  selectedCategory === cat
                    ? 'bg-accent text-white shadow-sm'
                    : 'bg-white text-secondary hover:bg-gray-50 border border-border',
                )}
              >
                {cat}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
              <input
                value={menuSearch}
                onChange={(e) => setMenuSearch(e.target.value)}
                placeholder="Cerca..."
                className="pl-8 pr-8 py-2 rounded-lg border border-border text-xs min-h-10 w-40"
              />
              {menuSearch && (
                <button
                  onClick={() => setMenuSearch('')}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 hover:bg-bg rounded-full transition-colors text-text-muted"
                >
                  <X size={12} />
                </button>
              )}
            </div>
            <button
              onClick={() => setOrderMode('dine_in')}
              className={cn(
                'px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider border min-h-10',
                orderMode === 'dine_in' ? 'bg-primary text-white border-primary' : 'bg-white border-border',
              )}
            >
              Sala
            </button>
            <button
              onClick={() => setOrderMode('takeaway')}
              className={cn(
                'px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider border min-h-10',
                orderMode === 'takeaway' ? 'bg-primary text-white border-primary' : 'bg-white border-border',
              )}
            >
              Asporto
            </button>
            <button
              onClick={() => setOrderMode('delivery')}
              className={cn(
                'px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider border min-h-10',
                orderMode === 'delivery' ? 'bg-primary text-white border-primary' : 'bg-white border-border',
              )}
            >
              Delivery
            </button>
          </div>
          {orderMode === 'dine_in' ? (
            <button
              type="button"
              onClick={() => setShowTableActions(true)}
              className="relative flex items-center bg-white rounded-xl border border-border shadow-sm hover:border-accent transition-colors"
            >
              <div className="pl-3 py-2 text-[10px] font-bold text-text-muted uppercase tracking-tight border-r border-border/50 mr-2">
                Tavolo
              </div>
              <div className="pl-1 pr-10 py-2 bg-transparent font-bold text-accent text-sm min-w-[80px] text-left">
                {posTableNumber}
              </div>
              <ChevronDown size={14} className="absolute right-3 text-accent pointer-events-none" />
            </button>
          ) : (
            <div className="relative w-64 max-w-full space-y-1">
              <input
                value={takeawayCustomerName}
                onChange={(e) => {
                  setTakeawayCustomerName(e.target.value);
                  setSelectedCustomerId('');
                }}
                placeholder="Cliente asporto"
                className="w-full px-3 py-2 rounded-lg border border-border text-sm"
              />
              <input
                value={takeawayCustomerPhone}
                onChange={(e) => setTakeawayCustomerPhone(e.target.value)}
                placeholder="Telefono (opzionale)"
                className="w-full px-3 py-2 rounded-lg border border-border text-sm"
              />
              {(orderMode === 'takeaway' || orderMode === 'delivery') && (
                <input
                  type="datetime-local"
                  value={pickupEta}
                  onChange={(e) => setPickupEta(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border text-sm"
                />
              )}
              {filteredCustomers.length > 0 && takeawayCustomerName.trim().length > 0 && (
                <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-border rounded-lg shadow-lg max-h-44 overflow-auto">
                  {filteredCustomers.map((customer) => (
                    <button
                      key={customer.id}
                      onClick={() => {
                        setSelectedCustomerId(customer.id);
                        setTakeawayCustomerName(customer.fullName);
                        setTakeawayCustomerPhone(customer.phone ?? '');
                        if (orderMode === 'delivery' && customer.addresses && customer.addresses.length > 0) {
                          const def = customer.addresses.find((a) => a.isDefault) ?? customer.addresses[0];
                          setDeliveryAddress(def.address);
                        }
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-bg border-b last:border-b-0 border-border/60"
                    >
                      <p className="text-sm font-bold text-secondary">{customer.fullName}</p>
                      <p className="text-[10px] text-text-muted uppercase tracking-wider">{customer.phone ?? 'Nessun telefono'}</p>
                    </button>
                  ))}
                </div>
              )}
              {orderMode === 'delivery' && (
                <>
                  {customerAddresses.length > 0 && (
                    <select
                      value={customerAddresses.some((a) => a.address === deliveryAddress) ? deliveryAddress : ''}
                      onChange={(e) => {
                        if (e.target.value) setDeliveryAddress(e.target.value);
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-border text-sm"
                    >
                      {customerAddresses.map((a) => (
                        <option key={a.id} value={a.address}>{a.label ? `${a.label} — ` : ''}{a.address}</option>
                      ))}
                      <option value="">Altro indirizzo...</option>
                    </select>
                  )}
                  <input value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} placeholder="Indirizzo consegna" className="w-full px-3 py-2 rounded-lg border border-border text-sm" />
                  <input value={deliveryCourierName} onChange={(e) => setDeliveryCourierName(e.target.value)} placeholder="Corriere (opzionale)" className="w-full px-3 py-2 rounded-lg border border-border text-sm" />
                  <input value={deliveryCourierPhone} onChange={(e) => setDeliveryCourierPhone(e.target.value)} placeholder="Telefono corriere (opzionale)" className="w-full px-3 py-2 rounded-lg border border-border text-sm" />
                  <input value={deliveryFee} onChange={(e) => setDeliveryFee(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="Delivery fee" className="w-full px-3 py-2 rounded-lg border border-border text-sm" />
                </>
              )}
            </div>
          )}
        </div>

        {/* Product Grid */}
        <div className="px-2 py-1 mb-2">
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <span className="font-semibold">Prodotti:</span>
            <span className="bg-accent/10 text-accent px-2 py-0.5 rounded font-bold">
              {filteredMenu.length} / {data.menu.length}
            </span>
            {selectedCategory !== 'Tutti' && (
              <span className="text-text-muted text-[10px]">
                (filtrato: {selectedCategory})
              </span>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4 overflow-y-auto pr-2 pb-20 lg:pb-0">
          {filteredMenu.length === 0 ? (
            <div className="col-span-full py-16 flex flex-col items-center justify-center text-text-muted opacity-50">
              <Search size={36} />
              <p className="text-sm font-bold uppercase tracking-wider mt-3">
                {menuSearch ? 'Nessun piatto trovato' : 'Nessun piatto in questa categoria'}
              </p>
              {menuSearch && (
                <button
                  onClick={() => setMenuSearch('')}
                  className="mt-2 text-xs text-accent font-bold underline"
                >
                  Cancella ricerca
                </button>
              )}
            </div>
          ) : filteredMenu.map((item) => (
            <motion.button
              whileTap={{ scale: 0.97 }}
              key={item.id}
              onClick={() => openProductModal(item)}
              className="bg-white p-3 md:p-4 rounded-xl border border-border hover:border-accent hover:shadow-md transition-all text-left flex flex-col justify-between h-28 sm:h-32 md:h-36 group active:scale-[0.97]"
            >
              <div>
                <span className="text-[9px] md:text-[10px] font-bold text-accent uppercase tracking-widest mb-1 block opacity-70">
                  {item.category}
                </span>
                <h3 className="font-bold text-primary leading-tight text-xs sm:text-sm md:text-base group-hover:text-accent transition-colors line-clamp-2">
                  {item.name}
                </h3>
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-sm md:text-lg font-extrabold text-primary">€{item.price.toFixed(2)}</span>
                <div className="w-6 h-6 md:w-7 md:h-7 bg-bg rounded-lg flex items-center justify-center text-accent group-hover:bg-accent group-hover:text-white transition-all">
                  <Plus size={14} />
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* ============ CART SECTION ============ */}
      <div
        className={cn(
          'bg-white rounded-xl border border-border flex flex-col shadow-sm overflow-hidden transition-all duration-300',
          'w-full lg:w-80',
          showCartMobile ? 'flex' : 'hidden lg:flex',
        )}
      >
        <div className="px-4 py-3 border-b border-border bg-bg/30">
          <div className="flex items-center justify-between">
            <h2 className="text-[10px] sm:text-xs font-bold text-primary uppercase tracking-widest">
              {orderMode === 'dine_in' ? `Tavolo ${posTableNumber}` : orderMode === 'takeaway' ? 'Asporto' : 'Delivery'}
            </h2>
            <div className="flex items-center gap-1 text-[9px] text-text-muted">
              <User size={10} />
              <span>{currentStaffName}</span>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-6">
          {/* Already Ordered */}
          {alreadyOrdered.length > 0 && (
            <div className="space-y-1.5">
              <h3 className="text-[9px] font-bold text-text-muted uppercase tracking-widest border-b border-border pb-0.5">
                Già Ordinati
              </h3>
              {alreadyOrdered.map((item) => {
                const itemKey = `${item._orderId}:${item._orderItemId}`;
                const isConfirmed = confirmedEditKey === itemKey;
                return (
                <div
                  key={itemKey}
                  className={cn(
                    "py-0.5 rounded-md transition-all duration-300",
                    isConfirmed && "bg-green-50 ring-1 ring-green-200",
                  )}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[10px] text-secondary truncate flex-1">
                      {item.quantity}× {item.name}
                    </span>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const newQty = item.quantity > 1 ? item.quantity - 1 : 0;
                          void handleUpdateOrderedItem(item._orderId, item._orderItemId, newQty);
                        }}
                        className="w-6 h-6 flex items-center justify-center hover:bg-gray-100 rounded transition-colors active:scale-90"
                      >
                        <Minus size={11} className="text-text-muted" />
                      </button>
                      <span className="w-5 text-center text-[10px] font-bold text-secondary">{item.quantity}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleUpdateOrderedItem(item._orderId, item._orderItemId, item.quantity + 1);
                        }}
                        className="w-6 h-6 flex items-center justify-center hover:bg-gray-100 rounded transition-colors active:scale-90"
                      >
                        <Plus size={11} className="text-text-muted" />
                      </button>
                      <span className="text-[10px] font-bold ml-1">€{(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  </div>
                  {item.selectedModifiers && item.selectedModifiers.length > 0 && (
                    <p className="text-[9px] text-text-muted truncate pl-2">
                      {item.selectedModifiers.map((sm) => modifierOptionNameById.get(sm.optionId) ?? sm.optionId).join(' · ')}
                    </p>
                  )}
                  {isConfirmed && (
                    <p className="text-[9px] text-green-600 font-bold pl-2 animate-pulse">✓ Aggiornato</p>
                  )}
                </div>
                );
              })}
            </div>
          )}

          {/* New Items */}
          <div className="space-y-2">
            <h3 className="text-[10px] font-bold text-accent uppercase tracking-widest border-b border-accent/20 pb-1">
              Nuovi Articoli
            </h3>
            <AnimatePresence initial={false}>
              {posCart.length === 0 ? (
                <div className="py-8 flex flex-col items-center justify-center text-text-muted space-y-2 opacity-40">
                  <ShoppingCart size={32} />
                  <p className="text-[10px] font-bold uppercase tracking-wider text-center">
                    Tocca un piatto per aggiungerlo
                  </p>
                </div>
              ) : (
                posCart.map((item) => (
                  <motion.div
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    key={item.cartItemId}
                    className="bg-bg/50 rounded-xl px-3 py-2"
                  >
                    {/* Riga principale: nome + qty + cestino */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          const menuItem = data.menu.find((m) => m.id === item.menuItemId);
                          if (!menuItem) return;
                          const hasComplexMods = item.ingredientOverrides.length > 0 || item.selectedModifiers.length > 0;
                          if (hasComplexMods) {
                            setModifierDraft(null);
                            setModifierModalItem(menuItem);
                          } else {
                            openProductModal(menuItem, item);
                          }
                        }}
                        className="flex-1 text-left min-w-0 active:opacity-70 transition-opacity"
                      >
                        <span className="font-bold text-secondary text-xs truncate block">{item.name}</span>
                      </button>
                      <div className="flex items-center bg-white rounded-lg border border-border shrink-0">
                        <button
                          onClick={() => updatePosCartItem(item.cartItemId, { quantity: Math.max(1, item.quantity - 1) })}
                          className="w-7 h-7 flex items-center justify-center hover:bg-gray-50 rounded-l-lg transition-colors active:scale-95"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="w-6 text-center text-xs font-bold">{item.quantity}</span>
                        <button
                          onClick={() => updatePosCartItem(item.cartItemId, { quantity: item.quantity + 1 })}
                          className="w-7 h-7 flex items-center justify-center hover:bg-gray-50 rounded-r-lg transition-colors active:scale-95"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                      <span className="text-xs font-bold text-primary shrink-0">€{((item.basePrice + item.modifierPriceDelta) * item.quantity).toFixed(2)}</span>
                      <button
                        onClick={() => {
                          setSkipKitchenById((prev) => {
                            const next = new Set(prev);
                            if (next.has(item.cartItemId)) next.delete(item.cartItemId);
                            else next.add(item.cartItemId);
                            return next;
                          });
                        }}
                        className={cn(
                          'min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg transition-all shrink-0',
                          skipKitchenById.has(item.cartItemId)
                            ? 'bg-amber-50 text-amber-600'
                            : 'text-text-muted hover:text-text-muted/60',
                        )}
                        title="Salta stampa cucina"
                      >
                        <Printer size={14} className={skipKitchenById.has(item.cartItemId) ? 'line-through decoration-amber-400' : ''} />
                      </button>
                      <button
                        onClick={() => {
                          setSkipKitchenById((prev) => {
                            const next = new Set(prev);
                            next.delete(item.cartItemId);
                            return next;
                          });
                          removeFromPosCart(item.cartItemId);
                        }}
                        className="min-w-[36px] min-h-[36px] flex items-center justify-center text-text-muted hover:text-danger transition-colors shrink-0"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    {/* Note/overrides compatto */}
                    {(item.notes || item.ingredientOverrides.length > 0 || item.selectedModifiers.length > 0) && (
                      <div className="mt-1 space-y-0.5">
                        {item.notes && <p className="text-[9px] text-text-muted italic truncate">📝 {item.notes}</p>}
                        {item.selectedModifiers.length > 0 && (
                          <p className="text-[9px] text-text-muted truncate">
                            {item.selectedModifiers.map((sm) => modifierOptionNameById.get(sm.optionId) ?? sm.optionId).join(' · ')}
                          </p>
                        )}
                        {item.ingredientOverrides.length > 0 && (
                          <p className="text-[9px] truncate">
                            {item.ingredientOverrides
                              .map((e) => {
                                const name = inventoryById.get(e.ingredientId)?.name ?? e.ingredientId;
                                return e.action === 'add' ? `+${name}` : `-${name}`;
                              })
                              .join(', ')}
                          </p>
                        )}
                      </div>
                    )}
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Cart Footer */}
        <div className="px-4 py-3 border-t border-border bg-bg/30 space-y-2 shrink-0">
          <div className="flex justify-between text-sm font-bold text-primary">
            <span>Totale</span>
            <span>€{grandTotal.toFixed(2)}</span>
          </div>

          <button
            disabled={posCart.length === 0 || isProcessing || (orderMode === 'delivery' && deliveryAddress.trim().length < 5)}
            onClick={() => setShowSendConfirm(true)}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-accent text-white rounded-xl active:bg-blue-800 shadow-md transition-all disabled:opacity-50 text-xs font-bold uppercase tracking-widest active:scale-[0.98]"
          >
            <ChefHat size={18} />
            {isProcessing ? 'Invio in corso...' : orderMode === 'delivery'
              ? 'Crea Delivery'
              : 'Invia in Cucina'}
          </button>
          {posCart.length === 0 && (
            <p className="text-[9px] text-text-muted text-center">Aggiungi almeno un piatto</p>
          )}
          {posCart.length > 0 && orderMode === 'delivery' && deliveryAddress.trim().length < 5 && (
            <p className="text-[9px] text-danger text-center font-medium">Inserisci un indirizzo di consegna</p>
          )}
          {canCloseTable && selectedTable?.status === 'occupied' && (
            <button
              onClick={() => {
                if (selectedTable) {
                  useCheckoutStore.getState().openCheckout(selectedTable.id, selectedTable.number);
                  trackUxMetric('pos.checkout.open');
                }
              }}
              className="w-full flex items-center justify-center gap-2 py-3 bg-success text-white rounded-xl active:bg-green-800 shadow-md transition-all text-xs font-bold uppercase tracking-widest active:scale-[0.98]"
            >
              <Receipt size={16} />
              Chiudi Conto
            </button>
          )}
          {actionError && <p className="text-[10px] text-danger text-center font-semibold">{actionError}</p>}
          {actionSuccess && <p className="text-[10px] text-emerald-700 text-center font-semibold">{actionSuccess}</p>}

          <button
            onClick={() => setShowCartMobile(false)}
            className="lg:hidden w-full min-h-[44px] py-2.5 text-xs font-bold text-accent uppercase tracking-widest"
          >
            Torna al Menu
          </button>
        </div>
      </div>

      {/* ============ MOBILE CART FAB ============ */}
      {!showCartMobile && (posCart.length > 0 || alreadyOrdered.length > 0) && (
        <button
          onClick={() => setShowCartMobile(true)}
          className="lg:hidden fixed bottom-24 right-4 bg-accent text-white p-4 rounded-full shadow-xl z-50 flex items-center gap-2 active:scale-95 transition-transform"
        >
          <div className="relative">
            <ShoppingCart size={24} />
            {posCart.length > 0 && (
              <span className="absolute -top-2 -right-2 bg-danger text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-white">
                {posCart.reduce((s, i) => s + i.quantity, 0)}
              </span>
            )}
          </div>
          <div className="text-left">
            <p className="text-[10px] font-bold opacity-70 uppercase leading-none mb-1">
              {orderMode === 'dine_in' ? `Tavolo ${posTableNumber}` : orderMode === 'takeaway' ? 'Asporto' : 'Delivery'}
            </p>
            <p className="font-bold text-sm leading-none">€{grandTotal.toFixed(2)}</p>
          </div>
        </button>
      )}

      {/* ============ TABLE ACTIONS MODAL ============ */}
      <AnimatePresence>
        {showTableActions && orderMode === 'dine_in' && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-primary/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-5 border-b border-border flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-primary uppercase tracking-tight">
                    Azioni Tavolo {posTableNumber}
                  </h3>
                  <p className="text-xs text-text-muted font-medium">
                    Gestisci il tavolo dalla mappa dedicata
                  </p>
                </div>
                <button
                  onClick={() => setShowTableActions(false)}
                  className="p-2 hover:bg-bg rounded-full transition-colors text-text-muted"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <div className="rounded-xl border border-border p-4 bg-bg/40">
                  <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">
                    Stato attuale
                  </p>
                  <p className="mt-2 text-sm font-bold text-primary">
                    {selectedTable?.status === 'occupied'
                      ? 'Occupato'
                      : selectedTable?.status === 'reserved'
                        ? 'Prenotato'
                        : 'Libero'}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowTableActions(false);
                    onOpenTablesView?.(posTableNumber);
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-accent text-white rounded-xl hover:bg-blue-700 transition-all font-bold text-xs uppercase tracking-wider active:scale-[0.98]"
                >
                  <ArrowRight size={16} />
                  Vai alla Mappa Tavoli
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ============ PRODUCT MODAL ============ */}
      <POSProductModal
        item={modalItem?.item ?? null}
        isOpen={modalItem !== null}
        onClose={() => setModalItem(null)}
        onAddToCart={handleModalAddToCart}
        inventory={data.inventory}
        orderMode={orderMode}
        existingCartItem={modalItem?.editCartItem}
        menuItems={data.menu}
        categoryModifierPools={categoryModifierPools}
        onOpenModifierModal={(draft) => {
          if (modalItem?.item) {
            const itemToEdit = modalItem.item;
            setModifierDraft(draft ?? null);
            setModalItem(null);
            setModifierModalItem(itemToEdit);
          }
        }}
      />

      {/* ============ MODIFIER MODAL ============ */}
      {modifierModalItem && (
        <ModifierModal
          item={modifierModalItem}
          isOpen={Boolean(modifierModalItem)}
          onClose={() => { setModifierDraft(null); setModifierModalItem(null); }}
          onConfirm={handleModifierConfirm}
          inventory={data.inventory}
          bomItems={data.bomItems}
          prepItems={prepItems}
          existingOverrides={modifierDraft?.ingredientOverrides}
          existingSelectedModifiers={modifierDraft?.selectedModifiers}
          existingModifierPriceDelta={modifierDraft?.modifierPriceDelta}
          categoryModifierPools={categoryModifierPools}
        />
      )}

      {/* ============ SEND CONFIRM ============ */}
      <ConfirmDialog
        open={showSendConfirm}
        title={orderMode === 'delivery' ? 'Conferma Delivery' : 'Invia in Cucina'}
        message={orderMode === 'delivery'
          ? 'Creare il delivery?'
          : `Inviare ${posCart.length} ${posCart.length === 1 ? 'piatto' : 'piatti'} in cucina?`
        }
        confirmLabel={orderMode === 'delivery' ? 'Crea Delivery' : 'Invia'}
        onConfirm={() => {
          setShowSendConfirm(false);
          void handleSendToKitchen();
        }}
        onCancel={() => setShowSendConfirm(false)}
      />

      {/* ============ CHECKOUT MODAL ============ */}
      <CheckoutModal />
    </div>
  );
}

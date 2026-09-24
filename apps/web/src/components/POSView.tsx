import React, { useState, useMemo, useEffect } from 'react';
import { AppData, CartItem, Category, CategoryModifierPool, CreateOrderRequest, Customer, CustomerAddress, DeliveryUpsertRequest, MenuItem, Order, OrderItem, UiSettings } from '@gustopos/shared';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Minus, Trash2, User, ShoppingCart, ChefHat, ChevronDown, X, ArrowRight, Search, Receipt, Printer, Check, MapPin, MoveRight, GitMerge } from 'lucide-react';
import { cn } from '../lib/utils';
import { buildComponentNameById, buildModifierOptionNameById } from '../lib/catalog-names';
import { useAppStore } from '../store/app-store';
import { useViewport } from '../hooks/useViewport';
import { lockBodyScroll, unlockBodyScroll } from '../shared/ui/utils/scrollLock';
import { trackUxMetric } from '../shared/ux/metrics';
import POSProductModal from './POSProductModal';
import ModifierModal from './ModifierModal';
import ConfirmDialog from './ConfirmDialog';
import { CheckoutModal } from './checkout';
import { useCheckoutStore } from '../store/checkout-store';
import { fetchCustomerAddresses, createCustomerAddress, isDuplicateIdempotentError } from '../shared/api/client';
import Modal from '../shared/ui/molecules/Modal';
import TableMoveMergeDialog, { type TableRelocateMode } from './TableMoveMergeDialog';

/**
 * Takes are always for the current day, so the picker only captures a
 * `HH:mm` time. Combine it with today's date into an ISO timestamp.
 */
function buildPickupEtaIso(time: string): string | undefined {
  const match = /^(\d{2}):(\d{2})$/.exec(time.trim());
  if (!match) return undefined;
  const date = new Date();
  date.setHours(Number(match[1]), Number(match[2]), 0, 0);
  return date.toISOString();
}

function formatTimeOfDay(iso: string): string {
  const date = new Date(iso);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

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
  initialOrderId?: string | null;
  onOrderContextChange?: (orderId: string | null) => void;
  onOpenTablesView?: (tableNumber: string) => void;
  canCloseTable?: boolean;
  onTransferTable?: (sourceTableId: string, targetTableId: string) => Promise<void>;
  onMergeTable?: (sourceTableId: string, targetTableId: string) => Promise<void>;
  onSuspendTable?: (tableId: string, options: { printPreBill?: boolean }) => Promise<{ printed: boolean } | void>;
  onResumeTable?: (tableId: string) => Promise<void>;
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
  initialOrderId,
  onOrderContextChange,
  onOpenTablesView,
  canCloseTable = false,
  onTransferTable,
  onMergeTable,
  onSuspendTable,
  onResumeTable,
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
  const relocateCart = useAppStore((s) => s.relocateCart);
  const prepItems = useAppStore((s) => s.prepItems);
  const deliveryOrders = useAppStore((s) => s.deliveryOrders);
  const refreshDeliveryOrders = useAppStore((s) => s.refreshDeliveryOrders);
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
  const { band } = useViewport();
  // Side cart from tablet up, matching the shell's `md` breakpoint; the
  // full-screen overlay + FAB stay mobile-only.
  const isMobile = band === 'mobile';
  const isCartOverlay = showCartMobile && isMobile;

  // Prevent rubber-band scrolling of the shell behind the full-screen cart.
  React.useEffect(() => {
    if (!isCartOverlay) return;
    lockBodyScroll();
    return () => unlockBodyScroll();
  }, [isCartOverlay]);

  const [showCustomerDetailsModal, setShowCustomerDetailsModal] = useState(false);
  const [showTableActions, setShowTableActions] = useState(false);
  const [relocateMode, setRelocateMode] = useState<TableRelocateMode | null>(null);
  const [relocateSourceTableId, setRelocateSourceTableId] = useState('');
  const menuSearch = useAppStore((s) => s.posMenuSearch);
  const setMenuSearch = (v: string) => useAppStore.setState({ posMenuSearch: v });

  // Per-item "Salta stampa cucina" toggles (set of cart item IDs)
  const [skipKitchenById, setSkipKitchenById] = useState<Set<string>>(new Set());

  // Latest delivery address, readable inside async callbacks without stale
  // closures (used to avoid clobbering a conto address with a customer default).
  const deliveryAddressRef = React.useRef(deliveryAddress);
  React.useEffect(() => { deliveryAddressRef.current = deliveryAddress; }, [deliveryAddress]);

  // Product/modifier modal state. The draft keeps inline Base selections while
  // the secondary modifier modal is open, including for a not-yet-carted item.
  type ModifierDraft = {
    quantity: number;
    round?: number | null;
    notes: string;
    ingredientOverrides: Array<{ ingredientId: string; action: 'add' | 'remove' }>;
    selectedModifiers: Array<{ groupId: string; optionId: string }>;
    modifierPriceDelta: number;
    cartItemId?: string;
  };
  const [modalItem, setModalItem] = useState<{ item: MenuItem; editCartItem?: CartItem } | null>(null);
  const [modifierModalItem, setModifierModalItem] = useState<MenuItem | null>(null);
  const [modifierDraft, setModifierDraft] = useState<ModifierDraft | null>(null);
  const courseRoundsConfig = useAppStore((s) => s.courseRoundsConfig);
  const courseRoundsModuleEnabled = useAppStore((s) => s.courseRoundsModuleEnabled);
  const roundsActive = courseRoundsModuleEnabled && courseRoundsConfig.enabled && orderMode === 'dine_in';

  // Sync table from external navigation (e.g. tables view → POS)
  React.useEffect(() => {
    if (initialTable && initialTable !== posTableNumber) {
      setTableNumber(initialTable);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTable]);

  // Open takeaway/delivery conto: when the POS is opened from the Tables map
  // "Asporti/Consegne" section we bind to that order's hidden virtual table so
  // the waiter can add items and settle it via the standard table checkout.
  const orderContext = useMemo(
    () => (initialOrderId ? data.orders.find((order) => order.id === initialOrderId) ?? null : null),
    [initialOrderId, data.orders],
  );
  // The open conto is the source of truth while it exists: derive the mode from
  // it during render so the cart binds on the first paint (no effect race).
  const effectiveOrderMode = orderContext ? orderContext.orderType : orderMode;
  const contextMatchesMode = Boolean(orderContext);

  // Explicitly choosing a different mode leaves the open conto.
  const handleSelectMode = (mode: 'dine_in' | 'takeaway' | 'delivery') => {
    if (orderContext && orderContext.orderType !== mode) onOrderContextChange?.(null);
    setOrderMode(mode);
  };

  React.useEffect(() => {
    if (!orderContext) return;
    if (orderContext.orderType !== orderMode) setOrderMode(orderContext.orderType);
    if (orderContext.table) setTableNumber(orderContext.table);
    if (orderContext.customerId) setSelectedCustomerId(orderContext.customerId);
    setTakeawayCustomerName(orderContext.customerName ?? '');
    setTakeawayCustomerPhone(orderContext.customerPhone ?? '');
    setPickupEta(orderContext.scheduledFor ? formatTimeOfDay(orderContext.scheduledFor) : '');
    if (orderContext.orderType === 'delivery') {
      const record = deliveryOrders.find((entry) => entry.orderId === orderContext.id);
      if (record) {
        setDeliveryAddress(record.customerAddress ?? '');
        setDeliveryCourierName(record.courierName ?? '');
        setDeliveryCourierPhone(record.courierPhone ?? '');
        setDeliveryFee(String(record.deliveryFee ?? 0));
      } else {
        void refreshDeliveryOrders({ limit: 100 });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bind once per conto id
  }, [orderContext?.id]);

  // Fetch customer addresses when customer is selected for delivery
  useEffect(() => {
    if (effectiveOrderMode !== 'delivery' || !selectedCustomerId) {
      setCustomerAddresses([]); // eslint-disable-line react-hooks/set-state-in-effect -- [literal-reset] reset addresses when not in delivery mode; literal []
      return;
    }
    fetchCustomerAddresses(selectedCustomerId)
      .then((addrs) => {
        setCustomerAddresses(addrs);
        if (addrs.length > 0 && !deliveryAddressRef.current) {
          const defaultAddr = addrs.find((a) => a.isDefault) ?? addrs[0];
          setDeliveryAddress(defaultAddr.address);
        }
      })
      .catch(() => setCustomerAddresses([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deliveryAddress is read+written inside the effect (default pick on first load); adding to deps would cause infinite re-run loop
  }, [effectiveOrderMode, selectedCustomerId]);

  // Sync cart context when mode, table or open conto changes
  const activeGroupTable = contextMatchesMode
    ? orderContext?.table
    : (effectiveOrderMode === 'dine_in' && !data.tables.find((table) => table.number === posTableNumber)?.isVirtual
        ? posTableNumber
        : undefined);
  const cartContextKey = activeGroupTable
    ? `${effectiveOrderMode}:${activeGroupTable}`
    : effectiveOrderMode;

  const orderHeaderLabel = contextMatchesMode
    ? `${effectiveOrderMode === 'delivery' ? 'Consegna' : 'Asporto'}${orderContext?.customerName ? ` · ${orderContext.customerName}` : orderContext?.ticketNumber ? ` · ${orderContext.ticketNumber}` : ''}`
    : effectiveOrderMode === 'dine_in'
      ? `Tavolo ${posTableNumber}`
      : effectiveOrderMode === 'takeaway'
        ? 'Asporto'
        : 'Delivery';

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
    // In sala a virtual asporto/delivery conto is not a valid table.
    const exists = data.tables.some(
      (table) => table.number === posTableNumber && (effectiveOrderMode !== 'dine_in' || !table.isVirtual),
    );
    if (!exists) {
      const fallback = [...data.tables]
        .filter((table) => !table.isVirtual)
        .sort((a, b) => a.number.localeCompare(b.number, 'it', { numeric: true, sensitivity: 'base' }))[0]
        ?.number;
      if (fallback) setTableNumber(fallback);
    }
  }, [data.tables, posTableNumber, effectiveOrderMode]);

  React.useEffect(() => {
    if (!['takeaway', 'delivery'].includes(effectiveOrderMode) || !onSearchCustomers) return;
    const handle = window.setTimeout(() => {
      void onSearchCustomers({ query: takeawayCustomerName.trim(), limit: 20 });
    }, 250);
    return () => window.clearTimeout(handle);
  }, [effectiveOrderMode, takeawayCustomerName, onSearchCustomers]);

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
    if (!activeGroupTable) return [];
    const openOrders = data.orders.filter(
      (o) => o.table === activeGroupTable && o.status !== 'paid' && o.status !== 'cancelled',
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
  }, [data.orders, activeGroupTable]);

  // --- Cart operations (using store) ---
  const cartTotal = posCart.reduce((sum, item) => sum + (item.basePrice + item.modifierPriceDelta) * item.quantity, 0);
  const alreadyOrderedTotal = alreadyOrdered.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const grandTotal = cartTotal + alreadyOrderedTotal;

  // When portate are active, "Nuovi Articoli" are grouped by round (no-round
  // last) so the cart order matches how the kitchen ticket will be laid out,
  // even when items were added out of order. Stable within the same round.
  const sortedPosCart = useMemo(() => {
    if (!roundsActive) return posCart;
    return posCart
      .map((item, index) => ({ item, index }))
      .sort((a, b) => {
        const aRound = a.item.round ?? Number.MAX_SAFE_INTEGER;
        const bRound = b.item.round ?? Number.MAX_SAFE_INTEGER;
        if (aRound !== bRound) return aRound - bRound;
        return a.index - b.index;
      })
      .map((entry) => entry.item);
  }, [posCart, roundsActive]);

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
    round?: number | null,
  ) => {
    if (modalItem?.editCartItem) {
      updatePosCartItem(modalItem.editCartItem.cartItemId, {
        quantity,
        notes,
        ingredientOverrides,
        selectedModifiers,
        modifierPriceDelta,
        ...(roundsActive ? { round: round ?? null } : { round: undefined }),
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
        ...(roundsActive ? { round: round ?? null } : {}),
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
        ...(roundsActive ? { round: draft?.round ?? null } : { round: undefined }),
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
        ...(roundsActive ? { round: draft?.round ?? null } : {}),
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
        (effectiveOrderMode === 'takeaway' || effectiveOrderMode === 'delivery') &&
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
        orderType: effectiveOrderMode,
        ...(effectiveOrderMode === 'dine_in' || contextMatchesMode ? { table: posTableNumber } : {}),
        ...(effectiveOrderMode === 'takeaway' || effectiveOrderMode === 'delivery'
          ? {
              customerId,
              customerName: takeawayCustomerName.trim() || undefined,
              customerPhone: takeawayCustomerPhone.trim() || undefined,
              pickupEta: buildPickupEtaIso(pickupEta),
            }
          : {}),          items: sortedPosCart.map((ci) => ({
          id: ci.menuItemId,
          name: ci.name,
          price: ci.basePrice + ci.modifierPriceDelta,
          quantity: ci.quantity,
          ...(roundsActive && ci.round !== undefined ? { round: ci.round } : {}),
          notes: ci.notes || undefined,
          skipKitchenPrint: skipKitchenById.has(ci.cartItemId) || undefined,
          ingredientOverrides: ci.ingredientOverrides.length > 0 ? ci.ingredientOverrides : undefined,
          selectedModifiers: ci.selectedModifiers.length > 0 ? ci.selectedModifiers : undefined,
        })),
        total: cartTotal,
        staffId: currentStaffId,
      });

      if (effectiveOrderMode === 'delivery' && createdOrder?.id && upsertDeliveryOrder) {
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

      // Keep the POS bound to this open conto so further items are appended to
      // it and the waiter can settle it from here.
      if (effectiveOrderMode === 'takeaway' || effectiveOrderMode === 'delivery') {
        onOrderContextChange?.(createdOrder.id);
      }

      clearPosCart();
      setSkipKitchenById(new Set());
      setShowCartMobile(false);
      setActionSuccess(
        effectiveOrderMode === 'delivery'
          ? 'Delivery aggiornato con successo'
          : effectiveOrderMode === 'takeaway'
            ? (contextMatchesMode ? 'Articoli aggiunti all\'asporto' : 'Asporto creato con successo')
            : 'Ordine inviato in cucina',
      );
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

  const componentNameById = useMemo(() => buildComponentNameById(data), [data]);

  const modifierOptionNameById = useMemo(
    () => buildModifierOptionNameById({ menu: data.menu, categoryModifierPools }, componentNameById),
    [data.menu, categoryModifierPools, componentNameById],
  );

  const selectedTable = data.tables.find((t) => t.number === posTableNumber);
  const canRelocateCurrentTable =
    effectiveOrderMode === 'dine_in' &&
    (selectedTable?.status === 'occupied' || selectedTable?.status === 'suspended') &&
    Boolean(onTransferTable && onMergeTable);
  const canSuspendCurrentTable =
    effectiveOrderMode === 'dine_in' &&
    selectedTable?.status === 'occupied' &&
    Boolean(onSuspendTable);
  const canResumeCurrentTable =
    effectiveOrderMode === 'dine_in' &&
    selectedTable?.status === 'suspended' &&
    Boolean(onResumeTable);
  const [suspendPreBill, setSuspendPreBill] = useState(true);
  const [suspendBusy, setSuspendBusy] = useState(false);
  const [resumeBusy, setResumeBusy] = useState(false);
  const openRelocate = (mode: TableRelocateMode) => {
    if (!selectedTable) return;
    setRelocateSourceTableId(selectedTable.id);
    setRelocateMode(mode);
  };

  const handleSuspendTable = async () => {
    if (!selectedTable || !onSuspendTable) return;
    setSuspendBusy(true);
    setActionError('');
    try {
      await onSuspendTable(selectedTable.id, { printPreBill: suspendPreBill });
      setActionSuccess(suspendPreBill ? 'Conto sospeso · preconto inviato in cassa' : 'Conto sospeso');
      setShowTableActions(false);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Sospensione conto non riuscita');
    } finally {
      setSuspendBusy(false);
    }
  };

  const handleResumeTable = async () => {
    if (!selectedTable || !onResumeTable) return;
    setResumeBusy(true);
    setActionError('');
    try {
      await onResumeTable(selectedTable.id);
      setActionSuccess('Conto riattivato');
      setShowTableActions(false);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Riattivazione conto non riuscita');
    } finally {
      setResumeBusy(false);
    }
  };

  // After a successful move/merge, transfer the not-yet-sent cart of the
  // source table into the target table and switch the POS screen to it.
  const relocateCartToTarget = (targetTableId: string) => {
    const targetTable = data.tables.find((t) => t.id === targetTableId);
    if (!targetTable) return;
    const sourceKey = `dine_in:${posTableNumber}`;
    const targetKey = `dine_in:${targetTable.number}`;
    relocateCart(sourceKey, targetKey);
    setTableNumber(targetTable.number);
  };

  const handleTransferTable = async (sourceTableId: string, targetTableId: string) => {
    if (!onTransferTable) return;
    await onTransferTable(sourceTableId, targetTableId);
    relocateCartToTarget(targetTableId);
  };

  const handleMergeTable = async (sourceTableId: string, targetTableId: string) => {
    if (!onMergeTable) return;
    await onMergeTable(sourceTableId, targetTableId);
    relocateCartToTarget(targetTableId);
  };

  const filteredCustomers = customers
    .filter((customer) =>
      takeawayCustomerName.trim().length === 0
        ? true
        : customer.fullName.toLowerCase().includes(takeawayCustomerName.toLowerCase()) ||
          (customer.phone ?? '').includes(takeawayCustomerPhone.trim()),
    )
    .slice(0, 8);

  const customerDetailsValid = effectiveOrderMode !== 'delivery' || deliveryAddress.trim().length >= 5;
  const customerDetailsConfigured = effectiveOrderMode === 'delivery'
    ? customerDetailsValid
    : Boolean(takeawayCustomerName.trim() || takeawayCustomerPhone.trim() || pickupEta);
  const customerDetailsNeedsAttention = effectiveOrderMode === 'delivery' && !customerDetailsValid;
  const customerDetailsSummary = effectiveOrderMode === 'delivery'
    ? deliveryAddress.trim() || 'Indirizzo da aggiungere'
    : takeawayCustomerName.trim() || 'Cliente non selezionato';

  return (
    <div
      className={cn(
        'flex h-full min-h-0 gap-4 md:gap-8 relative',
        // Full-bleed on mobile while the cart sheet is open: cancel the page
        // padding (p-4) so the cart uses the whole width.
        isCartOverlay && '-mx-4',
      )}
    >
      {/* ============ MENU SECTION ============ */}
      <div
        className={cn(
          'flex-1 flex flex-col min-w-0 min-h-0 transition-all duration-300',
          isCartOverlay ? 'hidden' : 'flex',
        )}
      >
        {/* ============ MOBILE HEADER ============ */}
        <div className="md:hidden space-y-3 mb-4">
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

          {/* Takeaway / delivery details trigger (form lives in one modal for all viewports) */}
          {effectiveOrderMode !== 'dine_in' && (
            <button
              type="button"
              onClick={() => setShowCustomerDetailsModal(true)}
              className={cn(
                'w-full flex items-center justify-between gap-3 min-h-[52px] px-4 py-3 rounded-xl border text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1',
                customerDetailsNeedsAttention ? 'border-danger/50 bg-danger/5 hover:border-danger' : 'border-border bg-white hover:border-accent',
              )}
            >
              <span className="flex items-center gap-3 min-w-0">
                <span className={cn('w-9 h-9 rounded-full flex items-center justify-center shrink-0', customerDetailsNeedsAttention ? 'bg-danger/10 text-danger' : 'bg-accent/10 text-accent')}>
                  {customerDetailsNeedsAttention ? <MapPin size={17} /> : <User size={17} />}
                </span>
                <span className="min-w-0">
                  <span className="block text-[10px] font-bold uppercase tracking-widest text-text-muted">
                    {effectiveOrderMode === 'delivery' ? 'Dati consegna' : 'Dati asporto'}
                  </span>
                  <span className="block text-sm font-bold text-primary truncate">{customerDetailsSummary}</span>
                </span>
              </span>
              <span className={cn('shrink-0 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider', customerDetailsNeedsAttention ? 'text-danger' : 'text-accent')}>
                {customerDetailsNeedsAttention ? 'Completa' : customerDetailsConfigured ? <><Check size={14} /> Modifica</> : 'Aggiungi'}
              </span>
            </button>
          )}
        </div>

        {/* Desktop Header */}
        <div className="hidden md:flex items-center justify-between mb-6">
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
              onClick={() => handleSelectMode('dine_in')}
              className={cn(
                'px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider border min-h-10',
                effectiveOrderMode === 'dine_in' ? 'bg-primary text-white border-primary' : 'bg-white border-border',
              )}
            >
              Sala
            </button>
            <button
              onClick={() => handleSelectMode('takeaway')}
              className={cn(
                'px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider border min-h-10',
                effectiveOrderMode === 'takeaway' ? 'bg-primary text-white border-primary' : 'bg-white border-border',
              )}
            >
              Asporto
            </button>
            <button
              onClick={() => handleSelectMode('delivery')}
              className={cn(
                'px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider border min-h-10',
                effectiveOrderMode === 'delivery' ? 'bg-primary text-white border-primary' : 'bg-white border-border',
              )}
            >
              Delivery
            </button>
          </div>
          {effectiveOrderMode === 'dine_in' ? (
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
              {selectedTable?.status === 'suspended' && (
                <span className="absolute -top-2 left-2 rounded-full bg-warning px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-white shadow">
                  Conto sospeso
                </span>
              )}
              <ChevronDown size={14} className="absolute right-3 text-accent pointer-events-none" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowCustomerDetailsModal(true)}
              className={cn(
                'flex items-center gap-3 min-w-0 max-w-[min(20rem,30vw)] min-h-[52px] px-3 py-2 rounded-xl border text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1',
                customerDetailsNeedsAttention ? 'border-danger/50 bg-danger/5 hover:border-danger' : 'border-border bg-white hover:border-accent',
              )}
              aria-label={effectiveOrderMode === 'delivery' ? 'Apri dati consegna' : 'Apri dati asporto'}
            >
              <span className={cn('w-9 h-9 rounded-full flex items-center justify-center shrink-0', customerDetailsNeedsAttention ? 'bg-danger/10 text-danger' : 'bg-accent/10 text-accent')}>
                {customerDetailsNeedsAttention ? <MapPin size={17} /> : <User size={17} />}
              </span>
              <span className="min-w-0">
                <span className="block text-[10px] font-bold uppercase tracking-widest text-text-muted">
                  {effectiveOrderMode === 'delivery' ? 'Dati consegna' : 'Dati asporto'}
                </span>
                <span className="block max-w-52 truncate text-sm font-bold text-primary">{customerDetailsSummary}</span>
              </span>
              <span className={cn('ml-auto shrink-0 text-[10px] font-bold uppercase tracking-wider', customerDetailsNeedsAttention ? 'text-danger' : 'text-accent')}>
                {customerDetailsNeedsAttention ? 'Completa' : customerDetailsConfigured ? 'Modifica' : 'Aggiungi'}
              </span>
            </button>
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
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4 overflow-y-auto pr-2 pb-20 md:pb-0">
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
          'bg-white flex flex-col overflow-hidden min-h-0 transition-all duration-300',
          'w-full md:w-72 xl:w-80',
          'md:rounded-xl md:border md:border-border md:shadow-sm',
          isCartOverlay ? 'flex' : 'hidden md:flex',
        )}
      >
        <div className="px-3 sm:px-4 py-3 border-b border-border bg-bg/30">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[10px] sm:text-xs font-bold text-primary uppercase tracking-widest truncate">
              {orderHeaderLabel}
            </h2>
            <div className="flex items-center gap-2 shrink-0">
              {canRelocateCurrentTable && (
                <>
                  <button
                    type="button"
                    onClick={() => openRelocate('move')}
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-accent hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors"
                    aria-label="Sposta su altro tavolo"
                    title="Sposta su altro tavolo"
                  >
                    <MoveRight size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => openRelocate('merge')}
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-accent hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors"
                    aria-label="Unisci conto con un altro tavolo"
                    title="Unisci conto con un altro tavolo"
                  >
                    <GitMerge size={16} />
                  </button>
                </>
              )}
              <div className="flex items-center gap-1 text-[9px] text-text-muted">
                <User size={10} />
                <span>{currentStaffName}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-4 sm:px-4 md:p-5 md:space-y-6">
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
                sortedPosCart.map((item) => (
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
                          // Edit always opens the full product modal (qty,
                          // inline modifier chips, notes, custom price) seeded
                          // from the existing cart item; "PERSONALIZZA" inside
                          // it opens the advanced modifier modal when needed.
                          openProductModal(menuItem, item);
                        }}
                        className="flex-1 text-left min-w-0 active:opacity-70 transition-opacity"
                      >
                        <span className="font-bold text-secondary text-xs truncate block">{item.name}</span>
                        {roundsActive && item.round !== undefined && item.round !== null && (
                          <span
                            className="mt-1 inline-flex min-w-[18px] h-[18px] items-center justify-center rounded-md bg-accent px-1 text-[10px] font-bold tabular-nums text-white"
                            aria-label={courseRoundsConfig.labels[item.round] ?? `Portata ${item.round + 1}`}
                          >
                            {item.round + 1}
                          </span>
                        )}
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
                                const name = componentNameById.get(e.ingredientId) ?? inventoryById.get(e.ingredientId)?.name ?? e.ingredientId;
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
        <div className="px-3 sm:px-4 py-3 border-t border-border bg-bg/30 space-y-2 shrink-0">
          <div className="flex justify-between text-sm font-bold text-primary">
            <span>Totale</span>
            <span className="tabular-nums">€{grandTotal.toFixed(2)}</span>
          </div>

          <button
            disabled={posCart.length === 0 || isProcessing || (effectiveOrderMode === 'delivery' && deliveryAddress.trim().length < 5)}
            onClick={() => setShowSendConfirm(true)}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-accent text-white rounded-xl active:bg-blue-800 shadow-md transition-all disabled:opacity-50 text-xs font-bold uppercase tracking-widest active:scale-[0.98]"
          >
            <ChefHat size={18} />
            {isProcessing ? 'Invio in corso...' : effectiveOrderMode === 'delivery'
              ? 'Crea Delivery'
              : 'Invia in Cucina'}
          </button>
          {posCart.length === 0 && (
            <p className="text-[9px] text-text-muted text-center">Aggiungi almeno un piatto</p>
          )}
          {posCart.length > 0 && effectiveOrderMode === 'delivery' && deliveryAddress.trim().length < 5 && (
            <p className="text-[9px] text-danger text-center font-medium">Inserisci un indirizzo di consegna</p>
          )}
          {canCloseTable && (selectedTable?.status === 'occupied' || selectedTable?.status === 'suspended') && (effectiveOrderMode === 'dine_in' || contextMatchesMode) && (
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
              {contextMatchesMode ? (effectiveOrderMode === 'delivery' ? 'Incassa Consegna' : 'Incassa Asporto') : 'Chiudi Conto'}
            </button>
          )}
          {actionError && <p className="text-[10px] text-danger text-center font-semibold">{actionError}</p>}
          {actionSuccess && <p className="text-[10px] text-emerald-700 text-center font-semibold">{actionSuccess}</p>}

          <button
            onClick={() => setShowCartMobile(false)}
            className="md:hidden w-full min-h-[44px] py-2.5 text-xs font-bold text-accent uppercase tracking-widest"
          >
            Torna al Menu
          </button>
        </div>
      </div>

      {/* ============ MOBILE CART FAB ============ */}
      {isMobile && !showCartMobile && (posCart.length > 0 || alreadyOrdered.length > 0) && (
        <button
          onClick={() => setShowCartMobile(true)}
          className="md:hidden fixed bottom-24 right-4 bg-accent text-white p-4 rounded-full shadow-xl z-50 flex items-center gap-2 active:scale-95 transition-transform"
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
              {orderHeaderLabel}
            </p>
            <p className="font-bold text-sm leading-none tabular-nums">€{grandTotal.toFixed(2)}</p>
          </div>
        </button>
      )}

      {/* ============ TABLE ACTIONS MODAL ============ */}
      <AnimatePresence>
        {showTableActions && effectiveOrderMode === 'dine_in' && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-primary/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden max-h-[95dvh] flex flex-col"
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
              <div className="p-5 space-y-4 overflow-y-auto">
                <div className="rounded-xl border border-border p-4 bg-bg/40">
                  <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">
                    Stato attuale
                  </p>
                  <p className="mt-2 text-sm font-bold text-primary">
                    {selectedTable?.status === 'occupied'
                      ? 'Occupato'
                      : selectedTable?.status === 'suspended'
                        ? 'Conto sospeso (in attesa di incasso)'
                        : selectedTable?.status === 'reserved'
                          ? 'Prenotato'
                          : 'Libero'}
                  </p>
                </div>

                {canSuspendCurrentTable && (
                  <div className="space-y-2 rounded-xl border border-warning-200 bg-warning-50 p-4">
                    <p className="text-[10px] font-bold text-warning-800 uppercase tracking-widest">
                      Sospendi conto (preconto)
                    </p>
                    <label className="flex min-h-[44px] cursor-pointer items-center justify-between gap-3 text-sm text-warning-900">
                      <span className="font-semibold">Stampa preconto in cassa</span>
                      <input
                        type="checkbox"
                        checked={suspendPreBill}
                        onChange={(e) => setSuspendPreBill(e.target.checked)}
                        className="h-5 w-5 rounded border-border text-warning-700 focus:ring-warning-600"
                      />
                    </label>
                    <button
                      onClick={() => void handleSuspendTable()}
                      disabled={suspendBusy}
                      className="w-full flex items-center justify-center gap-2 py-3 bg-warning-700 text-white rounded-xl hover:bg-warning-800 transition-colors font-bold text-xs uppercase tracking-wider active:scale-[0.98] disabled:opacity-50"
                    >
                      <Receipt size={16} />
                      {suspendBusy ? 'Sospensione...' : 'Sospendi conto'}
                    </button>
                  </div>
                )}

                {canResumeCurrentTable && (
                  <button
                    onClick={() => void handleResumeTable()}
                    disabled={resumeBusy}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-warning-700 text-white rounded-xl hover:bg-warning-800 transition-colors font-bold text-xs uppercase tracking-wider active:scale-[0.98] disabled:opacity-50"
                  >
                    <Receipt size={16} />
                    {resumeBusy ? 'Riattivazione...' : 'Riattiva conto'}
                  </button>
                )}

                <button
                  onClick={() => {
                    setShowTableActions(false);
                    onOpenTablesView?.(posTableNumber);
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-accent text-white rounded-xl hover:bg-accent/90 transition-colors font-bold text-xs uppercase tracking-wider active:scale-[0.98]"
                >
                  <ArrowRight size={16} />
                  Vai alla Mappa Tavoli
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ============ TAKEAWAY / DELIVERY DETAILS MODAL ============ */}
      <Modal
        open={showCustomerDetailsModal && effectiveOrderMode !== 'dine_in'}
        onClose={() => setShowCustomerDetailsModal(false)}
        title={effectiveOrderMode === 'delivery' ? 'Dati consegna' : 'Dati asporto'}
        size="md"
        footer={(
          <>
            {effectiveOrderMode === 'delivery' && !customerDetailsValid && (
              <p className="w-full text-xs text-danger font-semibold" role="alert">
                Inserisci un indirizzo di almeno 5 caratteri per creare il delivery.
              </p>
            )}
            <button
              type="button"
              onClick={() => setShowCustomerDetailsModal(false)}
              disabled={!customerDetailsValid}
              className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-lg bg-accent text-white text-xs font-bold uppercase tracking-wider transition-all hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
            >
              Conferma dati
            </button>
          </>
        )}
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-bg/40 p-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Cliente</p>
            <p className="mt-1 text-xs text-text-muted">Cerca un cliente esistente o inserisci i dati manualmente.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-text-muted">Nome cliente</span>
              <input
                autoFocus
                value={takeawayCustomerName}
                onChange={(e) => {
                  setTakeawayCustomerName(e.target.value);
                  setSelectedCustomerId('');
                }}
                placeholder="Es. Mario Rossi"
                className="w-full min-h-[44px] px-3 py-2.5 rounded-lg border border-border text-base bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-text-muted">Telefono <span className="font-normal normal-case">(opzionale)</span></span>
              <input
                type="tel"
                value={takeawayCustomerPhone}
                onChange={(e) => setTakeawayCustomerPhone(e.target.value)}
                placeholder="Numero di telefono"
                className="w-full min-h-[44px] px-3 py-2.5 rounded-lg border border-border text-base bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-text-muted">{effectiveOrderMode === 'delivery' ? 'Orario consegna' : 'Orario ritiro'} <span className="font-normal normal-case">(opzionale)</span></span>
              <input
                type="time"
                step={300}
                value={pickupEta}
                onChange={(e) => setPickupEta(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2.5 rounded-lg border border-border text-base bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
              />
            </label>
          </div>

          {filteredCustomers.length > 0 && takeawayCustomerName.trim().length > 0 && (
            <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden" aria-label="Risultati clienti">
              <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-text-muted bg-bg/50">Clienti trovati</p>
              <div className="max-h-44 overflow-y-auto">
                {filteredCustomers.map((customer) => (
                  <button
                    type="button"
                    key={customer.id}
                    onClick={() => {
                      setSelectedCustomerId(customer.id);
                      setTakeawayCustomerName(customer.fullName);
                      setTakeawayCustomerPhone(customer.phone ?? '');
                      if (effectiveOrderMode === 'delivery' && customer.addresses && customer.addresses.length > 0) {
                        const def = customer.addresses.find((a) => a.isDefault) ?? customer.addresses[0];
                        setDeliveryAddress(def.address);
                      }
                    }}
                    className="w-full min-h-[52px] text-left px-3 py-2.5 hover:bg-bg border-b last:border-b-0 border-border/60 focus-visible:outline-none focus-visible:bg-bg focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
                  >
                    <p className="text-sm font-bold text-secondary">{customer.fullName}</p>
                    <p className="text-[10px] text-text-muted">{customer.phone ?? 'Nessun telefono'}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {effectiveOrderMode === 'delivery' && (
            <div className="space-y-3 border-t border-border pt-4">
              <div className="flex items-center gap-2">
                <MapPin size={16} className="text-accent" />
                <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Dettagli consegna</p>
              </div>
              {customerAddresses.length > 0 && (
                <label className="block">
                  <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-text-muted">Indirizzi salvati</span>
                  <select
                    value={customerAddresses.some((a) => a.address === deliveryAddress) ? deliveryAddress : ''}
                    onChange={(e) => {
                      if (e.target.value) setDeliveryAddress(e.target.value);
                    }}
                    className="w-full min-h-[44px] px-3 py-2.5 rounded-lg border border-border text-base bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
                  >
                    <option value="">Seleziona un indirizzo</option>
                    {customerAddresses.map((a) => (
                      <option key={a.id} value={a.address}>{a.label ? `${a.label} — ` : ''}{a.address}</option>
                    ))}
                  </select>
                </label>
              )}
              <label className="block">
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-text-muted">Indirizzo consegna <span className="text-danger">*</span></span>
                <input
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  placeholder="Via, numero civico, città"
                  aria-invalid={!customerDetailsValid}
                  className={cn('w-full min-h-[44px] px-3 py-2.5 rounded-lg border text-base bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1', customerDetailsValid ? 'border-border' : 'border-danger')}
                />
                {!customerDetailsValid && <span className="mt-1 block text-[10px] text-danger font-medium">L'indirizzo è obbligatorio.</span>}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-text-muted">Corriere <span className="font-normal normal-case">(opzionale)</span></span>
                  <input
                    value={deliveryCourierName}
                    onChange={(e) => setDeliveryCourierName(e.target.value)}
                    placeholder="Nome corriere"
                    className="w-full min-h-[44px] px-3 py-2.5 rounded-lg border border-border text-base bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-text-muted">Tel. corriere <span className="font-normal normal-case">(opzionale)</span></span>
                  <input
                    type="tel"
                    value={deliveryCourierPhone}
                    onChange={(e) => setDeliveryCourierPhone(e.target.value)}
                    placeholder="Telefono corriere"
                    className="w-full min-h-[44px] px-3 py-2.5 rounded-lg border border-border text-base bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
                  />
                </label>
              </div>
              <label className="block">
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-text-muted">Costo delivery</span>
                <input
                  inputMode="decimal"
                  value={deliveryFee}
                  onChange={(e) => setDeliveryFee(e.target.value.replace(/[^0-9.]/g, ''))}
                  placeholder="0.00"
                  className="w-full min-h-[44px] px-3 py-2.5 rounded-lg border border-border text-base bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
                />
              </label>
            </div>
          )}
        </div>
      </Modal>

      {/* ============ PRODUCT MODAL ============ */}
      <POSProductModal
        item={modalItem?.item ?? null}
        isOpen={modalItem !== null}
        onClose={() => setModalItem(null)}
        onAddToCart={handleModalAddToCart}
        inventory={data.inventory}
        orderMode={effectiveOrderMode}
        existingCartItem={modalItem?.editCartItem}
        menuItems={data.menu}
        courseRoundsConfig={courseRoundsConfig}
        courseRoundsModuleEnabled={courseRoundsModuleEnabled}
        categoryModifierPools={categoryModifierPools}
        onOpenModifierModal={(draft) => {          if (modalItem?.item) {
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
        title={effectiveOrderMode === 'delivery' ? 'Conferma Delivery' : 'Invia in Cucina'}
        message={effectiveOrderMode === 'delivery'
          ? 'Creare il delivery?'
          : `Inviare ${posCart.length} ${posCart.length === 1 ? 'piatto' : 'piatti'} in cucina?`
        }
        confirmLabel={effectiveOrderMode === 'delivery' ? 'Crea Delivery' : 'Invia'}
        onConfirm={() => {
          setShowSendConfirm(false);
          void handleSendToKitchen();
        }}
        onCancel={() => setShowSendConfirm(false)}
      />

      {/* ============ CHECKOUT MODAL ============ */}
      <CheckoutModal />

      {/* ============ MOVE / MERGE DIALOG ============ */}
      {relocateMode && relocateSourceTableId && onTransferTable && onMergeTable && (
        <TableMoveMergeDialog
          open
          mode={relocateMode}
          sourceTableId={relocateSourceTableId}
          data={data}
          onClose={() => {
            setRelocateMode(null);
            setRelocateSourceTableId('');
          }}
          onTransfer={handleTransferTable}
          onMerge={handleMergeTable}
        />
      )}
    </div>
  );
}

import React, { useState, useMemo, useEffect } from 'react';
import { AppData, CartItem, Category, CategoryModifierPool, CreateOrderRequest, Customer, CustomerAddress, DeliveryUpsertRequest, GhostOrder, GhostOrderItem, MenuItem, Order, OrderItem, UiSettings } from '@gustopos/shared';
import { formatCurrency, hasTenantOverride } from '@gustopos/shared';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Minus, Trash2, User, ShoppingCart, ChefHat, ChevronDown, X, ArrowRight, Search, Receipt, Printer, Check, MapPin, MoveRight, GitMerge, Send, Lock } from 'lucide-react';
import { cn } from '../lib/utils';
import { buildComponentNameById, buildModifierOptionNameById } from '../lib/catalog-names';
import { sortPosMenuAlphabetically, usesAlphabeticalPosOrder } from '../lib/pos-menu-order';
import { isOpenPriceItem } from '../lib/open-price';
import { useAppStore } from '../store/app-store';
import { useViewport } from '../hooks/useViewport';
import { lockBodyScroll, unlockBodyScroll } from '../shared/ui/utils/scrollLock';
import { trackUxMetric } from '../shared/ux/metrics';
import POSProductModal from './POSProductModal';
import ModifierModal from './ModifierModal';
import ConfirmDialog from './ConfirmDialog';
import { CheckoutModal } from './checkout';
import { useCheckoutStore } from '../store/checkout-store';
import { fetchCustomerAddresses, createCustomerAddress, isDuplicateIdempotentError, type TablePaymentStatus } from '../shared/api/client';
import { getSocket } from '../shared/api/socket';
import { useGhostOrderSync } from '../hooks/useGhostOrderSync';
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

function formatGhostAge(iso: string): string {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  return minutes < 1 ? 'ora' : `${minutes} min`;
}

/** Contesto del conto agganciato: snapshot minimo che sopravvive alla chiusura. */
interface PosOrderContext {
  id: string;
  orderType: 'dine_in' | 'takeaway' | 'delivery';
  table: string | null;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  scheduledFor?: string;
  ticketNumber?: string;
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
  initialTable = '',
  initialOrderId,
  onOrderContextChange,
  onOpenTablesView,
  canCloseTable = false,
  onTransferTable,
  onMergeTable,
  onSuspendTable,
  onResumeTable,
}: POSViewProps) {
  // The pill selection holds the CATEGORY ID (not the label): labels are
  // display-only and are free to be renamed, while `menu_items.category` is a
  // denormalized text that does NOT follow a category rename — matching on it
  // emptied entire pills (e.g. casale "PIZZERIA" vs stored "Pizzeria").
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const orderMode = useAppStore((s) => s.posOrderMode);
  // UNICO scrittore del contesto POS (vedi store: applyPosContextAction).
  const applyPosContextAction = useAppStore((s) => s.applyPosContextAction);
  const posTableNumber = useAppStore((s) => s.posTableNumber);
  const posTableId = useAppStore((s) => s.posTableId);
  const selectPosTable = useAppStore((s) => s.selectPosTable);
  const posCart = useAppStore((s) => s.posCart);
  const addToPosCart = useAppStore((s) => s.addToPosCart);
  const updatePosCartItem = useAppStore((s) => s.updatePosCartItem);
  const removeFromPosCart = useAppStore((s) => s.removeFromPosCart);
  const clearPosCart = useAppStore((s) => s.clearPosCart);
  const removePosCartItems = useAppStore((s) => s.removePosCartItems);
  const setCartContext = useAppStore((s) => s.setCartContext);
  const relocateCart = useAppStore((s) => s.relocateCart);
  const prepItems = useAppStore((s) => s.prepItems);
  const deliveryOrders = useAppStore((s) => s.deliveryOrders);
  const refreshDeliveryOrders = useAppStore((s) => s.refreshDeliveryOrders);
  const currentUser = useAppStore((s) => s.currentUser);
  const ghostOrders = useAppStore((s) => s.ghostOrders);
  const refreshGhostOrders = useAppStore((s) => s.refreshGhostOrders);
  const commitExternalGhost = useAppStore((s) => s.commitGhostOrder);
  const discardExternalGhost = useAppStore((s) => s.discardGhostOrder);
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
  // Stato pagamenti del tavolo attivo per il carrello POS (live): alimenta
  // badge PAGATO sulle voci "Già Ordinati" e il residuo in footer. Aggiornato
  // all'apertura del tavolo + a ogni cambio di ordini (socket) e dopo i paga
  // selezione (anche quelli fatti dal modal checkout, via subscription).
  const [posPaymentStatus, setPosPaymentStatus] = useState<TablePaymentStatus | null>(null);
  const checkoutPaymentStatus = useCheckoutStore((s) => s.paymentStatus);
  const checkoutTableId = useCheckoutStore((s) => s.tableId);
  const [externalGhostBusyId, setExternalGhostBusyId] = useState<string | null>(null);
  const [externalGhostConfirm, setExternalGhostConfirm] = useState<{ ghost: GhostOrder; print: boolean } | null>(null);
  const [externalGhostDiscard, setExternalGhostDiscard] = useState<GhostOrder | null>(null);
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
  // True when the selected dine-in table disappeared from the (realtime)
  // tables list while the cart still holds items. Send is blocked so the
  // dishes can never be re-bound to a different table by a silent fallback.
  const [selectedTableMissing, setSelectedTableMissing] = useState(false);
  // Cambio modalità in attesa di conferma (c'è un conto agganciato con articoli
  // non inviati nel carrello): niente switch silenziosi.
  const [pendingModeSwitch, setPendingModeSwitch] = useState<'dine_in' | 'takeaway' | 'delivery' | null>(null);
  const [relocateMode, setRelocateMode] = useState<TableRelocateMode | null>(null);
  const [relocateSourceTableId, setRelocateSourceTableId] = useState('');

  // Select a table by NUMBER (what the tables map / deep links hand us),
  // resolving its stable id. If we were flagged "table gone" and the waiter
  // picks a new one, the orphaned dine-in cart follows to the new table so the
  // dishes are never silently stranded.
  const selectTableByNumber = React.useCallback(
    (number: string) => {
      const target = data.tables.find((t) => t.number === number);
      const targetId = target?.id ?? '';
      if (selectedTableMissing) {
        const state = useAppStore.getState();
        // The orphaned cart may live under the id-keyed context or a legacy
        // number-keyed one; take whichever holds items.
        const candidateKeys = [
          state.posTableId ? `dine_in:${state.posTableId}` : '',
          state.posTableNumber ? `dine_in:${state.posTableNumber}` : '',
        ].filter(Boolean);
        const sourceKey = candidateKeys.find((k) => (state.cartStore[k]?.length ?? 0) > 0);
        if (sourceKey && targetId && sourceKey !== `dine_in:${targetId}`) {
          state.relocateCart(sourceKey, `dine_in:${targetId}`);
        }
        setSelectedTableMissing(false);
      }
      // I tavoli virtuali dei conti Asporto/Consegna non sono mai "ultimo tavolo
      // di sala": se lo fossero, il rientro in Sala ci tornerebbe sopra.
      selectPosTable(targetId, number, { virtual: target?.isVirtual === true });
    },
    [data.tables, selectedTableMissing, selectPosTable],
  );
  const menuSearch = useAppStore((s) => s.posMenuSearch);
  const setMenuSearch = (v: string) => useAppStore.setState({ posMenuSearch: v });

  // Casale renders its product grid A→Z (per-tenant capability); every other
  // tenant keeps the curated catalog order.
  const tenantContext = useAppStore((s) => s.tenantContext);
  const alphabeticalPosOrder = usesAlphabeticalPosOrder(tenantContext);

  // Per-item "Salta stampa cucina" toggles (set of cart item IDs)
  const [skipKitchenById, setSkipKitchenById] = useState<Set<string>>(new Set());

  // Open-price lines never reach a production ticket: the price is typed at the
  // POS, so they are forced down the "skip kitchen print" path (they still show
  // on the cashier/order ticket).
  const openPriceMenuItemIds = useMemo(
    () =>
      new Set(
        data.menu.filter((item) => isOpenPriceItem(item, tenantContext?.tenantId)).map((item) => item.id),
      ),
    [data.menu, tenantContext?.tenantId],
  );

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
    /** Open-price line: the price typed by the waiter, carried across the
     *  product modal → "Personalizza" modal hand-off. */
    customPrice?: number;
    cartItemId?: string;
  };
  const [modalItem, setModalItem] = useState<{
    item: MenuItem;
    editCartItem?: CartItem;
    /** Modificatori scelti in "Personalizza", che rientrano nel modal. */
    draft?: ModifierDraft;
  } | null>(null);
  const [modifierModalItem, setModifierModalItem] = useState<MenuItem | null>(null);
  const [modifierDraft, setModifierDraft] = useState<ModifierDraft | null>(null);

  // Stable identities for the modal callbacks: inline closures re-created on
  // every render churn the modal effect deps (and with the latest-ref pattern
  // in the modals this is belt-and-braces, it also avoids needless prop
  // re-renders on every viewport/socket update).
  const closeProductModal = React.useCallback(() => {
    // Il draft è l'unica via di ritorno da "Personalizza": se il modal si
    // chiude senza conferma, il draft deve andare via con lui.
    setModifierDraft(null);
    setModifierModalItem(null);
    setModalItem(null);
  }, []);
  const closeModifierModal = React.useCallback(() => {
    setModifierDraft(null);
    setModifierModalItem(null);
  }, []);
  // "Personalizza" non è un passaggio a senso unico: il modal prodotto resta
  // aperto sotto il ModifierModal (z 1400 contro z 1200), così alla conferma
  // si rientra nel modal per correggere chip/note senza dover uscire dal
  // carrello e rientrare dal prodotto. Il draft è l'unica via di ritorno:
  // alla conferma i modificatori tornano nel modal (via `existingDraft`)
  // e la linea entra nel carrello solo con "Aggiungi/Aggiorna" del modal.
  const openModifierFromProduct = React.useCallback(
    (draft?: ModifierDraft) => {
      if (!modalItem) return;
      setModifierDraft(draft ?? null);
      setModifierModalItem(modalItem.item);
    },
    [modalItem],
  );

  const courseRoundsConfig = useAppStore((s) => s.courseRoundsConfig);
  const courseRoundsModuleEnabled = useAppStore((s) => s.courseRoundsModuleEnabled);
  const roundsActive = courseRoundsModuleEnabled && courseRoundsConfig.enabled && orderMode === 'dine_in';

  // Sync table from external navigation (tables map → POS). La selezione della
  // mappa arriva già one-shot dalla route: qui la applichiamo una volta e, se
  // venivamo da un conto Asporto/Consegna, liberiamo quell'aggancio.
  React.useEffect(() => {
    if (!initialTable) return;
    const nextTable = data.tables.find((table) => table.number === initialTable);
    if (nextTable && (nextTable.id !== posTableId || orderMode !== 'dine_in')) {
      // Il carrello orfano (tavolo sparito) segue il tavolo scelto dalla mappa:
      // è la parte di logica che vive in `selectTableByNumber`.
      if (selectedTableMissing) selectTableByNumber(initialTable);
      // Selezione + modalità + slegamento del conto in una sola transizione.
      useAppStore.getState().applyPosContextAction(
        { type: 'switchMode', mode: 'dine_in', tableId: nextTable.id, tableNumber: nextTable.number },
        data.tables,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot arrival from the map
  }, [initialTable]);

  // Modalità "orfana": una postazione su Asporto/Consegna senza conto agganciato e
  // senza articoli nel carrello di quella modalità non deve sopravvivere a un
  // reload (era una delle cause del salto Sala↔Asporto all'apertura del POS).
  // La memoria della modalità vale solo se c'è lavoro in corso.
  React.useEffect(() => {
    const state = useAppStore.getState();
    if (state.posOrder) return;
    if (state.posOrderMode === 'dine_in') return;
    const hasItems = (state.cartStore[state.posOrderMode]?.length ?? 0) > 0;
    if (!hasItems && !initialTable) {
      applyPosContextAction({ type: 'switchMode', mode: 'dine_in' }, useAppStore.getState().data?.tables ?? []);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al mount
  }, []);

  // ─── Conto aperto agganciato alla postazione ──────────────────────────────
  // L'aggancio vive nello store (`posOrder`), NON è derivato da `data.orders`:
  // quando il conto viene chiuso/annullato l'ordine esce dallo snapshot live e,
  // se il contesto fosse derivato, modalità e carrello salterebbero da soli.
  const pinnedOrder = useAppStore((s) => s.posOrder);
  const socketConnected = useAppStore((s) => s.socketConnected);

  const orderContext = useMemo<PosOrderContext | null>(() => {
    if (!pinnedOrder) return null;
    const live = data.orders.find((order) => order.id === pinnedOrder.id) ?? null;
    if (!live) {
      return { ...pinnedOrder, ticketNumber: undefined };
    }
    return {
      id: live.id,
      orderType: live.orderType,
      table: live.table ?? null,
      customerId: live.customerId,
      customerName: live.customerName,
      customerPhone: live.customerPhone,
      scheduledFor: live.scheduledFor,
      ticketNumber: live.ticketNumber,
    };
  }, [pinnedOrder, data.orders]);
  const orderClosed = pinnedOrder !== null && !data.orders.some((order) => order.id === pinnedOrder.id);

  // The open conto is the source of truth while it exists: derive the mode from
  // it during render so the cart binds on the first paint (no effect race).
  const effectiveOrderMode = orderContext ? orderContext.orderType : orderMode;
  const contextMatchesMode = Boolean(orderContext);

  // Deep link `?order=`: consumato una sola volta, poi l'aggancio è nello store
  // e l'URL viene ripulito (un id morto in URL era la causa dei salti).
  React.useEffect(() => {
    if (!initialOrderId) return;
    const order = data.orders.find((entry) => entry.id === initialOrderId);
    if (!order) return;
    if (pinnedOrder?.id !== order.id) {
      applyPosContextAction(
        { type: 'pinOrder', order: { id: order.id, orderType: order.orderType, table: order.table ?? null } },
        data.tables,
      );
    }
    onOrderContextChange?.(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- consume the URL once
  }, [initialOrderId, data.orders, pinnedOrder?.id]);

  // Libera l'aggancio (conto chiuso): torna in sala sull'ultimo tavolo reale.
  const releasePinnedOrder = React.useCallback(() => {
    onOrderContextChange?.(null);
    // Slega il conto e rientra in sala sull'ultimo tavolo reale, in un'unica
    // transizione (niente modalità "mezzo slacciata").
    applyPosContextAction({ type: 'switchMode', mode: 'dine_in' }, data.tables);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dipende solo dall'aggancio corrente
  }, [applyPosContextAction, onOrderContextChange, data.tables]);

  // Un cambio di modalità esplicito lascia il conto agganciato — ma mai in
  // silenzio: con articoli non inviati nel carrello serve una conferma, perché
  // il carrello è keyed per contesto.
  const handleSelectMode = (mode: 'dine_in' | 'takeaway' | 'delivery') => {
    if (mode === effectiveOrderMode) return;
    const leavingConto = Boolean(orderContext);
    if (leavingConto && posCart.length > 0) {
      setPendingModeSwitch(mode);
      return;
    }
    applyModeSwitch(mode);
  };

  const applyModeSwitch = (mode: 'dine_in' | 'takeaway' | 'delivery') => {
    if (orderContext) onOrderContextChange?.(null);
    // Un solo scrittore: slega il conto, imposta la modalità e — in uscita dalla
    // sala — azzera la selezione; in rientro ripristina l'ultimo tavolo reale.
    applyPosContextAction({ type: 'switchMode', mode }, data.tables);
  };

  React.useEffect(() => {
    if (!orderContext) return;
    // L'aggancio allinea modalità e tavolo in una transizione sola (idempotente
    // se sono già coerenti: `pinOrder` ricalcola gli stessi valori).
    applyPosContextAction(
      { type: 'pinOrder', order: { id: orderContext.id, orderType: orderContext.orderType, table: orderContext.table ?? null } },
      data.tables,
    );
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

  // Selected table, resolved by STABLE ID first (so a rename follows) then by
  // number (legacy persisted selection). data.tables already excludes
  // soft-deleted rows, so a missing id/number means the table is gone.
  const selectedTable =
    (posTableId ? data.tables.find((t) => t.id === posTableId) : undefined)
    ?? data.tables.find((t) => t.number === posTableNumber)
    ?? null;
  const physicalDineInTable =
    effectiveOrderMode === 'dine_in' && selectedTable && !selectedTable.isVirtual ? selectedTable : null;

  // Tavolo su cui aprire la cassa: la selezione corrente oppure, per un conto
  // agganciato, il suo tavolo. I conti Asporto/Consegna vivono su tavoli
  // virtuali che la mappa non mostra: la cassa deve restare raggiungibile
  // anche se quello status non è (ancora) `occupied` nello snapshot locale.
  // Con un conto agganciato, il suo tavolo è la sorgente di verità: la
  // selezione `posTableId` può essere di un'altra postazione/switch e non
  // deve mai dirottare la cassa sul tavolo sbagliato.
  const checkoutTable =
    (orderContext?.table ? data.tables.find((table) => table.number === orderContext.table) ?? null : null)
    ?? selectedTable;
  const canOpenCheckout =
    canCloseTable &&
    checkoutTable !== null &&
    (checkoutTable.status === 'occupied' ||
      checkoutTable.status === 'suspended' ||
      (orderContext !== null && !orderClosed));
  const checkoutLabel =
    effectiveOrderMode === 'delivery' ? 'Incassa Consegna' : effectiveOrderMode === 'takeaway' ? 'Incassa Asporto' : 'Chiudi Conto';

  // Table NUMBER the cart is bound to, used to match open orders (orders store
  // the table by number).
  const activeGroupTable = contextMatchesMode
    ? orderContext?.table
    : physicalDineInTable
      ? physicalDineInTable.number
      : undefined;

  // Dine-in cart context keyed by the table ID. Because the id does NOT change
  // when a table is renamed or temporarily disappears from a realtime snapshot,
  // the cart stays bound to it instead of being stashed-and-emptied.
  const cartContextKey = contextMatchesMode
    ? `${effectiveOrderMode}:${orderContext?.table ?? ''}`
    : effectiveOrderMode === 'dine_in'
      ? posTableId
        ? `dine_in:${posTableId}`
        : 'dine_in'
      : effectiveOrderMode;

  const orderHeaderLabel = contextMatchesMode
    ? `${effectiveOrderMode === 'delivery' ? 'Consegna' : 'Asporto'}${orderContext?.customerName ? ` · ${orderContext.customerName}` : orderContext?.ticketNumber ? ` · ${orderContext.ticketNumber}` : ''}`
    : effectiveOrderMode === 'dine_in'
      ? (posTableNumber ? `Tavolo ${posTableNumber}` : 'Scegli un tavolo')
      : effectiveOrderMode === 'takeaway'
        ? 'Asporto'
        : 'Delivery';

  // ─── Presenza per la mappa tavoli ─────────────────────────────────────────
  // Dichiariano al gateway il tavolo su cui questa postazione sta lavorando, così
  // la mappa (anche da un altro terminale) mostra chi lo tiene. Solo tavoli
  // reali: i conti Asporto/Consegna vivono su tavoli virtuali fuori mappa.
  React.useEffect(() => {
    const socket = getSocket();
    const claim =
      effectiveOrderMode === 'dine_in' && selectedTable && !selectedTable.isVirtual
        ? {
            tableId: selectedTable.id,
            tableNumber: selectedTable.number,
            orderId: pinnedOrder?.id ?? null,
            orderType: effectiveOrderMode,
          }
        : null;
    const send = () => socket.emit('pos_claim_table', claim);
    if (socket.connected) send();
    socket.on('connect', send);
    return () => {
      socket.off('connect', send);
      socket.emit('pos_claim_table', null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- claim sul tavolo corrente
  }, [selectedTable?.id, selectedTable?.number, selectedTable?.isVirtual, pinnedOrder?.id, effectiveOrderMode]);

  React.useEffect(() => {
    setCartContext(cartContextKey);
  }, [cartContextKey, setCartContext]);

  // ─── Residuo live nel carrello ───────────────────────────────────────
  // Il carrello somma solo le righe NON pagate: ogni paga-selezione (fatta qui
  // o da un altro terminale) deve far scendere totale e residuo. La sorgente
  // autorevole è il server (`payment-status`), rinfrescata all'apertura del
  // tavolo, quando cambiano gli ordini (socket) e quando il modal checkout
  // incassa qualcosa.
  const posTableIdForStatus = physicalDineInTable?.id ?? null;
  React.useEffect(() => {
    if (!posTableIdForStatus) {
      setPosPaymentStatus(null);
      return;
    }
    if (posTableIdForStatus === checkoutTableId && checkoutPaymentStatus) {
      setPosPaymentStatus(checkoutPaymentStatus);
    }
  }, [posTableIdForStatus, checkoutTableId, checkoutPaymentStatus]);

  React.useEffect(() => {
    if (!posTableIdForStatus) return;
    let cancelled = false;
    const refresh = () => {
      void useAppStore.getState()
        .getTablePaymentStatus(posTableIdForStatus)
        .then((status) => {
          if (!cancelled) setPosPaymentStatus(status);
        })
        .catch(() => {
          /* transient: il prossimo refresh (socket/checkout) riprova */
        });
    };
    refresh();
    const offOrders = useAppStore.subscribe((state, prev) => {
      if (state.data?.orders !== prev.data?.orders) refresh();
    });
    return () => {
      cancelled = true;
      offOrders();
    };
  }, [posTableIdForStatus]);

  // Clear skip-kitchen-print toggles when order mode changes
  React.useEffect(() => {
    setSkipKitchenById(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset on mode change only; literal Set
  }, [orderMode]);

  React.useEffect(() => {
    if (data.tables.length === 0) return;

    // 1) Resolve and sync: follow a rename (same id, new number) and adopt a
    //    legacy persisted number once.
    if (selectedTable) {
      // Un solo set atomico (mai id e numero in due setState): in più
      // aggiorna anche `posLastDineIn*` quando il tavolo è stato rinominato
      // (stesso id, nuovo numero), altrimenti il rientro dalla sala
      // fallbackerebbe sul numero vecchio.
      if (posTableId !== selectedTable.id || posTableNumber !== selectedTable.number) {
        selectPosTable(selectedTable.id, selectedTable.number, { virtual: selectedTable.isVirtual });
      }
      setSelectedTableMissing(false);
      return;
    }

    // An open takeaway/delivery/dine-in conto drives its own context.
    if (contextMatchesMode) return;

    // 2) A previously stored selection no longer exists (deleted on another
    //    terminal). NEVER silently re-bind to another table — that is exactly
    //    how dishes end up on the wrong table (e.g. jumping to the first
    //    active table after A1/A2/… are deleted). Flag it and block Send; the
    //    waiter re-picks a table and the orphaned cart follows.
    if (posTableId || posTableNumber) {
      setSelectedTableMissing(true);
      return;
    }

    // 3) No selection at all (fresh device, or the waiter just released the
    //    conto): NO autopick. Silently binding the first table of the map is
    //    how dishes land on the wrong table; the POS asks for an explicit
    //    choice instead (the empty state and the send guard both say so).
    setSelectedTableMissing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- selectedTable identity is stable per data.tables render
  }, [data.tables, posTableId, posTableNumber, selectedTable, contextMatchesMode]);

  // One-time migration of carts saved before contexts were keyed by table ID
  // (legacy key = `dine_in:<number>`). Once the table resolves, move any unsent
  // cart onto its new id-keyed context so an upgrade doesn't lose it.
  React.useEffect(() => {
    if (effectiveOrderMode !== 'dine_in' || contextMatchesMode || !physicalDineInTable) return;
    const legacyKey = `dine_in:${physicalDineInTable.number}`;
    const newKey = `dine_in:${physicalDineInTable.id}`;
    if (legacyKey === newKey) return;
    const { cartStore } = useAppStore.getState();
    const legacyCart = cartStore[legacyKey];
    if (!legacyCart || legacyCart.length === 0) return;
    const current = cartStore[newKey];
    if (current && current.length > 0) return;
    relocateCart(legacyKey, newKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the resolved table id; relocateCart is a stable store setter
  }, [physicalDineInTable?.id, effectiveOrderMode, contextMatchesMode]);

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
    return [{ value: 'all', label: 'Tutti' }, ...menuCategories.map((c) => ({ value: c.id, label: c.name }))];
  }, [menuCategories]);

  const selectedCategoryLabel = useMemo(
    () => categoryFilterOptions.find((option) => option.value === selectedCategoryId)?.label ?? '',
    [categoryFilterOptions, selectedCategoryId],
  );

  const filteredMenu = useMemo(() => {
    let items = data.menu;
    if (selectedCategoryId !== 'all') {
      // Prefer the id; the label clause is only a safety net for rows with no
      // categoryId (legacy data) and for the no-registry fallback above, where
      // the pill "id" IS the category text.
      items = items.filter(
        (item) =>
          item.categoryId === selectedCategoryId ||
          (!item.categoryId && item.category === selectedCategoryLabel),
      );
    }
    if (menuSearch.trim()) {
      const q = menuSearch.trim().toLowerCase();
      items = items.filter((item) => item.name.toLowerCase().includes(q));
    }
    // Casale's capability: A→Z by name (also across "Tutti" and search hits).
    // Copy happens inside the helper, so `data.menu` keeps its own order.
    if (alphabeticalPosOrder) {
      items = sortPosMenuAlphabetically(items);
    }
    return items;
  }, [data.menu, selectedCategoryId, selectedCategoryLabel, menuSearch, alphabeticalPosOrder]);

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

  // Quante unità di ogni riga inviata sono già state incassate (paga selezione).
  // La riga resta visibile con badge PAGATO, ma il suo valore entra nel totale
  // solo per la parte non pagata: il carrello mostra il residuo reale.
  const paidQtyByOrderItemId = useMemo(() => {
    const map = new Map<number, number>();
    for (const item of posPaymentStatus?.items ?? []) map.set(item.orderItemId, item.paidQuantity);
    return map;
  }, [posPaymentStatus]);
  const alreadyOrderedTotal = alreadyOrdered.reduce(
    (sum, item) => sum + item.price * Math.max(0, item.quantity - (paidQtyByOrderItemId.get(item._orderItemId) ?? 0)),
    0,
  );
  const alreadyOrderedPaidTotal = alreadyOrdered.reduce(
    (sum, item) => sum + item.price * Math.min(item.quantity, paidQtyByOrderItemId.get(item._orderItemId) ?? 0),
    0,
  );
  const grandTotal = cartTotal + alreadyOrderedTotal;
  const hasPosPayments = alreadyOrderedPaidTotal > 0 || (posPaymentStatus?.paidAmount ?? 0) > 0;

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

  // ─── Ghost order (server-side mirror of the unsent cart) ────────────────
  // Dine-in only: the draft follows the physical table and is visible to the
  // cashier/admin. The local cart stays authoritative while editing.
  const ghostOrdersEnabled = useMemo(
    () => hasTenantOverride('ghostOrders', tenantContext?.tenantSlug, tenantContext?.tenantId),
    [tenantContext?.tenantSlug, tenantContext?.tenantId],
  );
  const ghostItems = useMemo<GhostOrderItem[]>(
    () => sortedPosCart.map((ci) => ({
      ...ci,
      skipKitchenPrint:
        skipKitchenById.has(ci.cartItemId) || openPriceMenuItemIds.has(ci.menuItemId)
          ? true
          : undefined,
    })),
    [sortedPosCart, skipKitchenById, openPriceMenuItemIds],
  );
  const handleGhostExternalRemoval = React.useCallback(() => {
    clearPosCart();
    setSkipKitchenById(new Set());
    setShowCartMobile(false);
    setActionError('La bozza è stata chiusa dalla cassa: il carrello è stato svuotato');
  }, [clearPosCart]);
  const ghostSync = useGhostOrderSync({
    enabled: ghostOrdersEnabled,
    active:
      effectiveOrderMode === 'dine_in' &&
      !contextMatchesMode &&
      Boolean(physicalDineInTable) &&
      !selectedTableMissing,
    tableId: physicalDineInTable?.id ?? null,
    items: ghostItems,
    onExternalRemoval: handleGhostExternalRemoval,
  });
  const ghostOrderRemoval = useAppStore((s) => s.ghostOrderRemoval);
  const ghostCommitInFlightRef = React.useRef(false);
  const committedGhostIdsRef = React.useRef<Set<string>>(new Set());

  // Another operator committed/discarded the draft: never let the owner resend
  // the same cart. The event is only acted on when it targets OUR ghost.
  useEffect(() => {
    if (!ghostOrderRemoval) return;
    if (committedGhostIdsRef.current.has(ghostOrderRemoval.id)) {
      committedGhostIdsRef.current.delete(ghostOrderRemoval.id);
      return;
    }
    if (ghostSync.ghostOrderId !== ghostOrderRemoval.id) return;
    // Our own send flow already owns the cart/messages; the server event can
    // arrive before the HTTP response.
    if (ghostCommitInFlightRef.current) {
      useAppStore.setState({ ghostOrderRemoval: null });
      return;
    }
    // Consume the event so it cannot be re-applied on a later render.
    useAppStore.setState({ ghostOrderRemoval: null });
    ghostSync.reset();
    if (ghostOrderRemoval.reason === 'committed') {
      clearPosCart();
      setSkipKitchenById(new Set());
      setShowCartMobile(false);
      setActionSuccess('Bozza inviata dalla cassa');
      return;
    }
    if (ghostOrderRemoval.reason === 'discarded') {
      clearPosCart();
      setSkipKitchenById(new Set());
      setShowCartMobile(false);
      setActionError('Bozza scartata dalla cassa: il carrello è stato svuotato');
      return;
    }
    setActionError('Il tavolo della bozza è cambiato: verifica il carrello');
  }, [ghostOrderRemoval, ghostSync.ghostOrderId, ghostSync.reset, clearPosCart]);

  // ─── Ghosts of OTHER waiters on the selected table ─────────────────────
  // The operator's own draft is already the visible cart; this strip surfaces
  // the unsent carts of colleagues so the cashier can resolve them before the
  // checkout. It never joins the payable total.
  const canCommitOtherGhosts =
    currentUser?.role === 'admin' ||
    (currentUser?.permissions ?? []).includes('ghost_orders:commit');
  const externalTableGhosts = useMemo(() => {
    if (!ghostOrdersEnabled || effectiveOrderMode !== 'dine_in' || contextMatchesMode || !physicalDineInTable) {
      return [];
    }
    return ghostOrders
      .filter((ghost) => ghost.tableId === physicalDineInTable.id && ghost.ownerStaffId !== currentStaffId)
      .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
  }, [
    ghostOrders,
    ghostOrdersEnabled,
    effectiveOrderMode,
    contextMatchesMode,
    physicalDineInTable,
    currentStaffId,
  ]);

  // Refresh on table selection: a device that missed a socket event must still
  // show the drafts before the cashier opens the checkout.
  useEffect(() => {
    if (!ghostOrdersEnabled) return;
    if (effectiveOrderMode !== 'dine_in' || contextMatchesMode || !physicalDineInTable) return;
    void refreshGhostOrders();
  }, [ghostOrdersEnabled, effectiveOrderMode, contextMatchesMode, physicalDineInTable?.id, refreshGhostOrders]);

  // A POS terminal is often backgrounded/locked: on resume, reconcile the
  // ghost list even if the socket missed events while asleep.
  useEffect(() => {
    if (!ghostOrdersEnabled) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refreshGhostOrders();
    };
    window.addEventListener('focus', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [ghostOrdersEnabled, refreshGhostOrders]);

  const handleCommitExternalGhost = async () => {
    const target = externalGhostConfirm;
    if (!target) return;
    setExternalGhostBusyId(target.ghost.id);
    setActionError('');
    setActionSuccess('');
    try {
      await commitExternalGhost(target.ghost.id, {
        expectedVersion: target.ghost.version,
        expectedTotal: target.ghost.total,
        print: target.print,
      });
      setExternalGhostConfirm(null);
      setActionSuccess(
        target.print
          ? `Bozza di ${target.ghost.ownerStaffName ?? 'cameriere'} inviata in cucina`
          : `Bozza di ${target.ghost.ownerStaffName ?? 'cameriere'} inviata senza stampa`,
      );
      await refreshGhostOrders();
    } catch (error) {
      setExternalGhostConfirm(null);
      setActionError(error instanceof Error ? error.message : 'Invio bozza non riuscito');
      void refreshGhostOrders();
    } finally {
      setExternalGhostBusyId(null);
    }
  };

  const handleDiscardExternalGhost = async () => {
    const target = externalGhostDiscard;
    if (!target) return;
    setExternalGhostBusyId(target.id);
    setActionError('');
    setActionSuccess('');
    try {
      await discardExternalGhost(target.id, {
        expectedVersion: target.version,
        reason: 'Scartata dal POS',
      });
      setExternalGhostDiscard(null);
      setActionSuccess(`Bozza di ${target.ownerStaffName ?? 'cameriere'} scartata`);
      await refreshGhostOrders();
    } catch (error) {
      setExternalGhostDiscard(null);
      setActionError(error instanceof Error ? error.message : 'Scarto bozza non riuscito');
      void refreshGhostOrders();
    } finally {
      setExternalGhostBusyId(null);
    }
  };

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
    // Open-price lines carry the price typed by the waiter; every other product
    // resyncs to its catalog price (a line saved before the JOLLY ad-hoc price
    // was removed could still carry a stale typed basePrice).
    const basePrice = customPrice ?? item.price;
    if (modalItem?.editCartItem) {
      updatePosCartItem(modalItem.editCartItem.cartItemId, {
        basePrice,
        quantity,
        notes,
        ingredientOverrides,
        selectedModifiers,
        modifierPriceDelta,
        ...(roundsActive ? { round: round ?? null } : { round: undefined }),
      });
    } else {
      addToPosCart({
        menuItemId: item.id,
        name: item.name,
        basePrice,
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
    // Il "Personalizza" non è più a senso unico quando viene dal modal
    // prodotto: `modifierDraft` è il bridge che riapre il modal prodotto con
    // i modificatori appena scelti, così chip e note si correggono lì prima
    // di mandare la linea nel carrello. Senza draft (apertura diretta)
    // si scrive subito nel carrello.
    if (draft) {
      // Rientro nel modal prodotto: i modificatori scelti in "Personalizza"
      // rientrano nel draft e la linea entra nel carrello solo con il
      // "Aggiungi/Aggiorna" del modal (chip/note restano correggibili).
      // Entrambi gli stati devono ricevere il draft AGGIORNATO: se
      // `modalItem.draft` restasse quello vecchio, le modifiche fatte dentro
      // il Personalizza non verrebbero acquisite e la stampa/cartello
      // resterebbe sulla base di default.
      const mergedDraft: ModifierDraft = {
        ...draft,
        ingredientOverrides: payload.ingredientOverrides,
        selectedModifiers: payload.selectedModifiers,
        modifierPriceDelta: payload.modifierPriceDelta,
      };
      setModalItem((current) => (current ? { ...current, draft: mergedDraft } : current));
      setModifierDraft(mergedDraft);
    } else {
      addToPosCart({
        menuItemId: modifierModalItem.id,
        name: modifierModalItem.name,
        basePrice: modifierModalItem.price,
        quantity: 1,
        notes: '',
        ...(roundsActive ? { round: null } : {}),
        ingredientOverrides: payload.ingredientOverrides,
        selectedModifiers: payload.selectedModifiers,
        modifierPriceDelta: payload.modifierPriceDelta,
      });
    }
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
    // Dine-in orders must target an ACTIVE table. Guards against a stale
    // selection (table renamed/removed on another terminal) so items can never
    // be sent to the wrong table; the API rejects it too, as a backstop.
    if (effectiveOrderMode === 'dine_in' && (!selectedTable || selectedTable.isVirtual)) {
      setActionError(
        !selectedTable
          ? 'Seleziona un tavolo prima di inviare.'
          : 'Il tavolo selezionato non è più disponibile: scegli di nuovo il tavolo prima di inviare.',
      );
      return;
    }
    setIsProcessing(true);
    setActionError('');
    setActionSuccess('');
    try {
      // Dine-in sends go through the ghost commit: one server-authoritative
      // path, idempotent, atomic with the draft tombstone. Other modes keep the
      // existing direct order flow.
      if (ghostOrdersEnabled && effectiveOrderMode === 'dine_in' && !contextMatchesMode) {
        const sentCartItemIds = ghostItems.map((item) => item.cartItemId);
        ghostCommitInFlightRef.current = true;
        try {
          const committed = await ghostSync.commit({ expectedTotal: cartTotal, print: true });
          committedGhostIdsRef.current.add(committed.ghostOrderId);
        } finally {
          ghostCommitInFlightRef.current = false;
        }
        // Preserve anything added while the commit was in flight: only the
        // lines that were actually sent leave the cart.
        removePosCartItems(sentCartItemIds);
        setSkipKitchenById(new Set());
        setShowCartMobile(false);
        setActionSuccess('Ordine inviato in cucina');
        return;
      }

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
          // An open-price line is POS-only and never prints on a production
          // station, whatever the station's own-items setting: force the skip.
          skipKitchenPrint: skipKitchenById.has(ci.cartItemId) || openPriceMenuItemIds.has(ci.menuItemId) || undefined,
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
      const message = error instanceof Error ? error.message : 'Invio ordine non riuscito';
      if (
        ghostOrdersEnabled &&
        effectiveOrderMode === 'dine_in' &&
        /changed|already|no longer open/i.test(message)
      ) {
        void useAppStore.getState().refreshGhostOrders();
      }
      setActionError(
        isDuplicateIdempotentError(error)
          ? 'Ordine già inviato'
          : /already committed/i.test(message)
            ? 'La bozza era già stata inviata dalla cassa'
            : /no longer open/i.test(message)
              ? 'La bozza è stata chiusa dalla cassa'
              : message,
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
    const sourceKey = posTableId ? `dine_in:${posTableId}` : `dine_in:${posTableNumber}`;
    const targetKey = `dine_in:${targetTable.id}`;
    if (sourceKey !== targetKey) relocateCart(sourceKey, targetKey);
    selectPosTable(targetTable.id, targetTable.number);
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
              {categoryFilterOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setSelectedCategoryId(option.value)}
                  className={cn(
                    'min-h-[44px] px-3 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap shrink-0',
                    selectedCategoryId === option.value
                      ? 'bg-accent text-white shadow-sm'
                      : 'bg-white text-secondary border border-border',
                  )}
                >
                  {option.label}
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
            {categoryFilterOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setSelectedCategoryId(option.value)}
                className={cn(
                  'px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap',
                  selectedCategoryId === option.value
                    ? 'bg-accent text-white shadow-sm'
                    : 'bg-white text-secondary hover:bg-gray-50 border border-border',
                )}
              >
                {option.label}
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
              <span
                className="absolute -bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-white px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-wider text-accent shadow ring-1 ring-border"
                title="Postazione agganciata a questo tavolo: cambia solo con un'azione esplicita"
              >
                <Lock size={8} /> Agganciato
              </span>
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
            {selectedCategoryId !== 'all' && (
              <span className="text-text-muted text-[10px]">
                (filtrato: {selectedCategoryLabel})
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
                <span className="text-sm md:text-lg font-extrabold text-primary">{formatCurrency(item.price)}</span>
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
                {/* Realtime assente = tavoli/totali potenzialmente stantii. */}
                {!socketConnected && (
                  <span
                    className="ml-1 inline-flex items-center gap-1 rounded-full bg-danger-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-danger"
                    role="status"
                    title="Connessione realtime assente: i dati possono essere non aggiornati"
                  >
                    <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-danger" />
                    <span className="sr-only">Connessione realtime assente: tavoli e totali potrebbero non essere aggiornati.</span>
                    Offline
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-4 sm:px-4 md:p-5 md:space-y-6">
          {/* Conto agganciato ma non più aperto: la postazione NON si muove da sola */}
          {orderClosed && orderContext && (
            <div className="space-y-2 rounded-xl border border-warning-200 bg-warning-50 p-3">
              <p className="text-[9px] font-bold uppercase tracking-widest text-warning-800">
                Conto chiuso
              </p>
              <p className="text-[10px] text-text-muted">
                Il conto {orderContext.ticketNumber ?? `#${orderContext.id.slice(0, 8)}`} non è più aperto.
                La postazione resta agganciata a {posTableNumber || 'questo tavolo'}: modalità e carrello non cambiano da soli.
              </p>
              <button
                type="button"
                onClick={releasePinnedOrder}
                className="w-full min-h-[44px] rounded-lg border border-warning-300 bg-white px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-warning-800"
              >
                Libera postazione
              </button>
            </div>
          )}

          {/* Other waiters' unsent drafts on this table */}
          {externalTableGhosts.length > 0 && (
            <div className="space-y-2 rounded-xl border border-warning-700/20 bg-warning-50/70 p-2.5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-[9px] font-bold uppercase tracking-widest text-warning-700">
                  Bozze sul tavolo
                </h3>
                <span className="rounded-full bg-warning-700 px-1.5 py-0.5 text-[9px] font-bold text-white tabular-nums">
                  {externalTableGhosts.length}
                </span>
              </div>
              <p className="text-[9px] text-text-muted">
                Non sono ancora nel conto.
              </p>
              {externalTableGhosts.map((ghost) => {
                const busy = externalGhostBusyId === ghost.id;
                return (
                  <div key={ghost.id} className="rounded-lg border border-warning-700/15 bg-white p-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-[11px] font-bold text-secondary">
                          {ghost.ownerStaffName ?? 'Cameriere'}
                        </p>
                        <p className="text-[9px] text-text-muted tabular-nums">
                          {ghost.itemCount} {ghost.itemCount === 1 ? 'articolo' : 'articoli'} · {formatCurrency(ghost.total)} · {formatGhostAge(ghost.updatedAt)}
                        </p>
                      </div>
                    </div>
                    <details className="mt-1">
                      <summary className="cursor-pointer text-[9px] font-semibold text-text-muted">
                        Vedi articoli
                      </summary>
                      <ul className="mt-1 space-y-0.5">
                        {ghost.items.map((item) => (
                          <li key={item.cartItemId} className="flex justify-between gap-2 text-[9px] text-text-muted">
                            <span className="truncate">{item.quantity}× {item.name}</span>
                            <span className="shrink-0 tabular-nums">
                              {formatCurrency(((item.basePrice + item.modifierPriceDelta) * item.quantity))}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </details>
                    {canCommitOtherGhosts ? (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => setExternalGhostConfirm({ ghost, print: true })}
                          className="inline-flex min-h-[44px] items-center gap-1 rounded-full bg-accent px-2 text-[9px] font-bold uppercase tracking-wider text-white disabled:opacity-50"
                        >
                          <Send size={10} /> Invia
                        </button>
                        {currentUser?.role === 'admin' && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => setExternalGhostConfirm({ ghost, print: false })}
                            className="inline-flex min-h-[44px] items-center rounded-full border border-border bg-white px-2 text-[9px] font-bold uppercase tracking-wider text-text-muted disabled:opacity-50"
                          >
                            Senza stampa
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => setExternalGhostDiscard(ghost)}
                          className="inline-flex min-h-[44px] items-center gap-1 rounded-full border border-red-200 bg-white px-2 text-[9px] font-bold uppercase tracking-wider text-red-600 disabled:opacity-50"
                        >
                          <Trash2 size={10} /> Scarta
                        </button>
                      </div>
                    ) : (
                      <p className="mt-1 text-[9px] text-text-muted">
                        Solo cassa o responsabile può inviarla.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Already Ordered */}
          {alreadyOrdered.length > 0 && (
            <div className="space-y-1.5">
              <h3 className="text-[9px] font-bold text-text-muted uppercase tracking-widest border-b border-border pb-0.5">
                Già Ordinati
              </h3>
              {alreadyOrdered.map((item) => {
                const itemKey = `${item._orderId}:${item._orderItemId}`;
                const isConfirmed = confirmedEditKey === itemKey;
                const paidQty = Math.min(item.quantity, paidQtyByOrderItemId.get(item._orderItemId) ?? 0);
                const residualQty = Math.max(0, item.quantity - paidQty);
                const fullyPaid = item.quantity > 0 && residualQty === 0;
                const residualAmount = item.price * residualQty;
                return (
                <div
                  key={itemKey}
                  className={cn(
                    "py-0.5 rounded-md transition-all duration-300",
                    isConfirmed && "bg-green-50 ring-1 ring-green-200",
                    fullyPaid && "opacity-70",
                  )}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className={cn("text-[10px] text-secondary truncate flex-1", fullyPaid && "line-through")}>
                      {item.quantity}× {item.name}
                    </span>
                    {paidQty > 0 && (
                      <span className="shrink-0 rounded-full bg-green-100 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-green-700">
                        {fullyPaid ? 'Pagato' : `Pagato ${paidQty}/${item.quantity}`}
                      </span>
                    )}
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (residualQty <= 0) {
                            setActionError('Voce già pagata: non puoi ridurla oltre le quantità incassate');
                            return;
                          }
                          const newQty = item.quantity > 1 ? item.quantity - 1 : 0;
                          void handleUpdateOrderedItem(item._orderId, item._orderItemId, newQty);
                        }}
                        disabled={residualQty <= 0}
                        className="w-6 h-6 flex items-center justify-center hover:bg-gray-100 rounded transition-colors active:scale-90 disabled:opacity-30 disabled:active:scale-100"
                      >
                        <Minus size={11} className="text-text-muted" />
                      </button>
                      <span className={cn("w-5 text-center text-[10px] font-bold", fullyPaid ? "text-green-700" : "text-secondary")}>{residualQty}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleUpdateOrderedItem(item._orderId, item._orderItemId, item.quantity + 1);
                        }}
                        className="w-6 h-6 flex items-center justify-center hover:bg-gray-100 rounded transition-colors active:scale-90"
                      >
                        <Plus size={11} className="text-text-muted" />
                      </button>
                      <span className={cn("text-[10px] font-bold ml-1", fullyPaid ? "text-green-700" : "")}>
                        {formatCurrency(residualAmount)}
                      </span>
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
            <div className="flex items-center justify-between gap-2 border-b border-accent/20 pb-1">
              <h3 className="text-[10px] font-bold text-accent uppercase tracking-widest">
                Nuovi Articoli
              </h3>
              {ghostOrdersEnabled && (ghostSync.ghostOrderId || ghostSync.state !== 'idle') && (
                <span
                  className={cn(
                    'text-[9px] font-bold uppercase tracking-wider tabular-nums',
                    ghostSync.state === 'error' ? 'text-warning-700' : 'text-text-muted',
                  )}
                  title={ghostSync.state === 'error' ? 'Bozza non sincronizzata con la cassa' : 'Bozza visibile in cassa'}
                >
                  {ghostSync.state === 'syncing'
                    ? 'Sincronizzo…'
                    : ghostSync.state === 'error'
                      ? 'Non sincronizzata'
                      : 'Bozza condivisa'}
                </span>
              )}
            </div>
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
                      <span className="text-xs font-bold text-primary shrink-0">{formatCurrency(((item.basePrice + item.modifierPriceDelta) * item.quantity))}</span>
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
                          'min-w-[36px] min-h-[44px] flex items-center justify-center rounded-lg transition-all shrink-0',
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
                        className="min-w-[36px] min-h-[44px] flex items-center justify-center text-text-muted hover:text-danger transition-colors shrink-0"
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
          {hasPosPayments && (
            <div className="flex justify-between text-[11px] font-semibold text-green-700">
              <span>Già incassato</span>
              <span className="tabular-nums">{formatCurrency(alreadyOrderedPaidTotal)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm font-bold text-primary">
            <span>{hasPosPayments ? 'Rimanente da pagare' : 'Totale'}</span>
            <span className={cn("tabular-nums", hasPosPayments && "text-accent")}>{formatCurrency(grandTotal)}</span>
          </div>
          {cartTotal === 0 && alreadyOrdered.length > 0 && alreadyOrderedTotal === 0 && (
            <p className="text-[9px] font-bold uppercase tracking-wider text-green-700 text-center">
              Conto interamente incassato — chiudi il conto
            </p>
          )}

          <button
            disabled={posCart.length === 0 || isProcessing || selectedTableMissing || (effectiveOrderMode === 'delivery' && deliveryAddress.trim().length < 5)}
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
          {selectedTableMissing && (
            <p className="text-[9px] text-danger text-center font-medium" role="alert">Tavolo non più disponibile: riseleziona un tavolo (il carrello verrà spostato)</p>
          )}
          {canOpenCheckout && checkoutTable && (
            <button
              onClick={() => {
                useCheckoutStore.getState().openCheckout(checkoutTable.id, checkoutTable.number);
                trackUxMetric('pos.checkout.open');
              }}
              className="w-full flex items-center justify-center gap-2 py-3 bg-success text-white rounded-xl active:bg-green-800 shadow-md transition-all text-xs font-bold uppercase tracking-widest active:scale-[0.98]"
            >
              <Receipt size={16} />
              {checkoutLabel}
            </button>
          )}
          {/* `role="alert"` + `aria-live`: un invio fallito deve essere annunciato
              anche a chi usa uno screen reader (TablesView lo faceva già). */}
          <div aria-live="polite" className="contents">
            {actionError && (
              <p role="alert" className="text-xs text-danger text-center font-semibold">{actionError}</p>
            )}
            {actionSuccess && (
              <p role="status" className="text-xs text-emerald-700 text-center font-semibold">{actionSuccess}</p>
            )}
          </div>

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
            <p className="font-bold text-sm leading-none tabular-nums">{formatCurrency(grandTotal)}</p>
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
                    {posTableNumber ? `Azioni Tavolo ${posTableNumber}` : 'Nessun tavolo selezionato'}
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
                  {posTableNumber ? 'Vai alla Mappa Tavoli' : 'Scegli un tavolo dalla mappa'}
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
        onClose={closeProductModal}
        onAddToCart={handleModalAddToCart}
        inventory={data.inventory}
        orderMode={effectiveOrderMode}
        existingCartItem={modalItem?.editCartItem}
        existingDraft={modalItem?.draft}
        menuItems={data.menu}
        courseRoundsConfig={courseRoundsConfig}
        courseRoundsModuleEnabled={courseRoundsModuleEnabled}
        categoryModifierPools={categoryModifierPools}
        onOpenModifierModal={openModifierFromProduct}
      />

      {/* ============ MODIFIER MODAL ============ */}
      {modifierModalItem && (
        <ModifierModal
          item={modifierModalItem}
          isOpen={Boolean(modifierModalItem)}
          onClose={closeModifierModal}
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

      {/* ============ EXTERNAL GHOST CONFIRM ============ */}
      <ConfirmDialog
        open={externalGhostConfirm !== null}
        title={externalGhostConfirm?.print === false ? 'Inviare la bozza senza stampa?' : 'Inviare la bozza in cucina?'}
        message={
          externalGhostConfirm
            ? `Tavolo ${physicalDineInTable?.number ?? ''} · ${externalGhostConfirm.ghost.ownerStaffName ?? 'Cameriere'} · ${externalGhostConfirm.ghost.itemCount} articoli · ${formatCurrency(externalGhostConfirm.ghost.total)}.${externalGhostConfirm.print === false ? ' Nessun ticket verrà stampato: l’operazione è tracciata nell’audit.' : ''}`
            : ''
        }
        confirmLabel={externalGhostConfirm?.print === false ? 'Invia senza stampa' : 'Invia'}
        onConfirm={() => { void handleCommitExternalGhost(); }}
        onCancel={() => setExternalGhostConfirm(null)}
      />

      {/* ============ EXTERNAL GHOST DISCARD ============ */}
      <ConfirmDialog
        open={externalGhostDiscard !== null}
        title="Scartare la bozza?"
        message={
          externalGhostDiscard
            ? `La bozza di ${externalGhostDiscard.ownerStaffName ?? 'cameriere'} per il tavolo ${externalGhostDiscard.tableNumber} verrà eliminata e il carrello del cameriere svuotato.`
            : ''
        }
        confirmLabel="Scarta"
        onConfirm={() => { void handleDiscardExternalGhost(); }}
        onCancel={() => setExternalGhostDiscard(null)}
      />

      {/* ============ MODE SWITCH CONFIRM (lock) ============ */}
      <ConfirmDialog
        open={pendingModeSwitch !== null}
        title="Cambiare modalità?"
        message={`Ci sono ${posCart.length} articoli non inviati nel carrello di ${effectiveOrderMode === 'dine_in' ? `Tavolo ${posTableNumber}` : effectiveOrderMode === 'takeaway' ? 'Asporto' : 'Delivery'}. Lasciando questo conto restano nel carrello della modalità attuale e non verranno inviati: confermi il cambio?`}
        confirmLabel="Cambia modalità"
        onConfirm={() => {
          const next = pendingModeSwitch;
          setPendingModeSwitch(null);
          if (next) applyModeSwitch(next);
        }}
        onCancel={() => setPendingModeSwitch(null)}
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

import { create } from 'zustand';
import type { PaymentMethod, MarkShareAsPaidRequest } from '@gustopos/shared';
import type { TablePaymentStatus } from '../shared/api/client';
import { useAppStore } from './app-store';

export type CheckoutStep = 'main' | 'split' | 'pay_items' | 'close';

export interface SplitShare {
  shareIndex: number;
  amount: number;
  method: PaymentMethod;
  gatewayReference: string;
  // Importo in contanti consegnato per questa quota (per il resto).
  tendered: string;
  isPaid: boolean;
  paymentId?: string;
}

export interface PayItemSelection {
  orderItemId: number;
  quantity: number;
}

interface CheckoutState {
  isOpen: boolean;
  step: CheckoutStep;
  busy: boolean;
  error: string;
  
  tableId: string | null;
  tableNumber: string | null;
  paymentStatus: TablePaymentStatus | null;
  
  splitShares: SplitShare[];
  splitPeople: number;
  // Quote editabili in bozza: importi modificati in UI, da salvare col server.
  splitDraft: Record<number, string>;
  
  payItemsSelected: PayItemSelection[];
  payItemsMethod: PaymentMethod;
  payItemsGatewayRef: string;
  // Incassato contanti per la selezione (per il resto).
  payItemsTendered: string;
  
  closeMethod: PaymentMethod;
  paidAmount: string;
  discountAmount: string;
  surchargeAmount: string;
  gatewayReference: string;
  // Opt-in certified fiscal emission (Path B). Default OFF — the operator
  // explicitly enables fiscal for the transaction on the close screen.
  fiscalEmit: boolean;
  // Per-transaction cashier close-receipt toggle: when false the receipt is
  // NOT printed for this close. Defaults to ON (operator opts out when needed).
  printReceipt: boolean;
  setFiscalEmit: (enabled: boolean) => void;
  setPrintReceipt: (enabled: boolean) => void;
  
  openCheckout: (tableId: string, tableNumber: string) => Promise<void>;
  closeCheckout: () => void;
  setStep: (step: CheckoutStep) => void;
  
  loadPaymentStatus: () => Promise<void>;
  
  setSplitPeople: (people: number) => void;
  initSplit: (people: number) => Promise<void>;
  cancelSplit: () => Promise<void>;
  updateShareMethod: (shareIndex: number, method: PaymentMethod) => void;
  updateShareGatewayRef: (shareIndex: number, ref: string) => void;
  updateShareTendered: (shareIndex: number, tendered: string) => void;
  setSplitDraft: (shareIndex: number, amount: string) => void;
  resetSplitDraft: () => void;
  saveSplitShares: () => Promise<void>;
  markShareAsPaid: (shareIndex: number) => Promise<void>;
  
  addPayItem: (orderItemId: number) => void;
  removePayItem: (orderItemId: number) => void;
  updatePayItemQuantity: (orderItemId: number, quantity: number) => void;
  setPayItemsMethod: (method: PaymentMethod) => void;
  setPayItemsGatewayRef: (ref: string) => void;
  setPayItemsTendered: (tendered: string) => void;
  paySelectedItems: (tableId: string) => Promise<void>;
  
  setCloseMethod: (method: PaymentMethod) => void;
  setPaidAmount: (amount: string) => void;
  setDiscountAmount: (amount: string) => void;
  setSurchargeAmount: (amount: string) => void;
  setGatewayReference: (ref: string) => void;
  closeTable: (tableId: string) => Promise<void>;
}

export const useCheckoutStore = create<CheckoutState>((set, get) => ({
  isOpen: false,
  step: 'main',
  busy: false,
  error: '',
  
  tableId: null,
  tableNumber: null,
  paymentStatus: null,
  
  splitShares: [],
  splitPeople: 2,
  splitDraft: {},
  
  payItemsSelected: [],
  payItemsMethod: 'cash',
  payItemsGatewayRef: '',
  payItemsTendered: '',
  
  closeMethod: 'cash',
  paidAmount: '',
  discountAmount: '',
  surchargeAmount: '',
  gatewayReference: '',
  fiscalEmit: false,
  printReceipt: true,
  
  openCheckout: async (tableId, tableNumber) => {
    // Drop the previous conto's status before loading: the modal must never
    // render one table's payment totals next to another table's rows.
    set({ isOpen: true, step: 'main', tableId, tableNumber, error: '', paymentStatus: null });
    // The rows/total shown here come from the socket-backed store, while the
    // amounts due come from a server-fresh payment status. Reconcile the
    // snapshot first so a missed order event cannot pair stale lines with a
    // fresh total (e.g. a conto already closed by another terminal).
    await useAppStore.getState().reconcileOperationalData();
    await get().loadPaymentStatus();
  },
  
  closeCheckout: () => {
    set({
      isOpen: false,
      step: 'main',
      tableId: null,
      tableNumber: null,
      paymentStatus: null,
      splitShares: [],
      splitPeople: 2,
      splitDraft: {},
      payItemsSelected: [],
      payItemsMethod: 'cash',
      payItemsGatewayRef: '',
      payItemsTendered: '',
      closeMethod: 'cash',
      paidAmount: '',
      discountAmount: '',
      surchargeAmount: '',
      gatewayReference: '',
      fiscalEmit: false,
      printReceipt: true,
      error: '',
      busy: false,
    });
  },
  
  setStep: (step) => set({ step, error: '' }),
  
  loadPaymentStatus: async () => {
    const { tableId } = get();
    if (!tableId) return;
    
    try {
      const status = await useAppStore.getState().getTablePaymentStatus(tableId);
      set({ paymentStatus: status });

      if (status.splitShares && status.splitShares.length > 0 && get().splitShares.length === 0) {
        set({
          splitShares: status.splitShares.map((s) => ({
            shareIndex: s.shareIndex,
            amount: s.amount,
            method: s.method as PaymentMethod,
            gatewayReference: s.gatewayReference ?? '',
            tendered: '',
            isPaid: s.isPaid,
            paymentId: s.paymentId,
          })),
          splitPeople: status.splitShares.length,
        });
      }
    } catch (error) {
      console.error('Failed to load payment status:', error);
      set({ error: 'Failed to load payment status' });
    }
  },
  
  setSplitPeople: (people) => set({ splitPeople: people }),
  
  initSplit: async (people) => {
    const { tableId } = get();
    if (!tableId) return;

    set({ busy: true, error: '' });

    try {
      const result = await useAppStore.getState().splitBill(tableId, { people, persist: true });
      const shares: SplitShare[] = result.payments?.map((p, i) => ({
        shareIndex: p.shareIndex ?? i,
        amount: p.total,
        method: p.method as PaymentMethod,
        gatewayReference: '',
        tendered: '',
        isPaid: p.paymentStatus === 'captured',
        paymentId: p.id,
      })) ?? [];
      set({ splitShares: shares, splitPeople: people, splitDraft: {}, busy: false });
    } catch (err) {
      // Nessuna quota di ripiego calcolata qui: quote mai persistite non sono
      // pagabili ("No pending payment found for share N") e farebbero credere al
      // cameriere che il conto sia già diviso. Le quote già mostrate restano:
      // il server ha annullato la transazione, quindi sono ancora valide.
      set({
        busy: false,
        error: err instanceof Error ? err.message : 'Failed to initialize split',
      });
    }
  },

  cancelSplit: async () => {
    const { tableId } = get();
    if (!tableId) return;

    set({ busy: true, error: '' });

    try {
      await useAppStore.getState().cancelSplitBill(tableId);
      set({ splitShares: [], splitDraft: {}, busy: false });
      await get().loadPaymentStatus();
    } catch (error) {
      set({ busy: false, error: error instanceof Error ? error.message : 'Failed to cancel split' });
    }
  },
  
  updateShareMethod: (shareIndex, method) => {
    set((state) => ({
      splitShares: state.splitShares.map((share) =>
        share.shareIndex === shareIndex ? { ...share, method } : share
      ),
    }));
  },
  
  updateShareGatewayRef: (shareIndex, ref) => {
    set((state) => ({
      splitShares: state.splitShares.map((share) =>
        share.shareIndex === shareIndex ? { ...share, gatewayReference: ref } : share
      ),
    }));
  },

  updateShareTendered: (shareIndex, tendered) => {
    set((state) => ({
      splitShares: state.splitShares.map((share) =>
        share.shareIndex === shareIndex ? { ...share, tendered } : share
      ),
    }));
  },

  setSplitDraft: (shareIndex, amount) => {
    set((state) => ({ splitDraft: { ...state.splitDraft, [shareIndex]: amount } }));
  },

  resetSplitDraft: () => set({ splitDraft: {} }),

  saveSplitShares: async () => {
    const { tableId, splitShares, splitDraft } = get();
    if (!tableId || splitShares.length === 0) return;
    const pending = splitShares.filter((s) => !s.isPaid).sort((a, b) => a.shareIndex - b.shareIndex);
    const amounts = pending.map((s) => {
      const raw = splitDraft[s.shareIndex];
      const v = raw !== undefined && raw.trim() !== '' ? Number(raw) : s.amount;
      return Number(v.toFixed(2));
    });
    set({ busy: true, error: '' });
    try {
      const result = await useAppStore.getState().updateSplitShares(tableId, { amounts });
      const byIndex = new Map(result.payments.map((p) => [p.shareIndex ?? -1, p]));
      set((state) => ({
        splitShares: state.splitShares.map((s) => {
          const p = byIndex.get(s.shareIndex);
          return p && !s.isPaid ? { ...s, amount: p.total } : s;
        }),
        splitDraft: {},
        busy: false,
      }));
      await get().loadPaymentStatus();
    } catch (error) {
      set({ busy: false, error: error instanceof Error ? error.message : 'Failed to update shares' });
    }
  },
  
  markShareAsPaid: async (shareIndex) => {
    const { tableId, splitShares, fiscalEmit, printReceipt } = get();
    if (!tableId) return;
    
    const share = splitShares.find((s) => s.shareIndex === shareIndex);
    if (!share) return;
    
    set({ busy: true, error: '' });
    
    try {
      const tenderedNum = share.tendered.trim() !== '' && Number.isFinite(Number(share.tendered)) ? Number(share.tendered) : undefined;
      const payload: MarkShareAsPaidRequest = {
        method: share.method,
        ...(tenderedNum !== undefined ? { paidAmount: tenderedNum } : {}),
        ...(share.method !== 'cash' && share.gatewayReference.trim().length >= 3
          ? { gatewayReference: share.gatewayReference.trim() }
          : {}),
        ...(fiscalEmit ? { fiscalEmit: true } : {}),
        printReceipt,
      };
      
      const result = await useAppStore.getState().markShareAsPaid(tableId, shareIndex, payload);
      
      set((state) => ({
        splitShares: state.splitShares.map((s) =>
          s.shareIndex === shareIndex ? { ...s, isPaid: true, paymentId: result.payment.id } : s
        ),
        busy: false,
      }));
      
      await get().loadPaymentStatus();

      // If all shares are now paid, the backend auto-closed the table — close the checkout modal
      if (result.allSharesPaid) {
        get().closeCheckout();
      }
    } catch (error) {
      set({ busy: false, error: error instanceof Error ? error.message : 'Failed to mark share as paid' });
    }
  },
  
  addPayItem: (orderItemId) => {
    set((state) => {
      const existing = state.payItemsSelected.find((i) => i.orderItemId === orderItemId);
      if (existing) {
        return {
          payItemsSelected: state.payItemsSelected.map((i) =>
            i.orderItemId === orderItemId ? { ...i, quantity: i.quantity + 1 } : i
          ),
        };
      }
      return { payItemsSelected: [...state.payItemsSelected, { orderItemId, quantity: 1 }] };
    });
  },
  
  removePayItem: (orderItemId) => {
    set((state) => ({
      payItemsSelected: state.payItemsSelected.filter((i) => i.orderItemId !== orderItemId),
    }));
  },
  
  updatePayItemQuantity: (orderItemId, quantity) => {
    if (quantity <= 0) {
      get().removePayItem(orderItemId);
      return;
    }
    set((state) => {
      const exists = state.payItemsSelected.some((i) => i.orderItemId === orderItemId);
      if (exists) {
        return {
          payItemsSelected: state.payItemsSelected.map((i) =>
            i.orderItemId === orderItemId ? { ...i, quantity } : i
          ),
        };
      }
      return {
        payItemsSelected: [...state.payItemsSelected, { orderItemId, quantity }],
      };
    });
  },
  
  setPayItemsMethod: (method) => set({ payItemsMethod: method }),
  
  setPayItemsGatewayRef: (ref) => set({ payItemsGatewayRef: ref }),
  
  setPayItemsTendered: (tendered) => set({ payItemsTendered: tendered }),
  
  paySelectedItems: async (tableId) => {
    const { payItemsSelected, payItemsMethod, payItemsGatewayRef, payItemsTendered, fiscalEmit, printReceipt } = get();
    if (payItemsSelected.length === 0) return;
    
    set({ busy: true, error: '' });
    
    try {
      const tenderedNum = payItemsTendered.trim() !== '' && Number.isFinite(Number(payItemsTendered)) ? Number(payItemsTendered) : undefined;
      const result = await useAppStore.getState().paySelectedItems(tableId, {
        items: payItemsSelected,
        method: payItemsMethod,
        paymentStatus: 'captured',
        ...(tenderedNum !== undefined ? { paidAmount: tenderedNum } : {}),
        ...(payItemsMethod !== 'cash' && payItemsGatewayRef.trim().length >= 3
          ? { gatewayReference: payItemsGatewayRef.trim() }
          : {}),
        ...(fiscalEmit ? { fiscalEmit: true } : {}),
        printReceipt,
      });

      // If all items are now paid, the backend auto-closed the table — close checkout
      if (result.allItemsPaid) {
        set({
          payItemsSelected: [],
          payItemsMethod: 'cash',
          payItemsGatewayRef: '',
          payItemsTendered: '',
          busy: false,
        });
        get().closeCheckout();
        return;
      }

      // Residuo subito in carrello/checkout: svuotiamo la selezione e ricarichiamo
      // lo status (totali tagliati + rimanente aggiornato) dalla risposta server.
      set({
        payItemsSelected: [],
        payItemsMethod: 'cash',
        payItemsGatewayRef: '',
        payItemsTendered: '',
        busy: false,
      });

      await get().loadPaymentStatus();
    } catch (error) {
      set({ busy: false, error: error instanceof Error ? error.message : 'Failed to pay selected items' });
    }
  },
  
  setCloseMethod: (method) => set({ closeMethod: method }),
  
  setPaidAmount: (amount) => set({ paidAmount: amount }),
  
  setDiscountAmount: (amount) => set({ discountAmount: amount }),
  
  setSurchargeAmount: (amount) => set({ surchargeAmount: amount }),
  
  setGatewayReference: (ref) => set({ gatewayReference: ref }),
  
  setFiscalEmit: (enabled) => set({ fiscalEmit: enabled }),
  
  setPrintReceipt: (enabled) => set({ printReceipt: enabled }),
  
  closeTable: async (tableId) => {
    const { closeMethod, paidAmount, discountAmount, surchargeAmount, gatewayReference, fiscalEmit, printReceipt } = get();
    
    set({ busy: true, error: '' });
    
    try {
      await useAppStore.getState().closeTable(tableId, {
        method: closeMethod,
        ...(paidAmount.trim().length > 0 && Number.isFinite(Number(paidAmount)) ? { paidAmount: Number(paidAmount) } : {}),
        ...(discountAmount.trim().length > 0 && Number.isFinite(Number(discountAmount)) ? { discountAmount: Math.max(0, Number(discountAmount)) } : {}),
        ...(surchargeAmount.trim().length > 0 && Number.isFinite(Number(surchargeAmount)) ? { surchargeAmount: Math.max(0, Number(surchargeAmount)) } : {}),
        ...(closeMethod !== 'cash' && gatewayReference.trim().length > 0 ? { gatewayReference: gatewayReference.trim() } : {}),
        paymentStatus: 'captured',
        ...(fiscalEmit ? { fiscalEmit: true } : {}),
        printReceipt,
      });
      
      get().closeCheckout();
    } catch (error) {
      set({ busy: false, error: error instanceof Error ? error.message : 'Failed to close table' });
    }
  },
}));

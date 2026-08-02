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
  
  payItemsSelected: PayItemSelection[];
  payItemsMethod: PaymentMethod;
  payItemsGatewayRef: string;
  
  closeMethod: PaymentMethod;
  paidAmount: string;
  discountAmount: string;
  surchargeAmount: string;
  gatewayReference: string;
  // Opt-in certified fiscal emission (Path B). Default OFF — the operator
  // explicitly enables fiscal for the transaction on the close screen.
  fiscalEmit: boolean;
  setFiscalEmit: (enabled: boolean) => void;
  
  openCheckout: (tableId: string, tableNumber: string) => Promise<void>;
  closeCheckout: () => void;
  setStep: (step: CheckoutStep) => void;
  
  loadPaymentStatus: () => Promise<void>;
  
  setSplitPeople: (people: number) => void;
  initSplit: (people: number, totalAmount: number) => Promise<void>;
  updateShareMethod: (shareIndex: number, method: PaymentMethod) => void;
  updateShareGatewayRef: (shareIndex: number, ref: string) => void;
  markShareAsPaid: (shareIndex: number) => Promise<void>;
  
  addPayItem: (orderItemId: number) => void;
  removePayItem: (orderItemId: number) => void;
  updatePayItemQuantity: (orderItemId: number, quantity: number) => void;
  setPayItemsMethod: (method: PaymentMethod) => void;
  setPayItemsGatewayRef: (ref: string) => void;
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
  
  payItemsSelected: [],
  payItemsMethod: 'cash',
  payItemsGatewayRef: '',
  
  closeMethod: 'cash',
  paidAmount: '',
  discountAmount: '',
  surchargeAmount: '',
  gatewayReference: '',
  fiscalEmit: false,
  
  openCheckout: async (tableId, tableNumber) => {
    set({ isOpen: true, step: 'main', tableId, tableNumber, error: '' });
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
      payItemsSelected: [],
      payItemsMethod: 'cash',
      payItemsGatewayRef: '',
      closeMethod: 'cash',
      paidAmount: '',
      discountAmount: '',
      surchargeAmount: '',
      gatewayReference: '',
      fiscalEmit: false,
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
  
  initSplit: async (people, totalAmount) => {
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
        isPaid: p.paymentStatus === 'captured',
        paymentId: p.id,
      })) ?? [];
      set({ splitShares: shares, splitPeople: people, busy: false });
    } catch (err) {
      const perPerson = Math.floor((totalAmount / people) * 100) / 100;
      const shares: SplitShare[] = [];
      let allocated = 0;
      for (let i = 0; i < people; i++) {
        const amount = i === people - 1 ? totalAmount - allocated : perPerson;
        allocated += amount;
        shares.push({ shareIndex: i, amount: Math.round(amount * 100) / 100, method: 'cash', gatewayReference: '', isPaid: false });
      }
      set({ splitShares: shares, splitPeople: people, busy: false, error: err instanceof Error ? err.message : 'Failed to initialize split' });
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
  
  markShareAsPaid: async (shareIndex) => {
    const { tableId, splitShares } = get();
    if (!tableId) return;
    
    const share = splitShares.find((s) => s.shareIndex === shareIndex);
    if (!share) return;
    
    set({ busy: true, error: '' });
    
    try {
      const payload: MarkShareAsPaidRequest = {
        method: share.method,
        ...(share.method !== 'cash' && share.gatewayReference.trim().length >= 3
          ? { gatewayReference: share.gatewayReference.trim() }
          : {}),
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
  
  paySelectedItems: async (tableId) => {
    const { payItemsSelected, payItemsMethod, payItemsGatewayRef } = get();
    if (payItemsSelected.length === 0) return;
    
    set({ busy: true, error: '' });
    
    try {
      const result = await useAppStore.getState().paySelectedItems(tableId, {
        items: payItemsSelected,
        method: payItemsMethod,
        paymentStatus: 'captured',
        ...(payItemsMethod !== 'cash' && payItemsGatewayRef.trim().length >= 3
          ? { gatewayReference: payItemsGatewayRef.trim() }
          : {}),
      });

      // If all items are now paid, the backend auto-closed the table — close checkout
      if (result.allItemsPaid) {
        set({
          payItemsSelected: [],
          payItemsMethod: 'cash',
          payItemsGatewayRef: '',
          busy: false,
        });
        get().closeCheckout();
        return;
      }

      set({
        payItemsSelected: [],
        payItemsMethod: 'cash',
        payItemsGatewayRef: '',
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
  
  closeTable: async (tableId) => {
    const { closeMethod, paidAmount, discountAmount, surchargeAmount, gatewayReference, fiscalEmit } = get();
    
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
      });
      
      get().closeCheckout();
    } catch (error) {
      set({ busy: false, error: error instanceof Error ? error.message : 'Failed to close table' });
    }
  },
}));

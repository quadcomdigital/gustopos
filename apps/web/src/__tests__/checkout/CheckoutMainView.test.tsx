import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { TablePaymentStatus } from '../../shared/api/client';

// ─── Mock stores before importing the component ───────────────────────────

const mockSetStep = vi.fn();
const mockSetDiscountAmount = vi.fn();
const mockSetSurchargeAmount = vi.fn();
const mockCloseCheckout = vi.fn();

let checkoutStoreState = {
  tableId: 'table-1',
  tableNumber: '5',
  paymentStatus: null as TablePaymentStatus | null,
  setStep: mockSetStep,
  discountAmount: '',
  surchargeAmount: '',
  setDiscountAmount: mockSetDiscountAmount,
  setSurchargeAmount: mockSetSurchargeAmount,
  closeCheckout: mockCloseCheckout,
};

vi.mock('../../store/checkout-store', () => ({
  useCheckoutStore: (selector?: (state: typeof checkoutStoreState) => unknown) =>
    selector ? selector(checkoutStoreState) : checkoutStoreState,
}));

const mockData = {
  tables: [
    { id: 'table-1', number: '5', status: 'occupied' as const, currentOrderId: 'order-1' },
  ],
  orders: [
    {
      id: 'order-1', table: '5', status: 'pending' as const, total: 25.50, timestamp: '2026-07-30T12:00:00Z',
      items: [
        { id: 'item-1', orderItemId: 1, name: 'Pizza Margherita', quantity: 2, price: 10, notes: '', selectedModifiers: [], ingredientOverrides: [] },
        { id: 'item-2', orderItemId: 2, name: 'Coca Cola', quantity: 1, price: 3.50, notes: '', selectedModifiers: [], ingredientOverrides: [] },
      ],
    },
  ],
  menu: [],
  inventory: [],
  staff: [],
  customers: [],
  bomItems: [],
  prepItems: [],
  categories: [],
  categoryModifierPools: [],
  uiSettings: { brandName: 'Test', theme: { bg: '#fff', textMain: '#000', textMuted: '#666', primary: '#000', accent: '#000', secondary: '#000', border: '#ccc', surface: '#f5f5f5', success: '#0f0', danger: '#f00', warning: '#ff0', info: '#00f' }, taxRate: 0.1, printing: { protocol: 'disabled' as const, logoMode: 'none' as const, logoWidth: 384, logoThreshold: 128, activeAreas: [], receiptFooter: '', autoPrintKitchen: false, autoPrintOnClose: false } },
};

vi.mock('../../store/app-store', () => ({
  useAppStore: (selector: (state: { data: typeof mockData | null }) => unknown) => {
    return selector({ data: mockData });
  },
}));

// ─── Now import the component ──────────────────────────────────────────────

import CheckoutMainView from '../../components/checkout/CheckoutMainView';

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('CheckoutMainView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checkoutStoreState = {
      ...checkoutStoreState,
      discountAmount: '',
      surchargeAmount: '',
      paymentStatus: null,
    };
  });

  it('renders order items', () => {
    render(<CheckoutMainView />);
    expect(screen.getByText('Pizza Margherita')).toBeInTheDocument();
    expect(screen.getByText('Coca Cola')).toBeInTheDocument();
  });

  it('renders item quantities', () => {
    render(<CheckoutMainView />);
    expect(screen.getByText('2x')).toBeInTheDocument();
    expect(screen.getByText('1x')).toBeInTheDocument();
  });

  it('shows action buttons when not paid', () => {
    render(<CheckoutMainView />);
    expect(screen.getByText('Dividi il conto')).toBeInTheDocument();
    expect(screen.getByText('Paga selezione')).toBeInTheDocument();
    expect(screen.getByText('Paga tutto')).toBeInTheDocument();
  });

  it('shows "Tutto pagato" when fully paid', () => {
    checkoutStoreState.paymentStatus = {
      totalAmount: 25.50,
      paidAmount: 25.50,
      remainingAmount: 0,
      items: [
        { orderItemId: 1, name: 'Pizza Margherita', price: 10, totalQuantity: 2, paidQuantity: 2, availableQuantity: 0, fullyPaid: true },
        { orderItemId: 2, name: 'Coca Cola', price: 3.50, totalQuantity: 1, paidQuantity: 1, availableQuantity: 0, fullyPaid: true },
      ],
    };
    render(<CheckoutMainView />);
    expect(screen.getByText('Tutto pagato')).toBeInTheDocument();
    expect(screen.getByText('Chiudi')).toBeInTheDocument();
    expect(screen.queryByText('Dividi il conto')).not.toBeInTheDocument();
  });

  it('shows remaining amount when partially paid', () => {
    checkoutStoreState.paymentStatus = {
      totalAmount: 25.50,
      paidAmount: 10.00,
      remainingAmount: 15.50,
      items: [
        { orderItemId: 1, name: 'Pizza Margherita', price: 10, totalQuantity: 2, paidQuantity: 1, availableQuantity: 1, fullyPaid: false },
        { orderItemId: 2, name: 'Coca Cola', price: 3.50, totalQuantity: 1, paidQuantity: 0, availableQuantity: 1, fullyPaid: false },
      ],
    };
    render(<CheckoutMainView />);
    expect(screen.getByText('Rimanente')).toBeInTheDocument();
    expect(screen.getByText('Paga tutto')).toBeInTheDocument();
  });

  it('calls setStep when clicking "Dividi il conto"', async () => {
    render(<CheckoutMainView />);
    await userEvent.click(screen.getByText('Dividi il conto'));
    expect(mockSetStep).toHaveBeenCalledWith('split');
  });

  it('calls setStep when clicking "Paga tutto"', async () => {
    render(<CheckoutMainView />);
    await userEvent.click(screen.getByText('Paga tutto'));
    expect(mockSetStep).toHaveBeenCalledWith('close');
  });

  it('has discount and surcharge inputs', () => {
    render(<CheckoutMainView />);
    expect(screen.getByPlaceholderText('Sconto €')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Magg. €')).toBeInTheDocument();
  });
});

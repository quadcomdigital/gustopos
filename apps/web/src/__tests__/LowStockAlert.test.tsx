import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LowStockAlert from '../components/inventory/LowStockAlert';

const suggestions = [
  {
    ingredientId: 'ingredient-1',
    name: 'Pomodoro',
    sku: 'POM-001',
    currentQty: 1,
    minThreshold: 5,
    unit: 'kg',
    deficit: 4,
    preferredSupplierName: 'Fornitore Test',
    lastUnitCost: 2.5,
  },
];

describe('LowStockAlert', () => {
  it('keeps the purchasing CTA hidden until an opener is provided', () => {
    render(<LowStockAlert suggestions={suggestions} />);

    expect(screen.queryByRole('button', { name: 'Apri Acquisti' })).not.toBeInTheDocument();
  });

  it('opens the purchasing flow from the expanded alert', async () => {
    const onOpenPurchasing = vi.fn();
    render(<LowStockAlert suggestions={suggestions} onOpenPurchasing={onOpenPurchasing} />);

    await userEvent.click(screen.getByRole('button', { name: /articolo sotto soglia/i }));
    const purchasingButton = screen.getByRole('button', { name: 'Apri Acquisti' });

    expect(purchasingButton).toBeInTheDocument();
    await userEvent.click(purchasingButton);

    expect(onOpenPurchasing).toHaveBeenCalledOnce();
  });
});

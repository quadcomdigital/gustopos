import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Open price is a per-tenant capability read from tenantContext in the app
// store: point it at franks, the tenant that owns the PRODOTTO open-price line.
vi.mock('../store/app-store', () => ({
  useAppStore: (selector: (state: { tenantContext: { tenantId: string } | null }) => unknown) =>
    selector({ tenantContext: { tenantId: 'ten_26ed333e-9dbd-43f7-85b1-fe57054e9e6f' } }),
}));

import POSProductModal from '../components/POSProductModal';
import type { CourseRoundsConfig, MenuItem } from '@gustopos/shared';

const prodotto: MenuItem = {
  id: 'item-prodotto',
  name: 'PRODOTTO',
  price: 0,
  category: 'PRODOTTO',
  categoryId: 'cat_prodotto',
  printAreas: [],
  isJolly: false,
  isOpenPrice: true,
  ingredients: [],
  recipe: [],
  modifiers: [],
  modifierGroups: [],
};

// An ordinary product: the open-price field must never appear on it, even for
// franks.
const coca: MenuItem = {
  id: 'item-coca',
  name: 'COCA COLA',
  price: 3,
  category: 'Bevande',
  categoryId: 'cat_bevande',
  printAreas: [],
  isJolly: false,
  isOpenPrice: false,
  ingredients: [],
  recipe: [],
  modifiers: [],
  modifierGroups: [],
};

const courseRounds = { enabled: false, labels: ['1ª portata'], required: false } satisfies CourseRoundsConfig;

function setup(item: MenuItem = prodotto) {
  const onAddToCart = vi.fn();
  const { container } = render(
    <POSProductModal
      item={item}
      isOpen
      onClose={() => {}}
      onAddToCart={onAddToCart as never}
      inventory={[]}
      orderMode="dine_in"
      menuItems={[item]}
      courseRoundsConfig={courseRounds}
      courseRoundsModuleEnabled={false}
    />,
  );
  return { onAddToCart, container };
}

function typePrice(value: string) {
  fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value } });
}

function quotedPrice(): string | null {
  const button = screen.queryByRole('button', { name: /Aggiungi ·|Aggiorna/ });
  return button?.textContent ?? null;
}

describe('POSProductModal — PRODOTTO, prezzo ad-hoc digitato dal waiter', () => {
  it('mostra il campo "Prezzo ad-hoc" per il prodotto open-price', () => {
    setup();
    expect(screen.getByText('Prezzo ad-hoc')).toBeTruthy();
    expect(screen.getByPlaceholderText('0.00')).toBeTruthy();
  });

  it('non mostra il campo su un prodotto normale', () => {
    setup(coca);
    expect(screen.queryByText('Prezzo ad-hoc')).toBeNull();
    expect(screen.queryByPlaceholderText('0.00')).toBeNull();
  });

  it('blocca l\'aggiunta finché il prezzo non è maggiore di zero', () => {
    setup();
    const confirm = screen.getByRole('button', { name: /Aggiungi ·/ });
    expect(confirm.hasAttribute('disabled')).toBe(true);

    typePrice('12.5');
    expect(screen.getByRole('button', { name: /Aggiungi ·/ }).hasAttribute('disabled')).toBe(false);
  });

  it('usa il prezzo digitato come base della riga', () => {
    const { onAddToCart } = setup();
    typePrice('12.5');

    expect(quotedPrice()).toContain('€12.50');
    expect(screen.getByText('€12.50')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Aggiungi ·/ }));
    const args = onAddToCart.mock.calls.at(-1) as unknown as unknown[];
    // (item, quantity, notes, overrides, modifiers, delta, customPrice, round)
    expect(args[6]).toBe(12.5);
    expect(args[5]).toBe(0);
  });

  it('moltiplica il prezzo digitato per la quantità', () => {
    const { container } = setup();
    typePrice('4');

    const plus = container.querySelector('.lucide-plus')?.closest('button');
    expect(plus).toBeTruthy();
    fireEvent.click(plus as HTMLElement);
    // 4.00 × 2
    expect(quotedPrice()).toContain('€8.00');
  });
});

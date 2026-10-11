import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// The modal gates tenant capabilities (JOLLY / open price) on tenantContext
// from the app store: point it at the franks tenant, which owns this item.
vi.mock('../store/app-store', () => ({
  useAppStore: (selector: (state: { tenantContext: { tenantId: string } | null }) => unknown) =>
    selector({ tenantContext: { tenantId: 'ten_26ed333e-9dbd-43f7-85b1-fe57054e9e6f' } }),
}));

import POSProductModal from '../components/POSProductModal';
import type { CourseRoundsConfig, MenuItem } from '@gustopos/shared';

/**
 * FRANK'S as configured for franks: a required, SINGLE-select "Base" group
 * (Bun preselected, Panino) plus a multi-select "Extra" group. Re-opening a
 * line and switching the base used to persist BOTH options (see the
 * "sostituisce la base" regression test below), which then leaked to the
 * order, the kitchen ticket and the container RIEPILOGO.
 */
const franks: MenuItem = {
  id: 'm_66d926c5-7d19-490f-a819-9b89d384a100',
  name: "FRANK'S",
  price: 7,
  category: 'BURGERS',
  categoryId: 'cat_burgers',
  printAreas: [],
  isJolly: false,
  isOpenPrice: false,
  ingredients: [],
  recipe: [],
  modifiers: [],
  modifierGroups: [
    {
      id: 'mg_base',
      name: 'Base',
      required: true,
      minSelections: 1,
      maxSelections: 1,
      multiSelectPriceMode: 'max',
      sortOrder: 0,
      options: [
        { id: 'opt_bun', name: 'Bun', componentType: 'ingredient', componentId: 'i_bun', quantity: 1, unit: 'pz', priceDelta: 0, priceMultiplier: null, isDefault: true, isActive: true, sortOrder: 0, ingredientOverrides: [] },
        { id: 'opt_panino', name: 'Panino', componentType: 'ingredient', componentId: 'i_panino', quantity: 1, unit: 'pz', priceDelta: 0, priceMultiplier: null, isDefault: false, isActive: true, sortOrder: 1, ingredientOverrides: [] },
      ],
    },
    {
      id: 'mg_extra',
      name: 'Extra',
      required: false,
      minSelections: 0,
      maxSelections: 3,
      multiSelectPriceMode: 'sum',
      sortOrder: 1,
      options: [
        { id: 'opt_bacon', name: 'Bacon', componentType: 'ingredient', componentId: 'i_bacon', quantity: 1, unit: 'pz', priceDelta: 0, priceMultiplier: null, isDefault: false, isActive: true, sortOrder: 0, ingredientOverrides: [] },
        { id: 'opt_cheddar', name: 'Cheddar', componentType: 'ingredient', componentId: 'i_cheddar', quantity: 1, unit: 'pz', priceDelta: 0, priceMultiplier: null, isDefault: false, isActive: true, sortOrder: 1, ingredientOverrides: [] },
      ],
    },
  ],
} as unknown as MenuItem;

type AddToCartArgs = [
  item: MenuItem,
  quantity: number,
  notes: string,
  ingredientOverrides: unknown[],
  selectedModifiers: Array<{ groupId: string; optionId: string }>,
  modifierPriceDelta: number,
];

function setup(existingCartItem?: unknown) {
  const onAddToCart = vi.fn();
  render(
    <POSProductModal
      item={franks}
      isOpen
      onClose={() => {}}
      onAddToCart={onAddToCart as never}
      inventory={[]}
      orderMode="dine_in"
      menuItems={[franks]}
      categoryModifierPools={[]}
      existingCartItem={existingCartItem as never}
      courseRoundsConfig={{ enabled: false, labels: ['1ª portata'], required: false } satisfies CourseRoundsConfig}
      courseRoundsModuleEnabled={false}
    />,
  );
  return { onAddToCart };
}

function confirm(onAddToCart: ReturnType<typeof vi.fn>): AddToCartArgs {
  // "Aggiungi · €…" for a new line, "Aggiorna" when editing an existing one.
  fireEvent.click(screen.getByRole('button', { name: /Aggiungi ·|Aggiorna/ }));
  return onAddToCart.mock.calls.at(-1) as unknown as AddToCartArgs;
}

function cartItemWith(selectedModifiers: Array<{ groupId: string; optionId: string }>) {
  return {
    cartItemId: 'cart-1',
    menuItemId: franks.id,
    name: franks.name,
    quantity: 1,
    basePrice: franks.price,
    price: franks.price,
    notes: '',
    selectedModifiers,
    modifierPriceDelta: 0,
    ingredientOverrides: [],
    round: null,
  };
}

describe("POSProductModal — gruppo Base a scelta singola", () => {
  it('nuovo articolo: scegliendo Panino il modificatore è solo Panino', () => {
    const { onAddToCart } = setup();
    fireEvent.click(screen.getByRole('button', { name: /^Panino$/ }));
    const [, , , , selectedModifiers] = confirm(onAddToCart);
    expect(selectedModifiers).toEqual([{ groupId: 'mg_base', optionId: 'opt_panino' }]);
  });

  it('sostituisce la base su una riga esistente (Bun -> Panino) senza tenerle entrambe', () => {
    const { onAddToCart } = setup(cartItemWith([{ groupId: 'mg_base', optionId: 'opt_bun' }]));
    fireEvent.click(screen.getByRole('button', { name: /^Panino$/ }));
    const [, , , , selectedModifiers] = confirm(onAddToCart);
    expect(selectedModifiers).toEqual([{ groupId: 'mg_base', optionId: 'opt_panino' }]);
  });

  it('un gruppo multi-select continua ad accumulare le opzioni', () => {
    const { onAddToCart } = setup(cartItemWith([{ groupId: 'mg_base', optionId: 'opt_panino' }]));
    fireEvent.click(screen.getByRole('button', { name: /^Bacon$/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Cheddar$/ }));
    const [, , , , selectedModifiers] = confirm(onAddToCart);
    expect(selectedModifiers).toContainEqual({ groupId: 'mg_base', optionId: 'opt_panino' });
    expect(selectedModifiers).toContainEqual({ groupId: 'mg_extra', optionId: 'opt_bacon' });
    expect(selectedModifiers).toContainEqual({ groupId: 'mg_extra', optionId: 'opt_cheddar' });
    expect(selectedModifiers).toHaveLength(3);
  });
});

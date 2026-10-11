import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// The component gates JOLLY (price composed by the selections) on the
// per-tenant capability, which reads tenantContext from the app store: point
// it at the casale tenant, the one these pools belong to.
vi.mock('../store/app-store', () => ({
  useAppStore: (selector: (state: { tenantContext: { tenantId: string } | null }) => unknown) =>
    selector({ tenantContext: { tenantId: 'ten_2ad3a695-8893-411f-b922-f28c9b30a6d8' } }),
}));

import POSProductModal from '../components/POSProductModal';
import type { CategoryModifierPool, CourseRoundsConfig, MenuItem } from '@gustopos/shared';

const CATEGORY_ID = 'cat_pizzeria';

const pizza: MenuItem = {
  id: 'item-margherita',
  name: 'MARGHERITA',
  price: 6.5,
  category: 'Pizzeria',
  categoryId: CATEGORY_ID,
  printAreas: [],
  isJolly: false,
  isOpenPrice: false,
  ingredients: [],
  recipe: [],
  modifiers: [],
  modifierGroups: [],
};

const poolOption = (
  id: string,
  name: string,
  price: number,
  priceMultiplier: number | null = null,
): CategoryModifierPool['options'][number] => ({
  id,
  name,
  componentType: 'ingredient',
  componentId: name,
  quantity: 1,
  unit: 'pz',
  priceDelta: price,
  priceMultiplier,
  isActive: true,
  sortOrder: 0,
});

/** The casale Pizzeria pools as imported from the public site. */
const pools: CategoryModifierPool[] = [
  {
    id: 'cmp_senza-glutine',
    categoryId: CATEGORY_ID,
    categoryIds: [CATEGORY_ID],
    name: 'Senza glutine',
    sortOrder: 0,
    options: [poolOption('opt-celiaca', 'Pizza celiaca', 2)],
  },
  {
    id: 'cmp_maxi',
    categoryId: CATEGORY_ID,
    categoryIds: [CATEGORY_ID],
    name: 'MAXI',
    sortOrder: 1,
    options: [poolOption('opt-maxi', 'MAXI', 0, 2)],
  },
  {
    id: 'cmp_aggiunta',
    categoryId: CATEGORY_ID,
    categoryIds: [CATEGORY_ID],
    name: 'AGGIUNTA',
    sortOrder: 2,
    // Big priced pool: must stay in "Personalizza".
    options: Array.from({ length: 49 }, (_, index) => poolOption(`opt-agg-${index}`, `Aggiunge ${index}`, 1)),
  },
  {
    id: 'cmp_salse',
    categoryId: CATEGORY_ID,
    categoryIds: [CATEGORY_ID],
    name: 'Salse',
    sortOrder: 3,
    // Unpriced pool: the legacy note-only inline chips.
    options: [poolOption('opt-salsa', 'Salsa BBQ', 0)],
  },
];

type AddToCartArgs = [
  item: MenuItem,
  quantity: number,
  notes: string,
  ingredientOverrides: unknown[],
  selectedModifiers: Array<{ groupId: string; optionId: string }>,
  modifierPriceDelta: number,
];

function setup() {
  const onAddToCart = vi.fn();
  render(
    <POSProductModal
      item={pizza}
      isOpen
      onClose={() => {}}
      onAddToCart={onAddToCart as never}
      inventory={[]}
      orderMode="dine_in"
      menuItems={[pizza]}
      categoryModifierPools={pools}
      courseRoundsConfig={{ enabled: false, labels: ['1ª portata'], required: false } satisfies CourseRoundsConfig}
      courseRoundsModuleEnabled={false}
    />,
  );
  return { onAddToCart };
}

function addToCart(onAddToCart: ReturnType<typeof vi.fn>): AddToCartArgs {
  // "Aggiungi · €…" for a new line, "Aggiorna" when editing an existing one.
  fireEvent.click(screen.getByRole('button', { name: /Aggiungi ·|Aggiorna/ }));
  return onAddToCart.mock.calls.at(-1) as unknown as AddToCartArgs;
}

describe('POSProductModal — container dei pool di categoria', () => {
  it('mostra i pool piccoli come container in ordine e nasconde i pool grandi', () => {
    setup();
    const headings = screen.getAllByRole('heading', { level: 3 }).map((node) => node.textContent);
    expect(headings).toEqual(['Senza glutine', 'MAXI', 'Salse']);
    expect(screen.queryByText('AGGIUNTA')).toBeNull();
  });

  it('etichetta il prezzo sulle chip prezzate', () => {
    setup();
    expect(screen.getByRole('button', { name: /Pizza celiaca\+€2\.00/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /MAXI×2/ })).toBeTruthy();
  });

  it('carica +2,00 e la selezione quando si sceglie la pizza celiaca', () => {
    const { onAddToCart } = setup();
    expect(screen.getByRole('button', { name: /€6\.50/ })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Pizza celiaca/ }));
    // The chip now reads as selected and the button quotes base + delta.
    expect(screen.getByRole('button', { name: /€8\.50/ })).toBeTruthy();

    const [, quantity, notes, , selectedModifiers, delta] = addToCart(onAddToCart);
    expect(quantity).toBe(1);
    expect(notes).toBe('');
    expect(selectedModifiers).toContainEqual({ groupId: 'cmp_senza-glutine', optionId: 'opt-celiaca' });
    expect(delta).toBe(2);
  });

  it('MAXI raddoppia il prezzo della pizza (delta = prezzo base)', () => {
    const { onAddToCart } = setup();
    fireEvent.click(screen.getByRole('button', { name: /MAXI/ }));
    expect(screen.getByRole('button', { name: /€13\.00/ })).toBeTruthy();

    const [, , , , selectedModifiers, delta] = addToCart(onAddToCart);
    expect(selectedModifiers).toContainEqual({ groupId: 'cmp_maxi', optionId: 'opt-maxi' });
    expect(delta).toBe(6.5);
  });

  it('somma le selezioni dei pool prezzati', () => {
    const { onAddToCart } = setup();
    fireEvent.click(screen.getByRole('button', { name: /Pizza celiaca/ }));
    fireEvent.click(screen.getByRole('button', { name: /MAXI/ }));
    expect(screen.getByRole('button', { name: /€15\.00/ })).toBeTruthy();

    const [, , , , selectedModifiers, delta] = addToCart(onAddToCart);
    expect(selectedModifiers).toHaveLength(2);
    expect(delta).toBe(8.5);
  });

  it('le chip dei pool non prezzati restano note, senza prezzo né selezione', () => {
    const { onAddToCart } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Salsa BBQ' }));

    const [, , notes, , selectedModifiers, delta] = addToCart(onAddToCart);
    expect(notes).toBe('Salsa BBQ');
    expect(delta).toBe(0);
    expect(selectedModifiers.some((selected) => selected.groupId === 'cmp_salse')).toBe(false);
  });

  it('la chip prezzata con una sola opzione si deseleziona al secondo tocco', () => {
    const { onAddToCart } = setup();
    fireEvent.click(screen.getByRole('button', { name: /Pizza celiaca/ }));
    expect(screen.getByRole('button', { name: /€8\.50/ })).toBeTruthy();

    // Second tap must CLEAR it: a pool is an optional multi-select, never a
    // single-select that keeps re-selecting itself.
    fireEvent.click(screen.getByRole('button', { name: /Pizza celiaca/ }));
    expect(screen.getByRole('button', { name: /€6\.50/ })).toBeTruthy();

    const [, , , , selectedModifiers, delta] = addToCart(onAddToCart);
    expect(selectedModifiers).toHaveLength(0);
    expect(delta).toBe(0);
  });

  it('anche MAXI (1 opzione) si deseleziona e il prezzo torna alla base', () => {
    const { onAddToCart } = setup();
    fireEvent.click(screen.getByRole('button', { name: /MAXI/ }));
    expect(screen.getByRole('button', { name: /€13\.00/ })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /MAXI/ }));
    expect(screen.getByRole('button', { name: /€6\.50/ })).toBeTruthy();

    const [, , , , selectedModifiers, delta] = addToCart(onAddToCart);
    expect(selectedModifiers).toHaveLength(0);
    expect(delta).toBe(0);
  });

  it('ripristina una selezione già salvata aprendo di nuovo il modale', () => {
    const onAddToCart = vi.fn();
    render(
      <POSProductModal
        item={pizza}
        isOpen
        onClose={() => {}}
        onAddToCart={onAddToCart as never}
        inventory={[]}
        orderMode="dine_in"
        menuItems={[pizza]}
        categoryModifierPools={pools}
        courseRoundsConfig={{ enabled: false, labels: ['1ª portata'], required: false } satisfies CourseRoundsConfig}
        courseRoundsModuleEnabled={false}
        existingCartItem={
          {
            cartItemId: 'cart-1',
            menuItemId: pizza.id,
            name: pizza.name,
            quantity: 1,
            basePrice: pizza.price,
            price: 8.5,
            notes: '',
            selectedModifiers: [
              { groupId: 'cmp_senza-glutine', optionId: 'opt-celiaca' },
              { groupId: 'cmp_maxi', optionId: 'opt-maxi' },
            ],
            modifierPriceDelta: 8.5,
            ingredientOverrides: [],
            round: null,
          } as never
        }
      />,
    );

    // Editing an existing line: the button reads "Aggiorna" (no price label),
    // so the restored selection is asserted through the callback payload.
    expect(screen.getByRole('button', { name: /Aggiorna/ })).toBeTruthy();
    const [, , , , selectedModifiers, delta] = addToCart(onAddToCart);
    expect(selectedModifiers).toHaveLength(2);
    expect(delta).toBe(8.5);
  });
});

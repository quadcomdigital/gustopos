import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import ModifierSheet from '../../menu/overlays/ModifierSheet';
import type { MenuAppearance, ModifierSheetProps } from '../../menu/types';
import type { PublicMenuResponse } from '@gustopos/shared';

type Pools = PublicMenuResponse['categoryModifierPools'];

const CATEGORY_ID = 'cat_pizzeria';

const item = {
  id: 'm_margherita',
  name: 'MARGHERITA',
  price: 6.5,
  categoryId: CATEGORY_ID,
  category: 'Pizzeria',
  ingredients: [],
  recipe: [],
  bomIds: [],
  printAreas: [],
  isFeatured: false,
  isSoldOut: false,
  modifierGroups: [],
} as unknown as PublicMenuResponse['items'][number];

const poolOption = (
  id: string,
  name: string,
  price: number,
  priceMultiplier: number | null = null,
): Pools[number]['options'][number] => ({
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

/** One-option pools (the casale ones): the case where chips used to get stuck. */
const pools = [
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
    options: [poolOption('opt-bufala', 'Bufala', 2.5), poolOption('opt-tonno', 'Tonno', 1)],
  },
] as unknown as Pools;

const appearance: MenuAppearance = {
  accent: '#111111',
  accentForeground: '#ffffff',
  accentText: '#111111',
  accentStrong: '#000000',
  accentSoft: '#eeeeee',
  ink: '#111111',
  inkSoft: '#333333',
  pageBg: '#ffffff',
  surface: '#ffffff',
  border: '#dddddd',
  muted: '#666666',
  currency: 'EUR',
  preset: 'minimal_elegant',
  showPrices: true,
  showIngredients: true,
};

const formatPrice = (value: number) => `€${value.toFixed(2)}`;

function setup() {
  const onConfirm = vi.fn();
  const onClose = vi.fn();
  render(
    <ModifierSheet
      item={item}
      categoryPools={pools}
      appearance={appearance}
      currency="EUR"
      formatPrice={formatPrice}
      onClose={onClose}
      onConfirm={onConfirm}
    />,
  );
  return { onConfirm, onClose };
}

const confirmButton = () => screen.getByRole('button', { name: /^Aggiungi ·/ });

describe('ModifierSheet (menu pubblico) — pool di categoria', () => {
  it('mostra ogni pool come sezione con il prezzo aggiornato', () => {
    setup();
    // Headings: the pool name also appears as the label of its own option.
    expect(screen.getByRole('heading', { name: 'Senza glutine' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'MAXI' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'AGGIUNTA' })).toBeTruthy();
    expect(confirmButton().textContent).toContain('€6.50');
  });

  it('deseleziona una chip a opzione singola al secondo tocco', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: /Pizza celiaca/ }));
    expect(confirmButton().textContent).toContain('€8.50');

    fireEvent.click(screen.getByRole('button', { name: /Pizza celiaca/ }));
    expect(confirmButton().textContent).toContain('€6.50');

    fireEvent.click(confirmButton());
    expect(screen.getByRole('heading', { name: 'Senza glutine' })).toBeTruthy();
  });

  it('conferma con selezioni vuote dopo avere deselezionato tutto', () => {
    const { onConfirm } = setup();
    fireEvent.click(screen.getByRole('button', { name: /Pizza celiaca/ }));
    fireEvent.click(screen.getByRole('button', { name: /Pizza celiaca/ }));
    fireEvent.click(confirmButton());

    expect(onConfirm).toHaveBeenCalledWith({ selectedModifiers: [], modifierPriceDelta: 0 });
  });

  it('somma più pool e conferma le selezioni', () => {
    const { onConfirm } = setup();
    fireEvent.click(screen.getByRole('button', { name: /Pizza celiaca/ }));
    fireEvent.click(screen.getByRole('button', { name: /MAXI/ }));
    fireEvent.click(screen.getByRole('button', { name: /Bufala/ }));
    // 6,50 base + 2,00 celiaca + 6,50 (×2) + 2,50 bufala
    expect(confirmButton().textContent).toContain('€17.50');

    fireEvent.click(confirmButton());
    const payload = onConfirm.mock.calls.at(-1)?.[0] as {
      selectedModifiers: Array<{ groupId: string; optionId: string }>;
      modifierPriceDelta: number;
    };
    expect(payload.modifierPriceDelta).toBeCloseTo(11);
    expect(payload.selectedModifiers).toHaveLength(3);
  });
});

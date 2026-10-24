import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import ModifierSheet from '../../menu/overlays/ModifierSheet';
import { itemIsCustomizable, removableComponents } from '../../menu/lib/customization';
import type { MenuAppearance, ModifierSheetProps } from '../../menu/types';
import type { PublicMenuResponse } from '@gustopos/shared';

type MenuItem = PublicMenuResponse['items'][number];
type Pools = PublicMenuResponse['categoryModifierPools'];

const CATEGORY_ID = 'cat_panini';

/** A panino with a named recipe plus one recipe component with no name at all. */
const item = {
  id: 'm_panino',
  name: 'PANINO FRANKS',
  price: 8,
  categoryId: CATEGORY_ID,
  category: 'Panini',
  ingredients: ['Pane', 'Hamburger', 'Cipolla'],
  recipe: [
    { componentType: 'ingredient', componentId: 'inv_pane', componentName: 'Pane', quantity: 1, unit: 'pz' },
    { componentType: 'ingredient', componentId: 'inv_burger', componentName: 'Hamburger', quantity: 1, unit: 'pz' },
    { componentType: 'ingredient', componentId: 'inv_cipolla', componentName: 'Cipolla', quantity: 1, unit: 'pz' },
    // Same ingredient twice: it must be offered once.
    { componentType: 'ingredient', componentId: 'inv_cipolla', componentName: 'Cipolla', quantity: 1, unit: 'pz' },
    // Unnamed component: offering "senza <uuid>" would be worse than hiding it.
    { componentType: 'prep', componentId: 'prep_salsa', quantity: 1, unit: 'pz' },
  ],
  bomIds: [],
  printAreas: [],
  isFeatured: false,
  isSoldOut: false,
  modifierGroups: [],
} as unknown as MenuItem;

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
  layout: { itemLayout: 'rows', heroHeight: 'compact', showHighlights: false, density: 'compact' },
  showPrices: true,
  showIngredients: true,
};

const formatPrice = (value: number) => `€${value.toFixed(2)}`;

function setup(overrides: Partial<ModifierSheetProps> = {}, pools: Pools = []) {
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
      {...overrides}
    />,
  );
  return { onConfirm, onClose };
}

const confirmButton = () => screen.getByRole('button', { name: /^Aggiungi ·/ });

describe('ModifierSheet (menu pubblico) — togli ingredienti', () => {
  it('elenca gli ingredienti della ricetta una volta sola, con i nomi', () => {
    setup();
    expect(screen.getByRole('heading', { name: 'Togli ingredienti' })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /Cipolla/ })).toHaveLength(1);
    // The unnamed prep is not offered.
    expect(screen.queryByRole('button', { name: /prep_salsa/ })).toBeNull();
  });

  it('conferma gli ingredienti tolti come override verso l\'API', () => {
    const { onConfirm } = setup();

    fireEvent.click(screen.getByRole('button', { name: 'Cipolla: togli' }));
    fireEvent.click(confirmButton());

    expect(onConfirm).toHaveBeenCalledWith({
      selectedModifiers: [],
      modifierPriceDelta: 0,
      ingredientOverrides: [{ ingredientId: 'inv_cipolla', action: 'remove' }],
    });
  });

  it('rimette un ingrediente toccandolo di nuovo e mostra il riepilogo', () => {
    const { onConfirm } = setup();

    fireEvent.click(screen.getByRole('button', { name: 'Cipolla: togli' }));
    expect(screen.getByText(/Senza: Cipolla/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Cipolla: rimetti' }));
    expect(screen.queryByText(/Senza: Cipolla/)).toBeNull();

    fireEvent.click(confirmButton());
    expect(onConfirm).toHaveBeenCalledWith({
      selectedModifiers: [],
      modifierPriceDelta: 0,
      ingredientOverrides: [],
    });
  });

  it('ripristina tutti gli ingredienti tolti con un solo tocco', () => {
    setup();

    fireEvent.click(screen.getByRole('button', { name: 'Cipolla: togli' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pane: togli' }));
    expect(screen.getByText(/Senza: Pane, Cipolla|Senza: Cipolla, Pane/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Ripristina/ }));
    expect(screen.queryByText(/^Senza:/)).toBeNull();
  });
});

describe('customization helpers', () => {
  it('offre solo i componenti con nome, senza duplicati', () => {
    expect(removableComponents(item).map((component) => component.name)).toEqual([
      'Pane',
      'Hamburger',
      'Cipolla',
    ]);
  });

  it('rende personalizzabile un piatto con soli ingredienti rimovibili', () => {
    expect(itemIsCustomizable(item, [])).toBe(true);
  });

  it('non rende personalizzabile un piatto senza ricetta né opzioni', () => {
    const plain = { ...item, recipe: [] } as unknown as MenuItem;
    expect(itemIsCustomizable(plain, [])).toBe(false);
  });
});

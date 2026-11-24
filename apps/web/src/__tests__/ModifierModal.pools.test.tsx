import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../store/app-store', () => ({
  useAppStore: (selector: (state: { tenantContext: { tenantId: string } | null }) => unknown) =>
    selector({ tenantContext: null }),
}));

import ModifierModal from '../components/ModifierModal';
import type { CategoryModifierPool, MenuItem, MenuItemModifier } from '@gustopos/shared';

const BURGERS = 'cat_burgers';

const burger: MenuItem = {
  id: 'item-luglio',
  name: 'LUGLIO BURGER',
  price: 7,
  category: 'BURGERS',
  categoryId: BURGERS,
  printAreas: ['kitchen'],
  isJolly: false,
  isOpenPrice: false,
  ingredients: [],
  recipe: [],
  modifiers: [],
  modifierGroups: [],
};

/**
 * franks: the two entries are separate catalogue options but deduct the same
 * prep ("Smash"). The modal used to dedupe by componentId and dropped SMASH2.
 */
const aggiuntaPool: CategoryModifierPool = {
  id: 'cmp_aggiunta',
  categoryId: BURGERS,
  categoryIds: [BURGERS],
  name: 'AGGIUNTA',
  sortOrder: 0,
  options: [
    {
      id: 'opt-smash',
      name: 'SMASH',
      componentType: 'prep',
      componentId: 'prep_smash',
      quantity: 1,
      unit: 'pz',
      priceDelta: 1,
      isActive: true,
      sortOrder: 30,
    },
    {
      id: 'opt-smash2',
      name: 'SMASH2',
      componentType: 'prep',
      componentId: 'prep_smash',
      quantity: 1,
      unit: 'pz',
      priceDelta: 1,
      isActive: true,
      sortOrder: 31,
    },
  ],
};

function setup(pools: CategoryModifierPool[] = [aggiuntaPool], modifiers: MenuItemModifier[] = []) {
  const onConfirm = vi.fn();
  render(
    <ModifierModal
      item={{ ...burger, modifiers }}
      isOpen
      onClose={() => {}}
      onConfirm={onConfirm}
      inventory={[]}
      bomItems={[]}
      prepItems={[]}
      existingOverrides={[]}
      existingSelectedModifiers={[]}
      existingModifierPriceDelta={0}
      categoryModifierPools={pools}
    />,
  );
  return { onConfirm };
}

describe('ModifierModal — pool options sharing a component', () => {
  it('mostra tutte le aggiunte anche quando due voci puntano allo stesso componente', () => {
    setup();

    // Accessible name is "<label><subtitle><badge>", e.g. "SMASH AGGIUNTA +€1.00".
    const smash = screen.getByRole('button', { name: /^SMASH\s/ });
    const smash2 = screen.getByRole('button', { name: /^SMASH2\s/ });
    expect(smash.textContent).toContain('+€1.00');
    expect(smash2.textContent).toContain('+€1.00');

    // SMASH2 sits right under SMASH (alphabetical list).
    const order = screen.getAllByRole('button');
    expect(order.indexOf(smash2)).toBe(order.indexOf(smash) + 1);
  });

  it('seleziona e prezza SMASH e SMASH2 come due aggiunte distinte', () => {
    const { onConfirm } = setup();

    fireEvent.click(screen.getByRole('button', { name: /^SMASH\s/ }));
    fireEvent.click(screen.getByRole('button', { name: /^SMASH2\s/ }));
    fireEvent.click(screen.getByRole('button', { name: /Conferma/ }));

    const payload = onConfirm.mock.calls.at(-1)?.[0] as {
      selectedModifiers: Array<{ groupId: string; optionId: string }>;
      modifierPriceDelta: number;
    };

    expect(payload.selectedModifiers).toEqual([
      { groupId: 'cmp_aggiunta', optionId: 'opt-smash' },
      { groupId: 'cmp_aggiunta', optionId: 'opt-smash2' },
    ]);
    expect(payload.modifierPriceDelta).toBe(2);
  });

  it('non duplica un ingrediente già offerto da un modifier del prodotto', () => {
    const modifiers: MenuItemModifier[] = [
      { id: 'i_bacon', inventoryItemId: 'i_bacon', name: 'Bacon', priceDelta: 0.5 },
    ];
    const pool: CategoryModifierPool = {
      ...aggiuntaPool,
      options: [
        {
          id: 'opt-bacon',
          name: 'Bacon',
          componentType: 'ingredient',
          componentId: 'i_bacon',
          inventoryItemId: 'i_bacon',
          quantity: 1,
          unit: 'pz',
          priceDelta: 0.5,
          isActive: true,
          sortOrder: 1,
        },
      ],
    };

    setup([pool], modifiers);

    expect(screen.getAllByText('Bacon')).toHaveLength(1);
  });
});

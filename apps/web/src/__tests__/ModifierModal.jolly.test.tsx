import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// JOLLY is a per-tenant capability read from tenantContext: point the store at
// the casale tenant so the modal prices like the POS does.
vi.mock('../store/app-store', () => ({
  useAppStore: (selector: (state: { tenantContext: { tenantId: string } | null }) => unknown) =>
    selector({ tenantContext: { tenantId: 'ten_2ad3a695-8893-411f-b922-f28c9b30a6d8' } }),
}));

import ModifierModal from '../components/ModifierModal';
import type { CategoryModifierPool, MenuItem, ModifierGroup } from '@gustopos/shared';

const JOLLY_CATEGORY_ID = 'cat_jolly';

const halves: ModifierGroup = {
  id: 'grp_halves',
  name: 'Le due metà',
  required: true,
  minSelections: 1,
  maxSelections: 2,
  multiSelectPriceMode: 'sum',
  sortOrder: 0,
  options: [
    {
      id: 'opt_gourmet',
      name: 'GOURMET',
      componentType: 'ingredient',
      quantity: 1,
      unit: 'pz',
      priceDelta: 7.5,
      isDefault: false,
      isActive: true,
      sortOrder: 0,
      ingredientOverrides: [],
    },
    {
      id: 'opt_margherita',
      name: 'MARGHERITA',
      componentType: 'ingredient',
      quantity: 1,
      unit: 'pz',
      priceDelta: 2.75,
      isDefault: false,
      isActive: true,
      sortOrder: 1,
      ingredientOverrides: [],
    },
  ],
};

const jolly: MenuItem = {
  id: 'item-jolly',
  name: 'JOLLY',
  price: 0,
  category: 'JOLLY',
  categoryId: JOLLY_CATEGORY_ID,
  printAreas: [],
  isJolly: true,
  isOpenPrice: false,
  ingredients: [],
  recipe: [],
  modifiers: [],
  modifierGroups: [halves],
};

const maxiPool: CategoryModifierPool = {
  id: 'cmp_maxi',
  categoryId: JOLLY_CATEGORY_ID,
  categoryIds: [JOLLY_CATEGORY_ID],
  name: 'MAXI',
  sortOrder: 0,
  options: [
    {
      id: 'opt-maxi',
      name: 'MAXI',
      componentType: 'ingredient',
      quantity: 1,
      unit: 'pz',
      priceDelta: 0,
      priceMultiplier: 2,
      isActive: true,
      sortOrder: 0,
    },
  ],
};

// The 49-option "AGGIUNTA" pool: it never renders inline (>8 options), it is
// exactly what "Personalizza" exists for. It only reaches a JOLLY if step B6
// of scripts/casale-jolly-maxi.ts links it to the JOLLY category too.
const aggiuntaPool: CategoryModifierPool = {
  id: 'cmp_aggiunta',
  categoryId: 'cat_pizzeria',
  categoryIds: ['cat_pizzeria'],
  name: 'AGGIUNTA',
  sortOrder: 1,
  options: [
    {
      id: 'opt-bufala',
      name: 'Bufala',
      componentType: 'ingredient',
      quantity: 1,
      unit: 'pz',
      priceDelta: 2.5,
      isActive: true,
      sortOrder: 0,
    },
    {
      id: 'opt-funghi',
      name: 'Funghi porcini trifolati',
      componentType: 'ingredient',
      quantity: 1,
      unit: 'pz',
      priceDelta: 2.5,
      isActive: true,
      sortOrder: 1,
    },
  ],
};

/** Both halves already in the cart: (15.00 + 5.50) / 2 = 10.25. */
const existingSelectedModifiers = [
  { groupId: 'grp_halves', optionId: 'opt_gourmet' },
  { groupId: 'grp_halves', optionId: 'opt_margherita' },
];

function setup(pools: CategoryModifierPool[] = [maxiPool]) {
  const onConfirm = vi.fn();
  render(
    <ModifierModal
      item={jolly}
      isOpen
      onClose={() => {}}
      onConfirm={onConfirm}
      inventory={[]}
      bomItems={[]}
      prepItems={[]}
      existingOverrides={[]}
      existingSelectedModifiers={existingSelectedModifiers}
      existingModifierPriceDelta={10.25}
      categoryModifierPools={pools}
    />,
  );
  return { onConfirm };
}

describe('ModifierModal — JOLLY (Personalizza)', () => {
  it('ripristina entrambe le metà e non modifica il prezzo composto', () => {
    const { onConfirm } = setup();

    fireEvent.click(screen.getByRole('button', { name: /Conferma/ }));
    const payload = onConfirm.mock.calls.at(-1)?.[0] as {
      selectedModifiers: Array<{ groupId: string; optionId: string }>;
      modifierPriceDelta: number;
    };

    expect(payload.selectedModifiers).toEqual(existingSelectedModifiers);
    expect(payload.modifierPriceDelta).toBe(10.25);
  });

  it('prezza MAXI (×2) sul prezzo composto, non sul prezzo di catalogo (0.00)', () => {
    const { onConfirm } = setup();

    // The MAXI row quotes base × (2 - 1): 10.25, the composed halves.
    expect(screen.getByText('+€10.25')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /MAXI/ }));
    fireEvent.click(screen.getByRole('button', { name: /Conferma/ }));
    const payload = onConfirm.mock.calls.at(-1)?.[0] as {
      selectedModifiers: Array<{ groupId: string; optionId: string }>;
      modifierPriceDelta: number;
    };

    expect(payload.selectedModifiers).toContainEqual({ groupId: 'cmp_maxi', optionId: 'opt-maxi' });
    // 10.25 (halves) + 10.25 (MAXI) = 20.50
    expect(payload.modifierPriceDelta).toBe(20.5);
  });

  it('le aggiunte ("AGGIUNTA") non compaiono finché il pool non è collegato al JOLLY', () => {
    // Pool linked to PIZZERIA only — the state before step B6 of the script:
    // the additions are nowhere to be found on a JOLLY line.
    setup([maxiPool, aggiuntaPool]);
    expect(screen.queryByText('Bufala')).toBeNull();
    expect(screen.getByRole('button', { name: /MAXI/ })).toBeTruthy();
  });

  it('col pool collegato, le aggiunte compaiono in Personalizza con il loro sovrapprezzo', () => {
    setup([maxiPool, { ...aggiuntaPool, categoryIds: ['cat_pizzeria', JOLLY_CATEGORY_ID] }]);

    const bufala = screen.getByRole('button', { name: /Bufala/ });
    expect(bufala.textContent).toContain('+€2.50');
    expect(screen.getByRole('button', { name: /Funghi porcini trifolati/ })).toBeTruthy();
  });

  it('le aggiunte restano additive anche con MAXI (×2): raddoppia solo le metà', () => {
    const { onConfirm } = setup([
      maxiPool,
      { ...aggiuntaPool, categoryIds: ['cat_pizzeria', JOLLY_CATEGORY_ID] },
    ]);

    // MAXI quotes base × (2 - 1) against the composed halves, Bufala is a flat
    // surcharge: neither must be scaled by the other.
    fireEvent.click(screen.getByRole('button', { name: /MAXI/ }));
    fireEvent.click(screen.getByRole('button', { name: /Bufala/ }));
    fireEvent.click(screen.getByRole('button', { name: /Conferma/ }));

    const payload = onConfirm.mock.calls.at(-1)?.[0] as {
      selectedModifiers: Array<{ groupId: string; optionId: string }>;
      modifierPriceDelta: number;
    };
    expect(payload.selectedModifiers).toContainEqual({ groupId: 'cmp_aggiunta', optionId: 'opt-bufala' });
    // halves 10.25 + MAXI 10.25 + Bufala 2.50 = 23.00
    expect(payload.modifierPriceDelta).toBe(23);
  });
});

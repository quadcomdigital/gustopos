import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// JOLLY (a price composed by the selections) is a per-tenant capability, read
// from tenantContext in the app store: point it at the casale tenant, the one
// this product belongs to.
vi.mock('../store/app-store', () => ({
  useAppStore: (selector: (state: { tenantContext: { tenantId: string } | null }) => unknown) =>
    selector({ tenantContext: { tenantId: 'ten_2ad3a695-8893-411f-b922-f28c9b30a6d8' } }),
}));

import POSProductModal from '../components/POSProductModal';
import type { CategoryModifierPool, CourseRoundsConfig, MenuItem, ModifierGroup } from '@gustopos/shared';

const JOLLY_CATEGORY_ID = 'cat_jolly';

// "Le due metà": every option carries pizza price / 2, summed (two halves cost
// (pA + pB) / 2). Required, so an empty €0,00 JOLLY cannot be sold.
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
      priceDelta: 7.5, // 15.00 / 2
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
      priceDelta: 2.75, // 5.50 / 2
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

// The Pizzeria pools, all linked to the JOLLY category too (step B6 of
// scripts/casale-jolly-maxi.ts: MAXI, Senza glutine, AGGIUNTA).
const pools: CategoryModifierPool[] = [
  {
    id: 'cmp_senza-glutine',
    categoryId: JOLLY_CATEGORY_ID,
    categoryIds: [JOLLY_CATEGORY_ID],
    name: 'Senza glutine',
    sortOrder: 0,
    options: [
      {
        id: 'opt-celiaca',
        name: 'Pizza celiaca',
        componentType: 'ingredient',
        quantity: 1,
        unit: 'pz',
        priceDelta: 2,
        isActive: true,
        sortOrder: 0,
      },
    ],
  },
  {
    id: 'cmp_maxi',
    categoryId: JOLLY_CATEGORY_ID,
    categoryIds: [JOLLY_CATEGORY_ID],
    name: 'MAXI',
    sortOrder: 1,
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
  },
  // The real AGGIUNTA pool has 49 options (>8): too big for an inline
  // container, so it must stay behind "Personalizza". Trimmed to 9 here just
  // to keep the >8 threshold honest.
  {
    id: 'cmp_aggiunta',
    categoryId: JOLLY_CATEGORY_ID,
    categoryIds: [JOLLY_CATEGORY_ID],
    name: 'AGGIUNTA',
    sortOrder: 2,
    options: ['Acciughe', 'Aglio', 'Ananas', 'Bacon', 'Bufala', 'Cipolla', 'Funghi', 'Olive', 'Rucola'].map(
      (name, index) => ({
        id: `opt-${name.toLowerCase()}`,
        name,
        componentType: 'ingredient' as const,
        quantity: 1,
        unit: 'pz',
        priceDelta: 1,
        isActive: true,
        sortOrder: index,
      }),
    ),
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
  const onOpenModifierModal = vi.fn();
  render(
    <POSProductModal
      item={jolly}
      isOpen
      onClose={() => {}}
      onAddToCart={onAddToCart as never}
      onOpenModifierModal={onOpenModifierModal}
      inventory={[]}
      orderMode="dine_in"
      menuItems={[jolly]}
      categoryModifierPools={pools}
      courseRoundsConfig={{ enabled: false, labels: ['1ª portata'], required: false } satisfies CourseRoundsConfig}
      courseRoundsModuleEnabled={false}
    />,
  );
  return { onAddToCart, onOpenModifierModal };
}

function select(optionName: RegExp | string) {
  fireEvent.click(screen.getByRole('button', { name: optionName }));
}

function quotedPrice(): string | null {
  const button = screen.queryByRole('button', { name: /Aggiungi ·|Aggiorna/ });
  return button?.textContent ?? null;
}

describe('POSProductModal — JOLLY, prezzo composto dalle selezioni', () => {
  it('non espone il campo "Prezzo ad-hoc" e spiega da dove viene il prezzo', () => {
    setup();
    expect(screen.queryByText('Prezzo ad-hoc')).toBeNull();
    expect(screen.queryByPlaceholderText('0.00')).toBeNull();
    expect(screen.getByText(/Seleziona almeno una metà/)).toBeTruthy();
  });

  it('aprendo il modal mostra subito MAXI e Senza glutine, sopra "Le due metà"', () => {
    setup();
    // The pool containers render as soon as the modal opens — no interaction
    // needed — and sit ABOVE the product's own group (step B6 of the script
    // is what links them to the JOLLY category).
    const headings = screen.getAllByRole('heading', { level: 3 }).map((node) => node.textContent);
    expect(headings).toEqual(['Senza glutine', 'MAXI', 'Le due metà']);
    expect(screen.getByRole('button', { name: /MAXI×2/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Pizza celiaca\+€2\.00/ })).toBeTruthy();
  });

  it('le aggiunte restano fuori dai container e si aprono da "Personalizza"', () => {
    const { onOpenModifierModal } = setup();
    // AGGIUNTA è un pool a pagamento con 9 opzioni (>8): non diventa un
    // container inline come MAXI/Senza glutine, resta dietro "Personalizza".
    expect(screen.queryByRole('heading', { name: 'AGGIUNTA' })).toBeNull();
    expect(screen.queryByText('Bufala')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /^Personalizza/ }));
    expect(onOpenModifierModal).toHaveBeenCalledTimes(1);
  });

  it('blocca l\'aggiunta finché non si sceglie almeno una metà', () => {
    setup();
    const confirm = screen.getByRole('button', { name: /Aggiungi ·/ });
    expect(confirm.hasAttribute('disabled')).toBe(true);

    select(/GOURMET/);
    expect(screen.getByRole('button', { name: /Aggiungi ·/ }).hasAttribute('disabled')).toBe(false);
  });

  it('componi il prezzo dalle due metà (pA + pB) / 2', () => {
    const { onAddToCart } = setup();
    select(/GOURMET/);
    select(/MARGHERITA/);

    // 7.50 + 2.75 = 10.25 → (15.00 + 5.50) / 2
    expect(quotedPrice()).toContain('€10.25');
    expect(screen.getByText('€10.25')).toBeTruthy();
    expect(screen.getByText('Prezzo composto dalle selezioni')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Aggiungi ·/ }));
    const [, quantity, , , selectedModifiers, delta] = onAddToCart.mock.calls.at(-1) as unknown as AddToCartArgs;
    expect(quantity).toBe(1);
    expect(selectedModifiers).toEqual(
      expect.arrayContaining([
        { groupId: 'grp_halves', optionId: 'opt_gourmet' },
        { groupId: 'grp_halves', optionId: 'opt_margherita' },
      ]),
    );
    expect(delta).toBe(10.25);
  });

  it('MAXI (×2) raddoppia il totale delle metà', () => {
    setup();
    select(/GOURMET/);
    select(/MARGHERITA/);
    select(/^MAXI/);

    // 10.25 × 2 = 20.50: the multiplier scales the composed base, not a
    // typed price (which no longer exists).
    expect(quotedPrice()).toContain('€20.50');
  });

  it('il MAXI scala solo le metà: il sovrapprezzo senza glutine resta additivo', () => {
    const { onAddToCart } = setup();
    select(/GOURMET/);
    select(/MARGHERITA/);
    select(/^MAXI/);
    select(/Pizza celiaca/);

    // halves 10.25 × 2 = 20.50, + 2.00 gluten free = 22.50 (not 24.50, which
    // would mean the surcharge was doubled too).
    expect(quotedPrice()).toContain('€22.50');

    fireEvent.click(screen.getByRole('button', { name: /Aggiungi ·/ }));
    const [, , , , selectedModifiers, delta] = onAddToCart.mock.calls.at(-1) as unknown as AddToCartArgs;
    expect(selectedModifiers).toHaveLength(4); // 2 metà + MAXI + senza glutine
    expect(delta).toBe(22.5);
  });

  it('le due metà senza MAXI restano al prezzo pieno delle metà', () => {
    setup();
    select(/MARGHERITA/);
    expect(quotedPrice()).toContain('€2.75');
  });

  it('passa il prezzo composto nel delta, senza customPrice', () => {
    const { onAddToCart } = setup();
    select(/GOURMET/);

    fireEvent.click(screen.getByRole('button', { name: /Aggiungi ·/ }));
    const args = onAddToCart.mock.calls.at(-1) as unknown as unknown[];
    // (item, quantity, notes, overrides, modifiers, delta, customPrice, round):
    // a JOLLY is not an open-price line, so `customPrice` is undefined — the
    // whole amount lives in modifierPriceDelta.
    expect(args).toHaveLength(8);
    expect(args[5]).toBe(7.5);
    expect(args[6]).toBeUndefined();
    expect(args[7]).toBeUndefined();
  });
});

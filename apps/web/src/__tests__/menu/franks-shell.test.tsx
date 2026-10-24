import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { PublicMenuResponse, PublicMenuModuleConfig } from '@gustopos/shared';

import FranksMenuShell from '../../menu/scaffolds/franks';
import { PRESET_LAYOUTS } from '../../menu/presets';
import type { MenuAppearance, MenuShellActions, MenuShellData } from '../../menu/types';

type PublicMenuItem = PublicMenuResponse['items'][number];

function item(overrides: Partial<PublicMenuItem> & { id: string; name: string }): PublicMenuItem {
  return {
    price: 9,
    categoryId: 'c1',
    category: 'Primi',
    ingredients: ['Pomodoro', 'Basilico'],
    recipe: [],
    bomIds: [],
    printAreas: [],
    isFeatured: false,
    isSoldOut: false,
    modifierGroups: [],
    ...overrides,
  } as PublicMenuItem;
}

const BASE_APPEARANCE: MenuAppearance = {
  accent: '#fbda1b',
  accentForeground: '#0b0b0c',
  accentText: '#7a6a00',
  accentStrong: '#e0c118',
  accentSoft: '#fdf6cf',
  ink: '#0b0b0c',
  inkSoft: '#16161a',
  pageBg: '#f7f7f4',
  surface: '#ffffff',
  border: '#e8e6e0',
  muted: '#6b6a64',
  currency: 'EUR',
  preset: 'minimal_elegant',
  layout: PRESET_LAYOUTS.minimal_elegant,
  showPrices: true,
  showIngredients: true,
};

function build(overrides: Partial<MenuShellData> = {}, actionOverrides: Partial<MenuShellActions> = {}) {
  const items: PublicMenuItem[] = [
    item({ id: 'm1', name: 'CARBONARA', isFeatured: true, description: 'Con guanciale croccante' }),
    item({
      id: 'm2',
      name: 'AMATRICIANA',
      isFeatured: true,
      modifierGroups: [
        {
          id: 'g1',
          name: 'Formato',
          required: false,
          minSelections: 0,
          maxSelections: 1,
          multiSelectPriceMode: 'max',
          sortOrder: 0,
          options: [
            {
              id: 'o1',
              name: 'Doppia',
              componentType: 'ingredient',
              quantity: 1,
              unit: 'pz',
              priceDelta: 2,
              isDefault: false,
              isActive: true,
              sortOrder: 0,
              ingredientOverrides: [],
            },
          ],
        } as never,
      ],
    }),
    item({ id: 'm3', name: 'CACIO E PEPE' }),
  ];

  const data: MenuShellData = {
    menu: {
      tenant: { id: 'ten_1', slug: 'franks', name: 'Franks' },
      categories: [{ id: 'c1', name: 'Primi', printAreas: [] }],
      items,
      categoryModifierPools: [],
    } as unknown as PublicMenuResponse,
    config: {} as PublicMenuModuleConfig,
    appearance: BASE_APPEARANCE,
    categories: [{ id: 'c1', name: 'Primi' }],
    filteredItems: items,
    activeCategory: 'all',
    searchQuery: '',
    sectionOrder: ['hero', 'categories_nav', 'item_grid', 'footer_note'],
    enabledSections: new Set(['hero', 'categories_nav', 'item_grid', 'footer_note']),
    cartAffordance: 'shell',
    ...overrides,
  };

  const actions: MenuShellActions = {
    onSelectCategory: vi.fn(),
    onSearch: vi.fn(),
    onAddItem: vi.fn(),
    openCart: vi.fn(),
    closeCart: vi.fn(),
    cartOpen: false,
    cartCount: 0,
    cartTotal: 0,
    cartLines: [],
    onIncrementLine: vi.fn(),
    onDecrementLine: vi.fn(),
    onRemoveLine: vi.fn(),
    takeawayEnabled: true,
    groupOrderEnabled: false,
    onGroupOrder: vi.fn(),
    ...actionOverrides,
  };

  return { data, actions };
}

describe('Franks menu shell', () => {
  it("usa heroImageUrl come sfondo dell'intestazione", () => {
    const { data, actions } = build({
      appearance: { ...BASE_APPEARANCE, heroImageUrl: 'https://cdn.test/hero.jpg' },
    });
    const { container } = render(<FranksMenuShell data={data} actions={actions} />);
    expect(container.querySelector('img[src="https://cdn.test/hero.jpg"]')).not.toBeNull();
  });

  it('mostra la descrizione scritta dal tenant', () => {
    const { data, actions } = build();
    render(<FranksMenuShell data={data} actions={actions} />);
    expect(screen.getByText('Con guanciale croccante')).toBeTruthy();
  });

  it('segnala i piatti personalizzabili con un bottone Personalizza', () => {
    const { data, actions } = build();
    render(<FranksMenuShell data={data} actions={actions} />);
    // The dish has an active option, so its CTA must open the sheet instead of
    // adding blindly.
    expect(screen.getAllByRole('button', { name: /^Personalizza / }).length).toBeGreaterThanOrEqual(1);
  });

  it('aggiunge direttamente un piatto senza opzioni né ingredienti rimovibili', () => {
    const { data, actions } = build();
    render(<FranksMenuShell data={data} actions={actions} />);
    // CARBONARA has no modifier group and an empty recipe: plain add button.
    expect(screen.getByRole('button', { name: 'Aggiungi CARBONARA' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Personalizza CARBONARA' })).toBeNull();
  });

  it('mostra la barra carrello fissa con totale quando il carrello non è vuoto', () => {
    const { data, actions } = build({}, { cartCount: 3, cartTotal: 24.5 });
    render(<FranksMenuShell data={data} actions={actions} />);
    expect(screen.getByRole('button', { name: /Vedi carrello/ })).toBeTruthy();
    expect(screen.getByText('EUR 24.50')).toBeTruthy();
  });

  it('non mostra la barra carrello a carrello vuoto', () => {
    const { data, actions } = build();
    render(<FranksMenuShell data={data} actions={actions} />);
    expect(screen.queryByRole('button', { name: /Vedi carrello/ })).toBeNull();
  });

  it('rende l\'entrata group order nella chrome quando è attiva', () => {
    const onGroupOrder = vi.fn();
    const { data, actions } = build({}, { groupOrderEnabled: true, onGroupOrder });
    render(<FranksMenuShell data={data} actions={actions} />);
    const entry = screen.getByRole('button', { name: /Ordina insieme/ });
    entry.click();
    expect(onGroupOrder).toHaveBeenCalledTimes(1);
  });

  it('non rende l\'entrata group order quando è disattivata', () => {
    const { data, actions } = build();
    render(<FranksMenuShell data={data} actions={actions} />);
    expect(screen.queryByRole('button', { name: /Ordina insieme/ })).toBeNull();
  });
});

describe('Franks menu shell — preset', () => {
  it('nasconde "In evidenza" con il preset minimal_elegant', () => {
    const { data, actions } = build();
    render(<FranksMenuShell data={data} actions={actions} />);
    expect(screen.queryByRole('heading', { name: 'In evidenza' })).toBeNull();
  });

  it('mostra "In evidenza" con il preset rich_visual', () => {
    const { data, actions } = build({
      appearance: { ...BASE_APPEARANCE, preset: 'rich_visual', layout: PRESET_LAYOUTS.rich_visual },
    });
    render(<FranksMenuShell data={data} actions={actions} />);
    expect(screen.getByRole('heading', { name: 'In evidenza' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Piatti in evidenza' })).toBeTruthy();
  });

  it('la sezione highlights esplicitamente attiva vince sul preset', () => {
    const { data, actions } = build({
      enabledSections: new Set(['hero', 'categories_nav', 'highlights', 'item_grid', 'footer_note']),
    });
    render(<FranksMenuShell data={data} actions={actions} />);
    expect(screen.getByRole('heading', { name: 'In evidenza' })).toBeTruthy();
  });

  it('nasconde "In evidenza" mentre si cerca anche con preset visuale', () => {
    const { data, actions } = build({
      appearance: { ...BASE_APPEARANCE, preset: 'rich_visual', layout: PRESET_LAYOUTS.rich_visual },
      searchQuery: 'carbo',
    });
    render(<FranksMenuShell data={data} actions={actions} />);
    expect(screen.queryByRole('heading', { name: 'In evidenza' })).toBeNull();
  });
});

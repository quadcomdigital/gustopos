import { describe, expect, it } from 'vitest';
import type { PublicMenuResponse, PublicMenuModuleConfig } from '@gustopos/shared';
import {
  DefaultMenuShell,
  resolveCartAffordance,
  resolveCartDrawer,
  resolveMenuScaffold,
  resolveModifierSheet,
  resolveScaffoldBrand,
} from '../menu/scaffolds';
import { resolvePublicBrand } from '../menu/brand';
import { buildAppearance, resolveEnabledSections, resolveSectionOrder } from '../menu/useMenuConfig';
import { ingredientLine } from '../menu/sections/ItemCard';
import { readableOn } from '../menu/brand/tokens';

function config(overrides: Partial<PublicMenuModuleConfig> = {}): PublicMenuModuleConfig {
  return {
    preset: 'minimal_elegant',
    showIngredients: true,
    showPrices: true,
    currency: 'EUR',
    accentColor: '#0f172a',
    categoryOrder: [],
    hiddenCategoryIds: [],
    featuredItemIds: [],
    soldOutItemIds: [],
    sections: [
      { id: 'hero', enabled: true, order: 0 },
      { id: 'categories_nav', enabled: true, order: 1 },
      { id: 'item_grid', enabled: true, order: 2 },
      { id: 'footer_note', enabled: false, order: 3 },
    ],
    content: {},
    ...overrides,
  };
}

function menu(overrides: Partial<PublicMenuResponse> = {}): PublicMenuResponse {
  return {
    tenant: { id: 'ten_1', slug: 'franks', name: 'Franks' },
    branding: {
      preset: 'minimal_elegant',
      showIngredients: true,
      showPrices: true,
      currency: 'EUR',
      accentColor: '#111111',
    },
    config: config(),
    scaffoldKey: null,
    capabilities: {
      takeawayOrder: true,
      groupOrder: false,
      takeawayConfig: { minOrderAmount: 0, maxItems: 20, pickupEtaRequired: false, allowNotes: true },
    },
    categories: [],
    items: [],
    categoryModifierPools: [],
    generatedAt: new Date().toISOString(),
    ...overrides,
  } as PublicMenuResponse;
}

describe('menu scaffold resolver', () => {
  it('falls back to the default shell for unknown keys', () => {
    expect(resolveMenuScaffold(null)).toBe(DefaultMenuShell);
    expect(resolveMenuScaffold('does-not-exist')).toBe(DefaultMenuShell);
  });

  it('resolves the franks scaffold for its key', () => {
    expect(resolveMenuScaffold('franks')).not.toBe(DefaultMenuShell);
  });

  it('keeps a stable shell identity across calls (no remount per render)', () => {
    expect(resolveMenuScaffold('franks')).toBe(resolveMenuScaffold('franks'));
    expect(resolveMenuScaffold('does-not-exist')).toBe(resolveMenuScaffold(null));
  });
});

describe('scaffold brand registry', () => {
  it('hands the franks palette to the shared layer as plain data', () => {
    const brand = resolveScaffoldBrand('franks');
    expect(brand).not.toBeNull();
    expect(brand?.accent).toBe('#fbda1b');
    expect(brand?.ink).toBe('#0b0b0c');
    expect(brand?.logoUrl).toBeTruthy();
  });

  it('contributes nothing for unknown or missing keys', () => {
    expect(resolveScaffoldBrand('does-not-exist')).toBeNull();
    expect(resolveScaffoldBrand(null)).toBeNull();
  });

  it('resolves a full public brand for the franks menu', () => {
    const brand = resolvePublicBrand(menu({ scaffoldKey: 'franks' }));
    expect(brand.name).toBe('Franks');
    expect(brand.isCodeBrand).toBe(true);
    expect(brand.accent).toBe('#fbda1b');
    expect(brand.ink).toBe('#0b0b0c');
    expect(brand.pageBg).toBe('#f7f7f4');
    expect(brand.logoUrl).toBeTruthy();
    // Yellow is fill-only: the text-on-accent pair must stay readable.
    expect(readableOn(brand.accent)).toBe('#0b0b0c');
  });

  it('falls back to a neutral identity without a scaffold', () => {
    const brand = resolvePublicBrand(menu({ scaffoldKey: null }));
    expect(brand.isCodeBrand).toBe(false);
    expect(brand.ink).toBe('#0f172a');
    expect(brand.logoUrl).toBeUndefined();
  });

  it('drives the cart affordance and overlays from the registry', () => {
    expect(resolveCartAffordance('franks')).toBe('shell');
    expect(resolveCartAffordance('does-not-exist')).toBe('floating');
    expect(resolveCartAffordance(null)).toBe('floating');
    expect(resolveCartDrawer('franks')).not.toBeNull();
    expect(resolveCartDrawer(null)).toBeNull();
    expect(resolveModifierSheet('franks')).not.toBeNull();
    expect(resolveModifierSheet(null)).toBeNull();
  });
});

describe('menu config helpers', () => {
  it('builds appearance preferring config over branding', () => {
    const appearance = buildAppearance(menu(), config({ accentColor: '#ff0000', currency: 'USD' }));
    expect(appearance.accent).toBe('#ff0000');
    expect(appearance.currency).toBe('USD');
  });

  it('fills the schema-default accent hole with the code brand', () => {
    const appearance = buildAppearance(menu(), config(), { accent: '#fbda1b', ink: '#0b0b0c' });
    expect(appearance.accent).toBe('#fbda1b');
    expect(appearance.ink).toBe('#0b0b0c');
  });

  it('keeps an explicit config accent above the code brand', () => {
    const appearance = buildAppearance(menu(), config({ accentColor: '#ff0000' }), { accent: '#fbda1b' });
    expect(appearance.accent).toBe('#ff0000');
  });

  it('derives a readable foreground for every accent', () => {
    for (const accent of ['#fbda1b', '#0f172a', '#ff0000']) {
      const appearance = buildAppearance(menu(), config({ accentColor: accent }));
      expect(appearance.accentForeground).toMatch(/^#(0b0b0c|ffffff)$/i);
      expect(appearance.accentText).toMatch(/^#/);
    }
  });

  it('orders and filters sections from config', () => {
    const cfg = config({
      sections: [
        { id: 'item_grid', enabled: true, order: 0 },
        { id: 'hero', enabled: false, order: 1 },
        { id: 'categories_nav', enabled: true, order: 2 },
      ],
    });
    expect(resolveSectionOrder(cfg)).toEqual(['item_grid', 'hero', 'categories_nav']);
    const enabled = resolveEnabledSections(cfg);
    expect(enabled.has('item_grid')).toBe(true);
    expect(enabled.has('hero')).toBe(false);
  });
});

describe('ingredient line normalisation', () => {
  const base = menu().items[0] ?? ({} as PublicMenuResponse['items'][number]);

  it('prefers recipe names (ingredients + preps) when present', () => {
    const item = {
      ...base,
      ingredients: ['Songino'],
      recipe: [
        { componentType: 'prep', componentId: 'prep_1', componentName: 'Pomodoro a fette', quantity: 4, unit: 'pz' },
        { componentType: 'ingredient', componentId: 'i_1', componentName: 'Songino', quantity: 18, unit: 'g' },
      ],
    } as PublicMenuResponse['items'][number];
    expect(ingredientLine(item)).toBe('Ingredienti: Pomodoro a fette, Songino');
  });

  it('falls back to the ingredient name list', () => {
    const item = {
      ...base,
      ingredients: ['Rucola', 'Chicken'],
      recipe: [],
    } as PublicMenuResponse['items'][number];
    expect(ingredientLine(item)).toBe('Ingredienti: Rucola, Chicken');
  });

  it('returns empty string when nothing is available', () => {
    const item = { ...base, ingredients: [], recipe: [] } as PublicMenuResponse['items'][number];
    expect(ingredientLine(item)).toBe('');
  });
});

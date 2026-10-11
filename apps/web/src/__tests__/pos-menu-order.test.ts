import { describe, expect, it } from 'vitest';
import { sortPosMenuAlphabetically, usesAlphabeticalPosOrder } from '../lib/pos-menu-order';

const CASALE_ID = 'ten_2ad3a695-8893-411f-b922-f28c9b30a6d8';

describe('usesAlphabeticalPosOrder', () => {
  it('is on for casale (resolved by tenant id, all the store carries)', () => {
    expect(usesAlphabeticalPosOrder({ tenantId: CASALE_ID })).toBe(true);
  });

  it('is on for casale by slug too', () => {
    expect(usesAlphabeticalPosOrder({ tenantId: 'ten_other', tenantSlug: 'casale' })).toBe(true);
  });

  it('is off for every other tenant and for no tenant at all', () => {
    expect(usesAlphabeticalPosOrder({ tenantId: 'ten_26ed333e-9dbd-43f7-85b1-fe57054e9e6f' })).toBe(false);
    expect(usesAlphabeticalPosOrder(null)).toBe(false);
    expect(usesAlphabeticalPosOrder(undefined)).toBe(false);
  });
});

describe('sortPosMenuAlphabetically', () => {
  const item = (name: string) => ({ id: name, name });

  it('sorts A→Z, ignoring case and accents', () => {
    const names = sortPosMenuAlphabetically([
      item('Zuppa'),
      item('Insalata'),
      item('Éclair'),
      item('arancini'),
      item('Cacio e pepe'),
    ]).map((i) => i.name);

    expect(names).toEqual(['arancini', 'Cacio e pepe', 'Éclair', 'Insalata', 'Zuppa']);
  });

  it('compares numbers numerically (Pizza 2 before Pizza 10)', () => {
    const names = sortPosMenuAlphabetically([item('Pizza 10'), item('Pizza 2'), item('Pizza 1')]).map((i) => i.name);
    expect(names).toEqual(['Pizza 1', 'Pizza 2', 'Pizza 10']);
  });

  it('returns a new array and leaves the catalog order untouched', () => {
    const catalog = [item('Zuppa'), item('Insalata')];
    const sorted = sortPosMenuAlphabetically(catalog);

    expect(sorted).not.toBe(catalog);
    expect(catalog.map((i) => i.name)).toEqual(['Zuppa', 'Insalata']);
    expect(sorted.map((i) => i.name)).toEqual(['Insalata', 'Zuppa']);
  });
});

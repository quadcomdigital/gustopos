import { describe, expect, it } from 'vitest';
import { isCategoryAtGroupEdge, moveCategoryInGroup } from '../lib/category-order';

const group = [
  { id: 'cat_pizzeria', scope: 'menu' },
  { id: 'cat_primi', scope: 'menu' },
  { id: 'cat_secondi', scope: 'menu' },
];

describe('moveCategoryInGroup', () => {
  it('swaps with the neighbour and returns the WHOLE group', () => {
    expect(moveCategoryInGroup(group, 'cat_primi', -1)).toEqual(['cat_primi', 'cat_pizzeria', 'cat_secondi']);
    expect(moveCategoryInGroup(group, 'cat_primi', 1)).toEqual(['cat_pizzeria', 'cat_secondi', 'cat_primi']);
  });

  it('moves the head down and the tail up', () => {
    expect(moveCategoryInGroup(group, 'cat_pizzeria', 1)).toEqual(['cat_primi', 'cat_pizzeria', 'cat_secondi']);
    expect(moveCategoryInGroup(group, 'cat_secondi', -1)).toEqual(['cat_pizzeria', 'cat_secondi', 'cat_primi']);
  });

  it('refuses to fall off either edge (arrows are disabled there)', () => {
    expect(moveCategoryInGroup(group, 'cat_pizzeria', -1)).toBeNull();
    expect(moveCategoryInGroup(group, 'cat_secondi', 1)).toBeNull();
  });

  it('refuses an id that is not in the group', () => {
    expect(moveCategoryInGroup(group, 'cat_sconosciuta', 1)).toBeNull();
    expect(moveCategoryInGroup([], 'cat_pizzeria', 1)).toBeNull();
  });

  it('never mutates the input group', () => {
    const input = [...group];
    moveCategoryInGroup(input, 'cat_pizzeria', 1);
    expect(input.map((c) => c.id)).toEqual(['cat_pizzeria', 'cat_primi', 'cat_secondi']);
  });
});

describe('isCategoryAtGroupEdge', () => {
  it('flags the first and the last entry only', () => {
    expect(isCategoryAtGroupEdge(group, 'cat_pizzeria', -1)).toBe(true);
    expect(isCategoryAtGroupEdge(group, 'cat_pizzeria', 1)).toBe(false);
    expect(isCategoryAtGroupEdge(group, 'cat_secondi', 1)).toBe(true);
    expect(isCategoryAtGroupEdge(group, 'cat_secondi', -1)).toBe(false);
    expect(isCategoryAtGroupEdge(group, 'cat_primi', -1)).toBe(false);
    expect(isCategoryAtGroupEdge(group, 'cat_primi', 1)).toBe(false);
  });

  it('treats an unknown id as blocked in both directions', () => {
    expect(isCategoryAtGroupEdge(group, 'cat_sconosciuta', -1)).toBe(true);
    expect(isCategoryAtGroupEdge(group, 'cat_sconosciuta', 1)).toBe(true);
  });
});

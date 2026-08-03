/** Canonical recipe units and deterministic built-in conversions. */

export type UnitFamily = 'weight' | 'volume' | 'piece' | 'unknown';

const ALIASES: Record<string, string> = {
  milligram: 'mg',
  milligrams: 'mg',
  milligrammo: 'mg',
  milligrammi: 'mg',
  gram: 'g',
  grams: 'g',
  grammo: 'g',
  grammi: 'g',
  kilogram: 'kg',
  kilograms: 'kg',
  kilogrammo: 'kg',
  kilogrammi: 'kg',
  milliliter: 'ml',
  milliliters: 'ml',
  millilitro: 'ml',
  millilitri: 'ml',
  liter: 'L',
  liters: 'L',
  litro: 'L',
  litri: 'L',
  piece: 'pz',
  pieces: 'pz',
  pezzo: 'pz',
  pezzi: 'pz',
};

const TO_BASE: Record<string, number> = {
  mg: 0.000001,
  g: 0.001,
  kg: 1,
  ml: 0.001,
  L: 1,
  pz: 1,
};

function key(unit: string): string {
  const raw = unit.trim().replace(/\s+/g, '');
  return ALIASES[raw.toLowerCase()] ?? raw;
}

export function normalizeUnit(unit: string): string {
  const normalized = key(unit);
  if (!(normalized in TO_BASE)) {
    throw new Error(`Unsupported unit: ${unit}`);
  }
  return normalized;
}

export function getUnitFamily(unit: string): UnitFamily {
  const normalized = key(unit);
  if (['mg', 'g', 'kg'].includes(normalized)) return 'weight';
  if (['ml', 'L'].includes(normalized)) return 'volume';
  if (normalized === 'pz') return 'piece';
  return 'unknown';
}

export function areUnitsCompatible(unitA: string, unitB: string): boolean {
  const familyA = getUnitFamily(unitA);
  const familyB = getUnitFamily(unitB);
  return familyA !== 'unknown' && familyA === familyB;
}

/** Convert within one physical unit family; returns null for invalid families. */
export function convertUnit(quantity: number, fromUnit: string, toUnit: string): number | null {
  if (!Number.isFinite(quantity)) return null;
  let from: string;
  let to: string;
  try {
    from = normalizeUnit(fromUnit);
    to = normalizeUnit(toUnit);
  } catch {
    return null;
  }
  if (!areUnitsCompatible(from, to)) return null;
  return quantity * TO_BASE[from] / TO_BASE[to];
}

export function getDefaultInventoryUnit(unit: string): string {
  switch (getUnitFamily(unit)) {
    case 'weight': return 'kg';
    case 'volume': return 'L';
    case 'piece': return 'pz';
    default: return unit;
  }
}

export function spreadsheetToInventory(quantity: number, spreadsheetUnit: string, inventoryUnit: string): number | null {
  return convertUnit(quantity, spreadsheetUnit, inventoryUnit);
}

export function formatQuantity(quantity: number, unit: string): string {
  switch (getUnitFamily(unit)) {
    case 'weight': return quantity < 1 ? `${(quantity * 1000).toFixed(0)}g` : `${quantity.toFixed(2)}kg`;
    case 'volume': return quantity < 1 ? `${(quantity * 1000).toFixed(0)}ml` : `${quantity.toFixed(2)}L`;
    case 'piece': return `${quantity} pz`;
    default: return `${quantity} ${unit}`;
  }
}

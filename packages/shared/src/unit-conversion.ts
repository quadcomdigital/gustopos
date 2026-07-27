/**
 * Unit conversion utilities for food cost matrix.
 * Bridges spreadsheet units (grams, portions, pieces) ↔ inventory units (kg, pz, L).
 */

// Conversion factors to base units (kg for weight, pz for pieces, L for volume)
const TO_BASE: Record<string, number> = {
  kg: 1,
  g: 0.001,
  mg: 0.000001,
  pz: 1,
  pezzo: 1,
  pezzi: 1,
  l: 1,
  ml: 0.001,
  cl: 0.01,
  porzione: 1, // portions are treated as pieces by default
};

const FROM_BASE: Record<string, number> = {
  kg: 1,
  g: 1000,
  mg: 1000000,
  pz: 1,
  pezzo: 1,
  pezzi: 1,
  l: 1,
  ml: 1000,
  cl: 100,
  porzione: 1,
};

function normalizeUnitKey(unit: string): string {
  return unit.toLowerCase().trim().replace(/\s+/g, '');
}

/**
 * Convert a quantity from one unit to another.
 * Returns null if conversion is not possible (incompatible unit families).
 */
export function convertUnit(
  quantity: number,
  fromUnit: string,
  toUnit: string,
): number | null {
  const from = normalizeUnitKey(fromUnit);
  const to = normalizeUnitKey(toUnit);

  if (from === to) return quantity;

  const fromBase = TO_BASE[from];
  const toBase = TO_BASE[to];

  if (fromBase == null || toBase == null) return null;

  // Convert: fromUnit → base → toUnit
  const baseValue = quantity * fromBase;
  return baseValue / toBase;
}

/**
 * Get the unit family (weight, piece, volume) for a unit string.
 */
export function getUnitFamily(unit: string): 'weight' | 'piece' | 'volume' | 'unknown' {
  const key = normalizeUnitKey(unit);
  if (['kg', 'g', 'mg'].includes(key)) return 'weight';
  if (['pz', 'pezzo', 'pezzi'].includes(key)) return 'piece';
  if (['l', 'ml', 'cl'].includes(key)) return 'volume';
  if (key === 'porzione') return 'piece';
  return 'unknown';
}

/**
 * Check if two units are compatible for conversion.
 */
export function areUnitsCompatible(unitA: string, unitB: string): boolean {
  return getUnitFamily(unitA) === getUnitFamily(unitB) && getUnitFamily(unitA) !== 'unknown';
}

/**
 * Get the default inventory unit for a given spreadsheet unit.
 * e.g., 'g' → 'kg', 'porzione' → 'pz'
 */
export function getDefaultInventoryUnit(spreadsheetUnit: string): string {
  const family = getUnitFamily(spreadsheetUnit);
  switch (family) {
    case 'weight': return 'kg';
    case 'piece': return 'pz';
    case 'volume': return 'L';
    default: return spreadsheetUnit;
  }
}

/**
 * Convert spreadsheet quantity (typically grams or pieces) to inventory unit.
 * For weight: divides by 1000 (g → kg).
 * For pieces: returns as-is (pz → pz).
 */
export function spreadsheetToInventory(
  quantity: number,
  spreadsheetUnit: string,
  inventoryUnit: string,
): number | null {
  return convertUnit(quantity, spreadsheetUnit, inventoryUnit);
}

/**
 * Format a quantity for display with appropriate precision.
 */
export function formatQuantity(quantity: number, unit: string): string {
  const family = getUnitFamily(unit);
  switch (family) {
    case 'weight':
      return quantity < 1 ? `${(quantity * 1000).toFixed(0)}g` : `${quantity.toFixed(2)}kg`;
    case 'piece':
      return `${Math.round(quantity)} pz`;
    case 'volume':
      return quantity < 1 ? `${(quantity * 1000).toFixed(0)}ml` : `${quantity.toFixed(2)}L`;
    default:
      return quantity.toFixed(2);
  }
}

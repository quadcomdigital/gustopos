import { convertUnit, normalizeUnit } from "./unit-conversion";

export type InventoryComponentType = "ingredient" | "bom" | "prep";
export type PrepSourceKind = "ingredient" | "bom";

export interface TargetUnitConversion {
  targetType: "ingredient";
  targetId: string;
  fromUnit: string;
  toUnit: string;
  factor: number;
}

export interface NormalizeTargetQuantityInput {
  quantity: number;
  fromUnit: string;
  targetUnit: string;
  targetType: InventoryComponentType;
  targetId?: string;
  customConversions?: readonly TargetUnitConversion[];
}

/**
 * Normalize an edge quantity into the referenced target's canonical/output unit.
 * Standard metric conversions are available for every target. Custom factors
 * are deliberately restricted to ingredient targets (packaging/purchasing).
 */
export function normalizeTargetQuantity(input: NormalizeTargetQuantityInput): number {
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
    throw new Error("Quantity must be a finite positive number");
  }

  const targetUnit = normalizeUnit(input.targetUnit);
  const standard = convertUnit(input.quantity, input.fromUnit, targetUnit);
  if (standard !== null) return standard;

  if (input.targetType !== "ingredient" || !input.targetId) {
    throw new Error(`Units ${input.fromUnit} and ${input.targetUnit} are incompatible for ${input.targetType}`);
  }

  const normalizeBoundaryUnit = (unit: string) => unit.trim().replace(/\s+/g, "").toLowerCase();
  const custom = input.customConversions?.find((conversion) =>
    conversion.targetType === "ingredient" &&
    conversion.targetId === input.targetId &&
    normalizeBoundaryUnit(conversion.fromUnit) === normalizeBoundaryUnit(input.fromUnit) &&
    normalizeUnit(conversion.toUnit) === targetUnit,
  );
  if (!custom || !Number.isFinite(custom.factor) || custom.factor <= 0) {
    throw new Error(`No valid conversion from ${input.fromUnit} to ${input.targetUnit} for ingredient ${input.targetId}`);
  }
  return input.quantity * custom.factor;
}

export interface BomGraphEdge {
  bomId: string;
  componentType: InventoryComponentType;
  componentId: string;
}

export interface PrepSourceEdge {
  prepId: string;
  sourceType: PrepSourceKind;
  sourceId: string;
}

type GraphNode = `bom:${string}` | `prep:${string}`;

/**
 * Validate the complete BOM/prep dependency graph. Prep edges are included so
 * cycles such as bom A -> prep B -> source bom A are rejected before writes.
 */
export function assertAcyclicBomGraph(
  bomEdges: readonly BomGraphEdge[],
  prepSources: readonly PrepSourceEdge[] = [],
): void {
  const edgesByNode = new Map<GraphNode, GraphNode[]>();
  const addEdge = (from: GraphNode, to: GraphNode) => {
    const edges = edgesByNode.get(from) ?? [];
    edges.push(to);
    edgesByNode.set(from, edges);
  };

  for (const edge of bomEdges) {
    if (edge.componentType === "bom") addEdge(`bom:${edge.bomId}`, `bom:${edge.componentId}`);
    if (edge.componentType === "prep") addEdge(`bom:${edge.bomId}`, `prep:${edge.componentId}`);
  }
  for (const source of prepSources) {
    if (source.sourceType === "bom") addEdge(`prep:${source.prepId}`, `bom:${source.sourceId}`);
  }

  const visiting = new Set<GraphNode>();
  const visited = new Set<GraphNode>();
  const visit = (node: GraphNode, path: GraphNode[]) => {
    if (visiting.has(node)) {
      const cycleStart = path.indexOf(node);
      const cycle = [...path.slice(cycleStart), node].join(" → ");
      throw new Error(`Inventory recipe cycle detected: ${cycle}`);
    }
    if (visited.has(node)) return;

    visiting.add(node);
    for (const next of edgesByNode.get(node) ?? []) visit(next, [...path, node]);
    visiting.delete(node);
    visited.add(node);
  };

  for (const node of edgesByNode.keys()) visit(node, []);
}

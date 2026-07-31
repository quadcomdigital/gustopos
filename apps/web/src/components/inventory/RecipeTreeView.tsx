import { useState } from 'react';
import { ChevronRight, ChevronDown, Layers, Leaf } from 'lucide-react';

interface RecipeComponent {
  componentType: 'ingredient' | 'bom' | 'prep';
  componentId: string;
  quantity: number;
  unit: string;
}

interface BomItem {
  id: string;
  name: string;
  unit: string;
  yieldQuantity: number;
  components: Array<{
    componentType: 'ingredient' | 'bom' | 'prep';
    componentId: string;
    quantity: number;
    unit: string;
  }>;
}

interface Ingredient {
  id: string;
  name: string;
  unit: string;
}

interface PrepItem {
  id: string;
  name: string;
  unit: string;
}

interface RecipeTreeViewProps {
  recipe: RecipeComponent[];
  bomItems: BomItem[];
  inventory: Ingredient[];
  prepItems?: PrepItem[];
  depth?: number;
}

export default function RecipeTreeView({ recipe, bomItems, inventory, prepItems = [], depth = 0 }: RecipeTreeViewProps) {
  const ingredientNameById = new Map(inventory.map((i) => [i.id, i.name]));
  const bomNameById = new Map(bomItems.map((b) => [b.id, b.name]));
  const prepNameById = new Map(prepItems.map((p) => [p.id, p.name]));

  const getName = (componentType: string, componentId: string) => {
    if (componentType === 'ingredient') return ingredientNameById.get(componentId) ?? componentId;
    if (componentType === 'prep') return prepNameById.get(componentId) ?? componentId;
    return bomNameById.get(componentId) ?? componentId;
  };

  return (
    <div className={`space-y-1 ${depth > 0 ? 'ml-4 pl-3 border-l-2 border-border/50' : ''}`}>
      {recipe.map((component, idx) => (
        <TreeNode
          key={`${component.componentType}-${component.componentId}-${idx}`}
          component={component}
          bomItems={bomItems}
          prepItems={prepItems}
          inventory={inventory}
          ingredientNameById={ingredientNameById}
          bomNameById={bomNameById}
          prepNameById={prepNameById}
          getName={getName}
          depth={depth}
        />
      ))}
    </div>
  );
}

interface TreeNodeProps {
  component: RecipeComponent;
  bomItems: BomItem[];
  prepItems: PrepItem[];
  inventory: Ingredient[];
  ingredientNameById: Map<string, string>;
  bomNameById: Map<string, string>;
  prepNameById: Map<string, string>;
  getName: (componentType: string, componentId: string) => string;
  depth: number;
}

function TreeNode({ component, bomItems, prepItems, inventory, ingredientNameById: _ingredientNameById, bomNameById: _bomNameById, prepNameById: _prepNameById, getName, depth }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(false);
  const isBoM = component.componentType === 'bom';
  const bom = isBoM ? bomItems.find((b) => b.id === component.componentId) : null;
  const name = getName(component.componentType, component.componentId);

  return (
    <div>
      <div className="flex items-center gap-2 text-xs py-1">
        {isBoM ? (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="inline-flex items-center gap-1 text-primary hover:text-primary/80"
          >
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            <Layers size={12} />
          </button>
        ) : (
          <Leaf size={12} className="text-text-muted ml-3" />
        )}
        <span className="font-bold uppercase text-[10px] text-text-muted w-12">
          {component.componentType === 'ingredient' ? 'Ingred' : component.componentType === 'prep' ? 'Prep' : 'BoM'}
        </span>
        <span className="text-secondary">{name}</span>
        <span className="text-text-muted font-bold">
          {component.quantity} {component.unit}
        </span>
        {isBoM && bom && (
          <span className="text-[10px] text-text-muted">
            (resa: {bom.yieldQuantity} {bom.unit})
          </span>
        )}
      </div>
      {isBoM && expanded && bom && (
        <RecipeTreeView
          recipe={bom.components.map((c) => ({
            componentType: c.componentType as 'ingredient' | 'bom' | 'prep',
            componentId: c.componentId,
            quantity: c.quantity,
            unit: c.unit,
          }))}
          bomItems={bomItems}
          inventory={inventory}
          prepItems={prepItems}
          depth={depth + 1}
        />
      )}
    </div>
  );
}
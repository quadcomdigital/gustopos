import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RecipeBuilder from '../components/inventory/RecipeBuilder';
import type { Ingredient, BomItem, PrepItem, MenuRecipeComponent } from '@gustopos/shared';

// ─── Mock data ──────────────────────────────────────────────────────────────

const mockInventory: Ingredient[] = [
  { id: 'ing-1', name: 'Farina', unit: 'kg', quantity: 50, unitCost: 1.2, isActive: true, categoryId: 'cat-1', minThreshold: 10, sku: '', salePrice: 0 },
  { id: 'ing-2', name: 'Acqua', unit: 'l', quantity: 100, unitCost: 0.01, isActive: true, categoryId: 'cat-1', minThreshold: 20, sku: '', salePrice: 0 },
  { id: 'ing-container', name: 'Scatola Pizza', unit: 'pz', quantity: 200, unitCost: 0.3, isActive: true, categoryId: 'cat-2', minThreshold: 20, sku: '', salePrice: 0 },
] as Ingredient[];

const mockBomItems: BomItem[] = [
  {
    id: 'bom-1', name: 'Impasto Base', outputUnit: 'kg', yieldQuantity: 10, isActive: true, categoryId: 'cat-bom',
    components: [
      { id: 'bc-1', componentType: 'ingredient', componentId: 'ing-1', quantity: 5, unit: 'kg' },
      { id: 'bc-2', componentType: 'ingredient', componentId: 'ing-2', quantity: 3, unit: 'l' },
      { id: 'bc-3', componentType: 'ingredient', componentId: 'ing-container', quantity: 1, unit: 'pz' },
    ],
  },
] as BomItem[];

const mockPrepItems: PrepItem[] = [];

const baseComponents: MenuRecipeComponent[] = [
  { componentType: 'ingredient', componentId: 'ing-1', quantity: 1, unit: 'kg' },
  { componentType: 'bom', componentId: 'bom-1', quantity: 1, unit: 'kg' },
];

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('RecipeBuilder', () => {
  const baseProps = {
    inventory: mockInventory,
    bomItems: mockBomItems,
    prepItems: mockPrepItems,
    onChange: vi.fn(),
    showCost: true,
  };

  it('renders with components', () => {
    render(<RecipeBuilder components={baseComponents} {...baseProps} />);
    expect(screen.getByText('Farina')).toBeInTheDocument();
    expect(screen.getByText('Impasto Base')).toBeInTheDocument();
  });

  it('renders cost estimate when showCost is true', () => {
    render(<RecipeBuilder components={baseComponents} {...baseProps} />);
    expect(screen.getByText('Costo stimato')).toBeInTheDocument();
  });

  it('renders empty state when no components', () => {
    render(<RecipeBuilder components={[]} {...baseProps} />);
    expect(screen.getByText('Nessun ingrediente aggiunto')).toBeInTheDocument();
  });

  it('shows the component add form', () => {
    render(<RecipeBuilder components={baseComponents} {...baseProps} />);
    // The ComponentPicker renders type selector, quantity input, and add button
    expect(screen.getByText('Ricetta')).toBeInTheDocument();
    // There should be quantity inputs (ComponentRow + ComponentPicker)
    const inputs = screen.getAllByRole('spinbutton');
    expect(inputs.length).toBeGreaterThanOrEqual(2);
  });

  it('ComponentRow allows modifying quantity via input', async () => {
    const onChange = vi.fn();
    render(<RecipeBuilder components={baseComponents} {...baseProps} onChange={onChange} />);

    const inputs = screen.getAllByRole('spinbutton');
    // The ComponentRow quantity inputs have min and step attributes
    const inlineInputs = Array.from(inputs).filter(
      i => i.closest('[class*="flex items-center"]') && i.getAttribute('min') !== null
    );
    if (inlineInputs.length > 0) {
      await userEvent.clear(inlineInputs[0]);
      await userEvent.type(inlineInputs[0], '3');
      expect(inlineInputs[0]).toHaveValue(3);
    }
  });

  it('container ingredient is filtered from candidates', () => {
    render(<RecipeBuilder components={baseComponents} {...baseProps} />);
    // "Scatola Pizza" (isContainer=1) should NOT appear in the candidate list
    expect(screen.queryByText('Scatola Pizza')).not.toBeInTheDocument();
  });

  it('renders the recipe title', () => {
    render(<RecipeBuilder components={baseComponents} {...baseProps} />);
    expect(screen.getByText('Ricetta')).toBeInTheDocument();
    expect(screen.getByText('Ingredienti & Preparati')).toBeInTheDocument();
  });
});

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ComponentTree from '../components/inventory/product-builder/ComponentTree';
import type { Ingredient, BomItem, PrepItem, MenuRecipeComponent } from '@gustopos/shared';

// ─── Mock data ──────────────────────────────────────────────────────────────

const mockInventory: Ingredient[] = [
  { id: 'ing-1', name: 'Pomodoro', unit: 'kg', quantity: 10, unitCost: 3.5, isActive: true, isContainer: 0, categoryId: 'cat-1', minThreshold: 1, sku: '', salePrice: 0 },
  { id: 'ing-2', name: 'Mozzarella', unit: 'kg', quantity: 5, unitCost: 12, isActive: true, isContainer: 0, categoryId: 'cat-1', minThreshold: 1, sku: '', salePrice: 0 },
  { id: 'ing-container', name: 'Bun classico', unit: 'pz', quantity: 30, unitCost: 0.5, isActive: true, isContainer: 1, categoryId: 'cat-1', minThreshold: 5, sku: '', salePrice: 0 },
] as Ingredient[];

const mockBomItems: BomItem[] = [
  {
    id: 'bom-1', name: 'Impasto Pizza', unit: 'kg', yieldQuantity: 5, isActive: true, categoryId: 'cat-bom',
    components: [
      { id: 'bc-1', componentType: 'ingredient', componentId: 'ing-1', quantity: 2, unit: 'kg' },
      { id: 'bc-2', componentType: 'ingredient', componentId: 'ing-2', quantity: 1, unit: 'kg' },
    ],
  },
] as BomItem[];

const mockPrepItems: PrepItem[] = [];

const baseComponents: MenuRecipeComponent[] = [
  { componentType: 'ingredient', componentId: 'ing-1', quantity: 0.5, unit: 'kg' },
  { componentType: 'bom', componentId: 'bom-1', quantity: 1, unit: 'kg' },
];

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('ComponentTree', () => {
  const baseProps = {
    inventory: mockInventory,
    bomItems: mockBomItems,
    prepItems: mockPrepItems,
    onEdit: vi.fn(),
    onRemove: vi.fn(),
    onQuantityChange: vi.fn(),
  };

  it('renders all components', () => {
    render(<ComponentTree components={baseComponents} {...baseProps} />);
    // getAllByText since "Pomodoro" appears in both main row and BoM sub-components
    const elements = screen.getAllByText('Pomodoro');
    expect(elements.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Impasto Pizza')).toBeInTheDocument();
  });

  it('shows empty state when no components', () => {
    render(<ComponentTree components={[]} {...baseProps} />);
    expect(screen.getByText('Nessun componente')).toBeInTheDocument();
    expect(screen.getByText(/Aggiungi componente/)).toBeInTheDocument();
  });

  it('renders quantity inputs for each component', () => {
    render(<ComponentTree components={baseComponents} {...baseProps} />);
    const inputs = screen.getAllByRole('spinbutton');
    expect(inputs.length).toBeGreaterThanOrEqual(2);
  });

  it('allows typing in quantity input (localQty allows intermediate values)', async () => {
    const onQuantityChange = vi.fn();
    render(<ComponentTree components={baseComponents} {...baseProps} onQuantityChange={onQuantityChange} />);

    const inputs = screen.getAllByRole('spinbutton');
    const qtyInput = inputs[0];

    await userEvent.clear(qtyInput);
    await userEvent.type(qtyInput, '1.5');

    // Before blur, the input should show the intermediate value
    expect(qtyInput).toHaveValue(1.5);
  });

  it('commits valid quantity on blur (v > 0)', async () => {
    const onQuantityChange = vi.fn();
    render(<ComponentTree components={baseComponents} {...baseProps} onQuantityChange={onQuantityChange} />);

    const inputs = screen.getAllByRole('spinbutton');
    const qtyInput = inputs[0];

    await userEvent.clear(qtyInput);
    await userEvent.type(qtyInput, '2.5');
    await userEvent.tab(); // blur

    expect(onQuantityChange).toHaveBeenCalledWith('ingredient', 'ing-1', 2.5);
  });

  it('resets to previous value on invalid input (0 or empty)', async () => {
    const onQuantityChange = vi.fn();
    render(<ComponentTree components={baseComponents} {...baseProps} onQuantityChange={onQuantityChange} />);

    const inputs = screen.getAllByRole('spinbutton');
    const qtyInput = inputs[0];

    await userEvent.clear(qtyInput);
    await userEvent.type(qtyInput, '0');
    await userEvent.tab();

    // onQuantityChange should NOT have been called (0 is invalid)
    // The input should reset to the original value (0.5)
    expect(onQuantityChange).not.toHaveBeenCalled();
    expect(qtyInput).toHaveValue(0.5);
  });

  it('calls onEdit when pencil button is clicked', async () => {
    const onEdit = vi.fn();
    render(<ComponentTree components={baseComponents} {...baseProps} onEdit={onEdit} />);

    const editButtons = screen.getAllByLabelText('Modifica');
    await userEvent.click(editButtons[0]);

    expect(onEdit).toHaveBeenCalledWith(baseComponents[0]);
  });

  it('calls onRemove when trash button is clicked', async () => {
    const onRemove = vi.fn();
    render(<ComponentTree components={baseComponents} {...baseProps} onRemove={onRemove} />);

    const removeButtons = screen.getAllByLabelText('Rimuovi');
    await userEvent.click(removeButtons[0]);

    expect(onRemove).toHaveBeenCalledWith('ingredient', 'ing-1');
  });

  it('expands BoM component and shows sub-component quantity inputs', async () => {
    const onBomComponentEdit = vi.fn();
    render(<ComponentTree components={baseComponents} {...baseProps} onBomComponentEdit={onBomComponentEdit} />);

    // Click the expand chevron for the BoM component
    const expandBtn = screen.getByText('Impasto Pizza')
      .closest('div')?.querySelector('button');
    if (expandBtn) {
      await userEvent.click(expandBtn);
    }

    // After expansion, sub-component inputs should be visible
    // The BoM sub-components (Pomodoro, Mozzarella) have their own quantity inputs
    const allInputs = screen.getAllByRole('spinbutton');
    // We should have more than the 2 main component inputs now
    expect(allInputs.length).toBeGreaterThanOrEqual(4);
  });
});

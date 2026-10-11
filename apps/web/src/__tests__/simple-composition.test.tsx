import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

// SimpleProductModal loads print stations and production references on mount:
// keep both empty so the test never reaches the network.
vi.mock('../shared/api/client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  fetchPrintStations: vi.fn().mockResolvedValue([]),
  fetchProductionReferences: vi.fn().mockResolvedValue([]),
}));

import type { ReactElement } from 'react';
import SimpleProductModal from '../components/inventory/product-builder/SimpleProductModal';
import type { Category, MenuItemAdmin, MenuItemCreateRequest, MenuItemUpdateRequest } from '@gustopos/shared';

/** Render and flush the two lookups the modal fires on mount (no act warnings). */
async function renderModal(ui: ReactElement) {
  await act(async () => {
    render(ui);
  });
}

/**
 * simple_catalog compositions are plain ingredient names: `componentId` IS the
 * name (quantity/unit are placeholders the POS never shows) and they are what
 * feeds the POS "Togli" tab. These tests pin the two behaviours the whole flow
 * rests on: the list is sent on create, and on update it is sent ONLY when the
 * composition actually changed.
 */

const categories = [
  { id: 'cat_pizzeria', name: 'Pizzeria', scope: 'menu' },
] as unknown as Category[];

const editItem = {
  id: 'm_capricciosa',
  name: 'CAPRICCIOSA',
  ticketName: null,
  price: 8,
  categoryId: 'cat_pizzeria',
  category: 'Pizzeria',
  stationId: null,
  referenceId: null,
  printAreas: [],
  isActive: true,
  recipe: [
    { componentType: 'ingredient', componentId: 'Pomodoro', quantity: 1, unit: 'pz' },
    { componentType: 'ingredient', componentId: 'mozzarella', quantity: 1, unit: 'pz' },
  ],
  modifiers: [],
  modifierGroups: [],
} as unknown as MenuItemAdmin;

/** Type a name into the composition input and add it (button, not Enter). */
function addIngredient(name: string) {
  fireEvent.change(screen.getByLabelText('Nuovo ingrediente'), { target: { value: name } });
  fireEvent.click(screen.getByRole('button', { name: 'Aggiungi' }));
}

describe('SimpleProductModal — composizione simple_catalog', () => {
  it('crea il prodotto con la composizione e deduplica i nomi senza distinzione di maiuscole', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    const onSuccess = vi.fn();

    await renderModal(
      <SimpleProductModal
        open
        onClose={vi.fn()}
        onSuccess={onSuccess}
        categories={categories}
        inventory={[]}
        simpleCatalogMode
        onCreate={onCreate as (payload: MenuItemCreateRequest) => Promise<void>}
      />,
    );

    addIngredient('mozzarella');
    addIngredient('Pomodoro');
    addIngredient('MOZZARELLA'); // same edge key → ignored, not a duplicate row

    expect(screen.getByLabelText('Rimuovi mozzarella')).toBeInTheDocument();
    expect(screen.getByLabelText('Rimuovi Pomodoro')).toBeInTheDocument();
    expect(screen.queryByLabelText('Rimuovi MOZZARELLA')).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Nome prodotto'), { target: { value: 'Pizza Test' } });
    fireEvent.change(screen.getByPlaceholderText('Prezzo di vendita'), { target: { value: '8' } });
    fireEvent.click(screen.getByText('Seleziona categoria'));
    fireEvent.click(screen.getByRole('option', { name: 'Pizzeria' }));

    fireEvent.click(screen.getByRole('button', { name: 'Crea prodotto' }));

    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));
    const payload = onCreate.mock.calls[0][0] as MenuItemCreateRequest;
    expect(payload.recipe).toEqual([
      { componentType: 'ingredient', componentId: 'mozzarella', quantity: 1, unit: 'pz' },
      { componentType: 'ingredient', componentId: 'Pomodoro', quantity: 1, unit: 'pz' },
    ]);
    expect(onSuccess).toHaveBeenCalled();
  });

  it('in modifica toglie e aggiunge ingredienti, e manda components solo se la composizione cambia', async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined);

    await renderModal(
      <SimpleProductModal
        open
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        categories={categories}
        inventory={[]}
        simpleCatalogMode
        onUpdate={onUpdate as (id: string, payload: MenuItemUpdateRequest) => Promise<void>}
        editItem={editItem}
      />,
    );

    // Existing composition renders as removable chips.
    expect(screen.getByLabelText('Rimuovi Pomodoro')).toBeInTheDocument();
    expect(screen.getByLabelText('Rimuovi mozzarella')).toBeInTheDocument();

    // Price-only change: the PATCH must NOT rewrite the recipe edges.
    fireEvent.change(screen.getByPlaceholderText('Prezzo di vendita'), { target: { value: '9' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salva' }));

    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
    expect('components' in (onUpdate.mock.calls[0][1] as object)).toBe(false);

    // Composition changes: the whole list is sent (simple-catalog replaces it).
    fireEvent.click(screen.getByLabelText('Rimuovi Pomodoro'));
    addIngredient('funghi');
    expect(screen.queryByLabelText('Rimuovi Pomodoro')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Salva' }));

    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(2));
    const payload = onUpdate.mock.calls[1][1] as MenuItemUpdateRequest;
    expect(payload.components).toEqual([
      { componentType: 'ingredient', componentId: 'mozzarella', quantity: 1, unit: 'pz' },
      { componentType: 'ingredient', componentId: 'funghi', quantity: 1, unit: 'pz' },
    ]);
    // The rest of the form still travels with the same save.
    expect(payload.price).toBe(9);
  });

  it('non mostra la composizione fuori da simple_catalog (la ricetta resta del builder food)', async () => {
    await renderModal(
      <SimpleProductModal
        open
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        categories={categories}
        inventory={[]}
      />,
    );

    expect(screen.queryByText('Composizione')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Nuovo ingrediente')).not.toBeInTheDocument();
  });
});

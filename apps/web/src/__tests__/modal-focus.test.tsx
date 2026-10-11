import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { useState } from 'react';

// POSProductModal gates JOLLY on the tenant capability via the app store.
vi.mock('../store/app-store', () => ({
  useAppStore: (selector: (state: { tenantContext: { tenantId: string } | null }) => unknown) =>
    selector({ tenantContext: { tenantId: 'ten_test' } }),
}));

import POSProductModal from '../components/POSProductModal';
import ConfirmDialog from '../components/ConfirmDialog';
import { useBackdropDismiss } from '../hooks/useBackdropDismiss';
import type { CourseRoundsConfig, Ingredient, MenuItem } from '@gustopos/shared';

const pizza: MenuItem = {
  id: 'item-margherita',
  name: 'MARGHERITA',
  price: 6.5,
  category: 'Pizzeria',
  categoryId: 'cat_pizzeria',
  printAreas: [],
  isJolly: false,
  isOpenPrice: false,
  ingredients: [],
  recipe: [],
  modifiers: [],
  modifierGroups: [],
};

const courseRoundsConfig = { enabled: false, labels: ['1ª portata'], required: false } satisfies CourseRoundsConfig;

/**
 * Renders the product modal driven by a parent that re-creates `onClose` on
 * every render — exactly what `POSView` did with its inline arrow, which is
 * what made the open-effect re-run and steal focus back to the confirm button
 * (closing the mobile soft-keyboard right after it opened).
 */
function ParentHarness({ inventory }: { inventory: Ingredient[] }) {
  const [open, setOpen] = useState(true);
  return (
    <POSProductModal
      item={pizza}
      isOpen={open}
      onClose={() => setOpen(false)}
      onAddToCart={() => {}}
      inventory={inventory}
      orderMode="dine_in"
      menuItems={[pizza]}
      courseRoundsConfig={courseRoundsConfig}
      courseRoundsModuleEnabled={false}
    />
  );
}

describe('POSProductModal — focus del campo Note non rubato ai re-render', () => {
  it('mantiene il focus sull\'input Note quando il parent re-renderizza con un onClose nuovo', () => {
    const inventory: Ingredient[] = [];
    const { rerender } = render(<ParentHarness inventory={inventory} />);

    const notes = screen.getByPlaceholderText(/Note \(es:/);
    act(() => notes.focus());
    expect(document.activeElement).toBe(notes);

    // New array identity + new inline onClose: the parent re-rendered (socket
    // dataUpdate / viewport resize from the soft-keyboard opening).
    rerender(<ParentHarness inventory={[...inventory]} />);

    expect(document.activeElement).toBe(notes);
  });

  it('non azzerra il testo delle Note quando `inventory` cambia identità (dataUpdate socket)', () => {
    const inventory: Ingredient[] = [];
    const { rerender } = render(<ParentHarness inventory={inventory} />);

    const notes = screen.getByPlaceholderText(/Note \(es:/) as HTMLInputElement;
    fireEvent.change(notes, { target: { value: 'senza glutine, ben cotta' } });
    expect(notes.value).toBe('senza glutine, ben cotta');

    rerender(<ParentHarness inventory={[...inventory]} />);

    const after = screen.getByPlaceholderText(/Note \(es:/) as HTMLInputElement;
    expect(after.value).toBe('senza glutine, ben cotta');
  });
});

describe('ConfirmDialog — focus non rubato ai re-render', () => {
  it('non riporta il focus al bottone quando il parent passa un onCancel nuovo', () => {
    const Harness = () => {
      const [open, setOpen] = useState(true);
      return (
        <>
          <button data-testid="outside" onClick={() => setOpen(true)}>apri</button>
          <ConfirmDialog
            open={open}
            title="Titolo"
            message="Messaggio"
            onConfirm={() => setOpen(false)}
            onCancel={() => setOpen(false)}
          />
        </>
      );
    };
    const { rerender } = render(<Harness />);

    // Move focus somewhere else, then re-render with a fresh onCancel identity.
    const outside = screen.getByTestId('outside');
    act(() => outside.focus());
    rerender(<Harness />);

    expect(document.activeElement).toBe(outside);
  });
});

/** Harness for the backdrop hook: a backdrop layer + a panel with an input. */
function BackdropHarness({ onClose }: { onClose: () => void }) {
  const backdrop = useBackdropDismiss(onClose);
  return (
    <div>
      <div data-testid="backdrop" {...backdrop} />
      <div data-testid="panel">
        <input data-testid="field" />
      </div>
    </div>
  );
}

const pointer = (type: 'pointerdown' | 'pointerup' | 'pointercancel', pointerId = 1) =>
  new PointerEvent(type, { bubbles: true, cancelable: true, pointerId });

describe('useBackdropDismiss — guard del backdrop', () => {
  it('chiude quando la pressione inizia E finisce sul backdrop', () => {
    const onClose = vi.fn();
    render(<BackdropHarness onClose={onClose} />);
    const backdrop = screen.getByTestId('backdrop');

    act(() => {
      backdrop.dispatchEvent(pointer('pointerdown'));
      backdrop.dispatchEvent(pointer('pointerup'));
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('NON chiude quando la pressione inizia su un input e finisce sul backdrop (ghost click da tastiera)', () => {
    const onClose = vi.fn();
    render(<BackdropHarness onClose={onClose} />);
    const field = screen.getByTestId('field');
    const backdrop = screen.getByTestId('backdrop');

    act(() => {
      field.dispatchEvent(pointer('pointerdown'));
      // Keyboard opens, viewport reflows, the tap's pointerup lands on the backdrop.
      backdrop.dispatchEvent(pointer('pointerup'));
    });

    expect(onClose).not.toHaveBeenCalled();
  });

  it('NON lascia un flag stale: pressione su backdrop senza pointerup, poi tap su input che finisce sul backdrop', () => {
    const onClose = vi.fn();
    render(<BackdropHarness onClose={onClose} />);
    const backdrop = screen.getByTestId('backdrop');
    const field = screen.getByTestId('field');

    act(() => {
      // Gesture 1 starts on the backdrop but ends elsewhere (drag/reflow):
      // the old element-scoped flag stayed `true` forever.
      backdrop.dispatchEvent(pointer('pointerdown'));
      screen.getByTestId('panel').dispatchEvent(pointer('pointerup'));
    });
    expect(onClose).not.toHaveBeenCalled();

    act(() => {
      // Gesture 2: a tap on the input whose pointerup hits the backdrop.
      field.dispatchEvent(pointer('pointerdown'));
      backdrop.dispatchEvent(pointer('pointerup'));
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('ignora un pointerup di un pointer diverso da quello registrato', () => {
    const onClose = vi.fn();
    render(<BackdropHarness onClose={onClose} />);
    const backdrop = screen.getByTestId('backdrop');

    act(() => {
      backdrop.dispatchEvent(pointer('pointerdown', 1));
      backdrop.dispatchEvent(pointer('pointerup', 7));
    });

    expect(onClose).not.toHaveBeenCalled();
  });

  it('non chiude dopo un pointercancel', () => {
    const onClose = vi.fn();
    render(<BackdropHarness onClose={onClose} />);
    const backdrop = screen.getByTestId('backdrop');

    act(() => {
      backdrop.dispatchEvent(pointer('pointerdown'));
      backdrop.dispatchEvent(pointer('pointercancel'));
      backdrop.dispatchEvent(pointer('pointerup'));
    });

    expect(onClose).not.toHaveBeenCalled();
  });

  it('legge l\'onClose più recente senza rieseguire gli handler (latest-ref)', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(<BackdropHarness onClose={first} />);
    const backdrop = screen.getByTestId('backdrop');

    rerender(<BackdropHarness onClose={second} />);

    act(() => {
      backdrop.dispatchEvent(pointer('pointerdown'));
      backdrop.dispatchEvent(pointer('pointerup'));
    });

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});

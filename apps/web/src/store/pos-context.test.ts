import { beforeEach, describe, expect, it, vi } from 'vitest';

// Contratto dello scrittore unico del contesto POS (Fase 3): modalità, tavolo e
// conto agganciato devono muoversi insieme. I bug reali che questi test
// bloccano: modalità cambiata ma conto ancora agganciato (la shell diceva
// "Sala" mentre il POS restava su Asporto) e selezione virtuale che diventava
// "ultimo tavolo di sala".

vi.mock('../shared/api/client', async () => ({
  ...(await vi.importActual<typeof import('../shared/api/client')>('../shared/api/client')),
}));

vi.mock('../shared/api/socket', () => ({
  getSocket: () => ({ connected: true, on: vi.fn(), off: vi.fn() }),
  disconnectSocket: vi.fn(),
}));

import { useAppStore } from './app-store';
import type { PosTableLike } from '@gustopos/shared';

const tables: PosTableLike[] = [
  { id: 'tbl_d1', number: 'D1', status: 'free' },
  { id: 'tbl_f1', number: 'F1', status: 'occupied' },
  { id: 'tbl_v_ta', number: 'TA-20261122-1212', status: 'occupied', isVirtual: true },
];

function reset(patch: Partial<ReturnType<typeof useAppStore.getState>> = {}) {
  useAppStore.setState({
    posOrderMode: 'dine_in',
    posTableId: 'tbl_d1',
    posTableNumber: 'D1',
    posLastDineInTableId: 'tbl_d1',
    posLastDineInTableNumber: 'D1',
    posOrder: null,
    ...patch,
  });
}

describe('applyPosContextAction', () => {
  beforeEach(() => reset());

  it('switchMode uscendo dalla sala slega il conto e azzera la selezione', () => {
    reset({
      posOrder: { id: 'ord_ta', orderType: 'takeaway', table: 'TA-20261122-1212' },
      posTableId: 'tbl_v_ta',
      posTableNumber: 'TA-20261122-1212',
      posOrderMode: 'takeaway',
    });
    useAppStore.getState().applyPosContextAction({ type: 'switchMode', mode: 'takeaway' }, tables);
    const s = useAppStore.getState();
    expect(s.posOrder).toBeNull();
    expect(s.posOrderMode).toBe('takeaway');
    expect(s.posTableId).toBe('');
    expect(s.posLastDineInTableId).toBe('tbl_d1');
  });

  it('switchMode in sala riporta sull\'ultimo tavolo reale', () => {
    reset({
      posOrderMode: 'takeaway',
      posOrder: { id: 'ord_ta', orderType: 'takeaway', table: 'TA-20261122-1212' },
      posTableId: '',
      posTableNumber: '',
      posLastDineInTableId: 'tbl_f1',
      posLastDineInTableNumber: 'F1',
    });
    useAppStore.getState().applyPosContextAction({ type: 'switchMode', mode: 'dine_in' }, tables);
    const s = useAppStore.getState();
    expect(s.posOrder).toBeNull();
    expect(s.posOrderMode).toBe('dine_in');
    expect(s.posTableId).toBe('tbl_f1');
    expect(s.posTableNumber).toBe('F1');
  });

  it('pinOrder segue il conto: modalità e tavolo dalla sua riga, sala intatta', () => {
    useAppStore.getState().applyPosContextAction(
      { type: 'pinOrder', order: { id: 'ord_ta', orderType: 'takeaway', table: 'TA-20261122-1212' } },
      tables,
    );
    const s = useAppStore.getState();
    expect(s.posOrder).toEqual({ id: 'ord_ta', orderType: 'takeaway', table: 'TA-20261122-1212' });
    expect(s.posOrderMode).toBe('takeaway');
    expect(s.posTableId).toBe('tbl_v_ta');
    expect(s.posLastDineInTableId).toBe('tbl_d1');
  });

  it('pinOrder(null) slega il conto senza cambiare modalità né tavolo', () => {
    reset({
      posOrderMode: 'takeaway',
      posOrder: { id: 'ord_ta', orderType: 'takeaway', table: 'TA-20261122-1212' },
      posTableId: 'tbl_v_ta',
      posTableNumber: 'TA-20261122-1212',
    });
    useAppStore.getState().applyPosContextAction({ type: 'pinOrder', order: null }, tables);
    const s = useAppStore.getState();
    expect(s.posOrder).toBeNull();
    expect(s.posOrderMode).toBe('takeaway');
    expect(s.posTableId).toBe('tbl_v_ta');
  });

  it('switchMode su un tavolo reale esplicito aggiorna anche la memoria di sala', () => {
    reset({ posOrderMode: 'delivery', posTableId: '', posTableNumber: '' });
    useAppStore.getState().applyPosContextAction(
      { type: 'switchMode', mode: 'dine_in', tableId: 'tbl_f1', tableNumber: 'F1' },
      tables,
    );
    const s = useAppStore.getState();
    expect(s.posTableId).toBe('tbl_f1');
    expect(s.posLastDineInTableId).toBe('tbl_f1');
  });

  it('selectPosTable continua a non sporcare la memoria con un tavolo virtuale', () => {
    useAppStore.getState().selectPosTable('tbl_v_ta', 'TA-20261122-1212', { virtual: true });
    const s = useAppStore.getState();
    expect(s.posTableId).toBe('tbl_v_ta');
    expect(s.posLastDineInTableId).toBe('tbl_d1');
  });
});

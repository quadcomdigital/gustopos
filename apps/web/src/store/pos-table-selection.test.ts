import { beforeEach, describe, expect, it, vi } from 'vitest';

// Contratto di `selectPosTable` (il "set atomico" id+numero): i tavoli
// virtuali dei conti Asporto/Consegna NON devono mai diventare "ultimo
// tavolo di sala" — altrimenti rientrando in Sala si tornerebbe sopra il
// conto virtuale invece che sul tavolo reale del cameriere.

vi.mock('../shared/api/client', async () => ({
  ...(await vi.importActual<typeof import('../shared/api/client')>('../shared/api/client')),
}));

vi.mock('../shared/api/socket', () => ({
  getSocket: () => ({ connected: true, on: vi.fn(), off: vi.fn() }),
  disconnectSocket: vi.fn(),
}));

import { useAppStore } from './app-store';

describe('selectPosTable — semantica virtual', () => {
  beforeEach(() => {
    useAppStore.setState({
      posTableId: '',
      posTableNumber: '',
      posLastDineInTableId: '',
      posLastDineInTableNumber: '',
    });
  });

  it('un tavolo reale diventa "ultimo tavolo di sala"', () => {
    useAppStore.getState().selectPosTable('tbl_d1', 'D1');
    const s = useAppStore.getState();
    expect(s.posTableId).toBe('tbl_d1');
    expect(s.posTableNumber).toBe('D1');
    expect(s.posLastDineInTableId).toBe('tbl_d1');
    expect(s.posLastDineInTableNumber).toBe('D1');
  });

  it('un tavolo virtuale (conto asporto) non sporca la memoria di sala', () => {
    useAppStore.getState().selectPosTable('tbl_d1', 'D1');
    useAppStore.getState().selectPosTable('tbl_v_ta1', 'TA-20261122-1212', { virtual: true });
    const s = useAppStore.getState();
    expect(s.posTableId).toBe('tbl_v_ta1');
    expect(s.posTableNumber).toBe('TA-20261122-1212');
    expect(s.posLastDineInTableId).toBe('tbl_d1');
    expect(s.posLastDineInTableNumber).toBe('D1');
  });

  it('la deselezione azzera la selezione ma conserva la memoria di sala', () => {
    useAppStore.getState().selectPosTable('tbl_d1', 'D1');
    useAppStore.getState().selectPosTable('tbl_v_ta1', 'TA-20261122-1212', { virtual: true });
    useAppStore.getState().selectPosTable('', '');
    const s = useAppStore.getState();
    expect(s.posTableId).toBe('');
    expect(s.posTableNumber).toBe('');
    expect(s.posLastDineInTableId).toBe('tbl_d1');
    expect(s.posLastDineInTableNumber).toBe('D1');
  });

  it('un tavolo reale selezionato dopo il virtuale aggiorna la memoria di sala', () => {
    useAppStore.getState().selectPosTable('tbl_v_ta1', 'TA-20261122-1212', { virtual: true });
    useAppStore.getState().selectPosTable('tbl_f1', 'F1');
    const s = useAppStore.getState();
    expect(s.posTableId).toBe('tbl_f1');
    expect(s.posLastDineInTableId).toBe('tbl_f1');
    expect(s.posLastDineInTableNumber).toBe('F1');
  });
});

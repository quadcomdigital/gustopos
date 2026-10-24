import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ─── Mock stores/client before importing the component ────────────────────
// vi.hoisted: le factory di vi.mock girano prima delle import, quindi i dati
// devono vivere nello scope issato, non in una const del file.

const mocks = vi.hoisted(() => {
  const printerConfig: {
    enabled: boolean;
    model: string;
    host: string;
    port: number;
    protocol: string;
    dialectId: string | null;
    dialectModel: string;
    dialectVersion: string;
    transport: 'tcp' | 'serial' | 'usb';
    baud: number;
    departmentMappings: Array<{ protocolId: string; departments: unknown[] }>;
    liveVerifications: Array<{
      protocolId: string;
      verifiedAt: string;
      verifiedByStaffId: string;
      agentVersion: string;
      testJobId: string;
      counters: Record<string, string>;
      note: string;
    }>;
  } = {
    enabled: true,
    model: 'generic-rt',
    host: '192.168.0.120',
    port: 23,
    protocol: 'rt-text',
    dialectId: null,
    dialectModel: '',
    dialectVersion: '',
    transport: 'tcp',
    baud: 9600,
    departmentMappings: [],
    liveVerifications: [],
  };

  const catalog = {
    protocols: [
      {
        id: 'print3rt',
        label: 'Print RT 3.0',
        vendor: 'RCH',
        status: 'documented',
        statusNote: 'Manuale protocollo PRINT! 3.0 RT rev 4.0',
        models: [{ id: 'print-rt-3', label: 'PRINT! 3.0 RT' }],
        transports: ['tcp', 'serial', 'usb'],
        defaultPort: 23,
        defaultModel: 'print-rt-3',
        defaultVersion: '',
        versions: [],
        requiresAgentVersion: 'go-0.15.0',
        selectionEnabled: true,
        emissionGated: true,
      },
      {
        id: 'rch-walle',
        label: 'RCH WALL-E',
        vendor: 'RCH',
        status: 'verified',
        statusNote: 'Verificato dal vivo il 15/10/2026',
        models: [
          { id: 'walle-mec-rt', label: 'WALL-E MEC RT (LDP33 RT)' },
          { id: 'kbill-rt', label: 'K-BILL RT (LDP33 RT)' },
        ],
        transports: ['tcp', 'serial'],
        defaultPort: 23,
        defaultModel: 'walle-mec-rt',
        defaultVersion: '10.0.4',
        versions: ['10.0.4'],
        requiresAgentVersion: 'go-0.15.0',
        selectionEnabled: true,
        emissionGated: false,
      },
      {
        id: 'ditron',
        label: 'Ditron',
        vendor: 'Ditron',
        status: 'cataloguing',
        statusNote: 'Nessuna fonte tecnica disponibile',
        models: [{ id: 'ditron-rt', label: 'Ditron RT (modello da confermare)' }],
        transports: ['tcp', 'serial', 'usb'],
        defaultPort: null,
        defaultModel: 'ditron-rt',
        defaultVersion: '',
        versions: [],
        requiresAgentVersion: 'go-0.15.0',
        selectionEnabled: false,
        emissionGated: true,
      },
    ],
  };

  return {
    printerConfig,
    catalog,
    updateFiscalPrinterConfig: vi.fn(),
    fetchFiscalProtocols: vi.fn(),
    fetchFiscalPrinterConfig: vi.fn(),
    fetchFiscalJobs: vi.fn(),
    fetchFiscalJob: vi.fn(),
    readFiscalDepartments: vi.fn(),
    programFiscalDepartments: vi.fn(),
    registerFiscalLiveVerification: vi.fn(),
    revokeFiscalLiveVerification: vi.fn(),
  };
});

vi.mock('../shared/api/client', () => ({
  fetchFiscalProtocols: mocks.fetchFiscalProtocols,
  fetchFiscalPrinterConfig: mocks.fetchFiscalPrinterConfig,
  updateFiscalPrinterConfig: mocks.updateFiscalPrinterConfig,
  enqueueFiscalTestJob: vi.fn(),
  enqueueFiscalChiusura: vi.fn(),
  fetchFiscalJobs: mocks.fetchFiscalJobs,
  fetchFiscalJob: mocks.fetchFiscalJob,
  readFiscalDepartments: mocks.readFiscalDepartments,
  programFiscalDepartments: mocks.programFiscalDepartments,
  registerFiscalLiveVerification: mocks.registerFiscalLiveVerification,
  revokeFiscalLiveVerification: mocks.revokeFiscalLiveVerification,
}));

const storeState = {
  data: {
    categories: [
      { id: 'cat-cucina', name: 'Cucina', scope: 'menu', isActive: true },
      { id: 'cat-bar', name: 'Bar', scope: 'menu', isActive: true },
      { id: 'cat-ingredienti', name: 'Materie prime', scope: 'ingredient', isActive: true },
    ],
  },
  fiscalExports: [],
  refreshFiscalExports: vi.fn().mockResolvedValue(undefined),
  closeFiscalDay: vi.fn().mockResolvedValue(undefined),
  createFiscalExport: vi.fn().mockResolvedValue({ status: 'ready' }),
  retryFiscalExport: vi.fn().mockResolvedValue({ status: 'ready' }),
  downloadFiscalExportCsv: vi.fn().mockResolvedValue(''),
};

vi.mock('../store/app-store', () => ({
  useAppStore: (selector: (state: typeof storeState) => unknown) => selector(storeState),
}));

vi.mock('../shared/authz/usePermission', () => ({
  usePermission: () => ({ can: () => true }),
}));

vi.mock('../shared/ui/toast', () => ({ pushToast: vi.fn() }));

import FiscalExportsView from '../components/FiscalExportsView';

/**
 * Job fiscale già concluso, con il `result` JSON che scrive il server: i reparti
 * letti dal RT sono quelli decodificati dalle posizioni del manuale.
 */
function completedJob(
  id: string,
  result: Record<string, unknown> = {},
): {
  id: string;
  tenantId: string;
  type: string;
  status: string;
  payload: string;
  result?: string;
  createdAt: string;
  updatedAt: string;
} {
  return {
    id,
    tenantId: 'tenant_1',
    type: 'read',
    status: 'completed',
    payload: '{}',
    result: JSON.stringify(result),
    createdAt: new Date('2026-10-15T12:00:00.000Z').toISOString(),
    updatedAt: new Date('2026-10-15T12:00:05.000Z').toISOString(),
  };
}

/** Crea un reparto mappato sul protocollo attivo passando dalla UI. */
async function addDepartment({
  number,
  label,
  vatRate,
  kind,
  categoryId,
}: {
  number: string;
  label: string;
  vatRate: string;
  kind: 'good' | 'service';
  categoryId: string;
}) {
  await userEvent.click(await screen.findByText('Aggiungi reparto'));
  // I campi si cercano sull'ultima riga aggiunta: le etichette portano il numero
  // del reparto, che è proprio quello che il test sta impostando.
  const lastOf = (pattern: RegExp) => {
    const fields = screen.getAllByLabelText(pattern);
    return fields[fields.length - 1];
  };
  // Il campo numero si imposta con un singolo change: la riga è chiavata sul
  // numero del reparto, quindi digitare carattere per carattere rimonta l'input.
  fireEvent.change(lastOf(/^Numero reparto \d+$/), { target: { value: number } });
  await userEvent.type(lastOf(/^Descrizione reparto \d+$/), label);
  await userEvent.selectOptions(lastOf(/^Aliquota reparto \d+$/), vatRate);
  await userEvent.selectOptions(lastOf(/^Natura reparto \d+$/), kind);
  await userEvent.selectOptions(lastOf(/^Categorie reparto \d+$/), [categoryId]);
}

async function renderPanel() {
  render(<FiscalExportsView />);
  const select = (await screen.findByLabelText('Protocollo fiscale')) as HTMLSelectElement;
  return select;
}

beforeEach(() => {
  mocks.printerConfig.dialectId = null;
  mocks.printerConfig.dialectModel = '';
  mocks.printerConfig.dialectVersion = '';
  mocks.printerConfig.transport = 'tcp';
  mocks.printerConfig.host = '192.168.0.120';
  mocks.printerConfig.departmentMappings = [];
  mocks.printerConfig.liveVerifications = [];
  mocks.fetchFiscalProtocols.mockResolvedValue(mocks.catalog);
  mocks.fetchFiscalPrinterConfig.mockImplementation(async () => ({ fiscalPrinter: { ...mocks.printerConfig } }));
  mocks.fetchFiscalJobs.mockResolvedValue({ jobs: [] });
  // Il polling del job si conclude subito: i test verificano il comportamento
  // della UI, non l'attesa dell'agente.
  mocks.fetchFiscalJob.mockImplementation(async (id: string) => ({ job: completedJob(id) }));
  mocks.readFiscalDepartments.mockReset();
  mocks.programFiscalDepartments.mockReset();
  mocks.registerFiscalLiveVerification.mockReset();
  mocks.revokeFiscalLiveVerification.mockReset();
  mocks.fetchFiscalJob.mockClear();
  mocks.updateFiscalPrinterConfig.mockImplementation(async (payload: { fiscalPrinter: unknown }) => ({
    fiscalPrinter: payload.fiscalPrinter,
  }));
  mocks.updateFiscalPrinterConfig.mockClear();
});

describe('selettore protocollo fiscale', () => {
  it('elenca i tre dialetti del catalogo e disabilita quelli non selezionabili', async () => {
    const select = await renderPanel();
    await waitFor(() => expect(select.querySelectorAll('option').length).toBe(4));
    const byValue = Array.from(select.querySelectorAll('option')).map((option) => ({
      value: option.value,
      disabled: option.disabled,
    }));
    expect(byValue.find((option) => option.value === '')).toBeTruthy();
    expect(byValue.find((option) => option.value === 'print3rt')?.disabled).toBe(false);
    expect(byValue.find((option) => option.value === 'rch-walle')?.disabled).toBe(false);
    expect(byValue.find((option) => option.value === 'ditron')?.disabled).toBe(true);
  });

  it('non espone alcun codice di dialetto nel markup', async () => {
    await renderPanel();
    const markup = document.body.innerHTML;
    for (const code of ['=R1', '=T1', '=C1', '=C10', '<</?', '@A', '3001', '0020']) {
      expect(markup.includes(code)).toBe(false);
    }
  });

  it("con l'adattatore storico mostra la famiglia del dispositivo", async () => {
    await renderPanel();
    expect(await screen.findByLabelText("Modello (adattatore nell'agente)")).toBeTruthy();
  });

  it('selezionando un dialetto precompila modello, versione e porta del catalogo', async () => {
    const select = await renderPanel();
    await userEvent.selectOptions(select, 'rch-walle');

    const model = (await screen.findByLabelText('Modello')) as HTMLSelectElement;
    expect(model.value).toBe('walle-mec-rt');
    const version = (await screen.findByLabelText('Versione / firmware')) as HTMLSelectElement;
    expect(version.value).toBe('10.0.4');
    expect((screen.getByLabelText('Porta') as HTMLInputElement).value).toBe('23');
    // Il selettore della famiglia legacy sparisce: il dialetto lo sostituisce.
    expect(screen.queryByLabelText("Modello (adattatore nell'agente)")).toBeNull();
  });

  it('mostra stato e gate del dialetto e salva il dialetto scelto', async () => {
    const select = await renderPanel();
    await userEvent.selectOptions(select, 'rch-walle');
    expect(await screen.findByText('Verificato dal vivo')).toBeTruthy();
    expect(screen.getByText(/richiede agente stampa/)).toBeTruthy();

    await userEvent.click(screen.getByText('Salva configurazione'));
    await waitFor(() => expect(mocks.updateFiscalPrinterConfig).toHaveBeenCalledTimes(1));
    const payload = mocks.updateFiscalPrinterConfig.mock.calls[0][0] as { fiscalPrinter: { dialectId: string; dialectModel: string } };
    expect(payload.fiscalPrinter.dialectId).toBe('rch-walle');
    expect(payload.fiscalPrinter.dialectModel).toBe('walle-mec-rt');
  });

  it('segnala il dialetto non collaudato come emissione bloccata', async () => {
    const select = await renderPanel();
    await userEvent.selectOptions(select, 'print3rt');
    expect(await screen.findByText('Da manuale, non verificato')).toBeTruthy();
    expect(await screen.findByText('Emissione bloccata fino al collaudo')).toBeTruthy();
    // Il blocco dice anche cosa serve per toglierlo: una prova gestionale
    // completata, non un interruttore.
    expect(await screen.findByText(/prova gestionale completata/)).toBeTruthy();
    expect(screen.getByText('Registra esito collaudo')).toBeTruthy();
  });
});

describe('collaudo dal vivo', () => {
  it('registra il collaudo e mostra l’evidenza che lo sostiene', async () => {
    const select = await renderPanel();
    await userEvent.selectOptions(select, 'print3rt');

    mocks.registerFiscalLiveVerification.mockResolvedValue({
      fiscalPrinter: {
        ...mocks.printerConfig,
        dialectId: 'print3rt',
        liveVerifications: [
          {
            protocolId: 'print3rt',
            verifiedAt: '2026-10-16T09:30:00.000Z',
            verifiedByStaffId: 'staff_1',
            agentVersion: 'go-0.15.0',
            testJobId: 'fj_prova',
            counters: { 'gran totale': '8342.413,29', corrispettivi: '0042' },
            note: 'cassa 1, tecnico in loco',
          },
        ],
      },
    });

    await userEvent.type(await screen.findByLabelText('Nota del collaudo'), 'cassa 1, tecnico in loco');
    await userEvent.click(screen.getByText('Registra esito collaudo'));

    await waitFor(() => expect(mocks.registerFiscalLiveVerification).toHaveBeenCalledTimes(1));
    expect(mocks.registerFiscalLiveVerification).toHaveBeenCalledWith({ note: 'cassa 1, tecnico in loco' });
    // Il badge cambia e l'evidenza (prova + quadrature) resta visibile.
    expect(await screen.findByText(/^Collaudo registrato il/)).toBeTruthy();
    expect(await screen.findByText(/prova gestionale fj_prova/)).toBeTruthy();
    expect(await screen.findByText('8342.413,29')).toBeTruthy();
    expect(screen.getByText('Revoca collaudo')).toBeTruthy();
    expect(screen.queryByText('Emissione bloccata fino al collaudo')).toBeNull();
  });

  it('mostra in chiaro il motivo per cui il server ha rifiutato il collaudo', async () => {
    const select = await renderPanel();
    await userEvent.selectOptions(select, 'print3rt');
    mocks.registerFiscalLiveVerification.mockRejectedValue(
      new Error('Nessuna prova gestionale completata per Print RT 3.0: lancia la prova in Impostazioni → Fiscale'),
    );

    await userEvent.click(await screen.findByText('Registra esito collaudo'));

    expect(await screen.findByText(/Nessuna prova gestionale completata per Print RT 3.0/)).toBeTruthy();
    // Nessun collaudo registrato: l'emissione resta bloccata.
    expect(screen.getByText('Emissione bloccata fino al collaudo')).toBeTruthy();
  });

  it('revoca il collaudo solo dopo conferma esplicita', async () => {
    mocks.printerConfig.dialectId = 'print3rt';
    mocks.printerConfig.liveVerifications = [
      {
        protocolId: 'print3rt',
        verifiedAt: '2026-10-16T09:30:00.000Z',
        verifiedByStaffId: 'staff_1',
        agentVersion: 'go-0.15.0',
        testJobId: 'fj_prova',
        counters: {},
        note: '',
      },
    ];
    await renderPanel();

    await userEvent.click(await screen.findByText('Revoca collaudo'));
    expect(mocks.revokeFiscalLiveVerification).not.toHaveBeenCalled();
    expect(await screen.findByText(/torna bloccata fino a una nuova prova/)).toBeTruthy();

    mocks.revokeFiscalLiveVerification.mockResolvedValue({
      fiscalPrinter: { ...mocks.printerConfig, liveVerifications: [] },
    });
    await userEvent.click(screen.getByText('Revoca il collaudo'));

    await waitFor(() => expect(mocks.revokeFiscalLiveVerification).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('Emissione bloccata fino al collaudo')).toBeTruthy();
  });
});

describe('collegamento seriale', () => {
  it('permette di scegliere la seriale e chiede il dispositivo al posto di IP e porta', async () => {
    const select = await renderPanel();
    await userEvent.selectOptions(select, 'rch-walle');

    const transport = (await screen.findByLabelText('Collegamento')) as HTMLSelectElement;
    const serialOption = Array.from(transport.options).find((option) => option.value === 'serial');
    expect(serialOption?.disabled).toBe(false);
    await userEvent.selectOptions(transport, 'serial');

    // Il campo `host` diventa il dispositivo seriale e la porta TCP sparisce.
    const device = (await screen.findByLabelText('Dispositivo seriale')) as HTMLInputElement;
    expect(device.value).toBe('192.168.0.120');
    expect(screen.queryByLabelText('Porta')).toBeNull();
    expect(screen.getByLabelText('Baud')).toBeTruthy();

    await userEvent.clear(device);
    await userEvent.type(device, '/dev/ttyUSB0');
    await userEvent.click(screen.getByText('Salva configurazione'));
    await waitFor(() => expect(mocks.updateFiscalPrinterConfig).toHaveBeenCalledTimes(1));
    const payload = mocks.updateFiscalPrinterConfig.mock.calls[0][0] as {
      fiscalPrinter: { transport: string; host: string; baud: number };
    };
    expect(payload.fiscalPrinter.transport).toBe('serial');
    expect(payload.fiscalPrinter.host).toBe('/dev/ttyUSB0');
    expect(payload.fiscalPrinter.baud).toBe(9600);
  });
});

describe('mappatura reparti', () => {
  it('senza protocollo non mostra l’editor: la numerazione dipende dalla piattaforma', async () => {
    await renderPanel();
    expect(screen.getByText('Reparti del RT')).toBeTruthy();
    expect(screen.getByText(/Scegli prima un/)).toBeTruthy();
    expect(screen.queryByText('Aggiungi reparto')).toBeNull();
  });

  it('salva la mappatura per il protocollo attivo, con le categorie del menu', async () => {
    const select = await renderPanel();
    await userEvent.selectOptions(select, 'rch-walle');

    await userEvent.click(await screen.findByText('Aggiungi reparto'));
    await userEvent.clear(screen.getByLabelText('Numero reparto 1'));
    await userEvent.type(screen.getByLabelText('Numero reparto 1'), '4');
    await userEvent.type(screen.getByLabelText('Descrizione reparto 1'), 'Bar IVA 22');
    await userEvent.selectOptions(screen.getByLabelText('Aliquota reparto 1'), '22');
    await userEvent.selectOptions(screen.getByLabelText('Natura reparto 1'), 'service');

    // Solo le categorie di menu sono mappabili: quelle ingredient non compaiono.
    const categorySelect = screen.getByLabelText('Categorie reparto 4') as HTMLSelectElement;
    expect(Array.from(categorySelect.options).map((option) => option.value)).toEqual(['cat-cucina', 'cat-bar']);
    await userEvent.selectOptions(categorySelect, ['cat-bar']);

    await userEvent.click(screen.getByText('Salva configurazione'));
    await waitFor(() => expect(mocks.updateFiscalPrinterConfig).toHaveBeenCalledTimes(1));

    const payload = mocks.updateFiscalPrinterConfig.mock.calls[0][0] as {
      fiscalPrinter: { departmentMappings: Array<{ protocolId: string; departments: Array<Record<string, unknown>> }> };
    };
    const groups = payload.fiscalPrinter.departmentMappings;
    expect(groups).toHaveLength(1);
    expect(groups[0].protocolId).toBe('rch-walle');
    expect(groups[0].departments).toHaveLength(1);
    expect(groups[0].departments[0]).toMatchObject({
      department: 4,
      label: 'Bar IVA 22',
      vatRate: 22,
      kind: 'service',
      categoryIds: ['cat-bar'],
      isDefault: true,
    });
  });

  it('blocca il salvataggio quando la mappatura ha errori', async () => {
    const select = await renderPanel();
    await userEvent.selectOptions(select, 'rch-walle');
    await userEvent.click(await screen.findByText('Aggiungi reparto'));
    await userEvent.click(screen.getByText('Aggiungi reparto'));
    // Due reparti di ripiego: la mappa è ambigua e non si salva.
    await userEvent.click(screen.getByLabelText('Reparto di ripiego 2'));

    expect(await screen.findByText(/Solo un reparto può essere di ripiego/)).toBeTruthy();
    const saveButton = screen.getByText('Salva configurazione') as HTMLButtonElement;
    expect(saveButton.disabled).toBe(true);
    await userEvent.click(saveButton);
    expect(mocks.updateFiscalPrinterConfig).not.toHaveBeenCalled();
  });

  it('avvisa (senza bloccare) su aliquota e categorie mancanti', async () => {
    const select = await renderPanel();
    await userEvent.selectOptions(select, 'rch-walle');
    await userEvent.click(await screen.findByText('Aggiungi reparto'));
    expect(await screen.findByText(/aliquota IVA non impostata/)).toBeTruthy();
    // Il primo reparto è di ripiego: l'avviso "senza categorie" vale per quelli
    // che non sono di ripiego, quindi serve una seconda riga.
    await userEvent.click(screen.getByText('Aggiungi reparto'));
    expect(await screen.findByText(/senza categorie/)).toBeTruthy();
    expect((screen.getByText('Salva configurazione') as HTMLButtonElement).disabled).toBe(false);
  });
});

describe('confronto con il RT', () => {
  it('legge i reparti configurati dal RT e mostra dove la programmazione differisce', async () => {
    const select = await renderPanel();
    await userEvent.selectOptions(select, 'rch-walle');
    await addDepartment({ number: '4', label: 'Bar IVA 22', vatRate: '22', kind: 'service', categoryId: 'cat-bar' });

    // Il RT ha in memoria lo stesso reparto ma con IVA 10% e come bene.
    mocks.readFiscalDepartments.mockResolvedValue({
      job: completedJob('fj_read', {
        departments: [
          { department: 4, label: 'BAR', vatRate: 10, kind: 'good', raw: 'R04BAR  000000000        10 0', layoutVerified: false },
        ],
        notes: ['la risposta alla lettura reparti non è mai stata verificata dal vivo'],
      }),
      warnings: [],
    });

    await userEvent.click(await screen.findByText('Leggi dal RT'));

    // Si leggono i reparti della mappatura: quelli che il RT usa davvero.
    await waitFor(() => expect(mocks.readFiscalDepartments).toHaveBeenCalledWith({ departments: [4] }));
    expect(await screen.findByText('Confronto con il RT')).toBeTruthy();
    expect(screen.getByText(/⚠ aliquota diversa/)).toBeTruthy();
    expect(screen.getByText(/⚠ natura diversa/)).toBeTruthy();
    expect(screen.getByText(/nessuna lettura è stata confermata dal vivo/)).toBeTruthy();
    expect(screen.getByText(/la risposta alla lettura reparti non è mai stata verificata/)).toBeTruthy();
  });

  it('scrive i reparti sul RT solo dopo conferma esplicita', async () => {
    const select = await renderPanel();
    await userEvent.selectOptions(select, 'rch-walle');
    await addDepartment({ number: '4', label: 'Bar IVA 22', vatRate: '22', kind: 'service', categoryId: 'cat-bar' });

    mocks.programFiscalDepartments.mockResolvedValue({ job: completedJob('fj_program', {}), warnings: [] });

    await userEvent.click(await screen.findByText('Programma sul RT'));
    // Prima della conferma nessuna scrittura è inviata al RT.
    expect(mocks.programFiscalDepartments).not.toHaveBeenCalled();
    expect(await screen.findByText(/sostituiscono quelle attuali/)).toBeTruthy();
    expect(screen.getByText(/Reparto 4 — Bar IVA 22: IVA 22%, servizio/)).toBeTruthy();

    await userEvent.click(screen.getByText('Confermo la scrittura sul RT'));
    await waitFor(() => expect(mocks.programFiscalDepartments).toHaveBeenCalledTimes(1));
    expect(mocks.programFiscalDepartments).toHaveBeenCalledWith({
      confirm: true,
      departments: [{ department: 4, vatRate: 22, kind: 'service', label: 'Bar IVA 22', priceCents: 0 }],
    });
  });

  it('non manda la programmazione se i reparti sono incompleti', async () => {
    const select = await renderPanel();
    await userEvent.selectOptions(select, 'rch-walle');
    await userEvent.click(await screen.findByText('Aggiungi reparto'));
    // Reparto senza aliquota e senza natura: il pulsante resta disabilitato.
    expect((await screen.findByText('Programma sul RT') as HTMLButtonElement).disabled).toBe(true);
    expect(mocks.programFiscalDepartments).not.toHaveBeenCalled();
  });
});

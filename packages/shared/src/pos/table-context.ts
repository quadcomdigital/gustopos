// ─── POS context (single source of truth) ───────────────────────────────────
// Regole pure del contesto POS: modalità, tavolo selezionato, conto agganciato,
// chiave del carrello, target di cassa, presenza e accorpamento dei conti
// asporto/consegna.
//
// Vive in `shared` perché le stesse regole servono a web (POS, mappa, shell) e
// API (retirement dei conti virtuali). Dipendenze: nessuna — solo tipi
// strutturali, così ogni lato passa le proprie forme senza import circolari.
//
// Le transizioni NON mutano lo stato: `nextPosContext` ritorna il patch completo
// da applicare in un unico `set()` dello store. Mai scrivere id e numero in due
// passaggi: è la classe di bug che ha fatto divergere selezione e modalità.

export type PosMode = "dine_in" | "takeaway" | "delivery";

/** Forma strutturale di `Table` (shared) — basta e avanza per le regole POS. */
export type PosTableLike = {
  id: string;
  number: string;
  status: string;
  isVirtual?: boolean;
};

/** Forma strutturale di un ordine: solo i campi che il contesto POS legge. */
export type PosOrderLike = {
  id: string;
  orderType: PosMode;
  table?: string | null;
};

export type PosContextState = {
  mode: PosMode;
  /** Identità stabile del tavolo selezionato (sopravvive ai rename). */
  tableId: string;
  tableNumber: string;
  /** Ultimo tavolo REALE di sala: usato per rientrare da asporto/consegna. */
  lastDineInTableId: string;
  lastDineInTableNumber: string;
  /** Conto aperto agganciato alla postazione (vince su `mode`). */
  pinnedOrderId: string | null;
};

export type PosContextPatch = Partial<PosContextState>;

export type PosContextAction =
  /** Seleziona/normalizza il tavolo. Non tocca modalità né conto agganciato. */
  | { type: "selectTable"; tableId?: string | null; tableNumber?: string | null; virtual?: boolean }
  /** Aggancia (o slega, con `null`) un conto aperto: modalità e tavolo seguono. */
  | { type: "pinOrder"; order: PosOrderLike | null }
  /**
   * Cambio modalità esplicito: slega sempre il conto. In sala si rientra
   * sull'ultimo tavolo reale (o su `target`, quando la scelta arriva da un
   * picker che ha già un tavolo in mano).
   */
  | {
      type: "switchMode";
      mode: PosMode;
      tableId?: string | null;
      tableNumber?: string | null;
      virtual?: boolean;
    };

/**
 * Chiave del carrello non inviato. Deve identificare il LAVORO in corso:
 * - conto agganciato → `${mode}:${order.table}` (per i conti virtuali è il
 *   numero ticket, così l'asporto non condivide il carrello con la sala);
 * - sala senza conto → `dine_in:${tableId}` (id stabile: un rename non svuota
 *   il carrello) oppure `dine_in` senza tavolo;
 * - asporto/consegna senza conto → la modalità nuda.
 */
export function cartContextKeyFor(input: {
  mode: PosMode;
  tableId?: string | null;
  /** `order.table` del conto agganciato (numero, non id). */
  pinnedTable?: string | null;
}): string {
  const pinnedTable = input.pinnedTable?.trim();
  if (pinnedTable) return `${input.mode}:${pinnedTable}`;
  if (input.mode !== "dine_in") return input.mode;
  const tableId = input.tableId?.trim();
  return tableId ? `dine_in:${tableId}` : "dine_in";
}

/**
 * Modalità effettiva: il conto agganciato è la sorgente di verità mentre esiste.
 * Derivarla in render (e non in un effect) evita il primo paint sbagliato.
 */
export function resolveEffectivePosMode(
  pinned: Pick<PosOrderLike, "orderType"> | null,
  preferred: PosMode,
): PosMode {
  return pinned ? pinned.orderType : preferred;
}

function findTableByNumber(
  tables: readonly PosTableLike[],
  number: string | null | undefined,
): PosTableLike | null {
  const target = number?.trim();
  if (!target) return null;
  return tables.find((table) => table.number === target) ?? null;
}

function findTableById(
  tables: readonly PosTableLike[],
  id: string | null | undefined,
): PosTableLike | null {
  const target = id?.trim();
  if (!target) return null;
  return tables.find((table) => table.id === target) ?? null;
}

/**
 * Ultimo tavolo di sala: `lastDineIn*` puntato da id (rename-safe) con fallback
 * sul numero persistito da versioni precedenti. `null` se non esiste più.
 */
function resolveLastDineInTable(
  state: Pick<PosContextState, "lastDineInTableId" | "lastDineInTableNumber">,
  tables: readonly PosTableLike[],
): PosTableLike | null {
  return (
    findTableById(tables, state.lastDineInTableId) ??
    findTableByNumber(tables, state.lastDineInTableNumber)
  );
}

/**
 * Applica un'azione al contesto e ritorna il patch da passare a un unico `set()`.
 * Pura: nessun accesso allo store, nessun side effect.
 */
export function nextPosContext(input: {
  state: PosContextState;
  action: PosContextAction;
  tables: readonly PosTableLike[];
}): PosContextPatch {
  const { state, action, tables } = input;

  if (action.type === "selectTable") {
    const tableId = action.tableId?.trim() ?? "";
    const tableNumber = action.tableNumber?.trim() ?? "";
    const isVirtual = action.virtual === true;
    return {
      tableId,
      tableNumber,
      // Un tavolo virtuale (conto asporto/consegna) non è mai "ultimo tavolo
      // di sala": altrimenti rientrando in Sala si tornerebbe sopra il conto.
      ...(isVirtual || !tableId
        ? {}
        : { lastDineInTableId: tableId, lastDineInTableNumber: tableNumber }),
    };
  }

  if (action.type === "pinOrder") {
    if (!action.order) {
      // Slega soltanto: modalità e tavolo restano dove sono (il chiamante
      // decide se tornare in sala con `switchMode`).
      return { pinnedOrderId: null };
    }
    const tableNumber = action.order.table?.trim() ?? "";
    const table = findTableByNumber(tables, tableNumber);
    return {
      pinnedOrderId: action.order.id,
      mode: action.order.orderType,
      tableId: table?.id ?? "",
      tableNumber,
      // I conti vivono su tavoli virtuali: mai memoria di sala.
      ...(table?.isVirtual === true || !table
        ? {}
        : { lastDineInTableId: table.id, lastDineInTableNumber: table.number }),
    };
  }

  // switchMode: cambiare modalità significa sempre abbandonare il conto.
  const explicitTable =
    findTableById(tables, action.tableId) ?? findTableByNumber(tables, action.tableNumber);

  if (explicitTable) {
    return {
      pinnedOrderId: null,
      mode: action.mode,
      tableId: explicitTable.id,
      tableNumber: explicitTable.number,
      ...(explicitTable.isVirtual === true || action.mode !== "dine_in"
        ? {}
        : { lastDineInTableId: explicitTable.id, lastDineInTableNumber: explicitTable.number }),
    };
  }

  if (action.mode !== "dine_in") {
    // Uscendo dalla sala la selezione si azzera: una selezione dine-in residua
    // inquinerebbe cassa (tavolo sbagliato), presenza e chiave del carrello.
    return { pinnedOrderId: null, mode: action.mode, tableId: "", tableNumber: "" };
  }

  const lastReal = resolveLastDineInTable(state, tables);
  return {
    pinnedOrderId: null,
    mode: "dine_in",
    tableId: lastReal?.id ?? "",
    tableNumber: lastReal?.number ?? "",
  };
}

/** La postazione dichiara la presenza sulla mappa solo per un tavolo di sala reale. */
export function isPosPresenceEligible(mode: PosMode, table: PosTableLike | null): boolean {
  return mode === "dine_in" && table !== null && table.isVirtual !== true;
}

/**
 * Tavolo su cui aprire la cassa: con un conto agganciato vince il SUO tavolo,
 * mai una selezione residua (dirottava l'incasso sul tavolo sbagliato).
 */
export function resolveCheckoutTarget(
  pinnedTable: PosTableLike | null,
  selected: PosTableLike | null,
): PosTableLike | null {
  return pinnedTable ?? selected;
}

/**
 * Un conto virtuale (asporto/consegna) va ritirato quando non ha più ordini
 * aperti. Non si cancella mai: `payments.table_id` è ON DELETE RESTRICT e serve
 * allo storico. Il retirement è soft (`is_active=0`), letto da API e web.
 */
export function shouldRetireVirtualTable(
  table: Pick<PosTableLike, "isVirtual">,
  hasOpenOrders: boolean,
): boolean {
  return table.isVirtual === true && !hasOpenOrders;
}

// ─── Conti aperti (asporto/consegna) ────────────────────────────────────────

export type OpenContoOrderLike = PosOrderLike & {
  status: string;
  total: number;
  timestamp: string;
  ticketNumber?: string | null;
  customerName?: string | null;
  items: ReadonlyArray<{ quantity: number }>;
};

export type OpenConto = {
  /** Chiave di raggruppamento: `order.table` (numero conto) o l'id ordine. */
  key: string;
  orderType: "takeaway" | "delivery";
  /** Ordine più vecchio del gruppo: il conto "principale". */
  orderId: string;
  label: string;
  ticketNumber?: string;
  total: number;
  itemCount: number;
  status: string;
  timestamp: string;
};

const OPEN_CONTO_STATUS_RANK: Record<string, number> = {
  pending: 0,
  preparing: 1,
  ready: 2,
  served: 3,
};

/**
 * Accorpa gli ordini asporto/consegna per conto (il tavolo virtuale), così più
 * invii sullo stesso conto restituiscono una sola card. Ordina per "lavoro
 * residuo" (stato meno avanzato) e poi per anzianità.
 */
export function groupOpenConti(orders: readonly OpenContoOrderLike[]): {
  takeaway: OpenConto[];
  delivery: OpenConto[];
} {
  const byKey = new Map<string, OpenConto>();

  for (const order of orders) {
    if (order.orderType !== "takeaway" && order.orderType !== "delivery") continue;
    if (order.status === "paid" || order.status === "cancelled") continue;

    const key = order.table ?? order.id;
    const quantity = order.items.reduce((sum, item) => sum + item.quantity, 0);
    const existing = byKey.get(key);

    if (!existing) {
      byKey.set(key, {
        key,
        orderType: order.orderType,
        orderId: order.id,
        label:
          order.customerName ||
          order.ticketNumber ||
          (order.orderType === "takeaway" ? "Asporto" : "Consegna"),
        ...(order.ticketNumber ? { ticketNumber: order.ticketNumber } : {}),
        total: order.total,
        itemCount: quantity,
        status: order.status,
        timestamp: order.timestamp,
      });
      continue;
    }

    existing.total += order.total;
    existing.itemCount += quantity;
    // Lo stato mostrato è il meno avanzato del gruppo: è il collo di bottiglia.
    if (
      (OPEN_CONTO_STATUS_RANK[order.status] ?? 0) <
      (OPEN_CONTO_STATUS_RANK[existing.status] ?? 0)
    ) {
      existing.status = order.status;
    }
    // L'ordine più vecchio rappresenta il conto (id + etichetta).
    if (order.timestamp < existing.timestamp) {
      existing.timestamp = order.timestamp;
      existing.orderId = order.id;
      if (order.customerName) existing.label = order.customerName;
    }
  }

  const all = [...byKey.values()];
  const byRank = (a: OpenConto, b: OpenConto) =>
    (OPEN_CONTO_STATUS_RANK[a.status] ?? 0) - (OPEN_CONTO_STATUS_RANK[b.status] ?? 0) ||
    a.timestamp.localeCompare(b.timestamp);

  return {
    takeaway: all.filter((conto) => conto.orderType === "takeaway").sort(byRank),
    delivery: all.filter((conto) => conto.orderType === "delivery").sort(byRank),
  };
}

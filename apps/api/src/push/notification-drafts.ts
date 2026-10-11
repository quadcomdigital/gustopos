// ─── Notification drafts ───────────────────────────────────────────────────
// Pure builders that turn a realtime payload into the text of a push
// notification. Nothing here touches the network or the database, so every
// rule (including the "only when something actually changed" filters) is unit
// testable — the dispatcher is just wiring around them.

import type {
  GroupOrderRealtimeSubmitted,
  Ingredient,
  Order,
  PrintBridge,
  PrintJob,
  Reservation,
} from "@gustopos/shared";

export interface NotificationDraft {
  title: string;
  body: string;
  /** Group replacements: the OS shows one notification per tag. */
  tag?: string;
  /** In-app route opened on notificationclick (same origin). */
  url?: string;
}

const euro = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });

const ORDER_TYPE_LABEL: Record<Order["orderType"], string> = {
  dine_in: "Tavolo",
  takeaway: "Asporto",
  delivery: "Consegna",
};

function orderRef(order: Order): string {
  if (order.orderType === "dine_in" && order.table) {
    return `Tavolo ${order.table}`;
  }
  if (order.ticketNumber) {
    return `${ORDER_TYPE_LABEL[order.orderType]} #${order.ticketNumber}`;
  }
  return ORDER_TYPE_LABEL[order.orderType];
}

function itemCount(order: Order): number {
  return order.items.reduce((sum, item) => sum + item.quantity, 0);
}

// ─── Staff ─────────────────────────────────────────────────────────────────

export function buildOrderCreatedDraft(order: Order): NotificationDraft {
  return {
    title: `Nuovo ordine · ${orderRef(order)}`,
    body: `${itemCount(order)} articoli · ${euro.format(order.total)}`,
    tag: `order-${order.id}`,
  };
}

/** Statuses worth interrupting a staff member for. Everything else (item
 *  edits, moves between tables, payment) stays silent. */
const STAFF_ORDER_STATUSES: ReadonlySet<string> = new Set(["ready", "cancelled"]);

export function buildOrderStatusDraft(order: Order): NotificationDraft | null {
  if (!STAFF_ORDER_STATUSES.has(order.status)) {
    return null;
  }
  return {
    title: order.status === "ready" ? `Ordine pronto · ${orderRef(order)}` : `Ordine annullato · ${orderRef(order)}`,
    body: order.status === "ready" ? `${itemCount(order)} articoli pronti da servire` : "Ordine annullato dal personale",
    tag: `order-${order.id}`,
  };
}

/** Only brand-new reservation requests interrupt; edits and confirmations don't. */
export function buildReservationDraft(reservation: Reservation): NotificationDraft | null {
  if (reservation.status !== "pending") {
    return null;
  }
  const when = new Date(reservation.reservedFor);
  const whenLabel = Number.isNaN(when.getTime())
    ? ""
    : when.toLocaleString("it-IT", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  return {
    title: "Nuova prenotazione",
    body: `${reservation.customerName} · ${reservation.partySize} pax${whenLabel ? ` · ${whenLabel}` : ""}`,
    tag: `reservation-${reservation.id}`,
  };
}

export function buildPrintJobDraft(job: PrintJob): NotificationDraft | null {
  if (job.status !== "failed") {
    return null;
  }
  return {
    title: "Stampa non riuscita",
    body: `${job.area ? `Area ${job.area} · ` : ""}${job.error ?? "Errore di stampa"}`,
    tag: `printjob-${job.id}`,
  };
}

/** A bridge only interrupts when it stops answering (`active` is healthy). */
export function buildBridgeDraft(bridge: PrintBridge, removed = false): NotificationDraft | null {
  if (!removed && bridge.status === "active") {
    return null;
  }
  return {
    title: removed ? "Bridge stampa rimosso" : "Bridge stampa offline",
    body: bridge.name,
    tag: `bridge-${bridge.id}`,
  };
}

// ─── Consumer ──────────────────────────────────────────────────────────────

const TAKEAWAY_STATUSES: ReadonlySet<string> = new Set(["preparing", "ready", "cancelled"]);

const TAKEAWAY_TITLE: Record<string, string> = {
  preparing: "Il tuo ordine è in preparazione",
  ready: "Il tuo ordine è pronto al ritiro",
  cancelled: "Il tuo ordine è stato annullato",
};

export function buildTakeawayStatusDraft(order: Order): NotificationDraft | null {
  if (!TAKEAWAY_STATUSES.has(order.status)) {
    return null;
  }
  return {
    title: TAKEAWAY_TITLE[order.status] ?? "Aggiornamento ordine",
    body: `${itemCount(order)} articoli · ${euro.format(order.total)}`,
    tag: `takeaway-${order.id}`,
  };
}

export function buildGroupOrderSubmittedDraft(payload: GroupOrderRealtimeSubmitted): NotificationDraft {
  const session = payload.session;
  return {
    title: "Ordine di gruppo inviato",
    body: `${session.joinCode} · ${payload.order.items.length} articoli · ${euro.format(session.total)}`,
    tag: `grouporder-${session.id}`,
    url: `/${session.tenantSlug}/group-order/${session.joinCode}`,
  };
}

/**
 * Staff alert: a submitted group order is a DRAFT that needs manual approval
 * before it reaches the kitchen/printer. Deep-links to the review queue.
 */
export function buildGroupOrderDraftReviewDraft(payload: GroupOrderRealtimeSubmitted): NotificationDraft {
  const session = payload.session;
  return {
    title: "Ordine di gruppo da approvare",
    body: `${itemCount(payload.order)} articoli · ${euro.format(payload.order.total)}`,
    tag: `grouporder-review-${session.id}`,
    url: "/app/group-orders",
  };
}

// ─── Low stock ─────────────────────────────────────────────────────────────

/** Ingredients currently at or below their minimum threshold. */
export function collectBelowThreshold(items: readonly Ingredient[]): Set<string> {
  const below = new Set<string>();
  for (const item of items) {
    if (item.isStockTracked && item.quantity <= item.minThreshold) {
      below.add(item.id);
    }
  }
  return below;
}

export interface LowStockDiff {
  /** Ingredients that crossed the threshold since the previous snapshot. */
  newlyBelow: Ingredient[];
  /** Snapshot to store for the next event. */
  next: Set<string>;
}

/**
 * `inventory:update` carries the whole ingredient list and is emitted on every
 * inventory change, so notifying "something is below threshold" would fire
 * constantly. Diffing against the previous snapshot makes the notification
 * mean something: it only fires when an ingredient crosses the line.
 * A `null` previous value seeds the baseline without notifying.
 */
export function diffBelowThreshold(
  previous: Set<string> | null,
  items: readonly Ingredient[],
): LowStockDiff {
  const next = collectBelowThreshold(items);
  if (previous === null) {
    return { newlyBelow: [], next };
  }
  const newlyBelow: Ingredient[] = items.filter((item) => next.has(item.id) && !previous.has(item.id));
  return { newlyBelow, next };
}

export function buildLowStockDraft(items: readonly Ingredient[]): NotificationDraft | null {
  if (items.length === 0) {
    return null;
  }
  const names = items.slice(0, 3).map((item) => item.name);
  const rest = items.length - names.length;
  return {
    title: items.length === 1 ? "Scorta bassa" : "Scorte basse",
    body: `${names.join(", ")}${rest > 0 ? ` e altri ${rest}` : ""}`,
    tag: "lowstock",
  };
}

/**
 * Deep link opened on notificationclick. Staff links go to the backoffice and
 * consumer links to the public page, both prefixed with the tenant slug when
 * the deployment serves tenants from the path (`/franks/...`).
 */
export function resolvePushUrl(
  audience: "staff" | "consumer",
  tenantSlug: string | undefined,
  fallback: string,
): string {
  if (audience === "staff" && !tenantSlug) {
    return fallback.startsWith("/") ? fallback : `/${fallback}`;
  }
  return `${tenantSlug ? `/${tenantSlug}` : ""}${fallback}`;
}

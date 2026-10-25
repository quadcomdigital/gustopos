import type { GhostOrder } from "@gustopos/shared";

/** Ghost draft not found (or already cleaned up). */
export class GhostOrderNotFoundError extends Error {
  constructor(message = "Ghost order not found") {
    super(message);
    this.name = "GhostOrderNotFoundError";
  }
}

/** The actor may see the draft but not mutate/commit it. */
export class GhostOrderForbiddenError extends Error {
  constructor(message = "Ghost order not allowed") {
    super(message);
    this.name = "GhostOrderForbiddenError";
  }
}

/**
 * Optimistic-concurrency conflict: the caller's `expectedVersion` is stale.
 * Carries the canonical draft so the client can reconcile instead of
 * overwriting another operator's edits.
 */
export class GhostOrderConflictError extends Error {
  constructor(
    public readonly current: GhostOrder | null,
    message = "Ghost order changed since it was loaded",
  ) {
    super(message);
    this.name = "GhostOrderConflictError";
  }
}

/** Invalid draft content (missing/inactive product, empty cart, ...). */
export class GhostOrderInvalidError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GhostOrderInvalidError";
  }
}

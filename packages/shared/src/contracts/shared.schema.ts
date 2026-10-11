import { z } from "zod";

// ─── Shared base enums (used by both contracts.ts and menu.schema.ts) ────────

/**
 * @deprecated Legacy fixed print-area enum. Superseded by per-tenant
 * `printStationSchema`. Kept for the deprecated `print_areas` columns and
 * legacy bridge fallbacks; not used for new station routing.
 */
export const printAreaSchema = z.enum(["kitchen", "bar", "cashier"]);

export const bomComponentTypeSchema = z.enum(["ingredient", "bom", "prep"]);

/**
 * Max length of a product's internal ticket name ("nome interno"). Production
 * comande print the label at 2xl (≈21 chars per line on Font A), so anything
 * longer starts wrapping on the second line of the ticket.
 */
export const TICKET_NAME_MAX_LENGTH = 24;

// ─── Print Stations (dynamic, per-tenant) ───────────────────────────────────
//
// A station is a named print destination (Cucina, Pizzeria, Bar, …). Its `id`
// is the opaque routing key stored in `print_jobs.area` and in bridge claimed
// areas/mappings. `kind: "cashier"` is reserved for the receipt station.

export const printStationKindSchema = z.enum(["production", "cashier"]);

export const printStationSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(60),
  kind: printStationKindSchema.default("production"),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
  // When true the station ticket prints only this station's own items (items
  // without a station assignment still print everywhere). Keeps e.g. beverages
  // off the kitchen comanda.
  ownItemsOnly: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  // How many products/categories currently route to this station. Populated by
  // `GET /print-stations` (list only) so Settings → Zone di stampa can show the
  // footprint and warn before deleting; omitted by single-station reads.
  usage: z
    .object({
      menuItems: z.number().int().nonnegative(),
      categories: z.number().int().nonnegative(),
    })
    .optional(),
});

export const printStationsListResponseSchema = z.array(printStationSchema);

export const printStationCreateRequestSchema = z.object({
  name: z.string().min(1).max(60),
  kind: printStationKindSchema.default("production"),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
  ownItemsOnly: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export const printStationUpdateRequestSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  kind: printStationKindSchema.optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
  ownItemsOnly: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

// ─── Inferred Types ─────────────────────────────────────────────────────────

export type PrintArea = z.infer<typeof printAreaSchema>;
export type BomComponentType = z.infer<typeof bomComponentTypeSchema>;
export type PrintStationKind = z.infer<typeof printStationKindSchema>;
export type PrintStation = z.infer<typeof printStationSchema>;
export type PrintStationsListResponse = z.infer<typeof printStationsListResponseSchema>;
export type PrintStationCreateRequest = z.infer<typeof printStationCreateRequestSchema>;
export type PrintStationUpdateRequest = z.infer<typeof printStationUpdateRequestSchema>;

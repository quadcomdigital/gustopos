import { z } from "zod";

/**
 * Presenza di una postazione POS su un tavolo. È effimera (vive in memoria del
 * gateway, muore con la connessione socket): serve solo a mostrare sulla mappa
 * tavoli quale postazione sta lavorando su quale tavolo, così la cassa non deve
 * indovinare chi ha il conto aperto. Non è un lock di autorizzazione: il lock
 * vero resta esplicito lato POS.
 */
export const posPresenceEntrySchema = z.object({
  tableId: z.string().min(1),
  tableNumber: z.string().min(1),
  staffId: z.string().min(1),
  staffName: z.string().min(1),
  /** Conto agganciato, quando la postazione è su un asporto/consegna. */
  orderId: z.string().nullable().optional(),
  orderType: z.enum(["dine_in", "takeaway", "delivery"]).optional(),
  updatedAt: z.string(),
});

export const posPresenceListSchema = z.array(posPresenceEntrySchema);

/** Payload client → server: `null` rilascia l'aggancio della postazione. */
export const posClaimTableRequestSchema = z
  .object({
    tableId: z.string().min(1),
    tableNumber: z.string().min(1),
    orderId: z.string().nullable().optional(),
    orderType: z.enum(["dine_in", "takeaway", "delivery"]).optional(),
  })
  .nullable();

export type PosPresenceEntry = z.infer<typeof posPresenceEntrySchema>;
export type PosClaimTableRequest = z.infer<typeof posClaimTableRequestSchema>;

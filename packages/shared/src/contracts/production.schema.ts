import { z } from "zod";

/**
 * Production references ("contenitori"/basi): BUN, Piadina, Panino, A piatto…
 * The RIEPILOGO block on production station tickets counts these so the
 * kitchen can prep containers and assemble. Resolution per order line:
 * main modifier (lowest sort_order) > product > category. Quantity is 1:1.
 */
export const productionReferenceSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(60),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const productionReferencesListResponseSchema = z.array(productionReferenceSchema);

export const productionReferenceCreateRequestSchema = z.object({
  name: z.string().min(1).max(60),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export const productionReferenceUpdateRequestSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export type ProductionReference = z.infer<typeof productionReferenceSchema>;
export type ProductionReferencesListResponse = z.infer<typeof productionReferencesListResponseSchema>;
export type ProductionReferenceCreateRequest = z.infer<typeof productionReferenceCreateRequestSchema>;
export type ProductionReferenceUpdateRequest = z.infer<typeof productionReferenceUpdateRequestSchema>;

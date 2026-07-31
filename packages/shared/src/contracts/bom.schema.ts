import { z } from "zod";
import { bomComponentTypeSchema } from "../contracts/shared.schema";

// ─── BoM Component ──────────────────────────────────────────────────────────

export const bomComponentSchema = z.object({
  id: z.string(),
  componentType: bomComponentTypeSchema,
  componentId: z.string().min(1),
  quantity: z.number().positive(),
  unit: z.string(),
});

// ─── BoM Item ───────────────────────────────────────────────────────────────

export const bomItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  unit: z.string(),
  yieldQuantity: z.number().positive(),
  isActive: z.boolean(),
  categoryId: z.string().optional(),
  components: z.array(bomComponentSchema),      isContainer: z.number().default(0),
});

export const bomListResponseSchema = z.array(bomItemSchema);

// ─── BoM CRUD ───────────────────────────────────────────────────────────────

export const bomCreateRequestSchema = z.object({
  name: z.string().min(2),
  unit: z.string().min(1),
  yieldQuantity: z.number().positive(),
  categoryId: z.string().optional(),      isContainer: z.number().optional().default(0),
  components: z.array(
    z.object({
      componentType: bomComponentTypeSchema,
      componentId: z.string().min(1),
      quantity: z.number().positive(),
      unit: z.string().min(1),
    }),
  ).min(1, 'BoM must have at least 1 component'),
});

export const bomUpdateRequestSchema = z.object({
  name: z.string().min(2).optional(),
  unit: z.string().min(1).optional(),
  yieldQuantity: z.number().positive().optional(),
  categoryId: z.string().optional(),
  isActive: z.boolean().optional(),      isContainer: z.number().optional(),
});

export const bomUpsertComponentsRequestSchema = z.object({
  components: z.array(
    z.object({
      componentType: bomComponentTypeSchema,
      componentId: z.string().min(1),
      quantity: z.number().positive(),
      unit: z.string().min(1),
    }),
  ).min(1, 'BoM must have at least 1 component'),
});

export const bomAddComponentRequestSchema = z.object({
  componentType: bomComponentTypeSchema,
  componentId: z.string().min(1),
  quantity: z.number().positive(),
  unit: z.string().min(1),
});

export const bomRemoveComponentRequestSchema = z.object({
  componentType: bomComponentTypeSchema,
  componentId: z.string().min(1),
});

// ─── Inferred Types ─────────────────────────────────────────────────────────

export type BomComponent = z.infer<typeof bomComponentSchema>;
export type BomItem = z.infer<typeof bomItemSchema>;
export type BomListResponse = z.infer<typeof bomListResponseSchema>;
export type BomCreateRequest = z.infer<typeof bomCreateRequestSchema>;
export type BomUpdateRequest = z.infer<typeof bomUpdateRequestSchema>;
export type BomUpsertComponentsRequest = z.infer<typeof bomUpsertComponentsRequestSchema>;
export type BomAddComponentRequest = z.infer<typeof bomAddComponentRequestSchema>;
export type BomRemoveComponentRequest = z.infer<typeof bomRemoveComponentRequestSchema>;

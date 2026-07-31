import { z } from "zod";

// ─── Supplier ──────────────────────────────────────────────────────────

export const supplierSchema = z.object({
  id: z.string(),
  name: z.string(),
  vatNumber: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const supplierCreateRequestSchema = z.object({
  name: z.string().min(2).max(140),
  vatNumber: z.string().max(40).optional(),
  phone: z.string().max(40).optional(),
  email: z.string().email().max(180).optional(),
});

export const supplierUpdateRequestSchema = z.object({
  name: z.string().min(2).max(140).optional(),
  vatNumber: z.string().max(40).optional(),
  phone: z.string().max(40).optional(),
  email: z.string().email().max(180).optional(),
  isActive: z.boolean().optional(),
});

export const suppliersQuerySchema = z.object({
  active: z.boolean().optional(),
  query: z.string().optional(),
  limit: z.number().int().min(1).max(500).optional(),
});

export const supplierIngredientSchema = z.object({
  supplierId: z.string(),
  supplierName: z.string(),
  ingredientId: z.string(),
  ingredientName: z.string(),
  brandName: z.string().nullable(),
  unitCost: z.number().nullable(),
  isPreferred: z.boolean(),
});

export const supplierIngredientCreateSchema = z.object({
  supplierId: z.string().min(1),
  ingredientId: z.string().min(1),
  brandName: z.string().max(140).optional(),
  unitCost: z.number().min(0).optional(),
  isPreferred: z.boolean().optional(),
});

export const supplierIngredientUpdateSchema = z.object({
  brandName: z.string().max(140).optional(),
  unitCost: z.number().min(0).optional(),
  isPreferred: z.boolean().optional(),
});

export const supplierPoItemSchema = z.object({
  ingredientId: z.string(),
  name: z.string(),
  brandName: z.string().nullable(),
  supplierCost: z.number().nullable(),
  currentCost: z.number(),
  currentStock: z.number(),
  unit: z.string(),
});

// ─── Purchase Orders ───────────────────────────────────────────────────

export const purchaseOrderStatusSchema = z.enum(["draft", "sent", "partial_received", "received", "cancelled"]);

export const purchaseOrderItemSchema = z.object({
  id: z.string(),
  inventoryId: z.string().optional(),
  itemName: z.string().min(1),
  unit: z.string().min(1),
  orderedQty: z.number().positive(),
  unitCost: z.number().nonnegative(),
  receivedQty: z.number().nonnegative(),
});

export const purchaseOrderSchema = z.object({
  id: z.string(),
  supplierId: z.string(),
  status: purchaseOrderStatusSchema,
  expectedAt: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(purchaseOrderItemSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const purchaseOrderCreateRequestSchema = z.object({
  supplierId: z.string().min(1),
  expectedAt: z.string().datetime().optional(),
  notes: z.string().max(500).optional(),
  items: z
    .array(
      z.object({
        inventoryId: z.string().optional(),
        itemName: z.string().min(1).max(180),
        unit: z.string().min(1).max(20),
        orderedQty: z.number().positive(),
        unitCost: z.number().nonnegative(),
      }),
    )
    .min(1),
});

export const purchaseOrderStatusUpdateRequestSchema = z.object({
  status: purchaseOrderStatusSchema,
});

export const purchaseOrdersQuerySchema = z.object({
  supplierId: z.string().optional(),
  status: purchaseOrderStatusSchema.optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.number().int().min(1).max(500).optional(),
});

// ─── Goods Receipts ────────────────────────────────────────────────────

export const goodsReceiptItemSchema = z.object({
  purchaseOrderItemId: z.string(),
  receivedQty: z.number().positive(),
  unitCost: z.number().nonnegative(),
});

export const goodsReceiptSchema = z.object({
  id: z.string(),
  purchaseOrderId: z.string(),
  receivedAt: z.string(),
  notes: z.string().optional(),
  items: z.array(goodsReceiptItemSchema),
  createdAt: z.string(),
});

export const goodsReceiptCreateRequestSchema = z.object({
  receivedAt: z.string().datetime(),
  notes: z.string().max(500).optional(),
  items: z.array(goodsReceiptItemSchema).min(1),
});

// ─── Types ─────────────────────────────────────────────────────────────

export type Supplier = z.infer<typeof supplierSchema>;
export type SupplierCreateRequest = z.infer<typeof supplierCreateRequestSchema>;
export type SupplierUpdateRequest = z.infer<typeof supplierUpdateRequestSchema>;
export type SuppliersQuery = z.infer<typeof suppliersQuerySchema>;
export type SupplierIngredient = z.infer<typeof supplierIngredientSchema>;
export type SupplierIngredientCreate = z.infer<typeof supplierIngredientCreateSchema>;
export type SupplierIngredientUpdate = z.infer<typeof supplierIngredientUpdateSchema>;
export type SupplierPoItem = z.infer<typeof supplierPoItemSchema>;
export type PurchaseOrderStatus = z.infer<typeof purchaseOrderStatusSchema>;
export type PurchaseOrderItem = z.infer<typeof purchaseOrderItemSchema>;
export type PurchaseOrder = z.infer<typeof purchaseOrderSchema>;
export type PurchaseOrderCreateRequest = z.infer<typeof purchaseOrderCreateRequestSchema>;
export type PurchaseOrderStatusUpdateRequest = z.infer<typeof purchaseOrderStatusUpdateRequestSchema>;
export type PurchaseOrdersQuery = z.infer<typeof purchaseOrdersQuerySchema>;
export type GoodsReceiptItem = z.infer<typeof goodsReceiptItemSchema>;
export type GoodsReceipt = z.infer<typeof goodsReceiptSchema>;
export type GoodsReceiptCreateRequest = z.infer<typeof goodsReceiptCreateRequestSchema>;

import { z } from "zod";

const slugSchema = z
  .string()
  .min(1)
  .max(220)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "lowercase letters, numbers, hyphens only");

export const createCategorySchema = z.object({
  name: z.string().min(1).max(120),
  slug: slugSchema,
  parentId: z.uuid().optional(),
  sortOrder: z.number().int().min(0).default(0),
});
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = z.object({
  id: z.uuid(),
  name: z.string().min(1).max(120).optional(),
  slug: slugSchema.optional(),
  parentId: z.uuid().nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
});
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

export const deleteCategorySchema = z.object({ id: z.uuid() });
export type DeleteCategoryInput = z.infer<typeof deleteCategorySchema>;

export const createFragranceNoteSchema = z.object({
  name: z.string().min(1).max(80),
  familyId: z.guid().optional(),
});
export type CreateFragranceNoteInput = z.infer<typeof createFragranceNoteSchema>;

export const deleteFragranceNoteSchema = z.object({ id: z.guid() });
export type DeleteFragranceNoteInput = z.infer<typeof deleteFragranceNoteSchema>;

const productNoteInputSchema = z.object({
  // z.guid (not strict z.uuid): some seed note ids have 0000 version/variant
  // groups — valid Postgres uuids but not RFC-4122, which strict z.uuid rejects.
  noteId: z.guid(),
  notePosition: z.enum(["top", "mid", "base"]),
  sortOrder: z.number().int().min(0).default(0),
});

export const createProductSchema = z.object({
  name: z.string().min(1).max(200),
  slug: slugSchema,
  description: z.string().max(5000).optional(),
  themeColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "hex color like #aa1188")
    .optional(),
  categoryId: z.uuid(),
  hsnCode: z.string().max(20).optional(),
  longevityRating: z.number().int().min(1).max(10).optional(),
  sillageRating: z.number().int().min(1).max(5).optional(),
  isFeatured: z.boolean().default(false),
  status: z.enum(["draft", "active", "archived"]).default("draft").optional(),
  notes: z.array(productNoteInputSchema).max(30).default([]),
});
export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = createProductSchema.partial().extend({
  id: z.uuid(),
  status: z.enum(["draft", "active", "archived"]).optional(),
});
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

export const listProductsSchema = z.object({
  status: z.enum(["draft", "active", "archived"]).optional(),
  categoryId: z.uuid().optional(),
  search: z.string().max(120).optional(),
  limit: z.number().int().min(1).max(100).default(20),
});
export type ListProductsInput = z.infer<typeof listProductsSchema>;

export const getProductSchema = z.object({
  id: z.uuid(),
});
export type GetProductInput = z.infer<typeof getProductSchema>;

const variantFieldsSchema = z.object({
  sku: z.string().min(1).max(64),
  concentration: z.enum(["edp", "edt", "parfum", "cologne", "attar"]),
  sizeMl: z.number().int().min(1).max(2000),
  mrp: z.number().positive(),
  weightGrams: z.number().int().positive(),
  // Packed shipping box dimensions (outer corrugated box handed to courier — NOT bottle dimensions)
  boxLengthCm: z.number().int().positive(),
  boxWidthCm: z.number().int().positive(),
  boxHeightCm: z.number().int().positive(),
  barcode: z.string().max(64).optional(),
  isDefault: z.boolean().default(false),
});

export const createVariantSchema = variantFieldsSchema.extend({ productId: z.uuid() });
export type CreateVariantInput = z.infer<typeof createVariantSchema>;

export const updateVariantSchema = variantFieldsSchema
  .partial()
  .extend({ id: z.uuid(), status: z.enum(["active", "discontinued"]).optional() });
export type UpdateVariantInput = z.infer<typeof updateVariantSchema>;

export const addProductImageSchema = z.object({
  productId: z.uuid(),
  variantId: z.uuid().optional(),
  key: z.string().min(1).max(500),
  altText: z.string().max(200).optional(),
  sortOrder: z.number().int().min(0).default(0),
  isPrimary: z.boolean().default(false),
  isSecondary: z.boolean().default(false),
});
export type AddProductImageInput = z.infer<typeof addProductImageSchema>;

export const deleteImageSchema = z.object({ id: z.uuid() });
export type DeleteImageInput = z.infer<typeof deleteImageSchema>;

export const setPrimaryImageSchema = z.object({ id: z.uuid(), productId: z.uuid() });
export type SetPrimaryImageInput = z.infer<typeof setPrimaryImageSchema>;

export const setSecondaryImageSchema = z.object({ id: z.uuid(), productId: z.uuid() });
export type SetSecondaryImageInput = z.infer<typeof setSecondaryImageSchema>;

export const addProductNoteSchema = z.object({
  productId: z.uuid(),
  noteId: z.guid(),
  notePosition: z.enum(["top", "mid", "base"]),
  sortOrder: z.number().int().min(0).default(0),
});
export type AddProductNoteInput = z.infer<typeof addProductNoteSchema>;

export const removeProductNoteSchema = z.object({ id: z.uuid() });
export type RemoveProductNoteInput = z.infer<typeof removeProductNoteSchema>;

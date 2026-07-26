import { z } from "zod";

import { permissionProcedure } from "../middleware/auth.middleware";
import {
  addProductImageSchema,
  addProductNoteSchema,
  createCategorySchema,
  createFragranceNoteSchema,
  createProductSchema,
  createVariantSchema,
  deleteCategorySchema,
  deleteFragranceNoteSchema,
  deleteImageSchema,
  deleteProductSchema,
  getProductSchema,
  listProductsSchema,
  removeProductNoteSchema,
  setPrimaryImageSchema,
  setSecondaryImageSchema,
  updateCategorySchema,
  updateProductSchema,
  updateVariantSchema,
} from "../schemas/catalog.schema";
import { createCatalogService } from "../services/catalog.service";
import { publicProcedure, router } from "../trpc";

const readCategories = permissionProcedure("categories", "read");
const writeCategories = permissionProcedure("categories", "write");
const writeNotes = permissionProcedure("notes", "write");
const writeProducts = permissionProcedure("products", "write");

export const catalogRouter = router({
  listCategories: publicProcedure.query(({ ctx }) => createCatalogService(ctx.db).listCategories()),

  listCategoriesWithCount: readCategories.query(({ ctx }) =>
    createCatalogService(ctx.db).listCategoriesWithCount(),
  ),

  createCategory: writeCategories
    .input(createCategorySchema)
    .mutation(({ ctx, input }) => createCatalogService(ctx.db).createCategory(input)),

  updateCategory: writeCategories
    .input(updateCategorySchema)
    .mutation(({ ctx, input }) => createCatalogService(ctx.db).updateCategory(input)),

  deleteCategory: writeCategories
    .input(deleteCategorySchema)
    .mutation(({ ctx, input }) => createCatalogService(ctx.db).deleteCategory(input)),

  listNotes: publicProcedure.query(({ ctx }) => createCatalogService(ctx.db).listFragranceNotes()),

  createNote: writeNotes
    .input(createFragranceNoteSchema)
    .mutation(({ ctx, input }) => createCatalogService(ctx.db).createFragranceNote(input)),

  deleteNote: writeNotes
    .input(deleteFragranceNoteSchema)
    .mutation(({ ctx, input }) => createCatalogService(ctx.db).deleteFragranceNote(input)),

  listProducts: publicProcedure
    .input(listProductsSchema)
    .query(({ ctx, input }) => createCatalogService(ctx.db).listProducts(input)),

  getProduct: publicProcedure
    .input(getProductSchema)
    .query(({ ctx, input }) => createCatalogService(ctx.db).getProduct(input)),

  getProductBySlug: publicProcedure
    .input(z.object({ slug: z.string().min(1) }))
    .query(({ ctx, input }) => createCatalogService(ctx.db).getProductBySlug(input.slug)),

  createProduct: writeProducts
    .input(createProductSchema)
    .mutation(({ ctx, input }) => createCatalogService(ctx.db).createProduct(input)),

  updateProduct: writeProducts
    .input(updateProductSchema)
    .mutation(({ ctx, input }) => createCatalogService(ctx.db).updateProduct(input)),

  // Impact preview for the delete confirmation dialog (order count etc.).
  productDeletionImpact: writeProducts
    .input(getProductSchema)
    .query(({ ctx, input }) => createCatalogService(ctx.db).getDeletionImpact(input.id)),

  // Permanent, non-recoverable delete of a product and all its variants.
  deleteProduct: writeProducts
    .input(deleteProductSchema)
    .mutation(({ ctx, input }) => createCatalogService(ctx.db).deleteProduct(input.id)),

  createVariant: writeProducts
    .input(createVariantSchema)
    .mutation(({ ctx, input }) => createCatalogService(ctx.db).createVariant(input)),

  updateVariant: writeProducts
    .input(updateVariantSchema)
    .mutation(({ ctx, input }) => createCatalogService(ctx.db).updateVariant(input)),

  addImage: writeProducts
    .input(addProductImageSchema)
    .mutation(({ ctx, input }) => createCatalogService(ctx.db).addImage(input)),

  deleteImage: writeProducts
    .input(deleteImageSchema)
    .mutation(({ ctx, input }) => createCatalogService(ctx.db).deleteImage(input)),

  setPrimaryImage: writeProducts
    .input(setPrimaryImageSchema)
    .mutation(({ ctx, input }) => createCatalogService(ctx.db).setPrimaryImage(input)),

  setSecondaryImage: writeProducts
    .input(setSecondaryImageSchema)
    .mutation(({ ctx, input }) => createCatalogService(ctx.db).setSecondaryImage(input)),

  addProductNote: writeProducts
    .input(addProductNoteSchema)
    .mutation(({ ctx, input }) => createCatalogService(ctx.db).addProductNote(input)),

  removeProductNote: writeProducts
    .input(removeProductNoteSchema)
    .mutation(({ ctx, input }) => createCatalogService(ctx.db).removeProductNote(input)),
});

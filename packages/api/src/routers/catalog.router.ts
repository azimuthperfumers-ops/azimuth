import { z } from "zod";

import { adminProcedure } from "../middleware/auth.middleware";
import {
  addProductImageSchema,
  addProductNoteSchema,
  createCategorySchema,
  createFragranceNoteSchema,
  createProductSchema,
  createVariantSchema,
  deleteCategorySchema,
  deleteImageSchema,
  getProductSchema,
  listProductsSchema,
  removeProductNoteSchema,
  setPrimaryImageSchema,
  updateCategorySchema,
  updateProductSchema,
  updateVariantSchema,
} from "../schemas/catalog.schema";
import { createCatalogService } from "../services/catalog.service";
import { publicProcedure, router } from "../trpc";

export const catalogRouter = router({
  listCategories: publicProcedure.query(({ ctx }) => createCatalogService(ctx.db).listCategories()),

  listCategoriesWithCount: adminProcedure.query(({ ctx }) =>
    createCatalogService(ctx.db).listCategoriesWithCount(),
  ),

  createCategory: adminProcedure
    .input(createCategorySchema)
    .mutation(({ ctx, input }) => createCatalogService(ctx.db).createCategory(input)),

  updateCategory: adminProcedure
    .input(updateCategorySchema)
    .mutation(({ ctx, input }) => createCatalogService(ctx.db).updateCategory(input)),

  deleteCategory: adminProcedure
    .input(deleteCategorySchema)
    .mutation(({ ctx, input }) => createCatalogService(ctx.db).deleteCategory(input)),

  listNotes: publicProcedure.query(({ ctx }) => createCatalogService(ctx.db).listFragranceNotes()),

  createNote: adminProcedure
    .input(createFragranceNoteSchema)
    .mutation(({ ctx, input }) => createCatalogService(ctx.db).createFragranceNote(input)),

  listProducts: publicProcedure
    .input(listProductsSchema)
    .query(({ ctx, input }) => createCatalogService(ctx.db).listProducts(input)),

  getProduct: publicProcedure
    .input(getProductSchema)
    .query(({ ctx, input }) => createCatalogService(ctx.db).getProduct(input)),

  getProductBySlug: publicProcedure
    .input(z.object({ slug: z.string().min(1) }))
    .query(({ ctx, input }) => createCatalogService(ctx.db).getProductBySlug(input.slug)),

  createProduct: adminProcedure
    .input(createProductSchema)
    .mutation(({ ctx, input }) => createCatalogService(ctx.db).createProduct(input)),

  updateProduct: adminProcedure
    .input(updateProductSchema)
    .mutation(({ ctx, input }) => createCatalogService(ctx.db).updateProduct(input)),

  createVariant: adminProcedure
    .input(createVariantSchema)
    .mutation(({ ctx, input }) => createCatalogService(ctx.db).createVariant(input)),

  updateVariant: adminProcedure
    .input(updateVariantSchema)
    .mutation(({ ctx, input }) => createCatalogService(ctx.db).updateVariant(input)),

  addImage: adminProcedure
    .input(addProductImageSchema)
    .mutation(({ ctx, input }) => createCatalogService(ctx.db).addImage(input)),

  deleteImage: adminProcedure
    .input(deleteImageSchema)
    .mutation(({ ctx, input }) => createCatalogService(ctx.db).deleteImage(input)),

  setPrimaryImage: adminProcedure
    .input(setPrimaryImageSchema)
    .mutation(({ ctx, input }) => createCatalogService(ctx.db).setPrimaryImage(input)),

  addProductNote: adminProcedure
    .input(addProductNoteSchema)
    .mutation(({ ctx, input }) => createCatalogService(ctx.db).addProductNote(input)),

  removeProductNote: adminProcedure
    .input(removeProductNoteSchema)
    .mutation(({ ctx, input }) => createCatalogService(ctx.db).removeProductNote(input)),
});

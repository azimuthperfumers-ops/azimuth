import type { Database } from "@azimuth/db";
import { schema } from "@azimuth/db";
import { and, asc, count, desc, eq, ilike, sql } from "drizzle-orm";

import type {
  AddProductImageInput,
  AddProductNoteInput,
  CreateCategoryInput,
  CreateFragranceNoteInput,
  CreateProductInput,
  CreateVariantInput,
  ListProductsInput,
  SetPrimaryImageInput,
  SetSecondaryImageInput,
  UpdateCategoryInput,
  UpdateProductInput,
  UpdateVariantInput,
} from "../schemas/catalog.schema";
import { computeEffectivePrice, fetchActiveDiscountMap } from "../utils/pricing";

export function createCatalogRepository(db: Database) {
  return {
    async createCategory(input: CreateCategoryInput) {
      const [category] = await db.insert(schema.categories).values(input).returning();
      return category;
    },

    async listCategories() {
      return db.query.categories.findMany({ orderBy: asc(schema.categories.sortOrder) });
    },

    async updateCategory(input: UpdateCategoryInput) {
      const { id, ...fields } = input;

      const [category] =
        Object.keys(fields).length > 0
          ? await db.update(schema.categories).set(fields).where(eq(schema.categories.id, id)).returning()
          : await db.select().from(schema.categories).where(eq(schema.categories.id, id));

      return category;
    },

    async countProductsInCategory(categoryId: string): Promise<number> {
      const [row] = await db
        .select({ n: sql<number>`cast(count(*) as int)` })
        .from(schema.products)
        .where(eq(schema.products.categoryId, categoryId));
      return row?.n ?? 0;
    },

    async deleteCategory(id: string) {
      await db.delete(schema.categories).where(eq(schema.categories.id, id));
    },

    async createFragranceNote(input: CreateFragranceNoteInput) {
      const [note] = await db.insert(schema.fragranceNotes).values(input).returning();
      return note;
    },

    async listFragranceNotes() {
      return db.query.fragranceNotes.findMany({ with: { family: true } });
    },

    async createProduct(input: CreateProductInput) {
      const { notes, ...productFields } = input;

      return db.transaction(async (tx) => {
        const [product] = await tx.insert(schema.products).values(productFields).returning();

        if (!product) {
          throw new Error("product insert returned no row");
        }

        if (notes.length > 0) {
          await tx
            .insert(schema.productNotes)
            .values(notes.map((note) => ({ ...note, productId: product.id })));
        }

        return product;
      });
    },

    async updateProduct(input: UpdateProductInput) {
      const { id, notes, ...productFields } = input;

      return db.transaction(async (tx) => {
        const [product] =
          Object.keys(productFields).length > 0
            ? await tx
                .update(schema.products)
                .set(productFields)
                .where(eq(schema.products.id, id))
                .returning()
            : await tx.select().from(schema.products).where(eq(schema.products.id, id));

        if (notes) {
          await tx.delete(schema.productNotes).where(eq(schema.productNotes.productId, id));
          if (notes.length > 0) {
            await tx.insert(schema.productNotes).values(notes.map((note) => ({ ...note, productId: id })));
          }
        }

        return product;
      });
    },

    async listProducts(filters: ListProductsInput) {
      const conditions = [
        filters.status ? eq(schema.products.status, filters.status) : undefined,
        filters.categoryId ? eq(schema.products.categoryId, filters.categoryId) : undefined,
        filters.search ? ilike(schema.products.name, `%${filters.search}%`) : undefined,
      ].filter((c): c is NonNullable<typeof c> => c !== undefined);

      const products = await db.query.products.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        orderBy: desc(schema.products.createdAt),
        limit: filters.limit,
        with: { category: true, variants: true, images: true },
      });

      const allVariantIds = products.flatMap((p) => p.variants.map((v) => v.id));
      const discountMap = await fetchActiveDiscountMap(db, allVariantIds);

      return products.map((p) => ({
        ...p,
        variants: p.variants.map((v) => ({
          ...v,
          effectivePrice: computeEffectivePrice(Number(v.mrp), discountMap.get(v.id)),
        })),
      }));
    },

    async getProductById(id: string) {
      const product = await db.query.products.findFirst({
        where: eq(schema.products.id, id),
        with: { category: true, variants: true, images: true, notes: { with: { note: true } } },
      });
      if (!product) return undefined;

      const discountMap = await fetchActiveDiscountMap(db, product.variants.map((v) => v.id));
      return {
        ...product,
        variants: product.variants.map((v) => ({
          ...v,
          effectivePrice: computeEffectivePrice(Number(v.mrp), discountMap.get(v.id)),
        })),
      };
    },

    async getProductBySlug(slug: string) {
      const product = await db.query.products.findFirst({
        where: and(eq(schema.products.slug, slug), eq(schema.products.status, "active")),
        with: { category: true, variants: true, images: true, notes: { with: { note: true } } },
      });
      if (!product) return undefined;

      const discountMap = await fetchActiveDiscountMap(db, product.variants.map((v) => v.id));
      return {
        ...product,
        variants: product.variants.map((v) => ({
          ...v,
          effectivePrice: computeEffectivePrice(Number(v.mrp), discountMap.get(v.id)),
        })),
      };
    },

    async createVariant(input: CreateVariantInput) {
      return db.transaction(async (tx) => {
        if (input.isDefault) {
          await tx
            .update(schema.productVariants)
            .set({ isDefault: false })
            .where(eq(schema.productVariants.productId, input.productId));
        }

        const mrpStr = input.mrp.toString();
        const [variant] = await tx
          .insert(schema.productVariants)
          .values({
            ...input,
            mrp: mrpStr,
          })
          .returning();

        return variant;
      });
    },

    async updateVariant(input: UpdateVariantInput) {
      const { id, mrp, isDefault, ...rest } = input;

      return db.transaction(async (tx) => {
        if (isDefault) {
          const [current] = await tx
            .select({ productId: schema.productVariants.productId })
            .from(schema.productVariants)
            .where(eq(schema.productVariants.id, id));

          if (current) {
            await tx
              .update(schema.productVariants)
              .set({ isDefault: false })
              .where(eq(schema.productVariants.productId, current.productId));
          }
        }

        const mrpStr = mrp !== undefined ? mrp.toString() : undefined;
        const updateFields = {
          ...rest,
          ...(mrpStr !== undefined ? { mrp: mrpStr } : {}),
          ...(isDefault !== undefined ? { isDefault } : {}),
        };

        const [variant] =
          Object.keys(updateFields).length > 0
            ? await tx
                .update(schema.productVariants)
                .set(updateFields)
                .where(eq(schema.productVariants.id, id))
                .returning()
            : await tx.select().from(schema.productVariants).where(eq(schema.productVariants.id, id));

        return variant;
      });
    },

    async addImage(input: AddProductImageInput) {
      const [image] = await db.insert(schema.productImages).values(input).returning();
      return image;
    },

    async deleteImage(id: string) {
      await db.delete(schema.productImages).where(eq(schema.productImages.id, id));
    },

    async addProductNote(input: AddProductNoteInput) {
      const [row] = await db.insert(schema.productNotes).values(input).returning();
      return row;
    },

    async removeProductNote(id: string) {
      await db.delete(schema.productNotes).where(eq(schema.productNotes.id, id));
    },

    async setPrimaryImage({ id, productId }: SetPrimaryImageInput) {
      await db.transaction(async (tx) => {
        await tx
          .update(schema.productImages)
          .set({ isPrimary: false })
          .where(eq(schema.productImages.productId, productId));
        // primary and secondary are mutually exclusive — clear secondary on the target
        await tx
          .update(schema.productImages)
          .set({ isPrimary: true, isSecondary: false })
          .where(eq(schema.productImages.id, id));
      });
    },

    async setSecondaryImage({ id, productId }: SetSecondaryImageInput) {
      await db.transaction(async (tx) => {
        await tx
          .update(schema.productImages)
          .set({ isSecondary: false })
          .where(eq(schema.productImages.productId, productId));
        // mutually exclusive with primary — clear primary on the target
        await tx
          .update(schema.productImages)
          .set({ isSecondary: true, isPrimary: false })
          .where(eq(schema.productImages.id, id));
      });
    },
  };
}

export type CatalogRepository = ReturnType<typeof createCatalogRepository>;

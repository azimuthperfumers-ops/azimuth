import type { Database } from "@azimuth/db";
import { TRPCError } from "@trpc/server";

import { CacheKey, cacheDel, cacheGetOrSet } from "../lib/redis";
import { createCatalogRepository } from "../repositories/catalog.repository";
import { env } from "../env";
import type {
  AddProductImageInput,
  AddProductNoteInput,
  CreateCategoryInput,
  CreateFragranceNoteInput,
  CreateProductInput,
  CreateVariantInput,
  DeleteCategoryInput,
  DeleteImageInput,
  GetProductInput,
  ListProductsInput,
  RemoveProductNoteInput,
  SetPrimaryImageInput,
  SetSecondaryImageInput,
  UpdateCategoryInput,
  UpdateProductInput,
  UpdateVariantInput,
} from "../schemas/catalog.schema";

function hasPgErrorCode(err: unknown, code: string): boolean {
  if (typeof err !== "object" || err === null) return false;
  if ("code" in err && err.code === code) return true;
  // drizzle-orm wraps every driver error in DrizzleQueryError, which puts the
  // real postgres error (the one with `.code`) on `.cause`, not on itself.
  const cause = (err as { cause?: unknown }).cause;
  return typeof cause === "object" && cause !== null && "code" in cause && cause.code === code;
}

async function guardUnique<T>(fn: () => Promise<T>, message: string): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (hasPgErrorCode(err, "23505")) {
      throw new TRPCError({ code: "CONFLICT", message });
    }
    throw err;
  }
}

async function guardReferenced<T>(fn: () => Promise<T>, message: string): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (hasPgErrorCode(err, "23503")) {
      throw new TRPCError({ code: "CONFLICT", message });
    }
    throw err;
  }
}

export function imageUrl(key: string) {
  if (key.startsWith("https://") || key.startsWith("http://")) return key;
  const base = env.R2_PUBLIC_URL?.replace(/\/$/, "") ?? "";
  return `${base}/${key}`;
}

export function withUrl<T extends { key: string }>(img: T) {
  return { ...img, url: imageUrl(img.key) };
}

export function createCatalogService(db: Database) {
  const catalogRepository = createCatalogRepository(db);

  return {
    createCategory(input: CreateCategoryInput) {
      return guardUnique(() => catalogRepository.createCategory(input), "category slug already exists");
    },

    listCategories() {
      return catalogRepository.listCategories();
    },

    async listCategoriesWithCount() {
      const categories = await catalogRepository.listCategories();
      const withCounts = await Promise.all(
        categories.map(async (cat) => {
          const productCount = await cacheGetOrSet<number>(
            CacheKey.categoryProductCount(cat.id),
            300, // 5 min TTL
            () => catalogRepository.countProductsInCategory(cat.id),
          );
          return { ...cat, productCount };
        }),
      );
      return withCounts;
    },

    async updateCategory(input: UpdateCategoryInput) {
      const category = await guardUnique(
        () => catalogRepository.updateCategory(input),
        "category slug already exists",
      );

      if (!category) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return category;
    },

    deleteCategory(input: DeleteCategoryInput) {
      return guardReferenced(
        () => catalogRepository.deleteCategory(input.id),
        "category still has products assigned to it",
      );
    },

    createFragranceNote(input: CreateFragranceNoteInput) {
      return guardUnique(() => catalogRepository.createFragranceNote(input), "note name already exists");
    },

    listFragranceNotes() {
      return catalogRepository.listFragranceNotes();
    },

    async createProduct(input: CreateProductInput) {
      const product = await guardUnique(
        () => catalogRepository.createProduct(input),
        "product slug already exists",
      );
      await cacheDel(CacheKey.categoryProductCount(input.categoryId));
      return product;
    },

    async updateProduct(input: UpdateProductInput) {
      const product = await guardUnique(
        () => catalogRepository.updateProduct(input),
        "product slug already exists",
      );

      if (!product) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      // Invalidate count for any category touched (new categoryId if changed)
      if (input.categoryId) {
        await cacheDel(CacheKey.categoryProductCount(input.categoryId));
      }
      // Always invalidate the product's own category (product.categoryId)
      await cacheDel(CacheKey.categoryProductCount(product.categoryId));

      return product;
    },

    async listProducts(filters: ListProductsInput) {
      const products = await catalogRepository.listProducts(filters);
      return products.map((p) => ({ ...p, images: p.images.map(withUrl) }));
    },

    async getProduct(input: GetProductInput) {
      const product = await catalogRepository.getProductById(input.id);

      if (!product) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return { ...product, images: product.images.map(withUrl) };
    },

    async getProductBySlug(slug: string) {
      const product = await catalogRepository.getProductBySlug(slug);

      if (!product) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return { ...product, images: product.images.map(withUrl) };
    },

    createVariant(input: CreateVariantInput) {
      return guardUnique(() => catalogRepository.createVariant(input), "SKU or barcode already exists");
    },

    async updateVariant(input: UpdateVariantInput) {
      const variant = await guardUnique(
        () => catalogRepository.updateVariant(input),
        "SKU or barcode already exists",
      );

      if (!variant) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return variant;
    },

    async addImage(input: AddProductImageInput) {
      try {
        const img = await catalogRepository.addImage(input);
        return img ? withUrl(img) : img;
      } catch (err) {
        if (hasPgErrorCode(err, "23505") && (input.isPrimary || input.isSecondary)) {
          // Primary/secondary slot already taken — insert as plain gallery image
          // rather than surfacing a conflict to the user.
          const img = await catalogRepository.addImage({ ...input, isPrimary: false, isSecondary: false });
          return img ? withUrl(img) : img;
        }
        if (hasPgErrorCode(err, "23505")) {
          throw new TRPCError({ code: "CONFLICT", message: "only one primary image allowed per product" });
        }
        throw err;
      }
    },

    deleteImage(input: DeleteImageInput) {
      return catalogRepository.deleteImage(input.id);
    },

    setPrimaryImage(input: SetPrimaryImageInput) {
      return catalogRepository.setPrimaryImage(input);
    },

    setSecondaryImage(input: SetSecondaryImageInput) {
      return catalogRepository.setSecondaryImage(input);
    },

    addProductNote(input: AddProductNoteInput) {
      return guardUnique(
        () => catalogRepository.addProductNote(input),
        "note already added at that position",
      );
    },

    removeProductNote(input: RemoveProductNoteInput) {
      return catalogRepository.removeProductNote(input.id);
    },
  };
}

export type CatalogService = ReturnType<typeof createCatalogService>;

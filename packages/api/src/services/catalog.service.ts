import type { Database } from "@azimuth/db";
import { TRPCError } from "@trpc/server";

import {
  CacheKey,
  CacheNs,
  CacheTtl,
  cacheBumpVersion,
  cacheDel,
  cacheGetOrSet,
  cacheGetOrSetNs,
} from "../lib/redis";
import { createCatalogRepository } from "../repositories/catalog.repository";
import { env } from "../env";
import type {
  AddProductImageInput,
  AddProductNoteInput,
  CreateCategoryInput,
  CreateFragranceNoteInput,
  DeleteFragranceNoteInput,
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

/**
 * Every catalog write invalidates every cached catalog read — one INCR bumps the
 * namespace version, orphaning all `catalog:v<n>:*` keys at once. Coarse on
 * purpose: writes are rare (an admin editing the shop), reads are constant, and
 * a wrong stale price costs more than a redundant query.
 */
async function invalidating<T>(work: Promise<T> | T): Promise<T> {
  const result = await work;
  await cacheBumpVersion(CacheNs.catalog);
  return result;
}

export function createCatalogService(db: Database) {
  const catalogRepository = createCatalogRepository(db);

  return {
    createCategory(input: CreateCategoryInput) {
      return invalidating(
        guardUnique(() => catalogRepository.createCategory(input), "category slug already exists"),
      );
    },

    listCategories() {
      return cacheGetOrSetNs(CacheNs.catalog, "categories", CacheTtl.catalog, () =>
        catalogRepository.listCategories(),
      );
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

      await cacheBumpVersion(CacheNs.catalog);
      return category;
    },

    deleteCategory(input: DeleteCategoryInput) {
      return invalidating(
        guardReferenced(
          () => catalogRepository.deleteCategory(input.id),
          "category still has products assigned to it",
        ),
      );
    },

    createFragranceNote(input: CreateFragranceNoteInput) {
      return invalidating(
        guardUnique(() => catalogRepository.createFragranceNote(input), "note name already exists"),
      );
    },

    listFragranceNotes() {
      return cacheGetOrSetNs(CacheNs.catalog, "notes", CacheTtl.catalog, () =>
        catalogRepository.listFragranceNotes(),
      );
    },

    deleteFragranceNote(input: DeleteFragranceNoteInput) {
      return invalidating(
        guardReferenced(
          () => catalogRepository.deleteFragranceNote(input.id),
          "This note is used by one or more products — remove it from them first.",
        ),
      );
    },

    async createProduct(input: CreateProductInput) {
      const product = await guardUnique(
        () => catalogRepository.createProduct(input),
        "product slug already exists",
      );
      await cacheDel(CacheKey.categoryProductCount(input.categoryId));
      await cacheBumpVersion(CacheNs.catalog);
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
      await cacheBumpVersion(CacheNs.catalog);

      return product;
    },

    // What an admin is about to destroy — surfaced in the delete confirmation so
    // the warning ("N orders reference this, non-recoverable") is truthful.
    async getDeletionImpact(id: string) {
      const product = await catalogRepository.getProductById(id);
      if (!product) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      const orderCount = await catalogRepository.countOrdersForProduct(id);
      return {
        productName: product.name,
        variantCount: product.variants.length,
        imageCount: product.images.length,
        orderCount,
      };
    },

    // Permanent, non-recoverable delete of the product and all its variants,
    // images, notes, ratings, discount targets and wishlist entries. Order history
    // is preserved (line items keep their snapshots). See repository for the cascade.
    async deleteProduct(id: string) {
      const product = await catalogRepository.getProductById(id);
      if (!product) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      await catalogRepository.deleteProduct(id);
      await cacheDel(CacheKey.categoryProductCount(product.categoryId));
      await cacheBumpVersion(CacheNs.catalog);
      return { deleted: true };
    },

    async listProducts(filters: ListProductsInput) {
      const fetch = async () => {
        const products = await catalogRepository.listProducts(filters);
        return products.map((p) => ({ ...p, images: p.images.map(withUrl) }));
      };

      // Admin search is high-cardinality and barely reused — caching it would
      // fill Redis with keys nobody reads a second time.
      if (filters.search) return fetch();

      const key = `products:${filters.status ?? "any"}:${filters.categoryId ?? "any"}:${filters.limit}`;
      return cacheGetOrSetNs(CacheNs.catalog, key, CacheTtl.catalog, fetch);
    },

    async getProduct(input: GetProductInput) {
      const product = await catalogRepository.getProductById(input.id);

      if (!product) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return { ...product, images: product.images.map(withUrl) };
    },

    // The public product page. The NOT_FOUND throw lives inside the fallback on
    // purpose: cacheGetOrSet only stores a value it received, so a 404 is never
    // cached and a newly published product appears immediately.
    getProductBySlug(slug: string) {
      return cacheGetOrSetNs(CacheNs.catalog, `product:slug:${slug}`, CacheTtl.catalog, async () => {
        const product = await catalogRepository.getProductBySlug(slug);

        if (!product) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }

        return { ...product, images: product.images.map(withUrl) };
      });
    },

    createVariant(input: CreateVariantInput) {
      return invalidating(
        guardUnique(() => catalogRepository.createVariant(input), "SKU or barcode already exists"),
      );
    },

    async updateVariant(input: UpdateVariantInput) {
      const variant = await guardUnique(
        () => catalogRepository.updateVariant(input),
        "SKU or barcode already exists",
      );

      if (!variant) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      await cacheBumpVersion(CacheNs.catalog);
      return variant;
    },

    async addImage(input: AddProductImageInput) {
      try {
        const img = await invalidating(catalogRepository.addImage(input));
        return img ? withUrl(img) : img;
      } catch (err) {
        if (hasPgErrorCode(err, "23505") && (input.isPrimary || input.isSecondary)) {
          // Primary/secondary slot already taken — insert as plain gallery image
          // rather than surfacing a conflict to the user.
          const img = await invalidating(
            catalogRepository.addImage({ ...input, isPrimary: false, isSecondary: false }),
          );
          return img ? withUrl(img) : img;
        }
        if (hasPgErrorCode(err, "23505")) {
          throw new TRPCError({ code: "CONFLICT", message: "only one primary image allowed per product" });
        }
        throw err;
      }
    },

    deleteImage(input: DeleteImageInput) {
      return invalidating(catalogRepository.deleteImage(input.id));
    },

    setPrimaryImage(input: SetPrimaryImageInput) {
      return invalidating(catalogRepository.setPrimaryImage(input));
    },

    setSecondaryImage(input: SetSecondaryImageInput) {
      return invalidating(catalogRepository.setSecondaryImage(input));
    },

    addProductNote(input: AddProductNoteInput) {
      return invalidating(
        guardUnique(
          () => catalogRepository.addProductNote(input),
          "note already added at that position",
        ),
      );
    },

    removeProductNote(input: RemoveProductNoteInput) {
      return invalidating(catalogRepository.removeProductNote(input.id));
    },
  };
}

export type CatalogService = ReturnType<typeof createCatalogService>;

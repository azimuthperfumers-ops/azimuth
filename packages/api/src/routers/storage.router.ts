import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { adminProcedure, protectedProcedure } from "../middleware/auth.middleware";
import { router } from "../trpc";
import { env } from "../env";

function r2Client() {
  if (!env.R2_ACCOUNT_ID || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "R2 storage is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY.",
    });
  }
  return new S3Client({
    region: "auto",
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
  });
}

function r2BucketAndBase() {
  if (!env.R2_BUCKET_NAME || !env.R2_PUBLIC_URL) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "R2 storage is not configured. Set R2_BUCKET_NAME, R2_PUBLIC_URL.",
    });
  }
  return { bucket: env.R2_BUCKET_NAME, base: env.R2_PUBLIC_URL.replace(/\/$/, "") };
}

export const storageRouter = router({
  getUploadUrl: adminProcedure
    .input(z.object({ filename: z.string().min(1), contentType: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const { bucket, base } = r2BucketAndBase();
      const ext = input.filename.split(".").pop()?.toLowerCase() ?? "jpg";
      const key = `products/${crypto.randomUUID()}.${ext}`;
      const command = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: input.contentType });
      const uploadUrl = await getSignedUrl(r2Client(), command, { expiresIn: 300 });
      return { uploadUrl, publicUrl: `${base}/${key}`, key };
    }),

  getTicketUploadUrl: protectedProcedure
    .input(
      z.object({
        filename: z.string().min(1),
        contentType: z.string().min(1).refine((t) => t.startsWith("image/"), "Only image uploads allowed"),
      }),
    )
    .mutation(async ({ input }) => {
      const { bucket, base } = r2BucketAndBase();
      const ext = input.filename.split(".").pop()?.toLowerCase() ?? "jpg";
      const key = `support/${crypto.randomUUID()}.${ext}`;
      const command = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: input.contentType });
      const uploadUrl = await getSignedUrl(r2Client(), command, { expiresIn: 300 });
      return { uploadUrl, publicUrl: `${base}/${key}`, key };
    }),
});

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { adminProcedure } from "../middleware/auth.middleware";
import { router } from "../trpc";

function r2Client() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "R2 storage is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY.",
    });
  }

  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

export const storageRouter = router({
  getUploadUrl: adminProcedure
    .input(
      z.object({
        filename: z.string().min(1),
        contentType: z.string().min(1),
      }),
    )
    .mutation(async ({ input }: { input: { filename: string; contentType: string } }) => {
      const bucket = process.env.R2_BUCKET_NAME;
      const publicUrlBase = process.env.R2_PUBLIC_URL;

      if (!bucket || !publicUrlBase) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "R2 storage is not configured. Set R2_BUCKET_NAME, R2_PUBLIC_URL.",
        });
      }

      const ext = input.filename.split(".").pop()?.toLowerCase() ?? "jpg";
      const key = `products/${crypto.randomUUID()}.${ext}`;

      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ContentType: input.contentType,
      });

      const uploadUrl = await getSignedUrl(r2Client(), command, { expiresIn: 300 });
      const publicUrl = `${publicUrlBase.replace(/\/$/, "")}/${key}`;

      return { uploadUrl, publicUrl, key };
    }),
});

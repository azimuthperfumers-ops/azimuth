import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { env } from "../../env.js";

// Uploads the rendered invoice PDF to R2 and returns its public URL. Mirrors the
// R2 config used by storage.router; invoices live under invoices/.
export async function uploadInvoicePdf(pdf: Buffer, orderNumber: string): Promise<string> {
  if (!env.R2_ACCOUNT_ID || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY) {
    throw new Error("R2 not configured (R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY)");
  }
  if (!env.R2_BUCKET_NAME || !env.R2_PUBLIC_URL) {
    throw new Error("R2 not configured (R2_BUCKET_NAME / R2_PUBLIC_URL)");
  }

  const client = new S3Client({
    region: "auto",
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
  });

  const safe = orderNumber.replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = `invoices/${safe}.pdf`;
  await client.send(
    new PutObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: key,
      Body: pdf,
      ContentType: "application/pdf",
    }),
  );

  const base = env.R2_PUBLIC_URL.replace(/\/$/, "");
  return `${base}/${key}`;
}

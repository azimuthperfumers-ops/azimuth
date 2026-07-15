import { useState } from "react";
import { trpc } from "@/lib/trpc";

export interface UploadedFile {
  url: string;
  name: string;
  kind: "image" | "video";
}

// Proof uploads for refund tickets: parcel photos (compared against the courier's
// POD image) or an unpacking video. Caps: 10MB per image, 100MB per video.
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

export function useTicketUpload() {
  const [uploads, setUploads] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [rejected, setRejected] = useState<string | null>(null);

  const getUrl = trpc.storage.getTicketUploadUrl.useMutation();

  async function addFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setRejected(null);

    const candidates = Array.from(files).filter(
      (f) => f.type.startsWith("image/") || f.type.startsWith("video/"),
    );
    const oversize = candidates.find((f) =>
      f.type.startsWith("video/") ? f.size > MAX_VIDEO_BYTES : f.size > MAX_IMAGE_BYTES,
    );
    if (oversize) {
      setRejected(
        `${oversize.name} is too large — max ${oversize.type.startsWith("video/") ? "100MB per video" : "10MB per image"}.`,
      );
      return;
    }

    const allowed = candidates.slice(0, 5 - uploads.length);
    if (allowed.length === 0) return;

    setUploading(true);
    try {
      const results = await Promise.all(
        allowed.map(async (file) => {
          const { uploadUrl, publicUrl } = await getUrl.mutateAsync({
            filename: file.name,
            contentType: file.type,
          });
          await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
          return {
            url: publicUrl,
            name: file.name,
            kind: (file.type.startsWith("video/") ? "video" : "image") as "image" | "video",
          };
        }),
      );
      setUploads((prev) => [...prev, ...results].slice(0, 5));
    } finally {
      setUploading(false);
    }
  }

  function remove(url: string) {
    setUploads((prev) => prev.filter((u) => u.url !== url));
  }

  function reset() {
    setUploads([]);
    setRejected(null);
  }

  return { uploads, uploading, rejected, addFiles, remove, reset, urls: uploads.map((u) => u.url) };
}

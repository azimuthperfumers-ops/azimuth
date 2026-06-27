import { useState } from "react";
import { trpc } from "@/lib/trpc";

export interface UploadedFile {
  url: string;
  name: string;
}

export function useTicketUpload() {
  const [uploads, setUploads] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);

  const getUrl = trpc.storage.getTicketUploadUrl.useMutation();

  async function addFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const allowed = Array.from(files).filter((f) => f.type.startsWith("image/")).slice(0, 5 - uploads.length);
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
          return { url: publicUrl, name: file.name };
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
  }

  return { uploads, uploading, addFiles, remove, reset, urls: uploads.map((u) => u.url) };
}

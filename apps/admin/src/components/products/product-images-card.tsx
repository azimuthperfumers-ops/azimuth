"use client";

import { useRef, useState } from "react";
import { ImageIcon, Star, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";

type ProductImage = {
  id: string;
  url: string;
  altText: string | null;
  isPrimary: boolean;
};

const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/avif"];

type UploadingEntry = {
  id: string;
  name: string;
  previewUrl: string;
  progress: "uploading" | "error";
};

export function ProductImagesCard({
  productId,
  images,
}: {
  productId: string;
  images: ProductImage[];
}) {
  const utils = trpc.useUtils();
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState<UploadingEntry[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const getUploadUrl = trpc.storage.getUploadUrl.useMutation();

  const addImage = trpc.catalog.addImage.useMutation({
    onSuccess: () => utils.catalog.getProduct.invalidate({ id: productId }),
    onError: (err) => toast.error(err.message),
  });

  const deleteImage = trpc.catalog.deleteImage.useMutation({
    onSuccess: () => utils.catalog.getProduct.invalidate({ id: productId }),
    onError: (err) => toast.error(err.message),
  });

  const setPrimary = trpc.catalog.setPrimaryImage.useMutation({
    onSuccess: () => utils.catalog.getProduct.invalidate({ id: productId }),
    onError: (err) => toast.error(err.message),
  });

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const accepted = Array.from(files).filter((f) => ACCEPTED.includes(f.type));
    if (accepted.length === 0) {
      toast.error("Only JPEG, PNG, WebP, or AVIF images accepted.");
      return;
    }

    const entries: UploadingEntry[] = accepted.map((f) => ({
      id: crypto.randomUUID(),
      name: f.name,
      previewUrl: URL.createObjectURL(f),
      progress: "uploading",
    }));
    setUploading((prev) => [...prev, ...entries]);

    await Promise.all(
      accepted.map(async (file, i) => {
        const entry = entries[i]!;
        try {
          const { uploadUrl, key } = await getUploadUrl.mutateAsync({
            filename: file.name,
            contentType: file.type,
          });

          const res = await fetch(uploadUrl, {
            method: "PUT",
            body: file,
            headers: { "Content-Type": file.type },
          });
          if (!res.ok) throw new Error(`Upload failed (${res.status})`);

          await addImage.mutateAsync({
            productId,
            key,
            altText: file.name.replace(/\.[^.]+$/, ""),
            isPrimary: images.length === 0 && i === 0,
            sortOrder: images.length + i,
          });

          setUploading((prev) => prev.filter((u) => u.id !== entry.id));
          setTimeout(() => URL.revokeObjectURL(entry.previewUrl), 3000);
          toast.success("Image uploaded");
        } catch (err) {
          setUploading((prev) =>
            prev.map((u) => (u.id === entry.id ? { ...u, progress: "error" } : u)),
          );
          toast.error(`Failed: ${err instanceof Error ? err.message : "unknown error"}`);
        }
      }),
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Images</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Existing + uploading thumbnails */}
        {(images.length > 0 || uploading.length > 0) && (
          <div className="flex flex-wrap gap-3">
            {images.map((img) => (
              <div key={img.id} className="group relative size-24 shrink-0 overflow-hidden rounded-xl border bg-muted">
                <img src={img.url} alt={img.altText ?? ""} className="size-full object-cover" />
                {img.isPrimary && (
                  <div className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                    <Star className="size-2.5 fill-current" />
                    Primary
                  </div>
                )}
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-foreground/0 opacity-0 transition-all group-hover:bg-foreground/40 group-hover:opacity-100">
                  {!img.isPrimary && (
                    <Button
                      type="button"
                      size="sm"
                      className="h-6 px-2 text-[11px]"
                      disabled={setPrimary.isPending}
                      onClick={() => setPrimary.mutate({ id: img.id, productId })}
                    >
                      Set primary
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    className="size-6 p-0"
                    disabled={deleteImage.isPending}
                    onClick={() => deleteImage.mutate({ id: img.id })}
                  >
                    <X className="size-3" />
                  </Button>
                </div>
              </div>
            ))}

            {uploading.map((entry) => (
              <div
                key={entry.id}
                className={cn(
                  "relative size-24 shrink-0 overflow-hidden rounded-xl border",
                  entry.progress === "error" ? "border-destructive bg-destructive/10" : "bg-muted",
                )}
              >
                <img
                  src={entry.previewUrl}
                  alt={entry.name}
                  className={cn("size-full object-cover", entry.progress === "error" && "opacity-30")}
                />
                {entry.progress === "uploading" && (
                  <div className="absolute inset-0 flex items-center justify-center bg-foreground/30">
                    <div className="size-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  </div>
                )}
                {entry.progress === "error" && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                    <p className="text-[10px] font-medium text-destructive">Failed</p>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-5 px-1.5 text-[10px]"
                      onClick={() => setUploading((prev) => prev.filter((u) => u.id !== entry.id))}
                    >
                      Dismiss
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Drop zone */}
        <div
          role="button"
          tabIndex={0}
          aria-label="Upload images"
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed py-8 text-center transition-colors",
            dragging
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50 hover:bg-muted/40",
          )}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void handleFiles(e.dataTransfer.files);
          }}
        >
          <ImageIcon className="mb-2 size-7 text-muted-foreground/40" />
          <p className="text-body-sm font-medium">
            Drop images or{" "}
            <span className="text-primary underline underline-offset-2">browse</span>
          </p>
          <p className="mt-0.5 text-caption text-muted-foreground">
            JPEG · PNG · WebP · AVIF · 1200 × 1200 px recommended
          </p>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED.join(",")}
          multiple
          className="hidden"
          onChange={(e) => void handleFiles(e.target.files)}
        />
      </CardContent>
    </Card>
  );
}

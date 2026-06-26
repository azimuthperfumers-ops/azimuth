"use client";

import { useRef, useState } from "react";
import { ImageIcon, X, Star } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";

export type UploadedImage = {
  key: string;        // R2 object key — what's stored in DB
  displayUrl: string; // presigned/public URL — only used for browser preview in this form
  altText: string;
  isPrimary: boolean;
};

type UploadingEntry = {
  id: string;
  name: string;
  previewUrl: string;
  progress: "uploading" | "done" | "error";
};

interface ImageDropzoneProps {
  images: UploadedImage[];
  onChange: (images: UploadedImage[]) => void;
  maxImages?: number;
}

const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/avif"];

export function ImageDropzone({ images, onChange, maxImages = 10 }: ImageDropzoneProps) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState<UploadingEntry[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const getUploadUrl = trpc.storage.getUploadUrl.useMutation();

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;

    const accepted = Array.from(files).filter((f) => ACCEPTED.includes(f.type));
    if (accepted.length === 0) {
      toast.error("Only JPEG, PNG, WebP, or AVIF images are accepted.");
      return;
    }

    const slots = maxImages - images.length - uploading.filter((u) => u.progress !== "error").length;
    const batch = accepted.slice(0, Math.max(0, slots));
    if (batch.length === 0) {
      toast.error(`Maximum ${maxImages} images.`);
      return;
    }

    const entries: UploadingEntry[] = batch.map((f) => ({
      id: crypto.randomUUID(),
      name: f.name,
      previewUrl: URL.createObjectURL(f),
      progress: "uploading",
    }));
    setUploading((prev) => [...prev, ...entries]);

    await Promise.all(
      batch.map(async (file, i) => {
        const entry = entries[i]!;
        try {
          const { uploadUrl, publicUrl, key } = await getUploadUrl.mutateAsync({
            filename: file.name,
            contentType: file.type,
          });

          const res = await fetch(uploadUrl, {
            method: "PUT",
            body: file,
            headers: { "Content-Type": file.type },
          });

          if (!res.ok) throw new Error(`Upload failed (${res.status})`);

          // success — store key for DB; displayUrl for preview only
          onChange([
            ...images,
            { key, displayUrl: publicUrl, altText: file.name.replace(/\.[^.]+$/, ""), isPrimary: images.length === 0 },
          ]);
          setUploading((prev) => prev.map((u) => (u.id === entry.id ? { ...u, progress: "done" } : u)));
          // clean up object URL after a moment
          setTimeout(() => URL.revokeObjectURL(entry.previewUrl), 5000);
        } catch (err) {
          setUploading((prev) => prev.map((u) => (u.id === entry.id ? { ...u, progress: "error" } : u)));
          toast.error(`Failed to upload ${file.name}: ${err instanceof Error ? err.message : "unknown error"}`);
        }
      }),
    );

    // prune done entries
    setUploading((prev) => prev.filter((u) => u.progress !== "done"));
  }

  function setPrimary(key: string) {
    onChange(images.map((img) => ({ ...img, isPrimary: img.key === key })));
  }

  function remove(key: string) {
    const next = images.filter((img) => img.key !== key);
    if (next.length > 0 && !next.some((img) => img.isPrimary)) {
      next[0]!.isPrimary = true;
    }
    onChange(next);
  }

  function removeError(id: string) {
    setUploading((prev) => prev.filter((u) => u.id !== id));
  }

  const hasContent = images.length > 0 || uploading.length > 0;

  return (
    <div className="space-y-3">
      {/* Uploaded / uploading thumbnails */}
      {hasContent && (
        <div className="flex flex-wrap gap-2">
          {images.map((img) => (
            <div key={img.key} className="group relative size-24 shrink-0 overflow-hidden rounded-lg border bg-muted">
              <img src={img.displayUrl} alt={img.altText} className="size-full object-cover" />
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
                    onClick={() => setPrimary(img.key)}
                  >
                    Set primary
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  className="h-6 w-6 p-0"
                  onClick={() => remove(img.key)}
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
                "relative size-24 shrink-0 overflow-hidden rounded-lg border",
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
                    onClick={() => removeError(entry.id)}
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
      {images.length + uploading.filter((u) => u.progress !== "error").length < maxImages && (
        <div
          role="button"
          tabIndex={0}
          aria-label="Upload images"
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed py-10 text-center transition-colors",
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
          <ImageIcon className="mb-2 size-8 text-muted-foreground/40" />
          <p className="text-body-sm font-medium text-foreground">
            Drop images here or <span className="text-primary underline underline-offset-2">browse</span>
          </p>
          <p className="mt-1 text-caption text-muted-foreground">
            JPEG · PNG · WebP · AVIF · up to {maxImages} images · 1200 × 1200 px recommended
          </p>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(",")}
        multiple
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />
    </div>
  );
}

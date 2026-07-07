"use client";

import { type FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { ImageDropzone, type UploadedImage } from "@/components/ui/image-dropzone";

const THEME_PRESETS = ["#f5e6c8", "#8b5e3c", "#4a6741", "#b07070", "#2f4538", "#7a6240"];

const NOTE_POSITIONS = [
  { key: "top" as const, label: "Top Notes" },
  { key: "mid" as const, label: "Heart Notes" },
  { key: "base" as const, label: "Base Notes" },
];

type NoteEntry = { noteId: string; notePosition: "top" | "mid" | "base"; sortOrder: number };

function slugify(v: string) {
  return v
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function RatingButtons({
  value,
  onChange,
  max = 5,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  max?: number;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(value === n ? null : n)}
          className={cn(
            "size-9 rounded-full border text-sm font-medium transition-colors",
            value !== null && n <= value
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-background text-foreground hover:bg-muted",
          )}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

function DotRating({ value, max = 5 }: { value: number | null; max?: number }) {
  return (
    <div className="flex gap-[3px]">
      {Array.from({ length: max }).map((_, i) => (
        <span
          key={i}
          className={cn(
            "inline-block size-[5px] rounded-full",
            value !== null && i < value ? "bg-foreground" : "bg-foreground/15",
          )}
        />
      ))}
    </div>
  );
}

function StorefrontPreview({
  name,
  slug,
  themeColor,
  description,
  imageUrl,
  notes,
  noteNames,
  longevity,
  sillage,
  categoryName,
}: {
  name: string;
  slug: string;
  themeColor: string | undefined;
  description: string;
  imageUrl: string | undefined;
  notes: NoteEntry[];
  noteNames: Map<string, string>;
  longevity: number | null;
  sillage: number | null;
  categoryName: string | undefined;
}) {
  const bg = themeColor ?? "#e8e0d5";
  const displayName = name || "Product name";
  const urlSlug = slug || "product-slug";

  const topNotes = notes.filter((n) => n.notePosition === "top");
  const midNotes = notes.filter((n) => n.notePosition === "mid");
  const baseNotes = notes.filter((n) => n.notePosition === "base");
  const hasNotes = topNotes.length + midNotes.length + baseNotes.length > 0;

  return (
    <div className="overflow-hidden rounded-lg border border-border shadow-sm bg-background">
      {/* Browser chrome */}
      <div className="flex items-center gap-2 border-b border-border bg-muted/60 px-3 py-2">
        <div className="flex shrink-0 gap-1">
          <span className="size-2 rounded-full bg-red-400/80" />
          <span className="size-2 rounded-full bg-yellow-400/80" />
          <span className="size-2 rounded-full bg-green-400/80" />
        </div>
        <div className="flex flex-1 items-center justify-center rounded border border-border bg-background px-2 py-[3px]">
          <span className="truncate text-[9px] font-mono text-muted-foreground">
            azimuth-perfumers.com/shop/{urlSlug}
          </span>
        </div>
      </div>

      {/* Site header */}
      <div className="flex items-center justify-between border-b border-border bg-background px-4 py-2">
        <div className="flex items-center gap-1">
          <img src="/logo-icon.png" alt="" className="h-3 w-3 dark:invert" />
          <img src="/logo-azimuth-text.png" alt="Azimuth" className="h-[9px] w-auto dark:invert" />
        </div>
        <div className="flex gap-4">
          {["Shop", "About", "Cart (0)"].map((t) => (
            <span key={t} className="text-[8px] tracking-[0.1em] text-muted-foreground">
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="border-b border-border bg-background px-4 py-1.5">
        <span className="text-[8px] tracking-wide text-muted-foreground/60">
          Shop{categoryName ? ` / ${categoryName}` : ""} / {displayName}
        </span>
      </div>

      {/* Product layout — image left, info right */}
      <div className="flex bg-background">
        {/* Image col — 44% */}
        <div
          className="w-[44%] shrink-0 self-start"
          style={{ backgroundColor: bg }}
        >
          <div className="aspect-[3/4] w-full">
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt={displayName} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-end justify-start p-4">
                <span
                  className="font-heading text-base font-medium leading-tight text-white/60"
                  style={{ mixBlendMode: "overlay" }}
                >
                  {displayName}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Info col — 56% */}
        <div className="flex-1 space-y-3 overflow-hidden border-l border-border px-4 py-4">
          {/* Name */}
          <div>
            <h2 className="font-heading text-[1.5rem] font-medium leading-[1.1] text-foreground">
              {name ? name : <span className="text-muted-foreground/30">Product name</span>}
            </h2>
          </div>

          {/* Price placeholder */}
          <div className="border-t border-border pt-2.5">
            <p className="text-[11px] font-semibold text-foreground">From ₹—</p>
            <p className="text-[8.5px] text-muted-foreground/60 mt-0.5">Add variants to set pricing</p>
          </div>

          {/* Description */}
          {description && (
            <div className="border-t border-border pt-2.5">
              <p className="text-[9.5px] leading-relaxed text-muted-foreground line-clamp-5">
                {description}
              </p>
            </div>
          )}

          {/* Longevity / Sillage */}
          {(longevity !== null || sillage !== null) && (
            <div className="space-y-1.5 border-t border-border pt-2.5">
              {longevity !== null && (
                <div className="flex items-center justify-between">
                  <span className="text-[8px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                    Longevity
                  </span>
                  <DotRating value={longevity} max={10} />
                </div>
              )}
              {sillage !== null && (
                <div className="flex items-center justify-between">
                  <span className="text-[8px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                    Sillage
                  </span>
                  <DotRating value={sillage} />
                </div>
              )}
            </div>
          )}

          {/* Fragrance notes */}
          {hasNotes && (
            <div className="space-y-2 border-t border-border pt-2.5">
              <p className="text-[8px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                Fragrance notes
              </p>
              {[
                { label: "Top", entries: topNotes },
                { label: "Heart", entries: midNotes },
                { label: "Base", entries: baseNotes },
              ]
                .filter(({ entries }) => entries.length > 0)
                .map(({ label, entries }) => (
                  <div key={label} className="flex items-start gap-2">
                    <span className="w-7 shrink-0 pt-px text-[7px] font-semibold uppercase tracking-wider text-muted-foreground/40">
                      {label}
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {entries.map((n) => (
                        <span
                          key={n.noteId}
                          className="rounded-full border border-border bg-muted px-1.5 py-[1px] text-[7.5px] font-medium text-foreground/80"
                        >
                          {noteNames.get(n.noteId) ?? "—"}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          )}

          {/* Add to cart */}
          <div className="border-t border-border pt-2.5">
            <div className="w-full border border-foreground bg-transparent py-2 text-center text-[8px] font-semibold tracking-[0.2em] text-foreground uppercase">
              Add to cart
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function NewProductPage() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const categories = trpc.catalog.listCategories.useQuery();
  const fragranceNotes = trpc.catalog.listNotes.useQuery();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [description, setDescription] = useState("");
  const [themeColor, setThemeColor] = useState(THEME_PRESETS[0]);
  const [customColor, setCustomColor] = useState("");

  const [categoryId, setCategoryId] = useState("");
  const [hsnCode, setHsnCode] = useState("");
  const [longevity, setLongevity] = useState<number | null>(null);
  const [sillage, setSillage] = useState<number | null>(null);
  const [isFeatured, setIsFeatured] = useState(false);
  const [status, setStatus] = useState<"draft" | "active">("draft");

  const [notes, setNotes] = useState<NoteEntry[]>([]);
  const [noteSelecting, setNoteSelecting] = useState<Record<string, string>>({});

  const [newCategoryOpen, setNewCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  const createCategory = trpc.catalog.createCategory.useMutation({
    onSuccess: async (category) => {
      await utils.catalog.listCategories.invalidate();
      setCategoryId(category.id);
      setNewCategoryOpen(false);
      setNewCategoryName("");
      toast.success(`Category "${category.name}" created`);
    },
    onError: (err) => toast.error(err.message),
  });

  const [images, setImages] = useState<UploadedImage[]>([]);

  const addImageMutation = trpc.catalog.addImage.useMutation();

  const createProduct = trpc.catalog.createProduct.useMutation({
    onSuccess: async (product) => {
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        if (!img) continue;
        await addImageMutation.mutateAsync({
          productId: product.id,
          key: img.key,
          altText: img.altText || undefined,
          isPrimary: img.isPrimary,
          sortOrder: i,
        });
      }
      await utils.catalog.listProducts.invalidate();
      toast.success("Product created");
      router.push(`/products/${product.id}`);
    },
    onError: (err) => toast.error(err.message),
  });

  function onNameChange(value: string) {
    setName(value);
    if (!slugEdited) setSlug(slugify(value));
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!categoryId) {
      toast.error("Pick a category");
      return;
    }
    createProduct.mutate({
      name,
      slug,
      description: description || undefined,
      themeColor: themeColor || undefined,
      categoryId,
      hsnCode: hsnCode || undefined,
      longevityRating: longevity ?? undefined,
      sillageRating: sillage ?? undefined,
      isFeatured,
      status,
      notes,
    });
  }

  const busy = createProduct.isPending || addImageMutation.isPending;

  const noteNames = new Map(
    (fragranceNotes.data ?? []).map((n) => [n.id, n.name]),
  );
  const previewImageUrl = images[0]?.displayUrl;
  const previewCategoryName = categories.data?.find((c) => c.id === categoryId)?.name;

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Link
        href="/products"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        Back to products
      </Link>

      <div>
        <h1 className="text-xl font-semibold">Add product</h1>
        <p className="text-sm text-muted-foreground">Compose a new fragrance for the catalogue.</p>
      </div>

      <div className="grid grid-cols-[1fr_420px] items-start gap-6">
        {/* LEFT */}
        <div className="space-y-6">
          {/* Basics */}
          <Card>
            <CardHeader>
              <CardTitle>Basics</CardTitle>
              <p className="text-sm text-muted-foreground">
                How this fragrance shows up in the catalogue.
              </p>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g. Solène"
                    value={name}
                    onChange={(e) => onNameChange(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">Slug</Label>
                  <Input
                    id="slug"
                    placeholder="solene"
                    value={slug}
                    onChange={(e) => {
                      setSlugEdited(true);
                      setSlug(e.target.value);
                    }}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="One-line scent story shown on the storefront card."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label>Theme color</Label>
                <div className="flex flex-wrap items-center gap-2">
                  {THEME_PRESETS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => {
                        setThemeColor(color);
                        setCustomColor("");
                      }}
                      className={cn(
                        "size-7 rounded-full ring-offset-background transition-shadow",
                        themeColor === color && !customColor
                          ? "ring-2 ring-primary ring-offset-2"
                          : "ring-1 ring-foreground/10",
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  <Input
                    className="h-7 w-24 font-mono text-xs"
                    placeholder="#7c5a3a"
                    maxLength={7}
                    value={customColor}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCustomColor(val);
                      if (/^#[0-9a-fA-F]{6}$/.test(val)) {
                        setThemeColor(val);
                      }
                    }}
                  />
                  {themeColor && (
                    <span
                      className="size-7 shrink-0 rounded-full ring-1 ring-foreground/10"
                      style={{ backgroundColor: themeColor }}
                      title={themeColor}
                    />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Catalogue & Rating */}
          <Card>
            <CardHeader>
              <CardTitle>Catalogue & rating</CardTitle>
              <p className="text-sm text-muted-foreground">
                Classification, tax code, and perceived performance.
              </p>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select
                    value={categoryId}
                    onValueChange={(val) => {
                      if (val === "__create_new__") {
                        setNewCategoryOpen(true);
                      } else {
                        setCategoryId(val);
                      }
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select…" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.data?.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                      {(categories.data?.length ?? 0) > 0 && <SelectSeparator />}
                      <SelectItem value="__create_new__" className="text-primary font-medium">
                        + New category…
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hsn">HSN code</Label>
                  <Input
                    id="hsn"
                    value={hsnCode}
                    onChange={(e) => setHsnCode(e.target.value)}
                    placeholder="3303"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Longevity (1–10)</Label>
                <RatingButtons value={longevity} onChange={setLongevity} max={10} />
              </div>

              <div className="space-y-2">
                <Label>Sillage (1–5)</Label>
                <RatingButtons value={sillage} onChange={setSillage} />
              </div>

              <label className="flex cursor-pointer select-none items-center gap-2">
                <input
                  type="checkbox"
                  checked={isFeatured}
                  onChange={(e) => setIsFeatured(e.target.checked)}
                  className="rounded border-input"
                />
                <span className="text-sm">Feature on home page</span>
              </label>
            </CardContent>
          </Card>

          {/* Fragrance Notes */}
          <Card>
            <CardHeader>
              <CardTitle>Fragrance notes</CardTitle>
              <p className="text-sm text-muted-foreground">
                Top, heart, and base notes of the scent profile.
              </p>
            </CardHeader>
            <CardContent className="space-y-5">
              {NOTE_POSITIONS.map(({ key, label }) => {
                const posNotes = notes
                  .filter((n) => n.notePosition === key)
                  .sort((a, b) => a.sortOrder - b.sortOrder);
                const usedIds = new Set(notes.map((n) => n.noteId));
                const available = (fragranceNotes.data ?? []).filter((n) => !usedIds.has(n.id));

                return (
                  <div key={key} className="space-y-2">
                    <Label>{label}</Label>
                    <div className="flex flex-wrap gap-1.5 min-h-[2rem]">
                      {posNotes.length === 0 ? (
                        <span className="text-xs text-muted-foreground/60 italic">None added</span>
                      ) : (
                        posNotes.map((pn) => {
                          const noteName = (fragranceNotes.data ?? []).find((n) => n.id === pn.noteId)?.name ?? pn.noteId;
                          return (
                            <span
                              key={pn.noteId}
                              className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2.5 py-0.5 text-sm font-medium"
                            >
                              {noteName}
                              <button
                                type="button"
                                onClick={() =>
                                  setNotes((prev) =>
                                    prev.filter(
                                      (n) => !(n.noteId === pn.noteId && n.notePosition === key),
                                    ),
                                  )
                                }
                                className="ml-0.5 rounded-full p-0.5 hover:bg-destructive/10 hover:text-destructive transition-colors"
                              >
                                <X className="size-3" />
                              </button>
                            </span>
                          );
                        })
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Select
                        value={noteSelecting[key] ?? ""}
                        onValueChange={(v) =>
                          setNoteSelecting((prev) => ({ ...prev, [key]: v }))
                        }
                        disabled={fragranceNotes.isLoading || available.length === 0}
                      >
                        <SelectTrigger className="w-48 h-8 text-sm">
                          <SelectValue placeholder={available.length === 0 ? "All added" : "Add note…"} />
                        </SelectTrigger>
                        <SelectContent>
                          {available.map((n) => (
                            <SelectItem key={n.id} value={n.id}>
                              {n.name}
                              {n.family?.name ? (
                                <span className="ml-1 text-muted-foreground/60">· {n.family.name}</span>
                              ) : null}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!noteSelecting[key]}
                        onClick={() => {
                          const noteId = noteSelecting[key];
                          if (!noteId) return;
                          const posCount = notes.filter((n) => n.notePosition === key).length;
                          setNotes((prev) => [
                            ...prev,
                            { noteId, notePosition: key, sortOrder: posCount },
                          ]);
                          setNoteSelecting((prev) => ({ ...prev, [key]: "" }));
                        }}
                      >
                        Add
                      </Button>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT */}
        <div className="sticky top-20 space-y-4">
          {/* Storefront preview */}
          <StorefrontPreview
            name={name}
            slug={slug}
            themeColor={themeColor}
            description={description}
            imageUrl={previewImageUrl}
            notes={notes}
            noteNames={noteNames}
            longevity={longevity}
            sillage={sillage}
            categoryName={previewCategoryName}
          />

          {/* Images */}
          <Card>
            <CardHeader>
              <CardTitle>Images</CardTitle>
            </CardHeader>
            <CardContent>
              <ImageDropzone images={images} onChange={setImages} />
            </CardContent>
          </Card>

          {/* Status */}
          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(["draft", "active"] as const).map((s) => (
                <label
                  key={s}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
                    status === s ? "border-primary bg-primary/5" : "hover:bg-muted/50",
                  )}
                >
                  <input
                    type="radio"
                    name="status"
                    value={s}
                    checked={status === s}
                    onChange={() => setStatus(s)}
                    className="mt-0.5"
                  />
                  <div>
                    <p className="text-sm font-medium">{s === "draft" ? "Draft" : "Active"}</p>
                    <p className="text-xs text-muted-foreground">
                      {s === "draft"
                        ? "Saved but not visible to customers."
                        : "Live on the storefront immediately."}
                    </p>
                  </div>
                </label>
              ))}
            </CardContent>
          </Card>

          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "Creating…" : "Create product"}
          </Button>
        </div>
      </div>

      <Dialog open={newCategoryOpen} onOpenChange={setNewCategoryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New category</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="new-cat-name">Name</Label>
            <Input
              id="new-cat-name"
              placeholder="e.g. For Her"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const n = newCategoryName.trim();
                  if (n) createCategory.mutate({ name: n, slug: slugify(n) });
                }
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              disabled={!newCategoryName.trim() || createCategory.isPending}
              onClick={() => {
                const n = newCategoryName.trim();
                if (n) createCategory.mutate({ name: n, slug: slugify(n) });
              }}
            >
              {createCategory.isPending ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
}

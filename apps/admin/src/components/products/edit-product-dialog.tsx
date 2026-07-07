"use client";

import { type FormEvent, useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";

import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";

// ─── constants ────────────────────────────────────────────────────────────────

const STATUSES = ["draft", "active", "archived"] as const;
const STATUS_LABELS: Record<string, string> = {
  draft: "Draft — not visible to customers",
  active: "Active — live on storefront",
  archived: "Archived — hidden",
};

const THEME_PRESETS = ["#f5e6c8", "#8b5e3c", "#4a6741", "#b07070", "#2f4538", "#7a6240"];

const NOTE_POSITIONS = [
  { key: "top" as const, label: "Top Notes" },
  { key: "mid" as const, label: "Heart Notes" },
  { key: "base" as const, label: "Base Notes" },
];

// ─── sub-components ───────────────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-field-label font-semibold uppercase tracking-[0.06em] text-muted-foreground">
      {children}
    </p>
  );
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
            "size-9 rounded-full border text-body-sm font-medium transition-colors",
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

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/60">
        {children}
      </span>
      <div className="flex-1 border-t border-border/60" />
    </div>
  );
}

// ─── types ────────────────────────────────────────────────────────────────────

type NoteEntry = { noteId: string; notePosition: "top" | "mid" | "base"; sortOrder: number };

type Product = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  categoryId: string;
  themeColor: string | null;
  hsnCode: string | null;
  status: "draft" | "active" | "archived";
  isFeatured: boolean;
  longevityRating?: number | null;
  sillageRating?: number | null;
  notes?: Array<{
    id: string;
    noteId: string;
    notePosition: "top" | "mid" | "base";
    sortOrder: number;
    note: { id: string; name: string };
  }>;
};

// ─── form ─────────────────────────────────────────────────────────────────────

function EditProductForm({ product, onDone }: { product: Product; onDone: () => void }) {
  const utils = trpc.useUtils();
  const categories = trpc.catalog.listCategories.useQuery();
  const fragranceNotes = trpc.catalog.listNotes.useQuery();

  const [name, setName] = useState(product.name);
  const [slug, setSlug] = useState(product.slug);
  const [description, setDescription] = useState(product.description ?? "");
  const [categoryId, setCategoryId] = useState(product.categoryId);
  const [themeColor, setThemeColor] = useState(product.themeColor ?? THEME_PRESETS[0]);
  const [customColor, setCustomColor] = useState(
    product.themeColor && !THEME_PRESETS.includes(product.themeColor) ? product.themeColor : "",
  );
  const [hsnCode, setHsnCode] = useState(product.hsnCode ?? "");
  const [status, setStatus] = useState(product.status);
  const [isFeatured, setIsFeatured] = useState(product.isFeatured);
  const [longevity, setLongevity] = useState<number | null>(product.longevityRating ?? null);
  const [sillage, setSillage] = useState<number | null>(product.sillageRating ?? null);
  const [notes, setNotes] = useState<NoteEntry[]>(
    (product.notes ?? []).map((n) => ({
      noteId: n.noteId,
      notePosition: n.notePosition,
      sortOrder: n.sortOrder,
    })),
  );
  const [noteSelecting, setNoteSelecting] = useState<Record<string, string>>({});

  const updateProduct = trpc.catalog.updateProduct.useMutation({
    onSuccess: async () => {
      await utils.catalog.getProduct.invalidate({ id: product.id });
      await utils.catalog.listProducts.invalidate();
      toast.success("Product updated");
      onDone();
    },
    onError: (err) => toast.error(err.message),
  });

  function addNote(position: "top" | "mid" | "base") {
    const noteId = noteSelecting[position];
    if (!noteId) return;
    if (notes.some((n) => n.noteId === noteId && n.notePosition === position)) return;
    const posCount = notes.filter((n) => n.notePosition === position).length;
    setNotes((prev) => [...prev, { noteId, notePosition: position, sortOrder: posCount }]);
    setNoteSelecting((prev) => ({ ...prev, [position]: "" }));
  }

  function removeNote(noteId: string, position: "top" | "mid" | "base") {
    setNotes((prev) => prev.filter((n) => !(n.noteId === noteId && n.notePosition === position)));
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    updateProduct.mutate({
      id: product.id,
      name,
      slug,
      description: description || undefined,
      categoryId,
      themeColor,
      hsnCode: hsnCode || undefined,
      status,
      isFeatured,
      longevityRating: longevity ?? undefined,
      sillageRating: sillage ?? undefined,
      notes,
    });
  }

  const allNotes = fragranceNotes.data ?? [];
  const usedNoteIds = new Set(notes.map((n) => n.noteId));

  return (
    <form onSubmit={onSubmit} className="flex-1 flex flex-col min-h-0">
      {/* scrollable body */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

        {/* ── Identity ── */}
        <SectionHeading>Identity</SectionHeading>

        <div className="space-y-1.5">
          <FieldLabel>Name</FieldLabel>
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </div>

        <div className="space-y-1.5">
          <FieldLabel>Slug</FieldLabel>
          <Input value={slug} onChange={(e) => setSlug(e.target.value)} required className="font-mono text-body-sm" />
        </div>

        <div className="space-y-1.5">
          <FieldLabel>Description</FieldLabel>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Scent story shown on the storefront card."
          />
        </div>

        {/* ── Character ── */}
        <SectionHeading>Character</SectionHeading>

        <div className="space-y-1.5">
          <FieldLabel>Theme color</FieldLabel>
          <div className="flex items-center flex-wrap gap-2">
            {THEME_PRESETS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => { setThemeColor(color); setCustomColor(""); }}
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
                if (/^#[0-9a-fA-F]{6}$/.test(val)) setThemeColor(val);
              }}
            />
            <span
              className="size-7 shrink-0 rounded-full ring-1 ring-foreground/10"
              style={{ backgroundColor: themeColor }}
            />
          </div>
        </div>

        {/* ── Catalogue ── */}
        <SectionHeading>Catalogue</SectionHeading>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <FieldLabel>Category</FieldLabel>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {categories.data?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <FieldLabel>HSN code</FieldLabel>
            <Input value={hsnCode} onChange={(e) => setHsnCode(e.target.value)} placeholder="3303" />
          </div>
        </div>

        <div className="space-y-1.5">
          <FieldLabel>Status</FieldLabel>
          <div className="flex flex-col gap-2">
            {STATUSES.map((s) => (
              <label
                key={s}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-2.5 transition-colors",
                  status === s ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40",
                )}
              >
                <input
                  type="radio"
                  name="edit-status"
                  value={s}
                  checked={status === s}
                  onChange={() => setStatus(s)}
                  className="accent-primary"
                />
                <span className="text-body-sm font-medium capitalize">{s}</span>
                <span className="ml-auto text-caption text-muted-foreground">{STATUS_LABELS[s]}</span>
              </label>
            ))}
          </div>
        </div>

        {/* ── Performance ── */}
        <SectionHeading>Performance</SectionHeading>

        <div className="space-y-1.5">
          <FieldLabel>Longevity (1–10)</FieldLabel>
          <RatingButtons value={longevity} onChange={setLongevity} max={10} />
        </div>

        <div className="space-y-1.5">
          <FieldLabel>Sillage (1–5)</FieldLabel>
          <RatingButtons value={sillage} onChange={setSillage} />
        </div>

        {/* ── Fragrance Notes ── */}
        <SectionHeading>Fragrance Notes</SectionHeading>

        {NOTE_POSITIONS.map(({ key, label }) => {
          const posNotes = notes
            .filter((n) => n.notePosition === key)
            .sort((a, b) => a.sortOrder - b.sortOrder);
          const available = allNotes.filter((n) => !usedNoteIds.has(n.id));

          return (
            <div key={key} className="space-y-2">
              <FieldLabel>{label}</FieldLabel>
              <div className="flex flex-wrap gap-1.5 min-h-[2rem]">
                {posNotes.length === 0 ? (
                  <span className="text-caption text-muted-foreground/60 italic">None added</span>
                ) : (
                  posNotes.map((pn) => {
                    const name = allNotes.find((n) => n.id === pn.noteId)?.name ?? pn.noteId;
                    return (
                      <span
                        key={pn.noteId}
                        className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2.5 py-0.5 text-body-sm font-medium"
                      >
                        {name}
                        <button
                          type="button"
                          onClick={() => removeNote(pn.noteId, key)}
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
                  onValueChange={(v) => setNoteSelecting((prev) => ({ ...prev, [key]: v }))}
                  disabled={fragranceNotes.isLoading || available.length === 0}
                >
                  <SelectTrigger className="w-48 h-8 text-body-sm">
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
                  onClick={() => addNote(key)}
                >
                  Add
                </Button>
              </div>
            </div>
          );
        })}

        {/* ── Visibility ── */}
        <SectionHeading>Visibility</SectionHeading>

        <label className="flex cursor-pointer items-center gap-2.5">
          <Checkbox
            checked={isFeatured}
            onCheckedChange={(v) => setIsFeatured(!!v)}
            id="edit-featured"
          />
          <span className="text-body-sm font-medium">Feature on home page</span>
        </label>
      </div>

      {/* sticky footer */}
      <div className="shrink-0 border-t border-border px-6 py-4 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>Cancel</Button>
        <Button type="submit" disabled={updateProduct.isPending}>
          {updateProduct.isPending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

// ─── exported trigger ─────────────────────────────────────────────────────────

export function EditProductDialog({ product }: { product: Product }) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          Edit details
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-[540px] sm:max-w-none p-0 flex flex-col gap-0"
        showCloseButton={false}
      >
        <SheetHeader className="shrink-0 border-b border-border px-6 py-4">
          <SheetTitle className="text-card-header font-semibold">Edit product</SheetTitle>
          <p className="text-caption text-muted-foreground">{product.name}</p>
        </SheetHeader>
        {open && <EditProductForm product={product} onDone={() => setOpen(false)} />}
      </SheetContent>
    </Sheet>
  );
}

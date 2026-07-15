"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";

type ProductNote = {
  id: string;
  notePosition: "top" | "mid" | "base";
  sortOrder: number;
  note: { id: string; name: string };
};

interface Props {
  productId: string;
  notes: ProductNote[];
}

type Position = "top" | "mid" | "base";

const POSITIONS: { key: Position; label: string; hint: string }[] = [
  { key: "top", label: "Top", hint: "first impression" },
  { key: "mid", label: "Heart", hint: "the core" },
  { key: "base", label: "Base", hint: "the dry-down" },
];

const POS_STYLE: Record<Position, string> = {
  top: "bg-amber-500",
  mid: "bg-rose-500",
  base: "bg-stone-500",
};

export function ProductNotesCard({ productId, notes }: Props) {
  const utils = trpc.useUtils();
  const allNotes = trpc.catalog.listNotes.useQuery();

  const addNote = trpc.catalog.addProductNote.useMutation({
    onSuccess: () => utils.catalog.getProduct.invalidate({ id: productId }),
  });
  const removeNote = trpc.catalog.removeProductNote.useMutation({
    onSuccess: () => utils.catalog.getProduct.invalidate({ id: productId }),
  });

  const [query, setQuery] = useState("");

  const notesByPosition = (pos: Position) =>
    notes.filter((n) => n.notePosition === pos).sort((a, b) => a.sortOrder - b.sortOrder);

  const usedNoteIds = useMemo(() => new Set(notes.map((n) => n.note.id)), [notes]);

  // Available notes (not yet assigned to any position), filtered by search, grouped by family
  const availableByFamily = useMemo(() => {
    const q = query.trim().toLowerCase();
    const available = (allNotes.data ?? []).filter(
      (n) => !usedNoteIds.has(n.id) && (!q || n.name.toLowerCase().includes(q)),
    );
    const groups = new Map<string, typeof available>();
    for (const n of available) {
      const fam = n.family?.name ?? "Other";
      const arr = groups.get(fam) ?? [];
      arr.push(n);
      groups.set(fam, arr);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [allNotes.data, usedNoteIds, query]);

  function assign(noteId: string, position: Position) {
    addNote.mutate({ productId, noteId, notePosition: position, sortOrder: notesByPosition(position).length });
  }

  const totalAssigned = notes.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fragrance Notes</CardTitle>
        <p className="text-body-sm text-muted-foreground mt-0.5">
          Assign notes to each layer. Search below, then tap a layer button to place a note.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Assigned notes by layer */}
        <div className="grid gap-3 sm:grid-cols-3">
          {POSITIONS.map(({ key, label, hint }) => {
            const posNotes = notesByPosition(key);
            return (
              <div key={key} className="rounded-lg border border-border p-3">
                <div className="flex items-center gap-2 mb-2.5">
                  <span className={cn("size-2 rounded-full", POS_STYLE[key])} />
                  <span className="text-field-label font-semibold uppercase tracking-[0.06em]">{label}</span>
                  <span className="text-[11px] text-muted-foreground/60">{hint}</span>
                  <span className="ml-auto text-[11px] text-muted-foreground/60 tabular-nums">{posNotes.length}</span>
                </div>
                <div className="flex flex-wrap gap-1.5 min-h-[1.75rem]">
                  {posNotes.length === 0 ? (
                    <span className="text-body-sm text-muted-foreground/50 italic">No notes yet</span>
                  ) : (
                    posNotes.map((pn) => (
                      <span
                        key={pn.id}
                        className="group inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2.5 py-1 text-body-sm font-medium"
                      >
                        {pn.note.name}
                        <button
                          type="button"
                          onClick={() => removeNote.mutate({ id: pn.id })}
                          disabled={removeNote.isPending}
                          className="rounded-full p-0.5 text-muted-foreground/50 hover:bg-destructive/10 hover:text-destructive transition-colors"
                          aria-label={`Remove ${pn.note.name}`}
                        >
                          <X className="size-3" />
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Note palette */}
        <div className="rounded-lg border border-border">
          <div className="relative border-b border-border/60">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/50" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search notes to add…"
              className="pl-9 border-0 focus-visible:ring-0 rounded-b-none"
            />
          </div>

          <div className="p-3 max-h-72 overflow-y-auto space-y-4">
            {allNotes.isLoading ? (
              <p className="text-body-sm text-muted-foreground py-4 text-center">Loading notes…</p>
            ) : availableByFamily.length === 0 ? (
              <p className="text-body-sm text-muted-foreground py-4 text-center">
                {query ? `No unused notes match “${query}”.` : "All notes are assigned. Add more in the Notes library."}
              </p>
            ) : (
              availableByFamily.map(([family, familyNotes]) => (
                <div key={family}>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/60 mb-1.5">
                    {family}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {familyNotes.map((n) => (
                      <span
                        key={n.id}
                        className="group inline-flex items-center rounded-md border border-border overflow-hidden"
                      >
                        <span className="px-2.5 py-1 text-body-sm font-medium">{n.name}</span>
                        {/* Layer assign buttons — appear as a compact segmented control */}
                        <span className="flex border-l border-border">
                          {POSITIONS.map(({ key, label }) => (
                            <button
                              key={key}
                              type="button"
                              disabled={addNote.isPending}
                              onClick={() => assign(n.id, key)}
                              title={`Add to ${label}`}
                              className="px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground hover:bg-foreground hover:text-background transition-colors border-l border-border first:border-l-0"
                            >
                              {label[0]}
                            </button>
                          ))}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground/60">
          {totalAssigned} note{totalAssigned === 1 ? "" : "s"} on this product · Changes save immediately.
        </p>
      </CardContent>
    </Card>
  );
}

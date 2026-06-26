"use client";

import { useState } from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

const POSITIONS = [
  { key: "top" as const, label: "Top Notes" },
  { key: "mid" as const, label: "Heart Notes" },
  { key: "base" as const, label: "Base Notes" },
];

export function ProductNotesCard({ productId, notes }: Props) {
  const utils = trpc.useUtils();
  const allNotes = trpc.catalog.listNotes.useQuery();

  const addNote = trpc.catalog.addProductNote.useMutation({
    onSuccess: () => utils.catalog.getProduct.invalidate({ id: productId }),
  });

  const removeNote = trpc.catalog.removeProductNote.useMutation({
    onSuccess: () => utils.catalog.getProduct.invalidate({ id: productId }),
  });

  const [selecting, setSelecting] = useState<Record<string, string>>({});

  const notesByPosition = (pos: "top" | "mid" | "base") =>
    notes.filter((n) => n.notePosition === pos).sort((a, b) => a.sortOrder - b.sortOrder);

  const usedNoteIds = new Set(notes.map((n) => n.note.id));

  function handleAdd(position: "top" | "mid" | "base") {
    const noteId = selecting[position];
    if (!noteId) return;

    addNote.mutate(
      { productId, noteId, notePosition: position, sortOrder: notesByPosition(position).length },
      {
        onSuccess: () => setSelecting((prev) => ({ ...prev, [position]: "" })),
      },
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fragrance Notes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {POSITIONS.map(({ key, label }) => {
          const posNotes = notesByPosition(key);
          const available = (allNotes.data ?? []).filter((n) => !usedNoteIds.has(n.id));

          return (
            <div key={key} className="space-y-2">
              <p className="text-field-label font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                {label}
              </p>

              <div className="flex flex-wrap gap-2 min-h-[2rem]">
                {posNotes.length === 0 && (
                  <span className="text-body-sm text-muted-foreground/60 italic">None added</span>
                )}
                {posNotes.map((pn) => (
                  <span
                    key={pn.id}
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-3 py-1 text-body-sm font-medium"
                  >
                    {pn.note.name}
                    <button
                      type="button"
                      onClick={() => removeNote.mutate({ id: pn.id })}
                      disabled={removeNote.isPending}
                      className="ml-0.5 rounded-full p-0.5 hover:bg-destructive/10 hover:text-destructive transition-colors"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>

              <div className="flex gap-2">
                <Select
                  value={selecting[key] ?? ""}
                  onValueChange={(v) => setSelecting((prev) => ({ ...prev, [key]: v }))}
                  disabled={allNotes.isLoading || available.length === 0}
                >
                  <SelectTrigger className="w-52">
                    <SelectValue placeholder={available.length === 0 ? "No notes available" : "Add note…"} />
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
                  variant="outline"
                  size="sm"
                  onClick={() => handleAdd(key)}
                  disabled={!selecting[key] || addNote.isPending}
                >
                  Add
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

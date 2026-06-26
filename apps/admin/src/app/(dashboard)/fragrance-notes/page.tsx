"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc";

const SEED_NOTES: Record<string, string[]> = {
  Citrus:   ["Bergamot", "Lemon", "Grapefruit", "Orange", "Mandarin"],
  Floral:   ["Rose", "Jasmine", "Ylang-ylang", "Iris", "Violet"],
  Woody:    ["Sandalwood", "Cedarwood", "Vetiver", "Patchouli"],
  Oriental: ["Oud", "Ambergris", "Musk", "Vanilla", "Benzoin"],
  Spicy:    ["Cardamom", "Black Pepper", "Saffron", "Cinnamon", "Clove"],
  Fresh:    ["Aquatic", "Green Tea", "Mint", "Aldehydes"],
};

export default function FragranceNotesPage() {
  const utils = trpc.useUtils();
  const notes = trpc.catalog.listNotes.useQuery();

  const [name, setName] = useState("");

  const createNote = trpc.catalog.createNote.useMutation({
    onSuccess: (n) => {
      toast.success(`"${n.name}" added`);
      setName("");
      utils.catalog.listNotes.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  function addNote(noteName: string) {
    const trimmed = noteName.trim();
    if (!trimmed || createNote.isPending) return;
    createNote.mutate({ name: trimmed });
  }

  const existingNames = new Set((notes.data ?? []).map((n) => n.name.toLowerCase()));

  const byFamily = (notes.data ?? []).reduce<Record<string, NonNullable<typeof notes.data>>>((acc, n) => {
    const key = n.family?.name ?? "Uncategorised";
    (acc[key] ??= []).push(n);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-title font-semibold">Fragrance Notes</h1>
        <p className="mt-1 text-body-sm text-muted-foreground">
          Build the note library used when composing product scent profiles.
          Once notes are added here, they appear in the "Top / Heart / Base" selectors on each product.
        </p>
      </div>

      {/* Add form */}
      <Card>
        <CardHeader>
          <CardTitle>Add a note</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => { e.preventDefault(); addNote(name); }}
            className="flex items-end gap-3"
          >
            <div className="flex-1 space-y-1.5">
              <Label className="text-field-label font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                Note name
              </Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Bergamot, Oud, Jasmine…"
              />
            </div>
            <Button type="submit" disabled={!name.trim() || createNote.isPending}>
              <Plus className="size-4 mr-1.5" />
              {createNote.isPending ? "Adding…" : "Add note"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Quick-seed panel — shown until library has notes */}
      <Card>
        <CardHeader>
          <CardTitle>Quick-add common notes</CardTitle>
          <p className="text-body-sm text-muted-foreground mt-0.5">
            Click any note to add it instantly. Already-added notes are greyed out.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-3">
            {Object.entries(SEED_NOTES).map(([family, examples]) => (
              <div key={family}>
                <p className="text-field-label font-semibold uppercase tracking-[0.06em] text-muted-foreground mb-2">
                  {family}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {examples.map((ex) => {
                    const exists = existingNames.has(ex.toLowerCase());
                    return (
                      <button
                        key={ex}
                        type="button"
                        disabled={exists || createNote.isPending}
                        onClick={() => addNote(ex)}
                        className={
                          exists
                            ? "rounded border border-border bg-muted px-2.5 py-0.5 text-body-sm text-muted-foreground/40 cursor-default"
                            : "rounded border border-border px-2.5 py-0.5 text-body-sm transition-colors hover:bg-primary/10 hover:text-primary hover:border-primary/40 cursor-pointer"
                        }
                      >
                        {exists ? "✓ " : "+ "}{ex}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Notes table */}
      <Card>
        <CardHeader>
          <CardTitle>
            Library
            {(notes.data?.length ?? 0) > 0 && (
              <Badge variant="secondary" className="ml-2 font-mono text-[11px]">
                {notes.data?.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {notes.isLoading && (
            <p className="px-6 py-4 text-body-sm text-muted-foreground">Loading…</p>
          )}
          {!notes.isLoading && (notes.data?.length ?? 0) === 0 && (
            <p className="px-6 py-8 text-center text-body-sm text-muted-foreground">
              No notes yet — add some above to get started.
            </p>
          )}
          {(notes.data?.length ?? 0) > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Name</TableHead>
                  <TableHead>Family</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(byFamily)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .flatMap(([family, familyNotes]) =>
                    (familyNotes ?? []).map((n, idx) => (
                      <TableRow key={n.id}>
                        <TableCell className="pl-6 font-medium">{n.name}</TableCell>
                        <TableCell>
                          {idx === 0 && (
                            <Badge variant="outline" className="text-[11px]">{family}</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

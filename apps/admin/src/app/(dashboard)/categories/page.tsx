"use client";

import { type FormEvent, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

type Category = {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
};

function NewCategoryDialog() {
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [sortOrder, setSortOrder] = useState("0");

  const createCategory = trpc.catalog.createCategory.useMutation({
    onSuccess: async () => {
      await utils.catalog.listCategoriesWithCount.invalidate();
      toast.success("Category created");
      setOpen(false);
      setName("");
      setSlug("");
      setSlugEdited(false);
      setSortOrder("0");
    },
    onError: (err) => toast.error(err.message),
  });

  function onNameChange(value: string) {
    setName(value);
    if (!slugEdited) setSlug(slugify(value));
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    createCategory.mutate({ name, slug, sortOrder: Number(sortOrder) });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>+ New category</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New category</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-cat-name">Name</Label>
            <Input id="new-cat-name" value={name} onChange={(e) => onNameChange(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-cat-slug">Slug</Label>
            <Input
              id="new-cat-slug"
              value={slug}
              onChange={(e) => { setSlugEdited(true); setSlug(e.target.value); }}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-cat-sort">Sort order</Label>
            <Input
              id="new-cat-sort"
              type="number"
              min={0}
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={createCategory.isPending}>
              {createCategory.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditCategoryForm({ category, onDone }: { category: Category; onDone: () => void }) {
  const utils = trpc.useUtils();
  const [name, setName] = useState(category.name);
  const [slug, setSlug] = useState(category.slug);
  const [sortOrder, setSortOrder] = useState(String(category.sortOrder));

  const updateCategory = trpc.catalog.updateCategory.useMutation({
    onSuccess: async () => {
      await utils.catalog.listCategoriesWithCount.invalidate();
      toast.success("Category updated");
      onDone();
    },
    onError: (err) => toast.error(err.message),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    updateCategory.mutate({ id: category.id, name, slug, sortOrder: Number(sortOrder) });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="edit-cat-name">Name</Label>
        <Input id="edit-cat-name" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="edit-cat-slug">Slug</Label>
        <Input id="edit-cat-slug" value={slug} onChange={(e) => setSlug(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="edit-cat-sort">Sort order</Label>
        <Input
          id="edit-cat-sort"
          type="number"
          min={0}
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
        />
      </div>
      <DialogFooter>
        <Button type="submit" disabled={updateCategory.isPending}>
          {updateCategory.isPending ? "Saving..." : "Save changes"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function EditCategoryDialog({
  category,
  open,
  onOpenChange,
}: {
  category: Category;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit category</DialogTitle>
        </DialogHeader>
        {open && <EditCategoryForm category={category} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

export default function CategoriesPage() {
  const utils = trpc.useUtils();
  const categories = trpc.catalog.listCategoriesWithCount.useQuery();
  const [editId, setEditId] = useState<string | null>(null);

  const deleteCategory = trpc.catalog.deleteCategory.useMutation({
    onSuccess: async () => {
      await utils.catalog.listCategoriesWithCount.invalidate();
      toast.success("Category deleted");
    },
    onError: (err) => toast.error(err.message),
  });

  const editing = categories.data?.find((c) => c.id === editId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-title font-semibold">Categories</h1>
          <p className="text-sm text-muted-foreground">Organise the catalogue.</p>
        </div>
        <NewCategoryDialog />
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Products</TableHead>
              <TableHead>Sort order</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-6">Loading…</TableCell>
              </TableRow>
            )}
            {!categories.isLoading && categories.data?.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-6">No categories yet.</TableCell>
              </TableRow>
            )}
            {categories.data?.map((category) => (
              <TableRow
                key={category.id}
                className="cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => {}}
              >
                <TableCell>
                  <Link
                    href={`/categories/${category.id}`}
                    className="font-semibold hover:text-primary flex items-center gap-1.5 group"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {category.name}
                    <ChevronRight className="size-3.5 opacity-0 group-hover:opacity-60 transition-opacity" />
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground font-mono text-[12px]">{category.slug}</TableCell>
                <TableCell>
                  <Badge variant={category.productCount > 0 ? "secondary" : "outline"} className="tabular-nums">
                    {category.productCount} product{category.productCount !== 1 ? "s" : ""}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{category.sortOrder}</TableCell>
                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => setEditId(category.id)}>
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={deleteCategory.isPending}
                      onClick={() => deleteCategory.mutate({ id: category.id })}
                    >
                      Delete
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {editing && (
        <EditCategoryDialog
          category={editing}
          open={editId === editing.id}
          onOpenChange={(open) => setEditId(open ? editing.id : null)}
        />
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Calendar, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { trpc } from "@/lib/trpc";

// ─── helpers ─────────────────────────────────────────────────────────────────

function formatValue(type: string, value: string | number) {
  const n = Number(value);
  return type === "percentage" ? `${n}%` : `₹${n.toFixed(2)}`;
}

function fmt(d: Date | string) {
  return format(new Date(d), "dd MMM yyyy");
}

// ─── Create / Edit dialog ─────────────────────────────────────────────────────

type DiscountForm = {
  name: string;
  type: "percentage" | "flat";
  value: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
};

const EMPTY_FORM: DiscountForm = {
  name: "",
  type: "percentage",
  value: "",
  startsAt: "",
  endsAt: "",
  isActive: true,
};

function toDateInput(d: Date | string | undefined | null) {
  if (!d) return "";
  return format(new Date(d), "yyyy-MM-dd");
}

interface UpsertDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  existing?: {
    id: string;
    name: string;
    type: "percentage" | "flat";
    value: string | number;
    startsAt: Date | string;
    endsAt?: Date | string | null;
    isActive: boolean;
  };
  onDone: () => void;
}

function UpsertDiscountDialog({ open, onOpenChange, existing, onDone }: UpsertDialogProps) {
  const [form, setForm] = useState<DiscountForm>(() =>
    existing
      ? {
          name: existing.name,
          type: existing.type,
          value: String(existing.value),
          startsAt: toDateInput(existing.startsAt),
          endsAt: toDateInput(existing.endsAt),
          isActive: existing.isActive,
        }
      : EMPTY_FORM,
  );

  const create = trpc.discount.create.useMutation({ onSuccess: onDone });
  const update = trpc.discount.update.useMutation({ onSuccess: onDone });
  const isPending = create.isPending || update.isPending;

  function set<K extends keyof DiscountForm>(k: K, v: DiscountForm[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  function handleSubmit() {
    const payload = {
      name: form.name.trim(),
      type: form.type,
      value: Number(form.value),
      startsAt: new Date(form.startsAt),
      endsAt: form.endsAt ? new Date(form.endsAt) : undefined,
      isActive: form.isActive,
    };
    if (!payload.name || !payload.value || !form.startsAt) {
      toast.error("Name, value, and start date are required");
      return;
    }
    if (existing) {
      update.mutate({ id: existing.id, ...payload });
    } else {
      create.mutate(payload);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit Discount" : "New Discount"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-field-label font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              Name
            </Label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Summer Sale" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-field-label font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                Type
              </Label>
              <Select value={form.type} onValueChange={(v) => set("type", v as "percentage" | "flat")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentage (%)</SelectItem>
                  <SelectItem value="flat">Flat (₹)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-field-label font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                Value
              </Label>
              <Input
                type="number" min="0" step="0.01" value={form.value}
                onChange={(e) => set("value", e.target.value)}
                placeholder={form.type === "percentage" ? "10" : "500"}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-field-label font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                Starts
              </Label>
              <Input type="date" value={form.startsAt} onChange={(e) => set("startsAt", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-field-label font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                Ends (optional)
              </Label>
              <Input type="date" value={form.endsAt} onChange={(e) => set("endsAt", e.target.value)} />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox id="isActive" checked={form.isActive} onCheckedChange={(v) => set("isActive", !!v)} />
            <Label htmlFor="isActive" className="text-body-sm cursor-pointer">Active</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {existing ? "Save changes" : "Create discount"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DiscountsPage() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const discounts = trpc.discount.list.useQuery({});

  const deleteDiscount = trpc.discount.delete.useMutation({
    onSuccess: () => utils.discount.list.invalidate(),
    onError: (err) => toast.error(err.message),
  });

  type DiscountRow = NonNullable<typeof discounts.data>[number];

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<DiscountRow | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-title font-semibold">Discounts</h1>
          <p className="mt-0.5 text-body-sm text-muted-foreground">
            Create discount periods and apply them to active products.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4 mr-1.5" />
          New discount
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All discounts</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {discounts.isLoading ? (
            <p className="px-6 text-body-sm text-muted-foreground">Loading…</p>
          ) : !discounts.data?.length ? (
            <p className="px-6 py-8 text-center text-body-sm text-muted-foreground">
              No discounts yet. Create one to get started.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Products</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {discounts.data.map((d) => (
                  <TableRow
                    key={d.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/discounts/${d.id}`)}
                  >
                    <TableCell className="font-medium">{d.name}</TableCell>
                    <TableCell className="capitalize">{d.type}</TableCell>
                    <TableCell className="font-semibold text-primary">
                      {formatValue(d.type, d.value)}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1 text-body-sm">
                        <Calendar className="size-3 text-muted-foreground" />
                        {fmt(d.startsAt)}
                        {d.endsAt ? ` → ${fmt(d.endsAt)}` : " → ongoing"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={d.isActive ? "default" : "secondary"}>
                        {d.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className={`size-1.5 rounded-full ${d.products.length > 0 ? "bg-primary" : "bg-muted-foreground/30"}`}
                        />
                        {d.products.length}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button size="icon" variant="ghost" onClick={() => setEditTarget(d)}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => {
                            if (confirm(`Delete "${d.name}"?`)) {
                              deleteDiscount.mutate({ id: d.id });
                            }
                          }}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                        <ChevronRight className="size-4 text-muted-foreground/50 ml-1" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <UpsertDiscountDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onDone={() => {
          setCreateOpen(false);
          utils.discount.list.invalidate();
        }}
      />

      {editTarget && (
        <UpsertDiscountDialog
          open
          onOpenChange={(v) => !v && setEditTarget(null)}
          existing={editTarget}
          onDone={() => {
            setEditTarget(null);
            utils.discount.list.invalidate();
          }}
        />
      )}
    </div>
  );
}

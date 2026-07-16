"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { formatInr } from "@/lib/format";
import { trpc } from "@/lib/trpc";

// ─── helpers ─────────────────────────────────────────────────────────────────

function toDateInput(d: Date | string | undefined | null) {
  if (!d) return "";
  return format(new Date(d), "yyyy-MM-dd");
}

function fmt(d: Date | string) {
  return format(new Date(d), "dd MMM yyyy");
}

function formatValue(type: string, value: string | number) {
  const n = Number(value);
  return type === "percentage" ? `${n}%` : formatInr(n);
}

// ─── Form type ────────────────────────────────────────────────────────────────

type CouponForm = {
  code: string;
  description: string;
  type: "percentage" | "flat";
  paymentMethod: "any" | "razorpay" | "wallet";
  value: string;
  minCartValue: string;
  maxDiscount: string;
  usageLimit: string;
  usageLimitPerUser: string;
  isActive: boolean;
  startsAt: string;
  endsAt: string;
};

const EMPTY_FORM: CouponForm = {
  code: "",
  description: "",
  type: "flat",
  paymentMethod: "any",
  value: "",
  minCartValue: "0",
  maxDiscount: "",
  usageLimit: "",
  usageLimitPerUser: "",
  isActive: true,
  startsAt: toDateInput(new Date()),
  endsAt: "",
};

// ─── Coupon dialog ────────────────────────────────────────────────────────────

interface CouponDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: CouponForm;
  title: string;
  onSubmit: (form: CouponForm) => void;
  isPending: boolean;
}

function CouponDialog({ open, onOpenChange, initial, title, onSubmit, isPending }: CouponDialogProps) {
  const [form, setForm] = useState<CouponForm>(initial ?? EMPTY_FORM);

  function set<K extends keyof CouponForm>(k: K, v: CouponForm[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  function handleSubmit() {
    if (!form.code.trim() || !form.value || !form.startsAt) {
      toast.error("Code, value, and start date are required");
      return;
    }
    onSubmit(form);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Code + description */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-field-label font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                Code
              </Label>
              <Input
                value={form.code}
                onChange={(e) => set("code", e.target.value.toUpperCase())}
                placeholder="SAVE200"
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-field-label font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                Type
              </Label>
              <Select value={form.type} onValueChange={(v) => set("type", v as "percentage" | "flat")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="flat">Flat (₹ off)</SelectItem>
                  <SelectItem value="percentage">Percentage (% off)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-field-label font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              Description (shown to customers)
            </Label>
            <Input
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="₹200 off on orders above ₹1,600"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-field-label font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              Valid for payment method
            </Label>
            <Select value={form.paymentMethod} onValueChange={(v) => set("paymentMethod", v as CouponForm["paymentMethod"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any method</SelectItem>
                <SelectItem value="razorpay">Bank / card only</SelectItem>
                <SelectItem value="wallet">Wallet only</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground/60">
              Restrict the coupon so it only applies when the customer pays this way.
            </p>
          </div>

          {/* Value + min cart */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-field-label font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                {form.type === "percentage" ? "Discount %" : "Discount ₹"}
              </Label>
              <Input
                type="number" min="0" step={form.type === "percentage" ? "1" : "10"}
                value={form.value}
                onChange={(e) => set("value", e.target.value)}
                placeholder={form.type === "percentage" ? "10" : "200"}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-field-label font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                Min cart value (₹)
              </Label>
              <Input
                type="number" min="0" step="100"
                value={form.minCartValue}
                onChange={(e) => set("minCartValue", e.target.value)}
                placeholder="1600"
              />
            </div>
          </div>

          {/* Max discount cap (% only) */}
          {form.type === "percentage" && (
            <div className="space-y-1.5">
              <Label className="text-field-label font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                Max discount cap (₹)
              </Label>
              <Input
                type="number" min="0" step="50"
                value={form.maxDiscount}
                onChange={(e) => set("maxDiscount", e.target.value)}
                placeholder="500 (optional)"
              />
            </div>
          )}

          {/* Usage limits */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-field-label font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                Total uses (global)
              </Label>
              <Input
                type="number" min="1" step="1"
                value={form.usageLimit}
                onChange={(e) => set("usageLimit", e.target.value)}
                placeholder="unlimited"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-field-label font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                Uses per customer
              </Label>
              <Input
                type="number" min="1" step="1"
                value={form.usageLimitPerUser}
                onChange={(e) => set("usageLimitPerUser", e.target.value)}
                placeholder="unlimited"
              />
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-field-label font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                Starts
              </Label>
              <Input type="date" value={form.startsAt} onChange={(e) => set("startsAt", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-field-label font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                Expires (optional)
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
            {isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CouponsPage() {
  const utils = trpc.useUtils();
  const coupons = trpc.coupon.list.useQuery({});

  const [createOpen, setCreateOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const createCoupon = trpc.coupon.create.useMutation({
    onSuccess: (c) => {
      toast.success(`Coupon "${c.code}" created`);
      setCreateOpen(false);
      utils.coupon.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateCoupon = trpc.coupon.update.useMutation({
    onSuccess: () => {
      toast.success("Coupon updated");
      setEditId(null);
      utils.coupon.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteCoupon = trpc.coupon.delete.useMutation({
    onSuccess: () => {
      toast.success("Coupon deleted");
      utils.coupon.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  function buildInput(form: CouponForm) {
    return {
      code: form.code.trim().toUpperCase(),
      description: form.description.trim() || undefined,
      type: form.type,
      paymentMethod: form.paymentMethod,
      value: Number(form.value),
      minCartValue: Number(form.minCartValue || 0),
      maxDiscount: form.maxDiscount ? Number(form.maxDiscount) : undefined,
      usageLimit: form.usageLimit ? Number(form.usageLimit) : undefined,
      usageLimitPerUser: form.usageLimitPerUser ? Number(form.usageLimitPerUser) : undefined,
      isActive: form.isActive,
      startsAt: new Date(form.startsAt),
      endsAt: form.endsAt ? new Date(form.endsAt) : undefined,
    };
  }

  const editingCoupon = coupons.data?.find((c) => c.id === editId);

  function editInitial(c: NonNullable<typeof editingCoupon>): CouponForm {
    return {
      code: c.code,
      description: c.description ?? "",
      type: c.type,
      paymentMethod: (c as { paymentMethod?: "any" | "razorpay" | "wallet" }).paymentMethod ?? "any",
      value: String(c.value),
      minCartValue: String(c.minCartValue),
      maxDiscount: c.maxDiscount ? String(c.maxDiscount) : "",
      usageLimit: c.usageLimit ? String(c.usageLimit) : "",
      usageLimitPerUser: c.usageLimitPerUser ? String(c.usageLimitPerUser) : "",
      isActive: c.isActive,
      startsAt: toDateInput(c.startsAt),
      endsAt: toDateInput(c.endsAt),
    };
  }

  const activeCount = coupons.data?.filter((c) => c.isActive).length ?? 0;
  const totalUsed = coupons.data?.reduce((sum, c) => sum + c.usedCount, 0) ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-title font-semibold">Coupons</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cart-level discount codes customers enter at checkout.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4 mr-1.5" />
          New coupon
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total coupons", value: coupons.data?.length ?? 0 },
          { label: "Active", value: activeCount },
          { label: "Total uses", value: totalUsed },
        ].map(({ label, value }) => (
          <Card key={label}>
            <CardContent className="pt-5 pb-4">
              <p className="text-field-label font-semibold uppercase tracking-[0.06em] text-muted-foreground">{label}</p>
              <p className="mt-1.5 text-kpi font-semibold leading-none tabular-nums">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Discount</TableHead>
              <TableHead>Min cart</TableHead>
              <TableHead>Cap</TableHead>
              <TableHead>Validity</TableHead>
              <TableHead>Usage</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {coupons.isLoading && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">Loading…</TableCell>
              </TableRow>
            )}
            {!coupons.isLoading && (coupons.data?.length ?? 0) === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  No coupons yet. Create one above.
                </TableCell>
              </TableRow>
            )}
            {coupons.data?.map((c) => {
              const expired = c.endsAt && new Date(c.endsAt) < new Date();
              const notStarted = new Date(c.startsAt) > new Date();
              const limitReached = c.usageLimit !== null && c.usedCount >= c.usageLimit;

              return (
                <TableRow key={c.id}>
                  <TableCell>
                    <span className="font-mono font-semibold tracking-wide">{c.code}</span>
                    {c.description && (
                      <p className="text-[11px] text-muted-foreground mt-0.5 max-w-[200px] truncate">
                        {c.description}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="font-medium tabular-nums">
                    {formatValue(c.type, c.value)}
                    <span className="ml-1 text-[11px] text-muted-foreground uppercase">
                      {c.type === "percentage" ? "off" : "flat"}
                    </span>
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {Number(c.minCartValue) > 0 ? `≥ ${formatInr(Number(c.minCartValue))}` : "—"}
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {c.maxDiscount ? `≤ ${formatInr(Number(c.maxDiscount))}` : "—"}
                  </TableCell>
                  <TableCell className="text-[12px] text-muted-foreground">
                    {fmt(c.startsAt)}
                    {c.endsAt ? ` → ${fmt(c.endsAt)}` : " → ∞"}
                  </TableCell>
                  <TableCell className="tabular-nums text-[12px]">
                    <span>{c.usedCount}{c.usageLimit !== null ? ` / ${c.usageLimit}` : ""}</span>
                    {c.usageLimitPerUser !== null && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        max {c.usageLimitPerUser}/customer
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    {!c.isActive || limitReached ? (
                      <Badge variant="secondary">Inactive</Badge>
                    ) : expired ? (
                      <Badge variant="outline">Expired</Badge>
                    ) : notStarted ? (
                      <Badge variant="outline">Scheduled</Badge>
                    ) : (
                      <Badge variant="default">Active</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditId(c.id)}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive hover:text-destructive border-destructive/30"
                        onClick={() => {
                          if (confirm(`Delete coupon "${c.code}"?`)) {
                            deleteCoupon.mutate({ id: c.id });
                          }
                        }}
                        disabled={deleteCoupon.isPending}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Create dialog */}
      {createOpen && (
        <CouponDialog
          open
          onOpenChange={(v) => !v && setCreateOpen(false)}
          title="New coupon"
          onSubmit={(form) => createCoupon.mutate(buildInput(form))}
          isPending={createCoupon.isPending}
        />
      )}

      {/* Edit dialog */}
      {editingCoupon && (
        <CouponDialog
          open
          onOpenChange={(v) => !v && setEditId(null)}
          title="Edit coupon"
          initial={editInitial(editingCoupon)}
          onSubmit={(form) => updateCoupon.mutate({ id: editingCoupon.id, ...buildInput(form) })}
          isPending={updateCoupon.isPending}
        />
      )}
    </div>
  );
}

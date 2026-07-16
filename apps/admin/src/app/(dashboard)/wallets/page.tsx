"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { IndianRupee, Plus, ReceiptText, Search, Users, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { formatInr } from "@/lib/format";

const PAGE = 50;
const TXN_PAGE = 20;

const TXN_LABEL: Record<string, string> = {
  topup: "Top-up",
  order_payment: "Order payment",
  refund_credit: "Refund credit",
  reversal: "Reversal",
  adjustment: "Adjustment",
};

// Short, deterministic handle for a user — the first 8 chars of their real id.
// Searchable in the toolbar (with or without the #).
const shortId = (id: string) => `#${id.slice(0, 8).toUpperCase()}`;

function fmtDateTime(d: string | Date) {
  return new Date(d).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Credit dialog (single or bulk) ───────────────────────────────────────────

function CreditDialog({
  targets,
  onClose,
  onDone,
}: {
  targets: { userId: string; name: string }[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [direction, setDirection] = useState<"credit" | "debit">("credit");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  const single = trpc.adminUser.walletCredit.useMutation();
  const bulk = trpc.adminUser.walletBulkCredit.useMutation();
  const pending = single.isPending || bulk.isPending;

  const amountNum = Number(amount);
  const canSubmit =
    Number.isFinite(amountNum) && amountNum > 0 && amountNum <= 100000 && reason.trim().length >= 3 && !pending;
  const verb = direction === "credit" ? "credited to" : "deducted from";

  async function submit() {
    try {
      if (targets.length === 1) {
        await single.mutateAsync({
          userId: targets[0]!.userId,
          amountInr: amountNum,
          direction,
          note: reason.trim(),
        });
        toast.success(`₹${amount} ${verb} ${targets[0]!.name}`);
      } else {
        const res = await bulk.mutateAsync({
          userIds: targets.map((t) => t.userId),
          amountInr: amountNum,
          direction,
          note: reason.trim(),
        });
        if (res.failed.length > 0) {
          toast.warning(
            `Done for ${res.credited} of ${targets.length} — ${res.failed.length} failed${direction === "debit" ? " (likely insufficient balance)" : ""}`,
          );
        } else {
          toast.success(`₹${amount} ${verb} ${res.credited} customer${res.credited !== 1 ? "s" : ""}`);
        }
      }
      onDone();
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {targets.length === 1 ? `Adjust wallet — ${targets[0]!.name}` : `Adjust wallets — ${targets.length} customers`}
          </DialogTitle>
          <DialogDescription>
            Every adjustment is recorded in the customer&apos;s transaction history with your name and this
            reason — nothing is silent.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-1">
          {/* Direction */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setDirection("credit")}
              className={`rounded-lg border p-3 text-left transition-colors ${
                direction === "credit" ? "border-green-600 bg-green-600/5" : "border-border hover:border-foreground/30"
              }`}
            >
              <div className="text-sm font-semibold">Add money</div>
              <div className="text-[11px] text-muted-foreground">Credit store balance</div>
            </button>
            <button
              type="button"
              onClick={() => setDirection("debit")}
              className={`rounded-lg border p-3 text-left transition-colors ${
                direction === "debit" ? "border-red-600 bg-red-600/5" : "border-border hover:border-foreground/30"
              }`}
            >
              <div className="text-sm font-semibold">Deduct money</div>
              <div className="text-[11px] text-muted-foreground">Correction / clawback</div>
            </button>
          </div>
          {direction === "debit" && (
            <p className="rounded-md bg-red-600/10 px-3 py-2 text-[12px] text-red-700 dark:text-red-400">
              Deducts from the customer&apos;s balance. It can never go below zero — a debit larger than the
              balance is rejected.
            </p>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="bulk-amount">Amount per customer (₹)</Label>
            <Input
              id="bulk-amount"
              type="number"
              min={1}
              max={100000}
              placeholder="e.g. 250"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            {targets.length > 1 && Number.isFinite(amountNum) && amountNum > 0 && (
              <p className="text-[11px] text-muted-foreground">
                Total {direction === "credit" ? "store credit issued" : "deducted"}:{" "}
                <span className="font-semibold">{formatInr(amountNum * targets.length)}</span>
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bulk-reason">Reason</Label>
            <Textarea
              id="bulk-reason"
              placeholder={direction === "credit" ? "e.g. Launch-week goodwill credit" : "e.g. Reversing credit issued by mistake on 16 Jul"}
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">Customers see this note on the transaction.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button variant={direction === "debit" ? "destructive" : "default"} disabled={!canSubmit} onClick={submit}>
            {pending
              ? "Working…"
              : `${direction === "credit" ? "Credit" : "Deduct from"} ${targets.length > 1 ? `${targets.length} customers` : "customer"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Statement dialog ─────────────────────────────────────────────────────────

function StatementDialog({
  target,
  onClose,
}: {
  target: { userId: string; name: string; balance: string };
  onClose: () => void;
}) {
  const [page, setPage] = useState(0);
  const txns = trpc.adminUser.walletTransactions.useQuery({
    userId: target.userId,
    limit: TXN_PAGE,
    offset: page * TXN_PAGE,
  });
  const total = txns.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / TXN_PAGE));

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Wallet statement — {target.name}{" "}
            <span className="align-middle rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] font-normal text-muted-foreground">
              {shortId(target.userId)}
            </span>
          </DialogTitle>
          <DialogDescription>
            Current balance <span className="font-semibold tabular-nums">{formatInr(Number(target.balance))}</span> ·
            every movement, append-only.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[55vh] overflow-y-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Note</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {txns.isLoading && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              )}
              {!txns.isLoading && (txns.data?.items.length ?? 0) === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                    No transactions yet.
                  </TableCell>
                </TableRow>
              )}
              {txns.data?.items.map((t) => {
                const amt = Number(t.amount);
                return (
                  <TableRow key={t.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {fmtDateTime(t.createdAt)}
                    </TableCell>
                    <TableCell className="text-sm">{TXN_LABEL[t.type] ?? t.type}</TableCell>
                    <TableCell className="max-w-[220px] truncate text-xs text-muted-foreground" title={t.note ?? ""}>
                      {t.note ?? "—"}
                    </TableCell>
                    <TableCell
                      className={`text-right font-semibold tabular-nums ${amt >= 0 ? "text-green-600" : "text-foreground"}`}
                    >
                      {amt >= 0 ? "+" : "−"}
                      {formatInr(Math.abs(amt))}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {formatInr(Number(t.balanceAfter))}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {pages > 1 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Page {page + 1} of {pages} · {total} total
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page + 1 >= pages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WalletsPage() {
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [creditTargets, setCreditTargets] = useState<{ userId: string; name: string }[] | null>(null);
  const [statementTarget, setStatementTarget] = useState<{ userId: string; name: string; balance: string } | null>(null);

  const list = trpc.adminUser.walletList.useQuery({
    search: search || undefined,
    limit: PAGE,
    offset: page * PAGE,
  });

  const wallets = list.data?.wallets ?? [];
  const total = list.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const selectedIds = Object.keys(selected).filter((id) => selected[id]);
  const allOnPageSelected = wallets.length > 0 && wallets.every((w) => selected[w.userId]);

  function refresh() {
    utils.adminUser.walletList.invalidate();
    utils.adminUser.walletTransactions.invalidate();
    setSelected({});
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Wallets</h1>
        <p className="text-sm text-muted-foreground">
          Customer store credit — balances, statements, and manual credits.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:max-w-lg">
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <IndianRupee className="size-3.5" />
            Outstanding credit
          </div>
          <div className="mt-2 text-2xl font-bold tabular-nums">{formatInr(list.data?.liability ?? 0)}</div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Total balance customers hold — your liability.</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Users className="size-3.5" />
            Wallets
          </div>
          <div className="mt-2 text-2xl font-bold tabular-nums">{total}</div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Customers who have used the wallet.</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search name, email or #ID…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
          />
        </div>
        {selectedIds.length > 0 && (
          <Button
            className="gap-1.5"
            onClick={() =>
              setCreditTargets(
                wallets
                  .filter((w) => selected[w.userId])
                  .map((w) => ({ userId: w.userId, name: w.userName || w.userEmail })),
              )
            }
          >
            <Plus className="size-3.5" />
            Credit {selectedIds.length} selected
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allOnPageSelected}
                  onCheckedChange={(v) => {
                    const next = { ...selected };
                    for (const w of wallets) next[w.userId] = !!v;
                    setSelected(next);
                  }}
                />
              </TableHead>
              <TableHead>Customer</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead>Last activity</TableHead>
              <TableHead className="w-56" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {!list.isLoading && wallets.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                  <Wallet className="mx-auto mb-2 size-5 opacity-40" />
                  No wallets yet — a wallet is created the first time a customer tops up, pays, or receives credit.
                </TableCell>
              </TableRow>
            )}
            {wallets.map((w) => (
              <TableRow key={w.userId}>
                <TableCell>
                  <Checkbox
                    checked={!!selected[w.userId]}
                    onCheckedChange={(v) => setSelected((s) => ({ ...s, [w.userId]: !!v }))}
                  />
                </TableCell>
                <TableCell>
                  <Link href={`/users/${w.userId}`} className="hover:underline">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{w.userName || "—"}</span>
                      <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                        {shortId(w.userId)}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">{w.userEmail}</div>
                  </Link>
                </TableCell>
                <TableCell className="text-right text-sm font-semibold tabular-nums">
                  {formatInr(Number(w.balance))}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {w.lastTxnAt ? fmtDateTime(w.lastTxnAt) : "—"}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={() =>
                        setStatementTarget({ userId: w.userId, name: w.userName || w.userEmail, balance: w.balance })
                      }
                    >
                      <ReceiptText className="size-3.5" />
                      Statement
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={() => setCreditTargets([{ userId: w.userId, name: w.userName || w.userEmail }])}
                    >
                      <Plus className="size-3.5" />
                      Credit
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Page {page + 1} of {pages} · {total} wallets
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              Prev
            </Button>
            <Button variant="outline" size="sm" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}

      {creditTargets && (
        <CreditDialog targets={creditTargets} onClose={() => setCreditTargets(null)} onDone={refresh} />
      )}
      {statementTarget && <StatementDialog target={statementTarget} onClose={() => setStatementTarget(null)} />}
    </div>
  );
}

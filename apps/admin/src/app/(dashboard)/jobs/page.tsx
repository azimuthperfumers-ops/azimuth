"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useState } from "react";
import Link from "next/link";
import { RefreshCw, RotateCcw, XCircle } from "lucide-react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@azimuth/api";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { trpc } from "@/lib/trpc";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type Job = RouterOutputs["job"]["adminList"]["jobs"][number];

const PAGE_SIZE = 50;

const TYPE_LABEL: Record<string, string> = {
  book_shipment: "Book Shipment",
  cancel_shipment: "Cancel Shipment",
  initiate_refund: "Initiate Refund",
  return_shipment: "Return",
  exchange_shipment: "Exchange",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  running: "secondary",
  completed: "secondary",
  failed: "destructive",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  running: "Running",
  completed: "Completed",
  failed: "Failed",
};

const JOB_TYPES = [
  "book_shipment",
  "cancel_shipment",
  "initiate_refund",
  "return_shipment",
  "exchange_shipment",
] as const;

const JOB_STATUSES = ["pending", "running", "completed", "failed"] as const;

function fmt(date: Date | string) {
  return new Date(date).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function CancelDialog({
  open,
  jobType,
  isPending,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  jobType: string;
  isPending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Dismiss job?</DialogTitle>
          <DialogDescription className="pt-1">
            This will permanently dismiss the <strong>{TYPE_LABEL[jobType] ?? jobType}</strong> job.
            It will be marked completed and cannot be retried.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={onCancel}>Keep job</Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={isPending}
            onClick={onConfirm}
          >
            {isPending ? "Dismissing…" : "Dismiss job"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function JobRow({
  job,
  onRetry,
  onCancel,
}: {
  job: Job;
  onRetry: (id: string) => void;
  onCancel: (id: string) => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const cancelMutation = trpc.job.adminCancel.useMutation({
    onSuccess: () => { setConfirmOpen(false); onCancel(job.id); },
  });

  return (
    <>
      <TableRow>
        <TableCell
          className="font-mono text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
          title={job.id}
          onClick={() => void navigator.clipboard.writeText(job.id)}
        >
          {job.id.slice(0, 8)}
        </TableCell>
        <TableCell className="text-sm">{TYPE_LABEL[job.type] ?? job.type}</TableCell>
        <TableCell>
          <Badge variant={STATUS_VARIANT[job.status] ?? "outline"}>
            {STATUS_LABEL[job.status] ?? job.status}
          </Badge>
        </TableCell>
        <TableCell className="font-mono text-sm">
          {job.order?.id
            ? <Link href={`/orders/${job.order.id}`} className="text-foreground hover:underline">{job.order.orderNumber}</Link>
            : <span className="text-muted-foreground">—</span>
          }
        </TableCell>
        <TableCell className="font-mono text-sm text-muted-foreground">
          {job.ticket?.ticketNumber ?? "—"}
        </TableCell>
        <TableCell className="text-xs text-muted-foreground tabular-nums">
          {job.attempts} / {job.maxAttempts}
        </TableCell>
        <TableCell className="max-w-[220px] truncate text-xs text-muted-foreground" title={job.errorMessage ?? ""}>
          {job.errorMessage ?? "—"}
        </TableCell>
        <TableCell className="text-xs text-muted-foreground">{fmt(job.createdAt)}</TableCell>
        <TableCell>
          {job.status === "failed" && (
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1.5 text-xs"
                onClick={() => onRetry(job.id)}
              >
                <RotateCcw className="size-3" />
                Retry
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setConfirmOpen(true)}
              >
                <XCircle className="size-3" />
                Dismiss
              </Button>
            </div>
          )}
        </TableCell>
      </TableRow>
      <CancelDialog
        open={confirmOpen}
        jobType={job.type}
        isPending={cancelMutation.isPending}
        onConfirm={() => cancelMutation.mutate({ jobId: job.id })}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}

export default function AdminJobsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const typeFilter = searchParams.get("type") ?? "all";
  const statusFilter = searchParams.get("status") ?? "all";
  const page = Number(searchParams.get("page") ?? "1");
  const offset = (page - 1) * PAGE_SIZE;

  const setParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === "all") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
      params.delete("page");
      router.push(`${pathname}?${params.toString()}`);
    },
    [searchParams, router, pathname],
  );

  const setPage = useCallback(
    (p: number) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("page", String(p));
      router.push(`${pathname}?${params.toString()}`);
    },
    [searchParams, router, pathname],
  );

  const { data, isLoading, refetch } = trpc.job.adminList.useQuery({
    type: typeFilter === "all" ? undefined : (typeFilter as (typeof JOB_TYPES)[number]),
    status: statusFilter === "all" ? undefined : (statusFilter as (typeof JOB_STATUSES)[number]),
    limit: PAGE_SIZE,
    offset,
  });

  const retryMutation = trpc.job.adminRetry.useMutation({
    onSuccess: () => { void refetch(); },
  });

  function handleCancel() { void refetch(); }

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-title font-semibold">Job Queue</h1>
          <p className="text-sm text-muted-foreground">
            Background jobs — shipment bookings, refunds, returns. Retry failed ones here.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={typeFilter} onValueChange={(v) => setParam("type", v)}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {JOB_TYPES.map((t) => (
                <SelectItem key={t} value={t}>{TYPE_LABEL[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => setParam("status", v)}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {JOB_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => void refetch()} className="h-9 gap-1.5">
            <RefreshCw className="size-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">ID</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Order</TableHead>
              <TableHead>Ticket</TableHead>
              <TableHead className="w-20">Attempts</TableHead>
              <TableHead>Error</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && (!data?.jobs.length) && (
              <TableRow>
                <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                  No jobs found.
                </TableCell>
              </TableRow>
            )}
            {data?.jobs.map((job) => (
              <JobRow
                key={job.id}
                job={job}
                onRetry={(id) => retryMutation.mutate({ jobId: id })}
                onCancel={handleCancel}
              />
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages} · {data?.total ?? 0} total
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

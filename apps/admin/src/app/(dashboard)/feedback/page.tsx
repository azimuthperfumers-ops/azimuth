"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Search } from "lucide-react";

import { LogFeedbackDialog } from "@/components/feedback/log-feedback-dialog";
import { Stars } from "@/components/feedback/stars";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import { usePermissions } from "@/hooks/use-permissions";
import { trpc } from "@/lib/trpc";

const STATUS_LABEL: Record<string, string> = {
  new: "New",
  reviewed: "Reviewed",
  archived: "Archived",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  new: "default",
  reviewed: "secondary",
  archived: "outline",
};

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export default function AdminFeedbackPage() {
  const router = useRouter();
  const { can } = usePermissions();
  const [status, setStatus] = useState("all");
  const [sentiment, setSentiment] = useState("all");
  const [search, setSearch] = useState("");

  const stats = trpc.feedback.adminStats.useQuery();
  const { data, isLoading } = trpc.feedback.adminList.useQuery({
    status: status === "all" ? undefined : (status as "new"),
    sentiment: sentiment === "all" ? undefined : (sentiment as "positive"),
    search: search.trim() || undefined,
    limit: 100,
    offset: 0,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-title font-semibold">Feedback</h1>
          <p className="text-sm text-muted-foreground">
            What customers said about their deliveries. Private — never shown on the storefront.
          </p>
        </div>
        {can("feedback", "write") && <LogFeedbackDialog />}
      </div>

      {/* Headline numbers */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total" value={String(stats.data?.total ?? 0)} />
        <StatCard
          label="Average"
          value={stats.data?.average != null ? stats.data.average.toFixed(1) : "—"}
        />
        <StatCard label="Untriaged" value={String(stats.data?.unread ?? 0)} />
        <StatCard label="Below 3★" value={String(stats.data?.negative ?? 0)} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Order number, customer or words in the comment"
            className="pl-8"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="reviewed">Reviewed</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sentiment} onValueChange={setSentiment}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All ratings" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All ratings</SelectItem>
            <SelectItem value="positive">Positive (4★+)</SelectItem>
            <SelectItem value="neutral">Neutral (3–3.5★)</SelectItem>
            <SelectItem value="negative">Negative (under 3★)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Order</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead className="w-[130px]">Rating</TableHead>
              <TableHead>Comment</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Received</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && data?.rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                  No feedback yet.
                </TableCell>
              </TableRow>
            )}
            {data?.rows.map((f) => (
              <TableRow
                key={f.id}
                className="cursor-pointer hover:bg-muted/40"
                onClick={() => router.push(`/feedback/${f.id}`)}
              >
                <TableCell>
                  <ChevronRight className="size-3.5 text-muted-foreground" />
                </TableCell>
                <TableCell className="font-mono text-sm font-medium">{f.orderNumber}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{f.customerName}</TableCell>
                <TableCell>{f.rating != null && <Stars rating={f.rating} />}</TableCell>
                <TableCell className="max-w-[260px] truncate text-sm text-muted-foreground">
                  {f.comment ?? "—"}
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[f.status] ?? "outline"}>
                    {STATUS_LABEL[f.status] ?? f.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {f.source === "staff" ? "Staff-logged" : "Customer"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(f.createdAt).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                  })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {data && data.total > data.rows.length && (
        <p className="text-xs text-muted-foreground">
          Showing {data.rows.length} of {data.total}. Narrow the filters to see the rest.
        </p>
      )}
    </div>
  );
}

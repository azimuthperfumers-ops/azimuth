"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@azimuth/api";

import { Badge } from "@/components/ui/badge";
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
type Ticket = RouterOutputs["ticket"]["adminList"][number];

const TYPE_LABEL: Record<string, string> = {
  general: "General",
  refund: "Refund",
  damaged: "Damaged",
  other: "Other",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  open: "default",
  awaiting_admin: "destructive",
  awaiting_user: "secondary",
  resolved: "secondary",
  closed: "outline",
};

const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  awaiting_admin: "Needs response",
  awaiting_user: "Awaiting user",
  resolved: "Resolved",
  closed: "Closed",
};

const STATUSES = ["open", "awaiting_admin", "awaiting_user", "resolved", "closed"] as const;

function TicketRow({ ticket }: { ticket: Ticket }) {
  const router = useRouter();

  return (
    <TableRow
      className="cursor-pointer hover:bg-muted/40"
      onClick={() => router.push(`/support/${ticket.id}`)}
    >
      <TableCell><ChevronRight className="size-3.5 text-muted-foreground" /></TableCell>
      <TableCell className="font-mono text-sm font-medium">{ticket.ticketNumber}</TableCell>
      <TableCell className="max-w-[200px] truncate text-sm">{ticket.subject}</TableCell>
      <TableCell className="text-sm text-muted-foreground">{ticket.user?.name ?? "—"}</TableCell>
      <TableCell className="text-xs text-muted-foreground">{TYPE_LABEL[ticket.type] ?? ticket.type}</TableCell>
      <TableCell>
        <Badge variant={STATUS_VARIANT[ticket.status] ?? "outline"}>
          {STATUS_LABEL[ticket.status] ?? ticket.status}
        </Badge>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {ticket.order?.orderNumber ?? "—"}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {new Date(ticket.updatedAt).toLocaleDateString("en-IN", {
          day: "numeric", month: "short",
        })}
      </TableCell>
    </TableRow>
  );
}

export default function AdminSupportPage() {
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: tickets, isLoading } = trpc.ticket.adminList.useQuery({
    status: statusFilter === "all" ? undefined : (statusFilter as "open"),
    limit: 100,
    offset: 0,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-title font-semibold">Support</h1>
          <p className="text-sm text-muted-foreground">Customer support tickets. Click row to open.</p>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Ticket #</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Order</TableHead>
              <TableHead>Updated</TableHead>
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
            {!isLoading && (!tickets || tickets.length === 0) && (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                  No tickets found.
                </TableCell>
              </TableRow>
            )}
            {tickets?.map((t) => <TicketRow key={t.id} ticket={t} />)}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

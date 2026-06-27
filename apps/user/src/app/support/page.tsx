"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronRight, ImagePlus, Plus, TicketIcon, X } from "lucide-react";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc";
import { useTicketUpload } from "@/hooks/use-ticket-upload";

const TYPE_LABEL: Record<string, string> = {
  general: "General",
  return: "Return",
  exchange: "Exchange",
  refund: "Refund",
  damaged: "Damaged item",
  other: "Other",
};

const STATUS_STYLE: Record<string, string> = {
  open: "text-blue-600 bg-blue-50 border-blue-200",
  awaiting_admin: "text-yellow-600 bg-yellow-50 border-yellow-200",
  awaiting_user: "text-indigo-600 bg-indigo-50 border-indigo-200",
  resolved: "text-green-700 bg-green-50 border-green-200",
  closed: "text-muted-foreground bg-muted border-border",
};

const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  awaiting_admin: "Awaiting response",
  awaiting_user: "Admin replied",
  resolved: "Resolved",
  closed: "Closed",
};

// ── New ticket form ───────────────────────────────────────────────────────────

const PHOTO_REQUIRED_TYPES = new Set(["return", "exchange", "damaged"]);

function NewTicketForm({ onDone, prefilledOrderId }: { onDone: (id: string) => void; prefilledOrderId?: string }) {
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState<string>("general");
  const [orderId, setOrderId] = useState(prefilledOrderId ?? "");
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: orders } = trpc.order.list.useQuery();
  const utils = trpc.useUtils();
  const { uploads, uploading, addFiles, remove, urls } = useTicketUpload();

  const photoRequired = PHOTO_REQUIRED_TYPES.has(type);

  const create = trpc.ticket.create.useMutation({
    onSuccess: async (ticket) => {
      await utils.ticket.list.invalidate();
      onDone(ticket.id);
      router.push(`/support/${ticket.id}`);
    },
  });

  return (
    <div className="border border-border p-6 space-y-5">
      <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-muted-foreground/50">
        New support request
      </p>

      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Type
        </label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="w-full border border-border bg-background px-3 py-2 text-sm focus:border-foreground focus:outline-none"
        >
          {Object.entries(TYPE_LABEL).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Related order (optional)
        </label>
        <select
          value={orderId}
          onChange={(e) => setOrderId(e.target.value)}
          className="w-full border border-border bg-background px-3 py-2 text-sm focus:border-foreground focus:outline-none"
        >
          <option value="">— none —</option>
          {orders?.map((o) => (
            <option key={o.id} value={o.id}>{o.orderNumber}</option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Subject
        </label>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Brief summary of your issue"
          className="w-full border border-border bg-background px-3 py-2 text-sm focus:border-foreground focus:outline-none"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Message
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          placeholder="Describe your issue in detail…"
          className="w-full border border-border bg-background px-3 py-2 text-sm focus:border-foreground focus:outline-none resize-none"
        />
      </div>

      {/* Attachments */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className={`text-[11px] font-semibold uppercase tracking-[0.12em] ${photoRequired ? "text-foreground" : "text-muted-foreground"}`}>
            Photos{photoRequired ? <span className="text-red-500 ml-0.5">*</span> : " (optional)"}
            <span className="ml-1 font-normal normal-case tracking-normal text-muted-foreground/60">max 5</span>
          </label>
          {uploads.length < 5 && (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold tracking-[0.12em] uppercase text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
            >
              <ImagePlus className="size-3.5" />
              {uploading ? "Uploading…" : "Add image"}
            </button>
          )}
        </div>

        {photoRequired && uploads.length === 0 && (
          <p className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 px-3 py-2">
            Photos are required for {TYPE_LABEL[type]?.toLowerCase()} requests. Please attach at least one image showing the item.
          </p>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => addFiles(e.target.files)}
        />
        {uploads.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {uploads.map((u) => (
              <div key={u.url} className="relative group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={u.url}
                  alt={u.name}
                  className="size-16 object-cover border border-border"
                />
                <button
                  type="button"
                  onClick={() => remove(u.url)}
                  className="absolute -top-1.5 -right-1.5 size-4 bg-foreground text-background flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="size-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={() =>
          create.mutate({
            subject,
            message,
            type: type as "general",
            orderId: orderId || undefined,
            attachmentUrls: urls.length > 0 ? urls : undefined,
          })
        }
        disabled={
          !subject.trim() ||
          !message.trim() ||
          (photoRequired && urls.length === 0) ||
          create.isPending ||
          uploading
        }
        className="border border-foreground px-6 py-2.5 text-[11px] font-semibold tracking-[0.14em] uppercase hover:bg-foreground hover:text-background transition-all disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {create.isPending ? "Submitting…" : "Submit request"}
      </button>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SupportPage() {
  const { data: session, isPending } = authClient.useSession();
  const searchParams = useSearchParams();
  const prefilledOrderId = searchParams.get("orderId") ?? undefined;
  const [showForm, setShowForm] = useState(!!prefilledOrderId);
  const { data: tickets, isLoading } = trpc.ticket.list.useQuery(undefined, {
    enabled: !!session,
  });

  if (isPending) return null;

  if (!session) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-[640px] px-4 py-16 text-center">
          <p className="text-muted-foreground text-sm">Sign in to view your support requests.</p>
        </main>
        <SiteFooter />
      </>
    );
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-[780px] px-4 md:px-6 py-8 md:py-12 pb-24">

        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-muted-foreground/50 mb-1">
              Help &amp; Support
            </p>
            <h1 className="text-2xl font-semibold">Support requests</h1>
          </div>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="inline-flex items-center gap-2 border border-foreground px-4 py-2 text-[10.5px] font-semibold tracking-[0.14em] uppercase hover:bg-foreground hover:text-background transition-all"
          >
            <Plus className="size-3.5" />
            New request
          </button>
        </div>

        {showForm && (
          <div className="mb-8">
            <NewTicketForm onDone={() => setShowForm(false)} prefilledOrderId={prefilledOrderId} />
          </div>
        )}

        {isLoading && <div className="h-40 animate-pulse bg-muted rounded" />}

        {!isLoading && (!tickets || tickets.length === 0) && (
          <div className="text-center py-16 text-muted-foreground">
            <TicketIcon className="size-8 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No support requests yet.</p>
          </div>
        )}

        {tickets && tickets.length > 0 && (
          <div className="divide-y divide-border border border-border">
            {tickets.map((ticket) => (
              <Link
                key={ticket.id}
                href={`/support/${ticket.id}`}
                className="flex items-center gap-4 px-5 py-4 hover:bg-muted/40 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold text-muted-foreground/50 font-mono">
                      {ticket.ticketNumber}
                    </span>
                    <span className="text-[10px] text-muted-foreground/40">·</span>
                    <span className="text-[10px] text-muted-foreground/50">
                      {TYPE_LABEL[ticket.type] ?? ticket.type}
                    </span>
                  </div>
                  <p className="text-sm font-semibold truncate">{ticket.subject}</p>
                  <p className="text-[11px] text-muted-foreground/50 mt-0.5">
                    {new Date(ticket.updatedAt).toLocaleDateString("en-IN", {
                      day: "numeric", month: "short", year: "numeric",
                    })}
                  </p>
                </div>
                <span className={`shrink-0 border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] ${STATUS_STYLE[ticket.status] ?? ""}`}>
                  {STATUS_LABEL[ticket.status] ?? ticket.status}
                </span>
                <ChevronRight className="size-4 text-muted-foreground/30 shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </>
  );
}

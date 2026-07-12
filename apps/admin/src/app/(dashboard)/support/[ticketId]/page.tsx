"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ImagePlus, Send, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { useTicketUpload } from "@/hooks/use-ticket-upload";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDateTime(d: Date | string) {
  return new Date(d).toLocaleString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  open: "default",
  awaiting_admin: "destructive",
  awaiting_user: "secondary",
  resolved: "secondary",
  closed: "outline",
};

const STATUS_LABEL: Record<string, string> = {
  open: "Open", awaiting_admin: "Needs response",
  awaiting_user: "Awaiting user", resolved: "Resolved", closed: "Closed",
};

// ── Action dialog ─────────────────────────────────────────────────────────────

function ActionDialog({
  ticketId,
  action,
  open,
  onOpenChange,
}: {
  ticketId: string;
  action: "refund" | "return" | "exchange" | "close";
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [note, setNote] = useState("");
  const [returnReason, setReturnReason] = useState("Customer requested return");
  const [pickupDate, setPickupDate] = useState("");
  const utils = trpc.useUtils();
  const minDate = new Date(Date.now() + 86400000).toISOString().split("T")[0];

  const act = trpc.ticket.adminAction.useMutation({
    onSuccess: async (data) => {
      toast.success(data.detail);
      await utils.ticket.get.invalidate({ ticketId });
      onOpenChange(false);
      setNote(""); setPickupDate("");
    },
    onError: (e) => toast.error(e.message),
  });

  const TITLE: Record<string, string> = {
    refund: "Process Refund",
    return: "Schedule Return Pickup",
    exchange: "Schedule Return + Exchange",
    close: "Close Ticket",
  };

  const DESC: Record<string, string> = {
    refund: "Full refund via Razorpay. Order marked refunded. Cannot be undone.",
    return: "Schedule Shiprocket reverse pickup from customer address.",
    exchange: "Schedule reverse pickup. Ship replacement after receiving item.",
    close: "Mark ticket as closed. Customer can still email for help.",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{TITLE[action]}</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">{DESC[action]}</p>

        {(action === "return" || action === "exchange") && (
          <>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Preferred pickup date <span className="text-destructive">*</span>
              </label>
              <input
                type="date"
                value={pickupDate}
                min={minDate}
                onChange={(e) => setPickupDate(e.target.value)}
                className="w-full border border-border bg-background px-3 py-2 text-sm focus:border-foreground focus:outline-none"
              />
              <p className="text-[11px] text-muted-foreground/60">
                Date when customer will be home for pickup. Sent to courier.
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Return reason (sent to courier)
              </label>
              <input
                type="text"
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                className="w-full border border-border bg-background px-3 py-2 text-sm focus:border-foreground focus:outline-none"
              />
            </div>
          </>
        )}

        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Note to customer (optional)
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Message sent to customer in the ticket…"
            className="w-full border border-border bg-background px-3 py-2 text-sm focus:border-foreground focus:outline-none resize-none"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant={action === "refund" || action === "return" || action === "exchange" ? "destructive" : "default"}
            onClick={() =>
              act.mutate({ ticketId, action, note: note || undefined, returnReason, pickupDate: pickupDate || undefined })
            }
            disabled={act.isPending || ((action === "return" || action === "exchange") && !pickupDate)}
          >
            {act.isPending ? "Processing…" : TITLE[action]}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminTicketPage({ params }: { params: Promise<{ ticketId: string }> }) {
  const { ticketId } = use(params);
  const [draft, setDraft] = useState("");
  const [activeAction, setActiveAction] = useState<"refund" | "return" | "exchange" | "close" | "reopen" | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();
  const { uploads, uploading, addFiles, remove, urls, reset: resetUploads } = useTicketUpload();

  const { data: ticket, isLoading } = trpc.ticket.get.useQuery(
    { ticketId },
    { refetchInterval: 5000 },
  );

  const send = trpc.ticket.adminSendMessage.useMutation({
    onSuccess: async () => {
      setDraft("");
      resetUploads();
      await utils.ticket.get.invalidate({ ticketId });
    },
    onError: (e) => toast.error(e.message),
  });

  function handleSend() {
    if (!draft.trim() && urls.length === 0) return;
    send.mutate({ ticketId, content: draft.trim(), attachmentUrls: urls.length > 0 ? urls : undefined });
  }

  const reopen = trpc.ticket.adminAction.useMutation({
    onSuccess: async () => {
      toast.success("Ticket reopened");
      await utils.ticket.get.invalidate({ ticketId });
    },
    onError: (e) => toast.error(e.message),
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [ticket?.messages.length]);

  if (isLoading) {
    return <div className="h-80 animate-pulse bg-muted rounded" />;
  }

  if (!ticket) {
    return (
      <div className="text-center py-16 text-muted-foreground text-sm">
        Ticket not found.
        <Link href="/support" className="ml-2 underline">Back</Link>
      </div>
    );
  }

  const isClosed = ticket.status === "closed" || ticket.status === "resolved";
  const hasOrder = !!ticket.order;

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)]">
      {/* Back + Header */}
      <div className="shrink-0 pb-5 border-b border-border space-y-4">
        <Link
          href="/support"
          className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          All tickets
        </Link>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-muted-foreground/50 mb-1">
              {ticket.ticketNumber}
            </p>
            <h1 className="text-xl font-semibold">{ticket.subject}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {ticket.user?.name} · {ticket.user?.email}
              {ticket.order && (
                <> · Order: <Link href={`/orders/${ticket.orderId}`} className="underline">{ticket.order.orderNumber}</Link></>
              )}
            </p>
          </div>
          <Badge variant={STATUS_VARIANT[ticket.status] ?? "outline"} className="self-start shrink-0">
            {STATUS_LABEL[ticket.status] ?? ticket.status}
          </Badge>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-6 pt-5">

        {/* Chat column */}
        <div className="flex flex-col min-h-0">
          {/* Messages — scrollable */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {ticket.messages.map((msg) => {
              const isAdmin = msg.senderRole === "admin";
              const attachments = (msg.attachmentUrls ?? []) as string[];
              return (
                <div key={msg.id} className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] flex flex-col gap-1 ${isAdmin ? "items-end" : "items-start"}`}>
                    {msg.content && (
                      <div className={`px-4 py-3 text-sm leading-relaxed ${
                        isAdmin
                          ? "bg-foreground text-background"
                          : "bg-muted border border-border text-foreground"
                      }`}>
                        {msg.content}
                      </div>
                    )}
                    {attachments.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {attachments.map((url) => (
                          <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={url}
                              alt="attachment"
                              className="size-20 object-cover border border-border hover:opacity-80 transition-opacity"
                            />
                          </a>
                        ))}
                      </div>
                    )}
                    <p className="text-[10px] text-muted-foreground/40 px-1">
                      {isAdmin ? "You (admin)" : ticket.user?.name ?? "Customer"} · {formatDateTime(msg.createdAt)}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {/* Reply — pinned at bottom */}
          <div className="shrink-0 pt-3">
          {!isClosed ? (
            <div className="border border-border">
              {uploads.length > 0 && (
                <div className="flex flex-wrap gap-2 p-3 border-b border-border">
                  {uploads.map((u) => (
                    <div key={u.url} className="relative group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={u.url} alt={u.name} className="size-14 object-cover border border-border" />
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
              <div className="p-4 flex gap-3 items-end">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => addFiles(e.target.files)}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading || uploads.length >= 5}
                  className="shrink-0 p-2 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
                  title="Attach image"
                >
                  <ImagePlus className="size-4" />
                </button>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  rows={3}
                  placeholder={uploading ? "Uploading…" : "Reply to customer… (Enter to send)"}
                  className="flex-1 resize-none bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground/40"
                />
                <button
                  onClick={handleSend}
                  disabled={(!draft.trim() && urls.length === 0) || send.isPending || uploading}
                  className="shrink-0 p-2.5 border border-foreground hover:bg-foreground hover:text-background transition-all disabled:opacity-30"
                >
                  <Send className="size-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 border border-border p-4">
              <p className="text-sm text-muted-foreground flex-1">Ticket is {ticket.status}.</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => reopen.mutate({ ticketId, action: "reopen" })}
              >
                Reopen
              </Button>
            </div>
          )}
          </div>
        </div>

        {/* Action panel — scrollable */}
        <div className="overflow-y-auto space-y-4 pb-4">

          {/* Order info */}
          {ticket.order && (
            <div className="border border-border p-4 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/50">
                Linked order
              </p>
              <p className="font-mono text-sm font-semibold">{ticket.order.orderNumber}</p>
              <p className="text-xs text-muted-foreground capitalize">{ticket.order.status.replace(/_/g, " ")}</p>
              <p className="text-sm font-semibold">₹{Number(ticket.order.total).toLocaleString("en-IN")}</p>
            </div>
          )}

          {/* Actions */}
          {!isClosed && (
            <div className="border border-border p-4 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/50 mb-3">
                Admin actions
              </p>

              {hasOrder && (
                <>
                  <Button
                    className="w-full justify-start"
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveAction("refund")}
                  >
                    Process refund
                  </Button>
                  <Button
                    className="w-full justify-start"
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveAction("return")}
                  >
                    Schedule return pickup
                  </Button>
                  <Button
                    className="w-full justify-start"
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveAction("exchange")}
                  >
                    Return + exchange
                  </Button>
                </>
              )}

              <Button
                className="w-full justify-start"
                variant="outline"
                size="sm"
                onClick={() => setActiveAction("close")}
              >
                Close ticket
              </Button>
            </div>
          )}

          {/* Audit */}
          {ticket.actions.length > 0 && (
            <div className="border border-border p-4 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/50">
                Actions log
              </p>
              {ticket.actions.map((a) => (
                <div key={a.id} className="text-xs text-muted-foreground">
                  <span className="font-medium">{a.actionType.replace(/_/g, " ")}</span>
                  <br />
                  <span className="text-muted-foreground/50">{formatDateTime(a.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Dialogs */}
      {activeAction && activeAction !== "reopen" && (
        <ActionDialog
          ticketId={ticketId}
          action={activeAction}
          open={!!activeAction}
          onOpenChange={(v) => { if (!v) setActiveAction(null); }}
        />
      )}
    </div>
  );
}

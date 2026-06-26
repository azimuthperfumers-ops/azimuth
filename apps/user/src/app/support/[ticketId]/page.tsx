"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Send } from "lucide-react";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc";
import { formatDateTime } from "@/lib/format";

const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  awaiting_admin: "Awaiting response",
  awaiting_user: "Admin replied",
  resolved: "Resolved",
  closed: "Closed",
};

const STATUS_STYLE: Record<string, string> = {
  open: "text-blue-600 bg-blue-50 border-blue-200",
  awaiting_admin: "text-yellow-600 bg-yellow-50 border-yellow-200",
  awaiting_user: "text-indigo-600 bg-indigo-50 border-indigo-200",
  resolved: "text-green-700 bg-green-50 border-green-200",
  closed: "text-muted-foreground bg-muted border-border",
};

export default function TicketPage({ params }: { params: Promise<{ ticketId: string }> }) {
  const { ticketId } = use(params);
  const { data: session } = authClient.useSession();
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const utils = trpc.useUtils();

  const { data: ticket, isLoading } = trpc.ticket.get.useQuery(
    { ticketId },
    { enabled: !!session, refetchInterval: 5000 },
  );

  const send = trpc.ticket.sendMessage.useMutation({
    onSuccess: async () => {
      setDraft("");
      await utils.ticket.get.invalidate({ ticketId });
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [ticket?.messages.length]);

  if (isLoading) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-[780px] px-4 py-12">
          <div className="h-80 animate-pulse bg-muted rounded" />
        </main>
        <SiteFooter />
      </>
    );
  }

  if (!ticket) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-[780px] px-4 py-12 text-center">
          <p className="text-muted-foreground text-sm">Ticket not found.</p>
          <Link href="/support" className="mt-4 inline-block text-sm underline">Back to support</Link>
        </main>
        <SiteFooter />
      </>
    );
  }

  const isClosed = ticket.status === "closed" || ticket.status === "resolved";

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-[780px] px-4 md:px-6 py-8 md:py-12 pb-24">

        <Link
          href="/support"
          className="inline-flex items-center gap-2 text-[11px] font-semibold tracking-[0.14em] uppercase text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="size-3.5" />
          All requests
        </Link>

        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-8 pb-8 border-b border-border">
          <div>
            <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-muted-foreground/50 mb-1">
              {ticket.ticketNumber}
            </p>
            <h1 className="text-xl font-semibold">{ticket.subject}</h1>
            {ticket.order && (
              <p className="text-[12px] text-muted-foreground mt-1">
                Order:{" "}
                <Link href={`/orders/${ticket.orderId}`} className="underline hover:text-foreground">
                  {ticket.order.orderNumber}
                </Link>
              </p>
            )}
          </div>
          <span className={`shrink-0 self-start border px-3 py-1.5 text-[10px] font-bold tracking-[0.14em] uppercase ${STATUS_STYLE[ticket.status] ?? ""}`}>
            {STATUS_LABEL[ticket.status] ?? ticket.status}
          </span>
        </div>

        {/* Messages */}
        <div className="space-y-4 mb-8">
          {ticket.messages.map((msg) => {
            const isMe = msg.senderRole === "user";
            return (
              <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] ${isMe ? "items-end" : "items-start"} flex flex-col gap-1`}>
                  <div className={`px-4 py-3 text-sm leading-relaxed ${
                    isMe
                      ? "bg-foreground text-background"
                      : "bg-muted border border-border text-foreground"
                  }`}>
                    {msg.content}
                  </div>
                  <p className="text-[10px] text-muted-foreground/40 px-1">
                    {isMe ? "You" : "Support"} · {formatDateTime(msg.createdAt)}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Reply box */}
        {!isClosed ? (
          <div className="border border-border p-4 flex gap-3 items-end">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (draft.trim()) send.mutate({ ticketId, content: draft.trim() });
                }
              }}
              rows={3}
              placeholder="Write a message… (Enter to send, Shift+Enter for newline)"
              className="flex-1 resize-none bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground/40"
            />
            <button
              onClick={() => {
                if (draft.trim()) send.mutate({ ticketId, content: draft.trim() });
              }}
              disabled={!draft.trim() || send.isPending}
              className="shrink-0 p-2.5 border border-foreground hover:bg-foreground hover:text-background transition-all disabled:opacity-30"
            >
              <Send className="size-4" />
            </button>
          </div>
        ) : (
          <p className="text-center text-[12px] text-muted-foreground/50 py-4 border border-border">
            This ticket is {ticket.status}. Contact us at{" "}
            <a href="mailto:azimuthperfumers@gmail.com" className="underline">azimuthperfumers@gmail.com</a>{" "}
            to reopen.
          </p>
        )}

        {/* Actions taken */}
        {ticket.actions.length > 0 && (
          <div className="mt-8 pt-6 border-t border-border">
            <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-muted-foreground/40 mb-3">
              Actions taken
            </p>
            <div className="space-y-2">
              {ticket.actions.map((a) => (
                <p key={a.id} className="text-[12px] text-muted-foreground/60">
                  {a.actionType.replace(/_/g, " ")} · {formatDateTime(a.createdAt)}
                </p>
              ))}
            </div>
          </div>
        )}
      </main>
      <SiteFooter />
    </>
  );
}

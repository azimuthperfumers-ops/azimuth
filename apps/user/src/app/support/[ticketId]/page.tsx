"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ImagePlus, Send, X } from "lucide-react";

import { SiteHeader } from "@/components/site-header";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc";
import { formatDateTime } from "@/lib/format";
import { useTicketUpload } from "@/hooks/use-ticket-upload";

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
  const fileRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();
  const { uploads, uploading, addFiles, remove, urls, reset: resetUploads } = useTicketUpload();

  const { data: ticket, isLoading } = trpc.ticket.get.useQuery(
    { ticketId },
    { enabled: !!session, refetchInterval: 5000 },
  );

  const send = trpc.ticket.sendMessage.useMutation({
    onSuccess: async () => {
      setDraft("");
      resetUploads();
      await utils.ticket.get.invalidate({ ticketId });
    },
  });

  function handleSend() {
    if (!draft.trim() && urls.length === 0) return;
    send.mutate({ ticketId, content: draft.trim(), attachmentUrls: urls.length > 0 ? urls : undefined });
  }

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
      </>
    );
  }

  const isClosed = ticket.status === "closed" || ticket.status === "resolved";

  return (
    <div className="flex flex-col h-dvh">
      <SiteHeader />

      {/* Content fills remaining height */}
      <div className="flex-1 min-h-0 flex flex-col mx-auto w-full max-w-[780px] px-4 md:px-6">

        {/* Back + ticket header */}
        <div className="shrink-0 pt-6 pb-5 border-b border-border space-y-4">
          <Link
            href="/support"
            className="inline-flex items-center gap-2 text-[11px] font-semibold tracking-[0.14em] uppercase text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            All requests
          </Link>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
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
        </div>

        {/* Messages — scrollable */}
        <div className="flex-1 overflow-y-auto py-6 space-y-4 pr-1">
          {ticket.messages.map((msg) => {
            const isMe = msg.senderRole === "user";
            const attachments = (msg.attachmentUrls ?? []) as string[];
            return (
              <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] ${isMe ? "items-end" : "items-start"} flex flex-col gap-1`}>
                  {msg.content && (
                    <div className={`px-4 py-3 text-sm leading-relaxed ${
                      isMe
                        ? "bg-foreground text-background"
                        : "bg-muted border border-border text-foreground"
                    }`}>
                      {msg.content}
                    </div>
                  )}
                  {attachments.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {attachments.map((url) =>
                        /\.(mp4|webm|mov|m4v|3gp|mkv|avi)$/i.test(url) ? (
                          <video
                            key={url}
                            src={url}
                            controls
                            className="max-w-[240px] border border-border"
                          />
                        ) : (
                          <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={url}
                              alt="attachment"
                              className="size-20 object-cover border border-border hover:opacity-80 transition-opacity"
                            />
                          </a>
                        ),
                      )}
                    </div>
                  )}
                  <p className="text-[10px] text-muted-foreground/40 px-1">
                    {isMe ? "You" : "Support"} · {formatDateTime(msg.createdAt)}
                  </p>
                </div>
              </div>
            );
          })}

          {/* Actions taken (inline at end of messages) */}
          {ticket.actions.length > 0 && (
            <div className="pt-4 border-t border-border space-y-1">
              {ticket.actions.map((a) => (
                <p key={a.id} className="text-[11px] text-muted-foreground/50 text-center">
                  {a.actionType.replace(/_/g, " ")} · {formatDateTime(a.createdAt)}
                </p>
              ))}
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Reply — pinned at bottom */}
        <div className="shrink-0 pb-4">
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
                  placeholder={uploading ? "Uploading…" : "Write a message… (Enter to send, Shift+Enter for newline)"}
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
            <p className="text-center text-[12px] text-muted-foreground/50 py-4 border border-border">
              This ticket is {ticket.status}. Contact us at{" "}
              <a href="mailto:azimuthperfumers@gmail.com" className="underline">azimuthperfumers@gmail.com</a>{" "}
              to reopen.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

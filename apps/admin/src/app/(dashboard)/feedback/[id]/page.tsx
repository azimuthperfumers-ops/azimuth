"use client";

import { use, useState } from "react";
import Link from "next/link";
import { ArrowLeft, PhoneCall } from "lucide-react";
import { toast } from "sonner";

import { Stars } from "@/components/feedback/stars";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { usePermissions } from "@/hooks/use-permissions";
import { trpc } from "@/lib/trpc";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="mt-1 text-sm">{children}</div>
    </div>
  );
}

export default function FeedbackDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const utils = trpc.useUtils();
  const { can } = usePermissions();
  const writable = can("feedback", "write");

  const { data, isLoading } = trpc.feedback.adminGet.useQuery({ id });

  const [note, setNote] = useState<string | null>(null);
  const noteValue = note ?? data?.internalNote ?? "";

  const setStatus = trpc.feedback.adminSetStatus.useMutation({
    onSuccess: async () => {
      toast.success("Status updated");
      await Promise.all([
        utils.feedback.adminGet.invalidate({ id }),
        utils.feedback.adminList.invalidate(),
        utils.feedback.adminStats.invalidate(),
      ]);
    },
    onError: (e) => toast.error(e.message),
  });

  const saveNote = trpc.feedback.adminSetNote.useMutation({
    onSuccess: async () => {
      toast.success("Note saved");
      await utils.feedback.adminGet.invalidate({ id });
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) return <div className="h-64 animate-pulse rounded-xl bg-muted" />;
  if (!data) return <p className="text-sm text-muted-foreground">Feedback not found.</p>;

  return (
    <div className="max-w-3xl space-y-6">
      <Link
        href="/feedback"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        All feedback
      </Link>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-title font-semibold">
            <Link href={`/orders/${data.orderId}`} className="font-mono hover:underline">
              {data.orderNumber}
            </Link>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {data.customerName} · {data.customerEmail}
          </p>
        </div>
        {writable && (
          <Select
            value={data.status}
            onValueChange={(value) =>
              setStatus.mutate({ id, status: value as "new" | "reviewed" | "archived" })
            }
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="reviewed">Reviewed</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      {/* ── The experience ──────────────────────────────────────────────── */}
      <div className="space-y-5 rounded-xl border bg-card p-5">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <Field label="Experience">
            {data.rating != null ? <Stars rating={data.rating} /> : "—"}
          </Field>
          <Field label="Received">
            {new Date(data.createdAt).toLocaleString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </Field>
          <Field label="Source">
            {data.source === "staff" ? (
              <Badge variant="secondary" className="gap-1.5">
                <PhoneCall className="size-3" />
                Logged by {data.recordedBy ?? "staff"}
              </Badge>
            ) : (
              <Badge variant="outline">Customer</Badge>
            )}
          </Field>
        </div>

        <Field label="Comment">
          {data.comment ? (
            <p className="whitespace-pre-wrap leading-relaxed">{data.comment}</p>
          ) : (
            <span className="text-muted-foreground">No comment left.</span>
          )}
        </Field>
      </div>

      {/* ── Per-fragrance reviews ───────────────────────────────────────── */}
      {data.products.length > 0 && (
        <div className="rounded-xl border bg-card">
          <div className="border-b px-5 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Fragrance reviews from this order
            </p>
          </div>
          <div className="divide-y">
            {data.products.map((p) => (
              <div key={p.productId} className="space-y-2 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Link
                    href={`/products/${p.productId}`}
                    className="text-sm font-medium hover:underline"
                  >
                    {p.productName}
                  </Link>
                  {p.rating != null && <Stars rating={p.rating} />}
                </div>
                {p.review && (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                    {p.review}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Internal note ───────────────────────────────────────────────── */}
      <div className="space-y-3 rounded-xl border bg-card p-5">
        <div>
          <p className="text-sm font-medium">Internal note</p>
          <p className="text-xs text-muted-foreground">
            Staff-only. The customer never sees this.
          </p>
        </div>
        <Textarea
          value={noteValue}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
          maxLength={2000}
          disabled={!writable}
          placeholder="What did we do about it?"
        />
        {writable && (
          <Button
            onClick={() => saveNote.mutate({ id, internalNote: noteValue })}
            disabled={saveNote.isPending || noteValue === (data.internalNote ?? "")}
          >
            {saveNote.isPending ? "Saving…" : "Save note"}
          </Button>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Settings, Activity, CheckCircle2, XCircle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";

// ── Health Check ──────────────────────────────────────────────────────────────

type CheckResult = {
  ok: boolean;
  error?: string | null;
  uptimeSeconds?: number;
  memoryMb?: number;
};

type HealthData = {
  server: CheckResult & { uptimeSeconds: number; memoryMb: number };
  db: CheckResult;
  redis: CheckResult;
  queue: CheckResult;
  worker: CheckResult;
};

function StatusBadge({ ok, error }: { ok: boolean; error?: string | null }) {
  if (ok) {
    return (
      <Badge variant="outline" className="gap-1 border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-400">
        <CheckCircle2 className="size-3" />
        OK
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
      <XCircle className="size-3" />
      {error ? "Error" : "Down"}
    </Badge>
  );
}

function HealthRow({ label, result }: { label: string; result: CheckResult }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b last:border-0">
      <div className="space-y-0.5">
        <p className="text-sm font-medium">{label}</p>
        {result.error && (
          <p className="text-[11px] text-destructive font-mono">{result.error}</p>
        )}
        {result.uptimeSeconds !== undefined && (
          <p className="text-[11px] text-muted-foreground">
            Uptime: {Math.floor(result.uptimeSeconds / 3600)}h {Math.floor((result.uptimeSeconds % 3600) / 60)}m
            {result.memoryMb !== undefined && ` · RSS: ${result.memoryMb} MB`}
          </p>
        )}
      </div>
      <StatusBadge ok={result.ok} error={result.error} />
    </div>
  );
}

function HealthCheckCard() {
  const [data, setData] = useState<HealthData | null>(null);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);

  const check = trpc.health.check.useQuery(undefined, { enabled: false });

  async function runCheck() {
    const result = await check.refetch();
    if (result.data) {
      setData(result.data);
      setCheckedAt(new Date());
    } else if (result.error) {
      toast.error(result.error.message);
    }
  }

  const allOk = data ? Object.values(data).every((r) => r.ok) : null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="size-4 text-muted-foreground" />
            System Health
          </CardTitle>
          <div className="flex items-center gap-2">
            {checkedAt && (
              <span className="text-[11px] text-muted-foreground">
                {checkedAt.toLocaleTimeString()}
              </span>
            )}
            {allOk !== null && (
              <Badge
                variant="outline"
                className={allOk
                  ? "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-400"
                  : "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400"
                }
              >
                {allOk ? "All systems operational" : "Degraded"}
              </Badge>
            )}
            <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={runCheck} disabled={check.isFetching}>
              {check.isFetching ? <Loader2 className="size-3.5 animate-spin" /> : <Activity className="size-3.5" />}
              {check.isFetching ? "Checking…" : "Run check"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!data && !check.isFetching && (
          <p className="text-sm text-muted-foreground py-2">Click "Run check" to test connectivity.</p>
        )}
        {check.isFetching && (
          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Pinging services…
          </div>
        )}
        {data && !check.isFetching && (
          <div>
            <HealthRow label="Server" result={data.server} />
            <HealthRow label="Worker" result={data.worker} />
            <HealthRow label="Database (PostgreSQL)" result={data.db} />
            <HealthRow label="Cache (Redis)" result={data.redis} />
            <HealthRow label="Job Queue (BullMQ)" result={data.queue} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { data, isLoading } = trpc.settings.get.useQuery();
  const utils = trpc.useUtils();

  const [threshold, setThreshold] = useState("");

  useEffect(() => {
    if (data) setThreshold(String(data.freeShippingAboveInr));
  }, [data]);

  const update = trpc.settings.update.useMutation({
    onSuccess: async (res) => {
      await utils.settings.get.invalidate();
      toast.success(`Free shipping threshold set to ₹${res.freeShippingAboveInr}`);
    },
    onError: (err) => toast.error(err.message),
  });

  function onSave() {
    const val = Number(threshold);
    if (isNaN(val) || val < 0) {
      toast.error("Enter a valid amount (0 = always free)");
      return;
    }
    update.mutate({ freeShippingAboveInr: val });
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-title font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">Store-wide configuration.</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings className="size-4 text-muted-foreground" />
            Shipping policy
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Free shipping above (₹)
            </label>
            <p className="text-[11px] text-muted-foreground/60">
              Orders at or above this subtotal get free shipping (shipping cost absorbed by store).
              Set to 0 to always charge shipping.
            </p>
            <div className="flex gap-2 mt-2">
              <Input
                type="number"
                min="0"
                step="1"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                disabled={isLoading}
                className="w-36 h-9 text-sm"
                placeholder="999"
              />
              <Button
                size="sm"
                className="h-9"
                onClick={onSave}
                disabled={update.isPending || isLoading}
              >
                {update.isPending ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <HealthCheckCard />
    </div>
  );
}

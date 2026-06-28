"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Settings } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";

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
    </div>
  );
}

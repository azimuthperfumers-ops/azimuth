"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

// Storefront rating control: "mock" shows the configured placeholder numbers
// until enough real ratings accumulate; "real" shows the true customer average.
export function ProductRatingCard({ productId }: { productId: string }) {
  const { data, isLoading } = trpc.rating.adminGetForProduct.useQuery({ productId });

  if (isLoading || !data) {
    return (
      <Card>
        <CardHeader><CardTitle>Storefront rating</CardTitle></CardHeader>
        <CardContent><div className="h-24 animate-pulse rounded bg-muted" /></CardContent>
      </Card>
    );
  }

  return <RatingCardForm key={productId} productId={productId} data={data} />;
}

function RatingCardForm({
  productId,
  data,
}: {
  productId: string;
  data: { mode: "real" | "mock"; mockRating: number; mockRatingCount: number; realRating: number | null; realCount: number };
}) {
  const utils = trpc.useUtils();
  const [mockRating, setMockRating] = useState(String(data.mockRating));
  const [mockCount, setMockCount] = useState(String(data.mockRatingCount));

  const setDisplay = trpc.rating.adminSetDisplay.useMutation({
    onSuccess: () => {
      utils.rating.adminGetForProduct.invalidate({ productId });
      toast.success("Rating display updated");
    },
    onError: (e) => toast.error(e.message),
  });

  function save(mode: "real" | "mock") {
    const ratingNum = Math.round(Number(mockRating) * 10) / 10;
    const countNum = Math.round(Number(mockCount));
    if (mode === "mock" && (Number.isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5)) {
      toast.error("Mock rating must be between 1.0 and 5.0");
      return;
    }
    if (mode === "mock" && (Number.isNaN(countNum) || countNum < 0)) {
      toast.error("Mock count must be 0 or more");
      return;
    }
    setDisplay.mutate({
      productId,
      mode,
      mockRating: Number.isNaN(ratingNum) ? undefined : ratingNum,
      mockRatingCount: Number.isNaN(countNum) ? undefined : countNum,
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Storefront rating</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Real stats */}
        <div className="flex items-center gap-2 text-sm">
          <Star className="size-4 fill-foreground text-foreground" />
          <span className="font-medium">
            {data.realRating != null ? `${data.realRating.toFixed(1)} from ${data.realCount} customer rating${data.realCount === 1 ? "" : "s"}` : "No customer ratings yet"}
          </span>
        </div>

        {/* Mode switch */}
        <div className="flex gap-2">
          {(["mock", "real"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => save(m)}
              disabled={setDisplay.isPending}
              className={cn(
                "rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
                data.mode === m
                  ? "border-foreground bg-foreground text-background"
                  : "hover:bg-muted",
              )}
            >
              {m === "mock" ? "Mock rating" : "Real ratings"}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {data.mode === "mock"
            ? "Storefront shows the placeholder numbers below. Switch to real once enough customers have rated."
            : "Storefront shows the true customer average. With zero ratings, no stars are shown."}
        </p>

        {/* Mock values */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="mock-rating">Mock rating (1.0–5.0)</Label>
            <Input
              id="mock-rating"
              type="number" min={1} max={5} step={0.1}
              value={mockRating}
              onChange={(e) => setMockRating(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mock-count">Mock rating count</Label>
            <Input
              id="mock-count"
              type="number" min={0} step={1}
              value={mockCount}
              onChange={(e) => setMockCount(e.target.value)}
            />
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={setDisplay.isPending}
          onClick={() => save(data.mode)}
        >
          Save mock values
        </Button>
      </CardContent>
    </Card>
  );
}

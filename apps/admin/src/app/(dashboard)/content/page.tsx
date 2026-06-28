"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Image as ImageIcon, Loader2, Plus, Trash2, Eye, EyeOff, GripVertical } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";

// ─── Types ───────────────────────────────────────────────────────────────────

type HomeHeroData = {
  line1: string;
  line2: string;
  italic: string;
  subtitle: string;
};

type OurStoryData = {
  headerSubtitle: string;
  originBlockquote: string;
  originBody: string;
  pullquote: string;
  founderBody: string;
};

type Banner = {
  id: string;
  page: string;
  imageUrl: string;
  alt: string;
  sortOrder: number;
  active: boolean;
};

const HOME_HERO_DEFAULTS: HomeHeroData = {
  line1: "Scent,",
  line2: "composed",
  italic: "like memory.",
  subtitle: "Eaux de parfum blended in small batches — naturals, resins and time, until an accord becomes unmistakably yours.",
};

const OUR_STORY_DEFAULTS: OurStoryData = {
  headerSubtitle: "We make perfume the slow way. No shortcuts, no synthetic proxies pretending to be naturals. Only raw materials with stories, blended until something true emerges.",
  originBlockquote: "An azimuth is a bearing — a precise angle from true north. We chose that name because every fragrance we build is a direction, not a decoration.",
  originBody: [
    "Azimuth Perfumers began in a single room in 2019 — a rented space, secondhand glassware, and a notebook filled with the kind of obsessive notes that either become something great or remain quietly embarrassing.",
    "The founding premise was simple and inconvenient: India has some of the world's finest raw perfumery materials — ouds from Assam, rose attar from Kannauj, sandalwood from Mysore, vetiver from Rajasthan — and most of them were being exported, processed abroad, and sold back to us as \"luxury imports.\" We wanted to close that loop.",
    "We make our accords entirely in India, from materials sourced directly from Indian farmers and distillers. Each batch is under two hundred units. Nothing is rushed. We have a saying in the lab: if the accord is not ready, the batch does not ship.",
    "The result is a house of slow perfumery — uncompromising, small, and stubbornly itself.",
  ].join("\n\n"),
  pullquote: "Most fragrance is built to please everyone and so pleases no one deeply. We build to please the one person who has been looking for exactly this.",
  founderBody: [
    "I have been asked many times why we don't scale. Why we cap batches. Why we refuse to move to a larger facility and simply make more.",
    "The honest answer is that I don't know how to make perfume at scale without it becoming something else. The small batch is not a marketing decision — it is the only format in which I can personally smell every bottle before it leaves the lab. And that matters to me more than growth.",
    "When you wear an Azimuth fragrance, I want you to know that a human being paid close attention to it. Not a machine, not a process, not an algorithm. A person who cares enormously about the difference between good and correct.",
  ].join("\n\n"),
};

// ─── Banner uploader ─────────────────────────────────────────────────────────

function BannerUploader({ page, onUploaded }: { page: "home" | "shop"; onUploaded: (url: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const getUrl = trpc.storage.getBannerUploadUrl.useMutation();

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Only image files allowed");
      return;
    }
    setUploading(true);
    try {
      const { uploadUrl, publicUrl } = await getUrl.mutateAsync({ filename: file.name, contentType: file.type });
      const res = await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      if (!res.ok) throw new Error(`Upload failed (${res.status})`);
      onUploaded(publicUrl);
      toast.success("Banner uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); e.target.value = ""; }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className="gap-2"
      >
        {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
        Add banner
      </Button>
    </div>
  );
}

// ─── Banner list ─────────────────────────────────────────────────────────────

function BannerList({ page }: { page: "home" | "shop" }) {
  const utils = trpc.useUtils();
  const banners = trpc.content.listBanners.useQuery({ page });

  const create = trpc.content.createBanner.useMutation({
    onSuccess: () => utils.content.listBanners.invalidate({ page }),
    onError: (e) => toast.error(e.message),
  });
  const update = trpc.content.updateBanner.useMutation({
    onSuccess: () => utils.content.listBanners.invalidate({ page }),
    onError: (e) => toast.error(e.message),
  });
  const remove = trpc.content.deleteBanner.useMutation({
    onSuccess: () => utils.content.listBanners.invalidate({ page }),
    onError: (e) => toast.error(e.message),
  });

  function onUploaded(imageUrl: string) {
    create.mutate({ page, imageUrl, alt: "" });
  }

  function toggleActive(b: Banner) {
    update.mutate({ id: b.id, active: !b.active });
  }

  function moveUp(b: Banner, idx: number) {
    if (idx === 0) return;
    const prev = banners.data![idx - 1]!;
    update.mutate({ id: b.id, sortOrder: prev.sortOrder });
    update.mutate({ id: prev.id, sortOrder: b.sortOrder });
  }

  function moveDown(b: Banner, idx: number) {
    const list = banners.data!;
    if (idx === list.length - 1) return;
    const next = list[idx + 1]!;
    update.mutate({ id: b.id, sortOrder: next.sortOrder });
    update.mutate({ id: next.id, sortOrder: b.sortOrder });
  }

  const list = banners.data ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {page === "home" ? "Home page" : "Shop page"} banners
        </p>
        <BannerUploader page={page} onUploaded={onUploaded} />
      </div>

      {banners.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {!banners.isLoading && list.length === 0 && (
        <p className="text-sm text-muted-foreground/60 py-4 border border-dashed border-border text-center">
          No banners yet — upload one above
        </p>
      )}

      <div className="space-y-2">
        {list.map((b, idx) => (
          <div key={b.id} className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 p-2">
            <GripVertical className="size-4 text-muted-foreground/40 shrink-0" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={b.imageUrl} alt={b.alt || "banner"} className="size-16 rounded object-cover shrink-0 bg-muted" />
            <div className="flex-1 min-w-0 space-y-1">
              <Input
                value={b.alt}
                onChange={(e) => update.mutate({ id: b.id, alt: e.target.value })}
                placeholder="Alt text…"
                className="h-7 text-xs"
              />
              <p className="text-[10px] text-muted-foreground/50 truncate">{b.imageUrl}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button type="button" variant="ghost" size="icon" className="size-7" onClick={() => moveUp(b as Banner, idx)} disabled={idx === 0}>
                <span className="text-xs">↑</span>
              </Button>
              <Button type="button" variant="ghost" size="icon" className="size-7" onClick={() => moveDown(b as Banner, idx)} disabled={idx === list.length - 1}>
                <span className="text-xs">↓</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={() => toggleActive(b as Banner)}
                title={b.active ? "Deactivate" : "Activate"}
              >
                {b.active ? <Eye className="size-3.5 text-green-600" /> : <EyeOff className="size-3.5 text-muted-foreground" />}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 text-destructive hover:text-destructive"
                onClick={() => remove.mutate({ id: b.id })}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Home Hero editor ─────────────────────────────────────────────────────────

function HomeHeroEditor() {
  const { data, isLoading } = trpc.content.getSection.useQuery({ section: "home_hero" });
  const utils = trpc.useUtils();
  const [form, setForm] = useState<HomeHeroData>(HOME_HERO_DEFAULTS);

  useEffect(() => {
    if (data && Object.keys(data).length > 0) {
      setForm({ ...HOME_HERO_DEFAULTS, ...(data as Partial<HomeHeroData>) });
    }
  }, [data]);

  const save = trpc.content.updateSection.useMutation({
    onSuccess: () => {
      utils.content.getSection.invalidate({ section: "home_hero" });
      toast.success("Home hero saved");
    },
    onError: (e) => toast.error(e.message),
  });

  function field(key: keyof HomeHeroData, label: string, hint?: string) {
    return (
      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</label>
        {hint && <p className="text-[11px] text-muted-foreground/60">{hint}</p>}
        <Input
          value={form[key]}
          onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
          disabled={isLoading}
          className="h-9 text-sm"
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {field("line1", "Headline line 1", "e.g. \"Scent,\"")}
      {field("line2", "Headline line 2", "e.g. \"composed\"")}
      {field("italic", "Italic line", "Shown larger, in italic accent colour")}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Subtitle</label>
        <Textarea
          value={form.subtitle}
          onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))}
          disabled={isLoading}
          rows={3}
          className="text-sm resize-none"
        />
      </div>
      <Button
        size="sm"
        onClick={() => save.mutate({ section: "home_hero", data: form })}
        disabled={save.isPending || isLoading}
      >
        {save.isPending ? "Saving…" : "Save home hero"}
      </Button>
    </div>
  );
}

// ─── Our Story editor ─────────────────────────────────────────────────────────

function OurStoryEditor() {
  const { data, isLoading } = trpc.content.getSection.useQuery({ section: "our_story" });
  const utils = trpc.useUtils();
  const [form, setForm] = useState<OurStoryData>(OUR_STORY_DEFAULTS);

  useEffect(() => {
    if (data && Object.keys(data).length > 0) {
      setForm({ ...OUR_STORY_DEFAULTS, ...(data as Partial<OurStoryData>) });
    }
  }, [data]);

  const save = trpc.content.updateSection.useMutation({
    onSuccess: () => {
      utils.content.getSection.invalidate({ section: "our_story" });
      toast.success("Our Story saved");
    },
    onError: (e) => toast.error(e.message),
  });

  function textField(key: keyof OurStoryData, label: string, hint?: string, rows = 3) {
    return (
      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</label>
        {hint && <p className="text-[11px] text-muted-foreground/60">{hint}</p>}
        <Textarea
          value={form[key]}
          onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
          disabled={isLoading}
          rows={rows}
          className="text-sm resize-y"
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {textField("headerSubtitle", "Page subtitle", "Shown below the 'Our Story' heading", 2)}
      {textField("originBlockquote", "Origin blockquote", "The large pull-quote in the two-column section", 3)}
      {textField("originBody", "Origin body", "Separate paragraphs with a blank line (double newline)", 8)}
      {textField("pullquote", "Dark section pullquote", "The quote shown on the dark background section", 3)}
      {textField("founderBody", "Founder's note", "Separate paragraphs with a blank line (double newline)", 8)}
      <Button
        size="sm"
        onClick={() => save.mutate({ section: "our_story", data: form })}
        disabled={save.isPending || isLoading}
      >
        {save.isPending ? "Saving…" : "Save our story"}
      </Button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ContentPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-title font-semibold">Content</h1>
        <p className="text-sm text-muted-foreground">Edit store-front copy and banner images.</p>
      </div>

      <Tabs defaultValue="banners">
        <TabsList className="mb-6">
          <TabsTrigger value="banners">Banners</TabsTrigger>
          <TabsTrigger value="home">Home</TabsTrigger>
          <TabsTrigger value="story">Our Story</TabsTrigger>
        </TabsList>

        <TabsContent value="banners">
          <div className="space-y-8">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ImageIcon className="size-4 text-muted-foreground" />
                  Banner images
                </CardTitle>
                <p className="text-[12px] text-muted-foreground">
                  Active banners rotate with a crossfade transition on the storefront. Inactive banners are hidden.
                </p>
              </CardHeader>
              <CardContent className="space-y-8">
                <BannerList page="home" />
                <div className="h-px bg-border" />
                <BannerList page="shop" />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="home">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Home hero text</CardTitle>
              <p className="text-[12px] text-muted-foreground">Shown over the hero section on the homepage.</p>
            </CardHeader>
            <CardContent>
              <HomeHeroEditor />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="story">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Our Story page</CardTitle>
              <p className="text-[12px] text-muted-foreground">Edit key text sections. Timeline, ingredients, and craft steps remain fixed.</p>
            </CardHeader>
            <CardContent>
              <OurStoryEditor />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

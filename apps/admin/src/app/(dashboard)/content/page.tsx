"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  BookOpen,
  Droplets,
  Eye,
  EyeOff,
  GripVertical,
  Home,
  Image as ImageIcon,
  Layers,
  Loader2,
  Palette,
  Plus,
  ShoppingBag,
  Star,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { FeaturedPicker } from "@/components/content/featured-picker";
import { LivePreview, type ProductLite } from "@/components/content/live-preview";
import { SANS_FONTS, SERIF_FONTS } from "@/components/content/fonts";
import {
  HOME_HERO_DEFAULTS,
  LANDING_IMAGERY_DEFAULTS,
  OUR_STORY_DEFAULTS,
  SHOP_COVER_DEFAULTS,
  THEME_COLOR_FIELDS,
  THEME_DEFAULTS,
  type HomeHero,
  type LandingImagery,
  type OurStory,
  type ShopCover,
  type Surface,
  type ThemeTokens,
} from "@/components/content/types";

// ─── Small control primitives ───────────────────────────────────────────────

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</label>
      {hint && <p className="text-[11px] text-muted-foreground/60">{hint}</p>}
      {children}
    </div>
  );
}

function ColorField({ label, hint, value, onChange }: { label: string; hint: string; value: string; onChange: (v: string) => void }) {
  return (
    <Field label={label} hint={hint}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="size-9 shrink-0 cursor-pointer rounded border border-border bg-transparent p-0.5"
        />
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-9 font-mono text-sm" />
      </div>
    </Field>
  );
}

function FontSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { key: string; label: string }[] }) {
  return (
    <Field label={label}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.key} value={o.key}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

function SaveBar({ onSave, saving, dirty }: { onSave: () => void; saving: boolean; dirty: boolean }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <Button size="sm" onClick={onSave} disabled={saving || !dirty}>
        {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
      </Button>
      {dirty && <span className="text-[11px] text-muted-foreground">Unsaved changes</span>}
    </div>
  );
}

// ─── Banner uploader + list (reused from the previous content page) ──────────

function BannerUploader({ page, onUploaded }: { page: "home" | "shop"; onUploaded: (url: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const getUrl = trpc.storage.getBannerUploadUrl.useMutation();

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) return toast.error("Only image files allowed");
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
      <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => inputRef.current?.click()} className="gap-2">
        {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
        Add banner
      </Button>
    </div>
  );
}

type Banner = { id: string; page: string; imageUrl: string; alt: string; sortOrder: number; active: boolean };

function BannerList({ page }: { page: "home" | "shop" }) {
  const utils = trpc.useUtils();
  const banners = trpc.content.listBanners.useQuery({ page });
  const create = trpc.content.createBanner.useMutation({ onSuccess: () => utils.content.listBanners.invalidate({ page }), onError: (e) => toast.error(e.message) });
  const update = trpc.content.updateBanner.useMutation({ onSuccess: () => utils.content.listBanners.invalidate({ page }), onError: (e) => toast.error(e.message) });
  const remove = trpc.content.deleteBanner.useMutation({ onSuccess: () => utils.content.listBanners.invalidate({ page }), onError: (e) => toast.error(e.message) });

  const list = (banners.data ?? []) as Banner[];

  function move(b: Banner, idx: number, dir: -1 | 1) {
    const other = list[idx + dir];
    if (!other) return;
    update.mutate({ id: b.id, sortOrder: other.sortOrder });
    update.mutate({ id: other.id, sortOrder: b.sortOrder });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{page} banners</p>
        <BannerUploader page={page} onUploaded={(imageUrl) => create.mutate({ page, imageUrl, alt: "" })} />
      </div>
      {!banners.isLoading && list.length === 0 && (
        <p className="border border-dashed border-border py-4 text-center text-sm text-muted-foreground/60">No banners yet — upload one above</p>
      )}
      <div className="space-y-2">
        {list.map((b, idx) => (
          <div key={b.id} className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 p-2">
            <GripVertical className="size-4 shrink-0 text-muted-foreground/40" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={b.imageUrl} alt={b.alt || "banner"} className="size-16 shrink-0 rounded bg-muted object-cover" />
            <div className="min-w-0 flex-1">
              <Input value={b.alt} onChange={(e) => update.mutate({ id: b.id, alt: e.target.value })} placeholder="Alt text…" className="h-7 text-xs" />
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button type="button" variant="ghost" size="icon" className="size-7" onClick={() => move(b, idx, -1)} disabled={idx === 0}>↑</Button>
              <Button type="button" variant="ghost" size="icon" className="size-7" onClick={() => move(b, idx, 1)} disabled={idx === list.length - 1}>↓</Button>
              <Button type="button" variant="ghost" size="icon" className="size-7" onClick={() => update.mutate({ id: b.id, active: !b.active })} title={b.active ? "Deactivate" : "Activate"}>
                {b.active ? <Eye className="size-3.5 text-green-600" /> : <EyeOff className="size-3.5 text-muted-foreground" />}
              </Button>
              <Button type="button" variant="ghost" size="icon" className="size-7 text-destructive hover:text-destructive" onClick={() => remove.mutate({ id: b.id })}>
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Landing imagery: real ingredient/mood photos in the drift columns ───────

function IngredientImageUploader({ onUploaded }: { onUploaded: (url: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const getUrl = trpc.storage.getLandingUploadUrl.useMutation();

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) return toast.error("Only image files allowed");
    setUploading(true);
    try {
      const { uploadUrl, publicUrl } = await getUrl.mutateAsync({ filename: file.name, contentType: file.type });
      const res = await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      if (!res.ok) throw new Error(`Upload failed (${res.status})`);
      onUploaded(publicUrl);
      toast.success("Image uploaded");
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
      <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => inputRef.current?.click()} className="gap-2">
        {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
        Add image
      </Button>
    </div>
  );
}

function IngredientImageManager({
  items,
  onChange,
}: {
  items: { url: string; label: string }[];
  onChange: (items: { url: string; label: string }[]) => void;
}) {
  function setLabel(idx: number, label: string) {
    onChange(items.map((it, i) => (i === idx ? { ...it, label } : it)));
  }
  function remove(idx: number) {
    onChange(items.filter((_, i) => i !== idx));
  }
  function move(idx: number, dir: -1 | 1) {
    const to = idx + dir;
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    [next[idx], next[to]] = [next[to]!, next[idx]!];
    onChange(next);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ingredient photos</p>
        <IngredientImageUploader onUploaded={(url) => onChange([...items, { url, label: "" }])} />
      </div>
      <p className="text-[11px] text-muted-foreground/60">
        These real photos drift in the &ldquo;small batch&rdquo; panel on the home page, mixed with your product bottles. Leave empty to use the bundled defaults.
      </p>
      {items.length === 0 && (
        <p className="border border-dashed border-border py-4 text-center text-sm text-muted-foreground/60">Using bundled defaults — upload to override</p>
      )}
      <div className="space-y-2">
        {items.map((it, idx) => (
          <div key={idx} className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 p-2">
            <GripVertical className="size-4 shrink-0 text-muted-foreground/40" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={it.url} alt={it.label || "ingredient"} className="size-16 shrink-0 rounded bg-muted object-cover" />
            <div className="min-w-0 flex-1">
              <Input value={it.label} onChange={(e) => setLabel(idx, e.target.value)} placeholder="Label (e.g. Amber)…" className="h-7 text-xs" />
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button type="button" variant="ghost" size="icon" className="size-7" onClick={() => move(idx, -1)} disabled={idx === 0}>↑</Button>
              <Button type="button" variant="ghost" size="icon" className="size-7" onClick={() => move(idx, 1)} disabled={idx === items.length - 1}>↓</Button>
              <Button type="button" variant="ghost" size="icon" className="size-7 text-destructive hover:text-destructive" onClick={() => remove(idx)}>
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Draft hook: load a content section into local state ─────────────────────

function useSectionDraft<T extends Record<string, unknown>>(section: string, defaults: T) {
  const { data, isLoading } = trpc.content.getSection.useQuery({ section });
  const utils = trpc.useUtils();
  const [draft, setDraft] = useState<T>(defaults);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (data && !loaded) {
      setDraft({ ...defaults, ...(data as Partial<T>) });
      setLoaded(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, loaded]);

  const save = trpc.content.updateSection.useMutation({
    onSuccess: () => {
      utils.content.getSection.invalidate({ section });
      toast.success("Saved");
    },
    onError: (e) => toast.error(e.message),
  });

  return {
    draft,
    setDraft,
    isLoading,
    saving: save.isPending,
    persist: () => save.mutate({ section, data: draft }),
  };
}

// ─── Page ────────────────────────────────────────────────────────────────────

const SURFACES: { key: Surface; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "theme", label: "Theme", icon: Palette },
  { key: "home", label: "Home", icon: Home },
  { key: "shop", label: "Shop", icon: ShoppingBag },
  { key: "story", label: "Our Story", icon: BookOpen },
  { key: "featured", label: "Featured", icon: Star },
  { key: "landing", label: "Landing", icon: Droplets },
  { key: "banners", label: "Banners", icon: Layers },
];

export default function ContentPage() {
  const [surface, setSurface] = useState<Surface>("theme");

  const theme = useSectionDraft<ThemeTokens>("theme", THEME_DEFAULTS);
  const home = useSectionDraft<HomeHero>("home_hero", HOME_HERO_DEFAULTS);
  const shop = useSectionDraft<ShopCover>("shop_cover", SHOP_COVER_DEFAULTS);
  const story = useSectionDraft<OurStory>("our_story", OUR_STORY_DEFAULTS);
  const landing = useSectionDraft<LandingImagery>("landing_imagery", LANDING_IMAGERY_DEFAULTS);

  const products = trpc.catalog.listProducts.useQuery({ status: "active", limit: 100 });
  const allProducts = (products.data ?? []) as unknown as ProductLite[];
  const featuredProducts = allProducts.filter((p) => (p as { isFeatured?: boolean }).isFeatured);
  const previewProducts = featuredProducts.length > 0 ? featuredProducts : allProducts;

  const heroIds = home.draft.productIds ?? [];
  const heroSelected = heroIds
    .map((id) => allProducts.find((p) => p.id === id))
    .filter((p): p is ProductLite => !!p);

  function toggleHero(id: string) {
    home.setDraft((d) => {
      const ids = d.productIds ?? [];
      return { ...d, productIds: ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id] };
    });
  }

  const imgUrl = (p: ProductLite) => (p.images?.find((i) => i.isPrimary) ?? p.images?.[0])?.url;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-title font-semibold">Content playground</h1>
        <p className="text-sm text-muted-foreground">
          Restyle the storefront live — colours, fonts, copy, images, featured products. Changes preview instantly; hit save to publish.
        </p>
      </div>

      {/* Surface switcher */}
      <div className="flex flex-wrap gap-2">
        {SURFACES.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setSurface(key)}
            className={cn(
              "flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
              surface === key ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary/40",
            )}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        {/* ── Controls ── */}
        <div className="space-y-5">
          {surface === "theme" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {THEME_COLOR_FIELDS.map((f) => (
                  <ColorField
                    key={f.key}
                    label={f.label}
                    hint={f.hint}
                    value={theme.draft[f.key] as string}
                    onChange={(v) => theme.setDraft((d) => ({ ...d, [f.key]: v }))}
                  />
                ))}
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FontSelect label="Heading font" value={theme.draft.fontHeading} options={SERIF_FONTS} onChange={(v) => theme.setDraft((d) => ({ ...d, fontHeading: v }))} />
                <FontSelect label="Body font" value={theme.draft.fontBody} options={SANS_FONTS} onChange={(v) => theme.setDraft((d) => ({ ...d, fontBody: v }))} />
              </div>
              <Button size="sm" variant="ghost" onClick={() => theme.setDraft(THEME_DEFAULTS)} className="text-xs">
                Reset to defaults
              </Button>
              <SaveBar onSave={theme.persist} saving={theme.saving} dirty />
            </div>
          )}

          {surface === "home" && (
            <div className="space-y-4">
              <Field label="Headline line 1"><Input value={home.draft.line1} onChange={(e) => home.setDraft((d) => ({ ...d, line1: e.target.value }))} className="h-9" /></Field>
              <Field label="Italic accent line" hint="Shown in the accent colour"><Input value={home.draft.italic} onChange={(e) => home.setDraft((d) => ({ ...d, italic: e.target.value }))} className="h-9" /></Field>
              <Field label="Subtitle"><Textarea rows={3} value={home.draft.subtitle} onChange={(e) => home.setDraft((d) => ({ ...d, subtitle: e.target.value }))} className="resize-none text-sm" /></Field>
              <Field label="Hero products" hint="Tap to add — chosen products auto-switch as a carousel in the hero. Number = order.">
                <div className="grid grid-cols-3 gap-2">
                  {allProducts.map((p) => {
                    const idx = heroIds.indexOf(p.id);
                    const sel = idx >= 0;
                    const url = imgUrl(p);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => toggleHero(p.id)}
                        className={cn(
                          "group relative overflow-hidden rounded-lg border text-left transition-all",
                          sel ? "border-primary ring-2 ring-primary/40" : "border-border hover:border-primary/40",
                        )}
                      >
                        <div className="aspect-[3/4] bg-muted">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {url && <img src={url} alt={p.name} className="size-full object-cover" />}
                        </div>
                        {sel && (
                          <span className="absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                            {idx + 1}
                          </span>
                        )}
                        <div className="truncate p-1.5 text-[11px] font-medium">{p.name}</div>
                      </button>
                    );
                  })}
                </div>
              </Field>
              <SaveBar onSave={home.persist} saving={home.saving} dirty />
              <div className="border-t border-border pt-5"><BannerList page="home" /></div>
            </div>
          )}

          {surface === "shop" && (
            <div className="space-y-4">
              <Field label="Cover heading"><Input value={shop.draft.heading} onChange={(e) => shop.setDraft((d) => ({ ...d, heading: e.target.value }))} className="h-9" /></Field>
              <Field label="Cover subheading"><Textarea rows={2} value={shop.draft.subheading} onChange={(e) => shop.setDraft((d) => ({ ...d, subheading: e.target.value }))} className="resize-none text-sm" /></Field>
              <SaveBar onSave={shop.persist} saving={shop.saving} dirty />
              <div className="border-t border-border pt-5"><BannerList page="shop" /></div>
            </div>
          )}

          {surface === "story" && (
            <div className="space-y-4">
              <Field label="Page subtitle"><Textarea rows={2} value={story.draft.headerSubtitle} onChange={(e) => story.setDraft((d) => ({ ...d, headerSubtitle: e.target.value }))} className="resize-y text-sm" /></Field>
              <Field label="Origin blockquote"><Textarea rows={3} value={story.draft.originBlockquote} onChange={(e) => story.setDraft((d) => ({ ...d, originBlockquote: e.target.value }))} className="resize-y text-sm" /></Field>
              <Field label="Origin body" hint="Blank line between paragraphs"><Textarea rows={6} value={story.draft.originBody} onChange={(e) => story.setDraft((d) => ({ ...d, originBody: e.target.value }))} className="resize-y text-sm" /></Field>
              <Field label="Dark-section pullquote"><Textarea rows={3} value={story.draft.pullquote} onChange={(e) => story.setDraft((d) => ({ ...d, pullquote: e.target.value }))} className="resize-y text-sm" /></Field>
              <Field label="Founder's note" hint="Blank line between paragraphs"><Textarea rows={6} value={story.draft.founderBody} onChange={(e) => story.setDraft((d) => ({ ...d, founderBody: e.target.value }))} className="resize-y text-sm" /></Field>
              <SaveBar onSave={story.persist} saving={story.saving} dirty />
            </div>
          )}

          {surface === "featured" && <FeaturedPicker />}

          {surface === "landing" && (
            <div className="space-y-4">
              <IngredientImageManager
                items={landing.draft.ingredients ?? []}
                onChange={(ingredients) => landing.setDraft((d) => ({ ...d, ingredients }))}
              />
              <SaveBar onSave={landing.persist} saving={landing.saving} dirty />
            </div>
          )}

          {surface === "banners" && (
            <div className="space-y-6">
              <BannerList page="home" />
              <div className="border-t border-border pt-5"><BannerList page="shop" /></div>
            </div>
          )}
        </div>

        {/* ── Live preview ── */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Eye className="size-3.5" /> Live preview
          </p>
          <LivePreview
            surface={surface}
            theme={theme.draft}
            home={home.draft}
            shopCover={shop.draft}
            story={story.draft}
            featured={previewProducts}
            heroProducts={heroSelected}
          />
          <p className="mt-2 text-[11px] text-muted-foreground/60">
            A faithful mock — the real storefront updates after you save.
          </p>
        </div>
      </div>
    </div>
  );
}

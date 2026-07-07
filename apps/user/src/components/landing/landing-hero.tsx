import Link from "next/link";

import { primaryImage, type LandingProduct } from "./types";

type HeroCopy = {
  line1: string;
  italic: string;
  subtitle: string;
};

const NOTES_STRIP = [
  { label: "Opens with", value: "Saffron & bergamot" },
  { label: "Settles into", value: "Amber & sandalwood" },
  { label: "Lasts", value: "8+ hours on skin" },
];

function truncate(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

export function LandingHero({
  copy,
  signature,
  isLoading,
}: {
  copy: HeroCopy;
  signature: LandingProduct | undefined;
  isLoading: boolean;
}) {
  const image = signature ? primaryImage(signature) : undefined;
  const slug = signature ? (signature.slug ?? signature.id) : undefined;

  return (
    <section className="grid min-h-[calc(100vh-116px)] grid-cols-1 lg:grid-cols-2">
      {/* Copy */}
      <div className="flex flex-col justify-center px-6 py-12 sm:px-10 md:px-16 md:py-20">
        <div className="flex items-center gap-3.5 text-[11px] font-semibold tracking-[0.3em] text-[#9A5B2B] uppercase">
          <span className="inline-block h-px w-9 bg-[#9A5B2B]" />
          Eau de parfum · Small batch
        </div>

        <h1 className="font-heading mt-7 text-[clamp(2.8rem,5.6vw,5.5rem)] leading-[1.04] font-medium tracking-tight text-[#1B1611]">
          {copy.line1}
          <br />
          <em className="font-normal text-[#9A5B2B] italic">{copy.italic}</em>
        </h1>

        <p className="mt-7 max-w-[42ch] text-[16px] leading-[1.7] text-[#57493A]">
          {copy.subtitle}
        </p>

        <div className="mt-10 flex flex-wrap items-center gap-4.5">
          <a
            href="#quiz"
            className="bg-[#1B1611] px-8 py-4.5 text-[12px] font-semibold tracking-[0.2em] text-[#EFE6D6] uppercase transition-colors hover:bg-[#9A5B2B]"
          >
            Find your scent
          </a>
          <Link
            href="/shop"
            className="border-b border-[#1B1611]/35 py-4.5 text-[12px] font-semibold tracking-[0.2em] text-[#1B1611] uppercase transition-colors hover:border-[#9A5B2B] hover:text-[#9A5B2B]"
          >
            Shop the collection →
          </Link>
        </div>

        {/* Notes strip */}
        <div className="mt-16 flex flex-wrap gap-x-10 gap-y-7 border-t border-[#1B1611]/12 pt-6">
          {NOTES_STRIP.map((n) => (
            <div key={n.label}>
              <div className="text-[10px] tracking-[0.26em] text-[#8A7A63] uppercase">{n.label}</div>
              <div className="font-heading mt-1.5 text-[20px] text-[#1B1611] italic">{n.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Photo */}
      <div className="relative m-4 min-h-[420px] overflow-hidden sm:m-8 md:m-10 lg:mr-12 lg:ml-0">
        {isLoading ? (
          <div className="h-full min-h-[420px] w-full animate-pulse bg-[#E8DCC7]" />
        ) : image?.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image.url} alt={signature?.name ?? ""} className="h-full w-full object-cover" />
        ) : (
          <div className="h-full min-h-[420px] w-full bg-[#E8DCC7]" />
        )}

        {signature && !isLoading && (
          <Link
            href={slug ? `/shop/${slug}` : "/shop"}
            className="absolute bottom-6 left-6 max-w-[260px] bg-[#F5F0E7]/94 px-6 py-5 backdrop-blur-sm transition-opacity hover:opacity-90"
          >
            <div className="text-[10px] font-semibold tracking-[0.28em] text-[#9A5B2B] uppercase">
              {signature.isFeatured ? "Signature" : (signature.category?.name ?? "Fragrance")}
            </div>
            <div className="font-heading mt-1.5 text-[30px] text-[#1B1611]">{signature.name}</div>
            {signature.description && (
              <div className="mt-1 text-[12px] text-[#57493A]">
                {truncate(signature.description, 48)}
              </div>
            )}
          </Link>
        )}
      </div>
    </section>
  );
}

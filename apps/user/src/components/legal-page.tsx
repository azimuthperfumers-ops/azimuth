import type { ReactNode } from "react";

import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import type { LegalDoc } from "@/content/legal";

// Turns plain policy text into React, linkifying email addresses, tel numbers,
// and http(s) URLs so contact details are tappable. Everything else renders
// verbatim — the content modules stay pure text, no markup.
const TOKEN = /([\w.+-]+@[\w-]+\.[\w.-]+|\+?\d[\d\s]{7,}\d|https?:\/\/[^\s]+)/g;

function linkify(text: string): ReactNode[] {
  return text.split(TOKEN).map((part, i) => {
    if (i % 2 === 0) return part;
    const cls = "text-primary underline-offset-2 hover:underline";
    if (part.includes("@")) {
      return (
        <a key={i} href={`mailto:${part}`} className={cls}>
          {part}
        </a>
      );
    }
    if (part.startsWith("http")) {
      return (
        <a key={i} href={part} className={cls}>
          {part.replace(/^https?:\/\//, "")}
        </a>
      );
    }
    return (
      <a key={i} href={`tel:${part.replace(/\s/g, "")}`} className={cls}>
        {part}
      </a>
    );
  });
}

export function LegalPage({ doc }: { doc: LegalDoc }) {
  return (
    <>
      <SiteHeader />

      <main>
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <section className="border-b border-border">
          <div className="mx-auto max-w-[1400px] px-4 pt-20 pb-14 md:px-8 md:pt-28 md:pb-20">
            <p className="mb-3 text-[12px] font-semibold tracking-[0.2em] text-muted-foreground/50 uppercase">
              {doc.eyebrow}
            </p>
            <h1 className="font-heading text-[clamp(3rem,7vw,6rem)] font-medium leading-[0.95] tracking-tight text-foreground">
              {doc.title} <em className="text-primary italic">{doc.titleAccent}</em>
            </h1>
            <p className="mt-6 max-w-2xl text-[16px] leading-[1.75] text-muted-foreground">
              {doc.intro}
            </p>
            <p className="mt-6 text-[12px] tracking-[0.08em] text-muted-foreground/60 uppercase">
              Last updated · {doc.updated}
            </p>
          </div>
        </section>

        {/* ── Body ───────────────────────────────────────────────────────── */}
        <section className="mx-auto max-w-3xl px-4 py-16 md:px-8 md:py-24">
          <div className="space-y-14">
            {doc.sections.map((section, si) => (
              <article key={section.heading} className="scroll-mt-28">
                <div className="mb-5 flex items-baseline gap-4">
                  <span className="font-heading text-[15px] text-primary/40 tabular-nums">
                    {String(si + 1).padStart(2, "0")}
                  </span>
                  <h2 className="text-[13px] font-semibold tracking-[0.16em] text-foreground uppercase">
                    {section.heading}
                  </h2>
                </div>

                <div className="space-y-4 pl-0 sm:pl-9">
                  {section.blocks.map((block, bi) =>
                    block.type === "p" ? (
                      <p key={bi} className="text-[15px] leading-[1.85] text-muted-foreground">
                        {linkify(block.text)}
                      </p>
                    ) : (
                      <ul key={bi} className="space-y-2.5">
                        {block.items.map((item, ii) => (
                          <li
                            key={ii}
                            className="relative pl-5 text-[15px] leading-[1.8] text-muted-foreground before:absolute before:left-0 before:top-[0.7em] before:h-1 before:w-1 before:rounded-full before:bg-primary/50"
                          >
                            {linkify(item)}
                          </li>
                        ))}
                      </ul>
                    ),
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}

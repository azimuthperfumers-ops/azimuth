// Oversized italic scent notes drifting across the page — a breath between
// sections. Pauses on hover; disabled entirely under reduced motion.

const NOTES = [
  "Saffron",
  "Bergamot",
  "Oud",
  "Amber",
  "Sandalwood",
  "Rose",
  "Incense",
  "Vetiver",
  "Ylang Ylang",
  "Night Air",
];

export function NotesMarquee() {
  return (
    <section
      aria-hidden
      className="overflow-hidden border-y border-foreground/10 bg-card py-5"
    >
      <div className="notes-track items-baseline">
        {[0, 1].map((row) => (
          <div key={row} className="flex items-baseline whitespace-nowrap">
            {NOTES.map((note) => (
              <span key={note} className="flex items-baseline">
                <span className="font-heading px-7 text-[clamp(1.5rem,2.8vw,2.4rem)] leading-none text-foreground/75 italic">
                  {note}
                </span>
                <span className="text-[13px] text-primary">✳</span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

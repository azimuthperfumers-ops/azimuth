const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

export function QuoteBand() {
  return (
    <section className="relative overflow-hidden bg-[#1B1611] px-6 py-32 text-center sm:px-10 md:px-16">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{ backgroundImage: GRAIN, backgroundSize: "200px 200px" }}
      />
      <div className="relative">
        <div className="text-[11px] font-semibold tracking-[0.34em] text-[#B0793F] uppercase">
          The Azimuth Way
        </div>
        <blockquote className="font-heading mx-auto mt-7 max-w-[22ch] text-[clamp(2.2rem,4vw,3.9rem)] leading-[1.25] font-normal text-[#EFE6D6] italic">
          &ldquo;An accord becomes unmistakably yours.&rdquo;
        </blockquote>
      </div>
    </section>
  );
}

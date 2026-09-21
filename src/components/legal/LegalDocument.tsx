import { useEffect, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { LEGAL } from "@/lib/legal";
import { usePageMeta } from "@/lib/pageMeta";

/*
  The layout both legal documents share (Terms of Service, Privacy Policy), in
  the editorial (`.lp`) world the landing and sign-in pages use: cream ground,
  ink type, Instrument Serif for display, hairlines.

  A document is data: a title, a date, an intro, a short summary and a list of
  sections. The contents list and the text render from the same list, so they
  can never disagree.
*/

export type LegalSection = { id: string; title: string; body: ReactNode };

export const eyebrow = "text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--muted-2)]";
export const linkClass =
  "font-medium text-[var(--ink)] underline decoration-black/25 underline-offset-[3px] transition-colors hover:decoration-[var(--ink)]";
// Header and footer line up with the text column below lg, and with the
// contents rail + text column from lg up.
const barWidth = "mx-auto w-full max-w-[736px] px-5 sm:px-8 lg:max-w-[1120px]";

/* ---------- small building blocks for the copy ---------- */

/** A LEGAL value: highlighted while it is still a "[placeholder]", plain text once filled in. */
export function Fill({ children }: { children: string }) {
  if (!children.startsWith("[")) return <>{children}</>;
  return (
    <mark
      title="Placeholder: fill this in before publishing"
      className="box-decoration-clone rounded-[3px] bg-[#fef08a] px-1 text-[var(--ink)]"
    >
      {children}
    </mark>
  );
}

export function Mail({ subject }: { subject?: string }) {
  const href = `mailto:${LEGAL.email}${subject ? `?subject=${encodeURIComponent(subject)}` : ""}`;
  return (
    <a href={href} className={linkClass}>
      {LEGAL.email}
    </a>
  );
}

export function H3({ children }: { children: ReactNode }) {
  return <h3 className="pt-3 text-[16px] font-semibold leading-snug text-[var(--ink)]">{children}</h3>;
}

export function B({ children }: { children: ReactNode }) {
  return <strong className="font-semibold text-[var(--ink)]">{children}</strong>;
}

export function List({ ordered = false, children }: { ordered?: boolean; children: ReactNode }) {
  const cls = cn("space-y-2 pl-5 marker:text-[var(--muted-2)]", ordered ? "list-decimal" : "list-disc");
  return ordered ? <ol className={cls}>{children}</ol> : <ul className={cls}>{children}</ul>;
}

export function ContactDetails() {
  const rows: [string, ReactNode][] = [
    ["Operated by", <Fill>{LEGAL.entity}</Fill>],
    ["Registered address", <Fill>{LEGAL.address}</Fill>],
    ["Email", <Mail />],
  ];
  return (
    <dl className="divide-y divide-[var(--hair)] rounded-[var(--r-card)] border border-[var(--hair)] bg-[var(--cream-alt)]">
      {rows.map(([label, value]) => (
        <div key={label} className="grid gap-1 px-5 py-4 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-baseline sm:gap-6">
          <dt className="text-[13px] font-semibold text-[var(--ink)]">{label}</dt>
          <dd className="min-w-0 text-[15px] text-[var(--muted)]">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ---------- page ---------- */

export default function LegalDocument({
  title,
  effective,
  intro,
  summary,
  summaryNote,
  sections,
  skipLabel,
  current,
}: {
  title: string;
  effective: string;
  intro: string;
  summary: [lead: string, text: string][];
  summaryNote: string;
  sections: LegalSection[];
  skipLabel: string;
  current: "/terms" | "/privacy";
}) {
  usePageMeta({ title, description: intro });

  // The router keeps the previous page's scroll position, and the footer links
  // that lead here sit at the very bottom of other pages. Start at the top, or
  // at the section named in the URL (/terms#fees): on a fresh load the
  // browser's own jump runs before React has rendered the sections.
  useEffect(() => {
    const target = window.location.hash ? document.getElementById(window.location.hash.slice(1)) : null;
    if (target) target.scrollIntoView();
    else window.scrollTo(0, 0);
  }, []);

  const footerLinks: [string, string][] = [
    ["/privacy", "Privacy"],
    ["/terms", "Terms"],
    ["/contact", "Contact"],
  ];

  return (
    <div className="lp min-h-screen">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-[var(--ink)] focus:px-4 focus:py-2 focus:text-[13px] focus:font-medium focus:text-[var(--on-ink)]"
      >
        {skipLabel}
      </a>

      <header className="border-b border-[var(--hair)]">
        <div className={cn(barWidth, "flex items-center justify-between gap-4 py-4")}>
          <Link to="/" className="flex shrink-0 items-center gap-2.5 transition-opacity hover:opacity-80">
            <img src="/an-logo.svg" alt="" className="size-7" />
            <span className="text-[15px] font-semibold tracking-tight">AnotherNotes</span>
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-[13px] text-[var(--muted-2)] transition-opacity hover:opacity-70"
          >
            <ArrowLeft aria-hidden className="size-3.5" />
            Back to home
          </Link>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[1120px] px-5 sm:px-8 lg:grid lg:grid-cols-[216px_minmax(0,680px)] lg:justify-between lg:gap-14 xl:grid-cols-[248px_minmax(0,680px)]">
        {/* Contents rail, lg and up. The rail is as tall as the text, so the
            list inside it can stick; it scrolls on its own on short screens. */}
        <nav aria-label="Contents" className="hidden pt-16 lg:block">
          <div className="sticky top-10 max-h-[calc(100dvh-5rem)] overflow-y-auto overscroll-contain pb-10">
            <p className={eyebrow}>Contents</p>
            <ol className="mt-4 border-l border-[var(--hair)]">
              {sections.map((s, i) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    className="-ml-px flex gap-2 border-l border-transparent py-1 pl-4 pr-2 text-[13px] leading-snug text-[var(--muted-2)] transition-colors hover:border-[var(--ink)] hover:text-[var(--ink)]"
                  >
                    <span className="w-5 shrink-0 tabular-nums">{i + 1}.</span>
                    <span>{s.title}</span>
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </nav>

        <main
          id="main"
          tabIndex={-1}
          className="mx-auto w-full min-w-0 max-w-[680px] break-words pb-16 pt-12 focus:outline-none sm:pt-16 lg:mx-0"
        >
          <p className={eyebrow}>Legal</p>
          <h1 className="lp-serif mt-3 text-[44px] sm:text-[56px] lg:text-[64px]">{title}</h1>
          <p className="mt-4 text-[14px] text-[var(--muted-2)]">Effective {effective}</p>
          <p className="mt-6 text-[17px] leading-[1.65] text-[var(--muted)]">{intro}</p>

          <section
            aria-labelledby="short-version"
            className="mt-10 rounded-[var(--r-card)] border border-[var(--hair)] bg-[var(--cream-alt)] p-6 sm:p-8"
          >
            <h2 id="short-version" className={eyebrow}>
              The short version
            </h2>
            <ul className="mt-5 space-y-3.5">
              {summary.map(([lead, text]) => (
                <li key={lead} className="flex gap-3 text-[15px] leading-[1.6] text-[var(--muted)]">
                  <span aria-hidden className="mt-[9px] size-1.5 shrink-0 rounded-full bg-[var(--ink)]" />
                  <span>
                    <B>{lead}</B> {text}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-6 border-t border-[var(--hair)] pt-4 text-[13px] leading-relaxed text-[var(--muted-2)]">
              {summaryNote}
            </p>
          </section>

          {/* Contents below lg: a disclosure, so it costs one line until it's wanted. */}
          <nav aria-label="Contents" className="mt-8 lg:hidden">
            <details className="group rounded-[var(--r-card)] border border-[var(--hair)] bg-[var(--cream-alt)]">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-[var(--r-card)] px-5 py-4 [&::-webkit-details-marker]:hidden">
                <span className="text-[15px] font-semibold">Contents</span>
                <span className="flex items-center gap-2 text-[13px] text-[var(--muted-2)]">
                  {sections.length} sections
                  <ChevronDown aria-hidden className="size-4 transition-transform group-open:rotate-180" />
                </span>
              </summary>
              <ol className="border-t border-[var(--hair)] px-5 py-3 sm:columns-2 sm:gap-x-6">
                {sections.map((s, i) => (
                  <li key={s.id} className="break-inside-avoid">
                    <a
                      href={`#${s.id}`}
                      className="flex gap-2 py-1.5 text-[14px] leading-snug text-[var(--muted)] transition-colors hover:text-[var(--ink)]"
                    >
                      <span className="w-6 shrink-0 tabular-nums text-[var(--muted-2)]">{i + 1}.</span>
                      <span className="min-w-0">{s.title}</span>
                    </a>
                  </li>
                ))}
              </ol>
            </details>
          </nav>

          <div className="mt-12">
            {sections.map((s, i) => (
              <section key={s.id} id={s.id} className="scroll-mt-4 border-t border-[var(--hair)] py-10 sm:py-12">
                <h2 className="lp-serif text-[28px] leading-[1.15] sm:text-[32px]">
                  <span className="text-[var(--muted-2)]">{i + 1}.</span> {s.title}
                </h2>
                <div className="mt-5 space-y-4 text-[15px] leading-[1.7] text-[var(--muted)] sm:text-[16px]">
                  {s.body}
                </div>
              </section>
            ))}
          </div>

          <div className="border-t border-[var(--hair)] pt-8">
            <a
              href="#top"
              className="inline-flex items-center gap-1.5 text-[13px] text-[var(--muted-2)] transition-opacity hover:opacity-70"
            >
              <ArrowUp aria-hidden className="size-3.5" />
              Back to top
            </a>
          </div>
        </main>
      </div>

      <footer className="border-t border-[var(--hair)]">
        <div className={cn(barWidth, "flex flex-col items-center justify-between gap-4 py-8 md:flex-row")}>
          <div className="flex items-center gap-3">
            <img src="/an-logo.svg" alt="" className="size-6" />
            <span className="text-[13px] text-[var(--muted-2)]">© 2026 AnotherNotes</span>
          </div>
          <nav aria-label="Footer" className="flex gap-6 text-[13px] text-[var(--muted-2)]">
            {footerLinks.map(([to, label]) => (
              <Link
                key={to}
                to={to}
                aria-current={to === current ? "page" : undefined}
                className={cn("transition-opacity hover:opacity-70", to === current && "text-[var(--ink)]")}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
}

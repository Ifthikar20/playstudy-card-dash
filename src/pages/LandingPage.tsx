import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  ChevronDown,
  FileText,
  Flame,
  Folder,
  GraduationCap,
  KeyRound,
  Layers,
  LayoutDashboard,
  Lightbulb,
  Link2,
  ListChecks,
  Menu,
  Mic,
  PenLine,
  Play,
  RotateCcw,
  Timer,
  Upload,
  UserPlus,
  Users,
  Wand2,
  X,
  Youtube,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { SIGNUPS_OPEN } from "@/lib/signups";

/*
  Marketing landing — the "editorial" world from the reference: cream ground,
  pure ink, Instrument Serif 400 for display type, Inter 500 for everything
  else, hairlines instead of shadows, one ink pill for navigation and CTAs.
  Emphasis steps *back* to grey (<em>) rather than reaching for a colour.
  Tokens live in index.css under `.lp` and force the page light.
*/

const inkPill =
  "inline-flex items-center gap-2 rounded-full bg-[var(--ink)] px-6 py-3 text-[15px] font-medium text-[var(--on-ink)] transition-opacity hover:opacity-85";
const creamPill =
  "inline-flex items-center gap-1.5 rounded-full bg-[var(--cream)] px-3.5 py-1.5 text-[13px] font-medium text-[var(--ink)] transition-opacity hover:opacity-85";
const eyebrow = "text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--muted-2)]";
const menuRow =
  "rounded-xl px-4 py-3 text-[16px] font-medium text-[var(--ink)] transition-colors hover:bg-[var(--cream)]";

/* The two video tiles in the "Why AnotherNotes" band (top row, middle; bottom
   row, left). Put the file in public/ and its path here; an empty `src` shows a
   placeholder. `focus` is where the crop centres when the tile is narrower than
   the video (object-position). Both are web copies of the originals: 720p,
   silent, about 0.6 MB each. */
const WHY_VIDEOS = {
  desk: { src: "/why-desk.mp4", focus: "object-[70%_50%]" },
  shelves: { src: "/why-shelves.mp4", focus: "object-center" },
};

/* The four things to do on a note, each in a colour from the Features menu
   palette so the strip reads as four separate actions at a glance. */
const ONE_PAGE: { icon: LucideIcon; tint: string; title: string; desc: string }[] = [
  { icon: PenLine, tint: "#FEF3C7", title: "Write on it", desc: "Click any line and type. It saves itself as you go." },
  { icon: Mic, tint: "#EDE9FE", title: "Be taught it", desc: "A voice reads a section aloud and points as it goes." },
  { icon: Layers, tint: "#DBEAFE", title: "Flip it", desc: "Flashcards drawn from the section you are reading." },
  {
    icon: ListChecks,
    tint: "#DCFCE7",
    title: "Be asked about it",
    desc: "A short quiz per section, with an explanation after every answer.",
  },
];

/* Section anchors, shared by the inline nav (lg+) and the menu below it. */
const NAV_LINKS: [href: string, label: string][] = [
  ["#how", "How it works"],
  ["#why", "Why AnotherNotes"],
  ["#manifesto", "Manifesto"],
];

/* The Features mega-menu — AnotherNotes's real capabilities, grouped. */
type Feat = { icon: LucideIcon; title: string; desc: string; tint: string; badge?: string };
const FEATURE_GROUPS: { label: string; items: Feat[] }[] = [
  {
    label: "Organize",
    items: [
      { icon: Upload, title: "Upload anything", desc: "PDFs, slides, notes or pasted text", tint: "#EDE9FE" },
      { icon: Folder, title: "Study folders", desc: "Shelve sessions into covered folders", tint: "#DCFCE7" },
      { icon: CalendarDays, title: "Calendar", desc: "Plan exams and import your .ics", tint: "#FEF3C7" },
    ],
  },
  {
    label: "Learn",
    items: [
      { icon: GraduationCap, title: "Full Study", desc: "One scrolling note with a quiz per section", tint: "#EDE9FE" },
      { icon: FileText, title: "Auto notes", desc: "Readable notes with headings & highlights", tint: "#DBEAFE" },
      { icon: BookOpen, title: "Read mode", desc: "Distraction-free reading, dark or paper", tint: "#DCFCE7" },
      { icon: Wand2, title: "Ask AI to change", desc: "Rewrite any part of a note by asking", tint: "#FCE7F3" },
    ],
  },
  {
    label: "Practice & test",
    items: [
      { icon: ListChecks, title: "Quiz this section", desc: "Challenging questions from your notes", tint: "#DCFCE7" },
      { icon: Layers, title: "Flashcards", desc: "Flip-card recall to make it stick", tint: "#DBEAFE" },
      { icon: RotateCcw, title: "Wrong questions", desc: "Retry only the ones you missed", tint: "#FEF3C7" },
    ],
  },
  {
    label: "Video & progress",
    items: [
      { icon: Youtube, title: "YouTube → study", desc: "Paste a link; we read it and build it", tint: "#FCE7F3", badge: "New" },
      { icon: Zap, title: "XP & levels", desc: "Every answer earns you XP", tint: "#FEF3C7" },
      { icon: Flame, title: "Streaks", desc: "Keep your daily study streak alive", tint: "#EDE9FE" },
      { icon: LayoutDashboard, title: "Progress", desc: "See exactly where you stand", tint: "#DBEAFE" },
    ],
  },
  {
    label: "Family",
    items: [
      { icon: Users, title: "Family page", desc: "Every learner you follow, in one list", tint: "#DBEAFE", badge: "New" },
      { icon: UserPlus, title: "Add a child", desc: "A name and a PIN, no email needed", tint: "#DCFCE7" },
      { icon: KeyRound, title: "PIN sign-in", desc: "Kids sign in at /kids, no password", tint: "#FEF3C7" },
      { icon: Link2, title: "Connect by code", desc: "An older learner shares a code with you", tint: "#EDE9FE" },
    ],
  },
];

const LandingPage = () => {
  const [featuresOpen, setFeaturesOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuFeaturesOpen, setMenuFeaturesOpen] = useState(false);

  const closeMenus = () => {
    setFeaturesOpen(false);
    setMenuOpen(false);
  };

  useEffect(() => {
    if (!featuresOpen && !menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setFeaturesOpen(false);
      setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [featuresOpen, menuOpen]);

  return (
    <div className="lp min-h-screen">
      {/* Floating ink pill nav. The full row is ~860px wide, so the section
          links and Features only sit inline from lg (1024px) and fold into the
          menu button below that. Every label is nowrap: a label that runs out
          of room moves into the menu, it never breaks onto a second line.
          The header lets clicks through; only the pill and the open menus
          catch them, so the page stays clickable beside the pill. */}
      <header className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4">
        <nav className="pointer-events-auto relative z-50 flex w-full max-w-5xl items-center gap-2 whitespace-nowrap rounded-full bg-[var(--ink)] py-1.5 pl-2 pr-1.5 text-[var(--on-ink)] shadow-[0_12px_32px_rgba(0,0,0,0.18)]">
          <Link to="/" onClick={closeMenus} className="flex shrink-0 items-center gap-2 pr-2">
            <img src="/an-logo.svg" alt="" className="size-6" />
            <span className="text-[14px] font-semibold tracking-tight">AnotherNotes</span>
            <span className="hidden rounded-full border border-[var(--hair-ink-2)] px-1.5 py-px text-[9px] font-semibold uppercase tracking-wider text-[var(--on-ink-mut)] sm:inline-block">
              Beta
            </span>
          </Link>
          <div className="mx-auto hidden items-center gap-1 lg:flex">
            <button
              type="button"
              aria-expanded={featuresOpen}
              onClick={() => setFeaturesOpen((o) => !o)}
              className={cn(
                "flex items-center gap-1 rounded-full px-3 py-1.5 text-[13px] transition-colors hover:bg-white/10 hover:text-[var(--on-ink)]",
                featuresOpen ? "bg-white/10 text-[var(--on-ink)]" : "text-[var(--on-ink-mut)]",
              )}
            >
              Features
              <ChevronDown className={cn("size-3 transition-transform", featuresOpen && "rotate-180")} />
            </button>
            {NAV_LINKS.map(([href, label]) => (
              <a
                key={href}
                href={href}
                onClick={closeMenus}
                className="rounded-full px-3 py-1.5 text-[13px] text-[var(--on-ink-mut)] transition-colors hover:bg-white/10 hover:text-[var(--on-ink)]"
              >
                {label}
              </a>
            ))}
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2 lg:ml-0">
            {SIGNUPS_OPEN && (
              <Link
                to="/auth"
                className="hidden rounded-full px-3 py-1.5 text-[13px] text-[var(--on-ink-mut)] transition-colors hover:text-[var(--on-ink)] sm:block"
              >
                Log in
              </Link>
            )}
            {/* Under 360px there is only room for the logo and the menu button. */}
            <Link to="/auth" className={cn(creamPill, "max-[359px]:hidden")}>
              {SIGNUPS_OPEN ? "Get started" : "Sign in"}
              <ArrowRight className="size-3" />
            </Link>
            <button
              type="button"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              aria-controls="lp-menu"
              onClick={() => {
                setFeaturesOpen(false);
                setMenuOpen((o) => !o);
              }}
              className="flex size-8 items-center justify-center rounded-full transition-colors hover:bg-white/10 lg:hidden"
            >
              {menuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
            </button>
          </div>
        </nav>

        {/* Click-away layer for whichever menu is open. It sits under the pill
            (z-40 against the nav's z-50), so the toggles stay clickable. */}
        {(featuresOpen || menuOpen) && (
          <button
            type="button"
            aria-label="Close menu"
            tabIndex={-1}
            className="pointer-events-auto fixed inset-0 z-40 cursor-default"
            onClick={closeMenus}
          />
        )}

        {/* Features mega-menu (lg+) */}
        {featuresOpen && (
          <div className="fade-in absolute inset-x-0 top-[calc(100%+0.5rem)] z-50 hidden justify-center px-4 lg:flex">
            <div className="pointer-events-auto w-full max-w-5xl rounded-[var(--r-card)] border border-[var(--hair)] bg-[var(--cream-alt)] p-8 shadow-[0_28px_70px_rgba(0,0,0,0.16)] xl:max-w-6xl">
              <FeatureGroups className="grid grid-cols-3 gap-8 xl:grid-cols-5" onPick={closeMenus} />
            </div>
          </div>
        )}

        {/* The menu below lg: Features as a disclosure, then the section links,
            then on phones the log-in the pill has no room for. It scrolls on
            its own, since a fixed header never scrolls with the page. */}
        {menuOpen && (
          <div
            id="lp-menu"
            className="fade-in absolute inset-x-0 top-[calc(100%+0.5rem)] z-50 flex justify-center px-4 lg:hidden"
          >
            <div className="pointer-events-auto max-h-[calc(100dvh-6rem)] w-full max-w-5xl overflow-y-auto overscroll-contain rounded-[var(--r-card)] border border-[var(--hair)] bg-[var(--cream-alt)] p-2 shadow-[0_28px_70px_rgba(0,0,0,0.16)]">
              <button
                type="button"
                aria-expanded={menuFeaturesOpen}
                onClick={() => setMenuFeaturesOpen((o) => !o)}
                className={cn(menuRow, "flex w-full items-center justify-between")}
              >
                Features
                <ChevronDown className={cn("size-4 transition-transform", menuFeaturesOpen && "rotate-180")} />
              </button>
              {menuFeaturesOpen && (
                <FeatureGroups className="grid gap-6 px-4 pb-4 pt-2 sm:grid-cols-2" onPick={closeMenus} />
              )}
              {NAV_LINKS.map(([href, label]) => (
                <a key={href} href={href} onClick={closeMenus} className={cn(menuRow, "block")}>
                  {label}
                </a>
              ))}
              <div className="mt-2 grid gap-2 border-t border-[var(--hair)] px-2 pb-2 pt-4 sm:hidden">
                <Link to="/auth" onClick={closeMenus} className={cn(inkPill, "justify-center")}>
                  {SIGNUPS_OPEN ? "Get started" : "Sign in"}
                  <ArrowRight className="size-4" />
                </Link>
                {SIGNUPS_OPEN && (
                  <Link
                    to="/auth"
                    onClick={closeMenus}
                    className="rounded-full border border-[var(--hair)] px-6 py-3 text-center text-[15px] font-medium text-[var(--ink)] transition-colors hover:bg-[var(--cream)]"
                  >
                    Log in
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 pb-16 pt-36 text-center md:pt-44">
        <h1 className="lp-serif mx-auto max-w-4xl text-[3.25rem] md:text-[4.5rem] lg:text-[5.5rem]">
          Your notes, <em>in motion.</em>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-[17px] leading-relaxed text-[var(--muted)] md:text-[18px]">
          Drop in your notes, slides or a PDF. They come back written up section by section — then read back to you,
          a line at a time.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link to="/auth" className={inkPill}>
            {SIGNUPS_OPEN ? "Start free" : "Sign in"}
            <ArrowRight className="size-4" />
          </Link>
          <a
            href="#how"
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-3 text-[15px] font-medium text-[var(--ink)] underline-offset-4 transition-opacity hover:opacity-70"
          >
            See how it works
            <ArrowUpRight className="size-4" />
          </a>
        </div>

        {/* Hero showcase — the product in motion, framed as a cinematic card
            with the copy and the numbers set over a dimmed video.

            Below md the copy and the numbers sit in NORMAL FLOW under a
            shorter video instead of being absolutely positioned over it. On a
            360px phone the old layout gave the video its 360px minimum height
            while the top copy and the three stacked stats each needed ~200px,
            so they overlapped into an unreadable pile. Overlaying only works
            when the card is wider than it is tall. */}
        <div className="relative mx-auto mt-16 max-w-5xl overflow-hidden rounded-[var(--r-card)] border border-[var(--hair)] bg-[var(--ink)] text-left shadow-[0_28px_70px_rgba(0,0,0,0.12)]">
          <video
            src="/vid-1.mp4"
            autoPlay
            muted
            loop
            playsInline
            className="h-[clamp(200px,28vh,580px)] w-full object-cover md:h-[clamp(360px,54vh,580px)]"
          />
          {/* darken top + bottom so overlaid text stays legible, video shows through the middle */}
          <div aria-hidden className="pointer-events-none absolute inset-0 hidden bg-gradient-to-b from-black/75 via-black/15 to-black/80 md:block" />

          {/* Copy — top */}
          <div className="flex flex-col items-start justify-between gap-4 p-6 md:absolute md:inset-x-0 md:top-0 md:flex-row md:p-8">
            <p className="lp-serif max-w-md text-[1.9rem] leading-[1.05] text-white md:text-[2.5rem]">
              Notes you don't have to reread.
            </p>
            <p className="max-w-sm text-[14px] leading-relaxed text-white/80 md:text-[15px]">
              You forget most of what you read within a day. So your notes get taught back to you, you get asked about
              them, and someone who cares can see how it went.
            </p>
          </div>

          {/* Numbers — bottom. Real, cited study-science, not vanity metrics. */}
          <dl className="grid grid-cols-1 gap-4 p-6 pt-0 sm:grid-cols-3 md:absolute md:inset-x-0 md:bottom-0 md:p-8 md:pt-8">
            {[
              {
                v: "67%",
                l: "of new material is forgotten within a day without review",
                src: "Ebbinghaus · Murre & Dros, 2015",
                href: "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4492928/",
              },
              {
                v: "61%",
                l: "recalled a week later with active recall — vs 40% from rereading",
                src: "Roediger & Karpicke, 2006",
                href: "https://journals.sagepub.com/doi/10.1111/j.1467-9280.2006.01693.x",
              },
              {
                // Replaced the gamification meta-analysis: the product no longer
                // leads on games, and three of the four "modes" it supported were
                // never built. Hedged to "about", because the abstract reports a
                // range (roughly 0.46 to 0.55 depending on the outcome measure)
                // rather than one figure.
                v: "≈ 0.5 SD",
                l: "higher achievement for secondary students whose parents are involved (52 studies)",
                src: "Jeynes, 2007",
                href: "https://eric.ed.gov/?id=EJ748034",
              },
            ].map((s) => (
              <div key={s.src} className="min-w-0">
                <dt className="lp-serif text-[1.8rem] leading-none text-white md:text-[2.3rem]">{s.v}</dt>
                <dd className="mt-1.5 text-[12px] leading-snug text-white/80 md:text-[12.5px]">{s.l}</dd>
                <a
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-block text-[11px] text-white/55 underline decoration-white/30 underline-offset-2 transition-colors hover:text-white/85"
                >
                  Source: {s.src}
                </a>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="scroll-mt-24 border-t border-[var(--hair)] px-6 py-20 md:py-28">
        <div className="mx-auto max-w-6xl">
          <p className={eyebrow}>How it works</p>
          {/* The heading undersells and the three cards refuse to. The name is
              a straight-faced joke about being another notes app, so the copy
              tells it once, here, and then never winks again. */}
          <h2 className="lp-serif mt-3 max-w-2xl text-[2.5rem] md:text-[3rem]">
            It's a notes app. <em>Mostly.</em>
          </h2>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            <StepCard
              n="01"
              icon={<FileText className="size-5" />}
              title="Notes get written"
              body="Drop in a PDF, slides or pasted text. Notes come back for every section, and you click any line to write in them yourself."
              art="upload"
            />
            <StepCard
              n="02"
              icon={<Mic className="size-5" />}
              title="Then it teaches"
              body="It reads a section aloud, pointing at the line it's on. Ask a question halfway through and the answer is written into your notes."
              art="teach"
            />
            <StepCard
              n="03"
              icon={<Lightbulb className="size-5" />}
              title="Deep understanding"
              body="See exactly what went right and what went wrong: every question you answered and, for each mistake, the right answer and why. Then retry just the ones you missed."
              art="understand"
            />
          </div>
        </div>
      </section>

      {/* Why AnotherNotes — ink band */}
      <section id="why" className="on-ink scroll-mt-24 bg-[var(--ink)] px-6 py-20 text-[var(--on-ink)] md:py-28">
        <div className="mx-auto max-w-6xl">
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--on-ink-dim)]">Why AnotherNotes</p>
          <h2 className="lp-serif mt-3 max-w-2xl text-[2.5rem] md:text-[3rem]">
            Built for the way you <em>actually</em> study
          </h2>

          {/* Three square tiles, then the four-things strip across the full
              width, then a video beside the parents tile: one clean rectangle at
              every width. The strip used to be a tall card spanning two rows,
              which stretched every tile beside it. Videos crop to their tile. */}
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            <InkTile>
              <Mic className="size-5 text-[var(--on-ink-mut)]" />
              <h3 className="lp-serif mt-4 text-[1.5rem]">It reads them to you</h3>
              <p className="mt-2 text-[14px] text-[var(--on-ink-mut)]">
                A voice works through a section, pointing at the line it's on. Interrupt with a question and the answer
                is written into the notes.
              </p>
            </InkTile>

            <VideoTile {...WHY_VIDEOS.desk} />

            <InkTile>
              <Timer className="size-5 text-[var(--on-ink-mut)]" />
              <h3 className="lp-serif mt-4 text-[1.5rem]">Time that's honest</h3>
              <p className="mt-2 text-[14px] text-[var(--on-ink-mut)]">
                AnotherNotes only counts the minutes you're really reading and writing, so your study time means something.
              </p>
            </InkTile>

            <InkTile className="min-h-0 md:col-span-3">
              <div className="md:flex md:items-end md:justify-between md:gap-10">
                <h3 className="lp-serif text-[1.75rem]">One page, four things to do on it</h3>
                <p className="mt-2 max-w-md text-[14px] text-[var(--on-ink-mut)] md:mt-0">
                  All of it happens in the same scrolling note. Nothing to switch to, nothing to lose your place in.
                </p>
              </div>
              <ul className="mt-8 grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
                {ONE_PAGE.map((item) => (
                  <li key={item.title}>
                    <span
                      className="flex size-10 items-center justify-center rounded-xl"
                      style={{ backgroundColor: item.tint }}
                    >
                      <item.icon className="size-[18px] text-[var(--ink)]" />
                    </span>
                    <p className="mt-4 text-[15px] font-medium">{item.title}</p>
                    <p className="mt-1 text-[13px] leading-snug text-[var(--on-ink-dim)]">{item.desc}</p>
                  </li>
                ))}
              </ul>
            </InkTile>

            <VideoTile {...WHY_VIDEOS.shelves} />

            <InkTile className="md:col-span-2">
              <Users className="size-5 text-[var(--on-ink-mut)]" />
              <h3 className="lp-serif mt-4 text-[1.5rem]">Parents can follow along</h3>
              <p className="mt-2 max-w-xl text-[14px] text-[var(--on-ink-mut)]">
                Make a profile for a child and they sign in with a name and a six-digit PIN — no email, no inbox to
                manage. A learner who already has an account hands you a code instead, and then you see the progress —
                streak, time studied, accuracy — not their written work.
              </p>
            </InkTile>
          </div>
        </div>
      </section>

      {/* Manifesto */}
      <section id="manifesto" className="scroll-mt-24 px-6 py-20 md:py-28">
        <div className="mx-auto max-w-2xl">
          <p className={eyebrow}>Our manifesto</p>
          <h2 className="lp-serif mt-3 text-[2.5rem] md:text-[3rem]">
            Notes are where the <em>learning</em> is.
          </h2>
          <div className="mt-8 space-y-5 text-[17px] leading-relaxed text-[var(--muted)]">
            <p>
              Everyone keeps notes. Almost nobody goes back to them. They get written once, read twice, and then sit in
              a folder being quietly forgotten while the exam gets closer.
            </p>
            <p>
              The problem was never the notes. It was that a page of writing cannot do anything. It cannot explain the
              bit you skimmed, or notice you have not opened it in a fortnight, or tell anyone you are struggling.
            </p>
            <p>
              So we built notes that can. Yours are written up for you, read back to you out loud, and turned into
              questions that find the gaps. If a parent set the account up, they see the progress — not the writing.
            </p>
            <p className="text-[var(--ink)]">
              It is another notes app. That is the joke, and then it is not.
            </p>
          </div>
          <p className="lp-serif mt-10 border-t border-[var(--hair)] pt-6 text-[1.25rem] italic text-[var(--muted)]">
            — The AnotherNotes team
          </p>
        </div>
      </section>

      {/* Four facts a visitor can act on: what it costs, what comes back, a way
          in the page doesn't mention anywhere else, and what the study-time
          number means. Each is true by construction. This band once held
          unsourced performance claims, then PIN-digit trivia; it gets usage
          numbers only when there are real ones to show. */}
      <section className="border-y border-[var(--hair)] px-6 py-14">
        <dl className="mx-auto grid max-w-5xl grid-cols-2 gap-y-10 md:grid-cols-4 md:divide-x md:divide-[var(--hair)]">
          {[
            ["Free", "every feature, while AnotherNotes is in beta"],
            ["3", "study tools for every section: notes, a quiz and flashcards"],
            ["1", "YouTube link is enough to turn a video into notes"],
            ["0", "idle minutes counted, so the time you see is time you studied"],
          ].map(([v, l]) => (
            <div key={l} className="px-2 text-center md:px-6">
              <dt className="lp-serif text-[3rem] md:text-[3.5rem]">{v}</dt>
              <dd className="mx-auto mt-1 max-w-[15rem] text-[13px] leading-snug text-[var(--muted-2)]">{l}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* CTA */}
      <section className="px-6 py-24 text-center md:py-32">
        <h2 className="lp-serif mx-auto max-w-2xl text-[2.5rem] md:text-[3.5rem]">
          Bring your <em>notes.</em>
        </h2>
        <p className="mx-auto mt-4 max-w-md text-[16px] text-[var(--muted)]">
          {SIGNUPS_OPEN
            ? "Free to start, no card needed. Add a child from the same account, or send a code to a learner who already has one."
            : "AnotherNotes is in beta, so new sign-ups are paused. Already have an account? Sign in and pick up where you left off."}
        </p>
        <Link to="/auth" className={cn(inkPill, "mt-8")}>
          {SIGNUPS_OPEN ? "Get started free" : "Sign in"}
          <ArrowRight className="size-4" />
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--hair)] px-6 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 md:flex-row">
          <div className="flex items-center gap-3">
            <img src="/an-logo.svg" alt="" className="size-6" />
            <span className="text-[13px] text-[var(--muted-2)]">© 2026 AnotherNotes</span>
          </div>
          <div className="flex gap-6 text-[13px] text-[var(--muted-2)]">
            <Link to="/privacy" className="transition-opacity hover:opacity-70">Privacy</Link>
            <Link to="/terms" className="transition-opacity hover:opacity-70">Terms</Link>
            <Link to="/contact" className="transition-opacity hover:opacity-70">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

/* The feature list, shared by the mega-menu (lg+) and the menu below it. */
function FeatureGroups({ className, onPick }: { className?: string; onPick: () => void }) {
  return (
    <div className={className}>
      {FEATURE_GROUPS.map((group) => (
        <div key={group.label}>
          <p className={eyebrow}>{group.label}</p>
          <ul className="mt-4 space-y-4">
            {group.items.map((it) => (
              <li key={it.title}>
                <Link
                  to="/auth"
                  onClick={onPick}
                  className="group flex items-start gap-3 rounded-lg -mx-2 px-2 py-1 transition-colors hover:bg-[var(--cream)]"
                >
                  <span
                    className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105"
                    style={{ backgroundColor: it.tint }}
                  >
                    <it.icon className="size-4 text-[var(--ink)]" />
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 text-[14px] font-medium text-[var(--ink)]">
                      {it.title}
                      {it.badge && (
                        <span className="rounded bg-[#FEF08A] px-1.5 py-px text-[10px] font-semibold text-[var(--ink)]">{it.badge}</span>
                      )}
                    </span>
                    <span className="mt-0.5 block text-[12.5px] leading-snug text-[var(--muted)]">{it.desc}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/* A looping, muted video filling an ink tile — or, until its file exists, a
   dashed slot marking where the video will go. The video is positioned
   absolutely so it crops to the tile: in flow, a portrait clip's own aspect
   ratio would set the row height and stretch every tile beside it. */
function VideoTile({ src, focus, className }: { src: string; focus?: string; className?: string }) {
  if (src) {
    return (
      <InkTile className={cn("relative overflow-hidden p-0", className)}>
        <video
          src={src}
          autoPlay
          muted
          loop
          playsInline
          aria-hidden="true"
          className={cn("absolute inset-0 h-full w-full object-cover", focus)}
        />
      </InkTile>
    );
  }
  return (
    <InkTile className={cn("p-3", className)}>
      <div className="flex flex-1 flex-col items-center justify-center rounded-[10px] border border-dashed border-[var(--hair-ink-2)] text-center">
        <span className="flex size-14 items-center justify-center rounded-full border border-[var(--hair-ink-2)]">
          <Play className="ml-0.5 size-5 text-[var(--on-ink-mut)]" />
        </span>
        <p className="mt-4 text-[13px] text-[var(--on-ink-dim)]">Video coming soon</p>
      </div>
    </InkTile>
  );
}

function InkTile({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "flex min-h-[300px] flex-col rounded-[var(--r-card)] border border-[var(--hair-ink)] bg-white/[0.03] p-7",
        className,
      )}
    >
      {children}
    </div>
  );
}

function StepCard({
  n,
  icon,
  title,
  body,
  art,
}: {
  n: string;
  icon: React.ReactNode;
  title: string;
  body: string;
  art: "upload" | "teach" | "understand";
}) {
  return (
    <div className="flex flex-col rounded-[var(--r-card)] border border-[var(--hair)] bg-[var(--cream-alt)] p-6">
      <div className="flex h-44 items-center justify-center rounded-[var(--r-media)] border border-[var(--hair-soft)] bg-[var(--cream)] text-[var(--ink)]">
        <StepArt kind={art} />
      </div>
      <div className="mt-6 flex items-center justify-between">
        <span className="flex size-9 items-center justify-center rounded-full border border-[var(--hair)] text-[var(--ink)]">
          {icon}
        </span>
        <span className="lp-serif text-[1.75rem] text-[var(--muted-2)]">{n}</span>
      </div>
      <h3 className="lp-serif mt-4 text-[1.75rem]">{title}</h3>
      <p className="mt-2 text-[15px] leading-relaxed text-[var(--muted)]">{body}</p>
    </div>
  );
}

/* Quiet monochrome illustrations — ink on cream, gentle motion only. */
function StepArt({ kind }: { kind: "upload" | "teach" | "understand" }) {
  if (kind === "upload") {
    return (
      <svg viewBox="0 0 200 150" className="h-36 w-48" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="62" y="34" width="76" height="96" rx="8" opacity="0.9" />
        <path d="M74 56h34M74 70h48M74 84h28M74 98h44" strokeLinecap="round" opacity="0.35" />
        <g className="animate-bounce" style={{ animationDuration: "2.4s" }}>
          <path d="M100 14v26M90 24l10-10 10 10" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </svg>
    );
  }
  if (kind === "teach") {
    // A page being read to: the rule under the line it is on draws itself
    // across, and the voice arcs breathe on the same 2.4s as everything else on
    // the page. One clock, or the mouth pulses twice per pass of the underline.
    return (
      <svg viewBox="0 0 200 150" className="h-36 w-48" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="46" y="26" width="84" height="98" rx="8" opacity="0.9" />
        <path d="M58 48h56M58 62h40M58 90h52M58 104h34" strokeLinecap="round" opacity="0.35" />
        <path d="M58 76h56" strokeLinecap="round" opacity="0.35" />
        <path d="M58 80h56" strokeLinecap="round" strokeWidth="3" opacity="0.45" strokeDasharray="56">
          <animate attributeName="stroke-dashoffset" values="56;0;0;56" keyTimes="0;0.45;0.8;1" dur="2.4s" repeatCount="indefinite" />
        </path>
        <path d="M144 66a13 13 0 0 1 0 20" strokeLinecap="round" opacity="0.5">
          <animate attributeName="opacity" values="0.5;0.12;0.5" dur="2.4s" repeatCount="indefinite" />
        </path>
        <path d="M154 58a24 24 0 0 1 0 36" strokeLinecap="round" opacity="0.28">
          <animate attributeName="opacity" values="0.28;0.06;0.28" dur="2.4s" begin="0.3s" repeatCount="indefinite" />
        </path>
      </svg>
    );
  }
  // An answer sheet under review. A lens moves down the three answers and
  // stops on the one that went wrong; its explanation writes itself in
  // underneath, then the cross turns into a tick (the retry). Two beats of the
  // page's 2.4s clock: the story has four steps and one beat would rush it.
  const loop = { dur: "4.8s", repeatCount: "indefinite" } as const;
  const tick = (y: number) => `M54.5 ${y}l2.5 2.5 4.5-5`;
  return (
    <svg
      viewBox="0 0 200 150"
      className="h-36 w-48"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="40" y="18" width="104" height="114" rx="8" opacity="0.9" />

      {/* right */}
      <circle cx="58" cy="44" r="7" opacity="0.9" />
      <path d={tick(44)} />
      <path d="M73 44h54" opacity="0.35" />

      {/* wrong, explained, then retried */}
      <circle cx="58" cy="73" r="7" opacity="0.9" />
      <path d="M55 70l6 6M61 70l-6 6">
        <animate attributeName="opacity" values="1;1;0;0;1" keyTimes="0;0.6;0.66;0.94;1" {...loop} />
      </path>
      <path d={tick(73)} strokeDasharray="11" strokeDashoffset="11">
        <animate attributeName="stroke-dashoffset" values="11;11;0;0;11" keyTimes="0;0.64;0.72;0.94;1" {...loop} />
      </path>
      <path d="M73 73h44" opacity="0.35" />
      <path d="M73 82h36" strokeWidth="3" opacity="0.45" strokeDasharray="36" strokeDashoffset="36">
        <animate attributeName="stroke-dashoffset" values="36;36;0;0;36" keyTimes="0;0.38;0.55;0.94;1" {...loop} />
      </path>

      {/* right */}
      <circle cx="58" cy="102" r="7" opacity="0.9" />
      <path d={tick(102)} />
      <path d="M73 102h50" opacity="0.35" />

      {/* the lens */}
      <g>
        <animateTransform
          attributeName="transform"
          type="translate"
          values="0 0;0 0;0 29;0 29;0 58;0 58;0 0"
          keyTimes="0;0.18;0.3;0.78;0.86;0.93;1"
          calcMode="spline"
          keySplines="0 0 1 1;0.4 0 0.2 1;0 0 1 1;0.4 0 0.2 1;0 0 1 1;0.4 0 0.2 1"
          {...loop}
        />
        <circle cx="132" cy="44" r="12" />
        <path d="M140.5 52.5l11 11" strokeWidth="3" />
      </g>
    </svg>
  );
}

export default LandingPage;

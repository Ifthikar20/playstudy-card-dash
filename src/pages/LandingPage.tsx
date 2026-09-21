import { useState } from "react";
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
  Gamepad2,
  GraduationCap,
  KeyRound,
  Layers,
  LayoutDashboard,
  Link2,
  ListChecks,
  Mic,
  RotateCcw,
  Timer,
  Upload,
  UserPlus,
  Users,
  Wand2,
  Youtube,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import AgentCursors from "@/components/landing/AgentCursors";

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
  "inline-flex items-center gap-2 rounded-full bg-[var(--cream)] px-4 py-2 text-[14px] font-medium text-[var(--ink)] transition-opacity hover:opacity-85";
const eyebrow = "text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--muted-2)]";

/* The Features mega-menu — PlayStudy's real capabilities, grouped. */
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

  return (
    <div className="lp min-h-screen">
      {/* Floating ink pill nav */}
      <header className="fixed inset-x-0 top-4 z-50 flex justify-center px-4">
        <nav className="flex w-full max-w-4xl items-center gap-2 rounded-full bg-[var(--ink)] py-2 pl-2.5 pr-2 text-[var(--on-ink)] shadow-[0_12px_32px_rgba(0,0,0,0.18)]">
          <Link to="/" className="flex items-center gap-2.5 pr-2">
            <img src="/ps-logo.png" alt="" className="size-7 rounded-full" />
            <span className="text-[15px] font-semibold tracking-tight">Playstudy</span>
            <span className="rounded-full border border-[var(--hair-ink-2)] px-2 py-px text-[10px] font-semibold uppercase tracking-wider text-[var(--on-ink-mut)]">
              Beta
            </span>
          </Link>
          <div className="mx-auto hidden items-center gap-1 md:flex">
            <button
              type="button"
              onClick={() => setFeaturesOpen((o) => !o)}
              className={cn(
                "flex items-center gap-1 rounded-full px-3 py-1.5 text-[14px] transition-colors hover:bg-white/10 hover:text-[var(--on-ink)]",
                featuresOpen ? "bg-white/10 text-[var(--on-ink)]" : "text-[var(--on-ink-mut)]",
              )}
            >
              Features
              <ChevronDown className={cn("size-3.5 transition-transform", featuresOpen && "rotate-180")} />
            </button>
            {[
              ["#how", "How it works"],
              ["#why", "Why PlayStudy"],
              ["#manifesto", "Manifesto"],
            ].map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="rounded-full px-3 py-1.5 text-[14px] text-[var(--on-ink-mut)] transition-colors hover:bg-white/10 hover:text-[var(--on-ink)]"
              >
                {label}
              </a>
            ))}
          </div>
          <Link
            to="/auth"
            className="ml-auto rounded-full px-3 py-1.5 text-[14px] text-[var(--on-ink-mut)] transition-colors hover:text-[var(--on-ink)] md:ml-0"
          >
            Log in
          </Link>
          <Link to="/auth" className={creamPill}>
            Get started
            <ArrowRight className="size-3.5" />
          </Link>
        </nav>

        {/* Features mega-menu */}
        {featuresOpen && (
          <>
            <button
              type="button"
              aria-label="Close menu"
              tabIndex={-1}
              className="fixed inset-0 z-40 cursor-default"
              onClick={() => setFeaturesOpen(false)}
            />
            <div className="fade-in absolute inset-x-0 top-[calc(100%+0.5rem)] z-50 flex justify-center px-4">
              <div className="w-full max-w-5xl rounded-[var(--r-card)] border border-[var(--hair)] bg-[var(--cream-alt)] p-6 shadow-[0_28px_70px_rgba(0,0,0,0.16)] md:p-8 xl:max-w-6xl">
                <div className="grid grid-cols-2 gap-x-8 gap-y-8 md:grid-cols-3 xl:grid-cols-5">
                  {FEATURE_GROUPS.map((group) => (
                    <div key={group.label}>
                      <p className={eyebrow}>{group.label}</p>
                      <ul className="mt-4 space-y-4">
                        {group.items.map((it) => (
                          <li key={it.title}>
                            <Link
                              to="/auth"
                              onClick={() => setFeaturesOpen(false)}
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
              </div>
            </div>
          </>
        )}
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 pb-16 pt-36 text-center md:pt-44">
        {/* The four study modes, drifting around the headline as collaborators.
            The showcase card below stays OUTSIDE this wrapper so no cursor is
            ever positioned inside its clipped interior. */}
        <AgentCursors>
          <h1 className="lp-serif mx-auto max-w-4xl text-[3.25rem] md:text-[4.5rem] lg:text-[5.5rem]">
            Your notes, <em>in motion.</em>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-[17px] leading-relaxed text-[var(--muted)] md:text-[18px]">
            Drop in your notes, slides or a PDF. PlayStudy turns them into topics, questions and games you'll actually
            want to finish.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link to="/auth" className={inkPill}>
              Start free
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
        </AgentCursors>

        {/* Hero showcase — the product in motion, framed as a cinematic card
            with the copy and the numbers set over a dimmed video.

            Below md the copy and the numbers sit in NORMAL FLOW under a
            shorter video instead of being absolutely positioned over it. On a
            360px phone the old layout gave the video its 360px minimum height
            while the top copy and the three stacked stats each needed ~200px,
            so they overlapped into an unreadable pile. Overlaying only works
            when the card is wider than it is tall. */}
        <div className="relative mx-auto mt-16 md:mt-0 max-w-5xl overflow-hidden rounded-[var(--r-card)] border border-[var(--hair)] bg-[var(--ink)] text-left shadow-[0_28px_70px_rgba(0,0,0,0.12)]">
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
              Four modes, one set of notes.
            </p>
            <p className="max-w-sm text-[14px] leading-relaxed text-white/80 md:text-[15px]">
              You forget most of what you read within a day. PlayStudy turns your notes into active recall and games — the
              two things the research below says actually make it stick.
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
                v: "g = 0.49",
                l: "boost to learning from gamification (meta-analysis, 19 studies)",
                src: "Sailer & Homner, 2020",
                href: "https://eric.ed.gov/?id=EJ1245270",
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
          <h2 className="lp-serif mt-3 max-w-2xl text-[2.5rem] md:text-[3rem]">
            Three steps to <em>smarter</em> studying
          </h2>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            <StepCard
              n="01"
              icon={<Upload className="size-5" />}
              title="Upload anything"
              body="PDFs, slides, notes or pasted text. Key concepts are extracted into a topic tree in seconds."
              art="upload"
            />
            <StepCard
              n="02"
              icon={<Gamepad2 className="size-5" />}
              title="Pick your mode"
              body="Full study, speed runs, an AI mentor that talks you through it, or a game. Learning becomes play."
              art="game"
            />
            <StepCard
              n="03"
              icon={<Zap className="size-5" />}
              title="Watch it stick"
              body="Every answer earns XP, every topic mastered is a level up, and your dashboard shows exactly where you stand."
              art="progress"
            />
          </div>
        </div>
      </section>

      {/* Why PlayStudy — ink band */}
      <section id="why" className="on-ink scroll-mt-24 bg-[var(--ink)] px-6 py-20 text-[var(--on-ink)] md:py-28">
        <div className="mx-auto max-w-6xl">
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--on-ink-dim)]">Why PlayStudy</p>
          <h2 className="lp-serif mt-3 max-w-2xl text-[2.5rem] md:text-[3rem]">
            Built for the way you <em>actually</em> study
          </h2>

          <div className="mt-12 grid gap-4 md:grid-cols-3">
            <InkTile className="overflow-hidden p-0 md:col-start-1 md:row-start-1">
              <img src="/image-card-1.png" alt="New game added every week" className="h-full w-full object-cover" />
            </InkTile>

            <InkTile className="md:col-start-2 md:row-span-2">
              <h3 className="lp-serif text-[1.75rem]">Four ways to learn the same thing</h3>
              <p className="mt-2 text-[14px] text-[var(--on-ink-mut)]">
                Switch modes without losing your place. Progress follows the session, not the screen.
              </p>
              <ul className="mt-6 divide-y divide-[var(--hair-ink)] border-y border-[var(--hair-ink)]">
                {[
                  [GraduationCap, "Full study", "Topic by topic, with explanations after every answer."],
                  [Zap, "Speed run", "Flashcards or rapid multiple choice against the clock."],
                  [Mic, "Mentor mode", "An AI voice that teaches, then quizzes you on what it said."],
                  [Gamepad2, "Game zone", "Memory match, platformers and a new game every week."],
                ].map(([Icon, t, d]) => {
                  const I = Icon as typeof GraduationCap;
                  return (
                    <li key={t as string} className="flex items-start gap-3 py-3.5">
                      <I className="mt-0.5 size-4 shrink-0 text-[var(--on-ink-mut)]" />
                      <div>
                        <p className="text-[15px] font-medium">{t as string}</p>
                        <p className="mt-0.5 text-[13px] text-[var(--on-ink-dim)]">{d as string}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </InkTile>

            <InkTile className="md:col-start-3 md:row-start-1">
              <Folder className="size-5 text-[var(--on-ink-mut)]" />
              <h3 className="lp-serif mt-4 text-[1.5rem]">Folders that keep up</h3>
              <p className="mt-2 text-[14px] text-[var(--on-ink-mut)]">
                Drag a session onto a folder and it's filed. Subjects, terms, exams — organise it your way.
              </p>
            </InkTile>

            <InkTile className="overflow-hidden p-0 md:col-start-1 md:row-start-2">
              <video src="/video-card4.mp4" autoPlay muted loop playsInline className="h-full w-full object-cover" />
            </InkTile>

            <InkTile className="md:col-start-3 md:row-start-2">
              <Timer className="size-5 text-[var(--on-ink-mut)]" />
              <h3 className="lp-serif mt-4 text-[1.5rem]">Time that's honest</h3>
              <p className="mt-2 text-[14px] text-[var(--on-ink-mut)]">
                PlayStudy only counts the minutes you're really reading and writing, so your study time means something.
              </p>
            </InkTile>

            {/* Closing band — spans all three columns on a third row, so the
                parent story reads as its own note rather than a fourth card. */}
            <InkTile className="min-h-[200px] justify-center md:col-span-3 md:col-start-1 md:row-start-3">
              <div className="flex flex-col gap-5 md:flex-row md:items-center md:gap-12">
                <div className="md:w-[18rem] md:shrink-0">
                  <Users className="size-5 text-[var(--on-ink-mut)]" />
                  <h3 className="lp-serif mt-4 text-[1.5rem]">Parents can follow along</h3>
                </div>
                <p className="max-w-2xl text-[14px] text-[var(--on-ink-mut)]">
                  Make a profile for a child and they sign in with a name and a six-digit PIN — no email, no inbox to
                  manage. A learner who already has an account hands you a code instead, and then you see the progress —
                  streak, time studied, accuracy — not their written work.
                </p>
              </div>
            </InkTile>
          </div>
        </div>
      </section>

      {/* Manifesto */}
      <section id="manifesto" className="scroll-mt-24 px-6 py-20 md:py-28">
        <div className="mx-auto max-w-2xl">
          <p className={eyebrow}>Our manifesto</p>
          <h2 className="lp-serif mt-3 text-[2.5rem] md:text-[3rem]">
            Learning shouldn't feel like a <em>chore.</em>
          </h2>
          <div className="mt-8 space-y-5 text-[17px] leading-relaxed text-[var(--muted)]">
            <p>
              We believe the best learning happens when you're having fun. When curiosity takes over and studying feels
              like playing your favourite game.
            </p>
            <p>
              Traditional studying is broken. Highlighting textbooks. Rereading notes. Hoping it sticks. We knew there
              had to be a better way.
            </p>
            <p>
              So we built PlayStudy: a place where your notes become quizzes, your slides become flashcards and your
              textbooks become games. Where every answer earns XP, every topic mastered is a level up, and learning
              becomes something you actually want to do.
            </p>
            <p className="text-[var(--ink)]">This is studying, reimagined. This is PlayStudy.</p>
          </div>
          <p className="lp-serif mt-10 border-t border-[var(--hair)] pt-6 text-[1.25rem] italic text-[var(--muted)]">
            — The PlayStudy team
          </p>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-[var(--hair)] px-6 py-14">
        <dl className="mx-auto grid max-w-5xl grid-cols-2 gap-y-10 md:grid-cols-4 md:divide-x md:divide-[var(--hair)]">
          {[
            ["95%", "retention rate"],
            ["3×", "faster learning"],
            ["50K+", "topics covered"],
            ["4.9", "user rating"],
          ].map(([v, l]) => (
            <div key={l} className="text-center md:px-6">
              <dt className="lp-serif text-[3rem] md:text-[3.5rem]">{v}</dt>
              <dd className="mt-1 text-[13px] text-[var(--muted-2)]">{l}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* CTA */}
      <section className="px-6 py-24 text-center md:py-32">
        <h2 className="lp-serif mx-auto max-w-2xl text-[2.5rem] md:text-[3.5rem]">
          Ready to change how you <em>study?</em>
        </h2>
        <p className="mx-auto mt-4 max-w-md text-[16px] text-[var(--muted)]">
          Join thousands of students who've made learning fun again. Free to start, no card needed — and parents can add a child from the same account.
        </p>
        <Link to="/auth" className={cn(inkPill, "mt-8")}>
          Get started free
          <ArrowRight className="size-4" />
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--hair)] px-6 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 md:flex-row">
          <div className="flex items-center gap-3">
            <img src="/ps-logo.png" alt="" className="size-6 rounded-full" />
            <span className="text-[13px] text-[var(--muted-2)]">© 2026 PlayStudy</span>
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
  art: "upload" | "game" | "progress";
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
function StepArt({ kind }: { kind: "upload" | "game" | "progress" }) {
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
  if (kind === "game") {
    return (
      <svg viewBox="0 0 200 150" className="h-36 w-48" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="38" y="50" width="124" height="60" rx="30" opacity="0.9" />
        <path d="M60 80h22M71 69v22" strokeLinecap="round" opacity="0.5" />
        <circle cx="128" cy="72" r="5" opacity="0.5" />
        <circle cx="144" cy="80" r="5" opacity="0.5" />
        <circle cx="128" cy="88" r="5" opacity="0.5" />
        <circle cx="112" cy="80" r="5" fill="currentColor" stroke="none">
          <animate attributeName="opacity" values="1;0.25;1" dur="2.4s" repeatCount="indefinite" />
        </circle>
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 200 150" className="h-36 w-48" fill="none" stroke="currentColor" strokeWidth="1.5">
      {[
        [40, 100, 30],
        [75, 74, 56],
        [110, 52, 78],
        [145, 30, 100],
      ].map(([x, y, h], i) => (
        <rect key={x} x={x} y={y} width="22" height={h} rx="4" opacity={0.25 + i * 0.2}>
          <animate attributeName="height" values={`${h};${h + 10};${h}`} dur="2.4s" begin={`${i * 0.3}s`} repeatCount="indefinite" />
          <animate attributeName="y" values={`${y};${y - 10};${y}`} dur="2.4s" begin={`${i * 0.3}s`} repeatCount="indefinite" />
        </rect>
      ))}
      <path d="M51 92L86 64 121 42 156 22" strokeLinecap="round" opacity="0.9" />
    </svg>
  );
}

export default LandingPage;

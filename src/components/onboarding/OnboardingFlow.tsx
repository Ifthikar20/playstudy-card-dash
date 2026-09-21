import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  GraduationCap,
  Loader2,
  LogOut,
  Presentation,
  User,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  authService,
  SignInWithOrgError,
  type OrgLookup,
  type SsoProvider,
  type TeacherType,
} from "@/services/authService";
import { cn } from "@/lib/utils";

/*
  First-login onboarding — a full-screen takeover shown until the role
  question is answered (session.next_route === "onboarding").

    role ──► student ─────────────────────────────► done
        └──► teacher ──► individual ──────────────► done
                     └──► organization ──► work email ──► org found / new org ──► done
                                                      └──► different domain ──► hand off to that domain's SSO

  Lives in the editorial (.lp) world like the auth screens.
*/

type Step = "role" | "teacher" | "org";

const PROVIDER_LABEL: Record<SsoProvider, string> = {
  google: "Google Workspace",
  microsoft: "Microsoft",
  saml: "Company SSO (SAML)",
};

const inkPill =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[var(--ink)] px-6 text-[14px] font-semibold text-[var(--on-ink)] transition-opacity hover:opacity-85 disabled:opacity-50";
const ghostLink = "inline-flex items-center gap-1.5 text-[13px] text-[var(--muted-2)] transition-opacity hover:opacity-70";

function ChoiceCard({
  icon,
  title,
  body,
  onClick,
  disabled,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group flex flex-col items-start rounded-[var(--r-card)] border border-[var(--hair)] bg-[var(--cream-alt)] p-6 text-left transition-colors hover:border-[var(--ink)] disabled:opacity-60"
    >
      <span className="flex size-10 items-center justify-center rounded-full border border-[var(--hair)] bg-[var(--cream)] text-[var(--ink)]">
        {icon}
      </span>
      <span className="lp-serif mt-5 text-[1.5rem]">{title}</span>
      <span className="mt-1.5 text-[14px] leading-relaxed text-[var(--muted)]">{body}</span>
      <span className="mt-5 inline-flex items-center gap-1 text-[13px] font-medium text-[var(--ink)] opacity-0 transition-opacity group-hover:opacity-100">
        Continue <ArrowRight className="size-3.5" />
      </span>
    </button>
  );
}

export function OnboardingFlow({ onComplete }: { onComplete?: () => void }) {
  const { session, refreshSession, logout } = useAuth();
  const user = session?.user;
  const firstName = (user?.name || "there").split(" ")[0];

  const [step, setStep] = useState<Step>("role");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // organization step
  const [workEmail, setWorkEmail] = useState("");
  const [lookup, setLookup] = useState<OrgLookup | null>(null);
  const [orgName, setOrgName] = useState("");
  const [handoff, setHandoff] = useState<{ domain: string; methods: SsoProvider[] } | null>(null);
  const [providers, setProviders] = useState<Record<SsoProvider, boolean>>({ google: false, microsoft: false, saml: false });

  useEffect(() => {
    if (user?.email) setWorkEmail(user.email);
    if (session?.providers) setProviders(session.providers);
  }, [user?.email, session?.providers]);

  const finish = async () => {
    await refreshSession();
    onComplete?.();
  };

  const submit = async (payload: Parameters<typeof authService.completeOnboarding>[0]) => {
    setBusy(true);
    setError("");
    try {
      await authService.completeOnboarding(payload);
      await finish();
    } catch (e) {
      if (e instanceof SignInWithOrgError) {
        const methods = e.org?.methods?.length ? e.org.methods : (Object.keys(providers) as SsoProvider[]).filter((p) => providers[p]);
        setHandoff({ domain: e.domain, methods });
      } else {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    } finally {
      setBusy(false);
    }
  };

  const chooseTeacher = (type: TeacherType) => {
    if (type === "individual") return submit({ role: "teacher", teacher_type: "individual" });
    setStep("org");
    setLookup(null);
    setHandoff(null);
    setError("");
  };

  const runLookup = async () => {
    setBusy(true);
    setError("");
    setHandoff(null);
    try {
      const result = await authService.lookupOrg(workEmail.trim());
      if (result.personal) {
        setError("That looks like a personal email address. Use your school or district email, or go back and choose “On my own”.");
        setLookup(null);
      } else {
        setLookup(result);
        if (!result.found) setOrgName(titleFromDomain(result.domain));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not look up that domain");
    } finally {
      setBusy(false);
    }
  };

  const confirmOrg = () =>
    submit({
      role: "teacher",
      teacher_type: "organization",
      work_email: workEmail.trim(),
      org_name: lookup?.found ? undefined : orgName.trim() || undefined,
    });

  const startSso = async (provider: SsoProvider, domain: string) => {
    if (provider === "saml") {
      setBusy(true);
      const msg = await authService.startSaml(workEmail.trim());
      setBusy(false);
      if (msg) setError(msg);
      return;
    }
    if (!providers[provider]) {
      setError(`${PROVIDER_LABEL[provider]} sign-in isn't configured on this server yet. Ask your admin, or choose “On my own” for now.`);
      return;
    }
    authService.startOAuth(provider, { next: "/dashboard", hd: domain, loginHint: workEmail.trim() });
  };

  return (
    <div className="lp flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-6 py-5 sm:px-10">
        <div className="flex items-center gap-2.5">
          <img src="/an-logo.svg" alt="" className="size-7 rounded-full" />
          <span className="text-[15px] font-semibold tracking-tight">AnotherNotes</span>
        </div>
        <button type="button" onClick={logout} className={ghostLink}>
          <LogOut className="size-3.5" />
          Sign out
        </button>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-6 pb-16">
        <StepDots step={step} />

        {/* ---------------------------------------------------------------- role */}
        {step === "role" && (
          <>
            <h1 className="lp-serif mt-6 text-[2.5rem] md:text-[3rem]">
              Welcome, {firstName}. <em>How will you use AnotherNotes?</em>
            </h1>
            <p className="mt-3 max-w-xl text-[15px] text-[var(--muted)]">
              We'll set up the right dashboard for you. You only answer this once.
            </p>
            <div className="mt-10 grid gap-4 md:grid-cols-2">
              <ChoiceCard
                icon={<GraduationCap className="size-5" />}
                title="I'm a student"
                body="Turn notes and slides into games, track your XP, and keep every subject in one place."
                onClick={() => submit({ role: "student" })}
                disabled={busy}
              />
              <ChoiceCard
                icon={<Presentation className="size-5" />}
                title="I'm a teacher"
                body="Build study material for your students and see how they're doing."
                onClick={() => setStep("teacher")}
                disabled={busy}
              />
            </div>
          </>
        )}

        {/* ------------------------------------------------------------- teacher */}
        {step === "teacher" && (
          <>
            <button type="button" onClick={() => setStep("role")} className={cn(ghostLink, "mt-6 w-fit")}>
              <ArrowLeft className="size-3.5" /> Back
            </button>
            <h1 className="lp-serif mt-4 text-[2.5rem] md:text-[3rem]">
              How do you <em>teach?</em>
            </h1>
            <p className="mt-3 max-w-xl text-[15px] text-[var(--muted)]">
              This decides how you sign in and who else can see your classes.
            </p>
            <div className="mt-10 grid gap-4 md:grid-cols-2">
              <ChoiceCard
                icon={<User className="size-5" />}
                title="On my own"
                body="I work with my own students. A personal email or Google account is fine."
                onClick={() => chooseTeacher("individual")}
                disabled={busy}
              />
              <ChoiceCard
                icon={<Building2 className="size-5" />}
                title="With my school or district"
                body="We'll connect your organisation's sign-in — Google Workspace, Microsoft, or SAML."
                onClick={() => chooseTeacher("organization")}
                disabled={busy}
              />
            </div>
          </>
        )}

        {/* ----------------------------------------------------------------- org */}
        {step === "org" && (
          <>
            <button type="button" onClick={() => setStep("teacher")} className={cn(ghostLink, "mt-6 w-fit")}>
              <ArrowLeft className="size-3.5" /> Back
            </button>
            <h1 className="lp-serif mt-4 text-[2.5rem] md:text-[3rem]">
              Your <em>school email</em>
            </h1>
            <p className="mt-3 max-w-xl text-[15px] text-[var(--muted)]">
              We use the domain to find your organisation. If it isn't on AnotherNotes yet, you'll set it up and become its
              first admin.
            </p>

            {!handoff && (
              <form
                className="mt-8 flex max-w-lg flex-col gap-3 sm:flex-row"
                onSubmit={(e) => {
                  e.preventDefault();
                  runLookup();
                }}
              >
                <input
                  type="email"
                  required
                  value={workEmail}
                  onChange={(e) => {
                    setWorkEmail(e.target.value);
                    setLookup(null);
                  }}
                  placeholder="you@school.edu"
                  className="h-11 flex-1 rounded-lg border border-[var(--hair)] bg-white px-4 text-[14px] outline-none transition-colors focus:border-[var(--ink)]"
                />
                <button type="submit" disabled={busy || !workEmail.includes("@")} className={inkPill}>
                  {busy && !lookup ? <Loader2 className="size-4 animate-spin" /> : null}
                  Find my organisation
                </button>
              </form>
            )}

            {error && (
              <p className="mt-4 max-w-lg rounded-lg border border-[#c2483d]/30 bg-[#c2483d]/[0.06] px-3 py-2 text-[13px] text-[#a13a31]">
                {error}
              </p>
            )}

            {/* organisation found / new */}
            {lookup && !handoff && (
              <div className="mt-6 max-w-lg rounded-[var(--r-card)] border border-[var(--hair)] bg-[var(--cream-alt)] p-6">
                <div className="flex items-center gap-3">
                  <span className="flex size-11 items-center justify-center rounded-lg bg-[var(--ink)] text-[15px] font-semibold text-[var(--on-ink)]">
                    {(lookup.org?.name ?? orgName ?? lookup.domain).slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    {lookup.found ? (
                      <>
                        <p className="truncate text-[15px] font-semibold">{lookup.org?.name}</p>
                        <p className="text-[13px] text-[var(--muted-2)]">@{lookup.domain} · already on AnotherNotes</p>
                      </>
                    ) : (
                      <>
                        <p className="text-[15px] font-semibold">New organisation for @{lookup.domain}</p>
                        <p className="text-[13px] text-[var(--muted-2)]">You'll be its first admin</p>
                      </>
                    )}
                  </div>
                </div>

                {!lookup.found && (
                  <label className="mt-5 block">
                    <span className="mb-1.5 block text-[13px] font-semibold">Organisation name</span>
                    <input
                      type="text"
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      placeholder="e.g. Lincoln High School"
                      className="h-11 w-full rounded-lg border border-[var(--hair)] bg-white px-4 text-[14px] outline-none transition-colors focus:border-[var(--ink)]"
                    />
                  </label>
                )}

                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <button type="button" onClick={confirmOrg} disabled={busy} className={inkPill}>
                    {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                    {lookup.found ? `Join ${lookup.org?.name}` : "Set up organisation"}
                  </button>
                  <span className="text-[12px] text-[var(--muted-2)]">
                    Signed in as {user?.email}
                  </span>
                </div>
              </div>
            )}

            {/* hand-off to the domain's SSO */}
            {handoff && (
              <div className="mt-6 max-w-lg rounded-[var(--r-card)] border border-[var(--hair)] bg-[var(--cream-alt)] p-6">
                <p className="text-[15px] font-semibold">Sign in with your @{handoff.domain} account</p>
                <p className="mt-1 text-[13px] leading-relaxed text-[var(--muted)]">
                  You're signed in as {user?.email}. To join {handoff.domain} we need you to sign in with that
                  organisation's account, so the membership is verified.
                </p>
                <div className="mt-5 flex flex-col gap-2">
                  {(handoff.methods.length ? handoff.methods : (["google", "microsoft"] as SsoProvider[])).map((m) => (
                    <button
                      key={m}
                      type="button"
                      disabled={busy}
                      onClick={() => startSso(m, handoff.domain)}
                      className="flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-[var(--hair)] bg-white px-4 text-[14px] font-medium transition-colors hover:border-[var(--ink)] disabled:opacity-50"
                    >
                      Continue with {PROVIDER_LABEL[m]}
                      {!providers[m] && <span className="shrink-0 whitespace-nowrap text-[11px] text-[var(--muted-2)]">· not configured</span>}
                    </button>
                  ))}
                </div>
                <button type="button" onClick={() => setHandoff(null)} className={cn(ghostLink, "mt-4")}>
                  <ArrowLeft className="size-3.5" /> Use a different email
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function StepDots({ step }: { step: Step }) {
  const steps: Step[] = ["role", "teacher", "org"];
  const idx = steps.indexOf(step);
  return (
    <div className="flex items-center gap-1.5" aria-hidden>
      {steps.map((s, i) => (
        <span
          key={s}
          className={cn("h-1.5 rounded-full transition-all", i <= idx ? "w-6 bg-[var(--ink)]" : "w-1.5 bg-black/15")}
        />
      ))}
    </div>
  );
}

function titleFromDomain(domain: string) {
  return domain.split(".")[0].replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

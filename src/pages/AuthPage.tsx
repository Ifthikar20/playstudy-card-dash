import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Building2, Eye, EyeOff, Loader2, Lock, Mail, User, Zap } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { authService, type OrgLookup, type SsoProvider } from "@/services/authService";
import { generateRecaptchaToken } from "@/services/recaptchaService";
import TurnstileWidget, {
  TURNSTILE_CONFIGURED,
  type TurnstileHandle,
  type TurnstileStatus,
} from "@/components/TurnstileWidget";
import { cn } from "@/lib/utils";
import { SIGNUPS_OPEN } from "@/lib/signups";
import { usePageMeta } from "@/lib/pageMeta";

/*
  Auth — split screen in the editorial (cream / ink / serif) world.
  Left: the form. Right: a showcase panel with a headline, a media slot and a
  tagline. The media slot is a plain component (`AuthShowcaseMedia`) so the
  animation can be dropped in later without touching the form.
*/

type Mode = "signin" | "register" | "sso";

const PROVIDER_LABEL: Record<SsoProvider, string> = {
  google: "Google Workspace",
  microsoft: "Microsoft",
  saml: "Company SSO",
};

const fieldClass =
  "h-11 w-full rounded-lg border border-[var(--hair)] bg-white pl-10 pr-10 text-[14px] text-[var(--ink)] placeholder:text-[var(--muted-2)]/70 outline-none transition-colors focus:border-[var(--ink)]";
const labelClass = "mb-1.5 block text-[13px] font-semibold text-[var(--ink)]";
const socialPill =
  "flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-[var(--cream-alt)] text-[14px] font-medium text-[var(--ink)] transition-colors hover:bg-black/[0.06]";

export default function AuthPage() {
  const navigate = useNavigate();
  usePageMeta({ title: "Sign in", description: "Sign in to AnotherNotes and pick up your notes, lessons and quizzes where you left off." });
  const { login: authLogin, register: authRegister } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  // Cloudflare Turnstile. `pending` holds the submit button while the challenge
  // runs; it starts false when no sitekey is built in, so the gate is inert in
  // environments that have not configured one.
  const turnstileRef = useRef<TurnstileHandle>(null);
  const [turnstile, setTurnstile] = useState<TurnstileStatus>({
    token: null,
    pending: TURNSTILE_CONFIGURED,
  });

  // single sign-on
  const [providers, setProviders] = useState<Record<SsoProvider, boolean>>({ google: false, microsoft: false, saml: false });
  const [ssoLookup, setSsoLookup] = useState<OrgLookup | null>(null);
  useEffect(() => {
    authService.getProviders().then(setProviders);
  }, []);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError("");
    setNotice("");
    setSsoLookup(null);
  };

  const continueWith = (provider: "google" | "microsoft", opts: { hd?: string; loginHint?: string } = {}) => {
    if (!providers[provider]) {
      setNotice(`${PROVIDER_LABEL[provider]} sign-in isn't configured on this server yet. Use your email for now.`);
      return;
    }
    authService.startOAuth(provider, { next: "/dashboard", ...opts });
  };

  const runSsoLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setNotice("");
    setIsLoading(true);
    try {
      const result = await authService.lookupOrg(email.trim());
      setSsoLookup(result);
      if (result.personal) setNotice("That's a personal email address. Sign in with your email and password, or with Google.");
      else if (!result.found) setNotice(`Single sign-on isn't set up for @${result.domain} yet. Ask your admin, or sign in with email.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not look up that domain");
    } finally {
      setIsLoading(false);
    }
  };

  const startOrgSso = async (method: SsoProvider) => {
    if (!ssoLookup) return;
    if (method === "saml") {
      setIsLoading(true);
      const msg = await authService.startSaml(email.trim());
      setIsLoading(false);
      if (msg) setError(msg);
      return;
    }
    continueWith(method, { hd: ssoLookup.domain, loginHint: email.trim() });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setNotice("");
    setIsLoading(true);
    try {
      const recaptchaToken = await generateRecaptchaToken(mode === "signin" ? "login" : "register");
      const turnstileToken = turnstile.token || undefined;
      const result =
        mode === "signin"
          ? await authLogin(email, password, recaptchaToken || undefined, turnstileToken)
          : await authRegister(email, name, password, recaptchaToken || undefined, turnstileToken);
      if (result.success) navigate("/dashboard");
      else {
        setError(result.error || (mode === "signin" ? "Login failed" : "Registration failed"));
        // The token we just spent is single-use. Without a fresh one the next
        // attempt fails on the token, not the password, which reads as a
        // correct password being rejected.
        turnstileRef.current?.reset();
      }
    } catch {
      setError("An unexpected error occurred");
      turnstileRef.current?.reset();
    } finally {
      setIsLoading(false);
    }
  };

  const fillDemo = () => {
    setEmail("student@anothernotes.com");
    setPassword("password123");
    setMode("signin");
    setNotice("Demo credentials filled in. Press Login to continue.");
  };

  const comingSoon = (provider: string) => setNotice(`${provider} sign-in is coming soon. Use your email for now.`);

  return (
    <div className="lp grid min-h-screen lg:grid-cols-2">
      {/* Left — form */}
      <div className="relative flex flex-col px-6 py-8 sm:px-12">
        <Link
          to="/"
          className="inline-flex w-fit items-center gap-1.5 text-[13px] text-[var(--muted-2)] transition-opacity hover:opacity-70"
        >
          <ArrowLeft className="size-3.5" />
          Back to home
        </Link>

        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          <img src="/an-logo.svg" alt="" className="mx-auto mb-6 size-10" />
          <h1 className="lp-serif text-center text-[2.25rem] leading-[1.1] md:text-[2.5rem]">
            {mode === "signin" && (
              <>
                Welcome back to <br />
                AnotherNotes
              </>
            )}
            {mode === "register" && (
              <>
                Create your <br />
                AnotherNotes account
              </>
            )}
            {mode === "sso" && (
              <>
                Sign in with your <br />
                <em>organisation</em>
              </>
            )}
          </h1>

          {!SIGNUPS_OPEN && mode === "signin" && (
            <p className="mt-6 flex items-start gap-2.5 rounded-lg border border-[var(--hair)] bg-[var(--cream-alt)] px-3.5 py-3 text-[13px] leading-snug text-[var(--muted)]">
              <span className="mt-px shrink-0 rounded-full bg-[var(--ink)] px-2 py-px text-[10px] font-semibold uppercase tracking-wider text-[var(--on-ink)]">
                Beta
              </span>
              <span>AnotherNotes is in beta, so new sign-ups are paused. Already have an account? Sign in below.</span>
            </p>
          )}

          {mode !== "sso" && (
            <>
              <div className={cn("flex gap-3", SIGNUPS_OPEN ? "mt-8" : "mt-6")}>
                <button type="button" className={socialPill} onClick={() => continueWith("google")}>
                  <GoogleMark />
                  Google
                </button>
                <button type="button" className={socialPill} onClick={() => comingSoon("Apple")}>
                  <AppleMark />
                  Apple
                </button>
              </div>

              <div className="my-6 flex items-center gap-3 text-[12px] text-[var(--muted-2)]">
                <span className="h-px flex-1 bg-[var(--hair)]" />
                or
                <span className="h-px flex-1 bg-[var(--hair)]" />
              </div>
            </>
          )}

          {error && (
            <p className="mb-4 rounded-lg border border-[#c2483d]/30 bg-[#c2483d]/[0.06] px-3 py-2 text-[13px] text-[#a13a31]">
              {error}
            </p>
          )}
          {notice && !error && (
            <p className="mb-4 rounded-lg border border-[var(--hair)] bg-[var(--cream-alt)] px-3 py-2 text-[13px] text-[var(--muted)]">
              {notice}
            </p>
          )}

          {mode === "sso" && (
            <form onSubmit={runSsoLookup} className="mt-8 space-y-4">
              <p className="text-[13px] leading-relaxed text-[var(--muted)]">
                Enter your school or district email and we'll find your organisation's sign-in.
              </p>
              <Field label="Work email" htmlFor="sso-email" icon={<Mail className="size-4" />}>
                <input
                  id="sso-email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@school.edu"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setSsoLookup(null);
                  }}
                  required
                  disabled={isLoading}
                  className={fieldClass}
                />
              </Field>
              {ssoLookup?.found && ssoLookup.org && (
                <div className="rounded-lg border border-[var(--hair)] bg-[var(--cream-alt)] p-4">
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 items-center justify-center rounded-lg bg-[var(--ink)] text-[14px] font-semibold text-[var(--on-ink)]">
                      {ssoLookup.org.name.slice(0, 1).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-semibold">{ssoLookup.org.name}</p>
                      <p className="text-[12px] text-[var(--muted-2)]">Single sign-on for @{ssoLookup.domain}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-col gap-2">
                    {(ssoLookup.methods.length ? ssoLookup.methods : (["google", "microsoft"] as SsoProvider[])).map((m) => (
                      <button
                        key={m}
                        type="button"
                        disabled={isLoading}
                        onClick={() => startOrgSso(m)}
                        className="flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-[var(--hair)] bg-white px-3 text-[13px] font-medium transition-colors hover:border-[var(--ink)] disabled:opacity-50"
                      >
                        {m === "google" && <GoogleMark />}
                        Continue with {PROVIDER_LABEL[m]}
                        {!providers[m] && <span className="shrink-0 whitespace-nowrap text-[11px] text-[var(--muted-2)]">· not configured</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {!ssoLookup?.found && (
                <button
                  type="submit"
                  disabled={isLoading || !email.includes("@")}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[var(--ink)] text-[14px] font-semibold text-[var(--on-ink)] transition-opacity hover:opacity-85 disabled:opacity-60"
                >
                  {isLoading && <Loader2 className="size-4 animate-spin" />}
                  Continue
                </button>
              )}
              <p className="text-center text-[13px] text-[var(--muted-2)]">
                <button type="button" onClick={() => switchMode("signin")} className="font-medium text-[var(--ink)] underline underline-offset-2">
                  Back to email sign-in
                </button>
              </p>
            </form>
          )}

          <form onSubmit={handleSubmit} className={cn("space-y-4", mode === "sso" && "hidden")}>
            {mode === "register" && (
              <Field label="Your name" htmlFor="name" icon={<User className="size-4" />}>
                <input
                  id="name"
                  type="text"
                  autoComplete="name"
                  placeholder="Enter your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={isLoading}
                  className={fieldClass}
                />
              </Field>
            )}
            <Field label="Your email" htmlFor="email" icon={<Mail className="size-4" />}>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                className={fieldClass}
              />
            </Field>
            <Field
              label="Your password"
              htmlFor="password"
              icon={<Lock className="size-4" />}
              trailing={
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="text-[var(--muted-2)] transition-opacity hover:opacity-70"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              }
            >
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                placeholder={mode === "signin" ? "Enter your password" : "At least 8 characters"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={mode === "register" ? 8 : undefined}
                disabled={isLoading}
                className={fieldClass}
              />
            </Field>

            {mode !== "sso" && (
              <TurnstileWidget
                ref={turnstileRef}
                action={mode === "signin" ? "login" : "register"}
                onChange={setTurnstile}
                className="flex flex-col items-center pt-1"
              />
            )}

            <button
              type="submit"
              disabled={isLoading || turnstile.pending}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[var(--ink)] text-[14px] font-semibold text-[var(--on-ink)] transition-opacity hover:opacity-85 disabled:opacity-60"
            >
              {isLoading && <Loader2 className="size-4 animate-spin" />}
              {mode === "signin" ? "Login" : "Create account"}
            </button>
          </form>

          {mode !== "sso" && (
          <p className="mt-4 text-center text-[11px] text-[var(--muted-2)]">
            By {mode === "signin" ? "logging in" : "signing up"}, you agree to our{" "}
            <Link to="/terms" className="underline underline-offset-2">Terms of Service</Link> and{" "}
            <Link to="/privacy" className="underline underline-offset-2">Privacy Policy</Link>
          </p>
          )}

          <div className={cn("mt-6 space-y-1.5 text-center text-[13px] text-[var(--muted-2)]", mode === "sso" && "hidden")}>
            {mode === "signin" ? (
              <>
                <p>
                  <button type="button" onClick={() => switchMode("sso")} className="inline-flex items-center gap-1.5 font-medium text-[var(--ink)] underline underline-offset-2">
                    <Building2 className="size-3.5" />
                    Sign in with your organisation
                  </button>
                </p>
                {SIGNUPS_OPEN && (
                  <p>
                    Don't have an account?{" "}
                    <button type="button" onClick={() => switchMode("register")} className="font-medium text-[var(--ink)] underline underline-offset-2">
                      Register
                    </button>
                  </p>
                )}
                <p>
                  Forgot your password?{" "}
                  <button type="button" onClick={() => setNotice("Password reset is coming soon. Contact support to regain access.")} className="font-medium text-[var(--ink)] underline underline-offset-2">
                    Reset password
                  </button>
                </p>
              </>
            ) : (
              <p>
                Already have an account?{" "}
                <button type="button" onClick={() => switchMode("signin")} className="font-medium text-[var(--ink)] underline underline-offset-2">
                  Log in
                </button>
              </p>
            )}
            {import.meta.env.DEV && (
              <p className="pt-2">
                <button type="button" onClick={fillDemo} className="inline-flex items-center gap-1 text-[12px] text-[var(--muted-2)] hover:text-[var(--ink)]">
                  <Zap className="size-3" />
                  Use demo account
                </button>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Right — showcase. Just the clip and one line. The "3× faster
          learning", "turn them into a game" and "used around the world" lines
          that were here were claims nothing backs, about a product that no
          longer has games. */}
      <aside className="hidden flex-col items-center justify-center bg-[var(--cream-alt)] px-12 py-16 lg:flex">
        <AuthShowcaseMedia />

        <p className="lp-serif mt-2 text-center text-[1.5rem] leading-snug">
          Drop your notes in,
          <br />
          and see them turn into a lesson.
        </p>
      </aside>
    </div>
  );
}

/**
 * The media slot on the showcase panel: the same looping clip as the landing
 * page's "Why" band (a web copy: 720p, silent, about 0.6 MB), so most visitors
 * already have it cached. The ink background shows while it loads.
 */
function AuthShowcaseMedia() {
  return (
    <div
      id="auth-showcase-media"
      className="my-10 aspect-[4/3] w-full max-w-lg overflow-hidden rounded-[var(--r-card)] border border-[var(--hair-soft)] bg-[var(--ink)]"
    >
      <video
        src="/why-desk.mp4"
        autoPlay
        muted
        loop
        playsInline
        aria-hidden="true"
        className="h-full w-full object-cover object-[70%_50%]"
      />
    </div>
  );
}

function Field({
  label,
  htmlFor,
  icon,
  trailing,
  children,
}: {
  label: string;
  htmlFor: string;
  icon: ReactNode;
  trailing?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className={labelClass}>
        {label}
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted-2)]">{icon}</span>
        {children}
        {trailing && <span className={cn("absolute right-3.5 top-1/2 flex -translate-y-1/2")}>{trailing}</span>}
      </div>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function AppleMark() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  );
}

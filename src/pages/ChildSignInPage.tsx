import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, User } from "lucide-react";
import { authService } from "@/services/authService";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useAuth } from "@/contexts/AuthContext";
import { usePageMeta } from "@/lib/pageMeta";

/*
  Kids' sign-in — username and PIN, in the same editorial (cream / ink / serif)
  world as /auth.

  A page of its own rather than a fourth mode on AuthPage: that component's
  three modes already gate around eight conditionals across a long JSX body,
  and none of this screen's chrome (no email, no password, no SSO, no
  organisation) overlaps with it. Parents also get a URL they can bookmark on
  the child's device.
*/

const fieldClass =
  "h-12 w-full rounded-lg border border-[var(--hair)] bg-white pl-10 pr-3 text-[15px] text-[var(--ink)] placeholder:text-[var(--muted-2)]/70 outline-none transition-colors focus:border-[var(--ink)]";
const labelClass = "mb-1.5 block text-[13px] font-semibold text-[var(--ink)]";

const PIN_LENGTH = 6;

function formatWait(seconds: number): string {
  if (seconds <= 60) return "a minute";
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `${minutes} minutes`;
  const hours = Math.ceil(minutes / 60);
  return hours === 1 ? "an hour" : `${hours} hours`;
}

export default function ChildSignInPage() {
  usePageMeta({
    title: "Kids' sign-in",
    description: "Children sign in to AnotherNotes with the name and six-digit PIN a parent or guardian set up.",
  });
  const navigate = useNavigate();
  const { refreshAuth } = useAuth();
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const submittedFor = useRef("");

  const canSubmit = username.trim().length > 0 && pin.length === PIN_LENGTH && !isLoading;

  async function submit() {
    if (!canSubmit) return;
    setIsLoading(true);
    setError("");
    const result = await authService.loginChild({ username: username.trim(), pin });
    setIsLoading(false);

    if (result.success) {
      refreshAuth();
      navigate("/dashboard", { replace: true });
      return;
    }

    setPin("");
    submittedFor.current = "";
    setError(
      result.lockedForSeconds
        ? `Too many tries. Ask a parent to help, or try again in ${formatWait(result.lockedForSeconds)}.`
        : result.error || "That didn't work. Check the name and PIN and try again.",
    );
  }

  // Six digits is the whole PIN, so submit as soon as it is complete rather
  // than asking a child to find a button. Guarded so a failed attempt does not
  // immediately resubmit the same value.
  useEffect(() => {
    if (pin.length === PIN_LENGTH && username.trim() && submittedFor.current !== pin) {
      submittedFor.current = pin;
      void submit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  return (
    <div className="lp min-h-screen">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-12">
        <Link
          to="/"
          className="mb-10 inline-flex items-center gap-1.5 self-start text-[13px] font-medium text-[var(--muted-2)] transition-colors hover:text-[var(--ink)]"
        >
          <ArrowLeft className="size-4" />
          Back
        </Link>

        <h1 className="lp-serif text-center text-[2.25rem] leading-[1.1]">Hi! Let's study.</h1>
        <p className="mt-3 text-center text-[14px] leading-relaxed text-[var(--muted)]">
          Type the name and PIN a grown-up gave you.
        </p>

        {error && (
          <p
            role="alert"
            className="mt-6 rounded-lg border border-[#c2483d]/30 bg-[#c2483d]/[0.06] px-3 py-2 text-center text-[13px] text-[#a13a31]"
          >
            {error}
          </p>
        )}

        <form
          className="mt-8 space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div>
            <label htmlFor="child-username" className={labelClass}>
              Your name
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-2)]">
                <User className="size-4" />
              </span>
              <input
                id="child-username"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="ava-k3m9"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isLoading}
                className={fieldClass}
              />
            </div>
          </div>

          <div>
            <label className={labelClass} htmlFor="child-pin">
              Your PIN
            </label>
            <InputOTP
              id="child-pin"
              maxLength={PIN_LENGTH}
              value={pin}
              onChange={setPin}
              disabled={isLoading}
              inputMode="numeric"
              pattern="[0-9]*"
              containerClassName="justify-between"
            >
              <InputOTPGroup className="gap-2">
                {Array.from({ length: PIN_LENGTH }, (_, i) => (
                  <InputOTPSlot
                    key={i}
                    index={i}
                    className="size-12 rounded-lg border border-[var(--hair)] bg-white text-[18px] font-semibold text-[var(--ink)]"
                  />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--ink)] text-[15px] font-semibold text-[var(--on-ink)] transition-opacity hover:opacity-85 disabled:opacity-40"
          >
            {isLoading && <Loader2 className="size-4 animate-spin" />}
            Start
          </button>
        </form>

        <p className="mt-8 text-center text-[13px] text-[var(--muted-2)]">
          Are you a grown-up?{" "}
          <Link to="/auth" className="font-medium text-[var(--ink)] underline underline-offset-2">
            Sign in here
          </Link>
        </p>
      </div>
    </div>
  );
}

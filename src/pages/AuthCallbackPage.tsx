import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { authService } from "@/services/authService";
import { useAuth } from "@/contexts/AuthContext";

/*
  /auth/callback — return leg of Google / Microsoft (and later SAML) sign-in.
  The backend finishes the OAuth exchange and redirects here with the session
  token in the URL *fragment* (#token=…), so it never reaches a server log.
  Errors arrive as #error=<code>.
*/

const ERRORS: Record<string, string> = {
  access_denied: "You cancelled the sign-in. Nothing was changed.",
  not_configured: "That sign-in method isn't configured on this server yet.",
  invalid_state: "That sign-in link expired or was reused. Please try again.",
  exchange_failed: "We couldn't complete the sign-in with the provider. Please try again.",
  no_email: "The provider didn't share an email address, which AnotherNotes needs.",
  inactive: "This account has been deactivated.",
  sso_enforced: "Your organisation requires a different sign-in method.",
  signups_closed: "There's no AnotherNotes account for that address. AnotherNotes is in beta, so new sign-ups are paused.",
  managed_account: "That address belongs to a profile a parent or guardian manages, which signs in with a username and PIN.",
  email_unverified: "The provider hasn't verified that email address, so it can't be used to sign in to the account that uses it.",
};

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const { refreshAuth } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const token = params.get("token");
    const err = params.get("error");
    const next = params.get("next") || "/dashboard";

    window.history.replaceState(null, "", "/auth/callback");

    if (err) {
      setError(ERRORS[err] ?? `Sign-in failed (${err}).`);
      return;
    }
    if (!token || !authService.adoptToken(token)) {
      setError("No valid sign-in token was returned. Please try again.");
      return;
    }
    refreshAuth();
    navigate(next.startsWith("/") ? next : "/dashboard", { replace: true });
  }, [navigate, refreshAuth]);

  return (
    <div className="lp flex min-h-screen flex-col items-center justify-center px-6 text-center">
      {error ? (
        <>
          <h1 className="lp-serif text-[2rem]">We couldn't sign you in</h1>
          <p className="mt-3 max-w-sm text-[15px] text-[var(--muted)]">{error}</p>
          <Link
            to="/auth"
            className="mt-8 inline-flex items-center rounded-full bg-[var(--ink)] px-6 py-3 text-[14px] font-medium text-[var(--on-ink)]"
          >
            Back to sign in
          </Link>
        </>
      ) : (
        <>
          <Loader2 className="size-6 animate-spin text-[var(--muted-2)]" />
          <p className="mt-4 text-[14px] text-[var(--muted)]">Signing you in…</p>
        </>
      )}
    </div>
  );
}

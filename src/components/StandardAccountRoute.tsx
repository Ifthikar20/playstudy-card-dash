import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { LoadingSpinner } from "./LoadingSpinner";

/**
 * Keeps guardian-only screens away from a profile a guardian created.
 *
 * ProtectedRoute only asks "is anyone signed in", and account_kind arrives
 * with the session rather than in the token, so it has to be waited for —
 * rendering before it lands would flash the Family section at a child.
 *
 * The server refuses these routes regardless; this is so the UI does not
 * offer a child something they will only be told off for.
 */
export default function StandardAccountRoute({ children }: { children: React.ReactNode }) {
  const { session, sessionLoading } = useAuth();

  if (!session && sessionLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <LoadingSpinner message="Loading…" />
      </div>
    );
  }

  if (session?.user.account_kind === "managed_child") {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

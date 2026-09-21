/**
 * Local data that belongs to whoever is signed in.
 *
 * This matters more than it looks on a family device. Sessions are cached in
 * localStorage under global, non-user-scoped keys with a five-minute TTL, so
 * without an explicit clear on sign-out a child signing out and a parent
 * signing in straight after would see the child's sessions — and vice versa.
 * localStorage survives the full page load that sign-out triggers, so it has
 * to be cleared deliberately; the in-memory react-query cache does not, and
 * needs no help.
 */

/** Key prefixes holding data about the signed-in user. */
const OWNED_PREFIXES = [
  'playstudy_', // cached sessions and per-session snapshots (src/services/api.ts)
  'ps-pref:',   // profile toggles (src/pages/ProfilePage.tsx)
];

export function clearCachedUserData(): void {
  try {
    for (const key of Object.keys(localStorage)) {
      if (OWNED_PREFIXES.some((prefix) => key.startsWith(prefix))) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    // Private mode, or storage disabled. Nothing cached means nothing to leak.
  }
}

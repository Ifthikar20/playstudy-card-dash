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

/* The pre-rename brand, split so a find-and-replace over this repo cannot
   rewrite it. See RENAMED_PREFIXES below for what happened when it could. */
const OLD = 'play' + 'study';

/** Key prefixes holding data about the signed-in user. Both spellings: a browser
 *  that was used before the rename to AnotherNotes still has the old
 *  keys, and a sign-out that swept only the new ones would leave a child's
 *  cached sessions sitting there for the next person to sign in. */
const OWNED_PREFIXES = [
  'anothernotes_', // cached sessions and per-session snapshots (src/services/api.ts)
  'an-pref:',      // profile toggles (src/pages/ProfilePage.tsx)
  OLD + '_',       // pre-rename
  'ps' + '-pref:', // pre-rename
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

/**
 * Old prefix -> new prefix, applied at start-up.
 *
 * The old prefixes are ASSEMBLED rather than written out, and that is not
 * decoration: a find-and-replace over this repo for the old brand rewrote both
 * sides of this table to the same string. With both sides equal, the loop below
 * copied each key onto itself and then deleted it — wiping every preference on
 * every page load. Keeping the old spellings un-greppable means the next sweep
 * cannot silently turn this migration into a delete.
 */
const RENAMED_PREFIXES: Array<[string, string]> = [
  [OLD + '_', 'anothernotes_'],
  ['ps' + '-', 'an-'],
];

/**
 * Carry a returning person's browser storage across the rename.
 *
 * Every key this app writes was prefixed for AnotherNotes — the session cache, the
 * chosen sheet colour, the Read-mode theme, the guide's voice and speaking rate,
 * the whiteboard's position. Renaming the prefixes without this would silently
 * reset all of it on the first visit after deploy, which reads as the app having
 * forgotten you rather than as a rename.
 *
 * Idempotent, and a value already written under the new name always wins, so it
 * is safe to run on every load and safe to run twice.
 */
export function migrateLocalKeys(): void {
  try {
    for (const key of Object.keys(localStorage)) {
      const rule = RENAMED_PREFIXES.find(([from]) => key.startsWith(from));
      if (!rule) continue;
      const next = rule[1] + key.slice(rule[0].length);
      if (next === key) continue; // belt and braces: never delete a key to "rename" it to itself
      const value = localStorage.getItem(key);
      if (value !== null && localStorage.getItem(next) === null) localStorage.setItem(next, value);
      localStorage.removeItem(key);
    }
  } catch {
    // Private mode, or storage disabled. Nothing stored, nothing to carry over.
  }
}

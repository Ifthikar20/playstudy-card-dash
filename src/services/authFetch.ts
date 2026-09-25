/**
 * fetch() for the signed-in app.
 *
 * Every call to the API goes through here so the sign-in story lives in one place:
 *   - the access token (15 minutes) is attached as a Bearer header, never in a URL;
 *   - a token about to expire is renewed first, so a long voice stream never starts
 *     on a token that dies halfway through;
 *   - a 401 gets exactly one renew-and-retry, and only a renewal the server refuses
 *     ends the session.
 * Callers build their own headers as before; a stale Authorization header they
 * captured earlier is replaced with the current token.
 */
import { authService } from "./authService";

const withToken = (init: RequestInit): RequestInit => {
  const headers = new Headers(init.headers ?? {});
  const token = authService.getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  else headers.delete("Authorization");
  return { ...init, headers };
};

export async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  if (authService.getToken()) await authService.ensureFreshToken();
  let res = await fetch(input, withToken(init));
  if (res.status === 401 && authService.getToken()) {
    const result = await authService.refreshToken(true);
    if (result === "refreshed") {
      res = await fetch(input, withToken(init));
    } else if (result === "rejected") {
      void authService.logout();
    }
  }
  return res;
}

/**
 * Centralized Authentication Service
 *
 * How a session works now:
 *   - The access token lasts 15 minutes and is the only credential the page can
 *     read (localStorage, sent as a Bearer header by authFetch).
 *   - The refresh token is an httpOnly cookie scoped to /api/auth/ that the server
 *     sets on sign-in and rotates on every renewal; a script in the page can never
 *     read it. Renewal is POST /auth/refresh with the cookie plus an
 *     X-Requested-With header (the CSRF check), serialised across tabs so two tabs
 *     cannot race the rotation.
 *   - The token is renewed a minute before it expires while the app is open, and
 *     on the next request after it wasn't. Only a renewal the server refuses (sign-out
 *     everywhere, a PIN reset, a deactivated account) ends the session.
 */

import { clearCachedUserData } from '@/lib/localData';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

// Token storage keys
const AUTH_TOKEN_KEY = 'auth_token';
const TOKEN_EXPIRY_KEY = 'token_expiry';

export interface LoginCredentials {
  email: string;
  password: string;
  recaptchaToken?: string;
  turnstileToken?: string;
}

export interface RegisterCredentials {
  email: string;
  name: string;
  password: string;
  recaptchaToken?: string;
  turnstileToken?: string;
}

export interface AuthResponse {
  success: boolean;
  error?: string;
  user?: {
    id: string;
    email: string;
    name: string;
  };
}

export interface TokenPayload {
  sub: string; // user ID
  /** Absent on a child token — a guardian-created profile has no email. */
  email?: string;
  /** "child" on a guardian-created profile's token. */
  kind?: 'child';
  exp: number; // expiration timestamp
  iat: number; // issued at timestamp
  /** The account's token epoch; the server ends every session by moving it. */
  ep?: number;
}

/** Renew when this little of the access token's life is left (seconds). */
const RENEW_BEFORE_EXPIRY_S = 120;
/** The background timer fires this long before expiry (seconds). */
const SCHEDULE_BEFORE_EXPIRY_S = 60;
/** Requests to the auth endpoints carry the refresh cookie and this header. */
const APP_HEADER = { 'X-Requested-With': 'fetch' } as const;
const REFRESH_LOCK = 'anothernotes-token-refresh';

export interface ChildLoginCredentials {
  username: string;
  pin: string;
  turnstileToken?: string;
}

export interface ChildLoginResult {
  success: boolean;
  error?: string;
  /** Set when the profile is locked after too many wrong PINs. */
  lockedForSeconds?: number;
  child?: { name: string; username: string };
}

export type UserRole = 'student' | 'teacher';
export type TeacherType = 'individual' | 'organization';
export type SsoProvider = 'google' | 'microsoft' | 'saml';

/**
 * "standard" is an ordinary account. "managed_child" is a profile a guardian
 * created: no email, signs in with a username and PIN, and cannot be detached
 * from its guardian.
 *
 * Note this is NOT a role. A guardian is any adult who has added a child, and
 * a managed child is still a student.
 */
export type AccountKind = 'standard' | 'managed_child';

export interface SessionUser {
  id: string;
  /** null on a guardian-created profile. */
  email: string | null;
  name: string;
  /** Sign-in name for a guardian-created profile, e.g. "ava-k3m9". */
  username: string | null;
  xp: number;
  role: UserRole | null;
  teacher_type: TeacherType | null;
  onboarding_completed: boolean;
  auth_provider: 'password' | SsoProvider;
  org_role: 'owner' | 'admin' | 'member' | null;
  account_kind: AccountKind;
  /** The key that opens the tutor's microphone ("KeyM", "Alt+Space"); null = the default. */
  voice_key: string | null;
  /** How the Teach mode tutors look ("male:owl,female:fox"); null = the defaults. */
  guide_avatar?: string | null;
  /** Learners this account follows. > 0 means the Family section has content. */
  child_count: number;
  /** Adults who can see this account's progress. */
  guardian_count: number;
}

export interface Organization {
  id: number;
  name: string;
  slug: string;
  logo_url: string | null;
  sso_provider: SsoProvider | null;
  sso_enforced: boolean;
  domains: string[];
  methods: SsoProvider[];
}

export interface Session {
  user: SessionUser;
  org: Organization | null;
  next_route: 'onboarding' | 'dashboard';
  providers: Record<SsoProvider, boolean>;
}

export interface OrgLookup {
  found: boolean;
  domain: string;
  personal: boolean;
  org: Organization | null;
  methods: SsoProvider[];
}

export interface OnboardingPayload {
  role: UserRole;
  teacher_type?: TeacherType;
  work_email?: string;
  org_name?: string;
  /** The talk key picked on the last screen, e.g. "KeyM" or "Alt+Space". */
  voice_key?: string;
  /** The tutors' looks picked on the screen before it, e.g. "male:owl,female:fox". */
  guide_avatar?: string;
}

/** Thrown by completeOnboarding when the org identity must come from SSO. */
export class SignInWithOrgError extends Error {
  domain: string;
  org: Organization | null;
  constructor(domain: string, org: Organization | null) {
    super(`Sign in with your ${domain} account to continue`);
    this.name = 'SignInWithOrgError';
    this.domain = domain;
    this.org = org;
  }
}

export type RefreshResult = 'refreshed' | 'rejected' | 'unavailable';

class AuthService {
  /**
   * Get the current authentication token
   */
  getToken(): string | null {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  }

  /**
   * Set authentication token and expiry
   */
  private setToken(token: string): void {
    localStorage.setItem(AUTH_TOKEN_KEY, token);

    // Decode JWT to get expiry (simple base64 decode of payload)
    try {
      const payload = this.decodeToken(token);
      if (payload?.exp) {
        localStorage.setItem(TOKEN_EXPIRY_KEY, payload.exp.toString());
      }
    } catch (error) {
      console.error('[AuthService] Failed to decode token:', error);
    }
    this.scheduleRefresh();
  }

  private refreshTimer: number | undefined;

  /**
   * Renew the token a minute before it expires, for as long as the app stays open.
   * A tab in the background may have its timers throttled; ensureFreshToken() on the
   * next request covers that case.
   */
  scheduleRefresh(): void {
    if (typeof window === 'undefined') return;
    window.clearTimeout(this.refreshTimer);
    this.refreshTimer = undefined;
    const payload = this.getCurrentUser();
    if (!payload?.exp) return;
    const inMs = Math.max(0, (payload.exp - SCHEDULE_BEFORE_EXPIRY_S) * 1000 - Date.now());
    this.refreshTimer = window.setTimeout(() => {
      void this.refreshToken().then((result) => {
        if (result === 'rejected') void this.logout();
        else if (result === 'unavailable') this.retryRefreshSoon();
      });
    }, inMs);
  }

  private retryRefreshSoon(): void {
    if (typeof window === 'undefined') return;
    window.clearTimeout(this.refreshTimer);
    this.refreshTimer = window.setTimeout(() => this.scheduleRefresh(), 30_000);
  }

  private cancelScheduledRefresh(): void {
    if (typeof window === 'undefined') return;
    window.clearTimeout(this.refreshTimer);
    this.refreshTimer = undefined;
  }

  /**
   * Adopt an externally obtained access token (dev tooling / scripted login).
   * Validates that it decodes and is not expired before storing it.
   * Returns true when the token was accepted.
   */
  adoptToken(token: string): boolean {
    const payload = this.decodeToken(token);
    if (!payload?.exp) {
      console.error('[AuthService] adoptToken: token is not a valid JWT');
      return false;
    }
    if (payload.exp - Math.floor(Date.now() / 1000) < 60) {
      console.error('[AuthService] adoptToken: token is expired');
      return false;
    }
    this.setToken(token);
    console.log('[AuthService] Adopted token for user:', payload.email);
    return true;
  }

  /**
   * Remove authentication token
   */
  private removeToken(): void {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
    this.cancelScheduledRefresh();
  }

  /**
   * Decode JWT token payload (without verification)
   * Note: This is for client-side expiry checking only.
   * Server always validates the token cryptographically.
   */
  private decodeToken(token: string): TokenPayload | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return null;
      }

      // Decode base64url payload
      const payload = parts[1];
      const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );

      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error('[AuthService] Token decode error:', error);
      return null;
    }
  }

  /**
   * Check if the current token is expired
   */
  isTokenExpired(): boolean {
    const token = this.getToken();
    if (!token) {
      return true;
    }

    const payload = this.decodeToken(token);
    if (!payload?.exp) {
      return true;
    }

    // Check if token expires within next 60 seconds (buffer for refresh)
    const now = Math.floor(Date.now() / 1000);
    return payload.exp - now < 60;
  }

  /**
   * Signed in = a token is stored. Expiry is not a sign-out: an expired token is
   * renewed in the background (see ensureFreshToken) and only a token the server
   * rejects clears the session.
   */
  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  /**
   * Get current user info from token
   */
  getCurrentUser(): TokenPayload | null {
    const token = this.getToken();
    if (!token) {
      return null;
    }
    return this.decodeToken(token);
  }

  /**
   * Login user with email and password
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      console.log('[AuthService] Attempting login for:', credentials.email);

      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: credentials.email,
          password: credentials.password,
          recaptchaToken: credentials.recaptchaToken,
          turnstileToken: credentials.turnstileToken,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[AuthService] Login failed:', errorData);
        return {
          success: false,
          error: errorData.detail || 'Login failed'
        };
      }

      const data = await response.json();
      this.setToken(data.access_token);

      const user = this.getCurrentUser();
      console.log('[AuthService] Login successful for user:', user?.email);

      return {
        success: true,
        user: user ? {
          id: user.sub,
          email: user.email,
          name: user.email.split('@')[0] // Fallback name
        } : undefined
      };
    } catch (error) {
      console.error('[AuthService] Login error:', error);
      return {
        success: false,
        error: 'Network error. Please check your connection and try again.'
      };
    }
  }

  /**
   * Register new user
   */
  async register(credentials: RegisterCredentials): Promise<AuthResponse> {
    try {
      console.log('[AuthService] Attempting registration for:', credentials.email);

      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: credentials.email,
          name: credentials.name,
          password: credentials.password,
          recaptchaToken: credentials.recaptchaToken,
          turnstileToken: credentials.turnstileToken,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[AuthService] Registration failed:', errorData);
        return {
          success: false,
          error: errorData.detail || 'Registration failed'
        };
      }

      const data = await response.json();
      this.setToken(data.access_token);

      const user = this.getCurrentUser();
      console.log('[AuthService] Registration successful for user:', user?.email);

      return {
        success: true,
        user: user ? {
          id: user.sub,
          email: user.email,
          name: credentials.name
        } : undefined
      };
    } catch (error) {
      console.error('[AuthService] Registration error:', error);
      return {
        success: false,
        error: 'Network error. Please check your connection and try again.'
      };
    }
  }

  /**
   * Sign in a guardian-created child profile with a username and PIN.
   *
   * A separate call rather than a mode on login(): the endpoint differs, the
   * response carries the child's display name instead of an email, and a
   * locked profile comes back as 423 with how long to wait.
   */
  async loginChild(credentials: ChildLoginCredentials): Promise<ChildLoginResult> {
    try {
      const response = await fetch(`${API_URL}/auth/child/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: credentials.username,
          pin: credentials.pin,
          turnstileToken: credentials.turnstileToken,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 423) {
          const detail = data?.detail ?? {};
          return {
            success: false,
            error: detail.message || 'Too many tries. Ask your parent to help.',
            lockedForSeconds: detail.retryAfterSeconds,
          };
        }
        return {
          success: false,
          error: typeof data?.detail === 'string' ? data.detail : "That username and PIN don't match",
        };
      }

      this.setToken(data.access_token);
      return { success: true, child: data.child };
    } catch (error) {
      console.error('[AuthService] Child sign-in error:', error);
      return { success: false, error: 'Network error. Please check your connection and try again.' };
    }
  }

  /**
   * Logout user and clear authentication state
   */
  async logout(): Promise<void> {
    console.log('[AuthService] Logging out user');
    this.removeToken();

    // Cached sessions live under global localStorage keys and survive the
    // reload below, so on a shared family device the next person to sign in
    // would otherwise see the last person's work for up to five minutes.
    clearCachedUserData();

    // The server retires the refresh token and clears its cookie; keepalive lets the
    // request finish across the navigation below. Best effort: the cookie alone cannot
    // sign anyone in, and the access token is gone from this browser already.
    try {
      await fetch(`${API_URL}/auth/logout`, { method: 'POST', credentials: 'include', headers: APP_HEADER, keepalive: true });
    } catch {
      /* offline: nothing to retire on this side */
    }

    // Redirect to auth page. The full navigation tears down the in-memory
    // react-query cache, so only localStorage needs clearing by hand.
    window.location.href = '/auth';
  }

  /** End every session of this account, on every device. */
  async logoutEverywhere(): Promise<void> {
    try {
      await fetch(`${API_URL}/auth/logout-all`, { method: 'POST', credentials: 'include', headers: { ...APP_HEADER, ...this.authHeaders() } });
    } catch {
      /* fall through to the local sign-out */
    }
    await this.logout();
  }

  /** Change the password; every other session of the account ends. */
  async changePassword(currentPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
    const res = await fetch(`${API_URL}/auth/password`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...APP_HEADER, ...this.authHeaders() },
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, error: typeof data?.detail === 'string' ? data.detail : 'Could not change the password' };
    if (data?.access_token) this.setToken(data.access_token);
    return { success: true };
  }

  private refreshing: Promise<RefreshResult> | null = null;

  /** Seconds of life left in the stored access token; 0 when there is none. */
  private secondsLeft(): number {
    const payload = this.getCurrentUser();
    if (!payload?.exp) return 0;
    return payload.exp - Math.floor(Date.now() / 1000);
  }

  /**
   * Renew the access token from the refresh cookie. The cookie is rotated on every
   * use, so the call is serialised across tabs (Web Locks); a tab that finds the
   * token already renewed by another one keeps that. 'rejected' means the server
   * refused (the session was ended); 'unavailable' means it could not be reached
   * and the current token is kept.
   */
  async refreshToken(force = false): Promise<RefreshResult> {
    if (this.refreshing) return this.refreshing;
    const before = this.getToken();
    if (!before) return 'rejected';
    const attempt = async (): Promise<RefreshResult> => {
      // Another tab may have renewed while we waited for the lock.
      if (this.getToken() !== before) {
        this.scheduleRefresh();
        return 'refreshed';
      }
      // `force`: the API just refused this token although it has not expired (the
      // account's sessions were ended elsewhere), so only the server can say.
      if (!force && this.secondsLeft() > RENEW_BEFORE_EXPIRY_S) {
        this.scheduleRefresh();
        return 'refreshed';
      }
      try {
        const res = await fetch(`${API_URL}/auth/refresh`, { method: 'POST', credentials: 'include', headers: APP_HEADER });
        if (res.ok) {
          const data = await res.json().catch(() => null);
          if (data?.access_token) {
            this.setToken(data.access_token);
            console.log('[AuthService] Token renewed');
            return 'refreshed';
          }
          return 'unavailable';
        }
        return res.status === 401 || res.status === 403 ? 'rejected' : 'unavailable';
      } catch {
        return 'unavailable';
      }
    };
    const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
    this.refreshing = (locks ? locks.request(REFRESH_LOCK, attempt) : attempt()).finally(() => {
      this.refreshing = null;
    });
    return this.refreshing;
  }

  /** Renew the token when it is about to expire (or has). Cheap to call often. */
  async ensureFreshToken(): Promise<RefreshResult | 'fresh'> {
    if (!this.getToken()) return 'rejected';
    if (this.secondsLeft() > RENEW_BEFORE_EXPIRY_S) return 'fresh';
    return this.refreshToken();
  }

  private authHeaders(): Record<string, string> {
    const token = this.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  /** Who am I, my organization, and where the app should send me next. */
  async fetchSession(): Promise<Session | null> {
    if (!this.getToken()) return null;
    const res = await this.authFetch(`${API_URL}/auth/session`, { headers: this.authHeaders() });
    if (!res.ok) return null;
    return res.json();
  }

  /** authFetch, without a circular import at module load. */
  private async authFetch(input: string, init: RequestInit = {}): Promise<Response> {
    const { authFetch } = await import('./authFetch');
    return authFetch(input, init);
  }

  /** Answer the first-login question (student / teacher / organization). */
  async completeOnboarding(payload: OnboardingPayload): Promise<Session> {
    const res = await this.authFetch(`${API_URL}/auth/onboarding`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this.authHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 409 && data?.detail?.code === 'sign_in_with_org') {
      throw new SignInWithOrgError(data.detail.domain, data.detail.org ?? null);
    }
    if (!res.ok) {
      throw new Error(typeof data?.detail === 'string' ? data.detail : 'Could not save your answer');
    }
    return data as Session;
  }

  /** Change the Teach mode talk key later; null puts it back to the default. */
  async setVoiceKey(voiceKey: string | null): Promise<void> {
    const res = await this.authFetch(`${API_URL}/auth/voice-key`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...this.authHeaders() },
      body: JSON.stringify({ voice_key: voiceKey }),
    });
    if (!res.ok) throw new Error('Could not save that key');
  }

  /** Change how the Teach mode tutors look later; null puts them back to the defaults. */
  async setGuideAvatar(value: string | null): Promise<void> {
    const res = await this.authFetch(`${API_URL}/auth/guide-avatar`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...this.authHeaders() },
      body: JSON.stringify({ guide_avatar: value }),
    });
    if (!res.ok) throw new Error('Could not save that look');
  }

  /** Which organization owns this email domain, and how it signs in. */
  async lookupOrg(email: string): Promise<OrgLookup> {
    const res = await fetch(`${API_URL}/auth/org-lookup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) throw new Error('Could not look up that email domain');
    return res.json();
  }

  /** Which SSO providers this server has credentials for. */
  async getProviders(): Promise<Record<SsoProvider, boolean>> {
    try {
      const res = await fetch(`${API_URL}/auth/providers`);
      if (!res.ok) throw new Error();
      return res.json();
    } catch {
      return { google: false, microsoft: false, saml: false };
    }
  }

  /**
   * Hand the browser to Google / Microsoft. The backend runs the OAuth
   * exchange and returns to /auth/callback#token=… (see AuthCallbackPage).
   */
  startOAuth(provider: 'google' | 'microsoft', opts: { next?: string; hd?: string; loginHint?: string } = {}): void {
    const params = new URLSearchParams({ next: opts.next ?? '/dashboard' });
    if (opts.hd) params.set('hd', opts.hd);
    if (opts.loginHint) params.set('login_hint', opts.loginHint);
    window.location.href = `${API_URL}/auth/${provider}/start?${params.toString()}`;
  }

  /** SAML through the broker. Resolves to '' on redirect, or an error string to render inline. */
  async startSaml(email: string): Promise<string> {
    const res = await fetch(`${API_URL}/auth/saml/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.url) {
      window.location.href = data.url;
      return '';
    }
    return typeof data?.detail === 'string' ? data.detail : 'Company SSO is temporarily unavailable.';
  }

  /**
   * Validate token with backend
   * Useful for checking if token is still valid on the server side
   */
  async validateToken(): Promise<boolean> {
    const token = this.getToken();
    if (!token) {
      return false;
    }

    try {
      // Call a protected endpoint to validate token
      const response = await this.authFetch(`${API_URL}/app-data`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      return response.ok;
    } catch (error) {
      console.error('[AuthService] Token validation error:', error);
      return false;
    }
  }
}

// Export singleton instance
export const authService = new AuthService();

// Export class for testing
export default AuthService;

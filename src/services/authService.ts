/**
 * Centralized Authentication Service
 *
 * This service isolates all authentication logic and provides a clean API for:
 * - User login/registration/logout
 * - Token management (will be moved to httpOnly cookies in Phase 2)
 * - Token validation and refresh
 * - Authentication state management
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
}

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
  logout(): void {
    console.log('[AuthService] Logging out user');
    this.removeToken();

    // Cached sessions live under global localStorage keys and survive the
    // reload below, so on a shared family device the next person to sign in
    // would otherwise see the last person's work for up to five minutes.
    clearCachedUserData();

    // In future: call backend logout endpoint to invalidate token

    // Redirect to auth page. The full navigation tears down the in-memory
    // react-query cache, so only localStorage needs clearing by hand.
    window.location.href = '/auth';
  }

  private refreshing: Promise<RefreshResult> | null = null;

  /**
   * Trade the stored token for a fresh one. The backend accepts a token that has
   * already expired (for a long grace period), so a student is only signed out when
   * the server definitively rejects the token or they sign out themselves.
   * 'unavailable' = couldn't reach the server; the current token is kept.
   */
  async refreshToken(): Promise<RefreshResult> {
    if (this.refreshing) return this.refreshing;
    const token = this.getToken();
    if (!token) return 'rejected';
    this.refreshing = (async (): Promise<RefreshResult> => {
      try {
        const res = await fetch(`${API_URL}/auth/refresh`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
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
      } finally {
        this.refreshing = null;
      }
    })();
    return this.refreshing;
  }

  /** Renew the token when it has expired or has under a week left. Cheap to call often. */
  async ensureFreshToken(): Promise<RefreshResult | 'fresh'> {
    const token = this.getToken();
    if (!token) return 'rejected';
    const payload = this.decodeToken(token);
    const now = Math.floor(Date.now() / 1000);
    if (payload?.exp && payload.exp - now > 7 * 86400) return 'fresh';
    return this.refreshToken();
  }

  private authHeaders(): Record<string, string> {
    const token = this.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  /** Who am I, my organization, and where the app should send me next. */
  async fetchSession(): Promise<Session | null> {
    if (!this.getToken()) return null;
    const res = await fetch(`${API_URL}/auth/session`, { headers: this.authHeaders() });
    if (!res.ok) return null;
    return res.json();
  }

  /** Answer the first-login question (student / teacher / organization). */
  async completeOnboarding(payload: OnboardingPayload): Promise<Session> {
    const res = await fetch(`${API_URL}/auth/onboarding`, {
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
      const response = await fetch(`${API_URL}/app-data`, {
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

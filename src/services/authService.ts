/**
 * Centralized Authentication Service
 *
 * This service isolates all authentication logic and provides a clean API for:
 * - User login/registration/logout
 * - Token management (will be moved to httpOnly cookies in Phase 2)
 * - Token validation and refresh
 * - Authentication state management
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

// Token storage keys
const AUTH_TOKEN_KEY = 'auth_token';
const TOKEN_EXPIRY_KEY = 'token_expiry';

export interface LoginCredentials {
  email: string;
  password: string;
  recaptchaToken?: string;
}

export interface RegisterCredentials {
  email: string;
  name: string;
  password: string;
  recaptchaToken?: string;
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
  email: string;
  exp: number; // expiration timestamp
  iat: number; // issued at timestamp
}

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
   * Check if user is authenticated with a valid token
   */
  isAuthenticated(): boolean {
    const token = this.getToken();
    return !!token && !this.isTokenExpired();
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
   * Logout user and clear authentication state
   */
  logout(): void {
    console.log('[AuthService] Logging out user');
    this.removeToken();

    // Clear any other cached data
    // In future: call backend logout endpoint to invalidate token

    // Redirect to auth page
    window.location.href = '/auth';
  }

  /**
   * Refresh authentication token
   * TODO: Implement when backend supports refresh tokens
   */
  async refreshToken(): Promise<boolean> {
    console.log('[AuthService] Token refresh not yet implemented');
    // TODO: Implement refresh token logic
    // 1. Call /auth/refresh endpoint with refresh token
    // 2. Update access token
    // 3. Return success status
    return false;
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

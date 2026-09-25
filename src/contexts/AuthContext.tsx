/**
 * Authentication Context
 *
 * Provides authentication state and methods throughout the React app.
 * Manages user session, login/logout, and auth status.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authService, AuthResponse, TokenPayload, Session } from '../services/authService';
import { syncVoiceKeyFromServer } from '@/lib/voiceKey';
import { setAvatarSaver, syncAvatarsFromServer } from '@/lib/guide/avatars';

interface AuthContextType {
  user: TokenPayload | null;
  /** Server-side identity: role, organization, onboarding state. null until loaded. */
  session: Session | null;
  sessionLoading: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string, recaptchaToken?: string, turnstileToken?: string) => Promise<AuthResponse>;
  register: (email: string, name: string, password: string, recaptchaToken?: string, turnstileToken?: string) => Promise<AuthResponse>;
  logout: () => void;
  refreshAuth: () => void;
  refreshSession: () => Promise<Session | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<TokenPayload | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState<boolean>(false);

  /**
   * Load /auth/session for the signed-in user (role, org, next_route).
   */
  const refreshSession = useCallback(async (): Promise<Session | null> => {
    if (!authService.isAuthenticated()) {
      setSession(null);
      return null;
    }
    setSessionLoading(true);
    try {
      const next = await authService.fetchSession();
      setSession(next);
      // The talk key belongs to the account: take the server's answer, so a
      // student who set it at home has the same key on a school computer.
      syncVoiceKeyFromServer(next?.user?.voice_key ?? null);
      // The tutors' looks too, and a change made in Teach mode is saved back while signed in.
      syncAvatarsFromServer(next?.user?.guide_avatar ?? null);
      setAvatarSaver(next?.user ? (value) => authService.setGuideAvatar(value) : null);
      return next;
    } catch (error) {
      console.error('[AuthContext] Session load failed:', error);
      setSession(null);
      return null;
    } finally {
      setSessionLoading(false);
    }
  }, []);

  /**
   * Initialize auth state from stored token
   */
  const initializeAuth = useCallback(() => {
    try {
      if (authService.isAuthenticated()) {
        const currentUser = authService.getCurrentUser();
        setUser(currentUser);
        console.log('[AuthContext] User authenticated:', currentUser?.email);
        // Renew a token that has expired (or is about to) instead of signing out;
        // only a token the server rejects ends the session.
        void authService.ensureFreshToken().then((result) => {
          if (result === 'rejected') {
            console.warn('[AuthContext] Stored token rejected by the server, signing out');
            setUser(null);
            setSession(null);
            void authService.logout();
          }
        });
      } else {
        setUser(null);
        console.log('[AuthContext] No valid authentication');
      }
    } catch (error) {
      console.error('[AuthContext] Error initializing auth:', error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Initialize on mount
   */
  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  /**
   * Load the server session whenever the signed-in identity changes
   */
  useEffect(() => {
    if (user) {
      refreshSession();
    } else {
      setSession(null);
    }
  }, [user?.sub, refreshSession]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Keep the sign-in alive. The service renews the token a minute before it expires
   * (authService.scheduleRefresh); this covers a tab whose timers were throttled in
   * the background, by renewing when it comes back into view. Nobody is signed out
   * by an expiry, only by a renewal the server refuses.
   */
  useEffect(() => {
    if (!user) return;
    authService.scheduleRefresh();
    const renew = () => {
      void authService.ensureFreshToken().then((result) => {
        if (result === 'rejected') {
          console.warn('[AuthContext] Token rejected by the server, signing out');
          logout();
        }
      });
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') renew();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Login user
   */
  const login = async (
    email: string,
    password: string,
    recaptchaToken?: string,
    turnstileToken?: string
  ): Promise<AuthResponse> => {
    setIsLoading(true);
    try {
      const result = await authService.login({ email, password, recaptchaToken, turnstileToken });

      if (result.success) {
        const currentUser = authService.getCurrentUser();
        setUser(currentUser);
        console.log('[AuthContext] Login successful:', currentUser?.email);
      }

      return result;
    } catch (error: any) {
      console.error('[AuthContext] Login error:', error);
      return {
        success: false,
        error: error.message || 'Login failed'
      };
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Register new user
   */
  const register = async (
    email: string,
    name: string,
    password: string,
    recaptchaToken?: string,
    turnstileToken?: string
  ): Promise<AuthResponse> => {
    setIsLoading(true);
    try {
      const result = await authService.register({ email, name, password, recaptchaToken, turnstileToken });

      if (result.success) {
        const currentUser = authService.getCurrentUser();
        setUser(currentUser);
        console.log('[AuthContext] Registration successful:', currentUser?.email);
      }

      return result;
    } catch (error: any) {
      console.error('[AuthContext] Registration error:', error);
      return {
        success: false,
        error: error.message || 'Registration failed'
      };
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Logout user
   */
  const logout = useCallback(() => {
    console.log('[AuthContext] Logging out user');
    setUser(null);
    setSession(null);
    void authService.logout();
  }, []);

  /**
   * Refresh auth state (useful after token refresh)
   */
  const refreshAuth = useCallback(() => {
    initializeAuth();
  }, [initializeAuth]);

  const value: AuthContextType = {
    user,
    session,
    sessionLoading,
    isAuthenticated: !!user && authService.isAuthenticated(),
    isLoading,
    login,
    register,
    logout,
    refreshAuth,
    refreshSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

/**
 * useAuth Hook
 *
 * Custom hook to access auth context from any component
 */
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
};

export default AuthContext;

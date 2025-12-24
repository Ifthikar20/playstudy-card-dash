/**
 * Authentication Context
 *
 * Provides authentication state and methods throughout the React app.
 * Manages user session, login/logout, and auth status.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authService, AuthResponse, TokenPayload } from '../services/authService';

interface AuthContextType {
  user: TokenPayload | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string, recaptchaToken?: string) => Promise<AuthResponse>;
  register: (email: string, name: string, password: string, recaptchaToken?: string) => Promise<AuthResponse>;
  logout: () => void;
  refreshAuth: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<TokenPayload | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  /**
   * Initialize auth state from stored token
   */
  const initializeAuth = useCallback(() => {
    try {
      if (authService.isAuthenticated()) {
        const currentUser = authService.getCurrentUser();
        setUser(currentUser);
        console.log('[AuthContext] User authenticated:', currentUser?.email);
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
   * Check token expiry periodically
   */
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      if (authService.isTokenExpired()) {
        console.warn('[AuthContext] Token expired, logging out');
        logout();
      }
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [user]);

  /**
   * Login user
   */
  const login = async (
    email: string,
    password: string,
    recaptchaToken?: string
  ): Promise<AuthResponse> => {
    setIsLoading(true);
    try {
      const result = await authService.login({ email, password, recaptchaToken });

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
    recaptchaToken?: string
  ): Promise<AuthResponse> => {
    setIsLoading(true);
    try {
      const result = await authService.register({ email, name, password, recaptchaToken });

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
    authService.logout();
  }, []);

  /**
   * Refresh auth state (useful after token refresh)
   */
  const refreshAuth = useCallback(() => {
    initializeAuth();
  }, [initializeAuth]);

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user && authService.isAuthenticated(),
    isLoading,
    login,
    register,
    logout,
    refreshAuth
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

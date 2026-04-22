import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { generateRecaptchaToken } from '@/services/recaptchaService';

export default function AuthPage() {
  const navigate = useNavigate();
  const { login: authLogin, register: authRegister } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'initial' | 'signin' | 'register'>('signin');

  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // Generate reCAPTCHA token
      const recaptchaToken = await generateRecaptchaToken('login');

      const result = await authLogin(email, password, recaptchaToken || undefined);
      if (result.success) {
        navigate('/dashboard');
      } else {
        setError(result.error || 'Login failed');
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // Generate reCAPTCHA token
      const recaptchaToken = await generateRecaptchaToken('register');

      const result = await authRegister(email, name, password, recaptchaToken || undefined);
      if (result.success) {
        navigate('/dashboard');
      } else {
        setError(result.error || 'Registration failed');
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };


  const resetToInitial = () => {
    setMode('initial');
    setError('');
    setEmail('');
    setPassword('');
    setName('');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <nav className="border-b border-border">
        <div className="airbnb-container flex items-center justify-between h-20">
          <Link to="/" className="flex items-center gap-2">
            <img
              src="/logo-new.png"
              alt="PlayStudy"
              className="h-12 w-auto"
            />
          </Link>
        </div>
      </nav>

      {/* Auth Content — Airbnb centered modal style */}
      <div className="flex items-center justify-center px-6 py-12 md:py-20">
        <div className="w-full max-w-md">
          {/* Card */}
          <div className="bg-card rounded-2xl border border-border p-8 md:p-10 shadow-airbnb-card">
            {/* Header */}
            <div className="mb-8">
              {mode !== 'initial' && (
                <button
                  onClick={resetToInitial}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors mb-6 flex items-center gap-1"
                >
                  ← Back
                </button>
              )}
              <h1 className="font-heading text-2xl font-bold text-foreground">
                {mode === 'initial' && 'Welcome to PlayStudy'}
                {mode === 'signin' && 'Welcome back'}
                {mode === 'register' && 'Create your account'}
              </h1>
              <p className="text-muted-foreground mt-1 text-sm">
                {mode === 'initial' && 'Sign in to start learning'}
                {mode === 'signin' && 'Enter your credentials to continue'}
                {mode === 'register' && 'Start your learning journey today'}
              </p>
            </div>

            {/* Error Display */}
            {error && (
              <div className="mb-6 bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-xl text-sm">
                {error}
              </div>
            )}

            {/* Initial Mode — Auth Options */}
            {mode === 'initial' && (
              <div className="space-y-3">
                <button
                  className="w-full flex items-center justify-center gap-3 h-12 rounded-xl border-2 border-border text-sm font-medium hover:bg-accent transition-all"
                  onClick={() => console.log('Google sign in')}
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continue with Google
                </button>

                <button
                  className="w-full flex items-center justify-center gap-3 h-12 rounded-xl border-2 border-border text-sm font-medium hover:bg-accent transition-all"
                  onClick={() => console.log('Apple sign in')}
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                  </svg>
                  Continue with Apple
                </button>


                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="px-3 bg-card text-muted-foreground">or continue with email</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    className="h-12 rounded-xl border-2 border-border text-sm font-medium hover:bg-accent transition-all"
                    onClick={() => setMode('signin')}
                  >
                    Sign in
                  </button>
                  <button
                    className="h-12 rounded-xl border-2 border-border text-sm font-medium hover:bg-accent transition-all"
                    onClick={() => setMode('register')}
                  >
                    Register
                  </button>
                </div>
              </div>
            )}

            {/* Sign In Form */}
            {mode === 'signin' && (
              <form onSubmit={handleLogin} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoading}
                    className="h-12 rounded-xl border-2 focus:border-primary transition-colors"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    className="h-12 rounded-xl border-2 focus:border-primary transition-colors"
                  />
                </div>

                <button
                  type="submit"
                  className="airbnb-btn-primary w-full h-12 rounded-xl text-sm"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Signing in...
                    </span>
                  ) : (
                    'Continue'
                  )}
                </button>

                <p className="text-center text-sm text-muted-foreground mt-4">
                  Don't have an account?{' '}
                  <button
                    type="button"
                    onClick={() => { setMode('register'); setError(''); }}
                    className="text-primary hover:underline font-medium"
                  >
                    Register
                  </button>
                </p>

                <p className="text-center text-xs text-muted-foreground mt-4">
                  By signing in, you agree to our{' '}
                  <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    Terms & Conditions
                  </a>
                </p>
              </form>
            )}

            {/* Register Form */}
            {mode === 'register' && (
              <form onSubmit={handleRegister} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-medium">Name</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="John Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    disabled={isLoading}
                    className="h-12 rounded-xl border-2 focus:border-primary transition-colors"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="register-email" className="text-sm font-medium">Email</Label>
                  <Input
                    id="register-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoading}
                    className="h-12 rounded-xl border-2 focus:border-primary transition-colors"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="register-password" className="text-sm font-medium">Password</Label>
                  <Input
                    id="register-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    disabled={isLoading}
                    className="h-12 rounded-xl border-2 focus:border-primary transition-colors"
                  />
                  <p className="text-xs text-muted-foreground">Minimum 8 characters</p>
                </div>

                <button
                  type="submit"
                  className="airbnb-btn-primary w-full h-12 rounded-xl text-sm"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating account...
                    </span>
                  ) : (
                    'Create account'
                  )}
                </button>

                <p className="text-center text-sm text-muted-foreground mt-4">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => { setMode('signin'); setError(''); }}
                    className="text-primary hover:underline font-medium"
                  >
                    Sign in
                  </button>
                </p>

                <p className="text-center text-xs text-muted-foreground mt-4">
                  By creating an account, you agree to our{' '}
                  <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    Terms & Conditions
                  </a>
                </p>
              </form>
            )}
          </div>

          {/* Footer */}
          <div className="mt-6 text-center text-sm text-muted-foreground">
            <p>Create an account to get started</p>
          </div>
        </div>
      </div>
    </div>
  );
}

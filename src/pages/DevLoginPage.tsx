/**
 * Dev-only route: /dev-login#token=<jwt>[&next=/dashboard/...]
 *
 * Lets scripts/dev-login.mjs (repo root) sign the browser in without typing
 * credentials. The token travels in the URL *fragment*, so it never reaches
 * a server log. Only registered when import.meta.env.DEV is true - see App.tsx.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '@/services/authService';
import { useAuth } from '@/contexts/AuthContext';

export default function DevLoginPage() {
  const navigate = useNavigate();
  const { refreshAuth } = useAuth();
  const [status, setStatus] = useState('Signing in…');

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const token = params.get('token');
    const next = params.get('next') || '/dashboard';

    if (!token) {
      setStatus('No token in URL fragment. Run: node scripts/dev-login.mjs --open');
      return;
    }
    if (!authService.adoptToken(token)) {
      setStatus('Token rejected (invalid or expired). Run scripts/dev-login.mjs again.');
      return;
    }
    // Strip the token from the address bar before moving on.
    window.history.replaceState(null, '', '/dev-login');
    refreshAuth();
    navigate(next, { replace: true });
  }, [navigate, refreshAuth]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground text-sm">
      {status}
    </div>
  );
}

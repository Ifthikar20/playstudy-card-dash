import { Navigate } from 'react-router-dom';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const token = localStorage.getItem('auth_token');

  if (!token) {
    // Redirect to auth page if no token
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}

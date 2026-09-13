import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import api from '../lib/axios';
import { useAuth } from '../contexts/AuthContext';
import { CheckCircle, XCircle } from 'lucide-react';

export function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const { user } = useAuth();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [errorMsg, setErrorMsg] = useState('');

  const hasFired = useRef(false);

  useEffect(() => {
    // Guard against double-invocation in React StrictMode and re-fires caused
    // by `user` changing after a successful verify triggers an AuthContext refresh.
    if (!token || hasFired.current) return;
    hasFired.current = true;

    const verify = async () => {
      try {
        await api.post('/auth/verify-email', { token });
        setStatus('success');
      } catch (err: any) {
        setStatus('error');
        setErrorMsg(err.response?.data?.error || 'Failed to verify email. The link may have expired.');
      }
    };

    verify();
  }, [token]);

  // Hard reload when navigating to dashboard so AuthContext re-runs its
  // restore() → POST /auth/refresh flow, fetching the updated user from
  // the database where isEmailVerified is now true.
  // Using navigate() would keep the stale in-memory user and show the banner.
  const handleGoToDashboard = () => {
    window.location.href = '/dashboard';
  };

  return (
    <div className="flex-1 w-full bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Email Verification</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center space-y-4 py-8">
          {status === 'verifying' && (
            <>
              <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-gray-600 dark:text-gray-400">Verifying your email address...</p>
            </>
          )}

          {status === 'success' && (
            <>
              <CheckCircle className="w-16 h-16 text-green-500" />
              <p className="text-center text-gray-600 dark:text-gray-400">
                Your email has been verified successfully!
              </p>
              {user ? (
                <Button onClick={handleGoToDashboard} className="mt-4">
                  Go to Dashboard
                </Button>
              ) : (
                <Button onClick={() => navigate('/login')} className="mt-4">
                  Go to Login
                </Button>
              )}
            </>
          )}

          {status === 'error' && (
            <>
              <XCircle className="w-16 h-16 text-red-500" />
              <p className="text-center text-red-600 dark:text-red-400">
                {errorMsg}
              </p>
              <Button onClick={() => navigate('/login')} variant="outline" className="mt-4">
                Back to Login
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

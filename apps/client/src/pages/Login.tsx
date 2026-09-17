import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema } from '@deltaora/validation';
import { z } from 'zod';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { useAuth } from '../contexts/AuthContext';
import { GoogleLogin } from '@react-oauth/google';
import { Fingerprint } from 'lucide-react';
import toast from 'react-hot-toast';

const mfaLoginSchema = loginSchema.extend({
  mfaCode: z.string().optional(),
  recoveryCode: z.string().optional()
});

type LoginForm = z.infer<typeof mfaLoginSchema>;

const MFA_VERIFICATION_ERROR = "We couldn't verify the code. Check it and try again.";

export function Login() {
  const navigate = useNavigate();
  const { login, passkeyLogin, googleLogin } = useAuth();
  const [requiresMfa, setRequiresMfa] = useState(false);
  
  const { register, handleSubmit, getValues, setError, clearErrors, formState: { errors, isSubmitting } } = useForm<LoginForm>({
    resolver: zodResolver(mfaLoginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    clearErrors(['mfaCode', 'recoveryCode']);

    try {
      await login(data.email, data.password, data.mfaCode, data.recoveryCode);
      toast.success('Logged in successfully');
      navigate('/dashboard');
    } catch (error: any) {
      const errRes = error.response?.data;
      const status = error.response?.status;

      if (errRes?.error === 'MFA_REQUIRED') {
        setRequiresMfa(true);
        toast('Multi-factor authentication required', { icon: '🔐' });
      } else if (errRes?.error === 'INVALID_MFA') {
        const field = data.recoveryCode?.trim() ? 'recoveryCode' : 'mfaCode';
        setError(field, { type: 'server', message: MFA_VERIFICATION_ERROR }, { shouldFocus: true });
        toast.error(MFA_VERIFICATION_ERROR);
      } else if (status === 429) {
        // Account lockout (has retryAfterSeconds) vs IP rate limit (does not)
        if (errRes?.retryAfterSeconds) {
          const minutes = Math.ceil(errRes.retryAfterSeconds / 60);
          toast.error(
            `Account locked. Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'} or reset your password.`,
            { duration: 8000 }
          );
        } else {
          toast.error('Too many login attempts. Please wait 15 minutes and try again.', { duration: 8000 });
        }
      } else {
        toast.error(errRes?.error || 'Invalid email or password');
      }
    }
  };

  const handlePasskeyLogin = async () => {
    const email = getValues('email');
    if (!email) {
      toast.error('Enter your email first');
      return;
    }

    try {
      await passkeyLogin(email);
      toast.success('Logged in with passkey');
      navigate('/dashboard');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Passkey sign-in failed');
    }
  };

  const handleGoogleSuccess = async (credentialResponse: any) => {
    try {
      if (credentialResponse.credential) {
        await googleLogin(credentialResponse.credential);
        toast.success('Logged in with Google successfully');
        navigate('/dashboard');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Google login failed');
    }
  };

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle>{requiresMfa ? 'Two-Factor Authentication' : 'Welcome back'}</CardTitle>
        <CardDescription>
          {requiresMfa 
            ? 'Enter the 6-digit code from your authenticator app' 
            : 'Enter your credentials to access your account'}
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-5">
          {!requiresMfa && (
            <>
              <div className="flex justify-center w-full">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => toast.error('Google login failed')}
                  useOneTap
                  theme="filled_blue"
                  shape="rectangular"
                  width="100%"
                />
              </div>
              <Button type="button" variant="outline" className="w-full gap-2" onClick={handlePasskeyLogin}>
                <Fingerprint className="h-4 w-4" />
                Sign in with passkey
              </Button>
              
              <div className="relative my-1">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-gray-200 dark:border-gray-800" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white dark:bg-gray-900 px-3 text-gray-400 dark:text-gray-500 font-medium tracking-wider">
                    or
                  </span>
                </div>
              </div>
            </>
          )}

          <div className={requiresMfa ? 'hidden' : 'space-y-4'}>
            <Input
              label="Email"
              type="email"
              placeholder="you@example.com"
              {...register('email')}
              error={errors.email?.message}
            />
            
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Password
                </label>
                <Link to="/forgot-password" className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:hover:text-blue-400 transition-colors">
                  Forgot password?
                </Link>
              </div>
              <Input
                type="password"
                placeholder="••••••••"
                {...register('password')}
                error={errors.password?.message}
              />
            </div>
          </div>
          
          {requiresMfa && (
            <Input
              label="Authentication Code"
              type="text"
              placeholder="000000"
              maxLength={6}
              {...register('mfaCode')}
              error={errors.mfaCode?.message}
              autoFocus
            />
          )}
          {requiresMfa && (
            <Input
              label="Recovery Code"
              type="text"
              placeholder="Optional"
              {...register('recoveryCode')}
              error={errors.recoveryCode?.message}
            />
          )}
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="w-full" isLoading={isSubmitting}>
            {requiresMfa ? 'Verify Code' : 'Sign In'}
          </Button>
          {!requiresMfa && (
            <p className="text-sm text-center text-gray-500 dark:text-gray-400">
              Don't have an account?{' '}
              <Link to="/register" className="font-medium text-blue-600 hover:text-blue-700 dark:hover:text-blue-400 transition-colors">
                Create one
              </Link>
            </p>
          )}
          {requiresMfa && (
            <button 
              type="button" 
              onClick={() => setRequiresMfa(false)}
              className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            >
              ← Back to login
            </button>
          )}
        </CardFooter>
      </form>
    </Card>
  );
}

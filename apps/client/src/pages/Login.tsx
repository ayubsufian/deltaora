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
import toast from 'react-hot-toast';

const mfaLoginSchema = loginSchema.extend({
  mfaCode: z.string().optional()
});

type LoginForm = z.infer<typeof mfaLoginSchema>;

export function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [requiresMfa, setRequiresMfa] = useState(false);
  
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginForm>({
    resolver: zodResolver(mfaLoginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    try {
      await login(data.email, data.password, data.mfaCode);
      toast.success('Logged in successfully');
      navigate('/dashboard');
    } catch (error: any) {
      const errRes = error.response?.data;
      if (errRes?.error === 'MFA_REQUIRED') {
        setRequiresMfa(true);
        toast('Multi-factor authentication required', { icon: '🔐' });
      } else {
        toast.error(errRes?.message || errRes?.error || 'Invalid email or password');
      }
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="text-center">
        <CardTitle>{requiresMfa ? 'Two-Factor Authentication' : 'Welcome back'}</CardTitle>
        <CardDescription>
          {requiresMfa 
            ? 'Enter the 6-digit code from your authenticator app' 
            : 'Enter your credentials to access your account'}
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          <div className={requiresMfa ? 'hidden' : 'space-y-4'}>
            <Input
              label="Email"
              type="email"
              placeholder="you@example.com"
              {...register('email')}
              error={errors.email?.message}
            />
            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              {...register('password')}
              error={errors.password?.message}
            />
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
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="w-full" isLoading={isSubmitting}>
            {requiresMfa ? 'Verify Code' : 'Sign In'}
          </Button>
          {!requiresMfa && (
            <p className="text-sm text-center text-gray-500 dark:text-gray-400">
              Don't have an account?{' '}
              <Link to="/register" className="text-blue-600 hover:underline">
                Create one
              </Link>
            </p>
          )}
          {requiresMfa && (
            <button 
              type="button" 
              onClick={() => setRequiresMfa(false)}
              className="text-sm text-gray-500 hover:underline"
            >
              Back to login
            </button>
          )}
        </CardFooter>
      </form>
    </Card>
  );
}

import { useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { resetPasswordSchema } from '@deltaora/validation';
import { z } from 'zod';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import api from '../lib/axios';
import { PasswordGuidance } from '../components/auth/PasswordGuidance';

type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;

export function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordForm>({
    resolver: zodResolver(resetPasswordSchema),
    mode: 'onChange',
  });
  const password = useWatch({ control, name: 'password', defaultValue: '' });

  useEffect(() => {
    if (!token) {
      setError('root', { message: 'Invalid or missing password reset token.' });
    }
  }, [setError, token]);

  const onSubmit = async (data: ResetPasswordForm) => {
    try {
      await api.post('/auth/reset-password', { token, newPassword: data.password });
      navigate('/login', { state: { message: 'Password has been successfully reset. You may now log in.' } });
    } catch (err: any) {
      const details: string[] = err.response?.data?.details ?? [];
      setError('root', {
        message: details[0] || err.response?.data?.error || 'Failed to reset password. The link may have expired.',
      });
    }
  };

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle>Set New Password</CardTitle>
        <CardDescription>
          Choose a strong password with at least 15 characters.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {errors.root?.message && (
            <div className="p-3.5 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 rounded-lg text-sm border border-red-200 dark:border-red-900">
              {errors.root.message}
            </div>
          )}
          <div className="space-y-3">
            <Input
              label="New Password"
              type="password"
              placeholder="••••••••"
              autoComplete="new-password"
              {...register('password')}
              error={errors.password?.message}
              required
            />

            <PasswordGuidance password={password} includeAccountContext />
          </div>
          <Input
            label="Confirm New Password"
            type="password"
            placeholder="••••••••"
            autoComplete="new-password"
            {...register('confirmPassword')}
            error={errors.confirmPassword?.message}
            required
          />
          <Button type="submit" className="w-full" isLoading={isSubmitting} disabled={!token}>
            Reset Password
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex justify-center border-t border-gray-100 dark:border-gray-800 pt-5">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Remembered your password?{' '}
          <Link to="/login" className="font-medium text-blue-600 hover:text-blue-700 dark:hover:text-blue-400 transition-colors">
            Back to login
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}

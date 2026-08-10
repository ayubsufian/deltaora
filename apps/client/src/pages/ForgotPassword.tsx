import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import api from '../lib/axios';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      await api.post('/auth/forgot-password', { email });
      setIsSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to request password reset. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-160px)]">
      <Card className="w-full max-w-md animate-in zoom-in-95 duration-300">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold tracking-tight text-center">Reset Password</CardTitle>
          <CardDescription className="text-center">
            Enter your email address and we will send you a link to reset your password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isSuccess ? (
            <div className="p-4 bg-green-50 text-green-700 rounded-md text-sm text-center border border-green-100">
              If an account exists with that email, a password reset link has been sent. Please check your inbox (or terminal console for local dev).
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-50 text-red-600 rounded-md text-sm border border-red-100">
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <Input
                  label="Email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" isLoading={isSubmitting}>
                Send Reset Link
              </Button>
            </form>
          )}
        </CardContent>
        <CardFooter className="flex justify-center border-t p-4 mt-2">
          <div className="text-sm text-gray-500">
            Remember your password?{' '}
            <Link to="/login" className="text-blue-600 hover:underline font-medium">
              Back to login
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}

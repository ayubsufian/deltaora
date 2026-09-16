import { Link, useNavigate } from 'react-router-dom';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema } from '@deltaora/validation';
import { z } from 'zod';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { useAuth } from '../contexts/AuthContext';
import { GoogleLogin } from '@react-oauth/google';
import toast from 'react-hot-toast';
import { PasswordGuidance } from '../components/auth/PasswordGuidance';

type RegisterForm = z.infer<typeof registerSchema>;

// ── Register Page ──────────────────────────────────────────────────────────────
export function Register() {
  const navigate = useNavigate();
  const { register: registerUser, googleLogin } = useAuth();
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    mode: 'onChange',  // validate on every keystroke for live feedback
  });

  // Watch fields for live strength meter and rule checks
  const password = useWatch({ control, name: 'password', defaultValue: '' });
  const email    = useWatch({ control, name: 'email',    defaultValue: '' });
  const name     = useWatch({ control, name: 'name',     defaultValue: '' });

  const REGISTRATION_MESSAGE = "If this email isn't already registered, you'll receive a confirmation email shortly.";

  const onSubmit = async (data: RegisterForm) => {
    try {
      const result = await registerUser(data.name, data.email, data.password, data.confirmPassword);

      if (result?.message) {
        // 202: duplicate email — show same generic message, never reveal email exists
        toast.success(REGISTRATION_MESSAGE);
        navigate('/login');
        return;
      }

      // 201: new account created and session established
      toast.success('Account created! Welcome to DeltaOra.');
      navigate('/dashboard');
    } catch (error: any) {
      // If server sent a generic message on 202 but axios treated it oddly, still show generic
      if (error.response?.status === 202) {
        toast.success(REGISTRATION_MESSAGE);
        navigate('/login');
        return;
      }

      // Show the most specific message available:
      // details[0] gives the exact reason (e.g. "password appeared in known data breaches")
      // falling back to the top-level error, then a generic fallback
      const details: string[] = error.response?.data?.details ?? [];
      const message = details[0] || error.response?.data?.error || 'Failed to create account. Please try again.';
      toast.error(message);
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
        <CardTitle>Create an account</CardTitle>
        <CardDescription>Start monitoring websites for changes today</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-5">
          {/* Social login */}
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

          {/* Divider */}
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

          {/* Name */}
          <Input
            label="Name"
            placeholder="John Doe"
            autoComplete="name"
            {...register('name')}
            error={errors.name?.message}
          />

          {/* Email */}
          <Input
            label="Email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            {...register('email')}
            error={errors.email?.message}
          />

          {/* Password + live strength meter + rule checklist */}
          <div className="space-y-3">
            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              autoComplete="new-password"
              {...register('password')}
              error={errors.password?.message}
            />

            <PasswordGuidance password={password} email={email} name={name} />
          </div>

          {/* Confirm Password */}
          <Input
            label="Confirm Password"
            type="password"
            placeholder="••••••••"
            autoComplete="new-password"
            {...register('confirmPassword')}
            error={errors.confirmPassword?.message}
          />
        </CardContent>

        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="w-full" isLoading={isSubmitting}>
            Create Account
          </Button>
          <p className="text-sm text-center text-gray-500 dark:text-gray-400">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-blue-600 hover:text-blue-700 dark:hover:text-blue-400 transition-colors">
              Sign in
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}

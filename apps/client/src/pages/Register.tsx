import { Link, useNavigate } from 'react-router-dom';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema, getPasswordStrength, checkPasswordRules } from '@deltaora/validation';
import { z } from 'zod';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { useAuth } from '../contexts/AuthContext';
import { GoogleLogin } from '@react-oauth/google';
import { CheckCircle2, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

type RegisterForm = z.infer<typeof registerSchema>;

// ── Password Rule Row ──────────────────────────────────────────────────────────
function RuleRow({ passed, label }: { passed: boolean; label: string }) {
  return (
    <li className={`flex items-center gap-2 text-xs transition-colors duration-200 ${passed ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'}`}>
      {passed
        ? <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
        : <XCircle className="h-3.5 w-3.5 flex-shrink-0" />}
      {label}
    </li>
  );
}

// ── Strength Meter Bar ─────────────────────────────────────────────────────────
function StrengthMeter({ password, email, name }: { password: string; email: string; name: string }) {
  const strength = getPasswordStrength(password, { email, name });
  if (!password) return null;

  const segments = [1, 2, 3, 4] as const;

  return (
    <div className="space-y-2">
      <div className="flex gap-1.5">
        {segments.map((seg) => (
          <div
            key={seg}
            className={`h-1 flex-1 rounded-full transition-all duration-300 ${
              seg <= strength.score ? strength.color : 'bg-gray-200 dark:bg-gray-700'
            }`}
          />
        ))}
      </div>
      {strength.label && (
        <p className={`text-xs font-medium ${
          strength.score <= 1 ? 'text-red-500' :
          strength.score === 2 ? 'text-orange-500' :
          strength.score === 3 ? 'text-yellow-600 dark:text-yellow-400' :
          'text-green-600 dark:text-green-400'
        }`}>
          {strength.label}
        </p>
      )}
    </div>
  );
}

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

  // Local policy checks for the checklist UI — typed, no string matching
  const rules = checkPasswordRules(password, { email, name });

  const onSubmit = async (data: RegisterForm) => {
    try {
      const result = await registerUser(data.name, data.email, data.password, data.confirmPassword);
      if (result?.message) {
        toast.success(result.message);
        navigate('/login');
        return;
      }
      toast.success('Account created! Please check your email to verify.');
      navigate('/dashboard');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to create account');
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
            {...register('name')}
            error={errors.name?.message}
          />

          {/* Email */}
          <Input
            label="Email"
            type="email"
            placeholder="you@example.com"
            {...register('email')}
            error={errors.email?.message}
          />

          {/* Password + live strength meter + rule checklist */}
          <div className="space-y-3">
            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              {...register('password')}
              error={errors.password?.message}
            />

            {/* Strength meter — only shows once the user starts typing */}
            {password.length > 0 && (
              <StrengthMeter password={password} email={email} name={name} />
            )}

            {/* Live rule checklist */}
            {password.length > 0 && (
              <ul className="space-y-1.5 pl-0.5">
                <RuleRow passed={rules.hasMinLength}     label="At least 15 characters" />
                <RuleRow passed={rules.notCommon}        label="Not a commonly used password" />
                <RuleRow passed={rules.notContainsEmail} label="Doesn't contain your email address" />
                <RuleRow passed={rules.notContainsName}  label="Doesn't contain your name" />
              </ul>
            )}
          </div>

          {/* Confirm Password */}
          <Input
            label="Confirm Password"
            type="password"
            placeholder="••••••••"
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

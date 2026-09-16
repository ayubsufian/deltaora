import { CheckCircle2, Shield, XCircle } from 'lucide-react';
import { checkPasswordRules, getPasswordStrength } from '@deltaora/validation';

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

const STRENGTH_CONFIG = {
  0: { bar: '',                label: ''                                   },
  1: { bar: 'bg-red-500',      label: 'text-red-500'                       },
  2: { bar: 'bg-orange-400',   label: 'text-orange-500'                    },
  3: { bar: 'bg-yellow-400',   label: 'text-yellow-600 dark:text-yellow-400' },
  4: { bar: 'bg-green-500',    label: 'text-green-600 dark:text-green-400' },
} as const;

function StrengthMeter({ password, email, name }: { password: string; email?: string; name?: string }) {
  const strength = getPasswordStrength(password, { email, name });
  if (!password || strength.score === 0) return null;

  const config = STRENGTH_CONFIG[strength.score];
  const segments = [1, 2, 3, 4] as const;

  return (
    <div className="space-y-2">
      <div className="flex gap-1.5">
        {segments.map((seg) => (
          <div
            key={seg}
            className={`h-1 flex-1 rounded-full transition-all duration-300 ${
              seg <= strength.score ? config.bar : 'bg-gray-200 dark:bg-gray-700'
            }`}
          />
        ))}
      </div>
      {strength.label && (
        <p className={`text-xs font-medium ${config.label}`}>
          {strength.label}
        </p>
      )}
    </div>
  );
}

interface PasswordGuidanceProps {
  password: string;
  email?: string;
  name?: string;
  includeAccountContext?: boolean;
}

export function PasswordGuidance({ password, email, name, includeAccountContext = false }: PasswordGuidanceProps) {
  if (!password) return null;

  const rules = checkPasswordRules(password, { email, name });
  const hasAccountContext = Boolean(email || name);

  return (
    <div className="space-y-3">
      <StrengthMeter password={password} email={email} name={name} />
      <ul className="space-y-1.5 pl-0.5">
        <RuleRow passed={rules.hasMinLength} label="At least 15 characters" />
        <RuleRow passed={rules.notCommon} label="Not a commonly used password" />
        {hasAccountContext ? (
          <>
            <RuleRow passed={rules.notContainsEmail} label="Doesn't contain your email address" />
            <RuleRow passed={rules.notContainsName} label="Doesn't contain your name" />
          </>
        ) : includeAccountContext ? (
          <li className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
            <Shield className="h-3.5 w-3.5 flex-shrink-0" />
            Checked against your account email and name on submit
          </li>
        ) : null}
        <li className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
          <Shield className="h-3.5 w-3.5 flex-shrink-0" />
          Verified against known data breaches on submit
        </li>
      </ul>
    </div>
  );
}

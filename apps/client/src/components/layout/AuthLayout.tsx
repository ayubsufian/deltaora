import { Outlet, useLocation } from 'react-router-dom';
import { ThemeToggle } from '../ui/ThemeToggle';
import { Shield, FileSearch, BarChart3, Users, Sparkles, Lock } from 'lucide-react';

const HERO_CONTENT: Record<string, { headline: string; subtitle: string }> = {
  '/login': {
    headline: 'Monitor changes.\nStay ahead.',
    subtitle: 'AI-powered website change detection trusted by compliance teams, analysts, and product watchers worldwide.',
  },
  '/register': {
    headline: 'Start monitoring\nin minutes.',
    subtitle: 'Join teams that rely on DeltaOra to track policy changes, price updates, and competitive shifts — automatically.',
  },
  '/forgot-password': {
    headline: 'Secure by design.',
    subtitle: 'Your account is protected with enterprise-grade encryption, breach screening, and multi-factor authentication.',
  },
  '/reset-password': {
    headline: 'Secure by design.',
    subtitle: 'Your account is protected with enterprise-grade encryption, breach screening, and multi-factor authentication.',
  },
};

const FEATURES = [
  { icon: Sparkles, text: 'AI-generated change summaries' },
  { icon: FileSearch, text: 'PDF, DOCX, spreadsheet & API monitoring' },
  { icon: Shield, text: 'SOC2-ready audit trails & RBAC' },
  { icon: BarChart3, text: 'Real-time analytics & dashboards' },
  { icon: Users, text: 'Team workspaces with role governance' },
  { icon: Lock, text: 'Passkeys, 2FA & enterprise security' },
];

const TESTIMONIAL = {
  quote: 'DeltaOra transformed how our compliance team tracks regulatory updates. We catch policy changes in minutes instead of weeks.',
  author: 'Compliance Team Lead',
  company: 'Enterprise Customer',
};

export function AuthLayout() {
  const location = useLocation();
  const hero = HERO_CONTENT[location.pathname] || HERO_CONTENT['/login'];

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* ── Left Panel: Brand & Value Proposition ── */}
      <div className="hidden lg:flex lg:w-[55%] xl:w-[60%] relative overflow-hidden bg-gradient-to-br from-gray-950 via-blue-950 to-indigo-950 text-white">
        {/* Background decorative elements */}
        <div className="absolute inset-0">
          <div className="absolute top-[10%] left-[5%] w-72 h-72 rounded-full bg-blue-500/10 blur-[100px]" />
          <div className="absolute bottom-[15%] right-[10%] w-96 h-96 rounded-full bg-indigo-500/8 blur-[120px]" />
          <div className="absolute top-[60%] left-[40%] w-64 h-64 rounded-full bg-purple-500/8 blur-[100px]" />
          {/* Subtle grid pattern */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
              backgroundSize: '60px 60px',
            }}
          />
        </div>

        <div className="relative z-10 flex flex-col justify-between w-full px-12 xl:px-16 py-10">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-blue-500 flex items-center justify-center shadow-lg shadow-blue-500/30">
              <span className="text-white text-xl font-bold leading-none mt-0.5">Δ</span>
            </div>
            <span className="text-xl font-bold tracking-tight text-white">DeltaOra</span>
          </div>

          {/* Hero Content */}
          <div className="flex-1 flex flex-col justify-center max-w-lg -mt-8">
            <h1 className="text-4xl xl:text-5xl font-bold tracking-tight leading-tight whitespace-pre-line">
              {hero.headline}
            </h1>
            <p className="mt-5 text-base xl:text-lg text-blue-100/70 leading-relaxed">
              {hero.subtitle}
            </p>

            {/* Feature pills */}
            <div className="mt-10 grid grid-cols-2 gap-3">
              {FEATURES.map((feature) => (
                <div
                  key={feature.text}
                  className="flex items-center gap-2.5 text-sm text-blue-100/60"
                >
                  <feature.icon className="h-4 w-4 text-blue-400/80 flex-shrink-0" />
                  <span>{feature.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Testimonial */}
          <div className="border-t border-white/10 pt-6">
            <blockquote className="text-sm text-blue-100/50 italic leading-relaxed">
              "{TESTIMONIAL.quote}"
            </blockquote>
            <div className="mt-3 flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-xs font-bold text-white">
                {TESTIMONIAL.author.charAt(0)}
              </div>
              <div>
                <p className="text-sm font-medium text-blue-100/70">{TESTIMONIAL.author}</p>
                <p className="text-xs text-blue-100/40">{TESTIMONIAL.company}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right Panel: Auth Form ── */}
      <div className="flex-1 flex flex-col min-h-screen lg:min-h-0 bg-white dark:bg-gray-950">
        {/* Top bar: mobile logo + theme toggle */}
        <div className="flex items-center justify-between px-6 py-4 lg:justify-end">
          {/* Mobile-only logo */}
          <div className="flex items-center gap-2 lg:hidden">
            <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <span className="text-white text-lg font-bold leading-none mt-0.5">Δ</span>
            </div>
            <span className="text-lg font-bold tracking-tight text-gray-900 dark:text-white">DeltaOra</span>
          </div>
          <ThemeToggle className="bg-gray-100/80 dark:bg-gray-800/80" />
        </div>

        {/* Centered form area */}
        <div className="flex-1 flex items-center justify-center px-6 pb-8 lg:px-12">
          <div className="w-full max-w-[420px] animate-in fade-in slide-in-from-right-4 duration-500">
            <Outlet />
          </div>
        </div>

        {/* Bottom trust bar */}
        <div className="px-6 pb-6 lg:px-12">
          <div className="flex items-center justify-center gap-6 text-xs text-gray-400 dark:text-gray-600">
            <span className="flex items-center gap-1.5">
              <Lock className="h-3 w-3" />
              256-bit encryption
            </span>
            <span className="hidden sm:inline text-gray-300 dark:text-gray-700">·</span>
            <span className="hidden sm:flex items-center gap-1.5">
              <Shield className="h-3 w-3" />
              SOC2-ready
            </span>
            <span className="hidden sm:inline text-gray-300 dark:text-gray-700">·</span>
            <span className="hidden sm:flex items-center gap-1.5">
              GDPR compliant
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  Bell,
  Bot,
  CheckCircle2,
  FileSearch,
  ShieldCheck,
} from 'lucide-react';

const features = [
  {
    icon: FileSearch,
    title: 'Website change monitoring',
    copy: 'Track public pages, policy updates, product copy, pricing pages, and other URLs your team depends on.',
  },
  {
    icon: Bot,
    title: 'AI change summaries',
    copy: 'Summarize detected changes so reviewers can understand what matters before opening the raw diff.',
  },
  {
    icon: Bell,
    title: 'Actionable notifications',
    copy: 'Route alerts by workspace, importance, quiet hours, and notification preferences.',
  },
  {
    icon: ShieldCheck,
    title: 'Production-grade access controls',
    copy: 'Use team workspaces, role governance, audit logs, passkeys, MFA, secure cookies, and Google sign-in.',
  },
];

const checks = [
  'Google sign-in uses basic identity only',
  'Privacy Policy and Terms are public',
  'No advertising cookies or data broker sales',
  'User sessions use HttpOnly secure cookies',
];

export function Home() {
  return (
    <div className="min-h-screen bg-white text-gray-950 dark:bg-gray-950 dark:text-white">
      <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/90 backdrop-blur dark:border-gray-800 dark:bg-gray-950/90">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2 text-xl font-bold tracking-tight text-blue-600 dark:text-blue-400">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-lg leading-none text-white">D</span>
            Deltaora
          </Link>
          <nav className="flex items-center gap-4 text-sm font-medium text-gray-600 dark:text-gray-300">
            <Link to="/privacy" className="hidden hover:text-gray-950 dark:hover:text-white sm:inline">
              Privacy
            </Link>
            <Link to="/terms" className="hidden hover:text-gray-950 dark:hover:text-white sm:inline">
              Terms
            </Link>
            <Link to="/login" className="hover:text-gray-950 dark:hover:text-white">
              Sign in
            </Link>
            <Link
              to="/register"
              className="inline-flex h-10 items-center rounded-lg bg-blue-600 px-4 text-white shadow-sm shadow-blue-600/20 transition-colors hover:bg-blue-700"
            >
              Start monitoring
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
          <div className="mx-auto grid min-h-[calc(100vh-73px)] max-w-7xl items-center gap-10 px-5 py-12 sm:px-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(460px,1.1fr)] lg:px-8">
            <div className="max-w-2xl">
              <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-blue-700 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-300">
                <Activity className="h-3.5 w-3.5" />
                Website change intelligence
              </p>
              <h1 className="text-4xl font-bold tracking-tight text-gray-950 dark:text-white sm:text-5xl lg:text-6xl">
                Deltaora
              </h1>
              <p className="mt-5 text-lg leading-8 text-gray-600 dark:text-gray-300">
                Monitor websites for meaningful changes, compare snapshots, summarize updates with AI, and keep teams aligned with alerts, analytics, and auditable workspaces.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  to="/register"
                  className="inline-flex h-11 items-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 transition-colors hover:bg-blue-700"
                >
                  Create account
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/privacy"
                  className="inline-flex h-11 items-center rounded-lg border border-gray-300 px-5 text-sm font-semibold text-gray-800 transition-colors hover:bg-white dark:border-gray-700 dark:text-gray-100 dark:hover:bg-gray-900"
                >
                  Privacy Policy
                </Link>
              </div>
              <div className="mt-8 grid gap-2 text-sm text-gray-600 dark:text-gray-300 sm:grid-cols-2">
                {checks.map((check) => (
                  <div key={check} className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <span>{check}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-2xl shadow-gray-200/60 dark:border-gray-800 dark:bg-gray-950 dark:shadow-black/30">
                <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-800">
                  <div>
                    <p className="text-sm font-semibold text-gray-950 dark:text-white">Monitored pages</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Workspace activity this week</p>
                  </div>
                  <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                    Live
                  </div>
                </div>
                <div className="grid gap-0 lg:grid-cols-[210px_minmax(0,1fr)]">
                  <aside className="border-b border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900 lg:border-b-0 lg:border-r">
                    <div className="space-y-2">
                      {['Dashboard', 'Pages', 'Notifications', 'Search', 'Statistics'].map((item, index) => (
                        <div
                          key={item}
                          className={`rounded-md px-3 py-2 text-sm ${
                            index === 1
                              ? 'bg-blue-50 font-semibold text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'
                              : 'text-gray-500 dark:text-gray-400'
                          }`}
                        >
                          {item}
                        </div>
                      ))}
                    </div>
                  </aside>
                  <div className="p-5">
                    <div className="mb-5 grid gap-3 sm:grid-cols-3">
                      {[
                        ['128', 'Checks run'],
                        ['17', 'Changes found'],
                        ['6m', 'Median detection'],
                      ].map(([value, label]) => (
                        <div key={label} className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
                          <p className="text-2xl font-bold">{value}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-3">
                      {[
                        ['Privacy policy changed', 'High importance', '12 min ago'],
                        ['Pricing table updated', 'Medium importance', '38 min ago'],
                        ['Release notes added', 'Low importance', '2 hr ago'],
                      ].map(([title, level, time]) => (
                        <div key={title} className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-gray-950 dark:text-white">{title}</p>
                              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{level}</p>
                            </div>
                            <span className="shrink-0 text-xs text-gray-400">{time}</span>
                          </div>
                          <div className="mt-3 h-2 rounded-full bg-gray-100 dark:bg-gray-800">
                            <div className="h-2 w-2/3 rounded-full bg-blue-600" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-14 sm:px-6 lg:px-8">
          <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-gray-950 dark:text-white">Built for teams that watch the web</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-300">
                Deltaora combines monitoring, summaries, alerts, and governance in one workspace.
              </p>
            </div>
            <Link to="/login" className="text-sm font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400">
              Existing user sign in
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <article key={feature.title} className="rounded-lg border border-gray-200 p-5 dark:border-gray-800">
                <feature.icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <h3 className="mt-4 font-semibold text-gray-950 dark:text-white">{feature.title}</h3>
                <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-400">{feature.copy}</p>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-gray-200 bg-gray-50 px-5 py-6 text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span>Copyright {new Date().getFullYear()} Deltaora. All rights reserved.</span>
          <div className="flex gap-5">
            <Link to="/privacy" className="hover:text-gray-950 dark:hover:text-white">
              Privacy Policy
            </Link>
            <Link to="/terms" className="hover:text-gray-950 dark:hover:text-white">
              Terms of Service
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

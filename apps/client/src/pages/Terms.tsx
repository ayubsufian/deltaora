import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="mb-10">
    <h2 className="mb-4 border-b border-gray-200 pb-2 text-xl font-semibold text-gray-900 dark:border-gray-800 dark:text-white">
      {title}
    </h2>
    <div className="space-y-3 text-sm leading-relaxed text-gray-600 dark:text-gray-400">{children}</div>
  </section>
);

export function Terms() {
  const lastUpdated = 'September 15, 2026';
  const contactEmail = 'support@deltaora.com';

  return (
    <div className="min-h-screen flex-1 bg-gray-50 dark:bg-gray-900">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link to="/" className="text-lg font-bold tracking-tight text-blue-600 dark:text-blue-400">
            Deltaora
          </Link>
          <div className="flex items-center gap-4 text-sm font-medium text-gray-600 dark:text-gray-400">
            <Link to="/privacy" className="hover:text-gray-900 dark:hover:text-white">
              Privacy
            </Link>
            <Link to="/login" className="hover:text-gray-900 dark:hover:text-white">
              Sign in
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-12">
        <div className="mb-10">
          <h1 className="mb-2 text-3xl font-bold text-gray-900 dark:text-white">Terms of Service</h1>
          <p className="text-sm text-gray-500">Last updated: {lastUpdated}</p>
        </div>

        <Section title="1. The Service">
          <p>
            Deltaora provides website change monitoring, snapshots, diffs, AI-generated summaries, alerts, search,
            statistics, and team workspaces. These Terms govern access to and use of the Deltaora web application,
            API, and related services.
          </p>
        </Section>

        <Section title="2. Accounts and Access">
          <p>
            You are responsible for keeping your account secure and for all activity under your account. You may sign
            in with email and password, passkeys, multi-factor authentication, or Google sign-in where enabled.
          </p>
          <p>
            You must provide accurate account information and promptly update it when it changes. Deltaora may suspend
            or restrict accounts that violate these Terms, create security risk, or misuse the service.
          </p>
        </Section>

        <Section title="3. Monitoring Responsibilities">
          <p>
            You must only monitor pages and URLs where you have permission, a legitimate interest, or another lawful
            basis to do so. You are responsible for complying with site terms, robots directives, rate limits,
            copyright rules, privacy laws, and any industry-specific obligations that apply to your use.
          </p>
          <p>
            You may not use Deltaora to bypass access controls, scrape non-public data, collect sensitive personal
            information unlawfully, overload third-party systems, or monitor targets for harassment, surveillance, or
            illegal activity.
          </p>
        </Section>

        <Section title="4. User Content and AI Summaries">
          <p>
            URLs, snapshots, diffs, workspace settings, and alert configuration that you submit remain your content.
            You grant Deltaora the limited rights needed to host, process, secure, display, and analyze that content so
            the service can operate.
          </p>
          <p>
            AI-generated summaries are provided to help review changes faster. They may be incomplete or inaccurate and
            should not be treated as legal, financial, medical, or compliance advice without human review.
          </p>
        </Section>

        <Section title="5. Google Sign-In">
          <p>
            When you choose Google sign-in, Deltaora uses Google Identity Services to authenticate you and receives
            basic identity information such as your verified email address, name, and Google account identifier. Use of
            Google user data is described in the <Link to="/privacy" className="text-blue-600 hover:underline dark:text-blue-400">Privacy Policy</Link>.
          </p>
        </Section>

        <Section title="6. Acceptable Use">
          <p>You agree not to misuse the service, including by attempting to:</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Reverse engineer, attack, disrupt, or overload Deltaora or third-party systems.</li>
            <li>Upload malware or use the service to distribute harmful content.</li>
            <li>Access accounts, workspaces, pages, or data without authorization.</li>
            <li>Use the service for unlawful surveillance, discrimination, spam, phishing, or abuse.</li>
            <li>Remove security controls or misrepresent your identity, permissions, or monitoring purpose.</li>
          </ul>
        </Section>

        <Section title="7. Availability and Changes">
          <p>
            We work to keep Deltaora reliable, but the service may be unavailable during maintenance, incidents, or
            infrastructure disruptions. We may update features, limits, security controls, and these Terms as the
            platform evolves.
          </p>
        </Section>

        <Section title="8. Disclaimers and Liability">
          <p>
            Deltaora is provided on an "as is" and "as available" basis to the maximum extent permitted by law. We do
            not guarantee that every monitored change will be detected, summarized, delivered, or retained.
          </p>
          <p>
            To the maximum extent permitted by law, Deltaora will not be liable for indirect, incidental, special,
            consequential, or punitive damages, or for lost profits, data, goodwill, or business opportunities.
          </p>
        </Section>

        <Section title="9. Contact">
          <p>
            Questions about these Terms can be sent to{' '}
            <a href={`mailto:${contactEmail}`} className="text-blue-600 hover:underline dark:text-blue-400">
              {contactEmail}
            </a>
            .
          </p>
        </Section>
      </main>

      <footer className="border-t border-gray-200 py-6 text-center text-xs text-gray-400 dark:border-gray-800 dark:text-gray-600">
        Copyright {new Date().getFullYear()} Deltaora. <Link to="/privacy" className="hover:underline">Privacy Policy</Link>
      </footer>
    </div>
  );
}

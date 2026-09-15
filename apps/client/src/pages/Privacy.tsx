import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="mb-10">
    <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 pb-2 border-b border-gray-200 dark:border-gray-800">
      {title}
    </h2>
    <div className="space-y-3 text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
      {children}
    </div>
  </section>
);

const Table = ({ headers, rows }: { headers: string[]; rows: string[][] }) => (
  <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800 my-4">
    <table className="w-full text-sm">
      <thead className="bg-gray-50 dark:bg-gray-800/60">
        <tr>
          {headers.map((h) => (
            <th key={h} className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 text-xs uppercase tracking-wider">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
        {rows.map((row, i) => (
          <tr key={i} className="bg-white dark:bg-gray-900">
            {row.map((cell, j) => (
              <td key={j} className="px-4 py-3 text-gray-600 dark:text-gray-400 align-top">
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export function Privacy() {
  const lastUpdated = 'September 15, 2026';
  const contactEmail = 'privacy@deltaora.com';

  return (
    <div className="flex-1 w-full bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* Header bar */}
      <header className="bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="text-lg font-bold text-blue-600 dark:text-blue-400 tracking-tight">
            Deltaora
          </Link>
          <Link
            to="/"
            className="text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
          >
            Back to Deltaora
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        {/* Title */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Privacy Policy</h1>
          <p className="text-sm text-gray-500 dark:text-gray-500">Last updated: {lastUpdated}</p>
        </div>

        {/* Intro */}
        <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-xl p-5 mb-10 text-sm text-blue-800 dark:text-blue-300 leading-relaxed">
          Deltaora ("we", "our", or "us") is committed to protecting your personal data. This policy explains what
          data we collect when you use our web change monitoring platform, why we collect it, how long we keep it,
          how we handle Google user data, and your rights under privacy laws such as the GDPR and CCPA/CPRA.
        </div>

        <Section title="1. Data Controller">
          <p>
            Deltaora operates as the data controller for personal data collected through this platform. For
            privacy-related enquiries, contact us at{' '}
            <a href={`mailto:${contactEmail}`} className="text-blue-600 dark:text-blue-400 hover:underline">
              {contactEmail}
            </a>
            .
          </p>
        </Section>

        <Section title="2. Google User Data">
          <p>
            Deltaora uses Google Identity Services only for sign-in and account creation. When you choose "Sign in
            with Google", Google sends us an ID token that we verify server-side. From that token, we use basic
            identity data: your Google account ID, verified email address, and name.
          </p>
          <p>
            Deltaora does not request or access Gmail, Google Drive, Google Calendar, Google Contacts, Google Photos,
            or other Google product content. We do not use Google user data for advertising, retargeting, credit
            decisions, sale to data brokers, unrelated analytics, surveillance, or training generalized AI models.
          </p>
          <p>
            Our use and transfer of information received from Google APIs complies with the Google API Services User
            Data Policy, including the Limited Use requirements.
          </p>
        </Section>

        <Section title="3. What We Collect and Why">
          <p>We collect only what is necessary to provide and secure the service.</p>
          <Table
            headers={['Category', 'Data collected', 'Lawful basis', 'Purpose']}
            rows={[
              [
                'Account data',
                'Name, email address, hashed password (argon2id)',
                'Contract performance',
                'Create and authenticate your account',
              ],
              [
                'Google OAuth',
                'Google account ID, name, verified email address',
                'Consent (you click "Sign in with Google")',
                'Authenticate you, create or link your Deltaora account, and verify email ownership',
              ],
              [
                'Session data',
                'IP address, user agent string, session tokens (hashed)',
                'Legitimate interest (security)',
                'Maintain authenticated sessions, detect token reuse attacks',
              ],
              [
                'Monitored page data',
                'URLs and HTML snapshots of pages you add for monitoring',
                'Contract performance',
                'Detect and report changes to those pages',
              ],
              [
                'Change intelligence',
                'Diffs, extracted page text, AI-generated summaries, importance scores',
                'Contract performance',
                'Help you review changes, search history, and prioritize alerts',
              ],
              [
                'Usage & audit logs',
                'Auth events (login, logout, MFA changes), timestamps',
                'Legitimate interest (security)',
                'Detect abuse, investigate security incidents',
              ],
              [
                'Email delivery',
                'Your email address, email open/click events (via Brevo)',
                'Contract performance / Consent',
                'Send verification emails, alerts, and (with consent) product updates',
              ],
              [
                'Passkey credentials',
                'WebAuthn public key, authenticator AAGUID, credential ID',
                'Consent (you register a passkey)',
                'Phishing-resistant passwordless authentication',
              ],
            ]}
          />
        </Section>

        <Section title="4. Cookies and Local Storage">
          <p>
            We use <strong>HttpOnly, Secure, SameSite=Strict</strong> cookies for session management. We do{' '}
            <strong>not</strong> use advertising cookies or third-party tracking cookies.
          </p>
          <Table
            headers={['Cookie name', 'Type', 'Lifetime', 'Purpose']}
            rows={[
              ['deltaora.accessToken', 'HttpOnly · Secure · SameSite=Strict', '15 minutes', 'Short-lived access token for API authentication'],
              ['deltaora.refreshToken', 'HttpOnly · Secure · SameSite=Strict', '12 hours idle / 30 days absolute', 'Renew access tokens without re-login'],
              ['deltaora.csrfToken', 'Readable by JS · SameSite=Strict', 'Session', 'CSRF protection on state-changing requests'],
            ]}
          />
          <p>
            In production the cookie names are prefixed with <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">__Host-</code>{' '}
            to prevent subdomain hijacking (RFC 6265bis).
          </p>
        </Section>

        <Section title="5. Third-Party Processors">
          <p>We share data with the following processors only to the extent necessary to run the service:</p>
          <Table
            headers={['Processor', 'Purpose', 'Data shared', 'Location']}
            rows={[
              ['Google (Identity Services)', 'OAuth sign-in', 'ID token — verified server-side; we never receive your Google password', 'USA (SCCs apply)'],
              ['Brevo (Sendinblue)', 'Transactional email delivery', 'Your email address, email content', 'EU'],
              ['AI model provider configured for the deployment', 'Generate change summaries and importance signals', 'Monitored page text, diffs, and related metadata needed for the summary request', 'Configured per deployment'],
              ['MongoDB Atlas (if cloud-hosted)', 'Primary database', 'All account and monitoring data', 'Configured per deployment'],
              ['Redis (self-hosted / cloud)', 'Session cache, rate limiting', 'Session token hashes, IP counters', 'Configured per deployment'],
            ]}
          />
          <p>
            We do not sell, rent, or share your personal data with advertisers or data brokers.
          </p>
        </Section>

        <Section title="6. Data Retention">
          <Table
            headers={['Data type', 'Retention period']}
            rows={[
              ['Active account data', 'Until you delete your account'],
              ['Google account ID and verified email', 'Until you unlink Google sign-in or delete your account'],
              ['Refresh token sessions', '30 days absolute maximum; idle sessions expire after 12 hours'],
              ['Access tokens', '15 minutes'],
              ['Email verification tokens', '24 hours'],
              ['Password reset tokens', '1 hour'],
              ['Audit/auth event logs', '90 days'],
              ['Monitored page snapshots', 'Until you remove the monitored page or delete your account'],
              ['Revoked session records', '30 days after revocation, then purged'],
            ]}
          />
        </Section>

        <Section title="7. Google Access Revocation and Deletion">
          <p>
            You can stop using Google sign-in by contacting us at{' '}
            <a href={`mailto:${contactEmail}`} className="text-blue-600 dark:text-blue-400 hover:underline">
              {contactEmail}
            </a>
            . You can also review or revoke Deltaora's Google access from your Google Account security settings.
          </p>
          <p>
            To delete your Deltaora account and associated Google identity data, email us from the account address.
            We will delete or anonymize account records, monitored URLs, snapshots, summaries, and workspace data
            within 30 days unless we must retain limited records for security, fraud prevention, legal compliance, or
            dispute resolution.
          </p>
        </Section>

        <Section title="8. Security">
          <p>We apply the following technical safeguards:</p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>Passwords hashed with <strong>argon2id</strong> (winner of the Password Hashing Competition)</li>
            <li>Refresh tokens stored as <strong>SHA-256 hashes</strong> — raw tokens never persisted to the database</li>
            <li>Token reuse detection: replaying an old refresh token immediately revokes all sessions and triggers a security alert email</li>
            <li>Rate limiting on all authentication endpoints with independent per-endpoint Redis-backed counters</li>
            <li>Exponential account lockout after repeated failed login attempts</li>
            <li>Optional TOTP-based two-factor authentication (MFA)</li>
            <li>Optional phishing-resistant passkey (WebAuthn) authentication</li>
            <li>CSRF protection on all state-changing API requests</li>
            <li>Transport encrypted with TLS in production</li>
          </ul>
        </Section>

        <Section title="9. Your Rights">
          <p>
            Depending on your location you have rights under the <strong>GDPR</strong> (EU/UK) and/or{' '}
            <strong>CCPA</strong> (California):
          </p>
          <Table
            headers={['Right', 'How to exercise it']}
            rows={[
              ['Access — receive a copy of your data', `Email ${contactEmail}`],
              ['Rectification — correct inaccurate data', 'Update directly in Settings → Profile'],
              ['Erasure ("right to be forgotten")', `Email ${contactEmail} — we will delete your account and all associated data within 30 days`],
              ['Portability — export your data in machine-readable format', `Email ${contactEmail}`],
              ['Object to processing based on legitimate interest', `Email ${contactEmail}`],
              ['Withdraw consent (e.g. marketing emails)', 'Toggle off in Settings → Notifications'],
              ['CCPA: Do Not Sell My Personal Information', 'We do not sell personal information — no action required'],
            ]}
          />
          <p>
            We will respond to all data subject requests within <strong>30 days</strong> (GDPR Art. 12) or{' '}
            <strong>45 days</strong> (CCPA).
          </p>
        </Section>

        <Section title="10. Children's Privacy">
          <p>
            Deltaora is not directed at children under 16. We do not knowingly collect personal data from
            anyone under 16. If you believe a child has provided us with data, contact{' '}
            <a href={`mailto:${contactEmail}`} className="text-blue-600 dark:text-blue-400 hover:underline">
              {contactEmail}
            </a>{' '}
            and we will delete it promptly.
          </p>
        </Section>

        <Section title="11. International Transfers">
          <p>
            If you are located in the European Economic Area (EEA) or UK, your data may be transferred to
            processors in the United States. Where this occurs, we rely on <strong>Standard Contractual Clauses
            (SCCs)</strong> approved by the European Commission (2021/914/EU) as the transfer mechanism.
          </p>
        </Section>

        <Section title="12. Changes to This Policy">
          <p>
            We may update this policy to reflect changes in the platform or applicable law. When we make
            material changes, we will notify you by email and update the "Last updated" date at the top of this
            page. If a change materially affects how we use Google user data, we will ask for renewed consent before
            using that data in the new way.
          </p>
        </Section>

        <Section title="13. Contact and Complaints">
          <p>
            For any privacy question or to exercise a right, contact us at{' '}
            <a href={`mailto:${contactEmail}`} className="text-blue-600 dark:text-blue-400 hover:underline">
              {contactEmail}
            </a>
            .
          </p>
          <p>
            If you are in the EU/UK and believe we have not handled your data lawfully, you have the right to
            lodge a complaint with your local supervisory authority (e.g. the ICO in the UK, or your national
            DPA in the EU).
          </p>
        </Section>
      </main>

      <footer className="border-t border-gray-200 dark:border-gray-800 py-6 text-center text-xs text-gray-400 dark:text-gray-600">
        Copyright {new Date().getFullYear()} Deltaora. <Link to="/terms" className="hover:underline">Terms of Service</Link>
      </footer>
    </div>
  );
}

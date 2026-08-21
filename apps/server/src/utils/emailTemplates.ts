/**
 * 2026 Enterprise Email Templates for Deltaora.
 * Uses a unified, responsive base layout with branded styling.
 * All notification emails include an unsubscribe link per CAN-SPAM/GDPR.
 *
 * BASE_URL is injected from env.CLIENT_URL at each call site — never hardcoded.
 */

const baseLayout = (body: string, baseUrl: string, options?: { showUnsubscribe?: boolean }) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Deltaora</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f6f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f6f9; padding: 40px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.06);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 32px 40px; text-align: center;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">Deltaora</h1>
              <p style="margin: 4px 0 0; font-size: 13px; color: rgba(255,255,255,0.8); letter-spacing: 0.5px;">Web Change Monitoring Platform</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              ${body}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; text-align: center;">
              <p style="margin: 0 0 8px; font-size: 12px; color: #9ca3af;">&copy; ${new Date().getFullYear()} Deltaora. All rights reserved.</p>
              ${options?.showUnsubscribe ? `
                <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                  <a href="${baseUrl}/settings" style="color: #6b7280; text-decoration: underline;">Manage email preferences</a>
                  &nbsp;|&nbsp;
                  <a href="${baseUrl}/settings" style="color: #6b7280; text-decoration: underline;">Unsubscribe</a>
                </p>
              ` : ''}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

export const welcomeEmail = (name: string, baseUrl: string) => baseLayout(`
  <h2 style="margin: 0 0 16px; font-size: 22px; font-weight: 600; color: #111827;">Welcome to Deltaora, ${name}!</h2>
  <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #4b5563;">
    Your account has been successfully created. Deltaora helps you monitor web pages for changes with AI-powered analysis.
  </p>
  <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: #4b5563;">
    Here's how to get started:
  </p>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
    <tr>
      <td style="padding: 12px 16px; background-color: #eff6ff; border-radius: 8px; border-left: 4px solid #3b82f6;">
        <p style="margin: 0 0 4px; font-size: 14px; font-weight: 600; color: #1e40af;">1. Add a page to monitor</p>
        <p style="margin: 0; font-size: 13px; color: #4b5563;">Navigate to "Monitored Pages" and add any URL you want to track.</p>
      </td>
    </tr>
    <tr><td style="height: 8px;"></td></tr>
    <tr>
      <td style="padding: 12px 16px; background-color: #eff6ff; border-radius: 8px; border-left: 4px solid #3b82f6;">
        <p style="margin: 0 0 4px; font-size: 14px; font-weight: 600; color: #1e40af;">2. Configure alerts</p>
        <p style="margin: 0; font-size: 13px; color: #4b5563;">Set your notification preferences so you never miss a critical change.</p>
      </td>
    </tr>
    <tr><td style="height: 8px;"></td></tr>
    <tr>
      <td style="padding: 12px 16px; background-color: #eff6ff; border-radius: 8px; border-left: 4px solid #3b82f6;">
        <p style="margin: 0 0 4px; font-size: 14px; font-weight: 600; color: #1e40af;">3. Invite your team</p>
        <p style="margin: 0; font-size: 13px; color: #4b5563;">Collaborate with your team by inviting members to your workspace.</p>
      </td>
    </tr>
  </table>
  <div style="text-align: center;">
    <a href="${baseUrl}/dashboard" style="display: inline-block; padding: 12px 32px; background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 15px; font-weight: 600;">Go to Dashboard</a>
  </div>
`, baseUrl);

export const passwordResetEmail = (resetUrl: string, baseUrl: string) => baseLayout(`
  <h2 style="margin: 0 0 16px; font-size: 22px; font-weight: 600; color: #111827;">Password Reset Request</h2>
  <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #4b5563;">
    We received a request to reset the password for your Deltaora account.
  </p>
  <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: #4b5563;">
    Click the button below to set a new password. This link is valid for <strong>15 minutes</strong>.
  </p>
  <div style="text-align: center; margin-bottom: 24px;">
    <a href="${resetUrl}" style="display: inline-block; padding: 12px 32px; background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 15px; font-weight: 600;">Reset Password</a>
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td style="padding: 12px 16px; background-color: #fef3c7; border-radius: 8px; border-left: 4px solid #f59e0b;">
        <p style="margin: 0; font-size: 13px; color: #92400e;">
          <strong>Security notice:</strong> If you did not request this password reset, please ignore this email. Your account remains secure.
        </p>
      </td>
    </tr>
  </table>
`, baseUrl);

export const workspaceInviteEmail = (inviterName: string, workspaceName: string, joinUrl: string, baseUrl: string) => baseLayout(`
  <h2 style="margin: 0 0 16px; font-size: 22px; font-weight: 600; color: #111827;">You've Been Invited!</h2>
  <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #4b5563;">
    <strong>${inviterName}</strong> has invited you to join the workspace <strong>"${workspaceName}"</strong> on Deltaora.
  </p>
  <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: #4b5563;">
    Click the button below to accept the invitation. This link expires in <strong>48 hours</strong>.
  </p>
  <div style="text-align: center; margin-bottom: 24px;">
    <a href="${joinUrl}" style="display: inline-block; padding: 12px 32px; background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 15px; font-weight: 600;">Join Workspace</a>
  </div>
  <p style="margin: 0; font-size: 13px; color: #9ca3af; text-align: center;">
    If you don't have a Deltaora account yet, you'll be prompted to create one first.
  </p>
`, baseUrl);

export const pageChangeNotificationEmail = (pageTitle: string, pageUrl: string, summaryText: string, pageId: string, baseUrl: string) => baseLayout(`
  <h2 style="margin: 0 0 16px; font-size: 22px; font-weight: 600; color: #111827;">Change Detected</h2>
  <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #4b5563;">
    We detected changes on a page you're monitoring:
  </p>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
    <tr>
      <td style="padding: 16px; background-color: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;">
        <p style="margin: 0 0 4px; font-size: 16px; font-weight: 600; color: #111827;">${pageTitle}</p>
        <p style="margin: 0 0 12px; font-size: 13px; color: #6b7280; word-break: break-all;">${pageUrl}</p>
        <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #4b5563;">${summaryText}</p>
      </td>
    </tr>
  </table>
  <div style="text-align: center;">
    <a href="${baseUrl}/pages/${pageId}" style="display: inline-block; padding: 12px 32px; background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 15px; font-weight: 600;">View Full Report</a>
  </div>
`, baseUrl, { showUnsubscribe: true });

export const verificationEmail = (verificationUrl: string, baseUrl: string) => baseLayout(`
  <h2 style="margin: 0 0 16px; font-size: 22px; font-weight: 600; color: #111827;">Verify Your Email Address</h2>
  <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #4b5563;">
    Thank you for registering for Deltaora. To complete your signup and unlock all features, please verify your email address.
  </p>
  <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: #4b5563;">
    Click the button below to verify your email. This link is valid for <strong>24 hours</strong>.
  </p>
  <div style="text-align: center; margin-bottom: 24px;">
    <a href="${verificationUrl}" style="display: inline-block; padding: 12px 32px; background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 15px; font-weight: 600;">Verify Email</a>
  </div>
`, baseUrl);

import axios from 'axios';
import { env } from '../config/env';

interface SendEmailOptions {
  to: string;
  subject: string;
  htmlContent: string;
}

/**
 * Service to send emails using Brevo (formerly Sendinblue) v3 API.
 * Uses native axios instead of heavy SDKs for 2026 enterprise standard.
 */
export const sendEmail = async ({ to, subject, htmlContent }: SendEmailOptions) => {
  if (!env.BREVO_API_KEY) {
    console.warn('\n[DEV] No BREVO_API_KEY found. Mocking email send:');
    console.warn(`[DEV] To: ${to}`);
    console.warn(`[DEV] Subject: ${subject}`);
    console.warn(`[DEV] HTML Content: \n${htmlContent}\n`);
    return;
  }

  try {
    await axios.post(
      'https://api.brevo.com/v3/smtp/email',
      {
        sender: { email: env.EMAIL_FROM || 'noreply@deltaora.com', name: 'Deltaora' },
        to: [{ email: to }],
        subject,
        htmlContent,
      },
      {
        headers: {
          'api-key': env.BREVO_API_KEY,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      }
    );
  } catch (error: any) {
    console.error('Failed to send email via Brevo:', error.response?.data || error.message);
    throw new Error('Failed to send email');
  }
};

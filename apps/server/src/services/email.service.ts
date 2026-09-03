import axios from 'axios';
import { env } from '../config/env';

interface SendEmailOptions {
  to: string;
  subject: string;
  htmlContent: string;
}

const renderConsoleEmail = ({ to, subject, htmlContent }: SendEmailOptions) => {
  console.info('\n[EMAIL:console] Transactional email captured locally');
  console.info(`[EMAIL:console] To: ${to}`);
  console.info(`[EMAIL:console] Subject: ${subject}`);
  console.info(`[EMAIL:console] HTML Content:\n${htmlContent}\n`);
};

export const sendEmail = async ({ to, subject, htmlContent }: SendEmailOptions) => {
  if (env.EMAIL_DELIVERY_MODE === 'disabled') {
    console.warn(`[EMAIL:disabled] Skipped transactional email "${subject}" to ${to}`);
    return;
  }

  if (env.EMAIL_DELIVERY_MODE === 'console') {
    renderConsoleEmail({ to, subject, htmlContent });
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
    const providerError = error.response?.data || error.message;
    console.error('Failed to send email via Brevo:', providerError);
    throw new Error('Failed to send email');
  }
};

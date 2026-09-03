import axios from 'axios';
import { env } from '../config/env';

const BREVO_API_BASE_URL = 'https://api.brevo.com/v3';
const BREVO_TIMEOUT_MS = 10_000;

interface SendEmailOptions {
  to: string;
  subject: string;
  htmlContent: string;
}

interface EmailDeliveryErrorOptions {
  code: string;
  message: string;
  providerStatus?: number;
  retryable?: boolean;
  statusCode?: number;
}

export class EmailDeliveryError extends Error {
  code: string;
  providerStatus?: number;
  retryable: boolean;
  statusCode: number;

  constructor({ code, message, providerStatus, retryable = false, statusCode = 503 }: EmailDeliveryErrorOptions) {
    super(message);
    this.name = 'EmailDeliveryError';
    this.code = code;
    this.providerStatus = providerStatus;
    this.retryable = retryable;
    this.statusCode = statusCode;
  }
}

export const isEmailDeliveryError = (error: unknown): error is EmailDeliveryError =>
  error instanceof EmailDeliveryError || (typeof error === 'object' && error !== null && (error as any).name === 'EmailDeliveryError');

const brevoApiKey = () => env.BREVO_API_KEY?.trim();

const brevoHeaders = () => ({
  'api-key': brevoApiKey(),
  'Content-Type': 'application/json',
  'Accept': 'application/json',
});

const redactBrevoError = (error: any) => ({
  status: error.response?.status,
  code: error.response?.data?.code,
  message: error.response?.data?.message || error.message,
});

const toEmailDeliveryError = (error: any) => {
  const providerStatus = error.response?.status;
  const providerCode = error.response?.data?.code;

  if (providerStatus === 401 || providerStatus === 403 || providerCode === 'unauthorized') {
    return new EmailDeliveryError({
      code: 'EMAIL_PROVIDER_AUTH_FAILED',
      message: 'Email provider authentication failed. Check BREVO_API_KEY in the server environment.',
      providerStatus,
      retryable: false,
      statusCode: 503,
    });
  }

  if (providerStatus === 429) {
    return new EmailDeliveryError({
      code: 'EMAIL_PROVIDER_RATE_LIMITED',
      message: 'Email provider rate limit reached. Try again later.',
      providerStatus,
      retryable: true,
      statusCode: 503,
    });
  }

  if (providerStatus && providerStatus >= 400 && providerStatus < 500) {
    return new EmailDeliveryError({
      code: 'EMAIL_PROVIDER_REJECTED_REQUEST',
      message: 'Email provider rejected the email request. Check sender, recipient, and template configuration.',
      providerStatus,
      retryable: false,
      statusCode: 502,
    });
  }

  return new EmailDeliveryError({
    code: 'EMAIL_PROVIDER_UNAVAILABLE',
    message: 'Email provider is unavailable. Try again later.',
    providerStatus,
    retryable: true,
    statusCode: 503,
  });
};

const renderConsoleEmail = ({ to, subject, htmlContent }: SendEmailOptions) => {
  console.info('\n[EMAIL:console] Transactional email captured locally');
  console.info(`[EMAIL:console] To: ${to}`);
  console.info(`[EMAIL:console] Subject: ${subject}`);
  console.info(`[EMAIL:console] HTML Content:\n${htmlContent}\n`);
};

export const validateEmailProvider = async () => {
  if (env.EMAIL_DELIVERY_MODE !== 'brevo' || !env.EMAIL_PROVIDER_STARTUP_CHECK) {
    return;
  }

  try {
    await axios.get(`${BREVO_API_BASE_URL}/account`, {
      headers: brevoHeaders(),
      timeout: BREVO_TIMEOUT_MS,
    });
    console.info('Brevo email provider credentials validated');
  } catch (error: any) {
    const deliveryError = toEmailDeliveryError(error);
    console.error('Brevo email provider validation failed:', redactBrevoError(error));
    throw deliveryError;
  }
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
      `${BREVO_API_BASE_URL}/smtp/email`,
      {
        sender: { email: env.EMAIL_FROM || 'noreply@deltaora.com', name: 'Deltaora' },
        to: [{ email: to }],
        subject,
        htmlContent,
      },
      {
        headers: brevoHeaders(),
        timeout: BREVO_TIMEOUT_MS,
      }
    );
  } catch (error: any) {
    console.error('Failed to send email via Brevo:', redactBrevoError(error));
    throw toEmailDeliveryError(error);
  }
};

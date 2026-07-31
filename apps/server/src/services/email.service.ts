import nodemailer from 'nodemailer';
import { env } from '../config/env';

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST || 'localhost',
  port: Number(env.SMTP_PORT) || 1025,
  secure: Number(env.SMTP_PORT) === 465,
  auth: (env.SMTP_USER && env.SMTP_PASS) ? {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  } : undefined,
});

export const sendNotificationEmail = async (to: string, pageTitle: string, summary: string) => {
  const mailOptions = {
    from: env.EMAIL_FROM || '"Deltaora" <noreply@deltaora.com>',
    to,
    subject: `Changes Detected: ${pageTitle}`,
    html: `
      <h2>Changes detected on monitored page: ${pageTitle}</h2>
      <p><strong>Summary of changes:</strong></p>
      <p>${summary}</p>
      <hr>
      <p><a href="https://deltaora.com/dashboard">View full diff on Deltaora</a></p>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error(`Failed to send email to ${to}:`, error);
  }
};

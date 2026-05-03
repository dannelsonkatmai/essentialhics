import nodemailer from 'nodemailer';
import { config } from '../config';
import { logger } from '../config/logger';

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (transporter) return transporter;

  if (!config.SMTP_HOST) {
    // Development fallback: log emails to console
    transporter = nodemailer.createTransport({ jsonTransport: true });
    return transporter;
  }

  transporter = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_SECURE,
    auth: config.SMTP_USER
      ? { user: config.SMTP_USER, pass: config.SMTP_PASSWORD }
      : undefined,
  });
  return transporter;
}

async function sendMail(options: nodemailer.SendMailOptions): Promise<void> {
  try {
    const t = getTransporter();
    const info = await t.sendMail({ from: config.EMAIL_FROM, ...options });
    if (process.env.NODE_ENV === 'development') {
      logger.debug('Email (dev):', { to: options.to, subject: options.subject });
    }
  } catch (err) {
    logger.error('Failed to send email', { err, to: options.to });
  }
}

export async function sendPasswordResetEmail(
  to: string,
  firstName: string,
  resetUrl: string,
): Promise<void> {
  await sendMail({
    to,
    subject: 'Essential HICS — Password Reset Request',
    html: `
      <h2>Password Reset Request</h2>
      <p>Hi ${firstName},</p>
      <p>You requested a password reset for your Essential HICS account.</p>
      <p><a href="${resetUrl}">Reset your password</a></p>
      <p>This link expires in 24 hours and can only be used once.</p>
      <p>If you did not request this, please ignore this email.</p>
    `,
  });
}

export async function sendInviteEmail(
  to: string,
  firstName: string,
  setPasswordUrl: string,
  facilityName: string,
): Promise<void> {
  await sendMail({
    to,
    subject: `You've been added to ${facilityName} on Essential HICS`,
    html: `
      <h2>Welcome to Essential HICS</h2>
      <p>Hi ${firstName},</p>
      <p>Your account has been created for <strong>${facilityName}</strong>.</p>
      <p><a href="${setPasswordUrl}">Set your password to get started</a></p>
      <p>This link expires in 24 hours.</p>
    `,
  });
}

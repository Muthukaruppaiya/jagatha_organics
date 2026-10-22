import nodemailer from 'nodemailer';

let transport;

export function mailReady() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export async function sendMail({ to, subject, text, html }) {
  if (!mailReady()) {
    const showOtp = String(process.env.SHOW_OTP || '').toLowerCase() === 'true';
    if (process.env.NODE_ENV === 'production' && !showOtp) {
      const error = new Error('Email is not set up yet. Please contact us on WhatsApp.');
      error.status = 503;
      throw error;
    }
    console.log(`[email not set up] To ${to} · ${subject}\n${text}`);
    return { delivered: false };
  }
  if (!transport) {
    const port = Number(process.env.SMTP_PORT || 465);
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  await transport.sendMail({
    from: process.env.MAIL_FROM || `Jagatha Organics <${process.env.SMTP_USER}>`,
    to,
    subject,
    text,
    html,
  });
  return { delivered: true };
}

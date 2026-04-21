import nodemailer from "nodemailer";
import env from "../../config/env.js";

export default class SmtpEmailProvider {
  constructor() {
    this.transporter = null;
  }

  isConfigured() {
    return Boolean(env.SMTP_HOST && env.SMTP_PORT && env.SMTP_FROM);
  }

  getMissingConfigKeys() {
    const missing = [];

    if (!env.SMTP_HOST) missing.push("SMTP_HOST");
    if (!env.SMTP_PORT) missing.push("SMTP_PORT");
    if (!env.SMTP_FROM) missing.push("SMTP_FROM");

    return missing;
  }

  getTransporter() {
    if (this.transporter) {
      return this.transporter;
    }

    const hasAuth = Boolean(env.SMTP_USER && env.SMTP_PASS);

    this.transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: Boolean(env.SMTP_SECURE),
      auth: hasAuth
        ? {
            user: env.SMTP_USER,
            pass: env.SMTP_PASS
          }
        : undefined
    });

    return this.transporter;
  }

  async send({ to, subject, text = "", html = "", replyTo = "", attachments = [] }) {
    if (process.env.NODE_ENV === "test") {
      return {
        accepted: Array.isArray(to) ? to : [to],
        messageId: "test-message-id"
      };
    }

    if (!this.isConfigured()) {
      const missing = this.getMissingConfigKeys();
      throw new Error(`Configuracion SMTP incompleta: ${missing.join(", ")}`);
    }

    const transporter = this.getTransporter();

    return transporter.sendMail({
      from: env.SMTP_FROM,
      to,
      subject,
      text: text || undefined,
      html: html || undefined,
      replyTo: replyTo || undefined,
      attachments: attachments && attachments.length ? attachments : undefined
    });
  }
}

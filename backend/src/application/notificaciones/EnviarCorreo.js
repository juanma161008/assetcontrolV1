const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeRecipients = (to) => {
  const raw = Array.isArray(to) ? to : String(to || "").split(",");

  const recipients = raw
    .map((item) => String(item || "").trim())
    .filter(Boolean);

  if (!recipients.length) {
    throw new Error("Debes indicar al menos un correo destino");
  }

  const invalid = recipients.find((item) => !EMAIL_REGEX.test(item));
  if (invalid) {
    throw new Error(`Correo invalido: ${invalid}`);
  }

  return recipients;
};

export default class EnviarCorreo {
  constructor(emailProvider) {
    this.emailProvider = emailProvider;
  }

  async execute(payload = {}, meta = {}) {
    const recipients = normalizeRecipients(payload.to);
    const subject = String(payload.subject || "").trim();
    const text = String(payload.text || "").trim();
    const html = String(payload.html || "").trim();

    if (!subject) {
      throw new Error("El asunto del correo es obligatorio");
    }

    if (!text && !html) {
      throw new Error("Debes enviar contenido en texto o html");
    }

    const replyTo = String(payload.replyTo || meta.replyTo || "").trim();
    const attachments = Array.isArray(payload.attachments) ? payload.attachments : [];

    const result = await this.emailProvider.send({
      to: recipients.join(", "),
      subject,
      text,
      html,
      replyTo,
      attachments
    });

    return {
      accepted: result?.accepted || recipients,
      rejected: result?.rejected || [],
      messageId: result?.messageId || null
    };
  }
}

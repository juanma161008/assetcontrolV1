import httpClient from "./httpClient";

export async function sendEmailNotification({ to, subject, text, html, replyTo }) {
  try {
    const response = await httpClient.post("/api/notificaciones/email", {
      to,
      subject,
      text,
      html,
      replyTo
    });

    return {
      success: true,
      data: response.data.data || {},
      message: response.data.message || "Correo enviado"
    };
  } catch (error) {
    return {
      success: false,
      error: error?.response?.data?.message || "No se pudo enviar el correo"
    };
  }
}

// services/emailService.js
// Servicio centralizado de emails usando Nodemailer.
// Todas las funciones de envío de correo pasan por aquí.

const nodemailer = require('nodemailer');
require('dotenv').config();

// ── Configuración del transporter ────────────────────────────
// El transporter es la conexión con el servidor SMTP.
// Se crea una sola vez y se reutiliza en todos los envíos.
const transporter = nodemailer.createTransport({
  host:   process.env.EMAIL_HOST,
  port:   parseInt(process.env.EMAIL_PORT),
  secure: process.env.EMAIL_PORT === '465', // true para 465, false para 587
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

// Verifica la conexión al arrancar el servidor
const testEmail = async () => {
  await transporter.verify();
  console.log('✅ Email conectado');
};

// ── Template base HTML ────────────────────────────────────────
// Todos los emails usan este layout para tener consistencia visual
const template = (title, content) => `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#0a0b0e;font-family:'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0b0e;padding:40px 0">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0"
          style="background:#111318;border:1px solid #232730;border-radius:14px;overflow:hidden">

          <!-- Header -->
          <tr>
            <td style="background:#111318;padding:28px 32px;border-bottom:1px solid #232730">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#3b82f6;border-radius:8px;width:32px;height:32px;
                              text-align:center;vertical-align:middle;font-size:16px">⚡</td>
                  <td style="padding-left:10px;font-size:1rem;font-weight:600;color:#ffffff;
                              font-family:monospace">Sup<span style="color:#3b82f6">Crud</span></td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding:32px">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #232730;
                        font-size:11px;color:#64748b;text-align:center">
              Este correo fue enviado automáticamente por SupCrud · by Crudzaso<br>
              Si no solicitaste esto, puedes ignorar este mensaje.
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

// ══════════════════════════════════════════════════════════════
//  EMAIL 1 — Ticket creado (para el cliente)
//  Se envía cuando se crea un ticket, ya sea por el widget
//  o manualmente por un admin. Le llega el referenceCode.
// ══════════════════════════════════════════════════════════════
const enviarConfirmacionTicket = async ({ to, referenceCode, subject, workspaceName, consultaUrl }) => {
  const content = `
    <h2 style="color:#ffffff;font-size:1.1rem;margin:0 0 8px">Tu solicitud fue recibida</h2>
    <p style="color:#94a3b8;font-size:0.88rem;margin:0 0 24px;line-height:1.6">
      Hemos recibido tu solicitud en <strong style="color:#e2e8f0">${workspaceName}</strong>.
      Guarda este código para consultar el estado de tu caso:
    </p>

    <!-- Código de referencia -->
    <div style="background:#0a0b0e;border:1px solid #2e3340;border-radius:10px;
                padding:20px;text-align:center;margin-bottom:24px">
      <div style="font-size:11px;color:#64748b;text-transform:uppercase;
                  letter-spacing:0.1em;margin-bottom:8px">Código de referencia</div>
      <div style="font-size:1.5rem;font-weight:700;color:#3b82f6;
                  font-family:monospace;letter-spacing:0.05em">${referenceCode}</div>
    </div>

    <p style="color:#94a3b8;font-size:0.85rem;margin:0 0 12px">
      <strong style="color:#e2e8f0">Asunto:</strong> ${subject}
    </p>

    <p style="color:#94a3b8;font-size:0.85rem;margin:0 0 24px;line-height:1.6">
      Nuestro equipo revisará tu caso y te responderá pronto.
      Puedes consultar el estado en cualquier momento usando tu código de referencia.
    </p>

    <a href="${consultaUrl}"
      style="display:inline-block;background:#3b82f6;color:#ffffff;
             text-decoration:none;padding:12px 24px;border-radius:8px;
             font-size:0.88rem;font-weight:600">
      Consultar mi caso →
    </a>
  `;

  await transporter.sendMail({
    from:    process.env.EMAIL_FROM,
    to,
    subject: `[${referenceCode}] Tu solicitud fue recibida — ${workspaceName}`,
    html:    template('Ticket recibido', content)
  });
};

// ══════════════════════════════════════════════════════════════
//  EMAIL 2 — OTP para consulta pública
//  El cliente ingresa su referenceCode y su email,
//  el sistema le envía un código de 6 dígitos por correo
//  con validez de 10 minutos para autenticar la consulta.
// ══════════════════════════════════════════════════════════════
const enviarOTP = async ({ to, otp, referenceCode, workspaceName }) => {
  const content = `
    <h2 style="color:#ffffff;font-size:1.1rem;margin:0 0 8px">Tu código de verificación</h2>
    <p style="color:#94a3b8;font-size:0.88rem;margin:0 0 24px;line-height:1.6">
      Solicitaste acceder al estado de tu caso en
      <strong style="color:#e2e8f0">${workspaceName}</strong>.
      Usa este código para verificar tu identidad:
    </p>

    <!-- OTP -->
    <div style="background:#0a0b0e;border:1px solid #2e3340;border-radius:10px;
                padding:24px;text-align:center;margin-bottom:24px">
      <div style="font-size:11px;color:#64748b;text-transform:uppercase;
                  letter-spacing:0.1em;margin-bottom:10px">Código de verificación</div>
      <div style="font-size:2.5rem;font-weight:700;color:#ffffff;
                  font-family:monospace;letter-spacing:0.3em">${otp}</div>
      <div style="font-size:11px;color:#64748b;margin-top:10px">
        Válido por <strong style="color:#f59e0b">10 minutos</strong> · Máximo 3 intentos
      </div>
    </div>

    <p style="color:#94a3b8;font-size:0.82rem;margin:0;line-height:1.6">
      Caso: <strong style="color:#e2e8f0;font-family:monospace">${referenceCode}</strong><br>
      Si no solicitaste este código, alguien pudo haber ingresado tu correo por error.
    </p>
  `;

  await transporter.sendMail({
    from:    process.env.EMAIL_FROM,
    to,
    subject: `${otp} — Tu código de verificación SupCrud`,
    html:    template('Código de verificación', content)
  });
};

// ══════════════════════════════════════════════════════════════
//  EMAIL 3 — Ticket actualizado (notificación al cliente)
//  Se envía cuando el agente cambia el estado del ticket.
// ══════════════════════════════════════════════════════════════
const enviarNotificacionEstado = async ({ to, referenceCode, nuevoEstado, workspaceName, consultaUrl }) => {
  const estadoLabel = {
    IN_PROGRESS: 'En progreso — estamos trabajando en tu caso',
    RESOLVED:    'Resuelto — tu caso ha sido resuelto',
    CLOSED:      'Cerrado — tu caso fue cerrado',
    REOPENED:    'Reabierto — tu caso fue reabierto'
  };

  const estadoColor = {
    IN_PROGRESS: '#f59e0b',
    RESOLVED:    '#10b981',
    CLOSED:      '#64748b',
    REOPENED:    '#3b82f6'
  };

  const label = estadoLabel[nuevoEstado] || nuevoEstado;
  const color = estadoColor[nuevoEstado] || '#3b82f6';

  const content = `
    <h2 style="color:#ffffff;font-size:1.1rem;margin:0 0 8px">Tu caso fue actualizado</h2>
    <p style="color:#94a3b8;font-size:0.88rem;margin:0 0 24px;line-height:1.6">
      Hay una actualización en tu caso en
      <strong style="color:#e2e8f0">${workspaceName}</strong>:
    </p>

    <div style="background:#0a0b0e;border:1px solid #2e3340;border-radius:10px;
                padding:20px;margin-bottom:24px">
      <div style="font-size:11px;color:#64748b;text-transform:uppercase;
                  letter-spacing:0.1em;margin-bottom:6px">Nuevo estado</div>
      <div style="font-size:0.95rem;font-weight:600;color:${color}">${label}</div>
      <div style="font-size:11px;color:#64748b;margin-top:8px;font-family:monospace">${referenceCode}</div>
    </div>

    <a href="${consultaUrl}"
      style="display:inline-block;background:#3b82f6;color:#ffffff;
             text-decoration:none;padding:12px 24px;border-radius:8px;
             font-size:0.88rem;font-weight:600">
      Ver detalle de mi caso →
    </a>
  `;

  await transporter.sendMail({
    from:    process.env.EMAIL_FROM,
    to,
    subject: `Tu caso ${referenceCode} fue actualizado — ${workspaceName}`,
    html:    template('Caso actualizado', content)
  });
};

module.exports = { testEmail, enviarConfirmacionTicket, enviarOTP, enviarNotificacionEstado };

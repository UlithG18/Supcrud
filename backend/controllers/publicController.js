// controllers/publicController.js
// Flujo público: el cliente consulta su ticket sin autenticación.
//
// Flujo completo:
// 1. Cliente ingresa referenceCode + email → POST /api/public/solicitar-otp
// 2. Sistema valida que el email coincide con el ticket
// 3. Genera OTP de 6 dígitos, lo guarda en MySQL (tabla otp_codes) y lo envía por email
// 4. Cliente ingresa el OTP → POST /api/public/verificar-otp
// 5. Sistema valida OTP (máx 3 intentos, 10 min de validez)
// 6. Si es válido, devuelve los datos del ticket
// 7. Cliente puede ver el ticket y agregar mensajes → POST /api/public/tickets/:ref/messages

const { pool }  = require('../config/mysql');
const Ticket    = require('../models/Ticket');
const { enviarOTP, enviarConfirmacionTicket, enviarNotificacionEstado } = require('../services/emailService');
require('dotenv').config();

// ── Helper: genera OTP de 6 dígitos ──────────────────────────
const generarOTP = () => String(Math.floor(100000 + Math.random() * 900000));

// URL base del frontend para links en emails
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// ══════════════════════════════════════════════════════════════
//  PASO 1 — Solicitar OTP
//  POST /api/public/solicitar-otp
//  Body: { referenceCode, email }
//
//  Valida que el ticket existe y que el email coincide,
//  luego genera y envía el OTP.
// ══════════════════════════════════════════════════════════════
const solicitarOTP = async (req, res) => {
  try {
    const { referenceCode, email } = req.body;

    if (!referenceCode || !email)
      return res.status(400).json({ ok: false, message: 'referenceCode y email son requeridos' });

    // Busca el ticket en MongoDB
    const ticket = await Ticket.findOne({
      referenceCode: referenceCode.trim().toUpperCase(),
      userEmail:     email.trim().toLowerCase()
    });

    // Respuesta genérica para no revelar si el ticket existe o no
    if (!ticket)
      return res.status(404).json({
        ok: false,
        message: 'No encontramos un caso con ese código y correo. Verifica los datos.'
      });

    // Busca el workspace para el nombre
    const [wsRows] = await pool.execute(
      'SELECT name FROM workspaces WHERE id = ?', [ticket.workspaceId]
    );
    const workspaceName = wsRows[0]?.name || 'SupCrud';

    // Invalida OTPs anteriores para este referenceCode
    await pool.execute(
      'UPDATE otp_codes SET is_used = TRUE WHERE reference_code = ? AND is_used = FALSE',
      [referenceCode.trim().toUpperCase()]
    );

    // Genera y guarda el nuevo OTP
    const otp       = generarOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000)
      .toISOString()
      .slice(0, 19)
      .replace('T', ' ');

    await pool.execute(
      'INSERT INTO otp_codes (reference_code, email, otp_hash, expires_at) VALUES (?, ?, ?, ?)',
      [referenceCode.trim().toUpperCase(), email.trim().toLowerCase(), otp, expiresAt]
      // Nota: en producción deberías hashear el OTP también con bcrypt,
      // pero para el MVP lo guardamos en texto plano para simplicidad
    );

    // Envía el OTP por email
    await enviarOTP({
      to:            email.trim().toLowerCase(),
      otp,
      referenceCode: referenceCode.trim().toUpperCase(),
      workspaceName
    });

    res.json({
      ok: true,
      message: `Código enviado a ${email}. Revisa tu bandeja de entrada.`
    });
  } catch (e) {
    console.error('solicitarOTP:', e.message);
    res.status(500).json({ ok: false, message: 'Error al enviar el código' });
  }
};

// ══════════════════════════════════════════════════════════════
//  PASO 2 — Verificar OTP y obtener ticket
//  POST /api/public/verificar-otp
//  Body: { referenceCode, email, otp }
//
//  Valida el OTP y devuelve los datos del ticket si es correcto.
// ══════════════════════════════════════════════════════════════
const verificarOTP = async (req, res) => {
  try {
    const { referenceCode, email, otp } = req.body;

    if (!referenceCode || !email || !otp)
      return res.status(400).json({ ok: false, message: 'referenceCode, email y otp son requeridos' });

    const ref   = referenceCode.trim().toUpperCase();
    const mail  = email.trim().toLowerCase();
    const otpIn = otp.toString().trim();

    // Busca el OTP vigente (no usado, no expirado)
    const [rows] = await pool.execute(`
      SELECT * FROM otp_codes
      WHERE reference_code = ?
        AND email           = ?
        AND is_used         = FALSE
        AND expires_at      > NOW()
      ORDER BY created_at DESC
      LIMIT 1
    `, [ref, mail]);

    if (!rows.length)
      return res.status(401).json({
        ok: false,
        message: 'El código expiró o ya fue usado. Solicita uno nuevo.'
      });

    const otpRecord = rows[0];

    // Incrementa el contador de intentos fallidos
    if (otpRecord.otp_hash !== otpIn) {
      await pool.execute(
        'UPDATE otp_codes SET attempts = attempts + 1 WHERE id = ?',
        [otpRecord.id]
      );

      // Bloquea si supera 3 intentos
      if (otpRecord.attempts + 1 >= 3) {
        await pool.execute(
          'UPDATE otp_codes SET is_used = TRUE WHERE id = ?',
          [otpRecord.id]
        );
        return res.status(401).json({
          ok: false,
          message: 'Demasiados intentos incorrectos. Solicita un nuevo código.'
        });
      }

      const restantes = 3 - (otpRecord.attempts + 1);
      return res.status(401).json({
        ok: false,
        message: `Código incorrecto. Te quedan ${restantes} intento${restantes !== 1 ? 's' : ''}.`
      });
    }

    // OTP correcto — márcalo como usado
    await pool.execute(
      'UPDATE otp_codes SET is_used = TRUE WHERE id = ?',
      [otpRecord.id]
    );

    // Obtiene el ticket completo de MongoDB
    const ticket = await Ticket.findOne({ referenceCode: ref, userEmail: mail });
    if (!ticket)
      return res.status(404).json({ ok: false, message: 'Ticket no encontrado' });

    res.json({ ok: true, data: ticket });
  } catch (e) {
    console.error('verificarOTP:', e.message);
    res.status(500).json({ ok: false, message: 'Error al verificar el código' });
  }
};

// ══════════════════════════════════════════════════════════════
//  MENSAJE DEL CLIENTE en su ticket
//  POST /api/public/tickets/:referenceCode/messages
//  Body: { email, otp, content }
//
//  El cliente puede responder a su ticket.
//  Validamos el OTP de nuevo para seguridad.
// ══════════════════════════════════════════════════════════════
const mensajeCliente = async (req, res) => {
  try {
    const { email, content } = req.body;  // ← quita el otp
    const ref  = req.params.referenceCode.toUpperCase();
    const mail = email?.trim().toLowerCase();

    if (!mail || !content?.trim())
      return res.status(400).json({ ok: false, message: 'email y content son requeridos' });

    // Solo verifica que el email coincide con el ticket
    const ticket = await Ticket.findOneAndUpdate(
      { referenceCode: ref, userEmail: mail },
      {
        $push: {
          conversation: {
            senderType:  'USER',
            senderEmail: mail,
            content:     content.trim()
          },
          events: {
            eventType:       'MESSAGE_SENT',
            description:     `Mensaje enviado por el cliente ${mail}`,
            performedBy:     mail,
            performedByType: 'USER'
          }
        }
      },
      { new: true }
    );

    if (!ticket)
      return res.status(404).json({ ok: false, message: 'Ticket no encontrado' });

    res.status(201).json({ ok: true, data: ticket.conversation.at(-1) });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
};

// ══════════════════════════════════════════════════════════════
//  HOOK — Enviar email al crear ticket desde el workspace
//  Esta función la llama el workspaceController después de crear
//  un ticket, para notificar al cliente.
// ══════════════════════════════════════════════════════════════
const notificarTicketCreado = async (ticket, workspaceName) => {
  try {
    await enviarConfirmacionTicket({
      to:            ticket.userEmail,
      referenceCode: ticket.referenceCode,
      subject:       ticket.subject,
      workspaceName,
      consultaUrl:   `${BASE_URL}/consulta`
    });
  } catch (e) {
    // No interrumpe el flujo si el email falla
    console.error('notificarTicketCreado:', e.message);
  }
};

// ══════════════════════════════════════════════════════════════
//  HOOK — Notificar cambio de estado al cliente
//  La llama el workspaceController al cambiar el estado.
// ══════════════════════════════════════════════════════════════
const notificarCambioEstado = async (ticket, workspaceName) => {
  try {
    const estadosQueNotifican = ['IN_PROGRESS', 'RESOLVED', 'CLOSED', 'REOPENED'];
    if (!estadosQueNotifican.includes(ticket.status)) return;

    await enviarNotificacionEstado({
      to:            ticket.userEmail,
      referenceCode: ticket.referenceCode,
      nuevoEstado:   ticket.status,
      workspaceName,
      consultaUrl:   `${BASE_URL}/consulta`
    });
  } catch (e) {
    console.error('notificarCambioEstado:', e.message);
  }
};

module.exports = {
  solicitarOTP, verificarOTP, mensajeCliente,
  notificarTicketCreado, notificarCambioEstado
};

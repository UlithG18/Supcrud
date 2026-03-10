// controllers/widgetController.js
// Crea tickets desde el widget embebible.
// No requiere autenticación — el workspace se identifica por su workspace_key.

const { pool }  = require('../config/mysql');
const Ticket    = require('../models/Ticket');
const { notificarTicketCreado } = require('./publicController');

const makeRefCode = (workspaceKey) => {
  const clean = workspaceKey.replace(/-/g, '').toUpperCase().substring(0, 8);
  return `REF-${clean}-${Date.now()}`;
};

// ══════════════════════════════════════════════════════════════
//  CREAR TICKET DESDE WIDGET
//  POST /api/public/widget/ticket
//  Body: { workspaceKey, userEmail, userName, subject, description, type, priority }
//
//  El cliente no necesita cuenta — se identifica solo con su email.
//  El workspace se valida por su workspace_key público.
// ══════════════════════════════════════════════════════════════
const crearTicketWidget = async (req, res) => {
  try {
    const { workspaceKey, userEmail, userName, subject, description, type, priority } = req.body;

    if (!workspaceKey || !userEmail || !subject || !description || !type)
      return res.status(400).json({
        ok: false,
        message: 'workspaceKey, userEmail, subject, description y type son requeridos'
      });

    // Busca el workspace por su key y verifica que esté activo
    const [wsRows] = await pool.execute(
      "SELECT id, name, workspace_key FROM workspaces WHERE workspace_key = ? AND status = 'ACTIVE'",
      [workspaceKey.toUpperCase()]
    );

    if (!wsRows.length)
      return res.status(404).json({
        ok: false,
        message: 'Workspace no encontrado o inactivo'
      });

    const workspace = wsRows[0];

    // Crea el ticket en MongoDB
    const ticket = new Ticket({
      referenceCode: makeRefCode(workspace.workspace_key),
      workspaceId:   workspace.id,
      workspaceKey:  workspace.workspace_key,
      subject:       subject.trim(),
      description:   description.trim(),
      type,
      userEmail:     userEmail.trim().toLowerCase(),
      userName:      userName?.trim() || null,
      priority:      priority || 'MEDIUM',
      events: [{
        eventType:       'TICKET_CREATED',
        description:     `Ticket creado desde el widget por ${userEmail}`,
        performedBy:     userEmail.trim().toLowerCase(),
        performedByType: 'USER'
      }]
    });

    await ticket.save();

    // Envía email de confirmación al cliente con su referenceCode
    notificarTicketCreado(ticket, workspace.name);

    res.status(201).json({
      ok: true,
      message: 'Solicitud enviada. Revisa tu correo para ver tu código de referencia.',
      data: {
        referenceCode: ticket.referenceCode,
        subject:       ticket.subject,
        status:        ticket.status
      }
    });
  } catch (e) {
    console.error('crearTicketWidget:', e.message);
    res.status(500).json({ ok: false, message: 'Error al crear la solicitud' });
  }
};

module.exports = { crearTicketWidget };

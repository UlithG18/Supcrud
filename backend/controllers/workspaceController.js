// controllers/workspaceController.js
// ADMIN → acceso total al workspace
// AGENT → solo ve y responde sus tickets asignados

const { pool } = require('../config/mysql');
const Ticket   = require('../models/Ticket');
const { enviarConfirmacionTicket, enviarNotificacionEstado } = require('../services/emailService');

const makeRefCode = (workspaceKey) => {
  const clean = workspaceKey.replace(/-/g, '').toUpperCase().substring(0, 8);
  return `REF-${clean}-${Date.now()}`;
};

// ══════════════════════════════════════════════════════════════
//  DASHBOARD
//  ADMIN → métricas globales del workspace
//  AGENT → solo métricas de sus tickets asignados
// ══════════════════════════════════════════════════════════════
const getDashboard = async (req, res) => {
  try {
    const { workspaceId, role, id: userId } = req.user;

    const filtroBase = role === 'AGENT'
      ? { workspaceId, assignedAgentId: userId }
      : { workspaceId };

    const [total, abiertos, enProgreso, resueltos, cerrados] = await Promise.all([
      Ticket.countDocuments(filtroBase),
      Ticket.countDocuments({ ...filtroBase, status: 'OPEN' }),
      Ticket.countDocuments({ ...filtroBase, status: 'IN_PROGRESS' }),
      Ticket.countDocuments({ ...filtroBase, status: 'RESOLVED' }),
      Ticket.countDocuments({ ...filtroBase, status: 'CLOSED' })
    ]);

    const [[{ total_miembros }]] = await pool.execute(
      'SELECT COUNT(*) AS total_miembros FROM workspace_members WHERE workspace_id = ? AND is_active = TRUE',
      [workspaceId]
    );

    const recientes = await Ticket.find(filtroBase)
      .select('referenceCode subject type status priority createdAt userEmail')
      .sort({ createdAt: -1 })
      .limit(5);

    res.json({
      ok: true,
      data: { total, abiertos, enProgreso, resueltos, cerrados, total_miembros, recientes }
    });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
};

// ══════════════════════════════════════════════════════════════
//  TICKETS — Listado
//  ADMIN → ve todos los tickets del workspace con filtros
//  AGENT → solo ve los tickets que tiene asignados
// ══════════════════════════════════════════════════════════════
const getTickets = async (req, res) => {
  try {
    const { workspaceId, role, id: userId } = req.user;
    const { status, type, priority, search, page = 1, limit = 10 } = req.query;

    const filter = role === 'AGENT'
      ? { workspaceId, assignedAgentId: userId }
      : { workspaceId };

    if (status)   filter.status   = status;
    if (type)     filter.type     = type;
    if (priority) filter.priority = priority;
    if (search) {
      filter.$or = [
        { subject:   { $regex: search, $options: 'i' } },
        { userEmail: { $regex: search, $options: 'i' } }
      ];
    }

    const skip    = (parseInt(page) - 1) * parseInt(limit);
    const total   = await Ticket.countDocuments(filter);
    const tickets = await Ticket.find(filter)
      .select('-conversation -events -attachments')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json({
      ok: true,
      data: tickets,
      pagination: {
        total,
        page:       parseInt(page),
        limit:      parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
        hasNext:    parseInt(page) < Math.ceil(total / parseInt(limit)),
        hasPrev:    parseInt(page) > 1
      }
    });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
};

// ══════════════════════════════════════════════════════════════
//  TICKET DETALLE
//  AGENT → solo puede ver tickets que le están asignados
// ══════════════════════════════════════════════════════════════
const getTicketDetalle = async (req, res) => {
  try {
    const { workspaceId, role, id: userId } = req.user;

    const filtro = { referenceCode: req.params.referenceCode, workspaceId };
    if (role === 'AGENT') filtro.assignedAgentId = userId;

    const ticket = await Ticket.findOne(filtro);
    if (!ticket)
      return res.status(404).json({ ok: false, message: 'Ticket no encontrado o sin acceso' });

    res.json({ ok: true, data: ticket });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
};

// ══════════════════════════════════════════════════════════════
//  CREAR TICKET — Solo ADMIN
// ══════════════════════════════════════════════════════════════
const crearTicket = async (req, res) => {
  try {
    const { subject, description, type, userEmail, priority, category } = req.body;
    const { workspaceId, workspaceKey } = req.user;

    if (!subject || !description || !type || !userEmail)
      return res.status(400).json({ ok: false, message: 'subject, description, type y userEmail son requeridos' });

    const ticket = new Ticket({
      referenceCode: makeRefCode(workspaceKey),
      workspaceId,
      workspaceKey,
      subject,
      description,
      type,
      userEmail:  userEmail.toLowerCase(),
      priority:   priority || 'MEDIUM',
      category:   category || null,
      events: [{
        eventType:       'TICKET_CREATED',
        description:     `Ticket creado por admin ${req.user.email}`,
        performedBy:     req.user.email,
        performedByType: 'AGENT'
      }]
    });

    await ticket.save();

    // Notifica al cliente por email
    try {
      const [ws] = await pool.execute('SELECT name FROM workspaces WHERE id = ?', [workspaceId]);
      const workspaceName = ws[0]?.name || 'SupCrud';
      const consultaUrl   = `${process.env.BASE_URL}/consulta`;
      await enviarConfirmacionTicket({
        to:            userEmail.toLowerCase(),
        referenceCode: ticket.referenceCode,
        subject:       ticket.subject,
        workspaceName,
        consultaUrl
      });
    } catch (emailErr) {
      console.error('Email confirmacion ticket:', emailErr.message);
    }

    res.status(201).json({ ok: true, message: 'Ticket creado', data: ticket });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
};

// ══════════════════════════════════════════════════════════════
//  ACTUALIZAR TICKET
//  AGENT → solo puede cambiar el estado de sus tickets
//  ADMIN → puede cambiar todo y reasignar agentes
// ══════════════════════════════════════════════════════════════
const actualizarTicket = async (req, res) => {
  try {
    const { role, id: userId, workspaceId } = req.user;
    const { status, priority, category, assignedAgentId, assignedAgentName } = req.body;

    // AGENT no puede reasignar ni cambiar prioridad/categoría
    if (role === 'AGENT' && (assignedAgentId || priority || category)) {
      return res.status(403).json({
        ok: false,
        message: 'Los agentes solo pueden cambiar el estado del ticket'
      });
    }

    const filtro = { referenceCode: req.params.referenceCode, workspaceId };
    if (role === 'AGENT') filtro.assignedAgentId = userId;

    const ticket = await Ticket.findOne(filtro);
    if (!ticket)
      return res.status(404).json({ ok: false, message: 'Ticket no encontrado o sin acceso' });

    const prevStatus = ticket.status;

    if (status)            ticket.status            = status;
    if (priority)          ticket.priority          = priority;
    if (category)          ticket.category          = category;
    if (assignedAgentId)   ticket.assignedAgentId   = assignedAgentId;
    if (assignedAgentName) ticket.assignedAgentName = assignedAgentName;

    if (status && status !== prevStatus) {
      ticket.events.push({
        eventType:       'STATUS_CHANGED',
        description:     `Estado cambiado de ${prevStatus} a ${status}`,
        performedBy:     req.user.email,
        performedByType: 'AGENT',
        previousValue:   prevStatus,
        newValue:        status
      });
    }

    if (assignedAgentId) {
      ticket.events.push({
        eventType:       'AGENT_ASSIGNED',
        description:     `Ticket asignado a ${assignedAgentName}`,
        performedBy:     req.user.email,
        performedByType: 'AGENT'
      });
    }

    await ticket.save();

    // Notifica al cliente si el estado cambió
    if (status && status !== prevStatus && status !== 'OPEN') {
      try {
        const [ws] = await pool.execute('SELECT name FROM workspaces WHERE id = ?', [ticket.workspaceId]);
        const workspaceName = ws[0]?.name || 'SupCrud';
        const consultaUrl   = `${process.env.BASE_URL}/consulta`;
        await enviarNotificacionEstado({
          to:            ticket.userEmail,
          referenceCode: ticket.referenceCode,
          nuevoEstado:   status,
          workspaceName,
          consultaUrl
        });
      } catch (emailErr) {
        console.error('Email notificacion estado:', emailErr.message);
      }
    }

    res.json({ ok: true, message: 'Ticket actualizado', data: ticket });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
};

// ══════════════════════════════════════════════════════════════
//  AGREGAR MENSAJE — ambos roles pueden responder
//  AGENT → solo en sus tickets asignados
// ══════════════════════════════════════════════════════════════
const agregarMensaje = async (req, res) => {
  try {
    const { content } = req.body;
    if (!content?.trim())
      return res.status(400).json({ ok: false, message: 'El mensaje no puede estar vacío' });

    const { workspaceId, role, id: userId } = req.user;
    const filtro = { referenceCode: req.params.referenceCode, workspaceId };
    if (role === 'AGENT') filtro.assignedAgentId = userId;

    const ticket = await Ticket.findOneAndUpdate(
      filtro,
      {
        $push: {
          conversation: {
            senderType:  'AGENT',
            senderEmail: req.user.email,
            content:     content.trim()
          },
          events: {
            eventType:       'MESSAGE_SENT',
            description:     `Mensaje enviado por ${req.user.email}`,
            performedBy:     req.user.email,
            performedByType: 'AGENT'
          }
        }
      },
      { new: true }
    );

    if (!ticket)
      return res.status(404).json({ ok: false, message: 'Ticket no encontrado o sin acceso' });

    res.status(201).json({ ok: true, data: ticket.conversation.at(-1) });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
};

// ══════════════════════════════════════════════════════════════
//  EQUIPO — ambos roles lo ven
// ══════════════════════════════════════════════════════════════
const getEquipo = async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT wm.id, wm.role, wm.joined_at, wm.is_active AS member_active,
             u.id AS user_id, u.email, u.full_name, u.is_active
      FROM workspace_members wm
      JOIN users u ON wm.user_id = u.id
      WHERE wm.workspace_id = ?
      ORDER BY wm.is_active DESC, wm.role, u.full_name
    `, [req.user.workspaceId]);
    res.json({ ok: true, data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
};

// ══════════════════════════════════════════════════════════════
//  SUSPENDER / REACTIVAR MIEMBRO DEL WORKSPACE
//  PATCH /api/workspace/equipo/:userId/toggle
//  Solo ADMIN — afecta únicamente a su workspace
// ══════════════════════════════════════════════════════════════
const toggleMiembro = async (req, res) => {
  try {
    const { workspaceId, id: adminId } = req.user;

    // No permitir que el ADMIN se suspenda a sí mismo
    if (parseInt(req.params.userId) === adminId)
      return res.status(400).json({ ok: false, message: 'No puedes suspenderte a ti mismo' });

    const [rows] = await pool.execute(
      'SELECT id, is_active FROM workspace_members WHERE workspace_id = ? AND user_id = ?',
      [workspaceId, req.params.userId]
    );
    if (!rows.length)
      return res.status(404).json({ ok: false, message: 'Miembro no encontrado en este workspace' });

    const nuevoEstado = !rows[0].is_active;
    await pool.execute(
      'UPDATE workspace_members SET is_active = ? WHERE id = ?',
      [nuevoEstado, rows[0].id]
    );

    res.json({
      ok: true,
      message: `Miembro ${nuevoEstado ? 'reactivado' : 'suspendido'} correctamente`,
      is_active: nuevoEstado
    });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
};

// ══════════════════════════════════════════════════════════════
//  ELIMINAR MIEMBRO DEL WORKSPACE
//  DELETE /api/workspace/equipo/:userId
//  Solo ADMIN — elimina la membresía del usuario en su workspace
//  El usuario sigue existiendo globalmente (no se borra de users)
// ══════════════════════════════════════════════════════════════
const eliminarMiembro = async (req, res) => {
  try {
    const { workspaceId, id: adminId } = req.user;

    // No permitir que el ADMIN se elimine a sí mismo
    if (parseInt(req.params.userId) === adminId)
      return res.status(400).json({ ok: false, message: 'No puedes eliminarte a ti mismo del workspace' });

    const [rows] = await pool.execute(
      'SELECT id, role FROM workspace_members WHERE workspace_id = ? AND user_id = ?',
      [workspaceId, req.params.userId]
    );
    if (!rows.length)
      return res.status(404).json({ ok: false, message: 'Miembro no encontrado en este workspace' });

    // Elimina preferencias del agente en este workspace
    await pool.execute(
      'DELETE FROM workspace_agent_preferences WHERE workspace_id = ? AND user_id = ?',
      [workspaceId, req.params.userId]
    );
    // Elimina la membresía
    await pool.execute('DELETE FROM workspace_members WHERE id = ?', [rows[0].id]);

    res.json({ ok: true, message: 'Miembro eliminado del workspace correctamente' });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
};

module.exports = {
  getDashboard, getTickets, getTicketDetalle,
  crearTicket, actualizarTicket, agregarMensaje, getEquipo, toggleMiembro, eliminarMiembro
};

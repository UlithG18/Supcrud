// controllers/addonController.js
// Maneja las funcionalidades de los addons:
//   - ATTACHMENTS: subida de archivos a tickets
//   - AI_ASSIST:   sugerencias de respuesta con IA

const { pool }          = require('../config/mysql');
const Ticket            = require('../models/Ticket');
const { subirArchivo }  = require('../services/cloudinaryService');
const { sugerirRespuesta } = require('../services/groqService');

// ── Helper: verifica si un addon está activo en el workspace ──
const addonActivo = async (workspaceId, addonCode) => {
  const [rows] = await pool.execute(`
    SELECT aa.is_active
    FROM addon_activations aa
    JOIN addons a ON aa.addon_id = a.id
    WHERE aa.workspace_id = ? AND a.code = ? AND aa.is_active = TRUE AND a.is_available = TRUE
  `, [workspaceId, addonCode]);
  return rows.length > 0;
};

// ══════════════════════════════════════════════════════════════
//  SUBIR ADJUNTO A UN TICKET
//  POST /api/workspace/tickets/:referenceCode/attachments
//  Requiere addon ATTACHMENTS activo en el workspace
// ══════════════════════════════════════════════════════════════
const subirAdjunto = async (req, res) => {
  try {
    const { workspaceId, workspaceKey, role, id: userId } = req.user;

    // Verifica que el addon ATTACHMENTS está activo
    const activo = await addonActivo(workspaceId, 'ATTACHMENTS');
    if (!activo)
      return res.status(403).json({
        ok: false,
        message: 'El addon de adjuntos no está activo en este workspace'
      });

    if (!req.file)
      return res.status(400).json({ ok: false, message: 'No se recibió ningún archivo' });

    // Busca el ticket
    const filtro = { referenceCode: req.params.referenceCode, workspaceId };
    if (role === 'AGENT') filtro.assignedAgentId = userId;

    const ticket = await Ticket.findOne(filtro);
    if (!ticket)
      return res.status(404).json({ ok: false, message: 'Ticket no encontrado' });

    // Sube a Cloudinary
    const resultado = await subirArchivo(
      req.file.buffer,
      req.file.mimetype,
      workspaceKey,
      ticket.referenceCode
    );

    // Guarda el adjunto en el ticket
    const adjunto = {
      url:          resultado.url,
      publicId:     resultado.publicId,
      filename:     req.file.originalname,
      mimetype:     req.file.mimetype,
      size:         resultado.size,
      resourceType: resultado.resourceType,
      uploadedBy:   req.user.email,
      uploadedByType: 'AGENT'
    };

    ticket.attachments.push(adjunto);
    ticket.events.push({
      eventType:       'ATTACHMENT_ADDED',
      description:     `Archivo adjuntado por ${req.user.email}: ${req.file.originalname}`,
      performedBy:     req.user.email,
      performedByType: 'AGENT'
    });

    await ticket.save();

    res.status(201).json({
      ok:   true,
      message: 'Archivo adjuntado correctamente',
      data: adjunto
    });
  } catch (e) {
    console.error('subirAdjunto:', e.message);
    res.status(500).json({ ok: false, message: e.message });
  }
};

// ══════════════════════════════════════════════════════════════
//  SUGERENCIA DE RESPUESTA CON IA
//  GET /api/workspace/tickets/:referenceCode/ai-suggest
//  Requiere addon AI_ASSIST activo en el workspace
// ══════════════════════════════════════════════════════════════
const sugerirIA = async (req, res) => {
  try {
    const { workspaceId, role, id: userId } = req.user;

    // Verifica que el addon AI_ASSIST está activo
    const activo = await addonActivo(workspaceId, 'AI_ASSIST');
    if (!activo)
      return res.status(403).json({
        ok: false,
        message: 'El addon de IA no está activo en este workspace'
      });

    // Busca el ticket completo (necesita la conversación para contexto)
    const filtro = { referenceCode: req.params.referenceCode, workspaceId };
    if (role === 'AGENT') filtro.assignedAgentId = userId;

    const ticket = await Ticket.findOne(filtro);
    if (!ticket)
      return res.status(404).json({ ok: false, message: 'Ticket no encontrado' });

    // Genera la sugerencia
    const sugerencia = await sugerirRespuesta(ticket);

    res.json({ ok: true, data: { sugerencia } });
  } catch (e) {
    console.error('sugerirIA:', e.message);
    res.status(500).json({ ok: false, message: 'Error al generar la sugerencia' });
  }
};

// ══════════════════════════════════════════════════════════════
//  CONSULTAR ADDONS ACTIVOS DEL WORKSPACE
//  GET /api/workspace/addons
//  El frontend usa esto para saber qué botones mostrar
// ══════════════════════════════════════════════════════════════
const getAddonsActivos = async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT a.code, a.name, aa.is_active
      FROM addon_activations aa
      JOIN addons a ON aa.addon_id = a.id
      WHERE aa.workspace_id = ? AND aa.is_active = TRUE AND a.is_available = TRUE
    `, [req.user.workspaceId]);

    // Devuelve un objeto simple { ATTACHMENTS: true, AI_ASSIST: true, ... }
    const activos = {};
    rows.forEach(r => { activos[r.code] = true; });

    res.json({ ok: true, data: activos });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
};


// ══════════════════════════════════════════════════════════════
//  SUBIR ADJUNTO DESDE CONSULTA PÚBLICA O WIDGET
//  POST /api/public/tickets/:referenceCode/attachments
//  El cliente no tiene token — se valida que el email coincide
//  con el dueño del ticket.
// ══════════════════════════════════════════════════════════════
async function subirAdjuntoPublico(req, res) {
  try {
    const { email } = req.body;
    const ref       = req.params.referenceCode.toUpperCase();

    if (!email)
      return res.status(400).json({ ok: false, message: 'El email es requerido' });

    if (!req.file)
      return res.status(400).json({ ok: false, message: 'No se recibió ningún archivo' });

    // Busca el ticket validando que el email coincide con el dueño
    const ticket = await Ticket.findOne({
      referenceCode: ref,
      userEmail:     email.trim().toLowerCase()
    });

    if (!ticket)
      return res.status(404).json({
        ok: false,
        message: 'Ticket no encontrado o el correo no coincide'
      });

    // Verifica que el addon ATTACHMENTS esté activo en el workspace
    const activo = await addonActivo(ticket.workspaceId, 'ATTACHMENTS');
    if (!activo)
      return res.status(403).json({
        ok: false,
        message: 'Este workspace no tiene habilitado el envío de archivos'
      });

    // Sube a Cloudinary
    const resultado = await subirArchivo(
      req.file.buffer,
      req.file.mimetype,
      ticket.workspaceKey,
      ticket.referenceCode
    );

    const adjunto = {
      url:            resultado.url,
      publicId:       resultado.publicId,
      filename:       req.file.originalname,
      mimetype:       req.file.mimetype,
      size:           resultado.size,
      resourceType:   resultado.resourceType,
      uploadedBy:     email.trim().toLowerCase(),
      uploadedByType: 'USER'
    };

    ticket.attachments.push(adjunto);
    ticket.events.push({
      eventType:       'ATTACHMENT_ADDED',
      description:     `Archivo adjuntado por el cliente: ${req.file.originalname}`,
      performedBy:     email.trim().toLowerCase(),
      performedByType: 'USER'
    });

    await ticket.save();

    res.status(201).json({
      ok:   true,
      message: 'Archivo adjuntado correctamente',
      data: adjunto
    });
  } catch (e) {
    console.error('subirAdjuntoPublico:', e.message);
    res.status(500).json({ ok: false, message: e.message });
  }
}

// ══════════════════════════════════════════════════════════════
//  ADDONS ACTIVOS PÚBLICOS — para el widget
//  GET /api/public/workspace-addons/:workspaceKey
//  No requiere token. Solo devuelve qué addons están activos.
// ══════════════════════════════════════════════════════════════
const getAddonsActivosPublico = async (req, res) => {
  try {
    const [wsRows] = await pool.execute(
      "SELECT id FROM workspaces WHERE workspace_key = ? AND status = 'ACTIVE'",
      [req.params.workspaceKey.toUpperCase()]
    );
    if (!wsRows.length)
      return res.status(404).json({ ok: false, message: 'Workspace no encontrado' });

    const [rows] = await pool.execute(`
      SELECT a.code
      FROM addon_activations aa
      JOIN addons a ON aa.addon_id = a.id
      WHERE aa.workspace_id = ? AND aa.is_active = TRUE AND a.is_available = TRUE
    `, [wsRows[0].id]);

    const activos = {};
    rows.forEach(r => { activos[r.code] = true; });

    res.json({ ok: true, data: activos });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
};

module.exports = { subirAdjunto, sugerirIA, getAddonsActivos, subirAdjuntoPublico, getAddonsActivosPublico };

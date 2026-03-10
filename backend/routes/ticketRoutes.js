// routes/ticketRoutes.js
// CRUD de tickets en MongoDB + importación desde CSV.

const express      = require('express');
const router       = express.Router();
const Ticket       = require('../models/Ticket');
const upload       = require('../middlewares/upload');
const parseCSVBuffer = require('../utils/parseCSV');

// Helper: genera referenceCode único
// Formato: REF-{WORKSPACEKEY_SIN_GUIONES}-{TIMESTAMP}
const makeRefCode = (workspaceKey) => {
  const clean = workspaceKey.replace(/-/g, '').toUpperCase().substring(0, 8);
  return `REF-${clean}-${Date.now()}`;
};

// ──────────────────────────────────────────────────────────────
// POST /tickets → Crear un ticket
// Body:
// {
//   "workspaceKey": "WS-TIENDA-001",
//   "workspaceId": 1,
//   "subject": "No llegó mi pedido",
//   "description": "Llevo 10 días esperando y no hay respuesta.",
//   "type": "R",
//   "userEmail": "cliente@email.com"
// }
// ──────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { workspaceKey, workspaceId, subject, description, type, userEmail } = req.body;

    const ticket = new Ticket({
      referenceCode: makeRefCode(workspaceKey),
      workspaceId,
      workspaceKey,
      subject,
      description,
      type,
      userEmail,
      events: [{
        eventType:   'TICKET_CREATED',
        description: `Ticket creado por ${userEmail}`,
        performedBy: userEmail
      }]
    });

    await ticket.save();
    res.status(201).json({ ok: true, data: ticket });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ──────────────────────────────────────────────────────────────
// GET /tickets → Listar tickets
// Query params opcionales: workspaceId, status, type, priority
// Ej: GET /tickets?workspaceId=1&status=OPEN&type=R
// ──────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const filter = {};
    if (req.query.workspaceId) filter.workspaceId = parseInt(req.query.workspaceId);
    if (req.query.status)      filter.status      = req.query.status;
    if (req.query.type)        filter.type        = req.query.type;
    if (req.query.priority)    filter.priority    = req.query.priority;

    const tickets = await Ticket.find(filter)
      .select('-conversation -events -attachments') // Excluye arrays pesados en el listado
      .sort({ createdAt: -1 });

    res.json({ ok: true, total: tickets.length, data: tickets });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ──────────────────────────────────────────────────────────────
// GET /tickets/:referenceCode → Ver ticket completo con todo
// ──────────────────────────────────────────────────────────────
router.get('/:referenceCode', async (req, res) => {
  try {
    const ticket = await Ticket.findOne({ referenceCode: req.params.referenceCode });
    if (!ticket) return res.status(404).json({ ok: false, error: 'Ticket no encontrado' });
    res.json({ ok: true, data: ticket });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ──────────────────────────────────────────────────────────────
// PUT /tickets/:referenceCode → Actualizar campos del ticket
// Body: { status, priority, category, assignedAgentId, assignedAgentName }
// ──────────────────────────────────────────────────────────────
router.put('/:referenceCode', async (req, res) => {
  try {
    const { status, priority, category, assignedAgentId, assignedAgentName } = req.body;

    const ticket = await Ticket.findOne({ referenceCode: req.params.referenceCode });
    if (!ticket) return res.status(404).json({ ok: false, error: 'Ticket no encontrado' });

    const prevStatus = ticket.status;

    if (status)            ticket.status            = status;
    if (priority)          ticket.priority          = priority;
    if (category)          ticket.category          = category;
    if (assignedAgentId)   ticket.assignedAgentId   = assignedAgentId;
    if (assignedAgentName) ticket.assignedAgentName = assignedAgentName;

    // Registra el cambio en el historial de eventos
    ticket.events.push({
      eventType:   'STATUS_CHANGED',
      description: `Estado cambiado de ${prevStatus} a ${status || prevStatus}`,
      performedBy: 'AGENT'
    });

    await ticket.save();
    res.json({ ok: true, data: ticket });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ──────────────────────────────────────────────────────────────
// POST /tickets/:referenceCode/messages → Agregar mensaje
// Body: { senderType: "AGENT", senderEmail: "...", content: "..." }
// ──────────────────────────────────────────────────────────────
router.post('/:referenceCode/messages', async (req, res) => {
  try {
    const { senderType, senderEmail, content } = req.body;

    // $push agrega al array sin reemplazar el documento completo
    const ticket = await Ticket.findOneAndUpdate(
      { referenceCode: req.params.referenceCode },
      {
        $push: {
          conversation: { senderType, senderEmail, content },
          events: {
            eventType:   'MESSAGE_SENT',
            description: `Mensaje enviado por ${senderEmail}`,
            performedBy: senderEmail
          }
        }
      },
      { new: true } // Devuelve el documento YA actualizado
    );

    if (!ticket) return res.status(404).json({ ok: false, error: 'Ticket no encontrado' });
    res.status(201).json({ ok: true, data: ticket.conversation.at(-1) });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ──────────────────────────────────────────────────────────────
// DELETE /tickets/:referenceCode → Eliminar ticket
// ──────────────────────────────────────────────────────────────
router.delete('/:referenceCode', async (req, res) => {
  try {
    const result = await Ticket.findOneAndDelete({ referenceCode: req.params.referenceCode });
    if (!result) return res.status(404).json({ ok: false, error: 'Ticket no encontrado' });
    res.json({ ok: true, message: 'Ticket eliminado' });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ──────────────────────────────────────────────────────────────
// POST /tickets/import → Importar tickets desde CSV
//
// En Postman: Body → form-data → key: "file" (tipo File) → tu .csv
//
// Ejemplo de CSV:
//   workspaceKey,workspaceId,subject,description,type,userEmail,priority,category
//   WS-TIENDA-001,1,Pedido no llegó,Llevo 10 días esperando,R,cliente1@email.com,HIGH,envíos
//   WS-TIENDA-001,1,Solicito factura,Necesito factura del mes,P,cliente2@email.com,LOW,facturación
//   WS-CLINICA-002,2,Cita cancelada,Cancelaron sin avisar,Q,paciente@email.com,MEDIUM,citas
// ──────────────────────────────────────────────────────────────
router.post('/import', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ ok: false, error: 'Adjunta un archivo CSV con key "file"' });

    const rows     = await parseCSVBuffer(req.file.buffer);
    const inserted = [];
    const errors   = [];

    for (const row of rows) {
      try {
        const ticket = new Ticket({
          referenceCode: makeRefCode(row.workspaceKey),
          workspaceId:   parseInt(row.workspaceId),
          workspaceKey:  row.workspaceKey,
          subject:       row.subject,
          description:   row.description,
          type:          row.type,
          userEmail:     row.userEmail,
          priority:      row.priority  || 'MEDIUM',
          category:      row.category  || null,
          events: [{
            eventType:   'TICKET_CREATED',
            description: 'Ticket importado desde CSV',
            performedBy: 'CSV_IMPORT'
          }]
        });

        await ticket.save();
        inserted.push({ referenceCode: ticket.referenceCode, subject: row.subject });
      } catch (e) {
        errors.push({ fila: row, razon: e.message });
      }
    }

    res.status(201).json({
      ok: true,
      insertados: inserted.length,
      errores:    errors.length,
      detalle:    inserted,
      detalle_errores: errors
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

module.exports = router;

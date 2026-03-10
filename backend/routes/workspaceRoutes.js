// routes/workspaceRoutes.js
const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const upload  = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const { verifyToken, checkRole } = require('../middlewares/auth');
const {
  getDashboard, getTickets, getTicketDetalle,
  crearTicket, actualizarTicket, agregarMensaje, getEquipo, toggleMiembro, eliminarMiembro
} = require('../controllers/workspaceController');
const { subirAdjunto, sugerirIA, getAddonsActivos } = require('../controllers/addonController');

// Todas las rutas requieren autenticación como ADMIN o AGENT
router.use(verifyToken);
router.use(checkRole('ADMIN', 'AGENT'));

// Dashboard
router.get('/dashboard', getDashboard);

// Tickets
router.get('/tickets',                          getTickets);
router.get('/tickets/:referenceCode',           getTicketDetalle);
router.post('/tickets', checkRole('ADMIN'),     crearTicket);
router.put('/tickets/:referenceCode',           actualizarTicket);
router.post('/tickets/:referenceCode/messages', agregarMensaje);

// Equipo
router.get('/equipo',                                      getEquipo);
router.patch('/equipo/:userId/toggle', checkRole('ADMIN'), toggleMiembro);
router.delete('/equipo/:userId',       checkRole('ADMIN'), eliminarMiembro);

// Add-ons ─────────────────────────────────────────────────────
router.get('/addons',                                                    getAddonsActivos);
router.post('/tickets/:referenceCode/attachments', upload.single('file'), subirAdjunto);
router.get('/tickets/:referenceCode/ai-suggest',                          sugerirIA);

module.exports = router;

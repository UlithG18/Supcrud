// routes/publicRoutes.js
const express = require('express');
const router  = express.Router();
const { solicitarOTP, verificarOTP, mensajeCliente } = require('../controllers/publicController');
const { subirAdjuntoPublico, getAddonsActivosPublico } = require('../controllers/addonController');
const { crearTicketWidget }   = require('../controllers/widgetController');
const { upload }              = require('../services/cloudinaryService');

// OTP y consulta pública
router.post('/solicitar-otp',                              solicitarOTP);
router.post('/verificar-otp',                              verificarOTP);
router.post('/tickets/:referenceCode/messages',            mensajeCliente);

// Addons activos del workspace — el widget consulta esto al abrirse
// No expone info sensible, solo qué funcionalidades están habilitadas
router.get('/workspace-addons/:workspaceKey',              getAddonsActivosPublico);

// Adjunto desde consulta pública o widget
router.post('/tickets/:referenceCode/attachments',
  upload.single('file'), subirAdjuntoPublico);

// Widget
router.post('/widget/ticket', crearTicketWidget);

module.exports = router;

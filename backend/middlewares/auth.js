// middlewares/auth.js
// Protege rutas verificando el token JWT en el header Authorization.
// Uso en rutas: router.get('/ruta', verifyToken, checkRole('ADMIN'), controller)

const jwt = require('jsonwebtoken');
require('dotenv').config();

// ── Verifica que el token JWT sea válido ──────────────────────
const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader)
    return res.status(401).json({ ok: false, message: 'Token no proporcionado' });

  const token = authHeader.split(' ')[1]; // "Bearer <token>"
  if (!token)
    return res.status(401).json({ ok: false, message: 'Formato inválido. Usa: Bearer <token>' });

  try {
    // Decodifica el token y guarda los datos en req.user
    // Desde cualquier controlador puedes acceder a req.user.id, req.user.role, etc.
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ ok: false, message: 'Token inválido o expirado' });
  }
};

// ── Verifica que el usuario tenga el rol requerido ────────────
// Ejemplo: checkRole('OWNER') o checkRole('ADMIN', 'OWNER')
const checkRole = (...roles) => (req, res, next) => {
  if (!req.user)
    return res.status(401).json({ ok: false, message: 'No autenticado' });
  if (!roles.includes(req.user.role))
    return res.status(403).json({ ok: false, message: `Acceso denegado. Roles permitidos: ${roles.join(', ')}` });
  next();
};

module.exports = { verifyToken, checkRole };

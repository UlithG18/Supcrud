// routes/authRoutes.js
const express    = require('express');
const router     = express.Router();
const { verifyToken } = require('../middlewares/auth');
const {
  registerOwner, loginOwner,
  registerUser, loginUser, getMe
} = require('../controllers/authController');

// ── Owner ─────────────────────────────────────────────────────
router.post('/owner/register',         registerOwner);         // Siempre devuelve 403
router.post('/owner/login',            loginOwner);
// ── Usuarios (ADMIN / AGENT) ──────────────────────────────────
router.post('/register', registerUser);
router.post('/login',    loginUser);

// ── Perfil ────────────────────────────────────────────────────
router.get('/me', verifyToken, getMe);

module.exports = router;

// controllers/authController.js
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const { pool } = require('../config/mysql');
require('dotenv').config();

const generarToken = (payload) =>
  jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });

// ══════════════════════════════════════════════════════════════
//  REGISTRO DE OWNER — DESHABILITADO
//  El registro público ya no existe. Los owners son creados
//  exclusivamente por otro owner desde el panel de administración.
// ══════════════════════════════════════════════════════════════
const registerOwner = async (req, res) => {
  res.status(403).json({
    ok: false,
    message: 'El registro público de owners está deshabilitado. Contacta a un administrador de Crudzaso.'
  });
};

// ══════════════════════════════════════════════════════════════
//  LOGIN DE OWNER
//  POST /api/auth/owner/login
//  Si must_change_password = true, el token incluye esa bandera
//  y el frontend redirige a /owner/change-password
// ══════════════════════════════════════════════════════════════
const loginOwner = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ ok: false, message: 'email y password son requeridos' });

    const [rows] = await pool.execute(
      'SELECT * FROM owner_accounts WHERE email = ? AND is_active = TRUE',
      [email.toLowerCase()]
    );
    if (!rows.length)
      return res.status(401).json({ ok: false, message: 'Credenciales inválidas' });

    const owner = rows[0];
    const valida = await bcrypt.compare(password, owner.password_hash);
    if (!valida)
      return res.status(401).json({ ok: false, message: 'Credenciales inválidas' });

    const token = generarToken({
      id:        owner.id,
      email:     owner.email,
      full_name: owner.full_name,
      role:      'OWNER'
    });

    res.json({
      ok: true,
      message: 'Login exitoso',
      data: {
        token,
        user: {
          id:        owner.id,
          email:     owner.email,
          full_name: owner.full_name,
          role:      'OWNER'
        }
      }
    });
  } catch (e) {
    console.error('loginOwner:', e.message);
    res.status(500).json({ ok: false, message: 'Error interno del servidor' });
  }
};


// ══════════════════════════════════════════════════════════════
//  REGISTRO DE USUARIO (ADMIN / AGENT) — sigue igual
// ══════════════════════════════════════════════════════════════
const registerUser = async (req, res) => {
  try {
    const { email, password, full_name } = req.body;
    if (!email || !password || !full_name)
      return res.status(400).json({ ok: false, message: 'email, password y full_name son requeridos' });

    const [existe] = await pool.execute('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
    if (existe.length)
      return res.status(409).json({ ok: false, message: 'El email ya está registrado' });

    const password_hash = await bcrypt.hash(password, 12);
    const [result] = await pool.execute(
      'INSERT INTO users (email, password_hash, full_name) VALUES (?, ?, ?)',
      [email.toLowerCase(), password_hash, full_name]
    );

    res.status(201).json({ ok: true, message: 'Usuario registrado exitosamente', data: { id: result.insertId, email, full_name } });
  } catch (e) {
    console.error('registerUser:', e.message);
    res.status(500).json({ ok: false, message: 'Error interno del servidor' });
  }
};

// ══════════════════════════════════════════════════════════════
//  LOGIN DE USUARIO (ADMIN / AGENT) — sigue igual
// ══════════════════════════════════════════════════════════════
const loginUser = async (req, res) => {
  try {
    const { email, password, workspaceId } = req.body;
    if (!email || !password)
      return res.status(400).json({ ok: false, message: 'email y password son requeridos' });

    const [rows] = await pool.execute(
      'SELECT * FROM users WHERE email = ? AND is_active = TRUE', [email.toLowerCase()]
    );
    if (!rows.length)
      return res.status(401).json({ ok: false, message: 'Credenciales inválidas' });

    const user = rows[0];
    const valida = await bcrypt.compare(password, user.password_hash);
    if (!valida)
      return res.status(401).json({ ok: false, message: 'Credenciales inválidas' });

    const [memberships] = await pool.execute(`
      SELECT wm.workspace_id, wm.role, w.name AS workspace_name,
             w.workspace_key, w.status
      FROM workspace_members wm
      JOIN workspaces w ON wm.workspace_id = w.id
      WHERE wm.user_id = ? AND wm.is_active = TRUE AND w.status = 'ACTIVE'
    `, [user.id]);

    if (!memberships.length)
      return res.status(403).json({ ok: false, message: 'No tienes acceso a ningún workspace activo' });

    if (memberships.length > 1 && !workspaceId) {
      return res.json({
        ok: true,
        requiresWorkspaceSelection: true,
        message: 'Selecciona un workspace para continuar',
        data: {
          user: { id: user.id, email: user.email, full_name: user.full_name },
          workspaces: memberships.map(m => ({
            workspaceId:   m.workspace_id,
            workspaceName: m.workspace_name,
            workspaceKey:  m.workspace_key,
            role:          m.role
          }))
        }
      });
    }

    const ws = workspaceId
      ? memberships.find(m => m.workspace_id === parseInt(workspaceId))
      : memberships[0];

    if (!ws)
      return res.status(403).json({ ok: false, message: 'No tienes acceso a ese workspace' });

    const token = generarToken({
      id:           user.id,
      email:        user.email,
      full_name:    user.full_name,
      role:         ws.role,
      workspaceId:  ws.workspace_id,
      workspaceKey: ws.workspace_key
    });

    res.json({
      ok: true,
      message: 'Login exitoso',
      data: {
        token,
        user: {
          id:            user.id,
          email:         user.email,
          full_name:     user.full_name,
          role:          ws.role,
          workspaceId:   ws.workspace_id,
          workspaceName: ws.workspace_name,
          workspaceKey:  ws.workspace_key
        }
      }
    });
  } catch (e) {
    console.error('loginUser:', e.message);
    res.status(500).json({ ok: false, message: 'Error interno del servidor' });
  }
};

const getMe = async (req, res) => res.json({ ok: true, data: req.user });

module.exports = { registerOwner, loginOwner, registerUser, loginUser, getMe };

// controllers/ownerController.js
// Lógica del panel Owner: workspaces, usuarios, addons y métricas.

const { pool } = require('../config/mysql');

// ══════════════════════════════════════════════════════════════
//  DASHBOARD — Métricas globales
//  GET /api/owner/dashboard
// ══════════════════════════════════════════════════════════════
const getDashboard = async (req, res) => {
  try {
    const [[{ total_workspaces }]] = await pool.execute('SELECT COUNT(*) AS total_workspaces FROM workspaces');
    const [[{ total_usuarios }]]   = await pool.execute('SELECT COUNT(*) AS total_usuarios FROM users');
    const [[{ total_addons }]]     = await pool.execute('SELECT COUNT(*) AS total_addons FROM addons');
    const [[{ ws_activos }]]       = await pool.execute("SELECT COUNT(*) AS ws_activos FROM workspaces WHERE status = 'ACTIVE'");

    res.json({
      ok: true,
      data: { total_workspaces, total_usuarios, total_addons, ws_activos }
    });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
};

// ══════════════════════════════════════════════════════════════
//  WORKSPACES
// ══════════════════════════════════════════════════════════════

const getWorkspaces = async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT w.*, 
             COUNT(DISTINCT wm.user_id) AS total_miembros
      FROM workspaces w
      LEFT JOIN workspace_members wm ON w.id = wm.workspace_id AND wm.is_active = TRUE
      GROUP BY w.id
      ORDER BY w.created_at DESC
    `);
    res.json({ ok: true, data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
};

const createWorkspace = async (req, res) => {
  try {
    const { workspace_key, name, domain } = req.body;
    if (!workspace_key || !name)
      return res.status(400).json({ ok: false, message: 'workspace_key y name son requeridos' });

    const [r] = await pool.execute(
      'INSERT INTO workspaces (workspace_key, name, domain, created_by) VALUES (?, ?, ?, ?)',
      [workspace_key.toUpperCase(), name, domain || null, req.user.id]
    );
    res.status(201).json({ ok: true, message: 'Workspace creado', insertId: r.insertId });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY')
      return res.status(409).json({ ok: false, message: 'El workspace_key ya existe' });
    res.status(500).json({ ok: false, message: e.message });
  }
};

const updateWorkspace = async (req, res) => {
  try {
    const { name, domain, status } = req.body;
    const [r] = await pool.execute(
      'UPDATE workspaces SET name = ?, domain = ?, status = ? WHERE id = ?',
      [name, domain || null, status, req.params.id]
    );
    res.json({ ok: true, message: 'Workspace actualizado', affectedRows: r.affectedRows });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
};

const deleteWorkspace = async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT id, name FROM workspaces WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ ok: false, message: 'Workspace no encontrado' });

    // Elimina registros relacionados en MySQL (cascada manual)
    await pool.execute('DELETE FROM workspace_agent_preferences WHERE workspace_id = ?', [req.params.id]);
    await pool.execute('DELETE FROM addon_activations WHERE workspace_id = ?', [req.params.id]);
    await pool.execute('DELETE FROM invitations WHERE workspace_id = ?', [req.params.id]);
    await pool.execute('DELETE FROM workspace_members WHERE workspace_id = ?', [req.params.id]);
    await pool.execute('DELETE FROM workspaces WHERE id = ?', [req.params.id]);
    // Los tickets en MongoDB quedan como histórico (huérfanos intencionales)

    res.json({ ok: true, message: `Workspace "${rows[0].name}" eliminado correctamente` });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
};

const toggleWorkspaceStatus = async (req, res) => {
  try {
    // Alterna entre ACTIVE y SUSPENDED
    const [rows] = await pool.execute('SELECT status FROM workspaces WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ ok: false, message: 'Workspace no encontrado' });

    const nuevoStatus = rows[0].status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    await pool.execute('UPDATE workspaces SET status = ? WHERE id = ?', [nuevoStatus, req.params.id]);

    res.json({ ok: true, message: `Workspace ${nuevoStatus === 'ACTIVE' ? 'activado' : 'suspendido'}`, status: nuevoStatus });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
};

// ══════════════════════════════════════════════════════════════
//  USUARIOS
// ══════════════════════════════════════════════════════════════

const getUsuarios = async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT u.id, u.email, u.full_name, u.is_active, u.created_at,
             COUNT(DISTINCT wm.workspace_id) AS total_workspaces
      FROM users u
      LEFT JOIN workspace_members wm ON u.id = wm.user_id AND wm.is_active = TRUE
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `);
    res.json({ ok: true, data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
};

const toggleUsuarioStatus = async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT is_active, full_name FROM users WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ ok: false, message: 'Usuario no encontrado' });

    const nuevoEstado = !rows[0].is_active;
    await pool.execute('UPDATE users SET is_active = ? WHERE id = ?', [nuevoEstado, req.params.id]);

    res.json({
      ok: true,
      message: `Usuario ${nuevoEstado ? 'activado' : 'suspendido'} correctamente`,
      is_active: nuevoEstado
    });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
};

const updateUsuario = async (req, res) => {
  try {
    const { full_name } = req.body;
    if (!full_name) return res.status(400).json({ ok: false, message: 'full_name es requerido' });
    const [r] = await pool.execute('UPDATE users SET full_name = ? WHERE id = ?', [full_name, req.params.id]);
    if (!r.affectedRows) return res.status(404).json({ ok: false, message: 'Usuario no encontrado' });
    res.json({ ok: true, message: 'Usuario actualizado correctamente' });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
};

const deleteUsuario = async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT id, full_name FROM users WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ ok: false, message: 'Usuario no encontrado' });

    // Elimina registros relacionados antes de borrar el usuario
    await pool.execute('DELETE FROM workspace_agent_preferences WHERE user_id = ?', [req.params.id]);
    await pool.execute('DELETE FROM workspace_members WHERE user_id = ?', [req.params.id]);
    await pool.execute('DELETE FROM invitations WHERE invited_by = ?', [req.params.id]);
    await pool.execute('DELETE FROM users WHERE id = ?', [req.params.id]);

    res.json({ ok: true, message: `Usuario "${rows[0].full_name}" eliminado correctamente` });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
};

const asignarUsuarioWorkspace = async (req, res) => {
  try {
    const { user_id, workspace_id, role } = req.body;
    if (!user_id || !workspace_id || !role)
      return res.status(400).json({ ok: false, message: 'user_id, workspace_id y role son requeridos' });

    // Verifica que no esté ya asignado
    const [existe] = await pool.execute(
      'SELECT id FROM workspace_members WHERE user_id = ? AND workspace_id = ?',
      [user_id, workspace_id]
    );
    if (existe.length)
      return res.status(409).json({ ok: false, message: 'El usuario ya pertenece a ese workspace' });

    const [r] = await pool.execute(
      'INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, ?)',
      [workspace_id, user_id, role]
    );
    res.status(201).json({ ok: true, message: 'Usuario asignado al workspace', insertId: r.insertId });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
};

const getMiembrosWorkspace = async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT wm.id, wm.role, wm.is_active, wm.joined_at,
             u.id AS user_id, u.email, u.full_name
      FROM workspace_members wm
      JOIN users u ON wm.user_id = u.id
      WHERE wm.workspace_id = ?
      ORDER BY wm.joined_at DESC
    `, [req.params.workspaceId]);
    res.json({ ok: true, data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
};

const removerMiembro = async (req, res) => {
  try {
    const [r] = await pool.execute(
      'DELETE FROM workspace_members WHERE id = ?', [req.params.id]
    );
    res.json({ ok: true, message: 'Miembro removido', affectedRows: r.affectedRows });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
};

// ══════════════════════════════════════════════════════════════
//  ADDONS
// ══════════════════════════════════════════════════════════════

const getAddons = async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM addons ORDER BY created_at DESC');
    res.json({ ok: true, data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
};

const createAddon = async (req, res) => {
  try {
    const { code, name, description } = req.body;
    if (!code || !name)
      return res.status(400).json({ ok: false, message: 'code y name son requeridos' });

    const [r] = await pool.execute(
      'INSERT INTO addons (code, name, description) VALUES (?, ?, ?)',
      [code.toUpperCase(), name, description || null]
    );
    res.status(201).json({ ok: true, message: 'Addon creado', insertId: r.insertId });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY')
      return res.status(409).json({ ok: false, message: 'El código de addon ya existe' });
    res.status(500).json({ ok: false, message: e.message });
  }
};

const toggleAddon = async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT is_available FROM addons WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ ok: false, message: 'Addon no encontrado' });

    const nuevoEstado = !rows[0].is_available;
    await pool.execute('UPDATE addons SET is_available = ? WHERE id = ?', [nuevoEstado, req.params.id]);

    res.json({ ok: true, message: `Addon ${nuevoEstado ? 'activado' : 'desactivado'}`, is_available: nuevoEstado });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
};

const activarAddonWorkspace = async (req, res) => {
  try {
    const { workspace_id, addon_id } = req.body;

    const [existe] = await pool.execute(
      'SELECT id, is_active FROM addon_activations WHERE workspace_id = ? AND addon_id = ?',
      [workspace_id, addon_id]
    );

    if (existe.length) {
      // Ya existe — alterna el estado
      const nuevoEstado = !existe[0].is_active;
      await pool.execute(
        'UPDATE addon_activations SET is_active = ? WHERE id = ?',
        [nuevoEstado, existe[0].id]
      );
      return res.json({ ok: true, message: `Addon ${nuevoEstado ? 'activado' : 'desactivado'} en workspace` });
    }

    // No existe — lo crea activado
    await pool.execute(
      'INSERT INTO addon_activations (workspace_id, addon_id, is_active) VALUES (?, ?, TRUE)',
      [workspace_id, addon_id]
    );
    res.status(201).json({ ok: true, message: 'Addon activado en workspace' });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
};

const getAddonsWorkspace = async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT a.id, a.code, a.name, a.description,
             aa.is_active, aa.id AS activation_id
      FROM addons a
      LEFT JOIN addon_activations aa 
        ON a.id = aa.addon_id AND aa.workspace_id = ?
      WHERE a.is_available = TRUE
    `, [req.params.workspaceId]);
    res.json({ ok: true, data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
};

// ══════════════════════════════════════════════════════════════
//  GESTIÓN DE OWNERS (solo owners activos pueden hacer esto)
// ══════════════════════════════════════════════════════════════

// GET /api/owner/owners — lista todos los owners
const listarOwners = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT id, email, full_name, is_active, created_at
       FROM owner_accounts ORDER BY created_at ASC`
    );
    res.json({ ok: true, data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
};

// POST /api/owner/owners — crea un nuevo owner con contraseña temporal
const crearOwner = async (req, res) => {
  try {
    const bcrypt = require('bcryptjs');

    const { email, full_name, password } = req.body;
    if (!email || !full_name || !password)
      return res.status(400).json({ ok: false, message: 'email, full_name y password son requeridos' });

    if (password.length < 8)
      return res.status(400).json({ ok: false, message: 'La contraseña debe tener al menos 8 caracteres' });

    const [existe] = await pool.execute(
      'SELECT id FROM owner_accounts WHERE email = ?', [email.toLowerCase()]
    );
    if (existe.length)
      return res.status(409).json({ ok: false, message: 'El email ya está registrado' });

    const hash = await bcrypt.hash(password, 12);

    const [result] = await pool.execute(
      'INSERT INTO owner_accounts (email, password_hash, full_name) VALUES (?, ?, ?)',
      [email.toLowerCase(), hash, full_name]
    );

    res.status(201).json({
      ok: true,
      message: `Owner "${full_name}" creado exitosamente`,
      data: { id: result.insertId, email, full_name }
    });
  } catch (e) {
    console.error('crearOwner:', e.message);
    res.status(500).json({ ok: false, message: e.message });
  }
};

// PATCH /api/owner/owners/:id/toggle — activa o suspende un owner
const toggleOwnerStatus = async (req, res) => {
  try {
    if (parseInt(req.params.id) === req.user.id)
      return res.status(400).json({ ok: false, message: 'No puedes suspenderte a ti mismo' });

    const [rows] = await pool.execute(
      'SELECT id, is_active, full_name FROM owner_accounts WHERE id = ?', [req.params.id]
    );
    if (!rows.length)
      return res.status(404).json({ ok: false, message: 'Owner no encontrado' });

    const nuevo = !rows[0].is_active;
    await pool.execute('UPDATE owner_accounts SET is_active = ? WHERE id = ?', [nuevo, req.params.id]);

    res.json({ ok: true, message: `Owner ${nuevo ? 'reactivado' : 'suspendido'} correctamente` });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
};

module.exports = {
  getDashboard,
  getWorkspaces, createWorkspace, updateWorkspace, toggleWorkspaceStatus, deleteWorkspace,
  getUsuarios, toggleUsuarioStatus, deleteUsuario, asignarUsuarioWorkspace, getMiembrosWorkspace, removerMiembro,
  getAddons, createAddon, toggleAddon, activarAddonWorkspace, getAddonsWorkspace,
  listarOwners, crearOwner, toggleOwnerStatus
};

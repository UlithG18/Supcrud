// routes/mysqlRoutes.js
// CRUD completo para todas las tablas MySQL + endpoints de importación CSV.
//
// Estructura de cada sección:
//  POST   /mysql/{tabla}          → Insertar un registro
//  GET    /mysql/{tabla}          → Listar todos
//  GET    /mysql/{tabla}/:id      → Ver uno por ID
//  PUT    /mysql/{tabla}/:id      → Actualizar
//  DELETE /mysql/{tabla}/:id      → Eliminar
//  POST   /mysql/import/{tabla}   → Importar desde CSV

const express      = require('express');
const router       = express.Router();
const { pool }     = require('../config/mysql');
const upload       = require('../middlewares/upload');
const parseCSVBuffer = require('../utils/parseCSV');


// ══════════════════════════════════════════════════════════════
//  OWNER ACCOUNTS
//  Administradores globales de la plataforma SupCrud.
//  Solo aceptan emails @crudzaso.com (la BD lo valida con CHECK).
//
//  CSV esperado — columnas:
//  email | password_hash | full_name
// ══════════════════════════════════════════════════════════════

router.post('/owners', async (req, res) => {
  try {
    const { email, password_hash, full_name } = req.body;
    const [r] = await pool.execute(
      'INSERT INTO owner_accounts (email, password_hash, full_name) VALUES (?, ?, ?)',
      [email, password_hash, full_name]
    );
    res.status(201).json({ ok: true, insertId: r.insertId });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.get('/owners', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, email, full_name, is_active, created_at FROM owner_accounts'
    );
    res.json({ ok: true, total: rows.length, data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.get('/owners/:id', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, email, full_name, is_active, created_at FROM owner_accounts WHERE id = ?',
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ ok: false, error: 'No encontrado' });
    res.json({ ok: true, data: rows[0] });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.put('/owners/:id', async (req, res) => {
  try {
    const { full_name, is_active } = req.body;
    const [r] = await pool.execute(
      'UPDATE owner_accounts SET full_name = ?, is_active = ? WHERE id = ?',
      [full_name, is_active, req.params.id]
    );
    res.json({ ok: true, affectedRows: r.affectedRows });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.delete('/owners/:id', async (req, res) => {
  try {
    const [r] = await pool.execute('DELETE FROM owner_accounts WHERE id = ?', [req.params.id]);
    res.json({ ok: true, affectedRows: r.affectedRows });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── Importar owners desde CSV ──────────────────────────────────
// En Postman: POST /mysql/import/owners
//   Body → form-data → key: "file" (tipo File) → value: tu .csv
//
// Ejemplo de CSV:
//   email,password_hash,full_name
//   admin@crudzaso.com,$2b$12$hashejemplo,Carlos Crudzaso
//   soporte@crudzaso.com,$2b$12$hashejemplo2,Ana Martínez
router.post('/import/owners', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ ok: false, error: 'Adjunta un archivo CSV con key "file"' });

    const rows     = await parseCSVBuffer(req.file.buffer);
    const inserted = [];
    const errors   = [];

    for (const row of rows) {
      try {
        const [r] = await pool.execute(
          'INSERT INTO owner_accounts (email, password_hash, full_name) VALUES (?, ?, ?)',
          [row.email, row.password_hash, row.full_name]
        );
        inserted.push({ id: r.insertId, email: row.email });
      } catch (e) {
        // Guarda el error pero sigue procesando las demás filas
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


// ══════════════════════════════════════════════════════════════
//  WORKSPACES
//  Cada negocio cliente independiente.
//
//  CSV esperado — columnas:
//  workspace_key | name | domain | created_by
// ══════════════════════════════════════════════════════════════

router.post('/workspaces', async (req, res) => {
  try {
    const { workspace_key, name, domain, created_by } = req.body;
    const [r] = await pool.execute(
      'INSERT INTO workspaces (workspace_key, name, domain, created_by) VALUES (?, ?, ?, ?)',
      [workspace_key, name, domain || null, created_by]
    );
    res.status(201).json({ ok: true, insertId: r.insertId });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.get('/workspaces', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM workspaces ORDER BY created_at DESC');
    res.json({ ok: true, total: rows.length, data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.get('/workspaces/:id', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM workspaces WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ ok: false, error: 'No encontrado' });
    res.json({ ok: true, data: rows[0] });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.put('/workspaces/:id', async (req, res) => {
  try {
    const { name, domain, status } = req.body;
    const [r] = await pool.execute(
      'UPDATE workspaces SET name = ?, domain = ?, status = ? WHERE id = ?',
      [name, domain, status, req.params.id]
    );
    res.json({ ok: true, affectedRows: r.affectedRows });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.delete('/workspaces/:id', async (req, res) => {
  try {
    const [r] = await pool.execute('DELETE FROM workspaces WHERE id = ?', [req.params.id]);
    res.json({ ok: true, affectedRows: r.affectedRows });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── Importar workspaces desde CSV ─────────────────────────────
// Ejemplo de CSV:
//   workspace_key,name,domain,created_by
//   WS-TIENDA-001,Tienda López,tienda-lopez.com,1
//   WS-CLINICA-002,Clínica Bienestar,clinicabien.co,1
router.post('/import/workspaces', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ ok: false, error: 'Adjunta un archivo CSV con key "file"' });

    const rows     = await parseCSVBuffer(req.file.buffer);
    const inserted = [];
    const errors   = [];

    for (const row of rows) {
      try {
        const [r] = await pool.execute(
          'INSERT INTO workspaces (workspace_key, name, domain, created_by) VALUES (?, ?, ?, ?)',
          [row.workspace_key, row.name, row.domain || null, row.created_by]
        );
        inserted.push({ id: r.insertId, workspace_key: row.workspace_key });
      } catch (e) {
        errors.push({ fila: row, razon: e.message });
      }
    }

    res.status(201).json({ ok: true, insertados: inserted.length, errores: errors.length, detalle: inserted, detalle_errores: errors });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});


// ══════════════════════════════════════════════════════════════
//  USERS
//  Agentes y admins de los workspaces.
//  google_sub es el ID único que devuelve Google OAuth (puede ser nulo).
//
//  CSV esperado — columnas:
//  email | password_hash | full_name | google_sub | avatar_url
//  (google_sub y avatar_url pueden ir vacíos)
// ══════════════════════════════════════════════════════════════

router.post('/users', async (req, res) => {
  try {
    const { email, password_hash, full_name, google_sub, avatar_url } = req.body;
    const [r] = await pool.execute(
      'INSERT INTO users (email, password_hash, full_name, google_sub, avatar_url) VALUES (?, ?, ?, ?, ?)',
      [email, password_hash || null, full_name, google_sub || null, avatar_url || null]
    );
    res.status(201).json({ ok: true, insertId: r.insertId });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.get('/users', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, email, full_name, google_sub, avatar_url, is_active, created_at FROM users'
    );
    res.json({ ok: true, total: rows.length, data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.get('/users/:id', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, email, full_name, google_sub, is_active FROM users WHERE id = ?',
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ ok: false, error: 'No encontrado' });
    res.json({ ok: true, data: rows[0] });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.put('/users/:id', async (req, res) => {
  try {
    const { full_name, avatar_url, is_active } = req.body;
    const [r] = await pool.execute(
      'UPDATE users SET full_name = ?, avatar_url = ?, is_active = ? WHERE id = ?',
      [full_name, avatar_url, is_active, req.params.id]
    );
    res.json({ ok: true, affectedRows: r.affectedRows });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.delete('/users/:id', async (req, res) => {
  try {
    const [r] = await pool.execute('DELETE FROM users WHERE id = ?', [req.params.id]);
    res.json({ ok: true, affectedRows: r.affectedRows });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── Importar users desde CSV ───────────────────────────────────
// Ejemplo de CSV:
//   email,password_hash,full_name,google_sub,avatar_url
//   juan@email.com,$2b$12$hash1,Juan Pérez,,
//   maria@gmail.com,,María López,google-sub-998877,https://foto.com/maria.jpg
router.post('/import/users', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ ok: false, error: 'Adjunta un archivo CSV con key "file"' });

    const rows     = await parseCSVBuffer(req.file.buffer);
    const inserted = [];
    const errors   = [];

    for (const row of rows) {
      try {
        const [r] = await pool.execute(
          'INSERT INTO users (email, password_hash, full_name, google_sub, avatar_url) VALUES (?, ?, ?, ?, ?)',
          [row.email, row.password_hash || null, row.full_name, row.google_sub || null, row.avatar_url || null]
        );
        inserted.push({ id: r.insertId, email: row.email });
      } catch (e) {
        errors.push({ fila: row, razon: e.message });
      }
    }

    res.status(201).json({ ok: true, insertados: inserted.length, errores: errors.length, detalle: inserted, detalle_errores: errors });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});


// ══════════════════════════════════════════════════════════════
//  WORKSPACE MEMBERS
//  Relaciona usuarios con workspaces y define su rol.
//  Un mismo usuario puede ser ADMIN en uno y AGENT en otro.
//
//  CSV esperado — columnas:
//  workspace_id | user_id | role
// ══════════════════════════════════════════════════════════════

router.post('/workspace-members', async (req, res) => {
  try {
    const { workspace_id, user_id, role } = req.body;
    const [r] = await pool.execute(
      'INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, ?)',
      [workspace_id, user_id, role || 'AGENT']
    );
    res.status(201).json({ ok: true, insertId: r.insertId });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.get('/workspace-members', async (req, res) => {
  try {
    // JOIN para ver nombres en vez de solo IDs numéricos
    const [rows] = await pool.execute(`
      SELECT wm.id, wm.role, wm.is_active, wm.joined_at,
             w.name  AS workspace_name,
             u.email AS user_email,
             u.full_name
      FROM workspace_members wm
      JOIN workspaces w ON wm.workspace_id = w.id
      JOIN users      u ON wm.user_id      = u.id
    `);
    res.json({ ok: true, total: rows.length, data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Filtrar miembros por workspace específico
router.get('/workspace-members/by-workspace/:workspaceId', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT wm.*, u.email, u.full_name
       FROM workspace_members wm
       JOIN users u ON wm.user_id = u.id
       WHERE wm.workspace_id = ?`,
      [req.params.workspaceId]
    );
    res.json({ ok: true, total: rows.length, data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.put('/workspace-members/:id', async (req, res) => {
  try {
    const { role, is_active } = req.body;
    const [r] = await pool.execute(
      'UPDATE workspace_members SET role = ?, is_active = ? WHERE id = ?',
      [role, is_active, req.params.id]
    );
    res.json({ ok: true, affectedRows: r.affectedRows });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.delete('/workspace-members/:id', async (req, res) => {
  try {
    const [r] = await pool.execute('DELETE FROM workspace_members WHERE id = ?', [req.params.id]);
    res.json({ ok: true, affectedRows: r.affectedRows });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── Importar workspace-members desde CSV ──────────────────────
// Ejemplo de CSV:
//   workspace_id,user_id,role
//   1,1,ADMIN
//   1,2,AGENT
//   2,2,ADMIN
router.post('/import/workspace-members', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ ok: false, error: 'Adjunta un archivo CSV con key "file"' });

    const rows     = await parseCSVBuffer(req.file.buffer);
    const inserted = [];
    const errors   = [];

    for (const row of rows) {
      try {
        const [r] = await pool.execute(
          'INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, ?)',
          [row.workspace_id, row.user_id, row.role || 'AGENT']
        );
        inserted.push({ id: r.insertId, workspace_id: row.workspace_id, user_id: row.user_id });
      } catch (e) {
        errors.push({ fila: row, razon: e.message });
      }
    }

    res.status(201).json({ ok: true, insertados: inserted.length, errores: errors.length, detalle: inserted, detalle_errores: errors });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});


// ══════════════════════════════════════════════════════════════
//  INVITATIONS
//  Tokens temporales para invitar agentes a un workspace.
//
//  CSV esperado — columnas:
//  workspace_id | invited_by | email | token | role | expires_at
// ══════════════════════════════════════════════════════════════

router.post('/invitations', async (req, res) => {
  try {
    const { workspace_id, invited_by, email, token, role, expires_at } = req.body;
    const [r] = await pool.execute(
      'INSERT INTO invitations (workspace_id, invited_by, email, token, role, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
      [workspace_id, invited_by, email, token, role || 'AGENT', expires_at]
    );
    res.status(201).json({ ok: true, insertId: r.insertId });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.get('/invitations', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM invitations ORDER BY created_at DESC');
    res.json({ ok: true, total: rows.length, data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.get('/invitations/:id', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM invitations WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ ok: false, error: 'No encontrado' });
    res.json({ ok: true, data: rows[0] });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.put('/invitations/:id', async (req, res) => {
  try {
    const { status } = req.body;
    const [r] = await pool.execute(
      'UPDATE invitations SET status = ? WHERE id = ?',
      [status, req.params.id]
    );
    res.json({ ok: true, affectedRows: r.affectedRows });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.delete('/invitations/:id', async (req, res) => {
  try {
    const [r] = await pool.execute('DELETE FROM invitations WHERE id = ?', [req.params.id]);
    res.json({ ok: true, affectedRows: r.affectedRows });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── Importar invitations desde CSV ────────────────────────────
// Ejemplo de CSV:
//   workspace_id,invited_by,email,token,role,expires_at
//   1,1,nuevo@email.com,tok_abc123,AGENT,2025-12-31 23:59:59
router.post('/import/invitations', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ ok: false, error: 'Adjunta un archivo CSV con key "file"' });

    const rows     = await parseCSVBuffer(req.file.buffer);
    const inserted = [];
    const errors   = [];

    for (const row of rows) {
      try {
        const [r] = await pool.execute(
          'INSERT INTO invitations (workspace_id, invited_by, email, token, role, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
          [row.workspace_id, row.invited_by, row.email, row.token, row.role || 'AGENT', row.expires_at]
        );
        inserted.push({ id: r.insertId, email: row.email });
      } catch (e) {
        errors.push({ fila: row, razon: e.message });
      }
    }

    res.status(201).json({ ok: true, insertados: inserted.length, errores: errors.length, detalle: inserted, detalle_errores: errors });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});


// ══════════════════════════════════════════════════════════════
//  ADDONS
//  Catálogo global de funcionalidades adicionales.
//
//  CSV esperado — columnas:
//  code | name | description
// ══════════════════════════════════════════════════════════════

router.post('/addons', async (req, res) => {
  try {
    const { code, name, description } = req.body;
    const [r] = await pool.execute(
      'INSERT INTO addons (code, name, description) VALUES (?, ?, ?)',
      [code, name, description || null]
    );
    res.status(201).json({ ok: true, insertId: r.insertId });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.get('/addons', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM addons');
    res.json({ ok: true, total: rows.length, data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.get('/addons/:id', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM addons WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ ok: false, error: 'No encontrado' });
    res.json({ ok: true, data: rows[0] });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.put('/addons/:id', async (req, res) => {
  try {
    const { name, description, is_available } = req.body;
    const [r] = await pool.execute(
      'UPDATE addons SET name = ?, description = ?, is_available = ? WHERE id = ?',
      [name, description, is_available, req.params.id]
    );
    res.json({ ok: true, affectedRows: r.affectedRows });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.delete('/addons/:id', async (req, res) => {
  try {
    const [r] = await pool.execute('DELETE FROM addons WHERE id = ?', [req.params.id]);
    res.json({ ok: true, affectedRows: r.affectedRows });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── Importar addons desde CSV ──────────────────────────────────
// Ejemplo de CSV:
//   code,name,description
//   ATTACHMENTS,Adjuntos de Archivos,Permite subir archivos via Cloudinary
//   AI_ASSIST,Asistente de IA,Clasificación automática con OpenAI
//   KNOWLEDGE_BASE,Base de Conocimiento,Artículos de ayuda en el widget
router.post('/import/addons', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ ok: false, error: 'Adjunta un archivo CSV con key "file"' });

    const rows     = await parseCSVBuffer(req.file.buffer);
    const inserted = [];
    const errors   = [];

    for (const row of rows) {
      try {
        const [r] = await pool.execute(
          'INSERT INTO addons (code, name, description) VALUES (?, ?, ?)',
          [row.code, row.name, row.description || null]
        );
        inserted.push({ id: r.insertId, code: row.code });
      } catch (e) {
        errors.push({ fila: row, razon: e.message });
      }
    }

    res.status(201).json({ ok: true, insertados: inserted.length, errores: errors.length, detalle: inserted, detalle_errores: errors });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});


// ══════════════════════════════════════════════════════════════
//  ADDON ACTIVATIONS
//  Qué add-ons tiene activos cada workspace y su configuración.
//
//  CSV esperado — columnas:
//  workspace_id | addon_id | is_active | config
//  (config puede ir vacío o como JSON string)
// ══════════════════════════════════════════════════════════════

router.post('/addon-activations', async (req, res) => {
  try {
    const { workspace_id, addon_id, config } = req.body;
    const [r] = await pool.execute(
      'INSERT INTO addon_activations (workspace_id, addon_id, config) VALUES (?, ?, ?)',
      [workspace_id, addon_id, config ? JSON.stringify(config) : null]
    );
    res.status(201).json({ ok: true, insertId: r.insertId });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.get('/addon-activations', async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT aa.id, aa.is_active, aa.config, aa.activated_at,
             w.name AS workspace_name,
             a.code AS addon_code,
             a.name AS addon_name
      FROM addon_activations aa
      JOIN workspaces w ON aa.workspace_id = w.id
      JOIN addons     a ON aa.addon_id     = a.id
    `);
    res.json({ ok: true, total: rows.length, data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.get('/addon-activations/:id', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM addon_activations WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ ok: false, error: 'No encontrado' });
    res.json({ ok: true, data: rows[0] });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.put('/addon-activations/:id', async (req, res) => {
  try {
    const { is_active, config } = req.body;
    const [r] = await pool.execute(
      'UPDATE addon_activations SET is_active = ?, config = ? WHERE id = ?',
      [is_active, config ? JSON.stringify(config) : null, req.params.id]
    );
    res.json({ ok: true, affectedRows: r.affectedRows });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.delete('/addon-activations/:id', async (req, res) => {
  try {
    const [r] = await pool.execute('DELETE FROM addon_activations WHERE id = ?', [req.params.id]);
    res.json({ ok: true, affectedRows: r.affectedRows });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── Importar addon-activations desde CSV ──────────────────────
// Ejemplo de CSV:
//   workspace_id,addon_id,is_active,config
//   1,1,1,"{""maxFileSizeMb"":10}"
//   1,2,1,"{""mode"":""APPROVAL""}"
//   2,1,1,
router.post('/import/addon-activations', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ ok: false, error: 'Adjunta un archivo CSV con key "file"' });

    const rows     = await parseCSVBuffer(req.file.buffer);
    const inserted = [];
    const errors   = [];

    for (const row of rows) {
      try {
        const [r] = await pool.execute(
          'INSERT INTO addon_activations (workspace_id, addon_id, is_active, config) VALUES (?, ?, ?, ?)',
          [row.workspace_id, row.addon_id, row.is_active ?? 1, row.config || null]
        );
        inserted.push({ id: r.insertId, workspace_id: row.workspace_id, addon_id: row.addon_id });
      } catch (e) {
        errors.push({ fila: row, razon: e.message });
      }
    }

    res.status(201).json({ ok: true, insertados: inserted.length, errores: errors.length, detalle: inserted, detalle_errores: errors });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});


// ══════════════════════════════════════════════════════════════
//  WORKSPACE AGENT PREFERENCES
//  Tipos y categorías de tickets que atiende cada agente.
//  La IA usa esto para sugerir o asignar automáticamente.
//
//  CSV esperado — columnas:
//  workspace_id | user_id | ticket_types | categories
//  (ticket_types y categories como JSON string: ["Q","R"] )
// ══════════════════════════════════════════════════════════════

router.post('/agent-preferences', async (req, res) => {
  try {
    const { workspace_id, user_id, ticket_types, categories } = req.body;
    const [r] = await pool.execute(
      'INSERT INTO workspace_agent_preferences (workspace_id, user_id, ticket_types, categories) VALUES (?, ?, ?, ?)',
      [workspace_id, user_id,
        JSON.stringify(ticket_types || []),
        JSON.stringify(categories  || [])]
    );
    res.status(201).json({ ok: true, insertId: r.insertId });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.get('/agent-preferences', async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT p.id, p.ticket_types, p.categories, p.updated_at,
             u.email, u.full_name,
             w.name AS workspace_name
      FROM workspace_agent_preferences p
      JOIN users      u ON p.user_id      = u.id
      JOIN workspaces w ON p.workspace_id = w.id
    `);
    res.json({ ok: true, total: rows.length, data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.get('/agent-preferences/:id', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM workspace_agent_preferences WHERE id = ?', [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ ok: false, error: 'No encontrado' });
    res.json({ ok: true, data: rows[0] });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.put('/agent-preferences/:id', async (req, res) => {
  try {
    const { ticket_types, categories } = req.body;
    const [r] = await pool.execute(
      'UPDATE workspace_agent_preferences SET ticket_types = ?, categories = ? WHERE id = ?',
      [JSON.stringify(ticket_types), JSON.stringify(categories), req.params.id]
    );
    res.json({ ok: true, affectedRows: r.affectedRows });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.delete('/agent-preferences/:id', async (req, res) => {
  try {
    const [r] = await pool.execute(
      'DELETE FROM workspace_agent_preferences WHERE id = ?', [req.params.id]
    );
    res.json({ ok: true, affectedRows: r.affectedRows });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── Importar agent-preferences desde CSV ──────────────────────
// Ejemplo de CSV:
//   workspace_id,user_id,ticket_types,categories
//   1,2,["Q","R"],["facturación","pagos"]
//   2,2,["P","S"],["citas","medicina general"]
router.post('/import/agent-preferences', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ ok: false, error: 'Adjunta un archivo CSV con key "file"' });

    const rows     = await parseCSVBuffer(req.file.buffer);
    const inserted = [];
    const errors   = [];

    for (const row of rows) {
      try {
        // ticket_types y categories vienen como string del CSV
        // Si vienen como JSON string los dejamos tal cual,
        // si vienen vacíos usamos array vacío
        const ticket_types = row.ticket_types || '[]';
        const categories   = row.categories   || '[]';

        const [r] = await pool.execute(
          'INSERT INTO workspace_agent_preferences (workspace_id, user_id, ticket_types, categories) VALUES (?, ?, ?, ?)',
          [row.workspace_id, row.user_id, ticket_types, categories]
        );
        inserted.push({ id: r.insertId, user_id: row.user_id });
      } catch (e) {
        errors.push({ fila: row, razon: e.message });
      }
    }

    res.status(201).json({ ok: true, insertados: inserted.length, errores: errors.length, detalle: inserted, detalle_errores: errors });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});


// ══════════════════════════════════════════════════════════════
//  OTP CODES
//  Códigos temporales de un solo uso para acceso al ticket.
//  No tiene FK porque el usuario final no tiene cuenta en MySQL
//  y el ticket vive en MongoDB — la integridad la maneja el backend.
//
//  CSV esperado — columnas:
//  reference_code | email | code | expires_at
// ══════════════════════════════════════════════════════════════

router.post('/otp-codes', async (req, res) => {
  try {
    const { reference_code, email, code, expires_at } = req.body;
    const [r] = await pool.execute(
      'INSERT INTO otp_codes (reference_code, email, code, expires_at) VALUES (?, ?, ?, ?)',
      [reference_code, email, code, expires_at]
    );
    res.status(201).json({ ok: true, insertId: r.insertId });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.get('/otp-codes', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM otp_codes ORDER BY created_at DESC');
    res.json({ ok: true, total: rows.length, data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.get('/otp-codes/:id', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM otp_codes WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ ok: false, error: 'No encontrado' });
    res.json({ ok: true, data: rows[0] });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.delete('/otp-codes/:id', async (req, res) => {
  try {
    const [r] = await pool.execute('DELETE FROM otp_codes WHERE id = ?', [req.params.id]);
    res.json({ ok: true, affectedRows: r.affectedRows });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── Importar otp-codes desde CSV ──────────────────────────────
// Ejemplo de CSV:
//   reference_code,email,code,expires_at
//   REF-WSTIEND-001,cliente1@email.com,847392,2025-12-31 23:59:59
router.post('/import/otp-codes', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ ok: false, error: 'Adjunta un archivo CSV con key "file"' });

    const rows     = await parseCSVBuffer(req.file.buffer);
    const inserted = [];
    const errors   = [];

    for (const row of rows) {
      try {
        const [r] = await pool.execute(
          'INSERT INTO otp_codes (reference_code, email, code, expires_at) VALUES (?, ?, ?, ?)',
          [row.reference_code, row.email, row.code, row.expires_at]
        );
        inserted.push({ id: r.insertId, reference_code: row.reference_code });
      } catch (e) {
        errors.push({ fila: row, razon: e.message });
      }
    }

    res.status(201).json({ ok: true, insertados: inserted.length, errores: errors.length, detalle: inserted, detalle_errores: errors });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});


module.exports = router;

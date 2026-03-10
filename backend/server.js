// server.js
require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const path    = require('path');

const { testMySQL }    = require('./config/mysql');
const { connectMongo } = require('./config/mongodb');
const { testEmail }    = require('./services/emailService');

const authRoutes      = require('./routes/authRoutes');
const ownerRoutes     = require('./routes/ownerRoutes');
const workspaceRoutes = require('./routes/workspaceRoutes');
const publicRoutes    = require('./routes/publicRoutes');

const app  = express();
const PORT = process.env.PORT || 3000;

// CORS abierto para que sitios externos puedan usar el widget
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// ── Rutas API ─────────────────────────────────────────────────
app.use('/api/auth',      authRoutes);
app.use('/api/owner',     ownerRoutes);
app.use('/api/workspace', workspaceRoutes);
app.use('/api/public',    publicRoutes);

// ── Rutas Frontend ────────────────────────────────────────────
app.get('/',                    (req, res) => res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html')));
app.get('/owner/login',         (req, res) => res.sendFile(path.join(__dirname, '..', 'frontend', 'owner',     'login.html')));
app.get('/owner/register',      (req, res) => res.sendFile(path.join(__dirname, '..', 'frontend', 'owner',     'register.html')));
app.get('/owner/dashboard',     (req, res) => res.sendFile(path.join(__dirname, '..', 'frontend', 'owner',     'dashboard.html')));
app.get('/workspace/login',     (req, res) => res.sendFile(path.join(__dirname, '..', 'frontend', 'workspace', 'login.html')));
app.get('/workspace/register',  (req, res) => res.sendFile(path.join(__dirname, '..', 'frontend', 'workspace', 'register.html')));
app.get('/workspace/dashboard', (req, res) => res.sendFile(path.join(__dirname, '..', 'frontend', 'workspace', 'dashboard.html')));
app.get('/consulta',            (req, res) => res.sendFile(path.join(__dirname, '..', 'frontend', 'public',    'consulta.html')));
app.get('/widget/demo',         (req, res) => res.sendFile(path.join(__dirname, '..', 'frontend', 'widget',    'widget-demo.html')));

// ── Manejo de errores ─────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ ok: false, message: err.message });
});

// ── Arranque ──────────────────────────────────────────────────
const start = async () => {
  try {
    await testMySQL();
    await connectMongo();
    await testEmail();
    app.listen(PORT, () => {
      console.log(`\n🚀 Servidor en http://localhost:${PORT}`);
      console.log(`👑 Panel Owner      → http://localhost:${PORT}/owner/login`);
      console.log(`🏢 Panel Workspace  → http://localhost:${PORT}/workspace/login`);
      console.log(`🔍 Consulta pública → http://localhost:${PORT}/consulta`);
      console.log(`🧩 Widget demo      → http://localhost:${PORT}/widget/demo\n`);
    });
  } catch (err) {
    console.error('❌ Error al iniciar:', err.message);
    process.exit(1);
  }
};

start();

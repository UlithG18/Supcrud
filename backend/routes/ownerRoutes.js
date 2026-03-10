// routes/ownerRoutes.js
const express = require('express');
const router  = express.Router();
const { verifyToken, checkRole } = require('../middlewares/auth');
const {
  getDashboard,
  getWorkspaces, createWorkspace, updateWorkspace, toggleWorkspaceStatus, deleteWorkspace,
  getUsuarios, toggleUsuarioStatus, deleteUsuario, asignarUsuarioWorkspace, getMiembrosWorkspace, removerMiembro,
  getAddons, createAddon, toggleAddon, activarAddonWorkspace, getAddonsWorkspace,
  listarOwners, crearOwner, toggleOwnerStatus
} = require('../controllers/ownerController');

router.use(verifyToken);
router.use(checkRole('OWNER'));

// Dashboard
router.get('/dashboard', getDashboard);

// Workspaces
router.get('/workspaces',                          getWorkspaces);
router.post('/workspaces',                         createWorkspace);
router.put('/workspaces/:id',                      updateWorkspace);
router.patch('/workspaces/:id/toggle',             toggleWorkspaceStatus);
router.delete('/workspaces/:id',                   deleteWorkspace);

// Usuarios
router.get('/usuarios',                            getUsuarios);
router.patch('/usuarios/:id/toggle',               toggleUsuarioStatus);
router.delete('/usuarios/:id',                     deleteUsuario);
router.post('/usuarios/asignar',                   asignarUsuarioWorkspace);
router.get('/workspaces/:workspaceId/miembros',    getMiembrosWorkspace);
router.delete('/workspace-members/:id',            removerMiembro);

// Addons
router.get('/addons',                              getAddons);
router.post('/addons',                             createAddon);
router.patch('/addons/:id/toggle',                 toggleAddon);
router.post('/addons/activar',                     activarAddonWorkspace);
router.get('/workspaces/:workspaceId/addons',      getAddonsWorkspace);

// Owners — gestión interna
router.get('/owners',                              listarOwners);
router.post('/owners',                             crearOwner);
router.patch('/owners/:id/toggle',                 toggleOwnerStatus);

module.exports = router;

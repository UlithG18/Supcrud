# ⚡ SupCrud — Plataforma PQRS SaaS

> **by Crudzaso** · Versión 3.0 · Marzo 2026

Plataforma multi-tenant de gestión de **Peticiones, Quejas, Reclamos y Sugerencias (PQRS)**. Permite a empresas cliente recibir, gestionar y responder solicitudes con trazabilidad completa, notificaciones automáticas por email, asistente de IA y adjuntos en la nube.

---

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Backend | Node.js v22 + Express 4 |
| Base de datos relacional | MySQL 9 + mysql2 |
| Base de datos documental | MongoDB + Mongoose |
| Autenticación | JSON Web Tokens + bcryptjs |
| Email | Nodemailer + Gmail SMTP |
| Archivos | Cloudinary (CDN) + multer |
| IA | Groq API — modelo `llama-3.3-70b-versatile` |
| Frontend | HTML / CSS / JavaScript vanilla |

---

## Estructura del Proyecto

```
supcrud/
├── backend/
│   ├── server.js                  ← Punto de entrada
│   ├── .env                       ← Variables de entorno (NO subir al repo)
│   ├── package.json
│   ├── config/
│   │   ├── mysql.js               ← Pool MySQL
│   │   └── mongodb.js             ← Conexión Mongoose
│   ├── middlewares/
│   │   └── auth.js                ← verifyToken + checkRole
│   ├── models/
│   │   └── Ticket.js              ← Schema MongoDB
│   ├── services/
│   │   ├── emailService.js        ← OTP · confirmación · notificaciones
│   │   ├── cloudinaryService.js   ← Upload de archivos
│   │   └── groqService.js         ← Sugerencias IA
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── ownerController.js
│   │   ├── workspaceController.js ← Emails automáticos integrados
│   │   ├── addonController.js     ← Adjuntos + IA
│   │   ├── publicController.js    ← OTP + consulta pública
│   │   └── widgetController.js
│   └── routes/
│       ├── authRoutes.js          ← /api/auth/*
│       ├── ownerRoutes.js         ← /api/owner/*
│       ├── workspaceRoutes.js     ← /api/workspace/*
│       ├── publicRoutes.js        ← /api/public/*
│       └── mysqlRoutes.js
└── frontend/
    ├── owner/                     ← Panel Owner
    ├── workspace/                 ← Panel Workspace
    ├── public/                    ← Portal consulta pública (OTP)
    └── widget/                    ← Widget embebible
```

---

## Instalación

### 1. Base de datos MySQL

```sql
source supcrud_schema_v3.sql
```

### 2. Variables de entorno

Crear `backend/.env`:

```env
# Servidor
BASE_URL=http://localhost:3000
PORT=3000

# JWT
JWT_SECRET=tu_clave_secreta_muy_larga
JWT_EXPIRES_IN=8h

# MySQL
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=tu_password
DB_NAME=supcrud

# MongoDB
MONGO_URI=mongodb://localhost:27017/supcrud

# Email (Gmail SMTP)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=tu@gmail.com
EMAIL_PASSWORD=xxxx_xxxx_xxxx_xxxx
EMAIL_FROM=SupCrud <tu@gmail.com>

# Cloudinary
CLOUDINARY_CLOUD_NAME=tu_cloud
CLOUDINARY_API_KEY=tu_key
CLOUDINARY_API_SECRET=tu_secret

# Groq IA
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxx
```

> **Gmail App Password:** Activar verificación en 2 pasos → Seguridad → Contraseñas de aplicación.

### 3. Iniciar

```bash
cd backend
npm install
npm run dev      # desarrollo

# Servidor y utilidades
npm install express cors dotenv

# Autenticación
npm install jsonwebtoken bcryptjs

# Bases de datos
npm install mysql2 mongoose

# Archivos y email
npm install multer nodemailer cloudinary

# IA y CSV
npm install groq-sdk csv-parser

# Desarrollo
npm install nodemon
# npm start      # producción
```

Disponible en `http://localhost:3000`

---

## Accesos

| Panel | URL |
|-------|-----|
| Owner (Crudzaso) | `/owner/login` |
| Workspace (Admin/Agente) | `/workspace/login` |
| Portal público | `/consulta` |
| Widget demo | `/widget/widget-demo.html` |

> El registro público de owners está **deshabilitado**. Las cuentas se crean desde el panel Owner.

---

## Roles

| Acción | Owner | ADMIN | AGENT |
|--------|:-----:|:-----:|:-----:|
| Gestionar workspaces/owners/addons | ✅ | — | — |
| Ver todos los tickets | ✅ | ✅ | Solo asignados |
| Crear tickets | ✅ | ✅ | — |
| Asignar agentes | ✅ | ✅ | — |
| Cambiar estado / Enviar mensajes | ✅ | ✅ | ✅ |
| Adjuntos e IA (si activo) | — | ✅ | ✅ |
| Gestionar equipo | — | ✅ | — |

---

## Ciclo de un Ticket

```
OPEN → IN_PROGRESS → RESOLVED → CLOSED
              ↑________________________↓  REOPENED
```

Cada cambio de estado envía un **email automático** al cliente.

---

## Add-ons

| Código | Función |
|--------|---------|
| `ATTACHMENTS` | Adjuntar archivos (JPG, PNG, PDF, DOCX, XLSX, TXT · máx 10 MB) |
| `AI_ASSIST` | Sugerencias de respuesta con LLaMA 3.3 (70B) via Groq |

Se activan desde el panel Owner: globalmente y por workspace.

---

## Widget Embebible

```html
<script
  src="https://tudominio.com/widget/widget.js"
  data-workspace="WS-EMPRESA-001"
  data-title="Soporte al Cliente"
  data-color="#3b82f6"
></script>
```

---

## API — Resumen de Endpoints

```
POST /api/auth/owner/login              Login owner
POST /api/auth/login                    Login admin/agente
GET  /api/auth/me                       Perfil autenticado

GET|POST         /api/owner/workspaces
PUT|PATCH|DELETE /api/owner/workspaces/:id
GET|POST         /api/owner/owners
GET              /api/owner/usuarios
POST             /api/owner/usuarios/asignar
GET|POST         /api/owner/addons
POST             /api/owner/addons/activar

GET  /api/workspace/dashboard
GET  /api/workspace/tickets
POST /api/workspace/tickets                    (solo ADMIN)
PUT  /api/workspace/tickets/:ref
POST /api/workspace/tickets/:ref/messages
POST /api/workspace/tickets/:ref/attachments   (add-on ATTACHMENTS)
GET  /api/workspace/tickets/:ref/ai-suggest    (add-on AI_ASSIST)
GET  /api/workspace/addons
GET  /api/workspace/equipo

POST /api/public/solicitar-otp
POST /api/public/verificar-otp
POST /api/public/tickets/:ref/messages
POST /api/public/tickets/:ref/attachments
GET  /api/public/workspace-addons/:key
POST /api/public/widget/ticket
```

---

## Base de Datos

### MySQL — 9 tablas
`owner_accounts` · `workspaces` · `users` · `workspace_members` · `invitations` · `addons` · `addon_activations` · `workspace_agent_preferences` · `otp_codes`

**Relaciones clave:**
- `workspaces.created_by → owner_accounts.id` **ON DELETE SET NULL**
- `workspace_members.workspace_id → workspaces.id` **ON DELETE CASCADE**
- `addon_activations.workspace_id → workspaces.id` **ON DELETE CASCADE**

### MongoDB — colección `tickets`
Documento con arrays embebidos: `conversation[]` · `events[]` · `attachments[]`

---

## Notas de Producción

- Fijar `BASE_URL` con el dominio real para los links de email.
- Usar MongoDB Atlas en producción.
- Configurar CORS para el widget en dominios externos.
- Limpiar OTPs expirados periódicamente: `DELETE FROM otp_codes WHERE expires_at < NOW();`
- Verificar modelo IA vigente en [console.groq.com/docs/models](https://console.groq.com/docs/models).

---

*SupCrud · by Crudzaso · v3.0 · Marzo 2026*

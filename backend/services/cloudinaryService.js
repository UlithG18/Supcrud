// services/cloudinaryService.js
// Maneja la subida de archivos a Cloudinary.
// Los archivos se guardan en la carpeta supcrud/{workspaceKey}/{referenceCode}

const cloudinary = require('cloudinary').v2;
const multer     = require('multer');
require('dotenv').config();

// ── Configuración de Cloudinary ───────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// ── Multer en memoria ─────────────────────────────────────────
// Los archivos se guardan en RAM temporalmente antes de subir a Cloudinary.
// No se guarda nada en disco del servidor.
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  // Tipos de archivo permitidos
  const allowed = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain'
  ];

  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Tipo de archivo no permitido. Solo imágenes, PDFs y documentos de Office.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB máximo por archivo
});

// ── Subir archivo a Cloudinary ────────────────────────────────
const subirArchivo = (buffer, mimetype, workspaceKey, referenceCode) => {
  return new Promise((resolve, reject) => {
    // Determina el tipo de recurso según el mimetype
    const resourceType = mimetype.startsWith('image/') ? 'image' : 'raw';

    const stream = cloudinary.uploader.upload_stream(
      {
        folder:        `supcrud/${workspaceKey}/${referenceCode}`,
        resource_type: resourceType,
        allowed_formats: ['jpg','jpeg','png','gif','webp','pdf','doc','docx','xls','xlsx','txt']
      },
      (error, result) => {
        if (error) return reject(error);
        resolve({
          url:          result.secure_url,
          publicId:     result.public_id,
          resourceType: result.resource_type,
          format:       result.format,
          size:         result.bytes,
          width:        result.width  || null,
          height:       result.height || null
        });
      }
    );

    stream.end(buffer);
  });
};

// ── Eliminar archivo de Cloudinary ────────────────────────────
const eliminarArchivo = async (publicId, resourceType = 'image') => {
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch (e) {
    console.error('Error eliminando archivo de Cloudinary:', e.message);
  }
};

module.exports = { upload, subirArchivo, eliminarArchivo };

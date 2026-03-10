// middlewares/upload.js
// Configura Multer para recibir archivos CSV desde Postman (form-data).
//
// ¿Por qué memoryStorage y no diskStorage?
// - memoryStorage guarda el archivo en RAM como un Buffer.
// - No escribe nada en disco → más limpio, más rápido para procesar y descartar.
// - El Buffer llega al controlador como req.file.buffer y se procesa con csv-parser.
// - Si el archivo fuera grande (>50MB) sería mejor diskStorage, pero para CSVs
//   de base de datos esto es más que suficiente.

const multer = require('multer');

const upload = multer({

  storage: multer.memoryStorage(), // Guarda en RAM, no en disco

  // fileFilter: función que decide si aceptar o rechazar el archivo
  // cb(error, aceptar) — null en el error significa "sin error"
  fileFilter: (req, file, cb) => {
    const esCSV = file.mimetype === 'text/csv'
               || file.mimetype === 'application/vnd.ms-excel' // Excel a veces manda este mime en CSV
               || file.originalname.endsWith('.csv');

    if (esCSV) {
      cb(null, true);  // Acepta el archivo
    } else {
      cb(new Error('Solo se permiten archivos .csv'), false); // Rechaza
    }
  },

  limits: {
    fileSize: 5 * 1024 * 1024 // 5 MB máximo — suficiente para miles de registros
  }
});

module.exports = upload;

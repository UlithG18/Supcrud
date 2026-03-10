// utils/parseCSV.js
// Convierte el Buffer que entrega Multer en un array de objetos JavaScript.
//
// ¿Cómo funciona?
// 1. Multer recibe el archivo y lo guarda en RAM como Buffer (bytes crudos).
// 2. buffer.toString() convierte esos bytes en texto plano (el contenido del CSV).
// 3. Readable.from() convierte ese texto en un Stream legible (necesario para csv-parser).
// 4. csv-parser lee el stream línea por línea y emite un objeto por cada fila.
//    La primera fila del CSV se usa automáticamente como nombres de las claves.
//
// Ejemplo: si el CSV es:
//   email,full_name
//   ana@test.com,Ana
//
// El resultado es:
//   [ { email: "ana@test.com", full_name: "Ana" } ]

const csv      = require('csv-parser');
const { Readable } = require('stream'); // 'stream' viene con Node.js, no hay que instalarlo

const parseCSVBuffer = (buffer) => {
  return new Promise((resolve, reject) => {
    const rows = [];

    Readable.from(buffer.toString())   // Buffer → texto → stream
      .pipe(csv())                     // stream → objetos fila por fila
      .on('data', (row) => {
        // Limpia espacios en blanco de cada valor
        // A veces los CSV tienen espacios raros después de las comas
        const cleanRow = {};
        for (const key of Object.keys(row)) {
          cleanRow[key.trim()] = row[key].trim();
        }
        rows.push(cleanRow);
      })
      .on('end',   ()  => resolve(rows))
      .on('error', (e) => reject(e));
  });
};

module.exports = parseCSVBuffer;

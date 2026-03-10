// models/Ticket.js
// Esquema Mongoose para la colección "tickets" en MongoDB.

const mongoose = require('mongoose');

const TicketSchema = new mongoose.Schema({

  referenceCode: { type: String, required: true, unique: true },

  // Referencia lógica al workspace de MySQL
  workspaceId:  { type: Number, required: true },
  workspaceKey: { type: String, required: true },

  subject:     { type: String, required: true },
  description: { type: String, required: true },

  type:     { type: String, enum: ['P','Q','R','S'], required: true },
  status:   { type: String, enum: ['OPEN','IN_PROGRESS','RESOLVED','CLOSED','REOPENED'], default: 'OPEN' },
  priority: { type: String, enum: ['LOW','MEDIUM','HIGH','CRITICAL'], default: 'MEDIUM' },
  category: { type: String },
  tags:     [String],

  userEmail: { type: String, required: true, lowercase: true },

  assignedAgentId:   { type: Number, default: null },
  assignedAgentName: { type: String, default: null },

  conversation: [{
    senderType:  { type: String, enum: ['USER','AGENT'] },
    senderEmail: String,
    content:     String,
    createdAt:   { type: Date, default: Date.now }
  }],

  // Historial de todo lo que ocurre con el ticket
  events: [{
    eventType:   String,
    description: String,
    performedBy: String,
    createdAt:   { type: Date, default: Date.now }
  }],

  attachments: [{
    url:        String,
    fileName:   String,
    uploadedAt: { type: Date, default: Date.now }
  }]

}, { timestamps: true }); // Agrega createdAt y updatedAt automáticamente

module.exports = mongoose.model('Ticket', TicketSchema);

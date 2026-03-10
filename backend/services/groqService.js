// services/groqService.js
// Genera sugerencias de respuesta para agentes usando Groq (LLaMA 3).
// Solo se llama si el workspace tiene el addon AI_ASSIST activo.

const Groq = require('groq-sdk');
require('dotenv').config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ══════════════════════════════════════════════════════════════
//  Genera una sugerencia de respuesta para un ticket
//
//  Lee el tipo, asunto, descripción y conversación del ticket
//  y devuelve un borrador profesional listo para enviar.
// ══════════════════════════════════════════════════════════════
const sugerirRespuesta = async (ticket) => {
  const tipoLabel = { P: 'Petición', Q: 'Queja', R: 'Reclamo', S: 'Sugerencia' };

  // Construye el historial de la conversación para darle contexto a la IA
  const historial = ticket.conversation.length
    ? ticket.conversation.map(m =>
        `${m.senderType === 'AGENT' ? 'Agente' : 'Cliente'}: ${m.content}`
      ).join('\n')
    : 'Sin mensajes previos.';

  const prompt = `Eres un agente de soporte al cliente profesional y empático.
Tu tarea es redactar una respuesta clara, cordial y útil para el siguiente caso.

TIPO DE CASO: ${tipoLabel[ticket.type] || ticket.type}
ASUNTO: ${ticket.subject}
DESCRIPCIÓN DEL CLIENTE: ${ticket.description}
HISTORIAL DE CONVERSACIÓN:
${historial}

INSTRUCCIONES:
- Responde directamente al cliente, en español
- Sé empático y profesional
- Si es un reclamo o queja, reconoce la situación y ofrece una solución concreta
- Si es una petición, confirma que se está gestionando
- Si es una sugerencia, agradece y explica cómo se considerará
- No uses frases genéricas vacías como "lamentamos los inconvenientes"
- Máximo 3 párrafos cortos
- No incluyas saludos iniciales ni despedidas formales — solo el cuerpo de la respuesta`;

  const completion = await groq.chat.completions.create({
    model:       'llama-3.3-70b-versatile', // Modelo actual y gratuito de Groq
    messages:    [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens:  500
  });

  return completion.choices[0]?.message?.content?.trim() || '';
};

module.exports = { sugerirRespuesta };

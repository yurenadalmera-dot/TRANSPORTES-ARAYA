import { config } from '../config.js';
import { enviaCorreo } from './smtp.js';
import { asuntoEmail, cuerpoTextoEmail, cuerpoHtmlEmail } from '../informe/email.js';
import { adjuntosDelInforme } from '../informe/csv.js';

// Canal de correo: un único envío con todos los destinatarios, en texto y
// HTML, y los dos listados completos adjuntos en CSV.
export function creaCanalEmail({ enviar = enviaCorreo } = {}) {
  const { email } = config;
  const destinatarios = email.destinatarios;

  return {
    nombre: 'email',
    destinatarios,
    configurado: Boolean(email.host && email.de && destinatarios.length),

    async envia(informe) {
      if (!email.host || !email.de) {
        throw new Error('Faltan EMAIL_HOST y EMAIL_DE para poder enviar el correo.');
      }
      if (destinatarios.length === 0) {
        throw new Error('No hay destinatarios: define EMAIL_DESTINATARIOS en el .env.');
      }

      try {
        await enviar({
          host: email.host,
          puerto: email.puerto,
          seguro: email.seguro,
          usuario: email.usuario,
          clave: email.clave,
          timeoutMs: email.timeoutMs,
          de: email.de,
          para: destinatarios,
          asunto: asuntoEmail(informe),
          texto: cuerpoTextoEmail(informe),
          html: cuerpoHtmlEmail(informe),
          adjuntos: email.adjuntarCsv ? adjuntosDelInforme(informe) : [],
        });
        return destinatarios.map((destinatario) => ({ destinatario, enviado: true, id: null, motivo: null }));
      } catch (error) {
        // Un fallo de correo no debe impedir que salga el WhatsApp.
        return destinatarios.map((destinatario) => ({
          destinatario, enviado: false, id: null, motivo: error.message,
        }));
      }
    },
  };
}

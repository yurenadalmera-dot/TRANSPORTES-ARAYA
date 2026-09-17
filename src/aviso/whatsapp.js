import { config } from '../config.js';
import { creaAviso } from './proveedores.js';
import { formateaWhatsapp } from '../informe/whatsapp.js';

// Canal de WhatsApp: envuelve al proveedor configurado (consola, Meta o
// Twilio) y le da ya formateado el mensaje del día.
export function creaCanalWhatsapp({ proveedor = creaAviso() } = {}) {
  const destinatarios = config.aviso.destinatarios;

  return {
    nombre: `whatsapp:${proveedor.nombre}`,
    destinatarios,
    configurado: proveedor.configurado,

    async envia(informe) {
      if (proveedor.nombre !== 'consola' && destinatarios.length === 0) {
        throw new Error('No hay destinatarios: define WHATSAPP_DESTINATARIOS en el .env.');
      }
      return proveedor.envia(informe, formateaWhatsapp(informe), destinatarios);
    },
  };
}

import { config } from '../config.js';
import { creaCanalWhatsapp } from './whatsapp.js';
import { creaCanalEmail } from './email.js';

export { creaAviso } from './proveedores.js';

// Los canales por los que sale el informe del día. El correo solo se añade
// si está configurado, así que el proyecto funciona igual sin él.
export function creaCanales() {
  const canales = [creaCanalWhatsapp()];

  if (config.email.host && config.email.destinatarios.length > 0) {
    canales.push(creaCanalEmail());
  }

  return canales;
}

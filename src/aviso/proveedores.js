import { config } from '../config.js';
import { creaAvisoConsola } from './consola.js';
import { creaAvisoMeta } from './meta.js';
import { creaAvisoTwilio } from './twilio.js';

export function creaAviso(proveedor = config.aviso.proveedor) {
  switch (proveedor) {
    case 'consola':
      return creaAvisoConsola();
    case 'meta':
      return creaAvisoMeta();
    case 'twilio':
      return creaAvisoTwilio();
    default:
      throw new Error(`Proveedor de aviso desconocido: "${proveedor}". Usa "consola", "meta" o "twilio".`);
  }
}

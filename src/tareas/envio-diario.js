import { config } from '../config.js';
import { creaOrigen } from '../origen/index.js';
import { creaAviso } from '../aviso/index.js';
import { generaInforme } from '../informe/diario.js';
import { formateaWhatsapp } from '../informe/whatsapp.js';

// Tarea del envío diario: genera el informe y lo manda por WhatsApp.
// Se programa con cron (ver README) o se lanza a mano con `npm run enviar`.
export async function envioDiario({ origen = creaOrigen(), aviso = creaAviso() } = {}) {
  const informe = await generaInforme(origen);
  const mensaje = formateaWhatsapp(informe);
  const destinatarios = config.aviso.destinatarios;

  if (aviso.nombre !== 'consola' && destinatarios.length === 0) {
    throw new Error('No hay destinatarios: define WHATSAPP_DESTINATARIOS en el .env.');
  }

  const resultados = await aviso.envia(informe, mensaje, destinatarios);
  const fallidos = resultados.filter((r) => !r.enviado && r.motivo !== 'proveedor consola');

  return { informe, mensaje, resultados, fallidos };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const { resultados, fallidos } = await envioDiario();

    for (const r of resultados) {
      console.log(r.enviado ? `✓ enviado a ${r.destinatario} (${r.id ?? 'sin id'})` : `✗ ${r.destinatario}: ${r.motivo}`);
    }

    if (fallidos.length > 0) {
      console.error(`Fallaron ${fallidos.length} de ${resultados.length} envíos.`);
      process.exit(1);
    }
  } catch (error) {
    console.error('Error en el envío diario:', error.message);
    process.exit(1);
  }
}

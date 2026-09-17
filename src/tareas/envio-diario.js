import { creaOrigen } from '../origen/index.js';
import { creaCanales } from '../aviso/index.js';
import { generaInforme } from '../informe/diario.js';

// Tarea del envío diario: genera el informe y lo manda por todos los canales
// configurados (WhatsApp y, si está puesto, correo).
// Se programa con cron (ver README) o se lanza a mano con `npm run enviar`.
export async function envioDiario({ origen = creaOrigen(), canales = creaCanales() } = {}) {
  const informe = await generaInforme(origen);
  const porCanal = [];

  // En serie y con el fallo acotado a su canal: que no salga el correo no
  // puede impedir que salga el WhatsApp, ni al revés.
  for (const canal of canales) {
    try {
      porCanal.push({ canal: canal.nombre, resultados: await canal.envia(informe), error: null });
    } catch (error) {
      porCanal.push({ canal: canal.nombre, resultados: [], error: error.message });
    }
  }

  const fallidos = porCanal.flatMap(({ canal, resultados, error }) => (
    error
      ? [{ canal, destinatario: '(todos)', enviado: false, motivo: error }]
      : resultados
          .filter((r) => !r.enviado && r.motivo !== 'proveedor consola')
          .map((r) => ({ canal, ...r }))
  ));

  return { informe, porCanal, fallidos };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const { porCanal, fallidos } = await envioDiario();

    for (const { canal, resultados, error } of porCanal) {
      if (error) {
        console.error(`✗ ${canal}: ${error}`);
        continue;
      }
      for (const r of resultados) {
        console.log(r.enviado
          ? `✓ ${canal} → ${r.destinatario} (${r.id ?? 'sin id'})`
          : `✗ ${canal} → ${r.destinatario}: ${r.motivo}`);
      }
    }

    if (fallidos.length > 0) {
      console.error(`Fallaron ${fallidos.length} envíos.`);
      process.exit(1);
    }
  } catch (error) {
    console.error('Error en el envío diario:', error.message);
    process.exit(1);
  }
}

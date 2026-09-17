import { config } from './config.js';
import { abreDb } from './db/conexion.js';
import { siembra } from './db/semilla.js';
import { creaOrigen } from './origen/index.js';
import { generaInforme } from './informe/diario.js';
import { formateaTexto, formateaWhatsapp } from './informe/whatsapp.js';
import { envioDiario } from './tareas/envio-diario.js';

const AYUDA = `
Transportes Araya · pendientes de cobro y de pago

  npm run seed        Crea la base local y la rellena con datos de ejemplo
  npm run informe     Imprime el informe de hoy en pantalla
  npm start           Abre el panel web (móvil) en el puerto ${config.web.puerto}
  npm run enviar      Genera el informe y lo manda por WhatsApp

  node src/cli.js whatsapp   Muestra el mensaje tal cual se enviaría
`;

const ordenes = {
  async seed() {
    const resumen = siembra(abreDb());
    console.log(`Base creada en ${config.rutaDb}`);
    console.log(
      `Sembrados: ${resumen.clientes} clientes, ${resumen.proveedores} proveedores, ` +
      `${resumen.facturasEmitidas} facturas emitidas y ${resumen.facturasRecibidas} recibidas.`,
    );
  },

  async informe() {
    console.log(formateaTexto(await generaInforme(creaOrigen())));
  },

  async whatsapp() {
    console.log(formateaWhatsapp(await generaInforme(creaOrigen())));
  },

  async enviar() {
    const { resultados } = await envioDiario();
    for (const r of resultados) {
      console.log(r.enviado ? `✓ ${r.destinatario}` : `✗ ${r.destinatario}: ${r.motivo}`);
    }
  },
};

const orden = process.argv[2];
if (!orden || orden === 'ayuda' || orden === '--help') {
  console.log(AYUDA);
} else if (!ordenes[orden]) {
  console.error(`Orden desconocida: "${orden}".`);
  console.log(AYUDA);
  process.exit(1);
} else {
  try {
    await ordenes[orden]();
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

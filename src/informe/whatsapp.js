import { formateaEuros } from '../dominio/dinero.js';
import { formateaFecha } from '../dominio/fechas.js';
import { config } from '../config.js';

const LIMITE_WHATSAPP = 4096;

function lineaTercero(grupo) {
  const partes = [`• ${grupo.nombre}: *${formateaEuros(grupo.totalCentimos)}*`];
  if (grupo.vencidoCentimos > 0) {
    partes.push(`(${formateaEuros(grupo.vencidoCentimos)} vencido, ${grupo.maxDiasVencida} d.)`);
  }
  if (grupo.numFacturas > 1) partes.push(`— ${grupo.numFacturas} facturas`);
  return partes.join(' ');
}

function seccion(titulo, bloque, etiquetaTercero, maxLineas) {
  const lineas = [`${titulo}: *${formateaEuros(bloque.totalCentimos)}*`];

  if (bloque.numFacturas === 0) {
    lineas.push('  Nada pendiente. ✅');
    return lineas;
  }

  lineas.push(
    `  ${bloque.numFacturas} facturas · ${bloque.numTerceros} ${etiquetaTercero}`,
  );
  if (bloque.vencidoCentimos > 0) {
    lineas.push(`  ⚠️ Vencido: *${formateaEuros(bloque.vencidoCentimos)}* (${bloque.numVencidas} facturas)`);
  }
  if (bloque.venceHoyCentimos > 0) {
    lineas.push(`  📅 Vence hoy: ${formateaEuros(bloque.venceHoyCentimos)}`);
  }

  lineas.push('');
  const mostrados = bloque.porTercero.slice(0, maxLineas);
  lineas.push(...mostrados.map(lineaTercero));

  const restantes = bloque.porTercero.length - mostrados.length;
  if (restantes > 0) lineas.push(`• … y ${restantes} más (ver panel)`);

  return lineas;
}

// Mensaje de WhatsApp: resumen corto y accionable. El detalle completo
// factura a factura se consulta en el panel, que va enlazado al final.
export function formateaWhatsapp(informe, opciones = {}) {
  const maxLineas = opciones.maxLineas ?? config.informe.maxLineasWhatsapp;
  const urlPanel = opciones.urlPanel ?? config.web.urlPublica;

  const lineas = [
    `*TRANSPORTES ARAYA* · ${formateaFecha(informe.fecha)}`,
    '',
    ...seccion('🟢 PENDIENTE DE COBRAR', informe.cobros, 'clientes', maxLineas),
    '',
    ...seccion('🔴 PENDIENTE DE PAGAR', informe.pagos, 'proveedores', maxLineas),
    '',
    `*Saldo neto: ${formateaEuros(informe.saldoNetoCentimos)}*`,
  ];

  if (urlPanel) {
    lineas.push('', `Detalle completo: ${urlPanel}`);
  }

  const mensaje = lineas.join('\n');
  return mensaje.length <= LIMITE_WHATSAPP
    ? mensaje
    : `${mensaje.slice(0, LIMITE_WHATSAPP - 60).trimEnd()}\n…\n(resumen recortado, ver panel)`;
}

// Versión sin emojis ni asteriscos, para consola y correo.
export function formateaTexto(informe) {
  return formateaWhatsapp(informe, { maxLineas: 50 })
    .replaceAll('*', '')
    .replace(/[🟢🔴⚠️📅✅]\uFE0F?\s?/gu, '')
    .replace(/[ \t]+$/gm, '')
    .replace(/^[ \t]+$/gm, '');
}

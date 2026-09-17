import { formateaEuros } from '../dominio/dinero.js';
import { formateaFecha } from '../dominio/fechas.js';
import { formateaTexto } from './whatsapp.js';
import { escapa } from '../web/vistas.js';
import { config } from '../config.js';

// El correo se escribe con estilos en línea y tablas: los gestores de correo
// (Outlook sobre todo) ignoran hojas de estilo, variables CSS y media queries.
const COLOR = {
  plano: '#f9f9f7',
  superficie: '#ffffff',
  tinta: '#0b0b0b',
  tinta2: '#52514e',
  tinta3: '#898781',
  linea: '#e1e0d9',
  cobrar: '#2a78d6',
  pagar: '#eb6834',
  critica: '#d03b3b',
  grave: '#ec835a',
  aviso: '#fab219',
  bien: '#0ca30c',
};

// Cada estado lleva color, icono y texto: el color nunca informa por sí solo,
// porque muchos clientes de correo bloquean o alteran los colores.
const SEVERIDAD = {
  critica: { etiqueta: 'Más de 90 días', icono: '■' },
  grave: { etiqueta: '61-90 días', icono: '■' },
  aviso: { etiqueta: 'Hasta 60 días', icono: '■' },
  bien: { etiqueta: 'Al día', icono: '■' },
};

export function asuntoEmail(informe) {
  const cobrar = formateaEuros(informe.cobros.totalCentimos);
  const pagar = formateaEuros(informe.pagos.totalCentimos);
  return `Transportes Araya · ${formateaFecha(informe.fecha)} · Cobrar ${cobrar} / Pagar ${pagar}`;
}

export function cuerpoTextoEmail(informe, { urlPanel = config.web.urlPanel } = {}) {
  const base = formateaTexto(informe);
  return urlPanel ? `${base}\n\nPanel completo: ${urlPanel}\n` : `${base}\n`;
}

// Las tarjetas van una debajo de otra, a todo el ancho. Lado a lado se
// desbordan en cuanto los importes pasan de cinco dígitos, y en un correo no
// hay clamp() ni media queries con los que arreglarlo después.
function tarjeta(rotulo, bloque, color) {
  const vencido = bloque.vencidoCentimos > 0
    ? `<span style="color:${COLOR.critica};font-weight:600">${escapa(formateaEuros(bloque.vencidoCentimos))} vencido</span>`
    : `<span style="color:${COLOR.tinta3}">Nada vencido</span>`;

  return `<tr><td style="padding-bottom:10px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
           style="background:${COLOR.superficie};border:1px solid ${COLOR.linea};border-left:4px solid ${color};border-radius:10px">
      <tr>
        <td style="padding:12px 14px;font-size:14px;color:${COLOR.tinta2}">
          ${escapa(rotulo)}<br>
          <span style="font-size:13px">${vencido}</span>
        </td>
        <td align="right" valign="middle" style="padding:12px 14px;font-size:22px;font-weight:600;color:${COLOR.tinta}">
          ${escapa(formateaEuros(bloque.totalCentimos))}
        </td>
      </tr>
    </table>
  </td></tr>`;
}

function filaTercero(grupo, indice) {
  const peor = grupo.facturas
    .map((f) => f.tramo.severidad)
    .sort((a, b) => Object.keys(SEVERIDAD).indexOf(a) - Object.keys(SEVERIDAD).indexOf(b))[0];
  const { etiqueta, icono } = SEVERIDAD[peor];
  const fondo = indice % 2 === 0 ? COLOR.superficie : COLOR.plano;

  const vencido = grupo.vencidoCentimos > 0
    ? `<span style="color:${COLOR.critica}">${escapa(formateaEuros(grupo.vencidoCentimos))} vencido</span>`
    : `<span style="color:${COLOR.tinta3}">nada vencido</span>`;

  return `<tr style="background:${fondo}">
    <td style="padding:10px 12px;border-bottom:1px solid ${COLOR.linea};font-size:14px;color:${COLOR.tinta}">
      <strong>${escapa(grupo.nombre)}</strong><br>
      <span style="font-size:12px;color:${COLOR.tinta3}">
        <span style="color:${COLOR[peor]}">${icono}</span> ${escapa(etiqueta)} ·
        ${grupo.numFacturas} fra. · ${vencido} ·
        más antigua ${escapa(formateaFecha(grupo.vencimientoMasAntiguo))}
      </span>
    </td>
    <td align="right" style="padding:10px 12px;border-bottom:1px solid ${COLOR.linea};font-size:15px;font-weight:600;color:${COLOR.tinta};white-space:nowrap">
      ${escapa(formateaEuros(grupo.totalCentimos))}
    </td>
  </tr>`;
}

function seccionEmail(titulo, bloque, etiquetaTercero, vacio) {
  if (bloque.numFacturas === 0) {
    return `<h2 style="font-size:16px;color:${COLOR.tinta};margin:28px 0 6px">${escapa(titulo)}</h2>
      <p style="font-size:14px;color:${COLOR.tinta2};margin:0">${escapa(vacio)}</p>`;
  }

  return `<h2 style="font-size:16px;color:${COLOR.tinta};margin:28px 0 2px">${escapa(titulo)}</h2>
    <p style="font-size:13px;color:${COLOR.tinta3};margin:0 0 8px">
      ${bloque.numFacturas} facturas · ${bloque.numTerceros} ${escapa(etiquetaTercero)}
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
           style="border:1px solid ${COLOR.linea};border-radius:10px;border-collapse:separate;overflow:hidden">
      ${bloque.porTercero.map(filaTercero).join('')}
    </table>`;
}

export function cuerpoHtmlEmail(informe, { urlPanel = config.web.urlPanel } = {}) {
  const fechaLarga = new Intl.DateTimeFormat('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(`${informe.fecha}T12:00:00Z`));

  const enlace = urlPanel
    ? `<p style="margin:24px 0 0;font-size:14px">
         <a href="${escapa(urlPanel)}" style="color:${COLOR.cobrar}">Ver el detalle en el panel</a>
       </p>`
    : '';

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapa(asuntoEmail(informe))}</title></head>
<body style="margin:0;padding:0;background:${COLOR.plano};font-family:system-ui,-apple-system,'Segoe UI',Arial,sans-serif;color:${COLOR.tinta}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLOR.plano}">
<tr><td align="center" style="padding:20px 12px 40px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;text-align:left">

  <tr><td style="padding-bottom:14px;border-bottom:1px solid ${COLOR.linea}">
    <div style="font-size:14px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:${COLOR.tinta2}">Transportes Araya</div>
    <div style="font-size:14px;color:${COLOR.tinta3}">${escapa(fechaLarga)}</div>
  </td></tr>

  <tr><td style="padding:16px 0 6px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${tarjeta('Pendiente de cobrar', informe.cobros, COLOR.cobrar)}
      ${tarjeta('Pendiente de pagar', informe.pagos, COLOR.pagar)}
    </table>
  </td></tr>

  <tr><td style="font-size:14px;color:${COLOR.tinta2}">
    Saldo neto: <strong style="color:${COLOR.tinta}">${escapa(formateaEuros(informe.saldoNetoCentimos))}</strong>
  </td></tr>

  <tr><td>
    ${seccionEmail('Clientes pendientes de cobro', informe.cobros, 'clientes', 'No hay nada pendiente de cobrar.')}
    ${seccionEmail('Proveedores pendientes de pago', informe.pagos, 'proveedores', 'No hay nada pendiente de pagar.')}
    ${enlace}
    <p style="margin:24px 0 0;font-size:12px;color:${COLOR.tinta3};border-top:1px solid ${COLOR.linea};padding-top:12px">
      Los dos listados completos, factura a factura, van adjuntos en CSV para abrirlos en Excel.
    </p>
  </td></tr>

</table>
</td></tr></table>
</body></html>`;
}

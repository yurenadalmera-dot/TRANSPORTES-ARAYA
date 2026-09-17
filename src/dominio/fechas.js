import { config } from '../config.js';

const MS_POR_DIA = 86400000;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

// "Hoy" según la zona horaria de la empresa, no la del servidor: si el
// servidor está en UTC, a las 00:30 de Canarias no debe adelantar el día.
export function hoyISO(ahora = new Date(), zona = config.zonaHoraria) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: zona,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(ahora);
}

export function esISO(valor) {
  return typeof valor === 'string' && ISO.test(valor) && !Number.isNaN(Date.parse(`${valor}T00:00:00Z`));
}

function aUTC(iso) {
  if (!esISO(iso)) throw new TypeError(`Fecha no válida: ${iso}`);
  return Date.parse(`${iso}T00:00:00Z`);
}

// Días completos de 'desde' a 'hasta'. Positivo si 'hasta' es posterior.
export function diasEntre(desde, hasta) {
  return Math.round((aUTC(hasta) - aUTC(desde)) / MS_POR_DIA);
}

export function sumaDias(iso, dias) {
  return new Date(aUTC(iso) + dias * MS_POR_DIA).toISOString().slice(0, 10);
}

export function formateaFecha(iso) {
  if (!esISO(iso)) return '—';
  const [anio, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${anio}`;
}

// Días de retraso de una factura: 0 si aún no ha vencido.
export function diasVencida(fechaVencimiento, hoy = hoyISO()) {
  return Math.max(0, diasEntre(fechaVencimiento, hoy));
}

// Tramo de antigüedad de la deuda, para agrupar el listado.
// `severidad` agrupa los tramos en los cuatro estados con color propio
// (crítica / grave / aviso / bien): el color nunca va solo, siempre con
// su etiqueta al lado.
const TRAMOS = [
  { clave: 'vencido_90',    etiqueta: 'Vencido hace más de 90 días', orden: 0, vencida: true,  severidad: 'critica' },
  { clave: 'vencido_61_90', etiqueta: 'Vencido 61-90 días',          orden: 1, vencida: true,  severidad: 'grave' },
  { clave: 'vencido_31_60', etiqueta: 'Vencido 31-60 días',          orden: 2, vencida: true,  severidad: 'aviso' },
  { clave: 'vencido_1_30',  etiqueta: 'Vencido 1-30 días',           orden: 3, vencida: true,  severidad: 'aviso' },
  { clave: 'vence_hoy',     etiqueta: 'Vence hoy',                   orden: 4, vencida: false, severidad: 'aviso' },
  { clave: 'proximo',       etiqueta: 'Vence pronto',                orden: 5, vencida: false, severidad: 'bien' },
  { clave: 'al_dia',        etiqueta: 'Aún no vencido',              orden: 6, vencida: false, severidad: 'bien' },
];

const porClave = new Map(TRAMOS.map((t) => [t.clave, t]));

export function tramo(fechaVencimiento, hoy = hoyISO(), diasProximo = config.informe.diasProximoVencimiento) {
  const retraso = diasEntre(fechaVencimiento, hoy);
  if (retraso > 90) return porClave.get('vencido_90');
  if (retraso > 60) return porClave.get('vencido_61_90');
  if (retraso > 30) return porClave.get('vencido_31_60');
  if (retraso > 0) return porClave.get('vencido_1_30');
  if (retraso === 0) return porClave.get('vence_hoy');
  if (-retraso <= diasProximo) {
    return { ...porClave.get('proximo'), etiqueta: `Vence en los próximos ${diasProximo} días` };
  }
  return porClave.get('al_dia');
}

export const SEVERIDADES = ['critica', 'grave', 'aviso', 'bien'];

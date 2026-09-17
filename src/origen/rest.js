import { config } from '../config.js';

// Origen de datos contra la API del SaaS que ya está en marcha.
//
// Espera que cada endpoint devuelva un array de facturas pendientes (o un
// objeto { datos: [...] }). Los nombres de campo se aceptan en varias formas
// habituales para no tener que tocar el SaaS: si tu API usa otros, basta con
// ampliar `primero(...)` en la función `normaliza`.

function primero(objeto, claves, porDefecto = null) {
  for (const clave of claves) {
    const valor = objeto[clave];
    if (valor !== undefined && valor !== null && valor !== '') return valor;
  }
  return porDefecto;
}

// La API puede devolver euros con decimales o céntimos enteros.
function aCentimosApi(valor) {
  if (valor === null || valor === undefined) return 0;
  if (typeof valor === 'number') return Math.round(valor * 100);
  const numero = Number.parseFloat(String(valor).replace(',', '.'));
  return Number.isFinite(numero) ? Math.round(numero * 100) : 0;
}

function aFechaIso(valor) {
  if (!valor) return null;
  const texto = String(valor);
  if (/^\d{4}-\d{2}-\d{2}/.test(texto)) return texto.slice(0, 10);
  const [dia, mes, anio] = texto.split(/[/-]/);
  if (dia && mes && anio?.length === 4) return `${anio}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
  return null;
}

function normaliza(fila) {
  const total = primero(fila, ['total_centimos', 'totalCentimos'])
    ?? aCentimosApi(primero(fila, ['total', 'importe', 'importe_total', 'importeTotal'], 0));
  const pendiente = primero(fila, ['pendiente_centimos', 'pendienteCentimos'])
    ?? aCentimosApi(primero(fila, ['pendiente', 'saldo', 'importe_pendiente', 'importePendiente'], 0));

  return {
    facturaId: String(primero(fila, ['id', 'factura_id', 'facturaId'], primero(fila, ['numero'], ''))),
    numero: String(primero(fila, ['numero', 'num_factura', 'numFactura', 'referencia'], '')),
    terceroCodigo: primero(fila, ['tercero_codigo', 'codigo_cliente', 'codigo_proveedor', 'codigo'], ''),
    terceroNombre: primero(fila, ['tercero_nombre', 'cliente', 'proveedor', 'nombre', 'razon_social'], 'Sin nombre'),
    terceroTelefono: primero(fila, ['telefono', 'tercero_telefono', 'movil'], null),
    fechaEmision: aFechaIso(primero(fila, ['fecha_emision', 'fechaEmision', 'fecha'])),
    fechaVencimiento: aFechaIso(primero(fila, ['fecha_vencimiento', 'fechaVencimiento', 'vencimiento'])),
    concepto: primero(fila, ['concepto', 'descripcion'], ''),
    totalCentimos: Number(total),
    pendienteCentimos: Number(pendiente),
  };
}

async function pide(ruta) {
  const base = config.saas.url;
  if (!base) throw new Error('Falta SAAS_API_URL para usar el origen de datos "rest".');

  const respuesta = await fetch(new URL(ruta, base), {
    headers: {
      Accept: 'application/json',
      ...(config.saas.token ? { Authorization: `Bearer ${config.saas.token}` } : {}),
    },
    signal: AbortSignal.timeout(config.saas.timeoutMs),
  });

  if (!respuesta.ok) {
    throw new Error(`El SaaS respondió ${respuesta.status} ${respuesta.statusText} en ${ruta}`);
  }

  const cuerpo = await respuesta.json();
  const filas = Array.isArray(cuerpo) ? cuerpo : (cuerpo.datos ?? cuerpo.data ?? cuerpo.resultados ?? []);
  return filas.map(normaliza).filter((f) => f.pendienteCentimos > 0);
}

export function creaOrigenRest() {
  return {
    nombre: 'rest',
    cobrosPendientes: () => pide(config.saas.rutaCobros),
    pagosPendientes: () => pide(config.saas.rutaPagos),
  };
}

export const _pruebas = { normaliza, aCentimosApi, aFechaIso };

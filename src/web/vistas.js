import { formateaEuros } from '../dominio/dinero.js';
import { formateaFecha } from '../dominio/fechas.js';

export function escapa(valor) {
  return String(valor ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// Cada estado lleva SIEMPRE icono y etiqueta: el color nunca va solo,
// porque dos de estos tonos no llegan a 3:1 sobre fondo claro.
const SEVERIDAD = {
  critica: { etiqueta: 'Vencido hace más de 90 días', corta: '+90 d', icono: '⛔' },
  grave: { etiqueta: 'Vencido entre 61 y 90 días', corta: '61-90 d', icono: '▲' },
  aviso: { etiqueta: 'Vence hoy o vencido hasta 60 días', corta: '≤60 d', icono: '●' },
  bien: { etiqueta: 'Aún no vencido', corta: 'Al día', icono: '✓' },
};

const ESTILOS = `
:root {
  color-scheme: light;
  --plano: #f9f9f7;
  --superficie: #fcfcfb;
  --tinta: #0b0b0b;
  --tinta-2: #52514e;
  --tinta-3: #898781;
  --linea: #e1e0d9;
  --borde: rgba(11, 11, 11, 0.10);
  --critica: #d03b3b;
  --grave: #ec835a;
  --aviso: #fab219;
  --bien: #0ca30c;
  --cobrar: #2a78d6;
  --pagar: #eb6834;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    color-scheme: dark;
    --plano: #0d0d0d;
    --superficie: #1a1a19;
    --tinta: #ffffff;
    --tinta-2: #c3c2b7;
    --tinta-3: #898781;
    --linea: #2c2c2a;
    --borde: rgba(255, 255, 255, 0.10);
    --cobrar: #3987e5;
    --pagar: #d95926;
  }
}
* { box-sizing: border-box; }
body {
  margin: 0;
  background: var(--plano);
  color: var(--tinta);
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
  font-size: 16px;
  line-height: 1.45;
  -webkit-text-size-adjust: 100%;
}
.envoltorio { max-width: 720px; margin: 0 auto; padding: 0 16px 48px; }
header {
  position: sticky; top: 0; z-index: 2;
  background: var(--plano);
  border-bottom: 1px solid var(--linea);
  padding: 14px 0 10px;
}
header h1 { margin: 0; font-size: 15px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--tinta-2); }
header p { margin: 2px 0 0; font-size: 14px; color: var(--tinta-3); }
.tarjetas { display: grid; gap: 10px; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); margin: 16px 0; }
.tarjeta {
  background: var(--superficie);
  border: 1px solid var(--borde);
  border-radius: 12px;
  padding: 14px;
  border-top: 3px solid var(--acento, var(--linea));
  min-width: 0;
}
.tarjeta .rotulo { font-size: 13px; color: var(--tinta-2); margin: 0; }
.tarjeta .valor { font-size: clamp(18px, 5.4vw, 28px); font-weight: 600; margin: 4px 0 2px; letter-spacing: -0.02em; overflow-wrap: break-word; }
.tarjeta .pie { font-size: 13px; color: var(--tinta-3); margin: 0; }
.tarjeta .pie strong { color: var(--critica); font-weight: 600; }
.neto { font-size: 14px; color: var(--tinta-2); margin: 0 0 20px; }
.neto b { color: var(--tinta); }
section { margin: 26px 0 0; }
section > h2 { font-size: 17px; margin: 0 0 2px; }
section > .resumen { margin: 0 0 12px; font-size: 13px; color: var(--tinta-3); }
.barra { display: flex; gap: 2px; height: 10px; margin: 0 0 10px; }
.barra span { border-radius: 4px; min-width: 3px; }
.leyenda { list-style: none; margin: 0 0 16px; padding: 0; display: grid; gap: 4px; }
.leyenda li { display: flex; align-items: baseline; gap: 8px; font-size: 13px; color: var(--tinta-2); }
.leyenda li .txt { flex: 1 1 auto; min-width: 0; }
.leyenda .punto { width: 10px; height: 10px; border-radius: 3px; flex: none; }
.leyenda .importe { margin-left: auto; font-variant-numeric: tabular-nums; color: var(--tinta); }
.lista { display: grid; gap: 8px; }
details.tercero {
  background: var(--superficie);
  border: 1px solid var(--borde);
  border-radius: 12px;
  overflow: hidden;
}
details.tercero > summary {
  cursor: pointer;
  list-style: none;
  padding: 12px 14px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 2px 10px;
  min-height: 44px;
  align-items: center;
}
details.tercero > summary::-webkit-details-marker { display: none; }
.nombre { font-weight: 600; font-size: 15px; overflow-wrap: anywhere; }
.total { font-weight: 600; font-variant-numeric: tabular-nums; text-align: right; }
.meta { font-size: 13px; color: var(--tinta-3); grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: 6px; align-items: center; min-width: 0; }
.meta a { color: var(--tinta-2); }
.etiqueta { display: inline-flex; align-items: center; gap: 4px; border-radius: 999px; padding: 1px 8px; font-size: 12px; font-weight: 600; border: 1px solid currentColor; }
.facturas { list-style: none; margin: 0; padding: 0 14px 12px; border-top: 1px solid var(--linea); }
.facturas li { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 0 10px; padding: 10px 0; border-bottom: 1px solid var(--linea); }
.facturas li:last-child { border-bottom: 0; }
.facturas .num { font-weight: 600; font-size: 14px; }
.facturas .imp { font-variant-numeric: tabular-nums; text-align: right; font-weight: 600; }
.facturas .det { grid-column: 1 / -1; font-size: 13px; color: var(--tinta-3); }
.vacio { background: var(--superficie); border: 1px solid var(--borde); border-radius: 12px; padding: 20px 14px; text-align: center; color: var(--tinta-2); }
.acciones { display: flex; flex-wrap: wrap; gap: 8px; margin: 10px 0 0; }
.acciones a { font-size: 14px; color: var(--tinta-2); text-decoration: none; border: 1px solid var(--borde); border-radius: 999px; padding: 8px 14px; background: var(--superficie); }
footer { margin: 32px 0 0; font-size: 12px; color: var(--tinta-3); border-top: 1px solid var(--linea); padding-top: 12px; }
@media print {
  header { position: static; }
  details.tercero { break-inside: avoid; }
  details.tercero > summary { list-style: none; }
  .acciones { display: none; }
}
`;

function barra(bloque) {
  if (bloque.totalCentimos <= 0) return '';
  const segmentos = bloque.porSeveridad
    .map((grupo) => {
      const ancho = (grupo.totalCentimos / bloque.totalCentimos) * 100;
      const { etiqueta } = SEVERIDAD[grupo.severidad];
      return `<span style="width:${ancho.toFixed(2)}%;background:var(--${grupo.severidad})" title="${escapa(etiqueta)}"></span>`;
    })
    .join('');
  return `<div class="barra" role="img" aria-label="Reparto por antigüedad; el detalle está en la lista siguiente">${segmentos}</div>`;
}

function leyenda(bloque) {
  if (!bloque.porSeveridad.length) return '';
  const filas = bloque.porSeveridad
    .map((grupo) => {
      const { etiqueta, icono } = SEVERIDAD[grupo.severidad];
      return `<li>
        <span class="punto" style="background:var(--${grupo.severidad})"></span>
        <span aria-hidden="true">${icono}</span>
        <span class="txt">${escapa(etiqueta)} · ${grupo.numFacturas} fra.</span>
        <span class="importe">${escapa(formateaEuros(grupo.totalCentimos))}</span>
      </li>`;
    })
    .join('');
  return `<ul class="leyenda">${filas}</ul>`;
}

function factura(f) {
  const retraso = f.diasVencida > 0 ? `vencida hace ${f.diasVencida} días` : `vence el ${formateaFecha(f.fechaVencimiento)}`;
  const concepto = f.concepto ? ` · ${escapa(f.concepto)}` : '';
  return `<li>
    <span class="num">${escapa(f.numero)}</span>
    <span class="imp">${escapa(formateaEuros(f.pendienteCentimos))}</span>
    <span class="det">${escapa(retraso)}${concepto}</span>
  </li>`;
}

function tercero(grupo) {
  const severidadPeor = grupo.facturas
    .map((f) => f.tramo.severidad)
    .sort((a, b) => Object.keys(SEVERIDAD).indexOf(a) - Object.keys(SEVERIDAD).indexOf(b))[0];
  const { icono, corta } = SEVERIDAD[severidadPeor];

  const etiqueta = `<span class="etiqueta" style="color:var(--${severidadPeor})"><span aria-hidden="true">${icono}</span>${escapa(corta)}</span>`;
  const vencido = grupo.vencidoCentimos > 0
    ? `${escapa(formateaEuros(grupo.vencidoCentimos))} vencido`
    : 'nada vencido';
  const telefono = grupo.telefono
    ? ` · <a href="tel:${escapa(grupo.telefono)}" aria-label="Llamar a ${escapa(grupo.nombre)}">Llamar</a>`
    : '';

  return `<details class="tercero">
    <summary>
      <span class="nombre">${escapa(grupo.nombre)}</span>
      <span class="total">${escapa(formateaEuros(grupo.totalCentimos))}</span>
      <span class="meta">${etiqueta} ${grupo.numFacturas} fra. · ${vencido}${telefono}</span>
    </summary>
    <ul class="facturas">${grupo.facturas.map(factura).join('')}</ul>
  </details>`;
}

function seccion({ titulo, bloque, etiquetaTercero, vacio, csv }) {
  if (bloque.numFacturas === 0) {
    return `<section>
      <h2>${escapa(titulo)}</h2>
      <div class="vacio">${escapa(vacio)}</div>
    </section>`;
  }

  return `<section>
    <h2>${escapa(titulo)}</h2>
    <p class="resumen">${bloque.numFacturas} facturas · ${bloque.numTerceros} ${escapa(etiquetaTercero)}</p>
    ${barra(bloque)}
    ${leyenda(bloque)}
    <div class="lista">${bloque.porTercero.map(tercero).join('')}</div>
    <p class="acciones"><a href="${escapa(csv)}">Descargar en Excel (CSV)</a></p>
  </section>`;
}

export function paginaPanel(informe, { origen = '', error = '' } = {}) {
  const fechaLarga = new Intl.DateTimeFormat('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(`${informe.fecha}T12:00:00Z`));

  const avisoError = error
    ? `<div class="vacio" style="color:var(--critica)">${escapa(error)}</div>`
    : '';

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#f9f9f7">
<title>Pendientes · Transportes Araya</title>
<style>${ESTILOS}</style>
</head>
<body>
<div class="envoltorio">
  <header>
    <h1>Transportes Araya</h1>
    <p>${escapa(fechaLarga)}</p>
  </header>

  ${avisoError}

  <div class="tarjetas">
    <div class="tarjeta" style="--acento:var(--cobrar)">
      <p class="rotulo">Pendiente de cobrar</p>
      <p class="valor">${escapa(formateaEuros(informe.cobros.totalCentimos))}</p>
      <p class="pie">${informe.cobros.vencidoCentimos > 0
        ? `<strong>${escapa(formateaEuros(informe.cobros.vencidoCentimos))} vencido</strong>`
        : 'Nada vencido'}</p>
    </div>
    <div class="tarjeta" style="--acento:var(--pagar)">
      <p class="rotulo">Pendiente de pagar</p>
      <p class="valor">${escapa(formateaEuros(informe.pagos.totalCentimos))}</p>
      <p class="pie">${informe.pagos.vencidoCentimos > 0
        ? `<strong>${escapa(formateaEuros(informe.pagos.vencidoCentimos))} vencido</strong>`
        : 'Nada vencido'}</p>
    </div>
  </div>

  <p class="neto">Saldo neto: <b>${escapa(formateaEuros(informe.saldoNetoCentimos))}</b></p>

  ${seccion({
    titulo: 'Clientes pendientes de cobro',
    bloque: informe.cobros,
    etiquetaTercero: 'clientes',
    vacio: 'No hay nada pendiente de cobrar. ✓',
    csv: '/cobros.csv',
  })}

  ${seccion({
    titulo: 'Proveedores pendientes de pago',
    bloque: informe.pagos,
    etiquetaTercero: 'proveedores',
    vacio: 'No hay nada pendiente de pagar. ✓',
    csv: '/pagos.csv',
  })}

  <footer>
    Datos: ${escapa(origen)} · Actualizado al abrir la página.
  </footer>
</div>
</body>
</html>`;
}

export function paginaError(mensaje) {
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Error · Transportes Araya</title><style>${ESTILOS}</style></head>
<body><div class="envoltorio"><header><h1>Transportes Araya</h1></header>
<div class="vacio" style="margin-top:20px;color:var(--critica)">${escapa(mensaje)}</div>
</div></body></html>`;
}

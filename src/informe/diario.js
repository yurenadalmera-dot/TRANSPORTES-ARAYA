import { hoyISO, diasVencida, tramo, SEVERIDADES } from '../dominio/fechas.js';
import { sumaPor } from '../dominio/dinero.js';
import { config } from '../config.js';

// Enriquece cada factura con lo que hace falta para ordenarla y pintarla.
function decora(factura, hoy) {
  const t = tramo(factura.fechaVencimiento, hoy);
  return {
    ...factura,
    diasVencida: diasVencida(factura.fechaVencimiento, hoy),
    tramo: t,
    vencida: t.vencida,
  };
}

// Agrupa por cliente/proveedor: es lo primero que se quiere ver de un vistazo,
// "cuánto me debe cada uno", no factura a factura.
function agrupaPorTercero(facturas) {
  const porClave = new Map();

  for (const factura of facturas) {
    const clave = factura.terceroCodigo || factura.terceroNombre;
    let grupo = porClave.get(clave);
    if (!grupo) {
      grupo = {
        codigo: factura.terceroCodigo,
        nombre: factura.terceroNombre,
        telefono: factura.terceroTelefono,
        totalCentimos: 0,
        vencidoCentimos: 0,
        numFacturas: 0,
        maxDiasVencida: 0,
        vencimientoMasAntiguo: factura.fechaVencimiento,
        facturas: [],
      };
      porClave.set(clave, grupo);
    }

    grupo.totalCentimos += factura.pendienteCentimos;
    if (factura.vencida) grupo.vencidoCentimos += factura.pendienteCentimos;
    grupo.numFacturas += 1;
    grupo.maxDiasVencida = Math.max(grupo.maxDiasVencida, factura.diasVencida);
    if (factura.fechaVencimiento < grupo.vencimientoMasAntiguo) {
      grupo.vencimientoMasAntiguo = factura.fechaVencimiento;
    }
    grupo.facturas.push(factura);
  }

  // Primero quien más debe vencido; a igualdad, quien más debe en total.
  return [...porClave.values()].sort(
    (a, b) => b.vencidoCentimos - a.vencidoCentimos || b.totalCentimos - a.totalCentimos,
  );
}

function agrupaPorTramo(facturas) {
  const porClave = new Map();

  for (const factura of facturas) {
    const { clave, etiqueta, orden } = factura.tramo;
    const grupo = porClave.get(clave) ?? { clave, etiqueta, orden, totalCentimos: 0, numFacturas: 0 };
    grupo.totalCentimos += factura.pendienteCentimos;
    grupo.numFacturas += 1;
    porClave.set(clave, grupo);
  }

  return [...porClave.values()].sort((a, b) => a.orden - b.orden);
}

// Reparto por gravedad, que es lo que colorea la barra del panel.
function agrupaPorSeveridad(facturas) {
  const acumulado = new Map(SEVERIDADES.map((s) => [s, { severidad: s, totalCentimos: 0, numFacturas: 0 }]));

  for (const factura of facturas) {
    const grupo = acumulado.get(factura.tramo.severidad);
    grupo.totalCentimos += factura.pendienteCentimos;
    grupo.numFacturas += 1;
  }

  return [...acumulado.values()].filter((g) => g.numFacturas > 0);
}

function construyeBloque(facturasCrudas, hoy) {
  const facturas = facturasCrudas
    .map((f) => decora(f, hoy))
    .sort((a, b) => a.fechaVencimiento.localeCompare(b.fechaVencimiento));

  const vencidas = facturas.filter((f) => f.vencida);
  const venceHoy = facturas.filter((f) => f.tramo.clave === 'vence_hoy');
  const proximas = facturas.filter((f) => f.tramo.clave === 'proximo');

  return {
    facturas,
    porTercero: agrupaPorTercero(facturas),
    porTramo: agrupaPorTramo(facturas),
    porSeveridad: agrupaPorSeveridad(facturas),
    totalCentimos: sumaPor(facturas),
    vencidoCentimos: sumaPor(vencidas),
    venceHoyCentimos: sumaPor(venceHoy),
    proximoCentimos: sumaPor(proximas),
    numFacturas: facturas.length,
    numVencidas: vencidas.length,
    numTerceros: new Set(facturas.map((f) => f.terceroCodigo || f.terceroNombre)).size,
  };
}

// Informe completo del día: lo que nos deben y lo que debemos.
export async function generaInforme(origen, { hoy = hoyISO() } = {}) {
  const [cobrosCrudos, pagosCrudos] = await Promise.all([
    origen.cobrosPendientes(),
    origen.pagosPendientes(),
  ]);

  const cobros = construyeBloque(cobrosCrudos, hoy);
  const pagos = construyeBloque(pagosCrudos, hoy);

  return {
    fecha: hoy,
    diasProximoVencimiento: config.informe.diasProximoVencimiento,
    cobros,
    pagos,
    // Positivo: vamos a cobrar más de lo que tenemos que pagar.
    saldoNetoCentimos: cobros.totalCentimos - pagos.totalCentimos,
    saldoNetoVencidoCentimos: cobros.vencidoCentimos - pagos.vencidoCentimos,
  };
}

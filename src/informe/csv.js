import { formateaFecha } from '../dominio/fechas.js';

function celda(valor) {
  const texto = String(valor ?? '');
  return /[";\n]/.test(texto) ? `"${texto.replaceAll('"', '""')}"` : texto;
}

const euros = (centimos) => (centimos / 100).toFixed(2).replace('.', ',');

// Excel en español espera punto y coma como separador y coma decimal.
// El BOM del principio evita que destroce las tildes al abrirlo.
export function aCsv(facturas, etiquetaTercero) {
  const cabecera = [
    'Nº factura', etiquetaTercero, 'Código', 'Fecha emisión', 'Vencimiento',
    'Días vencida', 'Total', 'Pendiente', 'Concepto',
  ];

  const lineas = facturas.map((f) => [
    f.numero, f.terceroNombre, f.terceroCodigo,
    formateaFecha(f.fechaEmision), formateaFecha(f.fechaVencimiento),
    f.diasVencida, euros(f.totalCentimos), euros(f.pendienteCentimos), f.concepto,
  ].map(celda).join(';'));

  return `﻿${[cabecera.join(';'), ...lineas].join('\r\n')}\r\n`;
}

// Los dos listados como ficheros listos para adjuntar al correo.
export function adjuntosDelInforme(informe) {
  return [
    {
      nombre: `cobros-pendientes-${informe.fecha}.csv`,
      tipo: 'text/csv; charset=utf-8',
      contenido: Buffer.from(aCsv(informe.cobros.facturas, 'Cliente'), 'utf8'),
    },
    {
      nombre: `pagos-pendientes-${informe.fecha}.csv`,
      tipo: 'text/csv; charset=utf-8',
      contenido: Buffer.from(aCsv(informe.pagos.facturas, 'Proveedor'), 'utf8'),
    },
  ];
}

// Origen de datos respaldado por la base local del proyecto.

const COLUMNAS = `
  factura_id, numero, tercero_codigo, tercero_nombre, tercero_telefono,
  fecha_emision, fecha_vencimiento, concepto, total_centimos, pendiente_centimos
`;

function normaliza(fila) {
  return {
    facturaId: String(fila.factura_id),
    numero: fila.numero,
    terceroCodigo: fila.tercero_codigo,
    terceroNombre: fila.tercero_nombre,
    terceroTelefono: fila.tercero_telefono ?? null,
    fechaEmision: fila.fecha_emision,
    fechaVencimiento: fila.fecha_vencimiento,
    concepto: fila.concepto ?? '',
    totalCentimos: Number(fila.total_centimos),
    pendienteCentimos: Number(fila.pendiente_centimos),
  };
}

export function creaOrigenSqlite(db) {
  const consulta = (vista) =>
    db.prepare(`SELECT ${COLUMNAS} FROM ${vista} ORDER BY fecha_vencimiento ASC, tercero_nombre ASC`);

  return {
    nombre: 'sqlite',
    async cobrosPendientes() {
      return consulta('v_cobros_pendientes').all().map(normaliza);
    },
    async pagosPendientes() {
      return consulta('v_pagos_pendientes').all().map(normaliza);
    },
  };
}

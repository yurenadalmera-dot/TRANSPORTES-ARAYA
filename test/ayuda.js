import { abreDb } from '../src/db/conexion.js';
import { creaOrigenSqlite } from '../src/origen/sqlite.js';
import { aCentimos } from '../src/dominio/dinero.js';

export const HOY = '2026-09-17';

// Base en memoria para cada prueba: rápida y sin restos entre pruebas.
export function baseDePrueba() {
  const db = abreDb(':memory:');

  const insCliente = db.prepare('INSERT INTO clientes (codigo, nombre, telefono) VALUES (?, ?, ?)');
  const insProveedor = db.prepare('INSERT INTO proveedores (codigo, nombre, telefono) VALUES (?, ?, ?)');

  const insEmitida = db.prepare(
    `INSERT INTO facturas_emitidas (numero, cliente_id, fecha_emision, fecha_vencimiento, base_centimos, total_centimos, concepto, anulada)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insRecibida = db.prepare(
    `INSERT INTO facturas_recibidas (numero, proveedor_id, fecha_emision, fecha_vencimiento, base_centimos, total_centimos, concepto, anulada)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insCobro = db.prepare('INSERT INTO cobros (factura_id, fecha, importe_centimos) VALUES (?, ?, ?)');
  const insPago = db.prepare('INSERT INTO pagos (factura_id, fecha, importe_centimos) VALUES (?, ?, ?)');

  const api = {
    db,
    origen: creaOrigenSqlite(db),

    cliente(codigo, nombre, telefono = null) {
      return insCliente.run(codigo, nombre, telefono).lastInsertRowid;
    },
    proveedor(codigo, nombre, telefono = null) {
      return insProveedor.run(codigo, nombre, telefono).lastInsertRowid;
    },

    emitida({ numero, clienteId, vence, total, emision = '2026-08-01', concepto = '', anulada = 0, cobrado = null }) {
      const centimos = aCentimos(total);
      const id = insEmitida.run(numero, clienteId, emision, vence, centimos, centimos, concepto, anulada).lastInsertRowid;
      if (cobrado !== null) insCobro.run(id, emision, aCentimos(cobrado));
      return id;
    },

    recibida({ numero, proveedorId, vence, total, emision = '2026-08-01', concepto = '', anulada = 0, pagado = null }) {
      const centimos = aCentimos(total);
      const id = insRecibida.run(numero, proveedorId, emision, vence, centimos, centimos, concepto, anulada).lastInsertRowid;
      if (pagado !== null) insPago.run(id, emision, aCentimos(pagado));
      return id;
    },
  };

  return api;
}

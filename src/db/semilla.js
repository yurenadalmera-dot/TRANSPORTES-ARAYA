import { hoyISO, sumaDias } from '../dominio/fechas.js';
import { aCentimos } from '../dominio/dinero.js';

// Datos de ejemplo para poder ver el panel funcionando antes de conectar
// los datos reales. Las fechas son relativas a hoy, así el ejemplo siempre
// enseña facturas vencidas, al día y por vencer.

const CLIENTES = [
  { codigo: 'C001', nombre: 'Frigoríficos Majoreros S.L.', nif: 'B35123456', telefono: '+34928500101', email: 'admin@frigmajoreros.es', dias_pago: 30 },
  { codigo: 'C002', nombre: 'Distribuciones Tindaya', nif: 'B35234567', telefono: '+34928500102', email: 'pagos@tindaya.es', dias_pago: 60 },
  { codigo: 'C003', nombre: 'Hotel Costa Calma S.A.', nif: 'A35345678', telefono: '+34928500103', email: 'compras@costacalma.com', dias_pago: 45 },
  { codigo: 'C004', nombre: 'Construcciones Betancort', nif: 'B35456789', telefono: '+34928500104', email: 'oficina@betancort.es', dias_pago: 30 },
  { codigo: 'C005', nombre: 'Agrícola La Oliva S.C.', nif: 'F35567890', telefono: '+34928500105', email: 'laoliva@agricola.es', dias_pago: 30 },
];

const PROVEEDORES = [
  { codigo: 'P001', nombre: 'Disa Combustibles Canarias', nif: 'A38111222', telefono: '+34922700201', email: 'facturacion@disa.es', dias_pago: 30 },
  { codigo: 'P002', nombre: 'Neumáticos Puerto del Rosario', nif: 'B35222333', telefono: '+34928700202', email: 'taller@neumaticospr.es', dias_pago: 30 },
  { codigo: 'P003', nombre: 'Talleres Gran Tarajal', nif: 'B35333444', telefono: '+34928700203', email: 'admin@tallerestarajal.es', dias_pago: 15 },
  { codigo: 'P004', nombre: 'Seguros Atlántico Mediación', nif: 'B35444555', telefono: '+34928700204', email: 'polizas@atlantico.es', dias_pago: 60 },
  { codigo: 'P005', nombre: 'Recambios Insulares S.L.', nif: 'B35555666', telefono: '+34928700205', email: 'pedidos@recambiosinsulares.es', dias_pago: 30 },
];

// [código, nº factura, días desde hoy de la emisión, días de plazo, importe, concepto, cobrado/pagado]
const EMITIDAS = [
  ['C001', 'FE-2026-0181', -120, 30, '4.250,00', 'Portes refrigerados septiembre', '0'],
  ['C001', 'FE-2026-0207', -75, 30, '3.180,50', 'Portes refrigerados octubre', '1.000,00'],
  ['C002', 'FE-2026-0212', -70, 60, '8.940,00', 'Distribución isla Fuerteventura', '0'],
  ['C002', 'FE-2026-0240', -40, 60, '6.125,75', 'Distribución isla Fuerteventura', '0'],
  ['C003', 'FE-2026-0251', -50, 45, '12.400,00', 'Traslados hotel temporada alta', '4.400,00'],
  ['C003', 'FE-2026-0266', -20, 45, '5.760,00', 'Traslados hotel', '0'],
  ['C004', 'FE-2026-0272', -35, 30, '2.310,00', 'Transporte áridos obra Corralejo', '0'],
  ['C004', 'FE-2026-0288', -12, 30, '1.890,00', 'Transporte áridos obra Corralejo', '0'],
  ['C005', 'FE-2026-0291', -8, 30, '3.450,00', 'Portes agrícolas', '0'],
  ['C005', 'FE-2026-0295', -2, 30, '2.120,00', 'Portes agrícolas', '0'],
  ['C001', 'FE-2026-0298', -1, 30, '4.875,00', 'Portes refrigerados noviembre', '0'],
];

const RECIBIDAS = [
  ['P001', 'A-99812', -95, 30, '9.870,40', 'Gasóleo flota', '0'],
  ['P001', 'A-10233', -45, 30, '8.215,90', 'Gasóleo flota', '3.000,00'],
  ['P002', 'N-4471', -52, 30, '3.640,00', 'Juego neumáticos camión 3', '0'],
  ['P003', 'T-2288', -25, 15, '1.980,25', 'Reparación embrague', '0'],
  ['P003', 'T-2310', -9, 15, '745,60', 'Revisión ITV flota', '0'],
  ['P004', 'S-7001', -40, 60, '5.400,00', 'Renovación póliza flota', '0'],
  ['P005', 'R-6620', -14, 30, '1.230,45', 'Recambios varios', '0'],
  ['P005', 'R-6688', -3, 30, '890,00', 'Filtros y aceite', '0'],
];

const IMPUESTO = 0.07; // IGIC general

function desglosa(totalTexto) {
  const total = aCentimos(totalTexto);
  const base = Math.round(total / (1 + IMPUESTO));
  return { total, base, impuestos: total - base };
}

export function siembra(db, { hoy = hoyISO() } = {}) {
  const insertaTercero = (tabla) =>
    db.prepare(
      `INSERT INTO ${tabla} (codigo, nombre, nif, telefono, email, dias_pago)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );

  db.exec('BEGIN');
  try {
    // Se parte de cero para que volver a sembrar no duplique nada.
    for (const tabla of ['cobros', 'pagos', 'facturas_emitidas', 'facturas_recibidas', 'clientes', 'proveedores']) {
      db.exec(`DELETE FROM ${tabla}`);
    }

    const insClientes = insertaTercero('clientes');
    for (const c of CLIENTES) insClientes.run(c.codigo, c.nombre, c.nif, c.telefono, c.email, c.dias_pago);

    const insProveedores = insertaTercero('proveedores');
    for (const p of PROVEEDORES) insProveedores.run(p.codigo, p.nombre, p.nif, p.telefono, p.email, p.dias_pago);

    const idPorCodigo = (tabla) =>
      new Map(db.prepare(`SELECT id, codigo FROM ${tabla}`).all().map((f) => [f.codigo, f.id]));

    const clientes = idPorCodigo('clientes');
    const proveedores = idPorCodigo('proveedores');

    const insEmitida = db.prepare(
      `INSERT INTO facturas_emitidas
         (numero, cliente_id, fecha_emision, fecha_vencimiento, base_centimos, impuestos_centimos, total_centimos, concepto)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const insRecibida = db.prepare(
      `INSERT INTO facturas_recibidas
         (numero, proveedor_id, fecha_emision, fecha_vencimiento, base_centimos, impuestos_centimos, total_centimos, concepto)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const insCobro = db.prepare('INSERT INTO cobros (factura_id, fecha, importe_centimos, metodo) VALUES (?, ?, ?, ?)');
    const insPago = db.prepare('INSERT INTO pagos (factura_id, fecha, importe_centimos, metodo) VALUES (?, ?, ?, ?)');

    const carga = (filas, terceros, insFactura, insSaldo, metodo) => {
      for (const [codigo, numero, diasEmision, plazo, totalTexto, concepto, saldadoTexto] of filas) {
        const emision = sumaDias(hoy, diasEmision);
        const { total, base, impuestos } = desglosa(totalTexto);
        const { lastInsertRowid } = insFactura.run(
          numero, terceros.get(codigo), emision, sumaDias(emision, plazo), base, impuestos, total, concepto,
        );
        const saldado = aCentimos(saldadoTexto);
        if (saldado > 0) {
          insSaldo.run(lastInsertRowid, sumaDias(emision, Math.min(plazo, 20)), saldado, metodo);
        }
      }
    };

    carga(EMITIDAS, clientes, insEmitida, insCobro, 'transferencia');
    carga(RECIBIDAS, proveedores, insRecibida, insPago, 'transferencia');

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  return {
    clientes: CLIENTES.length,
    proveedores: PROVEEDORES.length,
    facturasEmitidas: EMITIDAS.length,
    facturasRecibidas: RECIBIDAS.length,
  };
}

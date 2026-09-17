import test from 'node:test';
import assert from 'node:assert/strict';
import { _pruebas } from '../src/origen/rest.js';
import { creaOrigen } from '../src/origen/index.js';
import { baseDePrueba, HOY } from './ayuda.js';
import { generaInforme } from '../src/informe/diario.js';

const { normaliza, aCentimosApi, aFechaIso } = _pruebas;

test('el adaptador REST acepta importes en euros o en céntimos', () => {
  assert.equal(aCentimosApi(1234.56), 123456);
  assert.equal(aCentimosApi('1234.56'), 123456);
  assert.equal(aCentimosApi('1234,56'), 123456);
  assert.equal(aCentimosApi(null), 0);
});

test('el adaptador REST entiende las fechas en ISO y en formato español', () => {
  assert.equal(aFechaIso('2026-09-17'), '2026-09-17');
  assert.equal(aFechaIso('2026-09-17T10:00:00Z'), '2026-09-17');
  assert.equal(aFechaIso('17/09/2026'), '2026-09-17');
  assert.equal(aFechaIso('7/9/2026'), '2026-09-07');
  assert.equal(aFechaIso(null), null);
});

test('el adaptador REST reconoce los nombres de campo más habituales', () => {
  const fila = normaliza({
    id: 42,
    numero: 'FE-1',
    cliente: 'Cliente Uno',
    telefono: '+34600000001',
    fecha_emision: '01/08/2026',
    vencimiento: '31/08/2026',
    importe_total: 1000,
    importe_pendiente: 250.5,
    concepto: 'Portes',
  });

  assert.deepEqual(fila, {
    facturaId: '42',
    numero: 'FE-1',
    terceroCodigo: '',
    terceroNombre: 'Cliente Uno',
    terceroTelefono: '+34600000001',
    fechaEmision: '2026-08-01',
    fechaVencimiento: '2026-08-31',
    concepto: 'Portes',
    totalCentimos: 100000,
    pendienteCentimos: 25050,
  });
});

test('si el SaaS ya manda céntimos, no se vuelven a multiplicar', () => {
  const fila = normaliza({ numero: 'FE-2', nombre: 'X', total_centimos: 100000, pendiente_centimos: 25050 });
  assert.equal(fila.totalCentimos, 100000);
  assert.equal(fila.pendienteCentimos, 25050);
});

test('creaOrigen avisa cuando el origen configurado no existe', () => {
  assert.throws(() => creaOrigen('mongodb'), /Origen de datos desconocido/);
});

test('un origen cualquiera con los dos métodos sirve para el informe', async () => {
  // El informe no sabe de dónde salen los datos: este origen es un objeto suelto.
  const origen = {
    nombre: 'inventado',
    async cobrosPendientes() {
      return [{
        facturaId: '1', numero: 'F1', terceroCodigo: 'C1', terceroNombre: 'Cliente Uno',
        terceroTelefono: null, fechaEmision: '2026-08-01', fechaVencimiento: '2026-09-01',
        concepto: '', totalCentimos: 10000, pendienteCentimos: 10000,
      }];
    },
    async pagosPendientes() {
      return [];
    },
  };

  const informe = await generaInforme(origen, { hoy: HOY });
  assert.equal(informe.cobros.totalCentimos, 10000);
  assert.equal(informe.cobros.porTercero[0].nombre, 'Cliente Uno');
});

test('la vista de saldos no deja pasar facturas cobradas de más', async () => {
  const base = baseDePrueba();
  const cliente = base.cliente('C1', 'Cliente Uno');
  base.emitida({ numero: 'F1', clienteId: cliente, vence: '2026-09-01', total: '100,00', cobrado: '150,00' });

  const informe = await generaInforme(base.origen, { hoy: HOY });
  assert.equal(informe.cobros.numFacturas, 0);
});

test('sembrar dos veces no duplica los datos de ejemplo', async () => {
  const { abreDb } = await import('../src/db/conexion.js');
  const { siembra } = await import('../src/db/semilla.js');
  const { creaOrigenSqlite } = await import('../src/origen/sqlite.js');

  const db = abreDb(':memory:');
  siembra(db, { hoy: HOY });
  const primero = await generaInforme(creaOrigenSqlite(db), { hoy: HOY });

  siembra(db, { hoy: HOY });
  const segundo = await generaInforme(creaOrigenSqlite(db), { hoy: HOY });

  assert.equal(segundo.cobros.numFacturas, primero.cobros.numFacturas);
  assert.equal(segundo.cobros.totalCentimos, primero.cobros.totalCentimos);
  assert.equal(segundo.pagos.totalCentimos, primero.pagos.totalCentimos);
  assert.ok(primero.cobros.numFacturas > 0);
});

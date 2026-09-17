import test from 'node:test';
import assert from 'node:assert/strict';
import { baseDePrueba, HOY } from './ayuda.js';
import { generaInforme } from '../src/informe/diario.js';
import { formateaWhatsapp, formateaTexto } from '../src/informe/whatsapp.js';
import { aCentimos } from '../src/dominio/dinero.js';

test('una factura cobrada del todo desaparece del listado', async () => {
  const base = baseDePrueba();
  const cliente = base.cliente('C1', 'Cliente Uno');
  base.emitida({ numero: 'F1', clienteId: cliente, vence: '2026-09-01', total: '1.000,00', cobrado: '1.000,00' });
  base.emitida({ numero: 'F2', clienteId: cliente, vence: '2026-09-01', total: '500,00' });

  const informe = await generaInforme(base.origen, { hoy: HOY });

  assert.equal(informe.cobros.numFacturas, 1);
  assert.equal(informe.cobros.facturas[0].numero, 'F2');
  assert.equal(informe.cobros.totalCentimos, aCentimos('500,00'));
});

test('un cobro parcial deja pendiente solo el resto', async () => {
  const base = baseDePrueba();
  const cliente = base.cliente('C1', 'Cliente Uno');
  base.emitida({ numero: 'F1', clienteId: cliente, vence: '2026-09-01', total: '1.000,00', cobrado: '350,50' });

  const informe = await generaInforme(base.origen, { hoy: HOY });

  assert.equal(informe.cobros.totalCentimos, aCentimos('649,50'));
  assert.equal(informe.cobros.facturas[0].totalCentimos, aCentimos('1.000,00'));
});

test('las facturas anuladas no cuentan', async () => {
  const base = baseDePrueba();
  const cliente = base.cliente('C1', 'Cliente Uno');
  base.emitida({ numero: 'F1', clienteId: cliente, vence: '2026-09-01', total: '1.000,00', anulada: 1 });

  const informe = await generaInforme(base.origen, { hoy: HOY });

  assert.equal(informe.cobros.numFacturas, 0);
  assert.equal(informe.cobros.totalCentimos, 0);
});

test('solo se suma como vencido lo que ya pasó de fecha', async () => {
  const base = baseDePrueba();
  const cliente = base.cliente('C1', 'Cliente Uno');
  base.emitida({ numero: 'F1', clienteId: cliente, vence: '2026-09-10', total: '100,00' }); // vencida
  base.emitida({ numero: 'F2', clienteId: cliente, vence: '2026-09-17', total: '200,00' }); // vence hoy
  base.emitida({ numero: 'F3', clienteId: cliente, vence: '2026-10-30', total: '400,00' }); // futura

  const informe = await generaInforme(base.origen, { hoy: HOY });

  assert.equal(informe.cobros.totalCentimos, aCentimos('700,00'));
  assert.equal(informe.cobros.vencidoCentimos, aCentimos('100,00'));
  assert.equal(informe.cobros.venceHoyCentimos, aCentimos('200,00'));
  assert.equal(informe.cobros.numVencidas, 1);
});

test('el listado se agrupa por cliente y saca primero al que más debe vencido', async () => {
  const base = baseDePrueba();
  const uno = base.cliente('C1', 'Cliente Uno', '+34600000001');
  const dos = base.cliente('C2', 'Cliente Dos');

  base.emitida({ numero: 'F1', clienteId: uno, vence: '2026-09-10', total: '100,00' });
  base.emitida({ numero: 'F2', clienteId: uno, vence: '2026-10-30', total: '50,00' });
  base.emitida({ numero: 'F3', clienteId: dos, vence: '2026-06-01', total: '900,00' });

  const informe = await generaInforme(base.origen, { hoy: HOY });
  const [primero, segundo] = informe.cobros.porTercero;

  assert.equal(informe.cobros.numTerceros, 2);
  assert.equal(primero.nombre, 'Cliente Dos');
  assert.equal(primero.vencidoCentimos, aCentimos('900,00'));
  assert.equal(segundo.nombre, 'Cliente Uno');
  assert.equal(segundo.numFacturas, 2);
  assert.equal(segundo.totalCentimos, aCentimos('150,00'));
  assert.equal(segundo.vencidoCentimos, aCentimos('100,00'));
  assert.equal(segundo.telefono, '+34600000001');
  assert.equal(segundo.vencimientoMasAntiguo, '2026-09-10');
});

test('el saldo neto es lo que nos deben menos lo que debemos', async () => {
  const base = baseDePrueba();
  const cliente = base.cliente('C1', 'Cliente Uno');
  const proveedor = base.proveedor('P1', 'Proveedor Uno');

  base.emitida({ numero: 'F1', clienteId: cliente, vence: '2026-09-10', total: '1.000,00' });
  base.recibida({ numero: 'R1', proveedorId: proveedor, vence: '2026-09-10', total: '400,00' });

  const informe = await generaInforme(base.origen, { hoy: HOY });

  assert.equal(informe.saldoNetoCentimos, aCentimos('600,00'));
  assert.equal(informe.pagos.totalCentimos, aCentimos('400,00'));
  assert.equal(informe.pagos.porTercero[0].nombre, 'Proveedor Uno');
});

test('el reparto por gravedad suma exactamente el total pendiente', async () => {
  const base = baseDePrueba();
  const cliente = base.cliente('C1', 'Cliente Uno');
  base.emitida({ numero: 'F1', clienteId: cliente, vence: '2026-01-01', total: '100,00' }); // +90 días
  base.emitida({ numero: 'F2', clienteId: cliente, vence: '2026-07-01', total: '200,00' }); // 61-90
  base.emitida({ numero: 'F3', clienteId: cliente, vence: '2026-09-01', total: '300,00' }); // 1-30
  base.emitida({ numero: 'F4', clienteId: cliente, vence: '2026-12-01', total: '400,00' }); // al día

  const informe = await generaInforme(base.origen, { hoy: HOY });
  const reparto = informe.cobros.porSeveridad;
  const suma = reparto.reduce((total, g) => total + g.totalCentimos, 0);

  assert.equal(suma, informe.cobros.totalCentimos);
  assert.deepEqual(reparto.map((g) => g.severidad), ['critica', 'grave', 'aviso', 'bien']);
});

test('sin nada pendiente el informe queda a cero y no revienta', async () => {
  const base = baseDePrueba();
  const informe = await generaInforme(base.origen, { hoy: HOY });

  assert.equal(informe.cobros.totalCentimos, 0);
  assert.equal(informe.cobros.porTercero.length, 0);
  assert.equal(informe.saldoNetoCentimos, 0);
  assert.match(formateaWhatsapp(informe), /Nada pendiente/);
});

test('el mensaje de WhatsApp lleva los totales y el enlace al panel', async () => {
  const base = baseDePrueba();
  const cliente = base.cliente('C1', 'Cliente Uno');
  base.emitida({ numero: 'F1', clienteId: cliente, vence: '2026-09-10', total: '1.234,56' });

  const informe = await generaInforme(base.origen, { hoy: HOY });
  const mensaje = formateaWhatsapp(informe, { urlPanel: 'https://panel.ejemplo/araya' });

  assert.match(mensaje, /TRANSPORTES ARAYA/);
  assert.match(mensaje, /17\/09\/2026/);
  assert.match(mensaje, /1\.234,56/);
  assert.match(mensaje, /Cliente Uno/);
  assert.match(mensaje, /https:\/\/panel\.ejemplo\/araya/);
});

test('el mensaje recorta la lista larga pero nunca pasa del límite de WhatsApp', async () => {
  const base = baseDePrueba();
  for (let i = 0; i < 60; i += 1) {
    const cliente = base.cliente(`C${i}`, `Cliente con un nombre razonablemente largo número ${i}`);
    base.emitida({ numero: `F${i}`, clienteId: cliente, vence: '2026-09-10', total: '1.234,56' });
  }

  const informe = await generaInforme(base.origen, { hoy: HOY });
  const mensaje = formateaWhatsapp(informe, { maxLineas: 8 });

  assert.ok(mensaje.length <= 4096, `el mensaje mide ${mensaje.length}`);
  assert.match(mensaje, /y 52 más/);
});

test('la versión de texto plano quita emojis y asteriscos', async () => {
  const base = baseDePrueba();
  const cliente = base.cliente('C1', 'Cliente Uno');
  base.emitida({ numero: 'F1', clienteId: cliente, vence: '2026-09-10', total: '100,00' });

  const texto = formateaTexto(await generaInforme(base.origen, { hoy: HOY }));

  assert.ok(!texto.includes('*'));
  assert.ok(!/[🟢🔴⚠📅✅]/u.test(texto));
  assert.match(texto, /^PENDIENTE DE COBRAR/m);
});

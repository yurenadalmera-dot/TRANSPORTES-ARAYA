import test from 'node:test';
import assert from 'node:assert/strict';
import { aCentimos, formateaEuros, sumaPor } from '../src/dominio/dinero.js';
import { hoyISO, diasEntre, sumaDias, formateaFecha, diasVencida, tramo } from '../src/dominio/fechas.js';

test('aCentimos entiende los formatos que llegan de una hoja de cálculo', () => {
  assert.equal(aCentimos('1.234,56 €'), 123456);
  assert.equal(aCentimos('1234.56'), 123456);
  assert.equal(aCentimos('890,00'), 89000);
  assert.equal(aCentimos(12.3), 1230);
  assert.equal(aCentimos('0'), 0);
  assert.throws(() => aCentimos('no es un importe'), TypeError);
});

test('los importes se redondean a céntimos sin errores de coma flotante', () => {
  assert.equal(aCentimos('0,07') * 3, 21);
  assert.equal(aCentimos('19,99'), 1999);
});

test('formateaEuros agrupa siempre los millares', () => {
  assert.equal(formateaEuros(425000), '4.250,00 €');
  assert.equal(formateaEuros(2143050), '21.430,50 €');
  assert.equal(formateaEuros(0), '0,00 €');
});

test('sumaPor acumula el pendiente de una lista', () => {
  assert.equal(sumaPor([{ pendienteCentimos: 100 }, { pendienteCentimos: 250 }]), 350);
  assert.equal(sumaPor([]), 0);
});

test('hoyISO usa la zona horaria de la empresa, no la del servidor', () => {
  // En verano Canarias va una hora por delante de UTC: a las 23:30 UTC del
  // día 4 allí ya es día 5, y el informe del día debe salir con esa fecha.
  const nocheVerano = new Date('2026-07-04T23:30:00Z');
  assert.equal(hoyISO(nocheVerano, 'Atlantic/Canary'), '2026-07-05');
  assert.equal(hoyISO(nocheVerano, 'UTC'), '2026-07-04');

  // En invierno Canarias coincide con UTC, y Madrid va una hora por delante.
  const nocheInvierno = new Date('2026-01-04T23:30:00Z');
  assert.equal(hoyISO(nocheInvierno, 'Atlantic/Canary'), '2026-01-04');
  assert.equal(hoyISO(nocheInvierno, 'Europe/Madrid'), '2026-01-05');
});

test('diasEntre y sumaDias cuadran, incluso cruzando meses y años', () => {
  assert.equal(diasEntre('2026-09-17', '2026-09-20'), 3);
  assert.equal(diasEntre('2026-09-20', '2026-09-17'), -3);
  assert.equal(diasEntre('2026-12-31', '2027-01-01'), 1);
  assert.equal(sumaDias('2026-02-27', 2), '2026-03-01');
  assert.equal(sumaDias('2026-01-01', -1), '2025-12-31');
});

test('formateaFecha devuelve el formato español y aguanta datos sucios', () => {
  assert.equal(formateaFecha('2026-09-17'), '17/09/2026');
  assert.equal(formateaFecha(null), '—');
  assert.equal(formateaFecha('vencida'), '—');
});

test('diasVencida nunca es negativo', () => {
  assert.equal(diasVencida('2026-09-10', '2026-09-17'), 7);
  assert.equal(diasVencida('2026-09-17', '2026-09-17'), 0);
  assert.equal(diasVencida('2026-10-17', '2026-09-17'), 0);
});

test('los tramos parten la deuda por antigüedad en los límites correctos', () => {
  const hoy = '2026-09-17';
  assert.equal(tramo('2026-09-16', hoy).clave, 'vencido_1_30');
  assert.equal(tramo('2026-08-18', hoy).clave, 'vencido_1_30'); // 30 días justos
  assert.equal(tramo('2026-08-17', hoy).clave, 'vencido_31_60'); // 31 días
  assert.equal(tramo('2026-07-19', hoy).clave, 'vencido_31_60'); // 60 días
  assert.equal(tramo('2026-07-18', hoy).clave, 'vencido_61_90'); // 61 días
  assert.equal(tramo('2026-06-19', hoy).clave, 'vencido_61_90'); // 90 días
  assert.equal(tramo('2026-06-18', hoy).clave, 'vencido_90'); // 91 días
  assert.equal(tramo('2026-09-17', hoy).clave, 'vence_hoy');
  assert.equal(tramo('2026-09-24', hoy).clave, 'proximo');
  assert.equal(tramo('2026-09-25', hoy).clave, 'al_dia');
});

test('solo las facturas pasadas de fecha cuentan como vencidas', () => {
  const hoy = '2026-09-17';
  assert.equal(tramo('2026-09-16', hoy).vencida, true);
  assert.equal(tramo('2026-09-17', hoy).vencida, false);
  assert.equal(tramo('2026-09-18', hoy).vencida, false);
});

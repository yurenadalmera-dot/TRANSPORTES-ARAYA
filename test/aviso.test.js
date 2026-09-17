import test from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/config.js';
import { creaAvisoMeta } from '../src/aviso/meta.js';
import { creaAvisoTwilio } from '../src/aviso/twilio.js';
import { creaAvisoConsola } from '../src/aviso/consola.js';
import { creaAviso } from '../src/aviso/index.js';
import { creaCanalWhatsapp } from '../src/aviso/whatsapp.js';
import { envioDiario } from '../src/tareas/envio-diario.js';
import { baseDePrueba, HOY } from './ayuda.js';
import { generaInforme } from '../src/informe/diario.js';

function informeDePrueba() {
  const base = baseDePrueba();
  const cliente = base.cliente('C1', 'Cliente Uno');
  base.emitida({ numero: 'F1', clienteId: cliente, vence: '2026-09-01', total: '1.000,00' });
  return { base, informe: generaInforme(base.origen, { hoy: HOY }) };
}

// Guarda y restaura la configuración para que las pruebas no se pisen.
function conConfig(cambios, prueba) {
  const original = structuredClone({ aviso: config.aviso, web: config.web });
  Object.assign(config.aviso.meta, cambios.meta ?? {});
  Object.assign(config.aviso.twilio, cambios.twilio ?? {});
  Object.assign(config.web, cambios.web ?? {});
  try {
    return prueba();
  } finally {
    Object.assign(config.aviso.meta, original.aviso.meta);
    Object.assign(config.aviso.twilio, original.aviso.twilio);
    Object.assign(config.web, original.web);
  }
}

function fetchFalso(respuesta = { ok: true, cuerpo: { messages: [{ id: 'wamid.1' }] } }) {
  const llamadas = [];
  const impl = async (url, opciones) => {
    llamadas.push({ url, opciones });
    return {
      ok: respuesta.ok,
      status: respuesta.ok ? 200 : 400,
      statusText: respuesta.ok ? 'OK' : 'Bad Request',
      json: async () => respuesta.cuerpo,
    };
  };
  return { impl, llamadas };
}

test('sin plantilla, Meta recibe el mensaje completo como texto', async () => {
  const { llamadas, impl } = fetchFalso();

  await conConfig({ meta: { idNumero: '111', token: 'tok', plantilla: '' } }, async () => {
    const aviso = creaAvisoMeta({ fetchImpl: impl });
    assert.equal(aviso.configurado, true);
    const resultados = await aviso.envia({}, 'hola\nmundo', ['+34600000001']);

    assert.equal(resultados[0].enviado, true);
    assert.equal(resultados[0].id, 'wamid.1');
  });

  const cuerpo = JSON.parse(llamadas[0].opciones.body);
  assert.match(llamadas[0].url, /graph\.facebook\.com\/v21\.0\/111\/messages/);
  assert.equal(cuerpo.messaging_product, 'whatsapp');
  assert.equal(cuerpo.to, '+34600000001');
  assert.equal(cuerpo.text.body, 'hola\nmundo');
  assert.equal(llamadas[0].opciones.headers.Authorization, 'Bearer tok');
});

test('con plantilla, los parámetros van sueltos y sin saltos de línea', async () => {
  const { llamadas, impl } = fetchFalso();
  const { informe } = informeDePrueba();
  const datos = await informe;

  await conConfig({
    meta: { idNumero: '111', token: 'tok', plantilla: 'pendientes_diario', idioma: 'es' },
    web: { urlPanel: 'https://panel.ejemplo/araya' },
  }, async () => {
    await creaAvisoMeta({ fetchImpl: impl }).envia(datos, 'da igual', ['+34600000001']);
  });

  const cuerpo = JSON.parse(llamadas[0].opciones.body);
  const parametros = cuerpo.template.components[0].parameters.map((p) => p.text);

  assert.equal(cuerpo.template.name, 'pendientes_diario');
  assert.equal(cuerpo.template.language.code, 'es');
  assert.equal(parametros.length, 4);
  assert.equal(parametros[0], '17/09/2026');
  assert.equal(parametros[3], 'https://panel.ejemplo/araya');
  // Meta rechaza cualquier parámetro con salto de línea o tabulador.
  for (const p of parametros) assert.ok(!/[\n\t]/.test(p), `parámetro con salto: ${p}`);
});

test('un error de Meta se recoge con su motivo, sin tumbar el envío', async () => {
  const { impl } = fetchFalso({ ok: false, cuerpo: { error: { message: 'Template not found' } } });

  await conConfig({ meta: { idNumero: '111', token: 'tok', plantilla: '' } }, async () => {
    const resultados = await creaAvisoMeta({ fetchImpl: impl }).envia({}, 'texto', ['+34600000001']);
    assert.equal(resultados[0].enviado, false);
    assert.equal(resultados[0].motivo, 'Template not found');
  });
});

test('Meta avisa si faltan las credenciales en vez de fallar en silencio', async () => {
  await conConfig({ meta: { idNumero: '', token: '' } }, async () => {
    const aviso = creaAvisoMeta();
    assert.equal(aviso.configurado, false);
    await assert.rejects(() => aviso.envia({}, 'texto', ['+34600000001']), /META_ID_NUMERO/);
  });
});

test('Twilio pone el prefijo whatsapp: y autentica con Basic', async () => {
  const { llamadas, impl } = fetchFalso({ ok: true, cuerpo: { sid: 'SM123' } });

  await conConfig({ twilio: { accountSid: 'AC1', authToken: 'secreto', remitente: '+34900000000' } }, async () => {
    const resultados = await creaAvisoTwilio({ fetchImpl: impl }).envia({}, 'texto', ['+34600000001']);
    assert.equal(resultados[0].enviado, true);
    assert.equal(resultados[0].id, 'SM123');
  });

  const cuerpo = new URLSearchParams(llamadas[0].opciones.body);
  assert.match(llamadas[0].url, /Accounts\/AC1\/Messages\.json/);
  assert.equal(cuerpo.get('From'), 'whatsapp:+34900000000');
  assert.equal(cuerpo.get('To'), 'whatsapp:+34600000001');
  assert.equal(cuerpo.get('Body'), 'texto');
  assert.equal(
    llamadas[0].opciones.headers.Authorization,
    `Basic ${Buffer.from('AC1:secreto').toString('base64')}`,
  );
});

test('el proveedor de consola imprime pero no envía nada', async () => {
  const lineas = [];
  const aviso = creaAvisoConsola({ salida: { log: (x) => lineas.push(String(x)) } });
  const { informe } = informeDePrueba();

  const resultados = await aviso.envia(await informe, 'texto', ['+34600000001']);

  assert.equal(resultados[0].enviado, false);
  assert.equal(resultados[0].motivo, 'proveedor consola');
  assert.ok(lineas.join('\n').includes('PENDIENTE DE COBRAR'));
});

test('creaAviso rechaza un proveedor que no existe', () => {
  assert.throws(() => creaAviso('telegrama'), /Proveedor de aviso desconocido/);
});

test('el envío diario avisa si un canal no tiene destinatarios, sin tumbar el resto', async () => {
  const { base } = informeDePrueba();

  const canalRoto = {
    nombre: 'whatsapp:meta',
    destinatarios: [],
    envia: async () => { throw new Error('No hay destinatarios: define WHATSAPP_DESTINATARIOS en el .env.'); },
  };
  const canalBueno = {
    nombre: 'email',
    destinatarios: ['yeni@ejemplo.es'],
    envia: async () => [{ destinatario: 'yeni@ejemplo.es', enviado: true, id: null, motivo: null }],
  };

  const { porCanal, fallidos } = await envioDiario({ origen: base.origen, canales: [canalRoto, canalBueno] });

  assert.equal(porCanal.length, 2);
  assert.match(porCanal[0].error, /WHATSAPP_DESTINATARIOS/);
  assert.equal(porCanal[1].error, null);
  assert.equal(porCanal[1].resultados[0].enviado, true);
  assert.equal(fallidos.length, 1);
  assert.equal(fallidos[0].canal, 'whatsapp:meta');
});

test('el envío diario recoge los fallos de cada destinatario con su canal', async () => {
  const { base } = informeDePrueba();
  const recibidos = [];

  const canal = {
    nombre: 'whatsapp:meta',
    destinatarios: ['+34600000001', '+34600000002'],
    async envia(informe) {
      recibidos.push(informe);
      return [
        { destinatario: '+34600000001', enviado: true, id: 'wamid.1', motivo: null },
        { destinatario: '+34600000002', enviado: false, id: null, motivo: 'número no válido' },
      ];
    },
  };

  const { informe, fallidos } = await envioDiario({ origen: base.origen, canales: [canal] });

  assert.equal(recibidos[0].cobros.porTercero[0].nombre, 'Cliente Uno');
  assert.equal(informe.cobros.numFacturas, 1);
  assert.equal(fallidos.length, 1);
  assert.equal(fallidos[0].destinatario, '+34600000002');
  assert.equal(fallidos[0].canal, 'whatsapp:meta');
});

test('el canal de WhatsApp le pasa al proveedor el mensaje ya formateado', async () => {
  const { base } = informeDePrueba();
  const recibidos = [];
  const proveedor = {
    nombre: 'meta',
    configurado: true,
    async envia(informe, mensaje, destinatarios) {
      recibidos.push({ mensaje, destinatarios });
      return destinatarios.map((d) => ({ destinatario: d, enviado: true, id: 'x', motivo: null }));
    },
  };

  const destinatariosOriginales = config.aviso.destinatarios;
  config.aviso.destinatarios = ['+34600000001'];
  try {
    const canal = creaCanalWhatsapp({ proveedor });
    await canal.envia(await generaInforme(base.origen, { hoy: HOY }));
  } finally {
    config.aviso.destinatarios = destinatariosOriginales;
  }

  assert.match(recibidos[0].mensaje, /PENDIENTE DE COBRAR/);
  assert.match(recibidos[0].mensaje, /Cliente Uno/);
  assert.deepEqual(recibidos[0].destinatarios, ['+34600000001']);
});

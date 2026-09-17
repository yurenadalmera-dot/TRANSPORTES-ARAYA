import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { once } from 'node:events';
import { config } from '../src/config.js';
import { construyeMensaje, enviaCorreo } from '../src/aviso/smtp.js';
import { creaCanalEmail } from '../src/aviso/email.js';
import { asuntoEmail, cuerpoHtmlEmail, cuerpoTextoEmail } from '../src/informe/email.js';
import { aCsv, adjuntosDelInforme } from '../src/informe/csv.js';
import { generaInforme } from '../src/informe/diario.js';
import { baseDePrueba, HOY } from './ayuda.js';

async function informeDePrueba() {
  const base = baseDePrueba();
  const cliente = base.cliente('C1', 'Frigoríficos Majoreros S.L.');
  const proveedor = base.proveedor('P1', 'Disa Combustibles');
  base.emitida({ numero: 'FE-1', clienteId: cliente, vence: '2026-06-01', total: '4.250,00', concepto: 'Portes' });
  base.recibida({ numero: 'A-9', proveedorId: proveedor, vence: '2026-09-30', total: '1.000,00' });
  return generaInforme(base.origen, { hoy: HOY });
}

// Servidor SMTP de mentira: habla lo justo del protocolo y guarda la
// conversación para poder comprobarla.
function servidorSmtpFalso({ fallaEn = null, soportaStarttls = false } = {}) {
  const recibido = { ordenes: [], mensaje: '' };
  let enDatos = false;

  const servidor = net.createServer((socket) => {
    socket.setEncoding('utf8');
    socket.write('220 correo.ejemplo ESMTP listo\r\n');

    socket.on('data', (trozo) => {
      for (const linea of trozo.split('\r\n').filter((l) => l !== '' || enDatos)) {
        if (enDatos) {
          if (linea === '.') {
            enDatos = false;
            socket.write('250 2.0.0 Aceptado\r\n');
          } else {
            recibido.mensaje += `${linea}\r\n`;
          }
          continue;
        }

        const orden = linea.trim();
        if (orden === '') continue;
        recibido.ordenes.push(orden);

        if (fallaEn && orden.startsWith(fallaEn)) {
          socket.write('535 5.7.8 Usuario o contraseña incorrectos\r\n');
          continue;
        }

        if (/^EHLO/i.test(orden)) {
          socket.write('250-correo.ejemplo\r\n250-AUTH LOGIN PLAIN\r\n');
          socket.write(soportaStarttls ? '250-STARTTLS\r\n250 8BITMIME\r\n' : '250 8BITMIME\r\n');
        } else if (/^AUTH LOGIN$/i.test(orden)) {
          socket.write('334 VXNlcm5hbWU6\r\n');
        } else if (/^AUTH PLAIN /i.test(orden)) {
          socket.write('235 2.7.0 Autenticado\r\n');
        } else if (/^(MAIL FROM|RCPT TO)/i.test(orden)) {
          socket.write('250 2.1.0 Vale\r\n');
        } else if (/^DATA$/i.test(orden)) {
          enDatos = true;
          socket.write('354 Adelante\r\n');
        } else if (/^QUIT$/i.test(orden)) {
          socket.write('221 2.0.0 Adiós\r\n');
          socket.end();
        } else {
          // Respuestas del reto de AUTH LOGIN (usuario y contraseña en base64).
          socket.write(recibido.ordenes.filter((o) => /^AUTH LOGIN$/i.test(o)).length
            ? '235 2.7.0 Autenticado\r\n'
            : '250 2.0.0 Vale\r\n');
        }
      }
    });
  });

  return { servidor, recibido };
}

async function conSmtpFalso(opciones, prueba) {
  const { servidor, recibido } = servidorSmtpFalso(opciones);
  servidor.listen(0, '127.0.0.1');
  await once(servidor, 'listening');
  try {
    await prueba(servidor.address().port, recibido);
  } finally {
    servidor.close();
    await once(servidor, 'close');
  }
}

test('el cliente SMTP completa la conversación y entrega el mensaje', async () => {
  await conSmtpFalso({}, async (puerto, recibido) => {
    const resultado = await enviaCorreo({
      host: '127.0.0.1', puerto, seguro: false,
      usuario: 'yeni', clave: 'secreto',
      de: 'Transportes Araya <avisos@araya.es>',
      para: ['yeni@ejemplo.es', 'admin@ejemplo.es'],
      asunto: 'Pendientes del día',
      texto: 'hola',
      html: '<b>hola</b>',
      timeoutMs: 5000,
    });

    assert.equal(resultado.entregado, true);
    assert.ok(recibido.ordenes.some((o) => /^EHLO/.test(o)));
    // El remitente se extrae de "Nombre <correo>": si no, el servidor lo rechaza.
    assert.ok(recibido.ordenes.includes('MAIL FROM:<avisos@araya.es>'));
    assert.ok(recibido.ordenes.includes('RCPT TO:<yeni@ejemplo.es>'));
    assert.ok(recibido.ordenes.includes('RCPT TO:<admin@ejemplo.es>'));
    assert.ok(recibido.ordenes.includes('DATA'));
    // "día" lleva tilde, así que la cabecera va codificada en RFC 2047.
    const asuntoCodificado = recibido.mensaje.match(/Subject: =\?UTF-8\?B\?([^?]+)\?=/)[1];
    assert.equal(Buffer.from(asuntoCodificado, 'base64').toString('utf8'), 'Pendientes del día');
    assert.match(recibido.mensaje, /multipart\/alternative/);
  });
});

test('el cliente SMTP autentica con PLAIN cuando el servidor lo ofrece', async () => {
  await conSmtpFalso({}, async (puerto, recibido) => {
    await enviaCorreo({
      host: '127.0.0.1', puerto, seguro: false, usuario: 'yeni', clave: 'secreto',
      de: 'a@b.es', para: ['c@d.es'], asunto: 'x', texto: 'x', html: '<b>x</b>', timeoutMs: 5000,
    });

    const auth = recibido.ordenes.find((o) => o.startsWith('AUTH PLAIN '));
    assert.ok(auth, 'no se usó AUTH PLAIN');
    assert.equal(Buffer.from(auth.slice(11), 'base64').toString('utf8'), '\0yeni\0secreto');
  });
});

test('un rechazo del servidor sale como error con su motivo', async () => {
  await conSmtpFalso({ fallaEn: 'AUTH' }, async (puerto) => {
    await assert.rejects(
      () => enviaCorreo({
        host: '127.0.0.1', puerto, seguro: false, usuario: 'yeni', clave: 'mala',
        de: 'a@b.es', para: ['c@d.es'], asunto: 'x', texto: 'x', html: '<b>x</b>', timeoutMs: 5000,
      }),
      /contraseña incorrectos/,
    );
  });
});

test('el mensaje respeta el formato MIME con adjuntos', () => {
  const mensaje = construyeMensaje({
    de: 'a@b.es',
    para: ['c@d.es'],
    asunto: 'Pendientes · día 17',
    texto: 'texto plano',
    html: '<b>hola</b>',
    adjuntos: [{ nombre: 'cobros.csv', tipo: 'text/csv; charset=utf-8', contenido: Buffer.from('a;b\r\n') }],
  });

  assert.match(mensaje, /^From: a@b\.es\r\n/);
  assert.match(mensaje, /Content-Type: multipart\/mixed; boundary="mix-/);
  assert.match(mensaje, /Content-Type: multipart\/alternative; boundary="alt-/);
  assert.match(mensaje, /Content-Disposition: attachment; filename="cobros\.csv"/);
  // El asunto lleva tildes y un punto volado: va codificado en RFC 2047.
  assert.match(mensaje, /Subject: =\?UTF-8\?B\?/);
  // Todas las líneas terminan en CRLF, como exige el protocolo.
  assert.ok(!/[^\r]\n/.test(mensaje), 'hay saltos de línea sin CR');
});

test('el asunto resume los dos totales del día', async () => {
  const informe = await informeDePrueba();
  const asunto = asuntoEmail(informe);

  assert.match(asunto, /Transportes Araya/);
  assert.match(asunto, /17\/09\/2026/);
  assert.match(asunto, /Cobrar 4\.250,00/);
  assert.match(asunto, /Pagar 1\.000,00/);
});

test('el correo en HTML lleva los listados y escapa los nombres', async () => {
  const informe = await informeDePrueba();
  const html = cuerpoHtmlEmail(informe, { urlPanel: 'https://panel.araya.es' });

  assert.match(html, /Clientes pendientes de cobro/);
  assert.match(html, /Proveedores pendientes de pago/);
  assert.match(html, /Frigoríficos Majoreros S\.L\./);
  assert.match(html, /4\.250,00/);
  assert.match(html, /https:\/\/panel\.araya\.es/);
  // Sin variables CSS ni media queries: los gestores de correo no las aplican.
  assert.ok(!html.includes('var(--'));
  assert.ok(!html.includes('@media'));
});

test('el correo en texto plano sirve de alternativa legible', async () => {
  const informe = await informeDePrueba();
  const texto = cuerpoTextoEmail(informe, { urlPanel: 'https://panel.araya.es' });

  assert.match(texto, /PENDIENTE DE COBRAR/);
  assert.match(texto, /Frigoríficos Majoreros S\.L\./);
  assert.match(texto, /Panel completo: https:\/\/panel\.araya\.es/);
  assert.ok(!texto.includes('<'));
});

test('los adjuntos son los dos listados completos en CSV', async () => {
  const informe = await informeDePrueba();
  const adjuntos = adjuntosDelInforme(informe);

  assert.equal(adjuntos.length, 2);
  assert.equal(adjuntos[0].nombre, 'cobros-pendientes-2026-09-17.csv');
  assert.equal(adjuntos[1].nombre, 'pagos-pendientes-2026-09-17.csv');
  assert.match(adjuntos[0].contenido.toString('utf8'), /FE-1;Frigoríficos Majoreros S\.L\./);
  assert.deepEqual([...adjuntos[0].contenido.subarray(0, 3)], [0xEF, 0xBB, 0xBF]);
});

test('el CSV entrecomilla los campos con punto y coma o comillas', () => {
  const csv = aCsv([{
    numero: 'F;1', terceroNombre: 'Cliente "El Bueno"', terceroCodigo: 'C1',
    fechaEmision: '2026-08-01', fechaVencimiento: '2026-09-01', diasVencida: 16,
    totalCentimos: 10000, pendienteCentimos: 10000, concepto: 'Portes; varios',
  }], 'Cliente');

  assert.match(csv, /"F;1";"Cliente ""El Bueno""";C1/);
  assert.match(csv, /"Portes; varios"/);
});

test('el canal de correo envía una vez a todos y devuelve un resultado por destinatario', async () => {
  const informe = await informeDePrueba();
  const llamadas = [];

  const original = { ...config.email };
  Object.assign(config.email, {
    host: 'correo.ejemplo', de: 'avisos@araya.es',
    destinatarios: ['yeni@ejemplo.es', 'admin@ejemplo.es'], adjuntarCsv: true,
  });

  try {
    const canal = creaCanalEmail({ enviar: async (opciones) => { llamadas.push(opciones); return { entregado: true }; } });
    assert.equal(canal.configurado, true);

    const resultados = await canal.envia(informe);
    assert.equal(llamadas.length, 1, 'debe ser un único envío con los dos destinatarios');
    assert.deepEqual(llamadas[0].para, ['yeni@ejemplo.es', 'admin@ejemplo.es']);
    assert.equal(llamadas[0].adjuntos.length, 2);
    assert.equal(resultados.length, 2);
    assert.ok(resultados.every((r) => r.enviado));
  } finally {
    Object.assign(config.email, original);
  }
});

test('si el correo falla, el canal lo cuenta en vez de lanzar el error', async () => {
  const informe = await informeDePrueba();
  const original = { ...config.email };
  Object.assign(config.email, { host: 'correo.ejemplo', de: 'avisos@araya.es', destinatarios: ['yeni@ejemplo.es'] });

  try {
    const canal = creaCanalEmail({ enviar: async () => { throw new Error('conexión rechazada'); } });
    const resultados = await canal.envia(informe);

    assert.equal(resultados[0].enviado, false);
    assert.match(resultados[0].motivo, /conexión rechazada/);
  } finally {
    Object.assign(config.email, original);
  }
});

test('sin destinatarios de correo el canal lo dice claramente', async () => {
  const informe = await informeDePrueba();
  const original = { ...config.email };
  Object.assign(config.email, { host: 'correo.ejemplo', de: 'avisos@araya.es', destinatarios: [] });

  try {
    const canal = creaCanalEmail({ enviar: async () => ({ entregado: true }) });
    assert.equal(canal.configurado, false);
    await assert.rejects(() => canal.envia(informe), /EMAIL_DESTINATARIOS/);
  } finally {
    Object.assign(config.email, original);
  }
});

import net from 'node:net';
import tls from 'node:tls';
import { randomUUID } from 'node:crypto';

// Cliente SMTP mínimo: lo justo para mandar un correo con texto, HTML y
// adjuntos. Se escribe a mano para no arrastrar dependencias en un servidor
// que va a estar años sin tocarse. Habla con cualquier servidor normal
// (Gmail/Workspace con contraseña de aplicación, IONOS, Microsoft 365...).

class Conversacion {
  constructor(socket, timeoutMs) {
    this.socket = socket;
    this.timeoutMs = timeoutMs;
    this.buffer = '';
    this.pendiente = null;
    socket.setEncoding('utf8');
    socket.on('data', (trozo) => this.#recibe(trozo));
  }

  #recibe(trozo) {
    this.buffer += trozo;
    // Una respuesta termina en la línea "250 texto"; "250-texto" continúa.
    const lineas = this.buffer.split('\r\n');
    const ultimaCompleta = lineas.slice(0, -1).at(-1);
    if (!ultimaCompleta || !/^\d{3} /.test(ultimaCompleta)) return;

    const respuesta = this.buffer;
    this.buffer = '';
    const resolver = this.pendiente;
    this.pendiente = null;
    resolver?.({ codigo: Number.parseInt(respuesta.slice(0, 3), 10), texto: respuesta.trim() });
  }

  esperaRespuesta() {
    return new Promise((resolver, rechazar) => {
      const temporizador = setTimeout(
        () => rechazar(new Error('El servidor de correo no respondió a tiempo.')),
        this.timeoutMs,
      );
      this.pendiente = (respuesta) => {
        clearTimeout(temporizador);
        resolver(respuesta);
      };
      this.socket.once('error', (error) => {
        clearTimeout(temporizador);
        rechazar(error);
      });
    });
  }

  async ordena(linea, codigosOk) {
    if (linea !== null) this.socket.write(`${linea}\r\n`);
    const respuesta = await this.esperaRespuesta();
    if (codigosOk && !codigosOk.includes(respuesta.codigo)) {
      const orden = linea?.startsWith('AUTH') ? 'AUTH' : (linea ?? 'saludo inicial');
      throw new Error(`SMTP rechazó "${orden}": ${respuesta.texto}`);
    }
    return respuesta;
  }
}

function conecta({ host, puerto, seguro, timeoutMs }) {
  return new Promise((resolver, rechazar) => {
    const socket = seguro
      ? tls.connect({ host, port: puerto, servername: host })
      : net.connect({ host, port: puerto });

    socket.setTimeout(timeoutMs);
    socket.once('timeout', () => {
      socket.destroy();
      rechazar(new Error(`No se pudo conectar con ${host}:${puerto} (tiempo agotado).`));
    });
    socket.once('error', rechazar);
    socket.once(seguro ? 'secureConnect' : 'connect', () => resolver(socket));
  });
}

function upgradeATls(socket, host) {
  return new Promise((resolver, rechazar) => {
    const seguro = tls.connect({ socket, servername: host });
    seguro.once('secureConnect', () => resolver(seguro));
    seguro.once('error', rechazar);
  });
}

const b64 = (texto) => Buffer.from(String(texto), 'utf8').toString('base64');

// Asuntos y nombres con tildes: RFC 2047.
function cabeceraCodificada(texto) {
  // eslint-disable-next-line no-control-regex
  return /^[\x20-\x7E]*$/.test(texto) ? texto : `=?UTF-8?B?${b64(texto)}?=`;
}

function troceaBase64(buffer) {
  return (buffer.toString('base64').match(/.{1,76}/g) ?? []).join('\r\n');
}

export function construyeMensaje({ de, para, asunto, texto, html, adjuntos = [], fecha = new Date() }) {
  const limiteAlt = `alt-${randomUUID()}`;
  const limiteMix = `mix-${randomUUID()}`;
  const conAdjuntos = adjuntos.length > 0;

  const cabeceras = [
    `From: ${de}`,
    `To: ${para.join(', ')}`,
    `Subject: ${cabeceraCodificada(asunto)}`,
    `Date: ${fecha.toUTCString()}`,
    `Message-ID: <${randomUUID()}@transportes-araya>`,
    'MIME-Version: 1.0',
    conAdjuntos
      ? `Content-Type: multipart/mixed; boundary="${limiteMix}"`
      : `Content-Type: multipart/alternative; boundary="${limiteAlt}"`,
  ];

  const alternativa = [
    `--${limiteAlt}`,
    'Content-Type: text/plain; charset="utf-8"',
    'Content-Transfer-Encoding: base64',
    '',
    troceaBase64(Buffer.from(texto, 'utf8')),
    `--${limiteAlt}`,
    'Content-Type: text/html; charset="utf-8"',
    'Content-Transfer-Encoding: base64',
    '',
    troceaBase64(Buffer.from(html, 'utf8')),
    `--${limiteAlt}--`,
  ];

  if (!conAdjuntos) {
    return [...cabeceras, '', ...alternativa, ''].join('\r\n');
  }

  const partes = [
    `--${limiteMix}`,
    `Content-Type: multipart/alternative; boundary="${limiteAlt}"`,
    '',
    ...alternativa,
  ];

  for (const adjunto of adjuntos) {
    partes.push(
      `--${limiteMix}`,
      `Content-Type: ${adjunto.tipo}; name="${cabeceraCodificada(adjunto.nombre)}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${cabeceraCodificada(adjunto.nombre)}"`,
      '',
      troceaBase64(adjunto.contenido),
    );
  }

  partes.push(`--${limiteMix}--`);
  return [...cabeceras, '', ...partes, ''].join('\r\n');
}

// Una línea que empiece por punto marcaría el final del mensaje: se duplica.
function protegePuntos(mensaje) {
  return mensaje.replace(/^\./gm, '..');
}

export async function enviaCorreo(opciones) {
  const { host, puerto, seguro, usuario, clave, de, para, timeoutMs = 20000 } = opciones;

  if (!host) throw new Error('Falta EMAIL_HOST para poder enviar el correo.');
  if (!de) throw new Error('Falta EMAIL_DE (el remitente) para poder enviar el correo.');
  if (!para?.length) throw new Error('No hay destinatarios de correo.');

  let socket = await conecta({ host, puerto, seguro, timeoutMs });
  let charla = new Conversacion(socket, timeoutMs);

  try {
    await charla.ordena(null, [220]);
    let saludo = await charla.ordena(`EHLO ${host}`, [250]);

    if (!seguro && /STARTTLS/i.test(saludo.texto)) {
      await charla.ordena('STARTTLS', [220]);
      socket = await upgradeATls(socket, host);
      charla = new Conversacion(socket, timeoutMs);
      saludo = await charla.ordena(`EHLO ${host}`, [250]);
    }

    if (usuario && clave) {
      if (/AUTH[ =-][^\r\n]*PLAIN/i.test(saludo.texto)) {
        await charla.ordena(`AUTH PLAIN ${b64(`\0${usuario}\0${clave}`)}`, [235]);
      } else {
        await charla.ordena('AUTH LOGIN', [334]);
        await charla.ordena(b64(usuario), [334]);
        await charla.ordena(b64(clave), [235]);
      }
    }

    // El remitente puede venir como "Nombre <correo@dominio>".
    const correoDe = de.match(/<([^>]+)>/)?.[1] ?? de;
    await charla.ordena(`MAIL FROM:<${correoDe}>`, [250]);
    for (const destinatario of para) {
      await charla.ordena(`RCPT TO:<${destinatario}>`, [250, 251]);
    }

    await charla.ordena('DATA', [354]);
    const mensaje = construyeMensaje({ ...opciones, de });
    socket.write(`${protegePuntos(mensaje)}\r\n.\r\n`);
    const entregado = await charla.esperaRespuesta();
    if (entregado.codigo !== 250) {
      throw new Error(`El servidor no aceptó el mensaje: ${entregado.texto}`);
    }

    await charla.ordena('QUIT').catch(() => {});
    return { entregado: true, respuesta: entregado.texto };
  } finally {
    socket.destroy();
  }
}

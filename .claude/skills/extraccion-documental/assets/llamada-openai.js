/* ══ LLAMADA AL MODELO · OpenAI ══════════════════════════════════════
   Mismo contrato que llamada-anthropic.js: mismo esquema, mismo prompt,
   mismo objeto de vuelta. Cambiar de proveedor no debe tocar nada más.

   HTTP directo en vez del nodo nativo de n8n: acepta PDF además de
   imágenes y te deja controlar el payload entero.                     */

const MODELO = process.env.MODELO_EXTRACCION || 'gpt-5-mini';
const PROMPT_VERSION = '2026-09-20';

const { ESQUEMA } = require('./esquema');
const { INSTRUCCIONES } = require('./prompt');

async function extraer({ bytes, mime, nombre = 'documento', catalogo = [] }) {
  const b64 = Buffer.from(bytes).toString('base64');

  const adjunto = mime === 'application/pdf'
    ? { type: 'file',      file:      { filename: nombre, file_data: `data:${mime};base64,${b64}` } }
    : { type: 'image_url', image_url: { url: `data:${mime};base64,${b64}` } };

  const lista = [...catalogo]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((c) => `${c.id}\t${c.nombre}`).join('\n');

  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODELO,
      // El bloque estable va primero: es lo que el caché automático
      // de prefijo puede reutilizar entre documentos.
      messages: [
        { role: 'system', content: INSTRUCCIONES },
        { role: 'user', content: [
            adjunto,
            { type: 'text', text: lista
                ? `Catálogo de terceros conocidos (id\tnombre):\n${lista}\n\n`
                  + 'Extrae los datos. Si el emisor es claramente uno de la lista, '
                  + 'devuelve su id en emisor_id; si no lo es o dudas, deja null.'
                : 'Extrae los datos de este documento.' },
        ]},
      ],
      // strict: true es la diferencia entre una garantía y una sugerencia.
      // Sin él parece que funciona, hasta el documento raro.
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'extraccion', strict: true, schema: ESQUEMA },
      },
    }),
  });

  if (!r.ok) {
    const detalle = await r.text().catch(() => '');
    // El error crudo va al registro del servidor, nunca a la pantalla:
    // puede llevar trozos de la petición y quien lo lee no sabría qué hacer.
    console.error('extraer · API respondió', r.status, detalle.slice(0, 300));
    throw new Error('No hemos podido leer el documento. Rellena los datos a mano; '
      + 'el archivo se guarda igual.');
  }

  const cuerpo = await r.json();
  const texto = cuerpo.choices?.[0]?.message?.content ?? '';

  let datos;
  try {
    datos = JSON.parse(texto);
  } catch {
    const e = new Error('No hemos podido interpretar el documento. Rellena los datos a mano.');
    e.publico = true; throw e;
  }

  const u = cuerpo.usage || {};
  return {
    datos,
    uso: {
      modelo: MODELO,
      prompt_version: PROMPT_VERSION,
      tokens_entrada: u.prompt_tokens || 0,
      tokens_salida:  u.completion_tokens || 0,
      tokens_cache:   u.prompt_tokens_details?.cached_tokens || 0,
    },
  };
}

module.exports = { extraer, MODELO, PROMPT_VERSION };

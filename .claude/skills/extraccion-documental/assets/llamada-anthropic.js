/* ══ LLAMADA AL MODELO · Anthropic ═══════════════════════════════════
   Vive en el servidor: la clave de la API no puede viajar al cliente.
   Aquí no se escribe nada en la base — se devuelve lo leído para que
   una persona lo confirme.                                           */

const Anthropic = require('@anthropic-ai/sdk');

// Tier: extraer es transcripción, no razonamiento. Empieza por el más
// barato que aguante TUS documentos y mídelo contra datos_revisados
// antes de subir. Ver references/coste.md.
const MODELO = process.env.MODELO_EXTRACCION || 'claude-sonnet-5';

// `effort` no existe en toda la familia: Haiku 4.5 y Sonnet 4.5 devuelven
// 400 si se les envía, ANTES de leer el documento. Como el modelo se
// cambia por variable de entorno para medir tiers, mandarlo a ciegas
// convierte "probar el modelo barato" en "romper la extracción" y hace
// parecer que el modelo barato no sirve.
const ACEPTA_EFFORT = new Set([
  'claude-opus-5', 'claude-opus-4-8', 'claude-opus-4-7', 'claude-opus-4-6',
  'claude-sonnet-5', 'claude-sonnet-4-6', 'claude-fable-5', 'claude-fable-5-1',
]);
const PROMPT_VERSION = '2026-09-20';      // se guarda en cada fila _ocr

const IMAGENES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const PDF = 'application/pdf';
const MAX_BYTES = 10 * 1024 * 1024;

const { ESQUEMA } = require('./esquema');
const { INSTRUCCIONES } = require('./prompt');   // estable: es el prefijo cacheado

const admitido = (mime) => mime === PDF || IMAGENES.includes(mime);

function motivoNoAdmitido(mime) {
  if (/^image\/hei[cf]$/i.test(mime)) {
    // El formato por defecto del iPhone. Se guarda igual en storage:
    // perder el justificante por un formato es un fallo caro y evitable.
    return 'Las fotos en formato HEIC del iPhone no se pueden leer todavía. '
         + 'El archivo se guarda igual: rellena los datos a mano, o vuelve a hacer '
         + 'la foto con el formato "Más compatible" en los ajustes de la cámara.';
  }
  return 'De este tipo de archivo no sabemos leer los datos. Rellénalos a mano.';
}

/* Devuelve { datos, uso } o lanza un Error con .publico si el mensaje se
   le puede enseñar a quien está delante de la pantalla. */
async function extraer({ bytes, mime, catalogo = [] }) {
  if (!bytes?.length) {
    const e = new Error('El archivo está vacío'); e.publico = true; throw e;
  }
  if (bytes.length > MAX_BYTES) {
    const e = new Error(`El archivo pesa ${(bytes.length / 1048576).toFixed(1)} MB. `
      + 'Para leerlo automáticamente el máximo son 10 MB.');
    e.publico = true; throw e;
  }
  if (!admitido(mime)) {
    const e = new Error(motivoNoAdmitido(mime)); e.publico = true; throw e;
  }

  const cliente = new Anthropic({ timeout: 90_000, maxRetries: 1 });
  const b64 = Buffer.from(bytes).toString('base64');

  // El adjunto va ANTES del texto: el modelo tiene el documento presente
  // al leer la instrucción.
  const adjunto = mime === PDF
    ? { type: 'document', source: { type: 'base64', media_type: PDF, data: b64 } }
    : { type: 'image',    source: { type: 'base64', media_type: mime, data: b64 } };

  // La shortlist va ordenada de forma determinista: un orden que cambia
  // entre llamadas rompe el prefijo del caché sin que se note.
  const lista = [...catalogo]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((c) => `${c.id}\t${c.nombre}`)
    .join('\n');

  const respuesta = await cliente.messages.create({
    model: MODELO,
    max_tokens: 4096,
    // Lo estable primero y con punto de caché al final del bloque.
    // Nada de fechas ni identificadores por petición aquí dentro.
    system: [{
      type: 'text',
      text: INSTRUCCIONES,
      cache_control: { type: 'ephemeral' },
    }],
    output_config: {
      format: { type: 'json_schema', schema: ESQUEMA }, // garantía, no petición
      // Transcribir no necesita profundidad. Solo donde se acepta.
      ...(ACEPTA_EFFORT.has(MODELO) ? { effort: 'low' } : {}),
    },
    messages: [{
      role: 'user',
      content: [
        adjunto,
        { type: 'text', text: lista
            ? `Catálogo de terceros conocidos (id\tnombre):\n${lista}\n\n`
              + 'Extrae los datos de este documento. Si el emisor es claramente uno de '
              + 'la lista, devuelve su id en emisor_id; si no lo es o dudas, deja null.'
            : 'Extrae los datos de este documento.' },
      ],
    }],
  });

  const texto = respuesta.content.filter((b) => b.type === 'text').map((b) => b.text).join('');

  let datos;
  try {
    datos = JSON.parse(texto);
  } catch {
    // El schema estricto lo hace improbable, pero el día que pase no
    // debe tumbar el flujo: el archivo ya está guardado.
    const e = new Error('No hemos podido interpretar el documento. Rellena los datos a mano.');
    e.publico = true; throw e;
  }

  const u = respuesta.usage || {};
  return {
    datos,
    uso: {
      modelo: MODELO,
      prompt_version: PROMPT_VERSION,
      tokens_entrada: u.input_tokens || 0,
      tokens_salida:  u.output_tokens || 0,
      // Si esto sale 0 llamada tras llamada, hay un invalidador en el
      // prefijo. Ver references/coste.md.
      tokens_cache:   u.cache_read_input_tokens || 0,
    },
  };
}

module.exports = { extraer, admitido, motivoNoAdmitido, MAX_BYTES, MODELO, PROMPT_VERSION };

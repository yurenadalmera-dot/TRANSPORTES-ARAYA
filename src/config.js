import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Carga .env si existe, sin romper cuando no está (producción usa variables reales).
const ficheroEnv = path.join(RAIZ, '.env');
if (existsSync(ficheroEnv)) {
  process.loadEnvFile(ficheroEnv);
}

const texto = (clave, porDefecto) => process.env[clave]?.trim() || porDefecto;
const numero = (clave, porDefecto) => {
  const valor = Number.parseInt(process.env[clave] ?? '', 10);
  return Number.isFinite(valor) ? valor : porDefecto;
};
const lista = (clave) =>
  texto(clave, '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

export const config = {
  // Zona horaria con la que se decide qué día es "hoy" y qué está vencido.
  zonaHoraria: texto('ZONA_HORARIA', 'Atlantic/Canary'),

  // De dónde salen los datos: 'sqlite' (base local de este proyecto)
  // o 'rest' (API del SaaS que ya está en marcha).
  origenDatos: texto('ORIGEN_DATOS', 'sqlite'),

  rutaDb: texto('RUTA_DB', path.join(RAIZ, 'datos', 'araya.sqlite')),

  saas: {
    url: texto('SAAS_API_URL', ''),
    token: texto('SAAS_API_TOKEN', ''),
    // Rutas dentro de la API del SaaS; se ajustan sin tocar código.
    rutaCobros: texto('SAAS_RUTA_COBROS', '/facturas/emitidas/pendientes'),
    rutaPagos: texto('SAAS_RUTA_PAGOS', '/facturas/recibidas/pendientes'),
    timeoutMs: numero('SAAS_TIMEOUT_MS', 15000),
  },

  web: {
    puerto: numero('PUERTO', 3000),
    host: texto('HOST', '0.0.0.0'),
    // Si se define, el panel pide ?clave=... para abrirse desde el móvil.
    clave: texto('CLAVE_PANEL', ''),
    // URL pública del panel, para enlazarla en el mensaje de WhatsApp.
    urlPublica: texto('URL_PUBLICA', ''),
  },

  aviso: {
    // 'consola' (por defecto, no envía nada), 'meta' o 'twilio'.
    proveedor: texto('WHATSAPP_PROVEEDOR', 'consola'),
    destinatarios: lista('WHATSAPP_DESTINATARIOS'),
    meta: {
      idNumero: texto('META_ID_NUMERO', ''),
      token: texto('META_TOKEN', ''),
      version: texto('META_VERSION_API', 'v21.0'),
      plantilla: texto('META_PLANTILLA', ''),
      idioma: texto('META_IDIOMA', 'es'),
    },
    twilio: {
      accountSid: texto('TWILIO_ACCOUNT_SID', ''),
      authToken: texto('TWILIO_AUTH_TOKEN', ''),
      remitente: texto('TWILIO_REMITENTE', ''),
    },
  },

  informe: {
    // Aviso temprano: facturas que vencen dentro de estos días.
    diasProximoVencimiento: numero('DIAS_PROXIMO_VENCIMIENTO', 7),
    // Cuántas líneas de detalle caben en el mensaje de WhatsApp.
    maxLineasWhatsapp: numero('MAX_LINEAS_WHATSAPP', 8),
  },
};

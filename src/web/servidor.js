import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { config } from '../config.js';
import { creaOrigen } from '../origen/index.js';
import { generaInforme } from '../informe/diario.js';
import { formateaWhatsapp } from '../informe/whatsapp.js';
import { paginaPanel, paginaError } from './vistas.js';
import { aCsv } from '../informe/csv.js';

const COOKIE = 'araya_clave';

function comparaClave(recibida, esperada) {
  const a = Buffer.from(String(recibida ?? ''));
  const b = Buffer.from(esperada);
  return a.length === b.length && timingSafeEqual(a, b);
}

function leeCookie(cabecera, nombre) {
  for (const trozo of (cabecera ?? '').split(';')) {
    const [clave, ...resto] = trozo.trim().split('=');
    if (clave === nombre) return decodeURIComponent(resto.join('='));
  }
  return null;
}

function responde(res, estado, tipo, cuerpo, cabeceras = {}) {
  res.writeHead(estado, {
    'Content-Type': tipo,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    ...cabeceras,
  });
  res.end(cuerpo);
}

export function creaServidor({ origen = creaOrigen() } = {}) {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);

    if (req.method !== 'GET') {
      return responde(res, 405, 'text/plain; charset=utf-8', 'Método no permitido');
    }

    if (url.pathname === '/salud') {
      return responde(res, 200, 'application/json; charset=utf-8', JSON.stringify({ estado: 'ok' }));
    }

    // Protección sencilla por clave para poder abrirlo desde el móvil.
    if (config.web.clave) {
      const enUrl = url.searchParams.get('clave');
      const enCookie = leeCookie(req.headers.cookie, COOKIE);

      if (enUrl && comparaClave(enUrl, config.web.clave)) {
        url.searchParams.delete('clave');
        return responde(res, 302, 'text/plain; charset=utf-8', '', {
          Location: `${url.pathname}${url.search}`,
          'Set-Cookie': `${COOKIE}=${encodeURIComponent(config.web.clave)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`,
        });
      }

      if (!comparaClave(enCookie, config.web.clave)) {
        return responde(res, 401, 'text/html; charset=utf-8', paginaError('Acceso no autorizado. Abre el enlace completo que recibiste por WhatsApp.'));
      }
    }

    try {
      const informe = await generaInforme(origen);

      switch (url.pathname) {
        case '/':
          return responde(res, 200, 'text/html; charset=utf-8', paginaPanel(informe, { origen: origen.nombre }));

        case '/api/informe':
          return responde(res, 200, 'application/json; charset=utf-8', JSON.stringify(informe, null, 2));

        case '/api/whatsapp':
          return responde(res, 200, 'text/plain; charset=utf-8', formateaWhatsapp(informe));

        case '/cobros.csv':
          return responde(res, 200, 'text/csv; charset=utf-8', aCsv(informe.cobros.facturas, 'Cliente'), {
            'Content-Disposition': `attachment; filename="cobros-pendientes-${informe.fecha}.csv"`,
          });

        case '/pagos.csv':
          return responde(res, 200, 'text/csv; charset=utf-8', aCsv(informe.pagos.facturas, 'Proveedor'), {
            'Content-Disposition': `attachment; filename="pagos-pendientes-${informe.fecha}.csv"`,
          });

        default:
          return responde(res, 404, 'text/html; charset=utf-8', paginaError('Página no encontrada.'));
      }
    } catch (error) {
      console.error('[panel] error al generar el informe:', error);
      return responde(res, 500, 'text/html; charset=utf-8',
        paginaError(`No se han podido leer los datos: ${error.message}`));
    }
  });
}

// Arranque directo: node src/web/servidor.js
if (import.meta.url === `file://${process.argv[1]}`) {
  creaServidor().listen(config.web.puerto, config.web.host, () => {
    console.log(`Panel de pendientes en http://localhost:${config.web.puerto} (origen: ${config.origenDatos})`);
  });
}

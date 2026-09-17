import { config } from '../config.js';
import { formateaEuros } from '../dominio/dinero.js';
import { formateaFecha } from '../dominio/fechas.js';

// WhatsApp Business Cloud API (Meta).
//
// Importante: fuera de una conversación abierta (24 h) Meta solo deja enviar
// plantillas aprobadas, y los parámetros de plantilla NO admiten saltos de
// línea. Por eso, si hay plantilla configurada se envían cuatro parámetros
// sueltos y el detalle se consulta en el panel; si no la hay, se manda el
// mensaje completo como texto (válido solo dentro de la ventana de 24 h).

function cuerpoPlantilla(informe) {
  const { meta } = config.aviso;
  const parametros = [
    formateaFecha(informe.fecha),
    formateaEuros(informe.cobros.totalCentimos),
    formateaEuros(informe.pagos.totalCentimos),
    config.web.urlPanel || 'panel no configurado',
  ];

  return {
    type: 'template',
    template: {
      name: meta.plantilla,
      language: { code: meta.idioma },
      components: [
        { type: 'body', parameters: parametros.map((text) => ({ type: 'text', text })) },
      ],
    },
  };
}

export function creaAvisoMeta({ fetchImpl = fetch } = {}) {
  const { meta } = config.aviso;
  const configurado = Boolean(meta.idNumero && meta.token);

  return {
    nombre: 'meta',
    configurado,
    async envia(informe, mensaje, destinatarios) {
      if (!configurado) {
        throw new Error('Faltan META_ID_NUMERO y META_TOKEN para enviar por WhatsApp Cloud API.');
      }

      const url = `https://graph.facebook.com/${meta.version}/${meta.idNumero}/messages`;
      const contenido = meta.plantilla
        ? cuerpoPlantilla(informe)
        : { type: 'text', text: { preview_url: false, body: mensaje } };

      const resultados = [];
      for (const destinatario of destinatarios) {
        const respuesta = await fetchImpl(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${meta.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ messaging_product: 'whatsapp', to: destinatario, ...contenido }),
        });

        const cuerpo = await respuesta.json().catch(() => ({}));
        resultados.push({
          destinatario,
          enviado: respuesta.ok,
          id: cuerpo?.messages?.[0]?.id ?? null,
          motivo: respuesta.ok ? null : (cuerpo?.error?.message ?? `HTTP ${respuesta.status}`),
        });
      }
      return resultados;
    },
  };
}

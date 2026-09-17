import { config } from '../config.js';

// WhatsApp a través de Twilio. Los números van con el prefijo "whatsapp:".
function conPrefijo(numero) {
  return numero.startsWith('whatsapp:') ? numero : `whatsapp:${numero}`;
}

export function creaAvisoTwilio({ fetchImpl = fetch } = {}) {
  const { twilio } = config.aviso;
  const configurado = Boolean(twilio.accountSid && twilio.authToken && twilio.remitente);

  return {
    nombre: 'twilio',
    configurado,
    async envia(informe, mensaje, destinatarios) {
      if (!configurado) {
        throw new Error('Faltan TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN y TWILIO_REMITENTE.');
      }

      const url = `https://api.twilio.com/2010-04-01/Accounts/${twilio.accountSid}/Messages.json`;
      const auth = Buffer.from(`${twilio.accountSid}:${twilio.authToken}`).toString('base64');

      const resultados = [];
      for (const destinatario of destinatarios) {
        const respuesta = await fetchImpl(url, {
          method: 'POST',
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            From: conPrefijo(twilio.remitente),
            To: conPrefijo(destinatario),
            Body: mensaje,
          }),
        });

        const cuerpo = await respuesta.json().catch(() => ({}));
        resultados.push({
          destinatario,
          enviado: respuesta.ok,
          id: cuerpo?.sid ?? null,
          motivo: respuesta.ok ? null : (cuerpo?.message ?? `HTTP ${respuesta.status}`),
        });
      }
      return resultados;
    },
  };
}

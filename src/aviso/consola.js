import { formateaTexto } from '../informe/whatsapp.js';

// Proveedor por defecto: no envía nada, solo imprime lo que se enviaría.
// Sirve para probar el informe diario antes de contratar WhatsApp.
export function creaAvisoConsola({ salida = console } = {}) {
  return {
    nombre: 'consola',
    configurado: true,
    async envia(informe, mensaje, destinatarios) {
      salida.log('─'.repeat(52));
      salida.log(formateaTexto(informe));
      salida.log('─'.repeat(52));
      salida.log(
        destinatarios.length
          ? `(no enviado: proveedor "consola". Destinatarios configurados: ${destinatarios.join(', ')})`
          : '(no enviado: proveedor "consola", sin destinatarios configurados)',
      );
      return destinatarios.map((destinatario) => ({ destinatario, enviado: false, motivo: 'proveedor consola' }));
    },
  };
}

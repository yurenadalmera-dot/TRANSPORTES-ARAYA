import { config } from '../config.js';
import { abreDb } from '../db/conexion.js';
import { creaOrigenSqlite } from './sqlite.js';
import { creaOrigenRest } from './rest.js';

// Un origen de datos es cualquier objeto con estos dos métodos:
//   cobrosPendientes() -> Promise<Factura[]>   (lo que nos deben los clientes)
//   pagosPendientes()  -> Promise<Factura[]>   (lo que debemos a proveedores)
// Cambiar de base local a la API del SaaS es cambiar ORIGEN_DATOS en el .env.
export function creaOrigen(tipo = config.origenDatos) {
  switch (tipo) {
    case 'sqlite':
      return creaOrigenSqlite(abreDb());
    case 'rest':
      return creaOrigenRest();
    default:
      throw new Error(`Origen de datos desconocido: "${tipo}". Usa "sqlite" o "rest".`);
  }
}

# Transportes Araya · pendientes de cobro y de pago

Listado diario de **clientes que nos deben dinero** y **proveedores a los que
debemos**, pensado para mirarlo desde el móvil cada mañana y recibirlo por
WhatsApp.

Tres piezas:

1. **Panel web** (móvil): totales, reparto por antigüedad y el detalle por
   cliente y por proveedor, con descarga a Excel.
2. **Informe diario**: el mismo contenido resumido en un mensaje de WhatsApp.
3. **Origen de datos intercambiable**: base local propia o la API del SaaS.

No usa ninguna dependencia externa: solo Node 22 y su SQLite incorporado.

## Arrancar en un minuto

```bash
npm run seed     # crea la base local con datos de ejemplo
npm start        # abre el panel en http://localhost:3000
npm run informe  # imprime el listado de hoy en pantalla
npm test         # 46 pruebas
```

`npm run seed` no hace falta cuando se conecte el SaaS real: son datos de
ejemplo para ver el panel funcionando.

## Conectar los datos reales del SaaS

El informe no sabe de dónde salen los datos. Le vale cualquier objeto con dos
métodos (`src/origen/index.js`):

```js
{
  cobrosPendientes() -> Promise<Factura[]>   // lo que nos deben los clientes
  pagosPendientes()  -> Promise<Factura[]>   // lo que debemos a proveedores
}
```

Cada `Factura` es:

```js
{
  facturaId, numero, terceroCodigo, terceroNombre, terceroTelefono,
  fechaEmision, fechaVencimiento, concepto,
  totalCentimos, pendienteCentimos      // enteros, en céntimos
}
```

Hay dos orígenes ya escritos:

| `ORIGEN_DATOS` | Qué hace |
|---|---|
| `sqlite` | Lee la base local de este proyecto. Es el valor por defecto. |
| `rest`   | Llama a la API del SaaS. Se configura con `SAAS_API_URL` y `SAAS_API_TOKEN`. |

Para enchufar el SaaS basta con poner en el `.env`:

```bash
ORIGEN_DATOS=rest
SAAS_API_URL=https://api.vuestro-saas.com
SAAS_API_TOKEN=...
SAAS_RUTA_COBROS=/facturas/emitidas/pendientes
SAAS_RUTA_PAGOS=/facturas/recibidas/pendientes
```

El adaptador (`src/origen/rest.js`) ya acepta los nombres de campo más
habituales (`cliente`/`proveedor`/`nombre`, `vencimiento`/`fecha_vencimiento`,
`pendiente`/`saldo`/`importe_pendiente`…), importes en euros o en céntimos y
fechas en ISO o en `dd/mm/aaaa`. Si el SaaS usa otros nombres, se añaden en la
función `normaliza` de ese fichero y no hay que tocar nada más.

**Si el SaaS habla SQL en lugar de HTTP**, se escribe un tercer origen con esos
dos métodos y se añade al `switch` de `src/origen/index.js`.

## Cómo se calcula lo pendiente

- Los importes se guardan **en céntimos enteros**: nada de decimales en coma
  flotante que acaban dando 0,01 € de diferencia.
- **Pendiente = total de la factura − cobros (o pagos) registrados.** Admite
  cobros parciales; cuando llega a cero, la factura desaparece del listado.
- Las facturas **anuladas** no cuentan.
- **Vencida** es la que ya pasó de su fecha de vencimiento. La que vence hoy
  todavía no lo está.
- Antigüedad de la deuda: `+90 días`, `61-90`, `31-60`, `1-30`, `vence hoy`,
  `vence pronto` (configurable con `DIAS_PROXIMO_VENCIMIENTO`) y `aún no
  vencido`.
- El día se decide con `ZONA_HORARIA` (por defecto `Atlantic/Canary`), no con
  la hora del servidor: si está en UTC, a medianoche no adelanta el día.

## El panel

| Ruta | Qué devuelve |
|---|---|
| `/` | El panel (HTML, pensado para el móvil) |
| `/cobros.csv` · `/pagos.csv` | El listado para Excel (`;` y BOM, tildes correctas) |
| `/api/informe` | El informe completo en JSON |
| `/api/whatsapp` | El mensaje tal cual se enviaría |
| `/salud` | Comprobación de que está vivo |

Si se publica en internet, conviene poner `CLAVE_PANEL`: sin ella el panel
devuelve 401, y el enlace se abre una vez con `?clave=...` (deja una cookie de
30 días, así Yeni no la teclea cada mañana). `/salud` queda siempre abierto.

## El envío diario por WhatsApp

`npm run enviar` genera el informe y lo manda. Con `WHATSAPP_PROVEEDOR=consola`
—el valor por defecto— **no envía nada**: solo imprime el mensaje, que es la
forma de probarlo antes de contratar nada.

### Opción A · WhatsApp Business Cloud API (Meta)

La vía oficial y la más barata. Hace falta una cuenta de WhatsApp Business, un
número verificado y **una plantilla aprobada**: fuera de las 24 h siguientes a
un mensaje de la persona, Meta solo deja enviar plantillas.

```bash
WHATSAPP_PROVEEDOR=meta
META_ID_NUMERO=...
META_TOKEN=...
META_PLANTILLA=pendientes_diario
WHATSAPP_DESTINATARIOS=+34600000000
URL_PUBLICA=https://panel.transportesaraya.es
```

Los parámetros de plantilla **no admiten saltos de línea**, así que la plantilla
recibe cuatro datos sueltos y el detalle se consulta en el panel. Texto a dar de
alta en Meta (categoría *Utility*):

```
Transportes Araya · {{1}}
Pendiente de cobrar: {{2}}
Pendiente de pagar: {{3}}
Detalle: {{4}}
```

Sin `META_PLANTILLA` se envía el mensaje completo como texto, que solo funciona
dentro de esa ventana de 24 h.

### Opción B · Twilio

Más rápido de arrancar, algo más caro por mensaje:

```bash
WHATSAPP_PROVEEDOR=twilio
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_REMITENTE=+14155238886
WHATSAPP_DESTINATARIOS=+34600000000
```

### Programarlo cada mañana

```cron
# Todos los días laborables a las 8:00 (hora del servidor)
0 8 * * 1-5 cd /ruta/a/transportes-araya && /usr/bin/node --no-warnings src/tareas/envio-diario.js >> /var/log/araya-envio.log 2>&1
```

Con systemd, un `.timer` con `OnCalendar=Mon-Fri 08:00` sobre un servicio que
lance ese mismo comando. La tarea termina con código distinto de cero si algún
envío falla, así el fallo se ve en los logs.

## Estructura

```
src/
  config.js            Configuración y lectura del .env
  db/                  Esquema SQLite, conexión y datos de ejemplo
  dominio/             Dinero en céntimos y fechas/vencimientos
  origen/              De dónde salen los datos (sqlite | rest)
  informe/             Cálculo del informe diario y formato del mensaje
  aviso/               Envío por WhatsApp (consola | meta | twilio)
  web/                 Servidor y vistas del panel
  tareas/              La tarea del envío diario
test/                  46 pruebas con el runner de Node
```

## Pendiente de decidir

- **Qué SaaS es y cómo se consulta.** El adaptador `rest` está escrito y
  probado, pero hasta no tener la URL de la API (o el acceso a su base de
  datos) el panel funciona con la base local.
- **Vía de WhatsApp.** No hay proveedor contratado todavía; el envío está
  escrito para Meta y para Twilio, y de momento sale por consola.
- **Zona horaria.** Puesta en `Atlantic/Canary`. Si la empresa es peninsular,
  se cambia `ZONA_HORARIA` a `Europe/Madrid` en el `.env`.

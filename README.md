# Transportes Araya Franquiz · panel de gestión

El programa **no vive en este repositorio**. Está repartido entre dos sitios, y este
repo guarda la documentación y las herramientas auxiliares.

| Pieza | Dónde | Detalle |
|---|---|---|
| Base de datos | Supabase Cloud, proyecto `araya-operativa` (`wapxjjsjwpofgjoqmoby`) | PostgreSQL 17, región `eu-west-1`. El historial de cambios está en las *migrations* del proyecto. |
| Interfaz | Una sola página HTML guardada en la tabla `public.app_ui` (fila `app`) | La sirve n8n en el webhook `GET /araya/panel`. Cada cambio queda versionado solo en `app_ui_versiones`. |
| Automatismos | n8n (`n8n-n8n.kjixqg.easypanel.host`), carpeta *TRANSPORTES ARAYA* | Escáner de documentos, correo entrante, sincronización con Factusol, avisos de cobro. |

## Módulo de personal y nóminas

Añadido en septiembre de 2026.

### Tablas

- `empleados` — ficha del trabajador: DNI, nº de afiliación, categoría, antigüedad,
  situación, y los vencimientos de **carnet, CAP, ADR, tarjeta de tacógrafo y
  reconocimiento médico**, que alimentan el tablón de avisos.
- `nominas` — una fila por trabajador y mes, con devengado, bases, IRPF, Seguridad
  Social del trabajador y de la empresa, líquido y estado de pago.
- `nominas_conceptos` — el detalle línea a línea del recibo (devengos y deducciones).
- `nominas_ss_empresa` — la aportación empresarial desglosada por concepto.
- `nominas_ocr` — bandeja de revisión: lo que lee el escáner antes de que una
  persona lo confirme.
- `seguros_sociales` — recibo de liquidación de cotizaciones (RLC/TC1), para cuadrar
  el cargo de la TGSS con lo que suman las nóminas.
- `modelo_111` — retenciones de IRPF presentadas cada trimestre, para contrastarlas
  con lo que dicen las nóminas.

### Contabilidad

`generar_asiento_nomina(periodo, usuario)` genera **un asiento mensual agrupado**:

```
Debe   640  Sueldos y salarios ................ total devengado
Debe   642  Seguridad Social a cargo empresa .. aportación empresarial
Haber  476  Organismos SS acreedores .......... empresa + trabajador
Haber  4751 Hacienda acreedora, retenciones ... IRPF
Haber  649  Retribución en especie y otras ..... otras deducciones
Haber  465  Remuneraciones pendientes de pago .. líquido
```

Las cuentas son configurables en `config_contable` (`cuenta_sueldos`,
`cuenta_ss_empresa`, `cuenta_ss_acreedora`, `cuenta_remuneraciones`,
`cuenta_gastos_sociales`).

El pago de cada trabajador se concilia contra el banco con `conciliar_nomina`, que
además genera el asiento `465 / 572`. `conciliar_nominas_automatico` lo hace en
bloque, pero **solo** cuando hay un único candidato cuyo líquido cuadra al céntimo
y que además deja rastro de su nombre en el concepto del movimiento; el nombre de la
empresa se ignora al cotejar, porque sale en todos los apuntes.

### Lectura de las nóminas

Las nóminas se leen **sin IA**, directamente de la capa de texto del PDF. El lector
vive en el workflow *Araya · Nóminas por escáner* (`POST /araya/nomina-lote`) y su
código está en `n8n/leer-nominas.js`.

Para separar devengos de deducciones prueba dos criterios —la columna en la que cae
el importe y el rango del código de concepto (≥ 700 es deducción)— y se queda con el
que reproduce el **líquido a percibir** que pone el propio recibo. Así aguanta que la
extracción de texto coloque las columnas de otra manera.

`herramientas/parse_nominas.py` es el mismo algoritmo en Python, que sirve para
comprobar un PDF desde la línea de órdenes sin tocar el programa.

Verificado contra las 24 nóminas de agosto de 2026: los seis totales (devengado,
deducciones, IRPF, SS del trabajador, SS de la empresa y líquido) cuadran al céntimo,
y el asiento del mes sale cuadrado.

### Interfaz

`panel/personal.js` es el módulo que se inyecta en `app_ui`. Añade tres vistas
(`VX.avisos`, `VX.personal`, `VX.nominas`) y su función de enlace `bindPersonal()`,
llamada desde `BINDX()`.

## Herramientas

```bash
pip install pypdf
python3 herramientas/parse_nominas.py nominas.pdf    # vuelca el PDF como JSON
```

## DeCA · documento electrónico de control administrativo

Obligatorio desde octubre de 2026. Estado frente a los cuatro requisitos técnicos:

### 1. PDF nativo, 5 MB y sellado de tiempo

El PDF se compone con **jsPDF** a partir de los datos estructurados del albarán
(cargador, transportista, origen, destino, matrícula, remolque, mercancía, código
LER y firmas). No se escanea nada.

El bucket `deca` rechaza cualquier fichero de más de **5.242.880 bytes** y sólo
admite `application/pdf`; además `deca_registrar` comprueba el tamaño antes de dar
el documento por bueno. Los DeCA reales pesan unos 100 KB.

jsPDF escribe `/CreationDate` por sí solo, pero con la hora del navegador. Por eso
`deca_preparar` devuelve la hora del **servidor** (zona `Atlantic/Canary`) y el panel
la incrusta en los metadatos del PDF junto con el UUID, la versión, el albarán, la
matrícula y la URL, y la imprime además de forma visible al lado del QR.

### 2. Código QR

Se dibuja vectorialmente dentro del PDF y apunta a la URL pública del propio
fichero, bajo HTTPS. El bucket es público en lectura (`deca_lectura_publica`, rol
`public`), así que el inspector descarga el PDF sin contraseña ni registro.

### 3. Modificaciones durante la ruta

Se sigue la **opción B**: cada nueva emisión genera otro UUID, otra URL y otro QR, y
el fichero anterior se conserva. La cadena queda en `deca_documentos`: albarán,
versión, URL, UUID, motivo del cambio, quién lo emitió, cuándo y cuánto pesa, con los
estados `vigente` / `sustituido` enlazados entre sí.

El historial guarda una **copia de los datos del servicio** (número de albarán, fecha,
matrícula y cliente), de modo que sigue acreditando el documento aunque después se
borre el albarán. Al rehacer un DeCA el panel exige indicar el motivo.

La opción A —rehacer el mismo PDF con los datos anteriores tachados, conservando URL
y QR— **no está implementada**.

### 4. Disponibilidad y conservación

Supabase plan **Pro**, sin pausa por inactividad. El bucket `deca` **no tiene política
de borrado**, así que ningún usuario de la aplicación puede eliminar un DeCA; y desde
que se registra en `deca_documentos` tampoco puede sobrescribirlo
(`deca_update_solo_sin_registrar`). La vista `v_deca` calcula `conservar_hasta`
(fecha de emisión + 1 año).

### Consultas útiles

```sql
select * from public.v_deca            order by generado_at desc;  -- cadena completa
select * from public.v_deca_huerfanos;                             -- PDF publicados sin historial
```

## Factusol · el histórico completo

Comprobado el 14/09/2026 contra la API de Software DelSol (`api.sdelsol.com`,
base `3FS002`, cliente 39592).

**El ejercicio 2026 contiene el histórico completo**: 11.534 facturas de venta
fechadas entre 2003 y 2026. Los ejercicios 2019 a 2022 no existen como base
separada (`BDNoExiste`) y el 2025 responde `KO`; todo hay que pedirlo al 2026.

Las 11.534 están **todas en el panel**, con sus líneas, su IGIC por línea, su
estado y sus cobros. De los veinte años, diecinueve cuadran con Factusol al
céntimo; el 2026 difiere en las cuatro rectificativas emitidas desde el panel,
que en Factusol no existen.

### Cómo se consulta

`POST /login/Autenticar` con la contraseña en **base64** devuelve un token; después
`POST /admin/CargaTabla` con `{ejercicio, tabla, filtro}`. **El filtro no puede ir
vacío**: con `filtro: ''` responde `OK` y cero filas. La respuesta es
`{"resultado": [[{"columna","dato"}, ...], ...]}`.

### Modelo de datos

- **F_FAC** — cabeceras. Clave `TIPFAC` (serie) + `CODFAC` (número). Cuatro bases
  con su tipo: `BAS1`→`PIVA1`, `BAS2`→`PIVA2`, `BAS3`→`PIVA3` y `BAS4`, que es la
  base **sin IGIC**. `ESTFAC`: 0 pendiente, 1 parcial, 2 cobrada, 3 devuelta,
  4 impagada. `VENFAC` lleva los vencimientos como `fecha;importe;`.
- **F_LFA** — líneas. El grupo de IGIC de cada línea está en **`IVALFA`**
  (0 → `PIVA1`, 1 → `PIVA2`, 2 → `PIVA3`, 3 → base exenta), no en `TIVLFA`, que
  viene siempre a cero. El porcentaje no está en la línea: se resuelve contra la
  cabecera. `PIVLFA` tampoco sirve: siempre vale 0.
- **F_COB** — cobros y pagos. El documento no está en un campo propio: va dentro
  del texto de `CPTCOB` (`COBRO FACTURA Nº: 1 - 240353`). `CPACOB` numera los
  cobros parciales y `TIPCOB` distingue cobro de factura (0), de albarán (1) y
  pago a proveedor (3). `CODCOB` es único, así que no hay que deduplicar.

Las facturas **recibidas** no están en Factusol (`F_FAP`, `F_LFP` y `F_PAG` vienen
vacías): las compras se llevan en el panel, por el escáner.

### Espejo y carga

`factusol_facturas`, `factusol_lineas` y `factusol_cobros` guardan el origen tal
cual. El workflow *Araya · Factusol · traer todo* (`POST /araya/factusol-espejo`)
los rellena por tramos.

`importar_historico_factusol(lote)` pasa el espejo a las tablas operativas, y es
idempotente: solo crea las facturas que aún no están. Va a unas 200 facturas por
segundo.

- El **número** es el `CODFAC`, salvo en los 37 casos en que el mismo número
  existe en dos series: esos se numeran `serie-numero` (`2-210068`).
- Manda **la cabecera de Factusol** para base, IGIC y total. Las líneas se traen
  igualmente con su IGIC propio; cuando no reconstruyen la cabecera (358 facturas
  de 11.534, por descuentos de línea que el origen no expone) queda anotado en
  `factusol_sync_log` como `lineas_no_cuadran`.
- **No genera ningún asiento**: todo el histórico es anterior a
  `config_contable.fecha_inicio_contable` (01/01/2026). Comprobado: cero asientos
  para las facturas de origen `factusol-historico`.
- El estado de Factusol (pendiente, cobro parcial, cobrada, devuelta, impagada)
  se guarda en `facturas_venta.estado_factusol` y lo publica `v_facturas_venta`.

`v_factusol_cuadre` compara año a año lo que hay en Factusol con lo que ha llegado
al panel, y `v_factusol_faltan` lista las que faltan.

## El panel

### Buscadores

Clientes y proveedores son listas largas (1.255 y 218). Las dos pantallas llevan
un buscador que filtra por nombre, CIF, teléfono, correo y dirección, muestra los
60 primeros y deja ampliar de 60 en 60 (`CLIQ` / `PRVQ`, `bindClientes()` /
`bindProveedores()`).

### Gastos con el personal dentro

El KPI de **Gastos** del panel suma las facturas recibidas **y el coste de
personal** del año (devengado + Seguridad Social de la empresa), y el resultado
del ejercicio se calcula ya con esa suma. `v_panel` publica `gastos_personal`,
`gastos_personal_mes`, `gastos_totales`, `gastos_totales_mes`, `n_nominas`,
`nominas_por_pagar` y `n_nominas_por_pagar`.

### Avisos de cobro por correo

El envío real sale del workflow *Araya · Correo saliente (SMTP)*
(`POST /araya/v2/aviso-cobro`), que manda desde `administracion@` con la
credencial SMTP, exige sesión válida y rol admin o contable, y deja constancia en
`avisos_cobro`.

El aviso de **una sola factura** también envía (antes solo ofrecía `mailto:`, y
ese enlace ni siquiera abría porque codificaba la arroba de la dirección como
`%40`). Ahora hay *Enviar ahora* y un *Abrir en mi correo* que funciona; el
asunto se toma de la primera línea del texto, que no viaja dentro del cuerpo.

### Ficha de cliente

Toda la informacion de un cliente en una sola pantalla, en lugar de repartida
entre Clientes, Facturacion y Albaranes. Se entra desde *Ver ficha* en la lista
de clientes, pulsando el nombre del cliente en cualquier lista de facturas, o
desde *Ficha* en las condiciones de cobro.

La pantalla reune sus datos, sus condiciones de cobro, cuatro indicadores
(pendiente, facturado total, facturado del ano y cobrado) y cuatro pestanas:
facturas con su estado (incluidas devueltas e impagadas), cobros, albaranes con
su DeCA y avisos de cobro enviados. Avisa ademas si tiene facturas devueltas o
albaranes entregados sin facturar.

Los botones de editar datos, condiciones y nuevo albaran son los mismos de
siempre: la ficha no duplica formularios, solo los reune.

`v_cliente_ficha` calcula la fila de cada cliente; el resto lo pide la pantalla
por cliente segun hace falta. El modulo esta en `panel/cliente.js`.

### Conciliar nóminas contra el banco

Al conciliar un movimiento de salida, el panel consulta
`sugerir_nominas_movimiento` y ofrece las nóminas que encajan junto a las
facturas. *Es esta nómina* llama a `conciliar_nomina`, que marca la nómina
pagada, enlaza el movimiento y genera el asiento `465 / 572`.

## Copias de seguridad

Supabase respalda la base de datos, pero **no los ficheros de Storage**: restaurar
un backup no devuelve un PDF borrado. El workflow *Araya · DeCA · copia de
seguridad* deja cada lunes una segunda copia de los DeCA en Google Drive y la anota
en `deca_copias`; `v_deca_sin_copia` dice cuáles faltan.

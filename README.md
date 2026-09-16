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

### El escaner reconoce el documento

En la bandeja de escaneo, *Reconocer el documento solo* es ya lo que viene
marcado. Se suelta el monton de papeles y el panel decide por cada uno si es
nomina, factura emitida, factura recibida, albaran de trabajo o albaran de
proveedor, y lo manda a la bandeja que le toca. Los cinco tipos siguen teniendo
su opcion manual por si hiciera falta forzar uno.

El que reconoce es el workflow *Araya · Escaner · reconocer documento*
(`POST /araya/clasificar`): recibe **solo la primera pagina** del documento,
se la pasa a GPT-4o con un prompt que unicamente pide el tipo —ni importes ni
datos— y devuelve `{tipo, confianza, motivo}`. Leer los datos sigue siendo cosa
de los lectores de siempre, que no se han tocado.

Lo que no llega al 60 % de confianza, o sale como *otro*, **no se envia a
ninguna bandeja**: el panel lo nombra y pide elegir el tipo a mano. Mas vale eso
que colar un recibo del banco en las facturas.

Las nominas van por su ruta con el PDF original, porque su lector usa la capa de
texto; el resto van como imagenes de pagina, como hasta ahora.

El modulo del panel esta en `panel/escaner.js`.

### Conciliar repartiendo el movimiento

`movimientos_banco` tenia una casilla por tipo de documento —`factura_id`,
`factura_venta_id`, `nomina_id`…— y una sola. De ahi salian tres problemas que
parecian distintos: un ingreso que paga dos facturas no cabia, un anticipo no se
podia anadir a una nomina ya conciliada, y un movimiento cuyo cobro **ya estaba
anotado** solo podia conciliarse creando un segundo cobro, duplicando el ingreso.

`conciliacion_lineas` los resuelve de una vez: cada linea ata un movimiento con
un documento y dice cuanto de ese movimiento va ahi. Un movimiento se reparte
entre varios documentos, un documento se cobra o se paga en varias veces, y una
linea puede **enlazar un cobro existente** (`cobro_id`) en lugar de crear otro.

- `sugerir_reparto(mov)` propone: primero busca si el cobro ya estaba anotado, y
  si no, la combinacion de hasta tres facturas pendientes del mismo tercero que
  suma el importe exacto. Una combinacion de dos o tres solo se propone si al
  menos una lleva el nombre del tercero en el concepto: tres facturas sueltas que
  por casualidad suman el importe son ruido, no una propuesta.
- `conciliar_reparto(usuario, mov, lineas)` lo aplica. `deshacer_reparto` lo
  revierte entero.
- En pantalla: casilla e importe editable por documento y un contador de **lo que
  queda por asignar**; el boton de conciliar no se activa hasta que llega a cero.

### Anticipos al personal

Un anticipo **no es el pago de una nomina**: es dinero a cuenta que se descuenta
de una nomina futura. Va a la **460** contra banco, no a la 465, y `conciliar_reparto`
se niega a dejar una nomina pagada por encima de su liquido, diciendo que lo marques
como anticipo. `v_anticipos_personal` lleva lo entregado y todavia no descontado.

El nombre del trabajador se coteja palabra a palabra descartando las de la propia
empresa: ARAYA, FRANQUIZ y TRANSPORTES salen en todos los conceptos del banco y
casaban con los tres empleados que se apellidan asi.

### Cartera antigua e incobrables

El historico de Factusol trajo consigo su cartera abierta: facturas de 2009 a 2020
que siguen marcadas como pendientes porque nadie las cerro nunca. Contarlas como
pendiente de cobro daba 1,13 M€, de los que 722.848 € eran de ese arrastre
(BEFASCA sola, 421.638 € de 2011 a 2013).

Las facturas anteriores a 2021 quedan marcadas como **incobrables**
(`facturas_venta.incobrable`, con fecha y motivo). No se borra nada: salen del
pendiente de cobro y pasan a un contador aparte, **Cartera antigua**, con su
pestana propia en Facturacion. Si alguna se cobra, `marcar_incobrable` la
devuelve. Nada de lo que persigue dinero —avisos de cobro, prevision, tesoreria—
las mira.

Pendiente de cobro real: **405.529 €** en 272 facturas.

### Impuestos: modelo 111 y sociedades

`v_modelo_111` cuadra cada trimestre: las retenciones del trabajo salen de las
nominas (perceptores, base de IRPF y retencion) y las de profesionales de las
facturas recibidas con retencion. Si hay un modelo presentado en `modelo_111`,
compara y avisa cuando no cuadra con lo calculado.

`v_impuesto_sociedades` estima el impuesto del ejercicio a partir de los libros
(grupos 6 y 7 de `apuntes`) y **dice lo que le falta a los libros**: los meses de
nomina sin contabilizar los descuenta solos, prorrateando los que si estan; la
amortizacion, que todavia esta a cero, la tiene que poner una persona. Los
ajustes, el tipo, las bases negativas y los pagos a cuenta se guardan en
`impuesto_sociedades` con `guardar_impuesto_sociedades`.

A 14/09/2026: resultado segun libros 293.122 €, pero con los ocho meses de
nominas que faltan (unos 457.736 €) la base estimada se va a -164.614 €. Sirve
para ir mirando, no como cierre.

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

## El precio del gasoil en Fuerteventura

En **Repostajes**, encima de la lista de siempre, aparece el gasoleo A de la isla:
el precio medio, la gasolinera mas barata y la mas cara, y lo que te ahorras
repostando 400 litros en la barata en vez de al precio medio. El boton *Ver todas*
abre el detalle gasolinera por gasolinera con direccion y horario.

Los precios son los oficiales del Ministerio y los trae solos un automatismo cada
manana a las 07:30 (workflow `Araya · Precio del gasoil en Fuerteventura`). Se
quedan guardados en `precios_carburante`, una foto por dia, asi que con el tiempo
se puede mirar la evolucion. La tarjeta lee de `v_gasoil_hoy`.

A dia de hoy son 26 gasolineras entre Antigua, La Oliva, Pajara, Puerto del Rosario
y Tuineje.

## 4gflota

En **Flota e ITV** hay un boton *Abrir 4gflota* que lleva a
`https://arayafranquiz.4gflota.com/` en una pestana nueva, con el usuario de 4gflota
de siempre. Los kilometros y las posiciones **no** entran solos en el panel todavia:
para eso harian falta las credenciales de su API.

Debajo, un aviso recoge los vencimientos que la pantalla no miraba antes: tacografo,
tarjeta de transporte y ADR, vencidos o a menos de 45 dias. La ITV y el seguro los
sigue avisando la pantalla de siempre.

## Los vencimientos de cobro de cada cliente

Pantalla nueva **Vencimientos de cobro**, en el bloque de Ventas. Es la lista de
trabajo para ir poniendo, cliente a cliente, los dias de vencimiento, la forma de
pago, el dia fijo de pago y el correo para los avisos.

No salen los 1.255 clientes: salen solo los que han facturado en los ultimos 24
meses, ordenados por lo que facturan, que son los que de verdad importan. La columna
**Como paga de verdad** es la mediana de lo que ese cliente ha tardado en pagar sus
ultimas facturas, para que los dias se pongan con criterio y no a ojo. Cuando hay
historial suficiente (3 facturas cobradas o mas) el panel propone un plazo y se pone
con un solo boton.

De partida solo 12 clientes tenian condiciones puestas, sobre 2,8 millones de euros
facturados en 24 meses sin plazo definido.

### Dos cosas que estaban rotas

El boton *Condiciones de cobro* de la ficha de cliente y el *Editar* de la lista
**no hacian nada**. Buscaban al cliente en la lista que el panel lleva en memoria, y
ahi no estaban todos: PostgREST corta las respuestas a 1.000 filas y hay 1.255
clientes, asi que los 255 ultimos por orden alfabetico (de *PREFABRICADOS LA
ANTIGUA* a *ZUNINDA*) eran invisibles. Entre ellos 32 que facturan, con 520.693 €
en 24 meses.

Arreglado por los dos lados:

- El boton ya no depende de esa lista: si el cliente no esta cargado, lo va a buscar
  por su id y abre la ventana igual.
- Los clientes se cargan por paginas (`restPag`), asi que entran los 1.255. Esto
  tambien arregla los desplegables de cliente de albaranes y facturacion, donde esos
  255 tampoco aparecian.

## El menu, por bloques

El menu estaba en un cajon de sastre: quince pantallas seguidas bajo *Operativa*,
mezclando compras, taller, banco e impuestos. Ahora son **siete bloques**, que siguen
como se trabaja de verdad en la empresa:

| Bloque | Que hay |
|---|---|
| **Inicio** | Panel, Avisos, Informes |
| **Trafico** | Albaranes de servicio, DeCA, Flota e ITV, Repostajes |
| **Ventas** | Clientes, Vencimientos de cobro, Facturacion, Factoring, Presupuestos |
| **Compras** | Escanear y bandeja, Facturas de proveedor, Albaranes de proveedor, Proveedores, Materiales, Inventario |
| **Tesoreria** | Banco y conciliacion |
| **Personal** | Plantilla, Nominas |
| **Contabilidad** | Contabilidad, Impuestos |

**Escanear** y **Bandeja de escaneo** eran dos entradas para lo mismo: escaneas en una
y revisas en la otra. Ahora es una sola pantalla con dos pestanas, asi que se escanea
y se revisa sin salir. Ninguna pantalla se ha perdido por el camino.

## Facturar con las condiciones del cliente

Al facturar albaranes ya no se pone 30 dias a todo el mundo. Si no se dice otra
cosa, la factura coge los **dias de vencimiento de la ficha del cliente**, y si ese
cliente tiene **dia fijo de pago**, la fecha se corre al primer dia de pago que caiga
despues. Un cliente a 60 dias que paga los dias 10: una factura del 15 de septiembre
vence el 10 de diciembre, no el 14 de noviembre.

Lo calcula `fecha_vencimiento_cliente(cliente, fecha, dias)`, que usa
`facturar_albaranes` cuando no le pasan los dias. En la pantalla de facturacion, al
elegir el cliente el campo de vencimiento se rellena solo con sus dias, para ver
antes de emitir lo que se va a aplicar.

Asi lo que se rellena en *Vencimientos de cobro* sirve de verdad: marca las fechas de
las facturas nuevas y, con ellas, los avisos de cobro.

## El circuito albaran -> DeCA -> factura, probado entero

Probado de punta a punta contra la base real, en una transaccion que se deshace sola
(no queda ni rastro):

| Paso | Resultado |
|---|---|
| Crear el albaran | se numera solo: `ALB-2026-0004` |
| Poner las lineas | 2 lineas, base 515,00 € |
| Firma del cliente | queda firmado |
| `deca_preparar` | devuelve el documento con sus 7 campos |
| Facturar sin decir los dias | `F-2026-0001`, 515,00 + 36,05 de IGIC = 551,05 € |
| Vencimiento | 10/12/2026: cogio los 60 dias y el dia de pago del cliente |
| Lineas de la factura | las 2, con su albaran y fecha en la descripcion |
| Estado del albaran | pasa a *facturado* |
| Intentar facturarlo otra vez | lo impide |

## La numeracion de las facturas

El panel **continua la numeracion de Factusol**, no abre una serie propia. Las
facturas de 2026 van `AA` + cuatro digitos (260000...260464, la ultima del 14/09),
asi que la primera que se emita desde el panel sera la **260465**.

Antes de esto el panel habria empezado su propia serie `F-2026-0001`, en paralelo a
la de Factusol: dos numeraciones a la vez para la misma empresa.

`siguiente_numero_venta(fecha)` coge el mayor numero de ese ejercicio y suma uno.
Cuenta tambien las anuladas, porque un numero gastado no se reutiliza. En enero
arranca sola con el ejercicio nuevo (270001).

### Ojo mientras convivan Factusol y el panel

Las facturas de Factusol entran en el panel cada hora. Si alguien emite en Factusol y
en el panel dentro de la misma hora, los dos podrian pedir el 260465. Para que eso no
pase en silencio hay un **indice unico** sobre el numero de factura: la segunda falla
con un error en vez de colarse duplicada.

Aun asi, lo sano es **dejar de facturar desde Factusol** en cuanto se empiece a
facturar desde el panel.

## Las facturas rectificadas (los abonos de Factusol)

En el panel salian como **pendientes de cobro** 401.628 € cuando muchas de esas
facturas estaban abonadas en Factusol desde hace anos. No era un fallo de importacion:
el panel nunca miro el estado que Factusol le pone a cada factura.

### Donde estan los abonos

No hay tabla de abonos en Factusol. Se probaron las nueve habituales (`F_ABO`, `F_LAB`,
`F_ABV`, `F_ABC`, `F_RFA`, `F_LRF`, `F_FAB`, `F_DEV`, `F_LDV`) y todas vienen vacias.
Lo que hay es el campo **`ESTFAC`** en la cabecera de la factura, y a veces una nota a
mano en la referencia: *"ABONO 60"*, *"ABONADA EL 18/04/23"*, *"DUPLICADA"*,
*"ABONO 0100197 NUEVA FAC. 230123"*.

Los estados, contrastados contra los cobros reales de `F_COB`:

| ESTFAC | Que es | Comprobacion |
|---|---|---|
| 0 | Pendiente | 94,5 % sin cobrar |
| 1 | Cobro parcial | 25 de 30 con cobro a medias |
| 2 | Cobrada | 7.610 cobradas del todo |
| 3 y 4 | Abonada / anulada | 93-97 % sin cobrar nunca |

### Rectificada no es cobrada

Un abono es una **rectificacion**: la factura se anula y normalmente se vuelve a emitir
en otra. Marcarlas como cobradas diria que entro un dinero que no entro, e inflaria los
ingresos. Marcarlas como incobrables diria que se perdio, y tampoco: se rehizo.

Por eso `facturas_venta` tiene ahora el estado **`rectificada`**, con su fecha, el motivo
copiado de la nota de Factusol y el `estfac_factusol` de origen. No cuenta como pendiente
ni como cobrada. No se borra nada y se puede deshacer con `marcar_rectificada()`.

Las seis vistas que deciden que es pendiente (`v_panel`, `v_cliente_ficha`,
`v_cobros_pendientes`, `v_facturas_venta`, `v_tesoreria`, `v_clientes_vencimientos`)
excluyen las rectificadas.

### Que se hace solo

`Araya · Rectificadas de Factusol` corre **cada noche a las 04:30**: lee de Factusol el
estado de las facturas de los tres ultimos ejercicios y marca las que se hayan abonado.
Si en Factusol devuelven una a pendiente, aqui vuelve sola. Es idempotente.

La primera pasada contra Factusol en vivo actualizo 169 estados, devolvio 16 a pendiente
(el espejo estaba desfasado) y marco 2 nuevas.

Un detalle de la API de Factusol: **`CargaTabla` devuelve vacio si se le pide una tabla
sin filtro**. Hay que acotar siempre, aunque sea por rango de fechas.

### Como queda

| | Antes | Ahora |
|---|---|---|
| Pendiente de cobro | 401.628 € (265 facturas) | **253.320 € (171 facturas)** |
| Rectificadas | — | 142.929 € (99 facturas) |
| Cartera antigua | 722.848 € | 722.848 € |

De las 99 rectificadas, 75 lo dicen con todas las letras en la nota de Factusol. Las
otras 24 estan en estado 3 o 4 sin nota, o con una nota que no usa la palabra abono
("nueva 210285", "POR OTRA EMITIDA EN ABRIL DE 2023", "DUPLICADA", "ANULAR POR SEPARAR").
Se ven todas en `v_rectificadas`, con su motivo, por si alguna hay que devolver a
pendiente.

## Pantallas que estaban construidas y no se podian abrir

Al repasar lo que quedaba a medias aparecio un patron: hay modulos que se **inscriben
solos en el menu** al cargar, con un bloque `(function(){ ... MENU.splice(...) })()` que
busca una pantalla de referencia y se cuelga detras. Son cinco: Tesoreria + Prestamos,
Compensaciones, Buscar tercero, Correos enviados, y el que saca Presupuestos de
"Proximamente".

El de Tesoreria y Prestamos se colgaba detras de **Informes**, que en el menu nuevo esta
en el bloque Inicio: dos pantallas de tesoreria aparecian arriba del todo, entre el Panel
y los Informes. Ahora **Cobros y pagos** y **Prestamos** van fijas en el bloque Tesoreria,
y el bloque solo se encarga de ponerles el titulo.

Compensaciones se cuelga detras de Tesoreria, asi que cae sola en su sitio. El menu al
cargar queda:

| Bloque | Pantallas |
|---|---|
| Inicio | Panel, Avisos, Informes |
| Trafico | Albaranes de servicio, DeCA, Flota e ITV, Repostajes |
| Ventas | Clientes, Vencimientos de cobro, Facturacion, Correos enviados, Presupuestos, Factoring |
| Compras | Escanear y bandeja, Facturas de proveedor, Albaranes de proveedor, Proveedores, Materiales, Inventario |
| Tesoreria | Cobros y pagos, Compensaciones, Prestamos, Banco y conciliacion |
| Personal | Plantilla, Nominas |
| Contabilidad | Contabilidad, Buscar tercero, Impuestos |

Treinta pantallas, ninguna repetida y ninguna sin bloque.

**Cuidado con los flags.** Cada bloque usa una marca para no duplicarse. Compensaciones,
tercero y correos usan una propia (`TIT.__cmpmenu`, `TIT.__btercmenu`, `TIT.__cormenu`),
pero el de Tesoreria usaba `!TIT.tesoreria`: al anadir ese titulo a mano el bloque dejo de
correr y Prestamos desaparecio del menu. Si se toca algo de esto, hay que simular el menu
entero despues, no solo mirar el array del codigo.

## Reclamaciones: burofax, juzgado y seguimiento

Pantalla nueva **Reclamaciones**, en Ventas. Lleva el expediente de cada deuda que se
reclama: quien lo lleva, el burofax, la fecha de la denuncia, el juzgado, el numero de
autos, lo recuperado, y un **diario de gestiones** con fecha y tipo (llamada, escrito,
vista, resolucion, pago...). Cada gestion deja puesto *que toca hacer* y *cuando*, que es
lo que hace falta para ir preguntando sin que se olvide ninguno.

Tres tablas: `reclamaciones`, `reclamacion_facturas` (una reclamacion puede cubrir varias
facturas) y `reclamacion_actuaciones` (el diario). Se opera con `guardar_reclamacion()` y
`anadir_actuacion()`. Al abrir un expediente sin decirle facturas, coge todas las
pendientes de ejercicios anteriores de ese cliente.

### Lo que dice la ley, y por que importa

La pestana **Sin reclamar** no es solo una lista de morosos: dice de cada uno que via toca
y cuanto tiempo queda. Contrastado con la norma, no de memoria:

- **La peticion inicial del monitorio no necesita abogado ni procurador, sea cual sea el
  importe** (art. 814.2 LEC). No hay tope de cuantia desde la Ley 37/2011. Asi que la regla
  de "menos de 3.000 € lo hacemos nosotros" se queda corta: se puede presentar cualquier
  importe sin abogado.
- Se presenta en el **juzgado del domicilio del deudor**, y ese fuero es exclusivo: no cabe
  pactar otro (art. 813 LEC).
- Lo que cambia con el importe es **que pasa si el deudor se opone**: hasta 2.000 € sigue
  siendo juicio verbal sin abogado ni procurador (arts. 23.2.1 y 31.2.1 LEC); hasta 6.000 €
  es verbal ya con los dos; por encima es ordinario, y hay **un mes** para presentar la
  demanda o se sobresee con costas (art. 818.2 LEC).
- **El plazo es de un ano, no de cinco.** En transporte terrestre de mercancias las acciones
  prescriben al ano (art. 79 Ley 15/2009), dos si hubo dolo. Y aqui la reclamacion
  extrajudicial escrita **suspende** el plazo, no lo interrumpe: el tiempo ya corrido no se
  borra, solo se para el reloj (art. 79.3).
- A la deuda se le suman intereses de demora al tipo que publica el Tesoro cada semestre
  (**10,40 % para el segundo semestre de 2026**, BOE-A-2026-14327) y **40 € por cada
  factura** impagada, que el Tribunal Supremo ha fijado que son por factura y no por
  reclamacion (STS 5012/2025). Los tipos viven en `interes_demora_comercial`: hay que
  anadir una fila cada 1 de enero y cada 1 de julio.

El panel lo calcula por deudor y lo pinta, pero **es una orientacion para priorizar, no un
dictamen**: lo dice en pantalla y hay que confirmarlo con el abogado antes de presentar nada.
Ademas la prescripcion no se aplica de oficio: la tiene que alegar el deudor.

### Lo que sale al mirar la cartera con este filtro

De los 789.690 € de ejercicios anteriores, contando desde el ultimo vencimiento:

| Plazo | Clientes | Deuda |
|---|---|---|
| En plazo (menos de 1 ano) | 6 | 18.678 € |
| Se acaba (quedan menos de 65 dias) | 5 | 3.204 € |
| Paso el ano | 14 | 12.509 € |
| Mas de 2 anos | 101 | 755.299 € |

O sea: lo que se puede reclamar con el plazo claramente vivo son **11 clientes y 21.882 €**,
no los 104 pequenos de anos anteriores. Ahi es donde merece la pena el esfuerzo, y corre
prisa. El resto no es imposible (hay que ver si a cada servicio le aplica el ano del
transporte o los cinco del Codigo Civil, y el deudor tiene que alegar la prescripcion),
pero eso ya es criterio del abogado.

## Un agujero de seguridad que estaba abierto

Al repasar los avisos de seguridad de Supabase salio algo serio: **cualquiera con la
direccion del panel podia leer toda la base de datos sin iniciar sesion**.

El mecanismo: la clave publica de Supabase (`anon`) viaja dentro del HTML del panel, que
es lo normal y por si sola no es un problema, porque lo que protege los datos es el RLS.
Pero las 65 vistas del panel son *security definer* (pertenecen a `postgres`), asi que
**se saltan el RLS de las tablas que hay debajo**, y tenian permiso de lectura para `anon`.
Con esa clave y el nombre de una vista se leian facturas, clientes, empleados y nominas
sin pasar por el login. Ademas cuatro tablas estaban directamente sin RLS
(`factusol_raw`, `factusol_contraste`, `factusol_sync_log`, `interes_demora_comercial`),
y dos de ellas con permiso de escritura y borrado heredado de `PUBLIC`.

Y por el otro lado, las funciones: en Postgres nacen ejecutables por `PUBLIC`, asi que
**159 funciones estaban al alcance de cualquiera**, entre ellas `borrar_factura`,
`conciliar_movimiento` o `facturar_albaranes`.

### Que se ha hecho

El panel consulta **siempre** con el token del usuario que ha entrado (rol
`authenticated`); el rol `anon` solo hace falta para el propio login, que va por
`/auth/v1` y no toca ninguna de estas tablas. Asi que:

- Retirada la lectura de `anon` en las 146 tablas y vistas. Ahora sin sesion no se ve nada.
- Retirados los permisos heredados de `PUBLIC`, incluidos los de escritura y borrado.
- RLS activado en las cuatro tablas que no lo tenian, con politica para `authenticated`
  y para `n8n_app`.
- `app_ui_versiones` tenia RLS sin ninguna politica: no entraba nadie, ni el panel. Ya tiene.
- Retirada la ejecucion de `PUBLIC` y de `anon` en las funciones del negocio, concediendola
  solo a quien la usa: `authenticated`, `n8n_app` y `service_role`.

Comprobado despues: `anon` no ve **ninguna** tabla ni vista y no puede ejecutar ninguna
funcion del negocio; `authenticated` conserva las 146 y las 170 funciones, y n8n las suyas.
Las 31 funciones que `anon` todavia puede ejecutar son de la extension `pg_trgm`
(similitud de texto): calculo puro, sin acceso a datos.

### Lo que sigue flojo

`exigir_identidad(p_usuario)` recibe el id del usuario **desde el cliente**. Con sesion
iniciada, alguien podria pasar el id de otro usuario y actuar en su nombre. Lo correcto es
sacar la identidad del propio token (`auth.uid()`) en vez de creerse el parametro. No se ha
tocado porque afecta a las 170 funciones y hay que hacerlo con calma.

## El comprobante del cobro tiraba el cobro entero

Al registrar un cobro con copia del ingreso adjunta salia un error crudo de Supabase:

    {"statusCode":"403","error":"Unauthorized",
     "message":"\"exp\" claim timestamp check failed","code":"AccessDenied"}

Eso es que el token de sesion estaba caducado. Pero el problema de verdad no era el
mensaje feo, sino el orden de las cosas:

    subir el comprobante  ->  registrar el cobro

Encadenados. Si la subida fallaba, la promesa se rompia y **el cobro no llegaba a
registrarse**. O sea que no se perdia el adjunto: se perdia el cobro entero y habia que
volver a teclearlo.

Arreglado por los dos lados:

- **Reintento con la sesion renovada.** `_subeComprobante` ya llamaba a `auth()`, pero
  `auth()` solo renueva si el token va a caducar en menos de 120 segundos y el refresco
  funciona; si `renovar()` fallaba, devolvia el token muerto sin decir nada. Ahora, si el
  almacen responde 401 o 403, se fuerza la renovacion y se reintenta la subida una vez.
- **El cobro se registra igual.** La subida va en su propio `catch`: si no se puede subir,
  se sigue adelante con el comprobante a nulo y el aviso lo dice sin jerga: *"Cobro parcial
  registrado. Quedan X. El cobro queda guardado, pero el comprobante no se subio porque se
  habia caducado la sesion"*.

Los motivos se traducen a castellano (`cmpMotivo`): sesion caducada, fichero demasiado
grande, sin conexion, o el codigo que devuelva el servidor.

Probado con 25 casos: subida normal, sesion caducada que se renueva y acaba subiendo,
sesion caducada que no se puede renovar, fichero de mas de 15 MB, sin conexion, sin
adjuntar nada, e importe vacio. En todos los que fallan el adjunto, el cobro queda
registrado.

**Lo que todavia no se puede:** volver a adjuntar el comprobante a un cobro ya registrado.
Si la subida falla, el cobro esta bien pero el justificante se queda fuera.

## Una factura no se puede cobrar dos veces

Cuando se cargan los movimientos del banco y se concilian, el reparto puede ir contra una
factura **que ya tenia el cobro anotado a mano**. `sugerir_reparto` lo detecta y propone
enlazar el cobro existente ("ya estaba anotado el DD/MM/YYYY: se enlaza, no se crea otro
cobro"), pero nada obligaba a aceptar esa sugerencia: si se concilia contra la factura sin
enlazar, `conciliar_reparto` **crea un segundo cobro** y como `importe_cobrado` es la suma
de todos los cobros, la factura se queda al doble. La rama de nominas ya tenia ese tope;
la de cobros no.

Y no era teorico: **24 facturas ya estaban cobradas de mas, por 32.640 €**, diez de ellas
con varios cobros.

Ahora hay un disparador en `cobros` (`cobros_sin_pasarse`) que impide que la suma de los
cobros de una factura pase de su total. El mensaje dice que hacer:

> La factura 260328 es de 1.490,65 EUR y ya tiene anotado 1.490,65 EUR del 16/09/2026. Con
> este cobro se quedaria en 2.981,30 EUR, mas de lo que vale. Si el ingreso del banco es el
> de ese cobro, enlazalo en vez de anotar uno nuevo.

Solo salta cuando la cosa **empeora**, para no bloquear el arreglo de las 24 que ya venian
mal del historico. Probado: el cobro completo entra, el segundo igual se rechaza, pasarse
por 5 € tambien se rechaza, y completar a plazos (400 + 670 de 1.070) sigue funcionando.

## Adjuntar el comprobante a un cobro ya hecho

En la ventana de cobros de una factura, los cobros que no tienen justificante salen ahora
con un boton **Adjuntar**. Abre el selector de ficheros, sube el documento y lo engancha al
cobro con `adjuntar_comprobante_cobro()`. Usa la misma subida que el registro de cobros, asi
que si la sesion esta caducada la renueva y reintenta sola.

## Presupuestos no funcionaba: tres modulos peleandose por los mismos nombres

El modulo de presupuestos se anadio el ultimo y usa nombres muy genericos que ya estaban
cogidos:

| Nombre | Lo usaba | Y tambien |
|---|---|---|
| `PR` | Prestamos | Presupuestos |
| `carga()` | Compensaciones | Presupuestos |
| `_cn()` | otro modulo | Presupuestos |
| `_d2()` | otro modulo | Presupuestos |

En JavaScript la ultima declaracion gana, asi que `carga()` era siempre la de presupuestos
(y Compensaciones se quedaba cargando para siempre), mientras que `PR` lo tocaban los dos
modulos a la vez y se corrompian el estado mutuamente.

Arreglado renombrando **solo lo de presupuestos** dentro de su tramo del fichero:
`PR` -> `PRE`, `carga(` -> `cargaPre(`, `_cn(` -> `_cnPre(`, `_d2(` -> `_d2Pre(`. Son 84 + 6
+ 4 + 23 sustituciones, **+183 bytes exactos** y sin un solo cambio en parentesis, llaves ni
comillas: un renombrado puro. Cada modulo recupera sus nombres.

**La leccion, que ya salio con el menu:** estos modulos se escribieron por separado y
comparten un unico ambito global. Antes de anadir otro, conviene mirar que el nombre no
este cogido.

---

## 16/09/2026 — El panel daba "Error al cargar (500)"

Sintoma: la pantalla del panel se quedaba en blanco con `Error al cargar (500)` y un boton
de Reintentar. A veces cargaba y a veces no, mas o menos una de cada dos.

**Que pasaba.** El arranque del panel pide varias listas a la vez y basta que **una** falle
para que no se pinte nada. La que fallaba era `v_movimientos` (los movimientos del banco):
tardaba mas de los 8 segundos que Supabase da como maximo a una consulta y el servidor la
cortaba. En el log de Postgres se veia tal cual: `canceling statement due to statement timeout`.

**Por que tardaba tanto.** La vista `v_movimientos_banco` llamaba a
`sugerencias_conciliacion()` **cuatro veces por cada movimiento** (una por columna: cuantas
sugerencias hay, cual es la mejor, de quien es y que numero tiene). Y cada llamada recorria
**entera** la tabla `facturas_venta`, que desde que se volco Factusol tiene 11.538 filas,
porque el filtro `abs(round(total,2) - importe) <= tolerancia` no lo puede aprovechar ningun
indice. Con 58 movimientos sin conciliar salian 232 barridos completos de la tabla: unas
200.000 paginas de disco. Con la cache caliente iba; en frio, no llegaba.

**Arreglado en dos pasos:**

1. **Indices por importe** (`idx_fv_total_pendiente`, `idx_f_total_pendiente`) y, en
   `sugerencias_conciliacion()`, un filtro de rango delante del original
   (`total between importe - tolerancia - 0,01 and importe + tolerancia + 0,01`). Se deja
   tambien la condicion de siempre, asi que el resultado es identico; la holgura de 0,01 es
   mayor que el maximo error posible del redondeo, de modo que no puede caerse ninguna fila
   que antes entrara. La busqueda pasa de barrido completo a indice: **4,4 ms -> 0,14 ms**.
2. **Una sola llamada por movimiento** en `v_movimientos_banco`: las cuatro subconsultas se
   sustituyen por un `LEFT JOIN LATERAL` con `count(*) FILTER`, `max()` y `array_agg(... ORDER BY)`.

Comprobado que no cambia ni un dato: se calcularon las cuatro columnas con la formulacion
antigua y con la nueva para todos los movimientos y se compararon en los dos sentidos,
**0 diferencias**. La consulta que hace el panel pasa de ~200.000 paginas a **1.362**.

## 16/09/2026 — Aviso de seguridad de Supabase

Llego el correo "Action required: security vulnerabilities detected in your projects", con
fecha de deteccion **13/09**. Senalaba dos proyectos:

- **araya-operativa**: ya estaba resuelto. El agujero (tablas y vistas legibles sin iniciar
  sesion) se cerro el 15/09; hoy el analizador ya no lo lista.
- **asesoria-ia**: quedaba abierta la tabla `public._respaldo_funciones`, una copia interna
  de definiciones de funciones. El rol `anon` tenia sobre ella lectura, escritura y borrado,
  es decir que cualquiera con la URL del proyecto podia vaciarla. Se le ha quitado el permiso
  a `anon` y a `authenticated` y se le ha activado RLS. No la usa ninguna pantalla.

## 16/09/2026 — Fecha y modo de pago al pagar una factura de proveedor

Antes, el boton "Registrar pago" decia *"se marcara como pagada con fecha de hoy"* y pagaba
sin preguntar nada: siempre con la fecha del dia y siempre contra el banco. Ahora la ventana
pide **fecha de pago** (no deja poner una futura, ni anterior a la propia factura) y **modo
de pago** (transferencia, domiciliado, tarjeta, efectivo, confirming). Los dos son
obligatorios; si falta alguno no se manda nada al servidor.

La fecha viene con el dia de hoy puesta y el modo aparece ya elegido si la factura o el
proveedor ya tenian forma de pago, para no tener que escribirlo cada vez.

El modo decide de donde sale el dinero en el asiento: **efectivo -> caja (570)**, el resto
-> banco (572). Antes esa decision se tomaba con la forma de pago que tuviera guardada la
factura, que en 1.196 de 1.280 facturas estaba vacia.

`pagar_factura_compra` pasa a recibir `p_forma_pago` y a guardarla en la factura. Probado
contra la base: rechaza fecha futura, rechaza un modo inventado, y un pago en efectivo
queda con cuenta 57000000, estado pagada, fecha y forma guardadas y su asiento. La prueba
se deshizo entera.

## 16/09/2026 — El cierre de seguridad se estaba deshaciendo solo

Al recrear `pagar_factura_compra` aparecio que el rol `anon` (el de quien no ha iniciado
sesion) volvia a tener permiso sobre ella. La causa: Supabase deja configurados unos
**permisos por defecto** que conceden a `anon` acceso total a **cada tabla, funcion o
secuencia nueva** del esquema `public`. Es decir, el cierre del 15/09 duraba hasta que
alguien creara cualquier cosa. Ademas Postgres concede por su cuenta `EXECUTE` a PUBLIC en
toda funcion nueva, y PUBLIC incluye a `anon`.

Corregido en los dos sitios:

```sql
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on functions from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
alter default privileges for role postgres revoke execute on functions from public;
```

Comprobado creando una tabla y una funcion de prueba: nacen cerradas. Se cerraron tambien
`eur_txt` y `tg_cobros_sin_pasarse`, creadas ayer y que habian nacido abiertas. Ahora mismo
`anon` no alcanza **ninguna** tabla ni vista (0 de 146) ni **ninguna** funcion del negocio;
las 31 que quedan son operaciones matematicas de la extension `pg_trgm`. `authenticated`
conserva sus 146 tablas/vistas y 173 funciones.

## 16/09/2026 — Facturas que no cuadraban: Endesa e ITV

**El problema, tal cual estaba.** Para contabilizar una factura de proveedor el panel
exige que `base imponible + IGIC - retencion = total`. Si no cuadra no genera asiento y la
factura se queda en la lista de incidencias, pendiente justo por esa diferencia. Habia
tres asi:

| Factura | Proveedor | Base | IGIC | Total | Falta |
|---|---|---|---|---|---|
| 000003740/35142026F | SGS ITV | 52,08 | 3,65 | 59,91 | 4,18 |
| N26CNO003884573 | ENDESA OFICINA TIRBA | 60,32 | 5,14 | 67,46 | 2,00 |
| N2BCONO01482161 | ENDESA OFICINA TIRBA | 53,88 | 2,01 | 57,89 | 2,00 |

En la de la ITV los 4,18 de **tasa de trafico** estaban metidos en el campo "portes", que
no entra en el cuadre. En las de Endesa los 2,00 de **financiacion del bono social y
alquiler de contador** no estaban en ningun sitio.

**Por que no bastaba con sumar "portes" al cuadre.** De las cuatro facturas del panel que
usan ese campo, **tres ya cuadran sin el**, porque ahi el importe si esta dentro de la base
imponible (son portes de verdad, de BLUMAQ, y llevan su IGIC). Sumarlo habria descuadrado
lo que hoy cuadra. El campo se estaba usando con dos significados distintos.

**Lo que se ha hecho.** Una tabla `facturas_conceptos`: importes que van al total pero **no**
a la base ni al IGIC, cada uno con **su propia cuenta de gasto**. Y `proveedores_conceptos`,
una plantilla por proveedor para que al abrir la factura aparezcan ya ofrecidos los
conceptos que ese proveedor suele traer (las tres Endesa y las dos ITV vienen sembradas).

En el panel, la ventana de la factura lleva ahora una seccion de conceptos (concepto,
importe y cuenta, con botones para anadir los del proveedor) y un campo **Referencia /
contrato**, para separar las cuentas de gasto por punto de suministro. El aviso de debajo
cuenta ya los conceptos y dice cuanto falta por desglosar.

Por dentro: `crear_factura_compra` y `editar_factura_compra` guardan los conceptos **en la
misma llamada** y antes de comprobar el cuadre (si se guardasen aparte, la comprobacion
rechazaria la factura antes de que existieran), y `generar_asiento_factura` los lleva al
asiento, cada uno a su cuenta. Ademas ahora se niega a crear un asiento descuadrado.

Probado contra la base, con las facturas de verdad y deshaciendo despues:

- Sin desglosar, Endesa se rechaza con el mensaje exacto: *base 53,88 + IGIC 2,01 + otros
  conceptos 0,00 - retencion 0 = 55,89, pero el total pone 57,89*.
- Con el desglose, sale de incidencias y el asiento queda: 628 gasto 53,88 · 628 bono
  social · 628 alquiler de contador · 472 IGIC 2,01 · 410 proveedor 57,89 al haber. Cuadra.
- La de la ITV, con la tasa en su concepto: 600 gasto 52,08 · **631 Tasas de trafico 4,18** ·
  472 IGIC 3,65 · 400 proveedor 59,91. Cuadra, y la tasa deja de ensuciar la cuenta de compras.

**Lo unico que queda a mano:** las dos facturas de Endesa siguen en incidencias porque los
2,00 hay que repartirlos entre bono social y alquiler de contador mirando el papel. No me
los he inventado. La de la ITV ya esta arreglada: los 4,18 se pasaron de "portes" a su
concepto (solo esa factura; las otras tres que usan "portes" ya cuadraban y ya tienen asiento).

## 16/09/2026 — Auditoria de nombres repetidos en el panel

Despues de que el mismo fallo saliera dos veces (el menu y luego `PR`/`carga`), se paso una
revision a todo el ambito global del panel: cada `function X(` y cada `var X =` de primer
nivel. Resultado:

**Choque de verdad, en marcha:** Compensaciones y Presupuestos declaraban las dos un
`sync()`, un `totales()` y un `guardar()`. Gana la ultima, o sea las de Presupuestos, asi
que **el boton "Guardar" de Compensaciones estaba llamando al guardar de Presupuestos** —
y `totales()` hacia `PRE.form.lineas` sobre un `PRE.form` vacio. Arreglado renombrando solo
las de Presupuestos dentro de su tramo: `syncPre`, `totalesPre`, `guardarPre`. Son 12
sustituciones, **+36 bytes exactos** y ni un cambio en parentesis, llaves ni comillas.

Conviene notar que **estas tres no eran la causa del fallo de Presupuestos** que se arreglo
antes: como ganaban las suyas, Presupuestos funcionaba y la rota era Compensaciones.

**Codigo muerto, que era una trampa:** `albLee` y `_subeComprobante` estaban declaradas dos
veces. En los dos casos la viva (la ultima) es la buena:

- `albLee`: la viva lee ademas obra, origen, destino, tipo de carga, LER, mercancia y peso,
  y las lineas por servicio (`.a_sid`) *y* por material (`.a_mid`). Es un superconjunto de
  la muerta, asi que no habia fallo visible.
- `_subeComprobante`: la viva es la que reintenta con la sesion renovada cuando el servidor
  responde 401 o 403 — el arreglo del "error al subir copia del ingreso". La muerta era la
  anterior, sin reintento.

Se han borrado las dos muertas (**-1.586 bytes**, con todos los delimitadores cuadrando:
-72/-72 parentesis, -12/-12 llaves, -9/-9 corchetes). No cambia nada en marcha, pero quita
el riesgo de corregir la copia que no se ejecuta y creer que ya esta.

**Lo que queda repetido no es un choque:** `col`, `fec`, `ini` e `intenta` estan declaradas
dentro de otras funciones (los generadores de PDF, el canvas de la firma y los cargadores de
librerias), asi que cada una vive en su propio ambito. Y no hay **ningun** `var` de primer
nivel repetido.

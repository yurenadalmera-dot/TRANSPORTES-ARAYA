# Cambios en el panel · 07/10/2026

Hechos directamente en producción: el HTML del panel en `public.app_ui` (fila `app`, versionado
solo en `app_ui_versiones`), funciones y vistas de Supabase (`araya-operativa`) y el flujo de n8n
«Araya · App con login (GET)». En esta carpeta queda copia del código añadido.

## 1. Registrar factura recibida: conceptos con su IGIC, descuento y retención

**Antes:** el desglose de IGIC por tipo y los «otros conceptos» (tasas, bono social...) eran dos
secciones separadas, y la retención era un importe suelto.

**Ahora:** una sola sección **Conceptos de la factura**. Cada concepto lleva:

| Campo | Qué hace |
|---|---|
| Concepto | texto libre (mano de obra, material, tasa de tráfico...) |
| Base imponible | importe del concepto sin IGIC |
| Descuento | se resta de la base de ese concepto |
| IGIC | 7 %, 3 %, 0 % (exento), 9,5 %, 15 %, 20 % o **Sin IGIC** (tasas, bono social...) |
| Cuenta | solo en los «Sin IGIC»: la cuenta de gasto (vacía = la del proveedor) |

Con algún concepto con IGIC, la cabecera (base imponible, IGIC y descuento) se calcula sola y queda
bloqueada; el total se rellena solo en facturas nuevas (en las que se editan se respeta el del
papel y el aviso dice si cuadra).

**Retención IRPF:** desplegable `No lleva / 15 % profesional / 7 % inicio de actividad / 19 %
alquiler / 1 % módulos / Otro importe`. Calcula la retención sobre la base. Al elegir un proveedor
con `modelo_retencion` 111 propone el 15 %, y con 115 el 19 %.

Por dentro (la contabilidad no cambia de modelo):

- lo que lleva IGIC se agrupa por tipo y va a `facturas_igic`;
- lo que va «Sin IGIC» va a `facturas_conceptos`, cada uno con su cuenta;
- el detalle tal como se tecleó se guarda en la columna nueva `facturas.conceptos_detalle` (jsonb)
  con la función nueva `guardar_conceptos_detalle`, solo para volver a pintar la factura. Si ese
  detalle no cuadra con `facturas_igic`/`facturas_conceptos`, el panel lo reconstruye desde ellas.

**Fallo corregido:** `guardar_desglose_igic` recalculaba el total como base + IGIC − retención,
olvidando los conceptos sin IGIC. En una factura con desglose y con tasas, el total quedaba corto
y el asiento no se rehacía. El panel llama ahora a `guardar_desglose_factura`, que llama a la
original, corrige el total y rehace el asiento. Así no hubo que tocar la original (que lleva
borrados dentro).

Otro fallo de paso: la casilla «Contabilizarla aunque sea anterior al inicio de la contabilidad»
se perdía al pulsar Registrar. Ahora se lee antes de repintar.

Código: `facturas-recibidas-conceptos.js`.

## 2. Albaranes de servicio: buscador libre

Caja de búsqueda encima de los filtros: busca en **todos** los campos del albarán (número,
cliente, obra, matrícula, conductor, notas, líneas, fecha dd/mm/aaaa, importe 120,50...), sin
distinguir mayúsculas ni tildes. Varias palabras deben aparecer todas. Los filtros de siempre
trabajan sobre lo encontrado. Escape borra la búsqueda.

Los filtros del listado los añade n8n al servir el panel (nodo «Construir panel»), así que el
buscador va en un nodo nuevo, «Buscador albaranes», entre «Construir panel» y «Responder HTML».
Código: `n8n-buscador-albaranes.js`.

## 3. Planning semanal: Duplicar trabajo

En la ventana de un trabajo guardado hay un botón **Duplicar**: abre un trabajo **nuevo** con los
mismos datos (persona, vehículo, cliente, servicios, origen, destino, obra...) para el día
siguiente y en estado pendiente, **sin guardar todavía**. Se cambia lo que haga falta (fecha,
horas, características) y se pulsa Guardar.

## 4. Facturas emitidas: Nueva factura

Botón **+ Nueva factura** junto a «Facturar albaranes». Factura a mano, sin albaranes: cliente
(buscando por nombre o CIF), fecha, días de vencimiento (vacío = los de la ficha), líneas con
concepto, cantidad, precio y tipo de IGIC, y notas. Calcula base, IGIC y total al momento y pide
confirmación antes de emitir.

Función nueva `crear_factura_venta(p_usuario, p_datos)`: numeración, líneas y asiento igual que
`facturar_presupuesto` (con `origen = 'manual'`). Código: `nueva-factura-emitida.js`.

## 5. Banco y conciliación: a qué factura va cada movimiento

- Columna nueva **Factura** después de «Estado», con un botón por factura: abre la imagen de la
  factura. Las emitidas sin escanear abren su PDF y, si a una recibida le falta la imagen, lo dice.
- En «Conciliado» aparece debajo **Fra. nº …** (todas, si el movimiento se repartió entre varias).
- Vista nueva `v_movimientos_facturas` (security_invoker): junta `conciliacion_lineas` y los
  `factura_id` / `factura_venta_id` directos del movimiento.

## 6. Albaranes: se anulan, no se borran

**Qué pasó con los «borrados»:** `borrar_albaran` eliminaba el albarán y dejaba copia en
`albaranes_borrados` (hay 39, todos borrados desde el panel). En la serie D faltaban tres números:

- **D-9 y D-10**: borrados el 05/10/2026 con motivo «PRUEBA». La copia completa, con sus líneas,
  está en `albaranes_borrados`.
- **D-27**: no se borró. Nunca existió como albarán. El D-26 se creó el 05/10 a las 20:23, el C4
  (serie interna) a las 20:28 y el siguiente D fue el D-28 al día siguiente: ese número se quedó
  sin usar.

**Ahora:**

- El botón **Borrar** pasa a ser **Anular**. Pide motivo (obligatorio), el albarán se queda en la
  lista como **ANULADO** (fila apagada y tachada, con motivo, quién y cuándo), sale de los
  totales, no se ofrece al facturar y el material que descontó vuelve al almacén.
- Columnas nuevas en `albaranes`: `anulado`, `anulado_at`, `anulado_por`, `motivo_anulacion` (también
  en `v_albaranes`, al final). Función nueva `anular_albaran(p_usuario, p_albaran, p_motivo)`: exige
  `puede_borrar` y no anula uno facturado.
- Un trigger (`trg_albaran_anulado_no_facturar`) impide facturar o reactivar un albarán anulado.
- Se ha quitado al panel (rol `authenticated`) el permiso de ejecutar `borrar_albaran`: ya no se
  puede borrar desde el panel, aunque quede algún botón antiguo en caché.
- En n8n, el nodo «Buscador albaranes» hace que la capa de filtros trate estos albaranes como
  anulados (la capa ya sabía mostrar los cancelados desde el planning).

**Importante:** los cambios del flujo de n8n se guardan como borrador y **hay que publicarlos** para
que el panel los sirva. El buscador del punto 2 no estuvo activo hasta que se publicó junto con esto.

## Cómo deshacer

- Panel: restaurar la versión anterior desde `app_ui_versiones` (se guarda sola en cada cambio).
- n8n: quitar el nodo «Buscador albaranes» y volver a unir «Construir panel» con «Responder HTML».
- Base de datos: lo añadido no cambia nada de lo que había (`conceptos_detalle`,
  `guardar_conceptos_detalle`, `guardar_desglose_factura`, `crear_factura_venta`,
  `v_movimientos_facturas`); puede quedarse aunque se vuelva atrás el panel.

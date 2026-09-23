# -*- coding: utf-8 -*-
"""Documento para Transportes Araya: los tres presupuestos juntos, linea por linea,
con lo que ya esta entregado y lo que queda por montar.
Paleta tomada de la ficha de marca de Araya (mostaza, azul marino, gris concreto, tinta)."""
import subprocess, os

SAL = '/home/user/TRANSPORTES-ARAYA/auditoria'
TMP = '/tmp/claude-0'
HOY = '23/09/2026'
CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'

CSS = """
@page { size:A4; margin:15mm 13mm 14mm; }
*{box-sizing:border-box}
body{font-family:"Liberation Sans",Arial,Helvetica,sans-serif;color:#101223;font-size:9.6pt;
     margin:0;line-height:1.45}
.port{border-left:6px solid #E4B33C;padding:0 0 0 12px;margin-bottom:16px}
h1{font-size:23pt;line-height:1.05;margin:0 0 4px;color:#00005D;font-weight:900;letter-spacing:-.4px}
.sub{color:#00005D;font-size:10.5pt;font-weight:bold;margin-bottom:2px}
.sub2{color:#5a5f6e;font-size:9pt}
h2{font-size:13pt;margin:20px 0 7px;color:#00005D;font-weight:900;
   border-bottom:2.5px solid #E4B33C;padding-bottom:4px;page-break-after:avoid}
h3{font-size:10.5pt;margin:13px 0 4px;color:#00005D;page-break-after:avoid}
table{width:100%;border-collapse:collapse;margin:6px 0;page-break-inside:avoid}
th{background:#00005D;color:#fff;font-size:8.2pt;text-align:left;padding:5px 6px;
   text-transform:uppercase;letter-spacing:.3px}
td{border-bottom:.6px solid #d6d9e3;padding:5px 6px;vertical-align:top;font-size:9pt}
td.r,th.r{text-align:right;white-space:nowrap}
tr.tot td{background:#00005D;color:#fff;font-weight:bold;border:none}
tr.sec td{background:#EEF0F5;font-weight:bold;color:#00005D}
.est{white-space:nowrap;font-weight:bold;font-size:8.4pt}
.ok{color:#1c6b3a}.mas{color:#00005D}.par{color:#9a6b00}.no{color:#8B0000}.cli{color:#5a5f6e}
.caja{background:#EEF0F5;border-left:4px solid #00005D;padding:9px 12px;margin:10px 0;font-size:9.2pt}
.oro{border-left-color:#E4B33C;background:#FDF7E7}
.rojo{border-left-color:#8B0000;background:#FBECEC}
.verde{border-left-color:#1c6b3a;background:#EFF6EF}
ul{margin:4px 0 4px 16px;padding:0}li{margin-bottom:3px}
.kp{display:flex;gap:8px;margin:12px 0}
.k{flex:1;border:1px solid #d6d9e3;border-top:4px solid #E4B33C;border-radius:4px;padding:8px 10px}
.k .l{font-size:7.2pt;text-transform:uppercase;letter-spacing:.5px;color:#5a5f6e}
.k .v{font-size:17pt;font-weight:900;color:#00005D;line-height:1.15}
.k .s{font-size:7.8pt;color:#5a5f6e}
.pie{margin-top:20px;padding-top:7px;border-top:1px solid #d6d9e3;color:#7a7f8c;font-size:8.2pt}
.nueva{page-break-before:always}
.ley{font-size:8.4pt;color:#5a5f6e;margin:4px 0 10px}
.ley b{color:#101223}
"""

OK  = '<span class="est ok">ENTREGADO</span>'
MAS = '<span class="est mas">ENTREGADO Y AMPLIADO</span>'
PAR = '<span class="est par">PARCIAL</span>'
NO  = '<span class="est no">PENDIENTE</span>'
CLI = '<span class="est cli">ESPERA A ARAYA</span>'

D = """
<div class="port">
  <div class="sub2">INNOVA IA SYSTEMS &nbsp;·&nbsp; DOCUMENTO DE SITUACIÓN &nbsp;·&nbsp; __HOY__</div>
  <h1>Los tres presupuestos,<br>punto por punto</h1>
  <div class="sub">Transportes Araya Franquiz, S.L. &nbsp;·&nbsp; NIF B35773316</div>
  <div class="sub2">Qué está entregado, qué está a medias y qué queda por montar</div>
</div>

<div class="caja">Este documento pone los <b>tres presupuestos</b> uno al lado del otro —
Fase&nbsp;1 (INNOVA-2026-001) y Fases&nbsp;2 y&nbsp;3 (ARAYA-F23-20260916)— y va línea por
línea diciendo en qué estado está cada cosa que se presupuestó. Las cifras no son estimaciones:
están contadas de la base de datos del panel el __HOY__.</div>

<div class="kp">
  <div class="k"><div class="l">Documentos en el panel</div><div class="v">19.286</div>
    <div class="s">facturas de venta y de compra desde 2003</div></div>
  <div class="k"><div class="l">Automatismos en marcha</div><div class="v">18</div>
    <div class="s">funcionando solos, sin que nadie los lance</div></div>
  <div class="k"><div class="l">Pantallas del panel</div><div class="v">29</div>
    <div class="s">de Inicio a Contabilidad</div></div>
</div>

<h2>1. Lo que se ha presupuestado</h2>
<table>
<tr><th>Presupuesto</th><th>Concepto</th><th class="r">Base</th><th class="r">IGIC 7%</th><th class="r">Total</th></tr>
<tr><td>INNOVA-2026-001</td><td>Fase 1 · Arranque y operativa de compras</td><td class="r">1.500,00 €</td><td class="r">105,00 €</td><td class="r">1.605,00 €</td></tr>
<tr><td>ARAYA-F23-20260916</td><td>Fase 2 · Integración y operativa</td><td class="r">2.200,00 €</td><td class="r">154,00 €</td><td class="r">2.354,00 €</td></tr>
<tr><td>ARAYA-F23-20260916</td><td>Fase 3 · Ventas y control económico</td><td class="r">3.600,00 €</td><td class="r">252,00 €</td><td class="r">3.852,00 €</td></tr>
<tr class="tot"><td colspan="2">Total de las tres fases</td><td class="r">7.300,00 €</td><td class="r">511,00 €</td><td class="r">7.811,00 €</td></tr>
</table>

<h3>Cuota mensual del servicio</h3>
<table>
<tr><th>Etapa</th><th class="r">Base mensual</th><th class="r">IGIC 7%</th><th class="r">Total mensual</th></tr>
<tr><td>Fase 1 (la vigente hoy)</td><td class="r">240,00 €</td><td class="r">16,80 €</td><td class="r">256,80 €</td></tr>
<tr><td>Con fase 2 activada</td><td class="r">320,00 €</td><td class="r">22,40 €</td><td class="r">342,40 €</td></tr>
<tr><td>Con fases 2 y 3 activadas</td><td class="r">420,00 €</td><td class="r">29,40 €</td><td class="r">449,40 €</td></tr>
</table>
<div class="ley">Las cuotas <b>se sustituyen, no se suman</b>. La nueva empieza a contar cuando la
fase está en funcionamiento; hasta entonces sigue la anterior.</div>

<div class="ley">Cómo leer el estado de cada línea en las tablas que siguen:<br>
<span class="est ok">ENTREGADO</span> funcionando en producción &nbsp;·&nbsp;
<span class="est mas">ENTREGADO Y AMPLIADO</span> hecho, y por encima de lo presupuestado &nbsp;·&nbsp;
<span class="est par">PARCIAL</span> hecho a medias &nbsp;·&nbsp;
<span class="est no">PENDIENTE</span> por montar &nbsp;·&nbsp;
<span class="est cli">ESPERA A ARAYA</span> montado o listo, esperando una decisión o un dato de Araya</div>

<h2 class="nueva">2. Fase 1 · Arranque y operativa de compras</h2>
<div class="ley">Presupuesto INNOVA-2026-001, ya aceptado y en funcionamiento.</div>
<table>
<tr><th style="width:31%">Lo presupuestado</th><th>Cómo está hoy</th><th style="width:20%">Estado</th></tr>
<tr><td>Arranque técnico y panel operativo en dominio propio</td>
<td>Panel en <b>araya.innovaiasystems.com</b>, con acceso por usuario y contraseña, 4 usuarios dados de alta y permisos por rol.</td><td>__OK__</td></tr>
<tr><td>Módulo de proveedores y materiales</td>
<td><b>507 proveedores</b> y <b>136 materiales</b> con coste, precio, margen, stock y mínimo. Añadido además el inventario con 291 movimientos.</td><td>__MAS__</td></tr>
<tr><td>Pedidos a proveedor por email</td>
<td>Montado y probado: se indica cantidad, se confirma y sale el correo. <b>Todavía no se ha cursado ningún pedido desde el panel</b>: es una decisión de uso, no de desarrollo.</td><td>__OK__</td></tr>
<tr><td>Registro de pagos con un clic</td>
<td>Funciona, y el pago genera además su asiento contable automáticamente.</td><td>__MAS__</td></tr>
<tr><td>Lectura de facturas por IA</td>
<td><b>246 facturas leídas por foto o PDF.</b> Hoy va más lejos de lo pedido: las que la IA lee al 100% y cuadran pasan solas a contabilidad, con su número de asiento, sin revisión manual.</td><td>__MAS__</td></tr>
<tr><td>Volcado automático a Factusol</td>
<td>Se decidió <b>no escribir facturas en Factusol</b> por seguridad y trazabilidad fiscal: Factusol sigue siendo la fuente de verdad. El panel las contabiliza y las deja preparadas para su traspaso. Lo que sí se sincroniza en los dos sentidos son las fichas maestras (clientes y artículos).</td><td>__PAR__</td></tr>
</table>
<div class="caja verde">Fase 1 está <b>entregada y desbordada</b>: casi todas sus líneas hacen hoy
más de lo que se presupuestó. El único punto abierto es el volcado a Factusol, y está abierto
por una decisión técnica tomada para proteger la contabilidad de Araya, no por falta de trabajo.</div>

<h2 class="nueva">3. Fase 2 · Integración y operativa</h2>
<div class="ley">Presupuesto ARAYA-F23-20260916 &nbsp;·&nbsp; 2.200,00 € + IGIC.</div>
<table>
<tr><th style="width:31%">Lo presupuestado</th><th>Cómo está hoy</th><th style="width:20%">Estado</th></tr>
<tr><td><b>FactuSol.</b> Integración, revisión de flujos, pruebas de sincronización y control de errores y duplicados</td>
<td>Conectado y funcionando: <b>11.508 facturas de venta desde 2003</b>, 7.815 de compra, 24.802 cobros, 1.209 clientes y 621 artículos. Con registro de errores, control de duplicados y aislamiento de fallos, para que una factura mala no pare la importación de las demás.</td><td>__MAS__</td></tr>
<tr><td><b>Lectura de facturas.</b> Carga de imagen o PDF, extracción de datos y confirmación del usuario antes del registro</td>
<td>Hecho y superado: escáner universal que reconoce solo qué documento es (factura emitida, recibida, albarán, nómina), lectura por lotes, aviso de duplicados y paso automático a contabilidad de las que vienen perfectas.</td><td>__MAS__</td></tr>
<tr><td><b>WhatsApp y reposición.</b> Un número de empresa, hasta seis plantillas, envío de rutas y resumen diario de materiales bajo mínimo</td>
<td>No se ha montado. <b>Hace falta que Araya facilite un número de empresa</b> para darlo de alta; hasta entonces no se puede conectar.</td><td>__CLI__</td></tr>
<tr><td><b>Cubetas.</b> Asignación de cubeta a cliente y obra, estados, fechas y avisos por días fuera</td>
<td>Por montar. Es uno de los dos bloques grandes que quedan de esta fase.</td><td>__NO__</td></tr>
<tr><td><b>Rutas.</b> Planificación manual de paradas por conductor, envío de la hoja de ruta y estado del servicio</td>
<td>Por montar. La base ya existe: el albarán admite varias paradas, recogidas y traslados en un mismo viaje.</td><td>__NO__</td></tr>
<tr><td><b>Puesta en marcha.</b> Hasta 25 usuarios, 15 conductores, 150 cubetas, carga inicial de hasta 500 registros y dos horas de formación</td>
<td>La carga inicial se ha superado con mucho: <b>19.286 documentos</b> cargados frente a los 500 presupuestados. Quedan las horas de formación y el alta de conductores y cubetas.</td><td>__PAR__</td></tr>
</table>

<h2 class="nueva">4. Fase 3 · Ventas y control económico</h2>
<div class="ley">Presupuesto ARAYA-F23-20260916 &nbsp;·&nbsp; 3.600,00 € + IGIC.</div>
<table>
<tr><th style="width:31%">Lo presupuestado</th><th>Cómo está hoy</th><th style="width:20%">Estado</th></tr>
<tr><td><b>Clientes.</b> Ficha e historial</td>
<td><b>1.255 clientes</b> con su histórico, vencimientos, forma de pago, notas y avisos.</td><td>__OK__</td></tr>
<tr><td><b>Presupuestos.</b> Creación, estados y conversión en albarán tras la aprobación</td>
<td>Por montar. La pantalla está en el menú marcada como próxima; las tablas están creadas y vacías.</td><td>__NO__</td></tr>
<tr><td><b>Albaranes.</b> Una plantilla PDF con los datos del transporte, QR de consulta y envío al repartidor</td>
<td>Hecho y muy por encima: el <b>DeCA</b> cumple la Orden FOM/2861/2012, lleva QR verificable, <b>firma táctil del cliente y del conductor</b>, admite varias paradas por viaje y se copia cada lunes a Google Drive para garantizar la conservación de un año que exige el reglamento.</td><td>__MAS__</td></tr>
<tr><td><b>Facturación.</b> Llevar el albarán validado a FactuSol y consultar allí número y estado</td>
<td>Hecho y superado: el panel <b>emite la factura completa</b> —agrupa albaranes, numeración legal correlativa, IGIC por línea, rectificativas y PDF con la marca de Araya, ya preparado para el QR de VeriFactu— y la cuadra contra Factusol.</td><td>__MAS__</td></tr>
<tr><td><b>Cobros y conciliación asistida.</b> Cobros totales y parciales, importación de un CSV/XLSX de una cuenta, sugerencias y confirmación humana, con control de duplicados</td>
<td>Hecho y superado: <b>7.772 cobros</b>, <b>3 cuentas bancarias</b> en vez de una, formato Norma 43 además de CSV, conciliación por puntuación con confirmación humana, y desde esta semana <b>el justificante del banco es obligatorio</b> para dar un movimiento por conciliado, con el documento guardado y consultable.</td><td>__MAS__</td></tr>
<tr><td><b>Informes.</b> Resumen de ventas, cobros y vencimientos</td>
<td>Hechos, y ampliados con cuadre de cobros, cartera antigua, albaranes facturados y pendientes de cobro por cliente.</td><td>__MAS__</td></tr>
<tr><td><b>Asesoría.</b> Una exportación mensual en el formato acordado</td>
<td>El paquete mensual está <b>construido</b> (libro de emitidas, libro de recibidas, resumen de IGIC y hoja de cuadre, en CSV, con envío por correo) pero <b>sin activar</b>: falta acordar con la asesoría el formato exacto que importa A3 ECO.</td><td>__CLI__</td></tr>
<tr><td><b>Tres horas de formación</b></td><td>Pendientes de dar.</td><td>__NO__</td></tr>
</table>

<h2 class="nueva">5. Lo entregado que no estaba en ningún presupuesto</h2>
<div class="caja oro">El presupuesto de fases 2 y 3 dice, en el apartado de límites, que <b>quedan
fuera</b> de esas fases: «flota e ITV, repostajes, préstamos, factoring, compensaciones, gestión
de personal, cálculo de nóminas, contabilidad e impuestos», y tampoco incluye «migración
histórica masiva» ni «certificación normativa del documento de transporte».<br><br>
<b>Las nueve cosas de esa lista están construidas y funcionando</b>, la migración histórica se
ha hecho entera desde 2003, y el documento de transporte está montado con firma y QR.</div>
<table>
<tr><th style="width:34%">Bloque</th><th>Qué hace y con qué volumen</th></tr>
<tr><td><b>Contabilidad automática</b></td><td>Cada factura, pago y cobro genera su asiento solo. <b>2.081 asientos</b> y 5.035 apuntes, con corte contable fijado el 01/09/2026.</td></tr>
<tr><td><b>Flota, ITV y seguros</b></td><td><b>95 vehículos</b> (64 activos), con aviso de ITV caducada y de póliza por vencer. Se prepararon además los escritos a Tuineje y Pájara para la baja del impuesto de circulación de los vehículos vendidos.</td></tr>
<tr><td><b>Repostajes</b></td><td>Consumo por vehículo, con el precio oficial del gasoil en Fuerteventura traído cada mañana del portal del Ministerio.</td></tr>
<tr><td><b>Préstamos</b></td><td><b>16 préstamos</b> con sus 327 cuotas y su contabilización.</td></tr>
<tr><td><b>Factoring y confirming</b></td><td>Contabiliza las liquidaciones sin recurso de BBVA, Santander y Caja Siete (intereses, comisión, IGIC y líquido), probado con liquidaciones reales.</td></tr>
<tr><td><b>Personal y nóminas</b></td><td><b>24 empleados</b> y sus nóminas, leídas por escáner sin teclear, con IRPF y seguridad social.</td></tr>
<tr><td><b>Reclamación de impagados</b></td><td><b>25 expedientes</b> con sus actuaciones, aviso de cobro por correo, expediente imprimible, cálculo de interés de demora comercial y paso manual a incobrables.</td></tr>
<tr><td><b>Auditoría de la cartera 2021–2025</b></td><td>Se cruzaron dos fuentes distintas de Factusol que no coincidían y se recuperaron <b>57 facturas de años anteriores por 44.555,66 €</b> que no aparecían como pendientes, con análisis de prescripción civil de cada una.</td></tr>
<tr><td><b>Migración histórica completa</b></td><td><b>11.508 facturas de venta desde 2003</b> con sus 35.178 líneas, 7.778 de compra, 7.772 cobros y 652 servicios del catálogo.</td></tr>
<tr><td><b>Corrección contable relevante</b></td><td>Se detectó un préstamo de CaixaBank contabilizado como gasto, que inflaba el resultado del ejercicio en <b>131.767,03 €</b>. Trasladado a la asesoría.</td></tr>
</table>

<h2>6. Lo que queda por montar</h2>
<h3>Trabajo de Innova</h3>
<table>
<tr><th style="width:26%">Qué falta</th><th>De qué fase</th><th style="width:34%">Qué hace falta para hacerlo</th></tr>
<tr><td>Control de cubetas</td><td>Fase 2</td><td>Nada: se puede empezar cuando Araya lo active.</td></tr>
<tr><td>Planificación de rutas</td><td>Fase 2</td><td>Nada: la base del albarán con varias paradas ya está hecha.</td></tr>
<tr><td>Presupuestos a cliente</td><td>Fase 3</td><td>Nada: pantalla y tablas ya preparadas.</td></tr>
<tr><td>Resumen diario de reposición</td><td>Fase 2</td><td>Va con WhatsApp o por correo; por correo se puede hacer ya.</td></tr>
<tr><td>Horas de formación (2 de fase 2 + 3 de fase 3)</td><td>Fases 2 y 3</td><td>Fijar fecha con Jennifer.</td></tr>
</table>
<h3>Esperando una decisión o un dato de Araya</h3>
<table>
<tr><th style="width:26%">Qué falta</th><th>Qué hace falta</th></tr>
<tr><td><b>WhatsApp</b></td><td>Un número de empresa dedicado. Sin él no se pueden enviar rutas, pedidos ni avisos por WhatsApp.</td></tr>
<tr><td><b>Exportación a la asesoría</b></td><td>Que la asesoría diga en qué formato exacto importa A3 ECO. El paquete ya está construido.</td></tr>
<tr><td><b>Correo del factoring</b></td><td>Crear el buzón desde el que llegan las liquidaciones, para que entren solas.</td></tr>
<tr><td><b>Emails de proveedores</b></td><td>Faltan correos de contacto para poder cursar pedidos a todos los proveedores.</td></tr>
<tr><td><b>CIF de proveedores</b></td><td><b>208 de 507 proveedores no tienen CIF.</b> Sin él no se pueden contrastar las facturas de compra una a una contra Factusol, solo por totales de mes.</td></tr>
<tr><td><b>VeriFactu</b></td><td>Decidir el certificado electrónico, quién emitirá las facturas desde enero y con qué datos fiscales.</td></tr>
<tr><td><b>Prueba del DeCA en la calle</b></td><td>Que un conductor lo firme desde el móvil en un servicio real antes del 5 de octubre.</td></tr>
</table>

<h2 class="nueva">7. Fechas que no se pueden mover</h2>
<table>
<tr><th style="width:18%">Fecha</th><th>Qué pasa</th><th style="width:24%">Cómo estamos</th></tr>
<tr><td><b>5 de octubre de 2026</b></td><td>El documento de control de transporte pasa a ser obligatorio en formato electrónico (Orden FOM/2861/2012).</td><td>Construido con QR y firma. <b>Falta probarlo en un servicio real desde el móvil.</b></td></tr>
<tr><td><b>28 de octubre de 2026</b></td><td>Prescribe la factura de Fuertealisios (185,40 €). Todavía se puede interrumpir el plazo con un burofax.</td><td>Identificada en el panel. Falta decidir si se reclama.</td></tr>
<tr><td><b>1 de enero de 2027</b></td><td>VeriFactu pasa a ser obligatorio.</td><td>El PDF de factura ya está preparado para el QR. <b>Falta que Araya tome las decisiones fiscales.</b></td></tr>
</table>
<div class="caja rojo">La factura de UTE Pájara (269,85 €) cumplió los cinco años el
<b>13 de septiembre de 2026</b>. Si no se envió burofax antes de esa fecha, previsiblemente ya
no es reclamable.</div>

<h2>8. Resumen</h2>
<table>
<tr><th>Fase</th><th class="r">Importe</th><th>Situación</th></tr>
<tr><td><b>Fase 1</b> · Arranque y compras</td><td class="r">1.500,00 €</td><td>Entregada, y casi todas sus líneas hacen hoy más de lo presupuestado.</td></tr>
<tr><td><b>Fase 2</b> · Integración y operativa</td><td class="r">2.200,00 €</td><td>Lo difícil —Factusol y la lectura de facturas— está hecho y ampliado. Faltan cubetas, rutas y WhatsApp.</td></tr>
<tr><td><b>Fase 3</b> · Ventas y control económico</td><td class="r">3.600,00 €</td><td>Facturación, cobros, conciliación, albaranes e informes están hechos y ampliados. Falta presupuestos y cerrar el formato de la asesoría.</td></tr>
</table>

<div class="caja">Dicho en corto: <b>de las tres fases contratadas, lo que más trabajo llevaba
ya está funcionando con datos reales de Araya</b>, y además está construido todo un bloque —
contabilidad, flota, préstamos, nóminas, factoring, reclamaciones— que los presupuestos dejaban
expresamente fuera. Lo que queda son tres módulos de operativa diaria (cubetas, rutas y
presupuestos), la formación, y siete puntos que dependen de un dato o una decisión de Araya.</div>

<div class="pie">Innova IA Systems &nbsp;·&nbsp; info@innovaiasystems.com &nbsp;·&nbsp;
637 734 869 &nbsp;·&nbsp; innovaiasystems.com<br>
Documento de situación a __HOY__ para Transportes Araya Franquiz, S.L. Las cifras están contadas
directamente de la base de datos del panel.</div>
"""

D = (D.replace('__OK__', OK).replace('__MAS__', MAS).replace('__PAR__', PAR)
      .replace('__NO__', NO).replace('__CLI__', CLI).replace('__HOY__', HOY))

nombre = '03_los_tres_presupuestos_araya'
rh = os.path.join(TMP, nombre + '.html')
rp = os.path.join(SAL, nombre + '.pdf')
open(rh, 'w', encoding='utf-8').write(
    '<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Los tres presupuestos</title>'
    '<style>' + CSS + '</style></head><body>' + D + '</body></html>')
subprocess.run([CHROME, '--headless', '--disable-gpu', '--no-sandbox',
                '--no-pdf-header-footer', '--print-to-pdf=' + rp, 'file://' + rh],
               check=True, capture_output=True)
print(nombre + '.pdf', os.path.getsize(rp), 'bytes')

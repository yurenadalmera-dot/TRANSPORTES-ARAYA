# -*- coding: utf-8 -*-
"""Genera los dos documentos de la auditoria del 23/09/2026."""
import subprocess, os, sys

SAL = '/home/user/TRANSPORTES-ARAYA/auditoria'
SP  = sys.argv[1] if len(sys.argv) > 1 else SAL
HOY = '23/09/2026'
CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'

CSS = """
@page { size: A4; margin: 15mm 14mm 16mm; }
* { box-sizing: border-box; }
body { font-family: Arial, Helvetica, sans-serif; color:#1a1a1a; font-size:10pt; margin:0; line-height:1.5; }
h1 { font-size:20pt; margin:0 0 2px; color:#1F3864; }
h2 { font-size:13pt; margin:22px 0 8px; color:#1F3864; padding-bottom:4px;
     border-bottom:2px solid #1F3864; page-break-after:avoid; }
h3 { font-size:11pt; margin:14px 0 5px; color:#2a2a2a; page-break-after:avoid; }
.sub { color:#5a5a5a; font-size:10pt; }
.tag { display:inline-block; background:#1F3864; color:#fff; font-size:8pt; padding:2px 8px;
       border-radius:3px; letter-spacing:.5px; text-transform:uppercase; }
table { width:100%; border-collapse:collapse; margin:8px 0 4px; page-break-inside:avoid; }
th { background:#1F3864; color:#fff; font-size:8.5pt; text-align:left; padding:6px 7px; border:1px solid #1F3864; }
td { border:1px solid #cfcfcf; padding:5px 7px; vertical-align:top; font-size:9.3pt; }
td.r, th.r { text-align:right; white-space:nowrap; }
tr.tot td { background:#1F3864; color:#fff; font-weight:bold; }
tr.sub td { background:#DDEBF7; font-weight:bold; }
.caja { border-left:3px solid #1F3864; background:#f4f6fb; padding:9px 12px; margin:10px 0; font-size:9.5pt; }
.rojo { border-left-color:#8B0000; background:#FBE9E9; }
.verde { border-left-color:#2a6b2a; background:#EFF6EF; }
ul { margin:5px 0 5px 17px; padding:0; }
li { margin-bottom:4px; }
.kp { display:flex; gap:9px; margin:12px 0; }
.k { border:1px solid #c9c9c9; border-radius:5px; padding:8px 11px; flex:1; }
.k .l { font-size:7.5pt; text-transform:uppercase; letter-spacing:.5px; color:#6a6a6a; }
.k .v { font-size:16pt; font-weight:bold; color:#1F3864; line-height:1.2; }
.k .s { font-size:8pt; color:#6a6a6a; }
.pie { margin-top:22px; padding-top:8px; border-top:1px solid #cfcfcf; color:#7a7a7a; font-size:8.5pt; }
.ok { color:#2a6b2a; font-weight:bold; }
.no { color:#8B0000; font-weight:bold; }
.nueva { page-break-before:always; }
"""

def pdf(nombre, html):
    rh = os.path.join(SP, nombre + '.html')
    rp = os.path.join(SAL, nombre + '.pdf')
    open(rh, 'w', encoding='utf-8').write(
        '<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>' + nombre +
        '</title><style>' + CSS + '</style></head><body>' + html + '</body></html>')
    subprocess.run([CHROME, '--headless', '--disable-gpu', '--no-sandbox',
                    '--no-pdf-header-footer', '--print-to-pdf=' + rp, 'file://' + rh],
                   check=True, capture_output=True)
    print(nombre + '.pdf', os.path.getsize(rp), 'bytes')

# ===================================================================== DOC 1
d1 = """
<span class="tag">Estado del sistema</span>
<h1>Panel de gestión Atenea</h1>
<div class="sub">Transportes Araya Franquiz, S.L. &nbsp;·&nbsp; Situación a __HOY__</div>

<div class="kp">
  <div class="k"><div class="l">Pantallas en marcha</div><div class="v">26</div>
    <div class="s">de Inicio a Contabilidad</div></div>
  <div class="k"><div class="l">Automatismos</div><div class="v">20</div>
    <div class="s">funcionando sin intervención</div></div>
  <div class="k"><div class="l">Documentos gestionados</div><div class="v">19.285</div>
    <div class="s">facturas de venta y de compra</div></div>
</div>

<div class="caja">Este documento recoge <b>qué hace hoy la aplicación</b> y <b>qué queda por
montar</b>. Las cifras no son estimaciones: están contadas directamente de la base de datos
el __HOY__.</div>

<h2>1. Lo que ya está funcionando</h2>

<h3>Ventas y cobros</h3>
<table>
<tr><th>Qué hace</th><th class="r">Volumen real</th></tr>
<tr><td>Facturación a clientes, con series, IGIC por línea y rectificativas</td><td class="r">11.507 facturas</td></tr>
<tr><td>Ficha de cliente con su histórico, vencimientos y forma de pago</td><td class="r">1.255 clientes</td></tr>
<tr><td>Cobros, incluidos los parciales y los cobros a cuenta</td><td class="r">7.768 cobros</td></tr>
<tr><td>Informe de pendientes de cobro, por cliente y por antigüedad</td><td class="r">88 facturas vivas</td></tr>
<tr><td>Avisos de cobro por correo, agrupados por cliente</td><td class="r">49 enviados</td></tr>
<tr><td>Reclamaciones: expedientes, seguimiento, burofax y juzgado</td><td class="r">25 expedientes</td></tr>
<tr><td>Cartera antigua: lo dado por incobrable, separado del pendiente</td><td class="r">130 facturas</td></tr>
<tr><td>Factoring y confirming, con su liquidación y justificante</td><td class="r">en uso</td></tr>
</table>

<h3>Compras y proveedores</h3>
<table>
<tr><th>Qué hace</th><th class="r">Volumen real</th></tr>
<tr><td>Facturas de proveedor con vencimientos y forma de pago</td><td class="r">7.778 facturas</td></tr>
<tr><td>Fichas de proveedor y acreedor, con categoría</td><td class="r">507 proveedores</td></tr>
<tr><td>Albaranes de proveedor y materiales con stock</td><td class="r">136 materiales</td></tr>
<tr><td>Inventario y rentabilidad por material</td><td class="r">en uso</td></tr>
</table>

<h3>Escáner y lectura automática</h3>
<table>
<tr><th>Qué hace</th><th class="r">Volumen real</th></tr>
<tr><td>Escaneo por foto o PDF, varias facturas de golpe</td><td class="r">246 facturas</td></tr>
<tr><td>Reconoce solo qué es cada documento y lo manda a su bandeja</td><td class="r">funcionando</td></tr>
<tr><td>Lee proveedor, número, fechas, base, IGIC y total</td><td class="r">375 documentos</td></tr>
<tr><td>Las que vienen al 100% pasan solas a contabilidad, con su asiento</td><td class="r">automático</td></tr>
<tr><td>Bandeja de entrada por correo: lee los PDF que llegan al buzón</td><td class="r">funcionando</td></tr>
</table>

<h3>Tesorería y banco</h3>
<table>
<tr><th>Qué hace</th><th class="r">Volumen real</th></tr>
<tr><td>Importación del extracto bancario en Norma 43 y CSV</td><td class="r">256 movimientos</td></tr>
<tr><td>Conciliación con reparto: un ingreso contra varias facturas</td><td class="r">86 conciliados</td></tr>
<tr><td>Justificante del banco guardado con cada movimiento</td><td class="r">nuevo</td></tr>
<tr><td>Compensaciones entre cliente y proveedor</td><td class="r">en uso</td></tr>
<tr><td>Préstamos con su cuadro de amortización</td><td class="r">en uso</td></tr>
</table>

<h3>Tráfico y flota</h3>
<table>
<tr><th>Qué hace</th><th class="r">Volumen real</th></tr>
<tr><td>Albaranes de servicio, con cliente, obra y paradas del viaje</td><td class="r">en uso</td></tr>
<tr><td>DeCA: documento de control ambiental, con firma de cliente y conductor</td><td class="r">13 emitidos</td></tr>
<tr><td>Copia de seguridad semanal de los DeCA a Google Drive</td><td class="r">automático</td></tr>
<tr><td>Flota, ITV, tacógrafo y vencimientos de carnet</td><td class="r">95 vehículos</td></tr>
<tr><td>Repostajes por vehículo y precio del gasoil de la isla, cada día</td><td class="r">automático</td></tr>
</table>

<h3>Personal y contabilidad</h3>
<table>
<tr><th>Qué hace</th><th class="r">Volumen real</th></tr>
<tr><td>Plantilla con carnets, CAP, ADR y reconocimientos médicos</td><td class="r">24 empleados</td></tr>
<tr><td>Nóminas leídas del PDF mensual, una por página, sin IA</td><td class="r">24 nóminas</td></tr>
<tr><td>Contabilidad: asientos y apuntes generados solos</td><td class="r">2.077 asientos</td></tr>
<tr><td>IGIC e impuestos, modelo 111 y estimación de sociedades</td><td class="r">en uso</td></tr>
<tr><td>Informe mensual para la asesoría, en CSV y por correo</td><td class="r">montado</td></tr>
<tr><td>Espejo de Factusol: facturas, líneas y cobros desde 2003</td><td class="r">en marcha</td></tr>
</table>

<h2>2. Lo que queda por montar o por decidir</h2>

<div class="caja rojo"><b>Urgente.</b> La importación horaria de facturas desde Factusol
<b>lleva caída desde el 17 de septiembre</b>. Se atasca siempre en el mismo punto: Factusol
insiste en aplicar un cobro de 8.500,00 € a la factura 260323 de MAXODIVER, que en el panel
ya está pagada entera por el banco. Como todo el lote va en una sola operación, un fallo
tumba la importación completa y no entra ninguna factura. <b>La última factura que llegó de
Factusol es la 260464, del 14 de septiembre.</b></div>

<h3>Por montar</h3>
<table>
<tr><th>Qué falta</th><th>Por qué importa</th></tr>
<tr><td>Que la importación de Factusol no muera por una factura mala</td>
    <td>Hoy un solo error corta la entrada de todas. Debe saltarse la mala y dejarla anotada</td></tr>
<tr><td>Registro de auditoría de cambios de estado en facturas</td>
    <td>Hoy no hay forma de saber quién pasó una factura a cobrada ni cuándo</td></tr>
<tr><td>Justificante en los 86 movimientos ya conciliados</td>
    <td>Se conciliaron antes de que existiera el sitio donde guardarlo</td></tr>
<tr><td>Correo de 10 clientes con deuda viva</td>
    <td>Sin correo no se les puede mandar el aviso de cobro: 7.577,43 € que no se reclaman solos</td></tr>
</table>

<h3>Por decidir</h3>
<table>
<tr><th>Asunto</th><th class="r">Importe</th><th>Situación</th></tr>
<tr><td>15 facturas con más cobrado que su total</td><td class="r">8.342,78 €</td>
    <td>Listado entregado. Falta mirar en Factusol de qué factura era ese dinero</td></tr>
<tr><td>23 facturas vencidas hace más de un año</td><td class="r">19.660,98 €</td>
    <td>Siguen en el informe sin expediente: o reclamación o incobrable</td></tr>
<tr><td>Abono de GRUPO SUPERIOR DE FORMACIÓN</td><td class="r">3.876,00 €</td>
    <td>El abono no existe ni en el panel ni en Factusol. Hay que darlo de alta</td></tr>
<tr><td>Dos albaranes de ALDIANA sin facturar</td><td class="r">100,00 €</td>
    <td>Uno de ellos está a 0,00 €: o le falta el precio o hay que anularlo</td></tr>
</table>

<h2>3. Cómo está la casa hoy</h2>
<table>
<tr><th>Indicador</th><th class="r">Hoy</th></tr>
<tr><td>Pendiente de cobro</td><td class="r">88 facturas · 177.018,86 €</td></tr>
<tr><td>De ello, ya vencido</td><td class="r">61 facturas</td></tr>
<tr><td>En reclamación</td><td class="r">22 expedientes · 91.626,44 €</td></tr>
<tr><td>Cartera antigua (incobrables)</td><td class="r">130 facturas · 473.762,79 €</td></tr>
<tr><td>Descuadres entre la ficha y sus cobros</td><td class="r"><span class="ok">0</span></td></tr>
<tr><td>Movimientos del banco sin conciliar</td><td class="r">161 de 247</td></tr>
</table>

<div class="pie">Documento generado desde la propia base de datos del panel el __HOY__.
Las cifras son las que el sistema tiene en ese momento, no estimaciones.</div>
"""

# ===================================================================== DOC 2
d2 = """
<span class="tag">Interno · no entregar al cliente</span>
<h1>Qué cuesta mantener el panel de Araya</h1>
<div class="sub">Innova IA Systems &nbsp;·&nbsp; Coste real de infraestructura a __HOY__</div>

<div class="caja">Esto es lo que se paga <b>cada mes</b> por tener el sistema en pie, con los
precios reales de las suscripciones, no con precios de catálogo. Sirve para saber si la cuota
mensual que se cobra cubre el gasto y deja margen por las horas.</div>

<h2>1. Lo que se paga, con factura</h2>
<table>
<tr><th>Concepto</th><th>Qué es</th><th class="r">Como se paga</th><th class="r">Al mes</th></tr>
<tr><td><b>Supabase Pro</b></td><td>Base de datos, usuarios, ficheros y copias</td>
    <td class="r">25 $ / mes</td><td class="r">23,15 €</td></tr>
<tr><td><b>VPS Hostinger KVM 2</b></td><td>Servidor donde corre n8n y los automatismos</td>
    <td class="r">203,88 € / año</td><td class="r">16,99 €</td></tr>
<tr><td><b>OpenAI (GPT-4o)</b></td><td>Lectura de facturas, albaranes y clasificación</td>
    <td class="r">por consumo</td><td class="r">~10 €</td></tr>
<tr class="tot"><td colspan="3">TOTAL SI SE CARGA TODO A ARAYA</td><td class="r">50,14 €</td></tr>
</table>

<div class="caja"><b>El VPS no es sólo de Araya.</b> En ese mismo servidor corren también
airesmajoreros.pro e innovaiasystems.com. Si se reparte entre los tres, a Araya le tocan
<b>5,66 €</b> en vez de 16,99 €, y el total mensual baja a <b>38,81 €</b>.</div>

<h2>2. La parte variable: la IA</h2>
<div class="caja"><b>Este número es una estimación, no un dato.</b> No puedo leer la cuenta de
OpenAI desde aquí, así que lo calculo por el volumen real de documentos y el precio publicado
de GPT-4o. Conviene contrastarlo con la factura real de OpenAI del mes.</div>
<table>
<tr><th>Concepto</th><th class="r">Volumen de septiembre</th><th class="r">Coste unitario</th><th class="r">Mes</th></tr>
<tr><td>Reconocer qué es cada documento</td><td class="r">375 documentos</td><td class="r">~0,004 $</td><td class="r">~1,50 $</td></tr>
<tr><td>Leer los datos de cada página</td><td class="r">~500 páginas</td><td class="r">~0,018 $</td><td class="r">~9,00 $</td></tr>
<tr class="tot"><td colspan="3">ESTIMADO AL VOLUMEN ACTUAL</td><td class="r">~10,50 $ (9,70 €)</td></tr>
</table>
<p style="font-size:9.3pt">Si el escaneo se dispara a <b>1.000 documentos al mes</b>, esta
partida sube a unos <b>27 €</b>. Es la única que crece con el uso: todo lo demás es plano.</p>

<h2>3. Lo que NO es gasto suyo</h2>
<table>
<tr><th>Concepto</th><th>Quién lo paga</th></tr>
<tr><td>Correo administracion@transportesarayafranquiz.es</td><td>Araya, en su propio proveedor</td></tr>
<tr><td>Licencia de Factusol</td><td>Araya</td></tr>
<tr><td>Dominio transportesarayafranquiz.es</td><td>Araya (no está en la cuenta de Hostinger)</td></tr>
</table>
<p style="font-size:9.3pt">En la cuenta de Hostinger hay además Horizons Explorer (9,99 €/mes),
Reach 100, el dominio .COM y el .PRO, y un hosting web que no se renueva. <b>Nada de eso es
de Araya</b> y no debe entrar en su cuota.</p>

<h2>4. Margen: cuánto queda para las horas</h2>
<div class="caja">El gasto de máquinas es pequeño. Lo que de verdad tiene que cubrir la cuota
es <b>el tiempo</b>. Con el coste de infraestructura en <b>39 € al mes</b> (repartiendo el
VPS), esto es lo que queda libre según lo que se cobre:</div>
<table>
<tr><th class="r">Cuota mensual</th><th class="r">Infraestructura</th><th class="r">Queda para horas</th><th>Equivale a</th></tr>
<tr><td class="r">150 €</td><td class="r">39 €</td><td class="r">111 €</td><td>unas 2,2 h/mes a 50 €/h</td></tr>
<tr><td class="r">250 €</td><td class="r">39 €</td><td class="r">211 €</td><td>unas 4,2 h/mes a 50 €/h</td></tr>
<tr><td class="r">350 €</td><td class="r">39 €</td><td class="r">311 €</td><td>unas 6,2 h/mes a 50 €/h</td></tr>
<tr><td class="r">500 €</td><td class="r">39 €</td><td class="r">461 €</td><td>unas 9,2 h/mes a 50 €/h</td></tr>
</table>

<div class="caja rojo"><b>El aviso importante.</b> Sólo en los tres últimos días se han hecho
38 cambios documentados en el sistema: arreglos, informes nuevos, dos módulos de panel y dos
automatismos. Eso <b>no son 2 horas al mes</b>. Si el mantenimiento va a seguir a este ritmo,
la cuota tiene que mirarse contra las horas de verdad, no contra el gasto de máquinas, que es
calderilla al lado.</div>

<h2>5. Margen de crecimiento sin pagar más</h2>
<table>
<tr><th>Recurso</th><th class="r">En uso</th><th class="r">Incluido en el plan</th><th class="r">Margen</th></tr>
<tr><td>Base de datos</td><td class="r">171 MB</td><td class="r">8 GB</td><td class="r">98 %</td></tr>
<tr><td>Ficheros guardados</td><td class="r">246 MB</td><td class="r">100 GB</td><td class="r">99 %</td></tr>
<tr><td>Facturas en el sistema</td><td class="r">19.285</td><td class="r">sin límite práctico</td><td class="r">—</td></tr>
</table>
<p style="font-size:9.3pt">Traducido: <b>el precio no va a subir por crecer</b>. Con este plan
caben años de facturación. Lo único que hay que vigilar es el consumo de IA.</p>

<div class="pie">Suscripciones leídas de las cuentas reales de Hostinger y Supabase el __HOY__.
El coste de OpenAI es la única cifra estimada del documento.</div>
"""

pdf('01_estado_aplicacion_araya', d1.replace('__HOY__', HOY))
pdf('02_costes_mensuales_interno', d2.replace('__HOY__', HOY))

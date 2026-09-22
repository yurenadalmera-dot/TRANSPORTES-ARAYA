# -*- coding: utf-8 -*-
"""Listado imprimible de las facturas con cobrado de mas que su total."""
import json, html, subprocess, sys, os
from datetime import date

SP = os.path.dirname(os.path.abspath(sys.argv[1])) if len(sys.argv) > 1 else '.'
DATOS = sys.argv[1] if len(sys.argv) > 1 else 'datos_demas.json'
SALIDA = sys.argv[2] if len(sys.argv) > 2 else 'cobrado_de_mas.pdf'
HOY = date(2026, 9, 22)

d = json.load(open(DATOS, encoding='utf-8'))

def eur(v):
    s = '{:,.2f}'.format(abs(v)).replace(',', '@').replace('.', ',').replace('@', '.')
    return ('-' if v < 0 else '') + s + ' €'

def fec(s):
    a, m, dd = s.split('-')
    return '%s/%s/%s' % (dd, m, a)

def es(s):
    return html.escape(str(s))

# agrupar por cliente, manteniendo el orden por importe
orden, grupos = [], {}
for x in sorted(d, key=lambda z: -z['de_mas']):
    k = x['cliente']
    if k not in grupos:
        grupos[k] = []
        orden.append(k)
    grupos[k].append(x)

total = sum(x['de_mas'] for x in d)

def motivo(x):
    """Lo que se puede decir con los datos delante, sin adivinar."""
    cs = x['cobros']
    exacto = [c for c in cs if abs(c['i'] - x['total']) < 0.005]
    antes = [c for c in cs if c['f'] < x['fecha']]
    if antes:
        c = antes[0]
        return ('IMPOSIBLE: el cobro de %s es del %s, anterior a la factura. '
                'Ese dinero pagaba una factura que no esta en el panel.'
                % (eur(c['i']), fec(c['f'])))
    if exacto and len(cs) > 1:
        sobra = [c for c in cs if c not in exacto]
        return ('El cobro de %s paga la factura entera. El otro, de %s, es de otra factura.'
                % (eur(exacto[0]['i']), eur(sobra[0]['i'])))
    if len(cs) == 1:
        return ('Un solo cobro de %s por una factura de %s: pago varias facturas a la vez '
                'y el importador lo colgo entero de esta.' % (eur(cs[0]['i']), eur(x['total'])))
    # varios cobros y ninguno cuadra clavado: se mira cual es el que se pasa
    resto = x['total']
    for c in sorted(cs, key=lambda z: z['f']):
        if c['i'] - resto > 0.005:
            return ('El cobro de %s del %s se pasa en %s: esa parte es de otra factura.'
                    % (eur(c['i']), fec(c['f']), eur(c['i'] - resto)))
        resto -= c['i']
    return 'Los cobros suman mas que el total de la factura.'

filas = []
n = 0
for cli in orden:
    fs = grupos[cli]
    sub = sum(x['de_mas'] for x in fs)
    saldo = fs[0]['saldo_cliente']
    if saldo < 0:
        nota = ('En toda su historia el panel dice que ha pagado %s mas de lo que se le facturo.'
                % eur(-saldo))
        cls = 'malo'
    else:
        nota = ('En toda su historia le sigue quedando por pagar %s: el dinero esta mal '
                'repartido entre sus facturas, pero el total del cliente cuadra.' % eur(saldo))
        cls = 'bueno'
    filas.append('<tr class="gr"><td colspan="7"><b>%s</b> <span class="sm">%s · %s '
                 'en el panel</span></td><td class="r"><b>%s</b></td><td></td></tr>'
                 % (es(cli), es(fs[0]['cif']),
                    ('1 factura suya' if fs[0]['facturas_cliente'] == 1
                     else '%d facturas suyas' % fs[0]['facturas_cliente']), eur(sub)))
    filas.append('<tr class="nota"><td colspan="9"><span class="%s">%s</span></td></tr>' % (cls, es(nota)))
    for x in fs:
        n += 1
        cobros = '<br>'.join('%s &nbsp; %s &nbsp; <span class="sm">%s</span>'
                             % (fec(c['f']), eur(c['i']), es(c['r'])) for c in x['cobros'])
        filas.append(
            '<tr>'
            '<td class="tk">%d</td>'
            '<td class="nu"><b>%s</b></td>'
            '<td class="nu">%s</td>'
            '<td class="r nu">%s</td>'
            '<td class="r nu">%s</td>'
            '<td class="r nu destaca">%s</td>'
            '<td class="cob">%s</td>'
            '<td class="dia">%s</td>'
            '<td class="esc"></td>'
            '</tr>'
            % (n, es(x['numero_factura']), fec(x['fecha']), eur(x['total']),
               eur(x['importe_ficha']), eur(x['de_mas']), cobros, es(motivo(x))))

saldos = sorted({(x['cliente'], x['saldo_cliente']) for x in d}, key=lambda z: z[1])
res = ''.join('<tr><td>%s</td><td class="r nu %s">%s</td><td>%s</td></tr>'
              % (es(c), 'malo' if s < 0 else '', eur(s),
                 'Ha pagado de mas en total' if s < 0 else 'Le queda por pagar: solo esta mal repartido')
              for c, s in saldos)

HTML = u"""<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Cobrado de mas</title>
<style>
@page { size: A4 landscape; margin: 12mm 10mm 14mm; }
* { box-sizing: border-box; }
body { font-family: Arial, Helvetica, sans-serif; color:#1a1a1a; font-size:9.2pt; margin:0; }
h1 { font-size:17pt; margin:0 0 2px; color:#1F3864; }
h2 { font-size:12pt; margin:18px 0 6px; color:#1F3864; page-break-after:avoid; }
.sub { color:#5a5a5a; font-size:9pt; margin-bottom:2px; }
.kpis { display:flex; gap:10px; margin:12px 0 14px; }
.kpi { border:1px solid #c9c9c9; border-radius:5px; padding:8px 12px; flex:1; }
.kpi .l { font-size:7.8pt; text-transform:uppercase; letter-spacing:.5px; color:#6a6a6a; }
.kpi .v { font-size:15pt; font-weight:bold; color:#1F3864; }
.kpi .s { font-size:8pt; color:#6a6a6a; }
.aviso { border-left:3px solid #1F3864; background:#f4f6fb; padding:8px 11px; margin:10px 0 14px; font-size:9pt; }
table { width:100%; border-collapse:collapse; }
th { background:#1F3864; color:#fff; font-size:8.2pt; text-align:left; padding:5px 6px;
     border:1px solid #1F3864; }
td { border:1px solid #cfcfcf; padding:5px 6px; vertical-align:top; }
tr.gr td { background:#DDEBF7; border-top:2px solid #1F3864; font-size:9.6pt; }
tr.nota td { background:#f7f7f7; font-size:8.2pt; padding:3px 6px; border-top:0; }
tr { page-break-inside:avoid; }
.r { text-align:right; }
.nu { white-space:nowrap; font-variant-numeric:tabular-nums; }
.sm { color:#6a6a6a; font-size:7.8pt; }
.tk { width:26px; text-align:center; color:#8a8a8a; font-size:8pt; }
.destaca { font-weight:bold; color:#8B0000; }
.cob { font-size:8.2pt; width:200px; }
.dia { font-size:8.2pt; width:245px; }
.esc { width:120px; background:#FFFDE7; }
.malo { color:#8B0000; font-weight:bold; }
.bueno { color:#2a6b2a; }
.pie { margin-top:10px; color:#7a7a7a; font-size:8pt; }
.tot td { background:#1F3864; color:#fff; font-weight:bold; }
.resumen td { font-size:9pt; }
.nueva { page-break-before:always; }
ul { margin:4px 0 0 16px; padding:0; }
li { margin-bottom:3px; }
</style></head><body>

<h1>Transportes Araya Franquiz</h1>
<div class="sub">Facturas donde la ficha dice cobrado <b>mas</b> que el total de la factura</div>
<div class="sub">Listado a __HOY__ &nbsp;·&nbsp; para repasar y puntear</div>

<div class="kpis">
  <div class="kpi"><div class="l">Cobrado de mas</div><div class="v">__TOTAL__</div>
    <div class="s">__N__ facturas de __NCLI__ clientes</div></div>
  <div class="kpi"><div class="l">Ya resuelto hoy</div><div class="v">8.500,00 €</div>
    <div class="s">MAXODIVER 260323: cobro duplicado, quitado</div></div>
  <div class="kpi"><div class="l">Efecto en la deuda</div><div class="v">Ninguno</div>
    <div class="s">ninguna de estas sale en el informe de pendientes</div></div>
</div>

<div class="aviso"><b>Que es esto.</b> En estas facturas la casilla &laquo;importe cobrado&raquo;
dice mas dinero del que valia la factura, cosa que no puede ser. Los cobros y la casilla si
coinciden entre si, por eso nunca habian salido en el listado de descuadres.
<b>No hacen que nadie deba de mas ni de menos</b> en el informe de pendientes: todas estan
cobradas y ninguna entra ahi. Lo que hay que averiguar es <b>de que factura era ese dinero</b>.
Busque una factura que cuadrase con lo que sobra, del mismo cliente, y no la hay en el panel.</div>

<table>
<thead><tr>
  <th class="tk">#</th><th>Factura</th><th>Fecha</th><th class="r">Total</th>
  <th class="r">Dice la ficha</th><th class="r">De mas</th>
  <th>Cobros anotados</th><th>Que se ve en los datos</th><th>Que hacemos</th>
</tr></thead>
<tbody>
__FILAS__
<tr class="tot"><td colspan="5">TOTAL COBRADO DE MAS</td><td class="r nu">__TOTAL__</td>
  <td colspan="3"></td></tr>
</tbody></table>

<div class="pie">Sacado del panel de Transportes Araya el __HOY__, desde
Informes &rsaquo; Cuadre de cobros &rsaquo; Cobrado de mas que el total.</div>

<div class="nueva"></div>
<h2>Como queda cada cliente mirando toda su historia</h2>
<div class="aviso">Aqui se suma todo lo que se le ha facturado a ese cliente y todo lo que
dicen las fichas que ha pagado. Si sale en <span class="malo">rojo</span>, el panel dice que
ha pagado mas de lo que se le facturo nunca: o falta alguna factura suya por meter, o ese
dinero era de otro. Si sale en verde, el cliente cuadra y el problema es solo que el dinero
esta colgado de la factura equivocada.</div>
<table class="resumen">
<thead><tr><th>Cliente</th><th class="r">Le queda por pagar (segun las fichas)</th><th>Que significa</th></tr></thead>
<tbody>__RESUMEN__</tbody></table>

<h2>Por donde empezar</h2>
<div class="aviso">
<ul>
<li><b>Las dos imposibles primero</b>: DIAZ TATO 566 y GRUAS MAJORERO 569. El cobro es de
<b>anos antes</b> de la factura, asi que es seguro que pagaba otra factura. DIAZ TATO ademas
solo tiene <b>una</b> factura en el panel: esos 615,00 € pagaban algo que no esta aqui.</li>
<li><b>La grande</b>: MAXODIVER 210589. Dos cobros el mismo dia, uno de 5.519,20 € que paga la
factura clavada y otro de 5.501,89 € que es de otra.</li>
<li><b>Las de un solo cobro</b> (MAXODIVER 240302, 230238, 240261, 230236, 240260, ALLTOUR
230730, PLAYAS DE JANDIA 190237, OBRAS JOANTRO 230611): el cliente pago varias facturas de
una vez y la importacion colgo el pago entero de una sola. Hay que repartirlo.</li>
<li>Con el numero de cobro de Factusol que va en cada linea (&laquo;Factusol cobro 1631&raquo;)
se puede mirar en Factusol a que facturas se aplico ese dinero.</li>
</ul>
</div>

</body></html>"""

HTML = (HTML.replace('__HOY__', HOY.strftime('%d/%m/%Y'))
            .replace('__TOTAL__', eur(total))
            .replace('__NCLI__', str(len(orden)))
            .replace('__N__', str(len(d)))
            .replace('__FILAS__', '\n'.join(filas))
            .replace('__RESUMEN__', res))

ruta_html = os.path.join(SP, 'cobrado_de_mas.html')
open(ruta_html, 'w', encoding='utf-8').write(HTML)

subprocess.run(['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
                '--headless', '--disable-gpu', '--no-sandbox',
                '--no-pdf-header-footer',
                '--print-to-pdf=' + SALIDA, 'file://' + ruta_html],
               check=True, capture_output=True)
print('PDF:', SALIDA, os.path.getsize(SALIDA), 'bytes ·', len(d), 'facturas ·', eur(total))

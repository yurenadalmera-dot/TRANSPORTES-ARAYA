# -*- coding: utf-8 -*-
"""Factura de Innova IA Systems a Transportes Araya Franquiz, S.L."""
import subprocess, os, sys

BASE = '/home/user/TRANSPORTES-ARAYA/facturacion'
TMP = '/tmp/claude-0'
CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
TIPO_IGIC = 0.07

FACTURAS = {
    '2026-001': dict(
        fecha='24/09/2026', vence='24/10/2026', nota='',
        lineas=[
            ('Implantación sistema de gestión operativo — Fase 1',
             'Según presupuesto INNOVA-2026-001 (aceptado 20/08/2026).<br>'
             'Entregables verificados en producción el 31/08/2026:',
             ['Panel operativo privado', 'Control de stock', 'Pedidos a proveedores',
              'Gestión de facturas', 'Control de deuda', 'Alertas operativas'],
             1500.00),
            ('Servicio de mantenimiento y soporte — septiembre 2026',
             'Cuota mensual del sistema en producción (araya.innovaiasystems.com).',
             [], 240.00),
        ]),
    '2026-002': dict(
        fecha='24/09/2026', vence='24/10/2026',
        nota='El 50 % restante &mdash; 1.177,00 &euro; de la fase 2 y 1.926,00 &euro; de la fase 3 &mdash; se factura a la '
             'entrega de cada una. La cuota mensual se mantiene en 240,00 &euro; + IGIC y no var&iacute;a por estas fases.',
        lineas=[
            ('Ampliación del sistema — Fase 2 · Integración y operativa',
             'Presupuesto ARAYA-F23-20260916 (16/09/2026) &mdash; 50 % a la aceptación sobre 2.200,00 € de base. Alcance:',
             ['Integración con FactuSol', 'Lectura automática de facturas',
              'WhatsApp y avisos de reposición', 'Control de cubetas',
              'Planificación de rutas', 'Puesta en marcha y formación'],
             1100.00),
            ('Ampliación del sistema — Fase 3 · Ventas y control económico',
             'Presupuesto ARAYA-F23-20260916 (16/09/2026) &mdash; 50 % a la aceptación sobre 3.600,00 € de base. Alcance:',
             ['Clientes y presupuestos', 'Albaranes con QR y envío',
              'Facturación de ventas', 'Cobros y conciliación asistida',
              'Informes de ventas y cobros', 'Exportación mensual a la asesoría'],
             1800.00),
        ]),
}

NUMERO = sys.argv[1] if len(sys.argv) > 1 else '2026-001'
CFG = FACTURAS[NUMERO]
FECHA, VENCE, NOTA, LINEAS = CFG['fecha'], CFG['vence'], CFG['nota'], CFG['lineas']
SALIDA = 'factura_%s_araya' % NUMERO


def eur(v):
    return format(round(v, 2), ',.2f').replace(',', 'X').replace('.', ',').replace('X', '.') + ' €'


base = sum(l[3] for l in LINEAS)
igic = round(base * TIPO_IGIC, 2)
total = round(base + igic, 2)

filas = ''
for titulo, desc, puntos, imp in LINEAS:
    lis = ('<div class="pts">' + ''.join('<div class="pt">· %s</div>' % p for p in puntos) + '</div>') if puntos else ''
    filas += (
        '<tr>'
        '<td><div class="ct">%s</div><div class="cd">%s</div>%s</td>'
        '<td class="r imp">%s</td>'
        '<td class="c">7 %%</td>'
        '<td class="r imp b">%s</td>'
        '</tr>' % (titulo, desc, lis, eur(imp), eur(round(imp * (1 + TIPO_IGIC), 2))))

CSS = """
@page { size:A4; margin:12mm 12mm 10mm; }
*{box-sizing:border-box}
body{font-family:"Liberation Serif","Times New Roman",serif;color:#111;font-size:10pt;margin:0;line-height:1.4}
.cab{background:#000106;display:flex;align-items:center;justify-content:space-between;
     padding:10px 22px;margin-bottom:14px}
.cab img{height:64px;display:block}
.cab .der{text-align:right;color:#fff}
.cab .tit{font-size:26pt;font-weight:bold;letter-spacing:1px;line-height:1.1}
.cab .dat{font-size:9pt;color:#e8e8ee;margin-top:8px;line-height:1.55}
.cab .dat i{color:#E4B33C;font-style:italic}
.emisor{margin-bottom:14px}
.emisor .n{font-size:12.5pt;font-weight:bold;color:#16205c;margin-bottom:2px}
.emisor .l{font-size:9.5pt;line-height:1.5}
hr{border:0;border-top:1px solid #c9a227;margin:0 0 14px}
.rot{font-size:8.5pt;letter-spacing:1.2px;color:#666;font-family:"Liberation Sans",Arial,sans-serif;
     text-transform:uppercase;margin-bottom:4px}
.cli .n{font-size:12.5pt;font-weight:bold;color:#16205c}
.cli .l{font-size:10pt;line-height:1.5}
.cli .aa{font-size:9pt;color:#555}
table{width:100%;border-collapse:collapse;margin:14px 0 0}
th{background:#16205c;color:#fff;font-family:"Liberation Sans",Arial,sans-serif;font-size:9pt;
   letter-spacing:.6px;padding:7px 9px;text-transform:uppercase}
th.r{text-align:right}th.c{text-align:center}
td{border-bottom:1px solid #d5d5dd;padding:7px 9px;vertical-align:top}
td.r{text-align:right;white-space:nowrap}td.c{text-align:center}
.imp{font-size:10.5pt}.b{font-weight:bold}
.ct{font-weight:bold;font-size:10.5pt;margin-bottom:3px}
.cd{font-size:8.6pt;color:#555;line-height:1.45}
.pts{column-count:2;column-gap:7mm;margin-top:2px}
.pt{font-size:8.6pt;color:#444;margin-left:4px;break-inside:avoid}
.tot{width:46%;margin:8px 0 0 54%}
.tot .f{display:flex;justify-content:space-between;padding:3px 10px;font-size:10pt;color:#333}
.tot .caja{background:#16205c;color:#fff;padding:9px 12px;margin-top:6px;text-align:right}
.tot .caja .l{font-family:"Liberation Sans",Arial,sans-serif;font-size:8.6pt;letter-spacing:.8px}
.tot .caja .v{font-size:17pt;font-weight:bold;line-height:1.2}
.pago{margin-top:14px}
.pago .l{font-size:10pt;line-height:1.45}
.nota{margin-top:7px;font-size:8.2pt;color:#555;font-style:italic;line-height:1.45}
.pago .iban{font-family:"Liberation Mono","Courier New",monospace;font-weight:bold;font-size:10.5pt}
.legal{margin-top:8px;border-top:1px solid #d5d5dd;padding-top:9px;
       font-size:5.8pt;color:#555;line-height:1.32;text-align:justify;
       column-count:3;column-gap:6mm;column-rule:.5px solid #e4e4ea}
.legal b{color:#333}
.legal p{margin:0 0 5px}
"""

HTML = """
<div class="cab">
  <img src="file://__LOGO__">
  <div class="der">
    <div class="tit">FACTURA</div>
    <div class="dat">
      N&ordm;: __NUM__<br>
      Fecha: __FECHA__<br>
      Vencimiento: __VENCE__
    </div>
  </div>
</div>

<div class="emisor">
  <div class="n">INNOVA IA SYSTEMS</div>
  <div class="l">
    Yurena M&eacute;ndez &middot; NIF 78527655C<br>
    C/ Cervantes, 14 &middot; 35625 Morro Jable &middot; P&aacute;jara (Las Palmas)<br>
    info@innovaiasystems.com &middot; 637 734 869
  </div>
</div>

<hr>
<div class="cli">
  <div class="rot">Facturar a</div>
  <div class="n">TRANSPORTES ARAYA FRANQUIZ, S.L.</div>
  <div class="l">
    CIF: B35773316<br>
    Lugar Monta&ntilde;a de Tirba, 19 &middot; 35629 Tirba &ndash; Tuineje (Fuerteventura)
  </div>
  <div class="aa">A la atenci&oacute;n de: Jennifer &mdash; administracion@transportesarayafranquiz.es</div>
</div>

<table>
<tr><th>Concepto</th><th class="r">Base</th><th class="c">IGIC</th><th class="r">Total</th></tr>
__FILAS__
</table>

<div class="tot">
  <div class="f"><span>Base imponible</span><span>__BASE__</span></div>
  <div class="f"><span>IGIC (7 %)</span><span>__IGIC__</span></div>
  <div class="caja"><div class="l">TOTAL FACTURA</div><div class="v">__TOTAL__</div></div>
</div>

<div class="pago">
  <div class="rot">Forma de pago</div>
  <div class="l">
    Transferencia bancaria &mdash; IBAN <span class="iban">ES53 0182 5342 7802 0318 5904</span><br>
    Titular: Yurena M&eacute;ndez (Innova IA Systems)<br>
    Concepto: Factura __NUM__ &middot; Transportes Araya<br>
    Plazo de pago: 30 d&iacute;as desde la fecha de emisi&oacute;n (vence el __VENCE__).
  </div>
  __NOTA__
</div>

<div class="legal">
<p><b>R&eacute;gimen fiscal.</b> Operaci&oacute;n sujeta a IGIC al 7 % conforme a la Ley 20/1991, de 7 de junio, de
modificaci&oacute;n de los aspectos fiscales del R&eacute;gimen Econ&oacute;mico Fiscal de Canarias. Factura emitida
conforme al Real Decreto 1619/2012, de 30 de noviembre, por el que se aprueba el Reglamento de facturaci&oacute;n.</p>

<p><b>Protecci&oacute;n de datos.</b> Conforme al Reglamento (UE) 2016/679 (RGPD) y a la Ley Org&aacute;nica 3/2018
(LOPDGDD), le informamos de que los datos personales de este documento son tratados por <b>Yurena M&eacute;ndez
(Innova IA Systems)</b>, NIF 78527655C, C/ Cervantes, 14, 35625 Morro Jable, P&aacute;jara (Las Palmas), como
responsable del tratamiento. <b>Finalidad:</b> gestionar la relaci&oacute;n comercial, emitir y conservar esta factura
y atender las obligaciones legales, contables y fiscales derivadas. <b>Base jur&iacute;dica:</b> ejecuci&oacute;n del
contrato (art. 6.1.b RGPD) y cumplimiento de obligaciones legales (art. 6.1.c RGPD). <b>Conservaci&oacute;n:</b>
mientras dure la relaci&oacute;n y, despu&eacute;s, seis a&ntilde;os (art. 30 C&oacute;digo de Comercio) y cuatro
a&ntilde;os (art. 66 Ley General Tributaria). <b>Destinatarios:</b> Administraci&oacute;n Tributaria y la
asesor&iacute;a fiscal y contable, como encargada del tratamiento; no hay otras cesiones, ni transferencias
internacionales, ni decisiones automatizadas. <b>Derechos:</b> acceso, rectificaci&oacute;n, supresi&oacute;n,
oposici&oacute;n, limitaci&oacute;n y portabilidad, escribiendo a la direcci&oacute;n indicada o a
info@innovaiasystems.com, y reclamaci&oacute;n ante la Agencia Espa&ntilde;ola de Protecci&oacute;n de Datos
(www.aepd.es).</p>

<p><b>Confidencialidad.</b> Documento confidencial dirigido &uacute;nicamente a su destinatario; si lo ha recibido por error, comun&iacute;quelo y destr&uacute;yalo.</p>

<p><b>Morosidad.</b> El impago al vencimiento devenga autom&aacute;ticamente el inter&eacute;s de demora de la Ley 3/2004, de lucha contra la morosidad en las operaciones comerciales, sin aviso ni intimaci&oacute;n previa.</p>
</div>
"""

doc = (HTML.replace('__LOGO__', os.path.join(BASE, 'logo_innova.png'))
           .replace('__NUM__', NUMERO).replace('__FECHA__', FECHA).replace('__VENCE__', VENCE)
           .replace('__FILAS__', filas)
           .replace('__NOTA__', ('<div class="nota">' + NOTA + '</div>') if NOTA else '')
           .replace('__BASE__', eur(base)).replace('__IGIC__', eur(igic)).replace('__TOTAL__', eur(total)))

rh = os.path.join(TMP, SALIDA + '.html')
rp = os.path.join(BASE, SALIDA + '.pdf')
open(rh, 'w', encoding='utf-8').write(
    '<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Factura ' + NUMERO +
    '</title><style>' + CSS + '</style></head><body>' + doc + '</body></html>')
subprocess.run([CHROME, '--headless', '--disable-gpu', '--no-sandbox', '--allow-file-access-from-files',
                '--no-pdf-header-footer', '--print-to-pdf=' + rp, 'file://' + rh],
               check=True, capture_output=True)
print(SALIDA + '.pdf', os.path.getsize(rp), 'bytes')
print('base', eur(base), '· IGIC', eur(igic), '· total', eur(total))

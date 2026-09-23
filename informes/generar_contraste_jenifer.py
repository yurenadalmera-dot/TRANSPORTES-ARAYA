# -*- coding: utf-8 -*-
"""Genera el Excel de contraste Factusol <-> Panel Atenea para la revision con Jenifer."""
import json
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

ORIGEN = '/home/user/TRANSPORTES-ARAYA/informes/contraste_datos.json'
DESTINO = '/home/user/TRANSPORTES-ARAYA/informes/contraste_factusol_panel_20260923.xlsx'

AZUL = PatternFill('solid', fgColor='1F3864')
GRIS = PatternFill('solid', fgColor='F2F2F2')
ROJO = PatternFill('solid', fgColor='FCE4E4')
AMAR = PatternFill('solid', fgColor='FFF2CC')
VERDE = PatternFill('solid', fgColor='E2EFDA')
BLANCO = Font(color='FFFFFF', bold=True)
BORDE = Border(*[Side(style='thin', color='BFBFBF')] * 4)
EUR = '#,##0.00 "€"'

d = json.load(open(ORIGEN))
ventas, meses, faltan = d['ventas_dif'], d['compras_mes'], d['compras_faltan']

PRESTAMOS = {'PRESTAMO 1825.51€', 'PRESTAMO EUSTAQUIO CUOTA 1258€'}
faltan_reales = [r for r in faltan if r[0] not in PRESTAMOS]

wb = Workbook()


def cabecera(ws, titulos, fila=1):
    for c, t in enumerate(titulos, 1):
        cel = ws.cell(row=fila, column=c, value=t)
        cel.fill, cel.font, cel.border = AZUL, BLANCO, BORDE
        cel.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
    ws.freeze_panes = ws.cell(row=fila + 1, column=1)


def anchos(ws, medidas):
    for i, w in enumerate(medidas, 1):
        ws.column_dimensions[get_column_letter(i)].width = w


# ---------------------------------------------------------------- 1. Resumen
ws = wb.active
ws.title = 'Resumen'
anchos(ws, [52, 16, 16, 16, 46])
ws['A1'] = 'Contraste Factusol / Panel Atenea'
ws['A1'].font = Font(size=16, bold=True, color='1F3864')
ws['A2'] = 'Transportes Araya Franquiz, S.L. · Datos a 23/09/2026 · Ejercicio 2026'
ws['A2'].font = Font(size=10, italic=True, color='595959')

cabecera(ws, ['Concepto', 'Factusol', 'Panel', 'Diferencia', 'Observaciones'], fila=4)

tot_v_fx = sum(r[3] for r in ventas)
tot_v_pa = sum(r[4] for r in ventas)
tot_faltan = sum(r[3] for r in faltan)
tot_faltan_real = sum(r[3] for r in faltan_reales)
n_fx = sum(r[1] for r in meses)
n_pa = sum(r[2] for r in meses)
i_fx = sum(r[3] for r in meses)
i_pa = sum(r[4] for r in meses)

filas = [
    ('FACTURAS DE CLIENTES', None, None, None, None),
    ('Facturas de venta 2026 en el panel', None, 469, None,
     'Ultima: 260464. Total facturado 1.074.707,50 €'),
    ('Facturas de venta que faltaban por importar', None, 0, None,
     'La puesta al dia de 400 dias no creo ninguna: no falta ninguna factura'),
    ('Facturas con importe distinto entre los dos sistemas', 14, 14, tot_v_fx - tot_v_pa,
     'Detalle en la hoja "Ventas con diferencia"'),
    (None, None, None, None, None),
    ('FACTURAS DE PROVEEDORES', None, None, None, None),
    ('Facturas 2026 (enero a agosto)', n_fx - 5, n_pa - 30, None,
     'Septiembre no se compara: el espejo de Factusol esta parado desde el 01/09'),
    ('Importe 2026 (enero a agosto)', i_fx - 210.82, i_pa - 44714.67,
     (i_fx - 210.82) - (i_pa - 44714.67), 'Detalle mes a mes en la hoja "Compras mes a mes"'),
    ('Facturas de proveedor que faltan en el panel', len(faltan), None, tot_faltan,
     'Detalle en la hoja "Compras que faltan"'),
    ('  de las que son facturas reales', len(faltan_reales), None, tot_faltan_real,
     'Excluidos los dos apuntes de PRESTAMO, que no son facturas'),
    (None, None, None, None, None),
    ('QUE HAY QUE MIRAR CON JENIFER', None, None, None, None),
    ('1. Las 14 facturas de venta con importe distinto', None, None, None,
     'Decidir cual es el importe bueno en cada una'),
    ('2. Agosto de compras: 31 facturas menos en el panel', None, None, -10694.84,
     'Es el mes con mas desfase; ver si son facturas no registradas'),
    ('3. Las 63 facturas de proveedor que faltan', None, None, tot_faltan_real,
     'Confirmar si hay que darlas de alta en el panel'),
    ('4. Volver a arrancar el espejo de compras de Factusol', None, None, None,
     'Esta parado desde el 01/09; sin el no se puede comparar septiembre'),
]

f = 5
for concepto, a, b, dif, obs in filas:
    if concepto is None:
        f += 1
        continue
    ws.cell(row=f, column=1, value=concepto)
    es_titulo = concepto.isupper()
    for c in range(1, 6):
        cel = ws.cell(row=f, column=c)
        cel.border = BORDE
        if es_titulo:
            cel.fill = GRIS
            cel.font = Font(bold=True, color='1F3864')
    if a is not None:
        cel = ws.cell(row=f, column=2, value=a)
        if isinstance(a, float):
            cel.number_format = EUR
    if b is not None:
        cel = ws.cell(row=f, column=3, value=b)
        if isinstance(b, float):
            cel.number_format = EUR
    if dif is not None:
        cel = ws.cell(row=f, column=4, value=round(dif, 2))
        cel.number_format = EUR
        cel.font = Font(bold=True, color='C00000' if abs(dif) > 0.005 else '375623')
    if obs is not None:
        cel = ws.cell(row=f, column=5, value=obs)
        cel.alignment = Alignment(wrap_text=True, vertical='center')
    f += 1

# ------------------------------------------------- 2. Ventas con diferencia
ws = wb.create_sheet('Ventas con diferencia')
anchos(ws, [12, 12, 56, 16, 16, 14, 26])
ws['A1'] = 'Facturas de venta con importe distinto entre Factusol y el panel'
ws['A1'].font = Font(size=13, bold=True, color='1F3864')
cabecera(ws, ['Numero', 'Fecha', 'Cliente', 'Total Factusol', 'Total panel',
              'Diferencia', 'Importe correcto (rellenar)'], fila=3)
f = 4
for num, fecha, cli, tfx, tpa in sorted(ventas, key=lambda r: r[0]):
    dif = round(tfx - tpa, 2)
    ws.cell(row=f, column=1, value=num)
    ws.cell(row=f, column=2, value=fecha)
    ws.cell(row=f, column=3, value=cli)
    for c, v in ((4, tfx), (5, tpa), (6, dif)):
        cel = ws.cell(row=f, column=c, value=v)
        cel.number_format = EUR
    ws.cell(row=f, column=6).font = Font(bold=True, color='C00000')
    ws.cell(row=f, column=7).fill = AMAR
    for c in range(1, 8):
        ws.cell(row=f, column=c).border = BORDE
    f += 1
ws.cell(row=f, column=3, value='TOTAL').font = Font(bold=True)
for c, v in ((4, tot_v_fx), (5, tot_v_pa), (6, round(tot_v_fx - tot_v_pa, 2))):
    cel = ws.cell(row=f, column=c, value=round(v, 2))
    cel.number_format, cel.font, cel.fill = EUR, Font(bold=True), GRIS
ws.cell(row=f, column=3).fill = GRIS

# ------------------------------------------------- 3. Compras mes a mes
ws = wb.create_sheet('Compras mes a mes')
anchos(ws, [12, 16, 14, 18, 18, 16, 44])
ws['A1'] = 'Facturas de proveedores: Factusol frente al panel, mes a mes'
ws['A1'].font = Font(size=13, bold=True, color='1F3864')
ws['A2'] = ('Se compara por totales de mes porque 958 de las 1.282 facturas del panel tienen '
            'el proveedor sin CIF y los numeros de factura se repiten entre proveedores.')
ws['A2'].font = Font(size=10, italic=True, color='595959')
cabecera(ws, ['Mes', 'Nº Factusol', 'Nº panel', 'Importe Factusol', 'Importe panel',
              'Diferencia', 'Observaciones'], fila=4)
f = 5
MESES = {'01': 'Enero', '02': 'Febrero', '03': 'Marzo', '04': 'Abril', '05': 'Mayo',
         '06': 'Junio', '07': 'Julio', '08': 'Agosto', '09': 'Septiembre'}
for mes, nfx, npa, ifx, ipa in meses:
    dif = round(ifx - ipa, 2)
    sep = mes.endswith('-09')
    obs = ('No comparable: el espejo de Factusol esta parado desde el 01/09'
           if sep else ('Cuadra' if abs(dif) < 0.005 else
                        'Revisar' if abs(dif) < 1000 else 'Desfase importante'))
    ws.cell(row=f, column=1, value=MESES[mes[-2:]])
    ws.cell(row=f, column=2, value=nfx)
    ws.cell(row=f, column=3, value=npa)
    for c, v in ((4, ifx), (5, ipa), (6, dif)):
        cel = ws.cell(row=f, column=c, value=v)
        cel.number_format = EUR
    ws.cell(row=f, column=7, value=obs)
    relleno = GRIS if sep else (VERDE if abs(dif) < 0.005 else (AMAR if abs(dif) < 1000 else ROJO))
    for c in range(1, 8):
        cel = ws.cell(row=f, column=c)
        cel.border, cel.fill = BORDE, relleno
    f += 1
ws.cell(row=f, column=1, value='TOTAL ene-ago').font = Font(bold=True)
for c, v in ((2, n_fx - 5), (3, n_pa - 30), (4, i_fx - 210.82), (5, i_pa - 44714.67),
             (6, round((i_fx - 210.82) - (i_pa - 44714.67), 2))):
    cel = ws.cell(row=f, column=c, value=round(v, 2) if c >= 4 else v)
    cel.font, cel.fill, cel.border = Font(bold=True), GRIS, BORDE
    if c >= 4:
        cel.number_format = EUR
ws.cell(row=f, column=1).fill = GRIS

# ------------------------------------------------- 4. Compras que faltan
ws = wb.create_sheet('Compras que faltan')
anchos(ws, [22, 12, 52, 16, 30, 24])
ws['A1'] = 'Facturas de proveedor que estan en Factusol y no en el panel'
ws['A1'].font = Font(size=13, bold=True, color='1F3864')
ws['A2'] = ('%d apuntes por %s €. Dos de ellos son prestamos, no facturas: sin ellos quedan '
            '%d facturas reales por %s €.' % (
                len(faltan), format(round(tot_faltan, 2), ',.2f').replace(',', 'X').replace('.', ',').replace('X', '.'),
                len(faltan_reales),
                format(round(tot_faltan_real, 2), ',.2f').replace(',', 'X').replace('.', ',').replace('X', '.')))
ws['A2'].font = Font(size=10, italic=True, color='595959')
cabecera(ws, ['Numero', 'Fecha', 'Proveedor', 'Importe', 'Tipo', 'Decision (rellenar)'], fila=4)
f = 5
for num, fecha, prov, imp in sorted(faltan, key=lambda r: (r[1], r[0])):
    prestamo = num in PRESTAMOS
    ws.cell(row=f, column=1, value=num)
    ws.cell(row=f, column=2, value=fecha)
    ws.cell(row=f, column=3, value=prov)
    cel = ws.cell(row=f, column=4, value=imp)
    cel.number_format = EUR
    ws.cell(row=f, column=5, value='PRESTAMO - no es factura' if prestamo else 'Factura')
    ws.cell(row=f, column=6).fill = AMAR
    for c in range(1, 7):
        cel = ws.cell(row=f, column=c)
        cel.border = BORDE
        if prestamo:
            cel.fill = ROJO if c != 6 else AMAR
    f += 1
ws.cell(row=f, column=3, value='TOTAL apuntes').font = Font(bold=True)
cel = ws.cell(row=f, column=4, value=round(tot_faltan, 2))
cel.number_format, cel.font, cel.fill = EUR, Font(bold=True), GRIS
ws.cell(row=f, column=3).fill = GRIS
f += 1
ws.cell(row=f, column=3, value='TOTAL solo facturas reales').font = Font(bold=True)
cel = ws.cell(row=f, column=4, value=round(tot_faltan_real, 2))
cel.number_format, cel.font, cel.fill = EUR, Font(bold=True), VERDE
ws.cell(row=f, column=3).fill = VERDE

wb.save(DESTINO)
print(DESTINO)
print('ventas_dif=%d  meses=%d  faltan=%d (reales=%d)' % (
    len(ventas), len(meses), len(faltan), len(faltan_reales)))

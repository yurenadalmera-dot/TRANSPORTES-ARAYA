# -*- coding: utf-8 -*-
"""Lee un PDF de nominas (modelo oficial de recibo de salarios) y devuelve
una lista de diccionarios, uno por trabajador, con devengos, deducciones,
bases y aportacion empresarial."""
import re, json, sys, unicodedata

MESES = {'ENE':1,'FEB':2,'MAR':3,'ABR':4,'MAY':5,'JUN':6,
         'JUL':7,'AGO':8,'SEP':9,'SET':9,'OCT':10,'NOV':11,'DIC':12}
NUM = re.compile(r'-?\d{1,3}(?:\.\d{3})*,\d{2}|-?\d+,\d{2}')

def num(s):
    return float(s.replace('.', '').replace(',', '.'))

def nums(line):
    return [num(m.group()) for m in NUM.finditer(line)]

def fecha(txt):
    m = re.match(r'\s*(\d{1,2})\s+([A-Z]{3})\s+(\d{2})\s*$', txt.strip().upper())
    if not m: return None
    d, mes, y = int(m.group(1)), MESES.get(m.group(2)), int(m.group(3))
    if not mes: return None
    return '%04d-%02d-%02d' % (2000 + y, mes, d)

def limpia(s):
    return re.sub(r'\s+', ' ', s).strip()

def parse_pagina(t):
    L = t.split('\n')
    r = {'conceptos': [], 'ss_empresa_detalle': []}

    # --- datos del trabajador ---
    for i, l in enumerate(L):
        if 'TRABAJADOR/A' in l and 'D.N.I.' in l and i + 1 < len(L):
            d = L[i + 1]
            m = re.search(r'([0-9XYZ]\d{7}[A-Z]|[A-Z]\d{7}[A-Z])\s*$', d.strip())
            if m: r['dni'] = m.group(1)
            fa = re.search(r'(\d{1,2}\s+[A-Z]{3}\s+\d{2})', d)
            if fa: r['antiguedad'] = fecha(fa.group(1))
            cab = d[:fa.start()] if fa else d
            partes = [p for p in re.split(r'\s{3,}', cab.strip()) if p]
            if partes: r['empleado'] = limpia(partes[0])
            if len(partes) > 1: r['categoria'] = limpia(partes[1])
            break

    # --- afiliacion y periodo ---
    for i, l in enumerate(L):
        if 'AFILIACION' in l and i + 1 < len(L):
            d = L[i + 1]
            m = re.search(r'(\d{2}/\d{7,10}-\d{2})', d)
            if m: r['naf'] = m.group(1)
            p = re.search(r'(\d{1,2}\s+[A-Z]{3}\s+\d{2})\s*a\s*(\d{1,2}\s+[A-Z]{3}\s+\d{2})', d)
            if p:
                r['fecha_inicio'] = fecha(p.group(1)); r['fecha_fin'] = fecha(p.group(2))
                r['periodo'] = r['fecha_inicio'][:8] + '01'
                cola = d[p.end():]
                dd = re.search(r'(\d+)', cola)
                if dd: r['dias'] = int(dd.group(1))
            break

    # --- conceptos: devengos y deducciones ---
    ini = fin = None
    for i, l in enumerate(L):
        if 'CUANTIA' in l and 'CONCEPTO' in l: ini = i + 1
        if 'BASE S.S. T.' in l: fin = i; break
    orden = 0
    if ini is not None and fin is not None:
        for l in L[ini:fin]:
            if not l.strip(): continue
            m = re.match(r'\s*(?:([\d.,]+)\s+([\d.,]+)\s+)?(\d{1,4})\s+(\*?)\s*(.+?)\s{2,}([\d.,]+)\s*$', l)
            if not m: continue
            cant, prec, cod, ast, concepto, imp = m.groups()
            # La columna decide: los devengos quedan a la izquierda de los descuentos
            # los devengos acaban en la columna 81 y las deducciones en la 95
            clase = 'devengo' if m.end(6) <= 85 else 'deduccion'
            orden += 1
            r['conceptos'].append({
                'orden': orden, 'codigo': cod, 'concepto': limpia(concepto),
                'clase': clase, 'salarial': bool(ast),
                'cantidad': num(cant) if cant and ',' in cant else None,
                'precio': num(prec) if prec and ',' in prec else None,
                'importe': num(imp)})

    dev = [c for c in r['conceptos'] if c['clase'] == 'devengo']
    ded = [c for c in r['conceptos'] if c['clase'] == 'deduccion']
    r['total_devengado']   = round(sum(c['importe'] for c in dev), 2)
    r['total_deducciones'] = round(sum(c['importe'] for c in ded), 2)

    r['ss_trabajador'] = round(sum(c['importe'] for c in ded
                                   if c['concepto'].upper().startswith('COTIZACION')), 2)
    irpf = [c for c in ded if 'I.R.P.F' in c['concepto'].upper() or 'IRPF' in c['concepto'].upper()]
    r['irpf'] = round(sum(c['importe'] for c in irpf), 2)
    for c in irpf:
        p = re.search(r'([\d]+,[\d]+)\s*$', c['concepto'])
        if p: r['tipo_irpf'] = num(p.group(1))
    r['otras_deducciones'] = round(r['total_deducciones'] - r['ss_trabajador'] - r['irpf'], 2)

    # --- bases ---
    for i, l in enumerate(L):
        if 'BASE S.S. T.' in l and i + 1 < len(L):
            v = nums(L[i + 1])
            if len(v) >= 6:
                r['base_cc'] = v[0]; r['base_irpf'] = v[3]
            elif v:
                r['base_cc'] = v[0]
            break

    # --- liquido y coste empresa ---
    for i, l in enumerate(L):
        if 'LIQUIDO A PERCIBIR' in l:
            for j in range(i + 1, min(i + 4, len(L))):
                v = nums(L[j])
                if v: r['liquido'] = v[0]; break
            break
    for l in L:
        if 'COSTE EMPRESA' in l:
            v = nums(l)
            if v: r['coste_empresa'] = v[0]
            break

    # --- aportacion empresarial ---
    ETIQ = [('CONTINGENCIAS COMUNES', 'Contingencias comunes'), ('MEI', 'MEI'),
            ('AT Y EP', 'AT y EP'), ('DESEMPLEO', 'Desempleo'),
            ('FORMACI', 'Formacion Profesional'), ('GARANT', 'Fondo de Garantia Salarial')]
    emp = None
    for i, l in enumerate(L):
        if 'APORTACI' in l.upper() and 'EMPRESARIAL' in l.upper(): emp = i + 1; break
    if emp is not None:
        for l in L[emp:]:
            u = unicodedata.normalize('NFKD', l.upper())
            u = ''.join(ch for ch in u if not unicodedata.combining(ch))
            v = nums(l)
            if len(v) != 3: continue
            nombre = None
            for clave, et in ETIQ:
                if clave in u: nombre = et; break
            if not nombre: continue
            r['ss_empresa_detalle'].append(
                {'concepto': nombre, 'base': v[0], 'tipo': v[1], 'importe': v[2]})
    r['ss_empresa'] = round(sum(x['importe'] for x in r['ss_empresa_detalle']), 2)
    r['base_at'] = next((x['base'] for x in r['ss_empresa_detalle'] if x['concepto'] == 'AT y EP'), None)
    return r

def parse_pdf(ruta):
    from pypdf import PdfReader
    return [parse_pagina(p.extract_text()) for p in PdfReader(ruta).pages]

if __name__ == '__main__':
    print(json.dumps(parse_pdf(sys.argv[1]), ensure_ascii=False, indent=1))

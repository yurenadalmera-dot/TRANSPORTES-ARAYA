const MESES = {ENE:1,FEB:2,MAR:3,ABR:4,MAY:5,JUN:6,JUL:7,AGO:8,SEP:9,SET:9,OCT:10,NOV:11,DIC:12};
function num(s){ if(s===null||s===undefined) return null; const t=String(s).replace(/\./g,'').replace(',','.'); const n=Number(t); return isNaN(n)?null:n; }
function nums(l){ const re=/-?\d{1,3}(?:\.\d{3})*,\d{2}|-?\d+,\d{2}/g; const r=[]; let m; while((m=re.exec(String(l)))!==null){ r.push(num(m[0])); } return r; }
function fech(t){ const m=/^\s*(\d{1,2})\s+([A-Za-z]{3})\s+(\d{2})\s*$/.exec(String(t).trim()); if(!m) return null; const mes=MESES[m[2].toUpperCase()]; if(!mes) return null; return '20'+m[3]+'-'+('0'+mes).slice(-2)+'-'+('0'+m[1]).slice(-2); }
function limpia(s){ return String(s).replace(/\s+/g,' ').trim(); }
function sinTildes(s){ return String(s).normalize('NFD').replace(/[̀-ͯ]/g,'').toUpperCase(); }
function r2(n){ return (n===null||n===undefined)?null:Math.round(n*100)/100; }

function totales(cs, modo){
  let dev=0, ded=0;
  for (let i=0;i<cs.length;i++){
    const c = cs[i];
    const esDed = (modo==='codigo') ? (Number(c.codigo)>=700) : (c.finCol>85);
    if (esDed) ded += (c.importe||0); else dev += (c.importe||0);
  }
  return { dev: r2(dev), ded: r2(ded) };
}

function parsePagina(t){
  const L = String(t||'').split('\n');
  const r = { conceptos: [], ss_empresa_detalle: [] };
  for (let i=0;i<L.length;i++){
    if (L[i].indexOf('TRABAJADOR/A')>-1 && L[i].indexOf('D.N.I.')>-1 && i+1<L.length){
      const d = L[i+1];
      const mdni = /([0-9XYZ]\d{7}[A-Z]|[A-Z]\d{7}[A-Z])\s*$/.exec(d.trim());
      if (mdni) r.dni = mdni[1];
      const mfa = /(\d{1,2}\s+[A-Za-z]{3}\s+\d{2})/.exec(d);
      if (mfa) r.antiguedad = fech(mfa[1]);
      const cab = mfa ? d.slice(0, mfa.index) : d;
      const partes = cab.trim().split(/\s{3,}/).filter(function(x){ return x.length>0; });
      if (partes.length) r.empleado = limpia(partes[0]);
      if (partes.length>1) r.categoria = limpia(partes[1]);
      break;
    }
  }
  for (let i=0;i<L.length;i++){
    if (L[i].indexOf('AFILIACION')>-1 && i+1<L.length){
      const d = L[i+1];
      const mn = /(\d{2}\/\d{7,10}-\d{2})/.exec(d);
      if (mn) r.naf = mn[1];
      const mp = /(\d{1,2}\s+[A-Za-z]{3}\s+\d{2})\s*a\s*(\d{1,2}\s+[A-Za-z]{3}\s+\d{2})/.exec(d);
      if (mp){
        r.fecha_inicio = fech(mp[1]); r.fecha_fin = fech(mp[2]);
        if (r.fecha_inicio) r.periodo = r.fecha_inicio.slice(0,8) + '01';
        const cola = d.slice(mp.index + mp[0].length);
        const md = /(\d+)/.exec(cola);
        if (md) r.dias = parseInt(md[1],10);
      }
      break;
    }
  }
  let ini=-1, fin=-1;
  for (let i=0;i<L.length;i++){
    if (L[i].indexOf('CUANTIA')>-1 && L[i].indexOf('CONCEPTO')>-1) ini = i+1;
    if (L[i].indexOf('BASE S.S. T.')>-1){ fin = i; break; }
  }
  let orden = 0;
  if (ini>=0 && fin>ini){
    for (let i=ini;i<fin;i++){
      const l = L[i];
      if (!l.trim()) continue;
      const m = /^\s*(?:([\d.,]+)\s+([\d.,]+)\s+)?(\d{1,4})\s+(\*?)\s*(.+?)\s{2,}([\d.,]+)\s*$/.exec(l);
      if (!m) continue;
      const imp = m[6];
      orden++;
      r.conceptos.push({ orden: orden, codigo: m[3], concepto: limpia(m[5]),
        finCol: l.lastIndexOf(imp) + imp.length, salarial: (m[4]==='*'),
        cantidad: (m[1] && m[1].indexOf(',')>-1) ? num(m[1]) : null,
        precio: (m[2] && m[2].indexOf(',')>-1) ? num(m[2]) : null,
        importe: num(imp) });
    }
  }
  for (let i=0;i<L.length;i++){
    if (L[i].indexOf('LIQUIDO A PERCIBIR')>-1){
      for (let j=i+1;j<Math.min(i+4,L.length);j++){ const v=nums(L[j]); if (v.length){ r.liquido=v[0]; break; } }
      break;
    }
  }
  // El propio recibo decide como separar devengos de deducciones: se prueba por
  // columna y por rango de codigo, y gana la que reproduce el liquido a percibir.
  const porCol = totales(r.conceptos,'columna');
  const porCod = totales(r.conceptos,'codigo');
  let modo = 'columna';
  if (r.liquido!==undefined && r.liquido!==null){
    const okCol = Math.abs(r2(porCol.dev - porCol.ded) - r.liquido) <= 0.02;
    const okCod = Math.abs(r2(porCod.dev - porCod.ded) - r.liquido) <= 0.02;
    if (!okCol && okCod) modo = 'codigo';
    else if (!okCol && !okCod) modo = 'codigo';
  }
  r.modo_clasificacion = modo;
  for (let i=0;i<r.conceptos.length;i++){
    const c = r.conceptos[i];
    const esDed = (modo==='codigo') ? (Number(c.codigo)>=700) : (c.finCol>85);
    c.clase = esDed ? 'deduccion' : 'devengo';
    delete c.finCol;
  }
  const tt = (modo==='codigo') ? porCod : porCol;
  r.total_devengado = tt.dev; r.total_deducciones = tt.ded;
  const ded = r.conceptos.filter(function(c){ return c.clase==='deduccion'; });
  let sst=0; for (let i=0;i<ded.length;i++){ if (ded[i].concepto.toUpperCase().indexOf('COTIZACION')===0) sst += (ded[i].importe||0); }
  r.ss_trabajador = r2(sst);
  let irpf=0;
  for (let i=0;i<ded.length;i++){
    const u = ded[i].concepto.toUpperCase();
    if (u.indexOf('I.R.P.F')>-1 || u.indexOf('IRPF')>-1){
      irpf += (ded[i].importe||0);
      const mp = /([\d]+,[\d]+)\s*$/.exec(ded[i].concepto);
      if (mp) r.tipo_irpf = num(mp[1]);
    }
  }
  r.irpf = r2(irpf);
  r.otras_deducciones = r2(r.total_deducciones - r.ss_trabajador - r.irpf);
  for (let i=0;i<L.length;i++){
    if (L[i].indexOf('BASE S.S. T.')>-1 && i+1<L.length){
      const v = nums(L[i+1]);
      if (v.length>=6){ r.base_cc = v[0]; r.base_irpf = v[3]; }
      else if (v.length){ r.base_cc = v[0]; }
      break;
    }
  }
  for (let i=0;i<L.length;i++){
    if (L[i].indexOf('COSTE EMPRESA')>-1){ const v=nums(L[i]); if (v.length) r.coste_empresa=v[0]; break; }
  }
  const ETIQ = [['CONTINGENCIAS COMUNES','Contingencias comunes'],['MEI','MEI'],['AT Y EP','AT y EP'],['DESEMPLEO','Desempleo'],['FORMACI','Formacion Profesional'],['GARANT','Fondo de Garantia Salarial']];
  let emp=-1;
  for (let i=0;i<L.length;i++){ const u=sinTildes(L[i]); if (u.indexOf('APORTACI')>-1 && u.indexOf('EMPRESARIAL')>-1){ emp=i+1; break; } }
  if (emp>=0){
    for (let i=emp;i<L.length;i++){
      const u = sinTildes(L[i]);
      const v = nums(L[i]);
      if (v.length!==3) continue;
      let nombre = null;
      for (let k=0;k<ETIQ.length;k++){ if (u.indexOf(ETIQ[k][0])>-1){ nombre = ETIQ[k][1]; break; } }
      if (!nombre) continue;
      r.ss_empresa_detalle.push({ concepto: nombre, base: v[0], tipo: v[1], importe: v[2] });
    }
  }
  let se=0; for (let i=0;i<r.ss_empresa_detalle.length;i++) se += (r.ss_empresa_detalle[i].importe||0);
  r.ss_empresa = r2(se);
  for (let i=0;i<r.ss_empresa_detalle.length;i++){ if (r.ss_empresa_detalle[i].concepto==='AT y EP'){ r.base_at = r.ss_empresa_detalle[i].base; break; } }
  return r;
}
module.exports = { parsePagina };

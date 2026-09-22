
/* ===== Araya - modulo v02.22: informe de cuadre de cobros ===== */
(function(){
 if(typeof INF==='undefined')return;

 var DSC={rows:null,ld:false,er:null,ts:0,tab:'descuadre'};

 function dscCarga(force){
  if(DSC.ld)return;
  if(!force&&DSC.rows&&(Date.now()-DSC.ts)<120000)return;
  DSC.ld=true;DSC.er=null;
  rest('v_descuadres_cobro?select=*&order=cliente,fecha')
   .then(function(l){DSC.rows=l||[];DSC.ld=false;DSC.ts=Date.now();render();})
   .catch(function(e){DSC.ld=false;DSC.er=(e&&e.message)||'No se pudo cargar';render();});
 }

 function dscDatos(){
  var t=DSC.tab;
  return (DSC.rows||[]).filter(function(x){return x.tipo===t;});
 }

 function dscGrupos(l){
  var m={},o=[];
  for(var i=0;i<l.length;i++){
   var x=l[i], k=x.cliente_id||x.cliente||'sin';
   if(!m[k]){m[k]={id:k,nombre:x.cliente||'Sin cliente',cif:x.cif||'',fs:[],imp:0};o.push(k);}
   m[k].fs.push(x);
   m[k].imp+=Math.abs(_n(DSC.tab==='descuadre'?x.diferencia:x.de_mas));
  }
  var a=[];for(var z=0;z<o.length;z++)a.push(m[o[z]]);
  a.sort(function(x,y){return String(x.nombre||'').localeCompare(String(y.nombre||''),'es',{sensitivity:'base'});});
  return a;
 }

 function dscHoy(){
  var d=new Date(),p=function(n){return (n<10?'0':'')+n;};
  return p(d.getDate())+'/'+p(d.getMonth()+1)+'/'+d.getFullYear();
 }

 var DSC_EST={0:'Pendiente',1:'Cobro parcial',2:'Cobrada',3:'Devuelta',4:'Anulada'};

 function vInfDescua(){
  var cab='<div class="c"><div class="ch noimp"><h2>Cuadre de cobros</h2>';
  if(DSC.rows&&!DSC.ld){
   var l0=dscDatos(), s0=0;
   l0.forEach(function(x){s0+=Math.abs(_n(DSC.tab==='descuadre'?x.diferencia:x.de_mas));});
   cab+='<span class="m">'+l0.length+' facturas - '+eu2(s0)+'</span>'
    +'<button class="ac" data-dsccsv>Descargar Excel</button> '
    +'<button class="ac" data-dscref>Recargar</button>';
  }
  cab+='</div>'+infTabs();
  if(DSC.er)return cab+'<div class="emp"><h3>No se pudieron cargar los datos</h3><p>'+es(DSC.er)+'</p></div></div>';
  if(!DSC.rows){dscCarga();return cab+'<div class="emp"><h3>Mirando los cobros...</h3></div></div>';}

  var nd=0,nm=0,sd=0,sm=0;
  (DSC.rows||[]).forEach(function(x){
   if(x.tipo==='descuadre'){nd++;sd+=Math.abs(_n(x.diferencia));}else{nm++;sm+=Math.abs(_n(x.de_mas));}});

  cab+='<div class="fts noimp" style="gap:8px;padding:12px 16px;border-bottom:1px solid var(--bd)">'
   +'<button class="'+(DSC.tab==='descuadre'?'ms':'ac')+'" data-dsctab="descuadre">La ficha no cuadra con sus cobros ('+nd+')</button>'
   +'<button class="'+(DSC.tab==='demas'?'ms':'ac')+'" data-dsctab="demas">Cobrado de mas que el total ('+nm+')</button>'
   +'</div>';

  var l=dscDatos();
  if(!l.length){
   return cab+'<div class="emp"><h3>'+(DSC.tab==='descuadre'
     ?'Todas las fichas cuadran con sus cobros'
     :'Ninguna factura tiene cobrado mas que su total')
    +'</h3><p>Nada que revisar aqui.</p></div></div>';
  }

  var gs=dscGrupos(l), total=0;
  l.forEach(function(x){total+=Math.abs(_n(DSC.tab==='descuadre'?x.diferencia:x.de_mas));});

  var h='<div id="informe" style="padding:18px"><div class="inf">'
   +'<h1>'+es((S.d&&S.d.org&&S.d.org.nombre)||'Transportes Araya Franquiz')+'</h1>'
   +'<div class="sub">'+(DSC.tab==='descuadre'
      ?'Facturas donde el importe cobrado de la ficha no cuadra con la suma de sus cobros'
      :'Facturas donde la ficha dice cobrado mas que el total de la factura')
   +' - Informe a '+dscHoy()+'</div>'
   +'<div class="kp" style="margin:16px 0">'
   +'<div class="k hero"><div class="l">'+(DSC.tab==='descuadre'?'Diferencia total':'Cobrado de mas')+'</div>'
   +'<div class="v">'+eu2(total)+'</div><div class="s">'+l.length+' facturas de '+gs.length+' clientes</div></div>'
   +'<div class="k"><div class="l">La ficha no cuadra</div><div class="v">'+eu2(sd)+'</div>'
   +'<div class="s">'+nd+' facturas</div></div>'
   +'<div class="k"><div class="l">Cobrado de mas</div><div class="v">'+eu2(sm)+'</div>'
   +'<div class="s">'+nm+' facturas</div></div></div>'
   +'<div class="note noimp">'+(DSC.tab==='descuadre'
     ?'Esto no infla la deuda: el informe de pendientes se queda con la mayor de las dos cifras. Lo que si hace es enganar a lo que lea la casilla a pelo.'
     :'La ficha dice que se cobro mas dinero del que valia la factura. O hay un cobro contado dos veces, o el dinero era de otra factura.')
   +'</div>'
   +'<div class="tw"><table><thead><tr><th>Cliente / factura</th><th>Fecha</th><th>Estado</th>'
   +'<th class="r">Total</th><th class="r">Ficha</th><th class="r">Cobros anotados</th>'
   +'<th class="r">Cobros</th><th>Ultimo cobro</th><th class="r">Diferencia</th></tr></thead><tbody>';

  for(var i=0;i<gs.length;i++){
   var g=gs[i];
   h+='<tr class="gr"><td colspan="8">'+es(g.nombre)+(g.cif?' - '+es(g.cif):'')
    +' <span class="sm">('+g.fs.length+(g.fs.length===1?' factura':' facturas')+')</span></td>'
    +'<td class="r nu">'+eu2(g.imp)+'</td></tr>';
   for(var j=0;j<g.fs.length;j++){
    var x=g.fs[j], dif=_n(DSC.tab==='descuadre'?x.diferencia:x.de_mas);
    h+='<tr><td style="padding-left:22px">'+es(x.numero_factura||'-')
     +(x.incobrable?'<div class="sm">incobrable</div>':'')+'</td>'
     +'<td class="nu">'+fc(x.fecha)+'</td>'
     +'<td class="sm">'+es(cp(x.estado||''))
     +(x.estfac_factusol!=null?'<div class="sm">Factusol: '+es(DSC_EST[x.estfac_factusol]||x.estfac_factusol)+'</div>':'')+'</td>'
     +'<td class="r nu">'+eu2(x.total)+'</td>'
     +'<td class="r nu">'+eu2(x.importe_ficha)+'</td>'
     +'<td class="r nu">'+eu2(x.cobros_anotados)+'</td>'
     +'<td class="r nu">'+_n(x.n_cobros)+'</td>'
     +'<td class="nu">'+(x.ultimo_cobro?fc(x.ultimo_cobro):'-')+'</td>'
     +'<td class="r nu"><b>'+eu2(dif)+'</b></td></tr>';
   }
  }
  h+='</tbody><tfoot><tr class="gtot" style="font-weight:700;border-top:2px solid var(--ink)">'
   +'<td colspan="8">TOTAL</td><td class="r nu">'+eu2(total)+'</td></tr></tfoot></table></div>'
   +'<div class="sub" style="margin-top:6px">Informe generado desde el panel de Transportes Araya el '+dscHoy()+'.</div>'
   +'</div></div>';
  return cab+h+'</div>';
 }

 function dscCsv(){
  var l=dscDatos();
  var n2=function(v){return String((Number(v)||0).toFixed(2)).replace('.',',');};
  var tx=function(v){return String(v==null?'':v).replace(/[;\r\n]/g,' ');};
  var L=[['Cliente','CIF','N factura','Fecha','Estado','Estado en Factusol','Total',
          'Importe cobrado (ficha)','Cobros anotados','N cobros','Primer cobro','Ultimo cobro',
          'Diferencia','Cobrado de mas'].join(';')];
  for(var i=0;i<l.length;i++){var x=l[i];
   L.push([tx(x.cliente),tx(x.cif),tx(x.numero_factura),fc(x.fecha),tx(x.estado),
     tx(x.estfac_factusol!=null?DSC_EST[x.estfac_factusol]:''),
     n2(x.total),n2(x.importe_ficha),n2(x.cobros_anotados),String(_n(x.n_cobros)),
     (x.primer_cobro?fc(x.primer_cobro):''),(x.ultimo_cobro?fc(x.ultimo_cobro):''),
     n2(x.diferencia),n2(x.de_mas)].join(';'));}
  var b=new Blob(['﻿'+L.join('\r\n')],{type:'text/csv;charset=utf-8;'});
  var a=document.createElement('a');a.href=URL.createObjectURL(b);
  a.download='cuadre-cobros-'+(DSC.tab==='descuadre'?'descuadres':'cobrado-de-mas')+'.csv';
  document.body.appendChild(a);a.click();
  setTimeout(function(){URL.revokeObjectURL(a.href);a.remove();},500);
  toast('Excel descargado');
 }

 function dscBind(){
  if(!(S.v==='informes'&&INF.tab==='descua'))return;
  document.querySelectorAll('[data-dsctab]').forEach(function(b){
   b.onclick=function(){DSC.tab=b.getAttribute('data-dsctab');render();};});
  if(q('[data-dscref]'))q('[data-dscref]').onclick=function(){DSC.rows=null;dscCarga(true);render();};
  if(q('[data-dsccsv]'))q('[data-dsccsv]').onclick=dscCsv;
 }

 /* la pestana nueva, encima de las que ya habia */
 infTabs=function(){
  var t=[['pagos','Pagos a proveedores'],['cobros','Cobros de clientes'],
         ['albfac','Albaranes facturados'],['descua','Cuadre de cobros']];
  return '<div class="fts noimp" style="gap:8px">'+t.map(function(x){
    return '<button class="'+((INF.tab||'pagos')===x[0]?'ms':'ac')+'" data-inftab="'+x[0]+'">'+x[1]+'</button>';}).join('')
   +'<span style="flex:1"></span>'
   +((INF.tab==='cobros')?'<button class="ac" data-icref>Recargar datos</button>':'')+'</div>';
 };

 window.VINF_DESCUA=vInfDescua;
 var _vid=(typeof vInf==='function')?vInf:null;
 if(_vid)vInf=function(){ if(INF.tab==='descua') return vInfDescua(); return _vid(); };
 window.DSC_BIND=dscBind;
 var _pdsc=window.BINDX;
 window.BINDX=function(){
  if(_pdsc){try{_pdsc();}catch(e){console.error(e);}}
  try{window.DSC_BIND();}catch(e){console.error(e);}
 };
})();

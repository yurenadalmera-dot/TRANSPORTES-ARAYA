(function(){
var IAF={rows:null,ld:false,er:null,d1:'',d2:'',cli:'',tipo:'',sinfirma:false};
function iafCarga(force){
 if(IAF.ld)return;
 if(IAF.rows&&!force)return;
 IAF.ld=true;IAF.er=null;
 rest('v_albaranes_facturados?select=*&order=numero_factura.desc,numero')
  .then(function(r){IAF.rows=r||[];IAF.ld=false;render();})
  .catch(function(e){IAF.er=e.message;IAF.ld=false;render();});
}
function iafHoy(){var d=new Date();var p=function(n){return (n<10?'0':'')+n;};
 return p(d.getDate())+'/'+p(d.getMonth()+1)+'/'+d.getFullYear();}
function iafArchivo(){var d=new Date();var p=function(n){return (n<10?'0':'')+n;};
 return 'albaranes-facturados-'+d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate());}
function iafDatos(){
 var a=(IAF.rows||[]).slice();
 if(IAF.d1)a=a.filter(function(x){return (x.fecha||'')>=IAF.d1;});
 if(IAF.d2)a=a.filter(function(x){return (x.fecha||'')<=IAF.d2;});
 if(IAF.cli)a=a.filter(function(x){return x.cliente_id===IAF.cli;});
 if(IAF.tipo)a=a.filter(function(x){return (x.tipo_albaran||'traslado')===IAF.tipo;});
 if(IAF.sinfirma)a=a.filter(function(x){return !x.firmado_cliente||!x.firmado_conductor;});
 return a;
}
function iafClientes(){
 var m={},o=[];
 (IAF.rows||[]).forEach(function(x){if(x.cliente_id&&!m[x.cliente_id]){m[x.cliente_id]=1;o.push({id:x.cliente_id,nombre:x.cliente||''});}});
 o.sort(function(p,s){return (p.nombre||'').localeCompare(s.nombre||'');});
 return o;
}
function iafFiltros(){
 var cs=iafClientes();
 return '<div class="fts noimp" style="gap:10px;flex-wrap:wrap">'
  +'<div class="fi" style="max-width:145px;margin:0"><label>Desde</label><input type="date" id="iaf_d1" value="'+es(IAF.d1||'')+'"></div>'
  +'<div class="fi" style="max-width:145px;margin:0"><label>Hasta</label><input type="date" id="iaf_d2" value="'+es(IAF.d2||'')+'"></div>'
  +'<div class="fi" style="max-width:280px;margin:0"><label>Cliente</label><select id="iaf_cli"><option value="">Todos</option>'
  +cs.map(function(c){return '<option value="'+es(c.id)+'"'+(IAF.cli===c.id?' selected':'')+'>'+es(c.nombre)+'</option>';}).join('')+'</select></div>'
  +'<div class="fi" style="max-width:190px;margin:0"><label>Tipo de albaran</label><select id="iaf_tipo">'
  +[['','Todos'],['traslado','Traslado (DeCA)'],['horas','Horas de trabajo']].map(function(t){
     return '<option value="'+t[0]+'"'+(IAF.tipo===t[0]?' selected':'')+'>'+t[1]+'</option>';}).join('')+'</select></div>'
  +'<div class="fi" style="max-width:220px;margin:0;padding-top:2px"><label>Firmas</label><div class="mi">'
  +'<input type="checkbox" id="iaf_sf" style="width:auto;vertical-align:middle"'+(IAF.sinfirma?' checked':'')+'> Solo los que faltan de firmar</div></div>'
  +'<button class="ac" data-iaflimp>Limpiar filtros</button></div>';
}
function iafCsv(){
 var a=iafDatos();
 var cab=['Factura','Fecha factura','Estado factura','Albaran','Fecha albaran','Tipo','Cliente','Obra','Origen','Destino','Empleado','Horas','Matricula','Conductor','Firma cliente','Firma conductor','Importe albaran'];
 var fil=a.map(function(x){return [x.numero_factura||'',x.fecha_factura||'',x.estado_factura||'',x.numero||'',x.fecha||'',
   (x.tipo_albaran==='horas'?'Horas':'Traslado'),x.cliente||'',x.obra||'',x.lugar_origen||'',x.lugar_destino||'',
   x.empleado||'',(x.horas==null?'':x.horas),x.matricula||'',x.conductor||'',
   (x.firmado_cliente?'Si':'No'),(x.firmado_conductor?'Si':'No'),
   String(Number(x.total_albaran||0).toFixed(2)).replace('.',',')];});
 var esc=function(v){v=String(v==null?'':v);return '"'+v.replace(/"/g,'""')+'"';};
 var txt='﻿'+[cab].concat(fil).map(function(r){return r.map(esc).join(';');}).join('\r\n');
 var b=new Blob([txt],{type:'text/csv;charset=utf-8;'});
 var u=URL.createObjectURL(b),el=document.createElement('a');
 el.href=u;el.download=iafArchivo()+'.csv';document.body.appendChild(el);el.click();
 setTimeout(function(){URL.revokeObjectURL(el.href);el.remove();},500);
 toast('Excel descargado');
}
function vInfAlbFac(){
 var cab='<div class="c"><div class="ch noimp"><h2>Albaranes ya facturados</h2>';
 if(IAF.rows&&!IAF.ld){
  var d0=iafDatos(), im0=0, sf0=0;
  d0.forEach(function(x){im0+=Number(x.total_albaran||0);if(!x.firmado_cliente||!x.firmado_conductor)sf0++;});
  cab+='<span class="m">'+plu(d0.length,'albaran','albaranes')+' · '+eu2(im0)+(sf0?(' · '+sf0+' sin firmar'):'')+'</span>'
   +'<button class="ac" data-iafcsv>Descargar Excel</button> <button class="ms" data-iafpdf>Descargar PDF</button>';
 }
 cab+='<button class="ac" data-iafref style="margin-left:6px">Recargar datos</button></div>'+infTabs();
 if(IAF.er)return cab+'<div class="emp"><h3>No se pudieron cargar los datos</h3><p>'+es(IAF.er)+'</p></div></div>';
 if(!IAF.rows){iafCarga();return cab+'<div class="emp"><h3>Cargando albaranes facturados...</h3></div></div>';}
 cab+=iafFiltros();
 var arr=iafDatos();
 if(!arr.length)return cab+'<div class="emp"><h3>No hay albaranes facturados que cumplan el filtro</h3><p>Prueba a ampliar las fechas o pulsa Limpiar filtros.</p></div></div>';

 var facs=[],ix={};
 arr.forEach(function(x){
  var k=x.factura_venta_id||'-';
  if(!ix[k]){ix[k]={n:x.numero_factura||'',f:x.fecha_factura||'',est:x.estado_factura||'',tot:Number(x.total_factura||0),l:[]};facs.push(ix[k]);}
  ix[k].l.push(x);
 });
 var totImp=0,totSf=0;
 arr.forEach(function(x){totImp+=Number(x.total_albaran||0);if(!x.firmado_cliente||!x.firmado_conductor)totSf++;});

 var fi=function(x){
  var c=x.firmado_cliente,k=x.firmado_conductor;
  if(c&&k)return '<span style="color:var(--ok)">cliente y conductor</span>';
  if(c)return '<span style="color:#A8730F">falta el conductor</span>';
  if(k)return '<span style="color:#A8730F">falta el cliente</span>';
  return '<span style="color:var(--red)">sin firmar</span>';
 };
 var h='<div id="informe" style="padding:18px"><div class="inf">'
  +'<h1>'+es((S.d.org&&S.d.org.nombre)||'Transportes Araya Franquiz')+'</h1>'
  +'<div class="sub">Albaranes ya facturados · Informe a '+iafHoy()+'</div>'
  +'<div class="sub">'+plu(arr.length,'albaran','albaranes')+' en '+plu(facs.length,'factura','facturas')
  +(IAF.cli?(' · '+es((arr[0]||{}).cliente||'')):'')+'</div>'
  +'<div class="kp" style="margin:16px 0">'
  +'<div class="k hero"><div class="l">Importe facturado</div><div class="v">'+eu2(totImp)+'</div><div class="s">'+plu(arr.length,'albaran','albaranes')+'</div></div>'
  +'<div class="k"><div class="l">Facturas</div><div class="v">'+facs.length+'</div><div class="s">en las que salieron</div></div>'
  +'<div class="k"><div class="l">Sin firmar del todo</div><div class="v">'+totSf+'</div><div class="s">'+(totSf?'falta la firma del cliente o la del conductor':'todos firmados')+'</div></div>'
  +'</div>';

 facs.forEach(function(F){
  var st=0;F.l.forEach(function(x){st+=Number(x.total_albaran||0);});
  h+='<div class="tw" style="margin-bottom:14px"><table><thead>'
   +'<tr><th colspan="8" style="text-align:left">Factura <b>'+es(F.n)+'</b> del '+fc(String(F.f||'').slice(0,10))
     +' · '+cp(F.est||'')+' · total '+eu2(F.tot)+'</th></tr>'
   +'<tr><th>Albaran</th><th>Fecha</th><th>Tipo</th><th>Obra</th><th>Ruta o empleado</th><th>Matricula</th><th>Firmas</th><th class="r">Importe</th></tr>'
   +'</thead><tbody>';
  F.l.forEach(function(x){
   var ruta=(x.tipo_albaran==='horas')
     ?(es(x.empleado||'')+(x.horas?(' · '+x.horas+' h'):''))
     :(es(x.lugar_origen||'')+' → '+es(x.lugar_destino||''));
   h+='<tr><td class="nu">'+es(x.numero||'')+'</td>'
    +'<td class="nu">'+fc(String(x.fecha||'').slice(0,10))+'</td>'
    +'<td>'+(x.tipo_albaran==='horas'?'Horas':'Traslado')+'</td>'
    +'<td>'+es(x.obra||'')+'</td>'
    +'<td>'+ruta+'</td>'
    +'<td class="nu">'+es(x.matricula||'')+'</td>'
    +'<td>'+fi(x)+'</td>'
    +'<td class="r nu">'+eur(x.total_albaran||0)+'</td></tr>';
  });
  h+='<tr><td colspan="7"><b>Suma de los albaranes</b></td><td class="r nu"><b>'+eu2(st)+'</b></td></tr>';
  if(Math.abs(st-Number(F.tot||0))>0.02){
   h+='<tr><td colspan="8" style="color:var(--red)">La suma de los albaranes no cuadra con el total de la factura: puede llevar IGIC, o alguna linea que no viene de albaran.</td></tr>';
  }
  h+='</tbody></table></div>';
 });

 h+='<div class="inf-pie">Informe generado desde el panel de Transportes Araya el '+iafHoy()+'.</div></div></div></div>';
 return cab+h;
}
function iafBind(){
 if(!(S.v==='informes'&&INF.tab==='albfac'))return;
 if(q('[data-iafref]'))q('[data-iafref]').onclick=function(){IAF.rows=null;iafCarga(true);render();};
 if(q('[data-iafcsv]'))q('[data-iafcsv]').onclick=iafCsv;
 if(q('[data-iafpdf]'))q('[data-iafpdf]').onclick=function(){
  var t=document.title;document.title=iafArchivo();window.print();
  setTimeout(function(){document.title=t;},800);};
 if(q('[data-iaflimp]'))q('[data-iaflimp]').onclick=function(){
  IAF.d1='';IAF.d2='';IAF.cli='';IAF.tipo='';IAF.sinfirma=false;render();};
 if(q('#iaf_d1'))q('#iaf_d1').onchange=function(){IAF.d1=q('#iaf_d1').value;render();};
 if(q('#iaf_d2'))q('#iaf_d2').onchange=function(){IAF.d2=q('#iaf_d2').value;render();};
 if(q('#iaf_cli'))q('#iaf_cli').onchange=function(){IAF.cli=q('#iaf_cli').value;render();};
 if(q('#iaf_tipo'))q('#iaf_tipo').onchange=function(){IAF.tipo=q('#iaf_tipo').value;render();};
 if(q('#iaf_sf'))q('#iaf_sf').onchange=function(){IAF.sinfirma=q('#iaf_sf').checked;render();};
}
infTabs=function(){
 var t=[['pagos','Pagos a proveedores'],['cobros','Cobros de clientes'],['albfac','Albaranes facturados']];
 return '<div class="fts noimp" style="gap:8px">'+t.map(function(x){
   return '<button class="'+((INF.tab||'pagos')===x[0]?'ms':'ac')+'" data-inftab="'+x[0]+'">'+x[1]+'</button>';}).join('')
  +'<span style="flex:1"></span>'
  +((INF.tab==='cobros')?'<button class="ac" data-icref>Recargar datos</button>':'')+'</div>';
};
var _vInf=vInf;
vInf=function(){ if(INF.tab==='albfac') return vInfAlbFac(); return _vInf(); };
window.IAF_BIND=iafBind;
var _piaf=window.BINDX;
window.BINDX=function(){
 if(_piaf){try{_piaf();}catch(e){console.error(e);}}
 try{window.IAF_BIND();}catch(e){console.error(e);}
};
})();

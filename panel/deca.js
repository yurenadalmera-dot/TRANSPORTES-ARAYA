var VX={},DC0,S={},document={querySelectorAll:function(){return [];}},FVQ={},lim=15;
function rest(){return Promise.resolve([]);} function render(){} function es(x){return String(x);}
function fc(x){return String(x);} function q(){return null;}
/* ===== DeCA: historial de documentos de control ===== */
var DC={ld:false,er:null,ts:0,docs:null,huerf:null,tab:'historial',txt:''};
function cargaDeca(force){
 if(DC.ld)return;
 if(!force&&DC.docs&&(Date.now()-DC.ts)<120000)return;
 DC.ld=true;DC.er=null;
 Promise.all([
  rest('v_deca?select=*&order=generado_at.desc'),
  rest('v_deca_huerfanos?select=*&order=created_at.desc')
 ]).then(function(a){DC.docs=a[0]||[];DC.huerf=a[1]||[];DC.ts=Date.now();DC.ld=false;render();})
 .catch(function(e){DC.ld=false;DC.er=e.message||'No se pudieron cargar los documentos';render();});
}
function decaMB(b){var n=Number(b)||0;return n?(Math.round(n/1024)+' KB'):'-';}

VX.deca=function(){
 if(!DC.docs&&!DC.er){cargaDeca(false);}
 if(DC.er)return '<div class="c"><div class="ch"><h2>DeCA</h2><button class="ac" data-dcref>Reintentar</button></div><div class="emp"><h3>No se pudieron cargar los documentos</h3><p>'+es(DC.er)+'</p></div></div>';
 if(!DC.docs)return '<div class="c"><div class="ch"><h2>DeCA</h2></div><div class="emp"><h3>Cargando...</h3><p>Un momento.</p></div></div>';

 var d=DC.docs,hu=DC.huerf||[];
 var vig=0,sus=0,fuera=0,borr=0;
 for(var i=0;i<d.length;i++){
  if(d[i].estado==='vigente')vig++;else sus++;
  if(d[i].dentro_del_limite===false)fuera++;
  if(d[i].albaran_borrado)borr++;
 }
 var bt=function(k,t,n){return '<button class="ac'+(DC.tab===k?' on':'')+'" data-dctab="'+k+'" style="margin-left:6px">'+t+(n?' ('+n+')':'')+'</button>';};
 var h='<div class="c"><div class="ch"><h2>Documentos electronicos de control</h2><div>'
  +bt('historial','Historial',d.length)+bt('huerfanos','Sin historial',hu.length)
  +'<input id="dc_txt" placeholder="Buscar albaran, matricula o cliente" value="'+es(DC.txt)+'" style="max-width:230px;margin-left:6px">'
  +'<button class="ac" data-dcref style="margin-left:6px">Actualizar</button></div></div>'
  +'<div class="kp" style="margin:16px 0">'
  +'<div class="k hero"><div class="l">DeCA vigentes</div><div class="v">'+vig+'</div><div class="s">uno por albaran con documento</div></div>'
  +'<div class="k"><div class="l">Versiones sustituidas</div><div class="v">'+sus+'</div><div class="s">se conservan para la inspeccion</div></div>'
  +'<div class="k"><div class="l">Fuera del limite de 5 MB</div><div class="v">'+fuera+'</div><div class="s">'+(fuera?'hay que revisarlos':'ninguno')+'</div></div>'
  +'<div class="k"><div class="l">PDF sin historial</div><div class="v">'+hu.length+'</div><div class="s">'+(hu.length?'publicados antes de la trazabilidad':'ninguno')+'</div></div>'
  +'</div>';

 if(DC.tab==='huerfanos'){
  if(!hu.length)return h+'<div class="emp"><h3>Todo cuadra</h3><p>Todos los PDF publicados constan en el historial.</p></div></div>';
  h+='<div class="note">Estos PDF estan publicados en el repositorio pero no tienen ficha en el historial: se emitieron antes de registrar la trazabilidad, o su albaran se borro. <b>No se borran</b>: alguno puede llevar el QR impreso circulando en un camion.</div>'
   +'<div class="tw" style="margin-top:12px"><table><thead><tr><th>Fichero</th><th>Publicado</th><th class="r">Tamano</th><th></th></tr></thead><tbody>';
  for(var j=0;j<hu.length;j++){
   var o=hu[j];
   h+='<tr><td class="nu">'+es(o.ruta||'')+'</td><td class="nu">'+fc(String(o.created_at||'').slice(0,10))+'</td>'
    +'<td class="r nu">'+decaMB(o.bytes)+'</td>'
    +'<td class="r"><a class="ac" href="'+es(o.url)+'" target="_blank" rel="noopener">Abrir PDF</a></td></tr>';
  }
  return h+'</tbody></table></div></div>';
 }

 var t=DC.txt.toLowerCase();
 var lista=d.filter(function(x){
  if(!t)return true;
  return ((x.albaran||'')+' '+(x.matricula||'')+' '+(x.cliente||'')+' '+(x.deca_uuid||'')).toLowerCase().indexOf(t)>=0;});
 if(!lista.length)return h+'<div class="emp"><h3>Sin documentos</h3><p>Los DeCA se generan desde la ficha del albaran.</p></div></div>';

 h+='<div class="tw"><table><thead><tr><th>Albaran</th><th>Servicio</th><th>Cliente</th><th class="r">Ver.</th><th>Estado</th><th>Emitido</th><th>Por</th><th>Motivo del cambio</th><th class="r">Tamano</th><th>Conservar hasta</th><th></th></tr></thead><tbody>';
 for(var k=0;k<lista.length;k++){
  var x=lista[k];
  h+='<tr><td><b>'+es(x.albaran||'?')+'</b>'+(x.albaran_borrado?'<div style="color:var(--red);font-size:11px">albaran borrado</div>':'')+'</td>'
   +'<td class="nu">'+(x.fecha_servicio?fc(x.fecha_servicio):'')+(x.matricula?'<div style="color:var(--mute);font-size:12px">'+es(x.matricula)+'</div>':'')+'</td>'
   +'<td>'+es(x.cliente||'')+'</td>'
   +'<td class="r nu">'+(x.version||1)+'</td>'
   +'<td>'+(x.estado==='vigente'?'<span style="color:var(--ok)">vigente</span>':'<span style="color:var(--mute)">sustituido'+(x.sustituido_por_version?' por la v'+x.sustituido_por_version:'')+'</span>')+'</td>'
   +'<td class="nu">'+String(x.generado_at||'').slice(0,16).replace('T',' ')+'</td>'
   +'<td style="font-size:12px">'+es(x.generado_por_email||'')+'</td>'
   +'<td style="font-size:12px;color:var(--mute)">'+es(x.motivo||'')+'</td>'
   +'<td class="r nu"'+(x.dentro_del_limite===false?' style="color:var(--red);font-weight:600"':'')+'>'+decaMB(x.bytes)+'</td>'
   +'<td class="nu"'+(x.plazo_cumplido?' style="color:var(--mute)"':'')+'>'+(x.conservar_hasta?fc(x.conservar_hasta):'')+'</td>'
   +'<td class="r"><a class="ac" href="'+es(x.url)+'" target="_blank" rel="noopener">Abrir PDF</a></td></tr>';
 }
 return h+'</tbody></table></div></div>';
};

function bindDeca(){
 if(q('[data-dcref]'))q('[data-dcref]').onclick=function(){DC.docs=null;DC.er=null;cargaDeca(true);};
 document.querySelectorAll('[data-dctab]').forEach(function(b){b.onclick=function(){DC.tab=b.getAttribute('data-dctab');render();};});
 if(q('#dc_txt')){var dt=q('#dc_txt');dt.oninput=function(){DC.txt=dt.value;};
   dt.onkeydown=function(ev){if(ev.key==='Enter'){DC.txt=dt.value;render();}};}
}
/* --- cambios en Facturacion --- */
function _fv(fv,la){
 var FV_COBRO=(FVQ.tab==='pendientes'||FVQ.tab==='vencidas'||FVQ.tab==='parciales');
 if(FVQ.anio===''&&la.length&&!FV_COBRO){var y=String(new Date().getFullYear());FVQ.anio=(la.indexOf(y)>=0)?y:la[0];}
 return 'Pendiente de cobro '+(FVQ.anio||'de todos los años');
}
function _bindtabs(){
 document.querySelectorAll('[data-fvtab]').forEach(function(b){b.onclick=function(){
   var _t=b.getAttribute('data-fvtab');
   if(_t==='pendientes'||_t==='vencidas'||_t==='parciales')FVQ.anio='';
   FVQ.tab=_t;lim=15;render();};});
}

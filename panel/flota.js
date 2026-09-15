/* ===== Flota, ITV y 4gflota ===== */
var G4URL='https://arayafranquiz.4gflota.com/';
function floG4(){
 return '<div class="c"><div class="ch"><h2>Seguimiento en directo</h2>'
  +'<span class="m">4gflota &middot; posicion y rutas de los vehiculos</span></div>'
  +'<div style="padding:18px 20px;display:flex;gap:14px;align-items:center;flex-wrap:wrap">'
  +'<a class="addb" href="'+G4URL+'" target="_blank" rel="noopener noreferrer">Abrir 4gflota</a>'
  +'<span class="note" style="margin:0;flex:1;min-width:220px">Se abre en una pestana nueva con tu usuario de 4gflota. '
  +'Los kilometros y las posiciones todavia no entran solos en el panel.</span></div></div>';
}
function floDia(f){
 if(!f)return null;
 var h=new Date(_hoy()+'T00:00:00'), d=new Date(String(f).slice(0,10)+'T00:00:00');
 if(isNaN(d))return null;
 return Math.round((d-h)/86400000);
}
function floOtros(){
 var vs=S.d.veh||[];
 var campos=[['vto_tacografo','el tacografo'],['vto_tarjeta','la tarjeta de transporte'],['vto_adr','el ADR']];
 var l=[];
 for(var i=0;i<vs.length;i++){
  var v=vs[i];
  if(v.activo===false)continue;
  for(var j=0;j<campos.length;j++){
   var d=floDia(v[campos[j][0]]);
   if(d===null)continue;
   if(d<=45)l.push({m:v.matricula||'',q:campos[j][1],d:d});
  }
 }
 l.sort(function(a,b){return a.d-b.d;});
 return l;
}
function floAvisos(){
 var l=floOtros();
 if(!l.length)return '';
 var ven=l.filter(function(x){return x.d<0;});
 var t=l.map(function(x){
   var c=x.d<0?('vencido hace '+(-x.d)+' d'):(x.d===0?'vence hoy':('en '+x.d+' d'));
   return es(x.m)+' ('+x.q+', '+c+')';
 }).join(', ');
 var est=ven.length?' style="background:#FBE9E9;border-color:#F0C4C4;color:#8E2C2C"':'';
 return '<div class="c" style="margin-top:20px"><div class="note"'+est+'><b>'
  +(ven.length?ven.length+' vencimientos caducados aparte de la ITV y el seguro:':'Vencimientos que tocan pronto aparte de la ITV y el seguro:')
  +'</b> '+t+'</div></div><div style="height:20px"></div>';
}
var FLO_ORIG=(typeof VX!=='undefined'&&VX.flota)?VX.flota:null;
VX.flota=function(){
 return floG4()+'<div style="height:20px"></div>'+floAvisos()+(FLO_ORIG?FLO_ORIG():'');
};

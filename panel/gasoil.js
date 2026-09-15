/* ===== Precio del gasoil en Fuerteventura ===== */
var GAS={ld:false,er:null,ts:0,hoy:null,est:null,ver:false};
function cargaGasoil(force){
 if(GAS.ld)return;
 if(!force&&GAS.hoy&&(Date.now()-GAS.ts)<600000)return;
 GAS.ld=true;GAS.er=null;
 Promise.all([
  rest('v_gasoil_hoy?select=*'),
  rest('precios_carburante?select=*&order=gasoleo_a.asc&limit=40')
 ]).then(function(a){
   GAS.hoy=(a[0]||[])[0]||{};
   var f=GAS.hoy.fecha;
   GAS.est=(a[1]||[]).filter(function(x){return !f||x.fecha===f;});
   GAS.ts=Date.now();GAS.ld=false;render();})
 .catch(function(e){GAS.ld=false;GAS.er=e.message||'No se pudo cargar el precio del gasoil';render();});
}
function gasP(v){if(v===null||v===undefined||v==='')return '—';var n=Number(v);return isNaN(n)?'—':(n.toFixed(3).replace('.',',')+' €');}

function gasTarjeta(){
 if(!GAS.hoy&&!GAS.er){cargaGasoil(false);}
 if(GAS.er)return '<div class="note" style="margin-top:16px">No se pudo cargar el precio del gasoil: '+es(GAS.er)+'</div>';
 if(!GAS.hoy)return '<div class="note" style="margin-top:16px">Cargando el precio del gasoil...</div>';
 var g=GAS.hoy;
 if(!g.fecha)return '<div class="note" style="margin-top:16px">Todavia no hay precios de carburante guardados. Se traen solos cada manana.</div>';
 var v=_n(g.variacion), col=v>0.0005?'var(--red)':(v<-0.0005?'var(--ok)':'var(--mute)');
 var flecha=v>0.0005?'▲':(v<-0.0005?'▼':'=');
 var h='<div class="c" style="margin-top:20px"><div class="ch"><h2>Gasoleo A en Fuerteventura</h2>'
  +'<span class="m">'+_n(g.estaciones)+' gasolineras · '+fc(g.fecha)+'</span>'
  +'<button class="ac" data-gasver>'+(GAS.ver?'Ocultar el detalle':'Ver todas')+'</button>'
  +'<button class="ac" data-gasref style="margin-left:6px">Actualizar</button></div>'
  +'<div class="kp" style="margin:16px 0">'
  +'<div class="k hero"><div class="l">Precio medio</div><div class="v">'+gasP(g.media)+'</div>'
  +'<div class="s" style="color:'+col+'">'+flecha+' '+(v===0?'igual que el dia anterior':(Math.abs(v).toFixed(3).replace('.',',')+' € respecto al dia anterior'))+'</div></div>'
  +'<div class="k"><div class="l">La mas barata</div><div class="v" style="color:var(--ok)">'+gasP(g.mas_barato)+'</div>'
  +'<div class="s">'+es(g.rotulo_mas_barato||'')+(g.municipio_mas_barato?' · '+es(g.municipio_mas_barato):'')+'</div></div>'
  +'<div class="k"><div class="l">La mas cara</div><div class="v" style="color:var(--red)">'+gasP(g.mas_caro)+'</div>'
  +'<div class="s">'+gasP(_n(g.mas_caro)-_n(g.mas_barato))+' de diferencia</div></div>'
  +'<div class="k"><div class="l">Ahorro por deposito</div><div class="v">'+eu2((_n(g.media)-_n(g.mas_barato))*400)+' €</div>'
  +'<div class="s">repostando 400 litros en la mas barata</div></div>'
  +'</div>';
 if(!GAS.ver)return h+'</div>';
 var l=GAS.est||[];
 if(!l.length)return h+'<div class="emp"><h3>Sin detalle</h3></div></div>';
 h+='<div class="tw"><table><thead><tr><th>Gasolinera</th><th>Municipio</th><th>Direccion</th>'
  +'<th class="r">Gasoleo A</th><th class="r">Premium</th><th>Horario</th></tr></thead><tbody>';
 for(var i=0;i<l.length;i++){var x=l[i];
  h+='<tr><td class="nm">'+es(x.rotulo||'')+'</td><td>'+es(x.municipio||'')+'</td>'
   +'<td class="sm">'+es(x.direccion||'')+'</td>'
   +'<td class="r nu"'+(i===0?' style="color:var(--ok);font-weight:600"':'')+'>'+gasP(x.gasoleo_a)+'</td>'
   +'<td class="r nu">'+(x.gasoleo_premium?gasP(x.gasoleo_premium):'—')+'</td>'
   +'<td class="sm">'+es(x.horario||'')+'</td></tr>';
 }
 return h+'</tbody></table></div>'
  +'<div class="note">Precios oficiales del Ministerio, del portal de precios de carburantes. Se traen solos cada manana.</div></div>';
}

VX.repostajes=function(){ return vRep()+gasTarjeta(); };

function bindGasoil(){
 if(q('[data-gasref]'))q('[data-gasref]').onclick=function(){GAS.hoy=null;GAS.er=null;cargaGasoil(true);};
 if(q('[data-gasver]'))q('[data-gasver]').onclick=function(){GAS.ver=!GAS.ver;render();};
}

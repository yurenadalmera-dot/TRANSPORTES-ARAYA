var VX={},S={},document={querySelectorAll:function(){return [];}};
function rest(){return Promise.resolve([]);} function rpc(){return Promise.resolve({});}
function render(){} function es(x){return String(x);} function fc(x){return String(x);}
function q(){return null;} function eu2(x){return String(x);} function eur(x){return String(x);}
function pue(){return true;} function _n(x){return Number(x)||0;} function toast(){}
function vImp(){return '';}
/* ===== Impuestos: modelo 111 y estimacion de sociedades ===== */
var IMQ={ld:false,er:null,ts:0,m111:null,soc:null,ed:false};
function cargaImp(force){
 if(IMQ.ld)return;
 if(!force&&IMQ.m111&&(Date.now()-IMQ.ts)<120000)return;
 IMQ.ld=true;IMQ.er=null;
 Promise.all([
  rest('v_modelo_111?select=*&order=ejercicio.desc,trimestre.desc'),
  rest('v_impuesto_sociedades?select=*&order=ejercicio.desc')
 ]).then(function(a){IMQ.m111=a[0]||[];IMQ.soc=a[1]||[];IMQ.ts=Date.now();IMQ.ld=false;render();})
 .catch(function(e){IMQ.ld=false;IMQ.er=e.message||'No se pudieron cargar los impuestos';render();});
}
function impF(v){return eu2(v)+' €';}

function impM111(){
 var l=IMQ.m111||[];
 var h='<div class="c" style="margin-top:20px"><div class="ch"><h2>Modelo 111 · retenciones de IRPF</h2>'
  +'<span class="m">nominas y profesionales, por trimestre</span></div>';
 if(!l.length)return h+'<div class="emp"><h3>Todavia no hay retenciones</h3><p>Aparecen en cuanto haya nominas cargadas o facturas de profesionales con retencion.</p></div></div>';
 h+='<div class="tw"><table><thead><tr><th>Periodo</th>'
  +'<th class="r">Trabajadores</th><th class="r">Base trabajo</th><th class="r">Retencion trabajo</th>'
  +'<th class="r">Profesionales</th><th class="r">Retencion prof.</th>'
  +'<th class="r">A ingresar</th><th>Situacion</th></tr></thead><tbody>';
 for(var i=0;i<l.length;i++){var x=l[i];
  var col=x.situacion==='cuadra'?'proveedor':(x.situacion==='sin presentar'?'otro':'impuesto');
  h+='<tr><td class="nm">'+x.ejercicio+' · '+x.trimestre+'T</td>'
   +'<td class="r nu">'+_n(x.trabajo_perceptores)+'</td>'
   +'<td class="r nu">'+eu2(x.trabajo_base)+'</td>'
   +'<td class="r nu">'+eu2(x.trabajo_retencion)+'</td>'
   +'<td class="r nu">'+_n(x.profesionales_perceptores)+'</td>'
   +'<td class="r nu">'+eu2(x.profesionales_retencion)+'</td>'
   +'<td class="r nu"><b>'+eu2(x.total_a_ingresar)+'</b></td>'
   +'<td><span class="tg t-'+col+'">'+es(x.situacion)+'</span>'
   +(x.fecha_presentacion?'<div class="sm">'+fc(x.fecha_presentacion)+'</div>':'')+'</td></tr>';
 }
 return h+'</tbody></table></div>'
  +'<div class="note">El modelo 111 se presenta el 20 de enero, abril, julio y octubre. La retencion del trabajo sale de las nominas cargadas; la de profesionales, de las facturas recibidas que llevan retencion.</div></div>';
}

function impSoc(){
 var l=IMQ.soc||[];
 if(!l.length)return '';
 var x=l[0];
 var falta=[];
 if(_n(x.personal_por_contabilizar)>0)
   falta.push('faltan '+(_n(x.meses_transcurridos)-_n(x.meses_con_nomina))+' meses de nominas por contabilizar, unos '+impF(x.personal_por_contabilizar));
 if(_n(x.amortizacion)===0&&x.amortizacion_estimada==null)
   falta.push('no hay ninguna amortizacion contabilizada');
 var res=_n(x.resultado_contable);
 var base=_n(x.base_estimada);
 var cuota=_n(x.cuota_estimada);
 var pagado=_n(x.pagos_fraccionados)+_n(x.retenciones_soportadas);

 var h='<div class="c" style="margin-top:20px"><div class="ch"><h2>Impuesto de sociedades '+x.ejercicio+' · estimacion</h2>'
  +'<span class="m">segun los libros hasta el '+fc(x.ultimo_apunte)+'</span>'
  +(pue()?'<button class="ac" data-imed>'+(IMQ.ed?'Cerrar':'Ajustar')+'</button>':'')
  +'<button class="ac" data-imref style="margin-left:6px">Actualizar</button></div>'
  +'<div class="kp" style="margin:16px 0">'
  +'<div class="k hero"><div class="l">Resultado segun libros</div><div class="v" style="color:'+(res>=0?'var(--ok)':'var(--red)')+'">'+eur(res)+'</div><div class="s">'+eur(_n(x.ingresos))+' de ingresos − '+eur(_n(x.gastos))+' de gastos</div></div>'
  +'<div class="k"><div class="l">Base imponible estimada</div><div class="v" style="color:'+(base>=0?'var(--ok)':'var(--red)')+'">'+eur(base)+'</div><div class="s">tras ajustar lo que falta</div></div>'
  +'<div class="k"><div class="l">Cuota estimada al '+eu2(x.tipo)+' %</div><div class="v">'+eur(cuota)+'</div><div class="s">'+(cuota>0?'antes de pagos a cuenta':'no saldria a pagar')+'</div></div>'
  +'<div class="k"><div class="l">A pagar estimado</div><div class="v" style="color:'+((cuota-pagado)>0?'var(--red)':'var(--ok)')+'">'+eur(cuota-pagado)+'</div><div class="s">'+(pagado>0?'ya pagados '+eur(pagado):'sin pagos a cuenta anotados')+'</div></div>'
  +'</div>';

 if(falta.length)
  h+='<div class="note" style="background:#FBE9E9;border-color:#F0C4C4;color:#8E2C2C"><b>Esta estimacion no vale como cierre.</b> '
    +falta.join('; ')+'. Lo primero ya esta descontado de la base; lo segundo lo tienes que poner tu abajo.</div>';

 if(IMQ.ed){
  var fi=function(id,l2,v,ph){return '<div class="fi"><label>'+l2+'</label><input id="'+id+'" type="number" step="0.01" value="'+(v==null?'':v)+'"'+(ph?' placeholder="'+ph+'"':'')+'></div>';};
  h+='<div class="fg" style="margin-top:14px">'
   +fi('is_amo','Amortizacion estimada del ano',x.amortizacion_estimada,'la de los camiones')
   +fi('is_ap','Ajustes que suman (no deducibles)',x.ajustes_positivos,'multas, sanciones...')
   +fi('is_an','Ajustes que restan',x.ajustes_negativos)
   +fi('is_bin','Bases negativas a compensar',x.bases_negativas)
   +fi('is_tipo','Tipo (%)',x.tipo)
   +fi('is_pf','Pagos fraccionados ya hechos',x.pagos_fraccionados)
   +fi('is_ret','Retenciones soportadas',x.retenciones_soportadas)
   +'<div class="fi" style="grid-column:1/-1"><label>Notas</label><input id="is_notas" value="'+es(x.notas||'')+'"></div>'
   +'</div>'
   +'<div style="padding:0 16px 16px"><button class="ms" data-imsave>Guardar</button></div>';
 }

 return h+'<div class="note">Es una estimacion para ir sabiendo por donde va el ano, no la liquidacion. El tipo general es el 25 %; las empresas de reducida dimension tienen una escala reducida en transicion, asi que confirma el tipo con la asesoria y cambialo en <b>Ajustar</b>.</div></div>';
}

function impExtra(){
 if(!IMQ.m111&&!IMQ.er)cargaImp(false);
 if(IMQ.er)return '<div class="note" style="margin-top:20px">No se pudieron cargar el modelo 111 ni la estimacion de sociedades: '+es(IMQ.er)+'</div>';
 if(!IMQ.m111)return '<div class="note" style="margin-top:20px">Cargando el modelo 111 y la estimacion de sociedades...</div>';
 return impM111()+impSoc();
}

VX.impuestos=function(){ return vImp()+impExtra(); };

function bindImpuestos(){
 if(q('[data-imref]'))q('[data-imref]').onclick=function(){IMQ.m111=null;IMQ.er=null;cargaImp(true);};
 if(q('[data-imed]'))q('[data-imed]').onclick=function(){IMQ.ed=!IMQ.ed;render();};
 if(q('[data-imsave]'))q('[data-imsave]').onclick=function(){
   var b=q('[data-imsave]'),x=(IMQ.soc||[])[0];
   if(!x)return;
   var v=function(id){var e=q('#'+id);return (e&&e.value!=='')?e.value:null;};
   b.disabled=true;b.textContent='Guardando...';
   rpc('guardar_impuesto_sociedades',{p_usuario:S.us.id,p_ejercicio:x.ejercicio,p_datos:{
     amortizacion_estimada:v('is_amo'),ajustes_positivos:v('is_ap'),ajustes_negativos:v('is_an'),
     bases_negativas:v('is_bin'),tipo:v('is_tipo'),pagos_fraccionados:v('is_pf'),
     retenciones_soportadas:v('is_ret'),notas:(q('#is_notas')||{}).value||''}})
    .then(function(){toast('Estimacion guardada');IMQ.ed=false;IMQ.m111=null;cargaImp(true);},
          function(e){b.disabled=false;b.textContent='Guardar';toast(e.message||'No se pudo guardar');});};
}

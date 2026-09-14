/* ===== Personal: avisos, plantilla y nominas ===== */
var PE={ld:false,er:null,ts:0,subiendo:false,emp:null,nom:null,res:null,ocr:null,av:null,avr:null,pp:null};
var PQ={mes:'',txt:'',avf:''};

function cargaPer(force){
 if(PE.ld)return;
 if(!force&&PE.emp&&(Date.now()-PE.ts)<120000)return;
 PE.ld=true;PE.er=null;
 Promise.all([
  rest('v_empleados?select=*&order=nombre'),
  rest('v_nominas?select=*&order=periodo.desc,empleado'),
  rest('v_nominas_resumen?select=*&order=periodo.desc'),
  rest('nominas_ocr?select=*&estado=eq.pendiente&order=created_at.desc'),
  rest('v_avisos?select=*&order=fecha'),
  rest('v_avisos_resumen?select=*'),
  rest('v_panel_personal?select=*')
 ]).then(function(a){
  PE.emp=a[0]||[];PE.nom=a[1]||[];PE.res=a[2]||[];PE.ocr=a[3]||[];
  PE.av=a[4]||[];PE.avr=(a[5]&&a[5][0])||{};PE.pp=(a[6]&&a[6][0])||{};
  PE.ts=Date.now();PE.ld=false;
  if(!PQ.mes&&PE.res.length)PQ.mes=PE.res[0].mes;
  render();
 }).catch(function(e){PE.ld=false;PE.er=e.message||'No se pudieron cargar los datos';render();});
}
function perEspera(t){
 if(PE.er)return '<div class="c"><div class="ch"><h2>'+t+'</h2><button class="ac" data-peref>Reintentar</button></div><div class="emp"><h3>No se pudieron cargar los datos</h3><p>'+es(PE.er)+'</p></div></div>';
 return '<div class="c"><div class="ch"><h2>'+t+'</h2></div><div class="emp"><h3>Cargando...</h3><p>Un momento.</p></div></div>';
}
function perColor(u){return u==='caducado'?'var(--red)':(u==='urgente'?'var(--warn)':'var(--body)');}
function perDias(d){
 var n=Number(d);
 if(isNaN(n))return '';
 if(n<0)return 'hace '+Math.abs(n)+' d';
 if(n===0)return 'hoy';
 return 'en '+n+' d';
}

VX.avisos=function(){
 if(!PE.emp&&!PE.er){cargaPer(false);}
 if(!PE.emp)return perEspera('Avisos y vencimientos');
 var r=PE.avr||{};
 var f=PQ.avf;
 var lista=(PE.av||[]).filter(function(x){
  if(f==='caducado')return x.urgencia==='caducado';
  if(f==='Prestamo'||f==='Personal'||f==='Vehiculo')return x.ambito===f&&x.urgencia!=='lejano';
  if(f==='todo')return true;
  return x.urgencia!=='lejano';});
 var bt=function(k,t){return '<button class="ac'+(f===k?' on':'')+'" data-avf="'+k+'" style="margin-left:6px">'+t+'</button>';};
 var h='<div class="c"><div class="ch"><h2>Todo lo que vence</h2><div>'
  +bt('','Lo que corre prisa')+bt('caducado','Ya caducado')+bt('Vehiculo','Vehiculos')
  +bt('Personal','Personal')+bt('Prestamo','Cuotas')+bt('todo','Todo')
  +'<button class="ac" data-peref style="margin-left:6px">Actualizar</button></div></div>'
  +'<div class="kp" style="margin:16px 0">'
  +'<div class="k hero"><div class="l">Ya caducado</div><div class="v">'+(r.caducados||0)+'</div><div class="s">hay que resolverlo ya</div></div>'
  +'<div class="k"><div class="l">Vence en 15 dias</div><div class="v">'+(r.urgentes||0)+'</div><div class="s">'+(r.proximos||0)+' mas en 45 dias</div></div>'
  +'<div class="k"><div class="l">Cuotas de prestamo</div><div class="v">'+eu2(r.cuotas_30dias||0)+'</div><div class="s">a pagar en 30 dias</div></div>'
  +'<div class="k"><div class="l">Personal</div><div class="v">'+(r.personal||0)+'</div><div class="s">carnets, CAP y nominas</div></div>'
  +'</div>';
 if(!lista.length)return h+'<div class="emp"><h3>Nada pendiente</h3><p>No hay vencimientos en ese filtro.</p></div></div>';
 h+='<div class="tw"><table><thead><tr><th>Ambito</th><th>Que vence</th><th>De quien</th><th>Fecha</th><th class="r">Cuando</th><th class="r">Importe</th></tr></thead><tbody>';
 for(var i=0;i<lista.length;i++){
  var x=lista[i];
  h+='<tr><td>'+es(x.ambito||'')+'</td><td>'+es(x.clase||'')+'</td>'
   +'<td><b>'+es(x.referencia||'')+'</b><div style="color:var(--mute);font-size:12px">'+es(x.descripcion||'')+'</div></td>'
   +'<td class="nu">'+fc(x.fecha)+'</td>'
   +'<td class="r nu" style="color:'+perColor(x.urgencia)+';font-weight:600">'+perDias(x.dias)+'</td>'
   +'<td class="r nu">'+(x.importe!=null?eu2(x.importe):'')+'</td></tr>';
 }
 return h+'</tbody></table></div></div>';
};

VX.personal=function(){
 if(!PE.emp&&!PE.er){cargaPer(false);}
 if(!PE.emp)return perEspera('Plantilla');
 var p=PE.pp||{};
 var t=PQ.txt.toLowerCase();
 var lista=PE.emp.filter(function(x){
  if(!t)return true;
  return ((x.nombre||'')+' '+(x.dni||'')+' '+(x.categoria||'')).toLowerCase().indexOf(t)>=0;});
 var h='<div class="c"><div class="ch"><h2>Plantilla</h2><div>'
  +'<input id="pq_txt" placeholder="Buscar trabajador" value="'+es(PQ.txt)+'" style="max-width:220px">'
  +'<button class="ac" data-peref style="margin-left:6px">Actualizar</button></div></div>'
  +'<div class="kp" style="margin:16px 0">'
  +'<div class="k hero"><div class="l">En plantilla</div><div class="v">'+(p.en_plantilla||0)+'</div><div class="s">trabajadores de alta</div></div>'
  +'<div class="k"><div class="l">Coste de personal</div><div class="v">'+eu2(p.coste_personal_anio||0)+'</div><div class="s">en lo que va de ano</div></div>'
  +'<div class="k"><div class="l">IRPF retenido</div><div class="v">'+eu2(p.irpf_anio||0)+'</div><div class="s">para el modelo 111</div></div>'
  +'<div class="k"><div class="l">Avisos de personal</div><div class="v">'+(p.avisos_personal||0)+'</div><div class="s">carnets y CAP por caducar</div></div>'
  +'</div>';
 if(!lista.length)return h+'<div class="emp"><h3>Sin trabajadores</h3><p>La plantilla se rellena sola al confirmar las nominas del escaner.</p></div></div>';
 h+='<div class="tw"><table><thead><tr><th>Trabajador</th><th>DNI</th><th>Categoria</th><th class="r">Antiguedad</th><th>Situacion</th><th class="r">Proximo vencimiento</th><th class="r">Devengado ano</th><th class="r">Coste ano</th></tr></thead><tbody>';
 for(var i=0;i<lista.length;i++){
  var x=lista[i];
  var dv=x.proximo_vencimiento?Math.round((new Date(x.proximo_vencimiento)-new Date())/86400000):null;
  var co=(Number(x.devengado_anio)||0)+(Number(x.ss_empresa_anio)||0);
  h+='<tr><td><b>'+es(x.nombre||'')+'</b></td><td class="nu">'+es(x.dni||'')+'</td>'
   +'<td>'+es(x.categoria||'')+'</td><td class="r nu">'+(x.antiguedad?fc(x.antiguedad):'')+'</td>'
   +'<td>'+es(x.situacion||'')+'</td>'
   +'<td class="r nu"'+(dv!=null&&dv<45?' style="color:'+(dv<0?'var(--red)':'var(--warn)')+';font-weight:600"':'')+'>'
     +(x.proximo_vencimiento?fc(x.proximo_vencimiento):'-')+'</td>'
   +'<td class="r nu">'+eu2(x.devengado_anio||0)+'</td><td class="r nu">'+eu2(co)+'</td></tr>';
 }
 return h+'</tbody></table></div></div>';
};

VX.nominas=function(){
 if(!PE.emp&&!PE.er){cargaPer(false);}
 if(!PE.emp)return perEspera('Nominas');
 var res=PE.res||[],mes=PQ.mes||(res.length?res[0].mes:'');
 var r=null;for(var i=0;i<res.length;i++){if(res[i].mes===mes){r=res[i];break;}}
 var sel='<select id="pq_mes">';
 for(var i2=0;i2<res.length;i2++){sel+='<option value="'+res[i2].mes+'"'+(res[i2].mes===mes?' selected':'')+'>'+res[i2].mes+'</option>';}
 sel+='</select>';
 if(!res.length)sel='<span style="color:var(--mute)">sin nominas todavia</span>';

 var h='<div class="c"><div class="ch"><h2>Nominas</h2><div>'+sel
  +'<button class="ac" data-peref style="margin-left:6px">Actualizar</button></div></div>';

 h+='<div class="fg" style="margin:12px 0;grid-template-columns:2fr 1fr;gap:9px;align-items:end">'
  +'<div class="fi"><label>Subir el PDF de nominas del mes</label>'
  +'<input id="nom_f" type="file" accept="application/pdf" multiple></div>'
  +'<div class="fi"><button class="addb" data-nomsub'+(PE.subiendo?" disabled":"")+'>'+(PE.subiendo?'Subiendo...':'Leer nominas')+'</button></div></div>'
  +'<div class="note">Sube el PDF original que manda la asesoria, con una nomina por pagina. El programa lo lee sin IA, directamente del texto del PDF, y comprueba que devengos menos deducciones da el liquido de cada recibo.</div>';

 var oc=PE.ocr||[];
 if(oc.length){
  h+='<div class="ch" style="margin-top:18px"><h2>Pendientes de revisar ('+oc.length+')</h2></div>'
   +'<div class="tw"><table><thead><tr><th>Trabajador</th><th>Periodo</th><th class="r">Devengado</th><th class="r">IRPF</th><th class="r">Liquido</th><th>Avisos</th><th></th></tr></thead><tbody>';
  for(var j=0;j<oc.length;j++){
   var o=oc[j];
   h+='<tr><td><b>'+es(o.empleado_detectado||'?')+'</b><div style="color:var(--mute);font-size:12px">'+es(o.dni_detectado||'')+'</div></td>'
    +'<td class="nu">'+es(String(o.periodo||'').slice(0,7))+'</td>'
    +'<td class="r nu">'+eu2(o.total_devengado||0)+'</td><td class="r nu">'+eu2(o.irpf||0)+'</td>'
    +'<td class="r nu">'+eu2(o.liquido||0)+'</td>'
    +'<td style="color:'+(o.avisos?'var(--warn)':'var(--mute)')+';font-size:12px">'+es(o.avisos||'todo cuadra')
      +(o.duplicado_id?' · <b style="color:var(--red)">ya esta dada de alta</b>':'')+'</td>'
    +'<td class="r"><button class="ms" data-nomok="'+es(o.id)+'"'+(S.bz?' disabled':'')+'>Dar de alta</button> '
      +'<button class="mc" data-nomno="'+es(o.id)+'"'+(S.bz?' disabled':'')+'>Descartar</button></td></tr>';
  }
  h+='</tbody></table></div>';
 }

 if(!r)return h+'<div class="emp" style="margin-top:18px"><h3>Sin nominas en ese mes</h3><p>Sube el PDF de arriba para darlas de alta.</p></div></div>';

 h+='<div class="kp" style="margin:18px 0">'
  +'<div class="k hero"><div class="l">Coste de empresa</div><div class="v">'+eu2(r.coste_empresa||0)+'</div><div class="s">'+(r.n_trabajadores||0)+' trabajadores en '+es(mes)+'</div></div>'
  +'<div class="k"><div class="l">Devengado</div><div class="v">'+eu2(r.devengado||0)+'</div><div class="s">salarios brutos</div></div>'
  +'<div class="k"><div class="l">Seguridad Social</div><div class="v">'+eu2(r.ss_a_pagar||0)+'</div><div class="s">empresa '+eu2(r.ss_empresa||0)+' + trabajador '+eu2(r.ss_trabajador||0)+'</div></div>'
  +'<div class="k"><div class="l">IRPF retenido</div><div class="v">'+eu2(r.irpf||0)+'</div><div class="s">a ingresar en el 111</div></div>'
  +'<div class="k"><div class="l">Liquido a pagar</div><div class="v">'+eu2(r.liquido||0)+'</div><div class="s">'+(r.n_pagadas||0)+' de '+(r.n_nominas||0)+' ya pagadas</div></div>'
  +'<div class="k"><div class="l">Pendiente de pago</div><div class="v">'+eu2(r.pendiente_pago||0)+'</div><div class="s">'+(r.asiento?'asiento n '+r.asiento:'sin asiento')+'</div></div>'
  +'</div>';

 h+='<div style="margin:12px 0">'
  +(r.asiento?'<span style="color:var(--ok)">Contabilizado en el asiento '+r.asiento+'</span>'
             :'<button class="addb" data-nomas="'+es(mes)+'"'+(S.bz?' disabled':'')+'>Generar el asiento del mes</button>')
  +'<button class="ac" data-nomcon style="margin-left:8px"'+(S.bz?' disabled':'')+'>Conciliar los pagos con el banco</button>'
  +'</div>';

 if(r.rlc_total!=null){
  h+='<div class="note" style="margin-bottom:12px">Recibo de la Seguridad Social del mes: '+eu2(r.rlc_total)
   +(Math.abs(Number(r.diferencia_rlc)||0)>0.02?' · <b style="color:var(--warn)">no cuadra con las nominas por '+eu2(r.diferencia_rlc)+'</b>':' · cuadra con las nominas')+'</div>';
 }

 var nm=(PE.nom||[]).filter(function(x){return x.mes===mes;});
 h+='<div class="tw"><table><thead><tr><th>Trabajador</th><th>Periodo</th><th class="r">Devengado</th><th class="r">SS trab.</th><th class="r">IRPF</th><th class="r">Liquido</th><th class="r">SS empresa</th><th class="r">Coste</th><th>Estado</th></tr></thead><tbody>';
 for(var k=0;k<nm.length;k++){
  var x=nm[k];
  h+='<tr><td><b>'+es(x.empleado||'')+'</b><div style="color:var(--mute);font-size:12px">'+es(x.categoria||'')+'</div></td>'
   +'<td class="nu">'+(x.fecha_inicio?fc(x.fecha_inicio)+' a '+fc(x.fecha_fin):es(x.mes))+'</td>'
   +'<td class="r nu">'+eu2(x.total_devengado||0)+'</td><td class="r nu">'+eu2(x.ss_trabajador||0)+'</td>'
   +'<td class="r nu">'+eu2(x.irpf||0)+(x.tipo_irpf?' <span style="color:var(--mute)">('+x.tipo_irpf+'%)</span>':'')+'</td>'
   +'<td class="r nu"><b>'+eu2(x.liquido||0)+'</b></td>'
   +'<td class="r nu">'+eu2(x.ss_empresa||0)+'</td><td class="r nu">'+eu2(x.coste_empresa||0)+'</td>'
   +'<td>'+(x.estado==='pagada'?'<span style="color:var(--ok)">pagada '+(x.fecha_pago?fc(x.fecha_pago):'')+'</span>':'<span style="color:var(--warn)">pendiente</span>')+'</td></tr>';
 }
 h+='<tr class="tot"><td colspan="2" class="r">Total '+es(mes)+'</td><td class="r nu">'+eu2(r.devengado||0)+'</td>'
  +'<td class="r nu">'+eu2(r.ss_trabajador||0)+'</td><td class="r nu">'+eu2(r.irpf||0)+'</td>'
  +'<td class="r nu">'+eu2(r.liquido||0)+'</td><td class="r nu">'+eu2(r.ss_empresa||0)+'</td>'
  +'<td class="r nu">'+eu2(r.coste_empresa||0)+'</td><td></td></tr>';
 return h+'</tbody></table></div></div>';
};

function bindPersonal(){
 if(q('[data-peref]'))q('[data-peref]').onclick=function(){PE.emp=null;PE.er=null;cargaPer(true);};
 document.querySelectorAll('[data-avf]').forEach(function(b){b.onclick=function(){PQ.avf=b.getAttribute('data-avf');render();};});
 if(q('#pq_mes'))q('#pq_mes').onchange=function(){PQ.mes=q('#pq_mes').value;render();};
 if(q('#pq_txt')){var pt=q('#pq_txt');pt.oninput=function(){PQ.txt=pt.value;};
   pt.onkeydown=function(ev){if(ev.key==='Enter'){PQ.txt=pt.value;render();}};}

 if(q('[data-nomsub]'))q('[data-nomsub]').onclick=function(){
  var inp=q('#nom_f');
  if(!inp||!inp.files||!inp.files.length){toast('Elige el PDF de las nominas');return;}
  var files=[].slice.call(inp.files);
  var tam=0;for(var z=0;z<files.length;z++){tam+=files[z].size;}
  if(tam>13000000){toast('El envio es demasiado grande ('+Math.round(tam/1048576)+' MB). Subelo en dos tandas.');return;}
  var fd=new FormData();fd.append('token',S.tk);
  for(var i=0;i<files.length;i++){fd.append('orig'+i,files[i],files[i].name);}
  PE.subiendo=true;render();
  auth().then(function(){ try{fd.set('token',S.tk);}catch(e2){fd.append('token',S.tk);}
    return fetch(N8+'/araya/nomina-lote',{method:'POST',body:fd}); })
   .then(function(rp){ if(rp.status===401){salir();throw new Error('Sesion caducada. Vuelve a entrar.');} return rp.json(); })
   .then(function(j){ PE.subiendo=false;
     if(!j.ok)throw new Error(j.error||'No se pudo subir el PDF');
     toast('Nominas enviadas. En unos segundos apareceran abajo para revisarlas.');
     render(); setTimeout(function(){PE.emp=null;cargaPer(true);},6000); })
   .catch(function(e){ PE.subiendo=false; toast(e.message); render(); });};

 document.querySelectorAll('[data-nomok]').forEach(function(b){b.onclick=function(){
   S.bz=true;render();
   rpc('confirmar_nomina_ocr',{p_usuario:S.us.id,p_ocr:b.getAttribute('data-nomok')})
    .then(function(){toast('Nomina dada de alta');S.bz=false;PE.emp=null;cargaPer(true);})
    .catch(function(e){S.bz=false;toast(e.message);render();});};});

 document.querySelectorAll('[data-nomno]').forEach(function(b){b.onclick=function(){
   S.bz=true;render();
   rpc('descartar_nomina_ocr',{p_usuario:S.us.id,p_ocr:b.getAttribute('data-nomno')})
    .then(function(){toast('Descartada');S.bz=false;PE.emp=null;cargaPer(true);})
    .catch(function(e){S.bz=false;toast(e.message);render();});};});

 if(q('[data-nomas]'))q('[data-nomas]').onclick=function(){
   var mes=q('[data-nomas]').getAttribute('data-nomas');
   S.bz=true;render();
   rpc('generar_asiento_nomina',{p_periodo:mes+'-01',p_usuario:S.us.id,p_rehacer:false})
    .then(function(){toast('Asiento de nominas generado');S.bz=false;S.d=null;PE.emp=null;render();})
    .catch(function(e){S.bz=false;toast(e.message);render();});};

 if(q('[data-nomcon]'))q('[data-nomcon]').onclick=function(){
   S.bz=true;render();
   rpc('conciliar_nominas_automatico',{p_usuario:S.us.id,p_periodo:PQ.mes?PQ.mes+'-01':null})
    .then(function(j){
      var n=(j&&j.conciliadas)||0,dd=(j&&j.con_dudas)||0;
      toast(n?('Conciliadas '+n+' nominas'+(dd?', '+dd+' con dudas: resuelvelas en Banco':'')):'No habia ningun pago de nomina claro que conciliar');
      S.bz=false;S.d=null;PE.emp=null;render();})
    .catch(function(e){S.bz=false;toast(e.message);render();});};
}

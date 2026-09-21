/* ===== Araya - Albaran de servicio v02.22: cliente y obra, dos tipos,
   paradas del viaje y firmas. Encargo de Jennifer del 21/09/2026. ===== */
(function(){
MDX.nalb=function(){
 var cs=(S.d.cl||[]).filter(function(z){return z.activo!==false;});
 var H=ALB.h||{},L=ALB.l||[],P=ALB.p||[],ler=S.d.ler||[],srv=S.d.srv||[],tc=_srvCarga();
 var tipo=H.tipo||'traslado';
 var esHoras=(tipo==='horas');
 var dirs=(S.d.dirs||[]).filter(function(d){return d.cliente_id===H.cli;});
 var emp=ALB.emp||[];
 var bt=function(k,t){return '<button class="ac'+(tipo===k?' on':'')+'" data-atipo="'+k+'" style="margin-right:6px">'+t+'</button>';};

 var h='<div class="ov" data-ov><div class="md" style="max-width:800px"><h3>Nuevo albaran</h3>'
  +'<div class="s">Servicio realizado - el numero se genera solo</div>'
  +(cs.length?'':'<div class="note">Primero da de alta un cliente en la seccion Clientes.</div>')
  +'<div style="margin-top:12px">'+bt('traslado','Traslado (DeCA)')+bt('horas','Horas de trabajo')+'</div>'
  +'<div class="mi">'+(esHoras
     ?'Horas de un empleado en una obra. No lleva DeCA ni paradas.'
     :'Servicio de transporte. Lleva DeCA, y puede tener varias paradas.')+'</div>';

 /* --- cliente y obra --- */
 h+='<div class="fg" style="margin-top:14px">'
  +'<div class="fi"><label>Cliente <span style="color:var(--red)">*</span></label>'
  +'<input id="a_cbus" placeholder="Escribe para buscar entre '+cs.length+' clientes" style="margin-bottom:6px">'
  +'<select id="a_cli"><option value="">- elegir cliente -</option>'
  +cs.map(function(z){return '<option value="'+es(z.id)+'"'+(H.cli===z.id?' selected':'')+'>'+es(z.nombre)+'</option>';}).join('')
  +'</select></div>'
  +'<div class="fi"><label>Fecha</label><input id="a_fec" type="date" value="'+es(H.fec||_hoy())+'"></div>'
  +'<div class="fi"><label>Obra</label>';
 if(!H.cli){
  h+='<select id="a_obr_sel" disabled><option>- elige antes el cliente -</option></select>';
 }else{
  h+='<select id="a_obr_sel"><option value="">- sin obra -</option>'
   +dirs.map(function(d){var n=d.nombre||d.direccion||'';
      return '<option value="'+es(n)+'" data-did="'+es(d.id)+'"'+(H.obr===n?' selected':'')+'>'+es(n)+(d.poblacion?' - '+es(d.poblacion):'')+'</option>';}).join('')
   +(H.obr&&!dirs.some(function(d){return (d.nombre||d.direccion||'')===H.obr;})?'<option value="'+es(H.obr)+'" selected>'+es(H.obr)+'</option>':'')
   +'<option value="__nueva__">+ Nueva obra...</option></select>';
 }
 h+='</div>'
  +'<div class="fi"><label>Direccion del servicio</label><input id="a_dir" value="'+es(H.dir||'')+'" placeholder="Obra, calle, poligono" list="a_dirs"><datalist id="a_dirs">'
  +dirs.map(function(d){return '<option value="'+es(d.direccion||d.nombre||'')+'">';}).join('')+'</datalist></div>';

 if(esHoras){
  h+='<div class="fi"><label>Empleado <span style="color:var(--red)">*</span></label><select id="a_emp"><option value="">- elegir -</option>'
   +emp.map(function(e){return '<option value="'+es(e.id)+'"'+(H.emp===e.id?' selected':'')+'>'+es(e.nombre)+'</option>';}).join('')
   +'</select></div>'
   +'<div class="fi"><label>Horas trabajadas</label><input id="a_hrs" type="number" step="0.25" value="'+es(H.hrs==null?'':H.hrs)+'"></div>';
 }else{
  h+='<div class="fi"><label>Origen <span style="color:var(--red)">*</span></label><input id="a_ori" value="'+es(H.ori||'')+'" placeholder="Cargadero, obra, planta, deposito"></div>'
   +'<div class="fi"><label>Destino <span style="color:var(--red)">*</span></label><input id="a_dst" value="'+es(H.dst||'')+'" placeholder="Obra, vertedero, gestor autorizado"></div>';
 }
 h+='<div class="fi"><label>Matricula</label><select id="a_mat"><option value="">- elegir -</option>'
  +(S.d.veh||[]).filter(function(v){return v.activo!==false;}).map(function(v){return '<option value="'+es(v.matricula)+'"'+(H.mat===v.matricula?' selected':'')+'>'+es(v.matricula)+' - '+es(v.descripcion||'')+'</option>';}).join('')+'</select></div>'
  +(esHoras?'':'<div class="fi"><label>Remolque</label><input id="a_rem" value="'+es(H.rem||'')+'" placeholder="Matricula del remolque, si lleva"></div>')
  +'<div class="fi"><label>Conductor</label><input id="a_con" value="'+es(H.con||'')+'"></div>'
  +(esHoras?'':'<div class="fi"><label>Autorizacion especial</label><input id="a_aut" value="'+es(H.aut||'')+'" placeholder="N autorizacion residuos / transporte especial"></div>')
  +'<div class="fi"><label>Estado</label><select id="a_est">'
  +['entregado','pendiente'].map(function(x){return '<option value="'+x+'"'+((H.est||'entregado')===x?' selected':'')+'>'+cp(x)+'</option>';}).join('')+'</select></div></div>';

 /* --- mercancia (solo traslado) --- */
 if(!esHoras){
  h+='<div style="margin-top:18px"><label>Datos de la mercancia</label>'
   +'<div class="fg" style="margin-top:8px"><div class="fi"><label>Tipo de carga</label><select id="a_tc"><option value="">- elegir -</option>'
   +tc.map(function(s){return '<option value="'+es(s.nombre)+'" data-ti="'+(s.tipo_igic!=null?s.tipo_igic:'')+'" data-pre="'+(s.precio_venta!=null?s.precio_venta:'')+'" data-sid="'+es(s.id)+'"'+(H.tc===s.nombre?' selected':'')+'>'+es(s.nombre)+'</option>';}).join('')+'</select></div>'
   +'<div class="fi"><label>Codigo LER (solo residuos)</label><select id="a_ler"><option value="">-</option>'
   +ler.map(function(l){return '<option value="'+es(l.codigo)+'"'+(H.ler===l.codigo?' selected':'')+'>'+es(l.codigo)+' - '+es(l.descripcion)+'</option>';}).join('')+'</select></div>'
   +'<div class="fi"><label>Mercancia / detalle</label><input id="a_mer" value="'+es(H.mer||'')+'" placeholder="Escombro, madera, agua potable..."></div>'
   +'<div class="fi"><label>Peso (t)</label><input id="a_pes" type="number" step="0.01" value="'+es(H.pes==null?'':H.pes)+'"></div></div>'
   +'<div class="mi">El agua potable no lleva IGIC: al elegir una cuba el tipo se pone a 0% y puedes cambiarlo linea a linea.</div></div>';

  /* --- paradas del viaje --- */
  h+='<div style="margin-top:18px"><label>Paradas del viaje</label>'
   +'<div class="mi">Dejalo vacio si el viaje es de un origen a un destino y ya esta. Si el camion hace varias recogidas o entregas en la misma salida, anotalas aqui en orden: saldran todas en el DeCA.</div>';
  if(P.length){
   h+=P.map(function(x,i){return '<div class="fg" style="margin-top:9px;grid-template-columns:0.9fr 1.6fr 1.4fr 0.8fr 0.8fr 0.4fr;gap:9px">'
     +'<div class="fi"><select class="p_tip" data-i="'+i+'">'
       +['recogida','entrega','parada'].map(function(t){return '<option value="'+t+'"'+((x.tipo||'recogida')===t?' selected':'')+'>'+cp(t)+'</option>';}).join('')+'</select></div>'
     +'<div class="fi"><input class="p_lug" data-i="'+i+'" value="'+es(x.lugar||'')+'" placeholder="Lugar de la parada"></div>'
     +'<div class="fi"><input class="p_mer" data-i="'+i+'" value="'+es(x.mer||'')+'" placeholder="Que se carga o descarga"></div>'
     +'<div class="fi"><input class="p_pes" data-i="'+i+'" type="number" step="0.01" value="'+es(x.peso==null?'':x.peso)+'" placeholder="Peso (t)"></div>'
     +'<div class="fi"><input class="p_hor" data-i="'+i+'" type="time" value="'+es(x.hora||'')+'"></div>'
     +'<div class="fi"><button class="ed" data-delp="'+i+'" title="Quitar esta parada">x</button></div></div>';}).join('');
  }
  h+='<button class="ed" style="margin-top:11px;margin-left:0" data-addp>+ Anadir parada</button></div>';
 }

 /* --- lineas --- */
 h+='<div style="margin-top:18px"><label>Lineas del servicio</label>'
  +L.map(function(x,i){return '<div class="fg" style="margin-top:9px;grid-template-columns:2fr 1fr 1fr 0.7fr;gap:9px">'
   +'<div class="fi"><select class="a_sid" data-i="'+i+'"><option value="">- concepto libre -</option>'
    +srv.map(function(z){return '<option value="'+es(z.id)+'" data-nom="'+es(z.nombre)+'" data-pre="'+(z.precio_venta!=null?z.precio_venta:'')+'" data-ti="'+(z.tipo_igic!=null?z.tipo_igic:'')+'"'+(x.sid===z.id?' selected':'')+'>'+es(z.nombre)+'</option>';}).join('')+'</select>'
   +'<input class="a_des" data-i="'+i+'" value="'+es(x.d||'')+'" placeholder="Descripcion del servicio" style="margin-top:6px"></div>'
   +'<div class="fi"><input class="a_can" data-i="'+i+'" type="number" step="0.01" value="'+es(x.c==null?'':x.c)+'" placeholder="Cantidad"></div>'
   +'<div class="fi"><input class="a_pre" data-i="'+i+'" type="number" step="0.01" value="'+es(x.p==null?'':x.p)+'" placeholder="Precio ud"></div>'
   +'<div class="fi">'+_selIGIC('a_ti',i,x.ti)+'</div></div>';}).join('')
  +'<button class="ed" style="margin-top:11px;margin-left:0" data-addl>+ Anadir linea</button>'
  +'<div class="mi" id="a_tot"></div></div>';

 /* --- firmas --- */
 h+='<div style="margin-top:18px"><label>Firmas</label>'
  +'<div class="mi">El DeCA tiene que ir firmado por el cliente y por el conductor. Pon aqui quien firma cada parte; si aun no ha firmado, dejalo en blanco y se completa luego desde la ficha del albaran.</div>'
  +'<div class="fg" style="margin-top:8px">'
  +'<div class="fi"><label>Firma del cliente (nombre)</label><input id="a_fcn" value="'+es(H.fcn||'')+'" placeholder="Quien firma por el cliente"></div>'
  +'<div class="fi"><label>Firma del conductor (nombre)</label><input id="a_fkn" value="'+es(H.fkn||H.con||'')+'" placeholder="Quien conduce y firma"></div>'
  +'</div></div>'
  +'<div class="fg" style="margin-top:14px"><div class="fi"><label>Notas</label><input id="a_not" value="'+es(H.not||'')+'"></div></div>'
  +'<div class="mb"><button class="mc" data-cn>Cancelar</button><button class="ms" data-galb'+((S.bz||!cs.length)?' disabled':'')+'>'+(S.bz?'Guardando...':'Guardar albaran')+'</button></div></div></div>';
 return h;
};

albLee=function(){if(!ALB.h)ALB.h={};
 if(q('#a_cli'))ALB.h.cli=q('#a_cli').value;
 if(q('#a_fec'))ALB.h.fec=q('#a_fec').value;
 if(q('#a_dir'))ALB.h.dir=q('#a_dir').value;
 if(q('#a_obr_sel'))ALB.h.obr=q('#a_obr_sel').value==='__nueva__'?(ALB.h.obr||''):q('#a_obr_sel').value;
 if(q('#a_ori'))ALB.h.ori=q('#a_ori').value;
 if(q('#a_dst'))ALB.h.dst=q('#a_dst').value;
 if(q('#a_tc'))ALB.h.tc=q('#a_tc').value;
 if(q('#a_ler'))ALB.h.ler=q('#a_ler').value;
 if(q('#a_mer'))ALB.h.mer=q('#a_mer').value;
 if(q('#a_pes'))ALB.h.pes=q('#a_pes').value;
 if(q('#a_mat'))ALB.h.mat=q('#a_mat').value;
 if(q('#a_con'))ALB.h.con=q('#a_con').value;
 if(q('#a_est'))ALB.h.est=q('#a_est').value;
 if(q('#a_rem'))ALB.h.rem=q('#a_rem').value;
 if(q('#a_aut'))ALB.h.aut=q('#a_aut').value;
 if(q('#a_not'))ALB.h.not=q('#a_not').value;
 if(q('#a_emp'))ALB.h.emp=q('#a_emp').value;
 if(q('#a_hrs'))ALB.h.hrs=q('#a_hrs').value;
 if(q('#a_fcn'))ALB.h.fcn=q('#a_fcn').value;
 if(q('#a_fkn'))ALB.h.fkn=q('#a_fkn').value;
 if(!ALB.p)ALB.p=[];
 document.querySelectorAll('.p_tip').forEach(function(e){var i=+e.getAttribute('data-i');if(ALB.p[i])ALB.p[i].tipo=e.value;});
 document.querySelectorAll('.p_lug').forEach(function(e){var i=+e.getAttribute('data-i');if(ALB.p[i])ALB.p[i].lugar=e.value;});
 document.querySelectorAll('.p_mer').forEach(function(e){var i=+e.getAttribute('data-i');if(ALB.p[i])ALB.p[i].mer=e.value;});
 document.querySelectorAll('.p_pes').forEach(function(e){var i=+e.getAttribute('data-i');if(ALB.p[i])ALB.p[i].peso=e.value;});
 document.querySelectorAll('.p_hor').forEach(function(e){var i=+e.getAttribute('data-i');if(ALB.p[i])ALB.p[i].hora=e.value;});
 document.querySelectorAll('.a_sid').forEach(function(e){var i=+e.getAttribute('data-i');if(ALB.l[i])ALB.l[i].sid=e.value;});
 document.querySelectorAll('.a_mid').forEach(function(e){var i=+e.getAttribute('data-i');if(ALB.l[i])ALB.l[i].mid=e.value;});
 document.querySelectorAll('.a_des').forEach(function(e){var i=+e.getAttribute('data-i');if(ALB.l[i])ALB.l[i].d=e.value;});
 document.querySelectorAll('.a_can').forEach(function(e){var i=+e.getAttribute('data-i');if(ALB.l[i])ALB.l[i].c=e.value;});
 document.querySelectorAll('.a_pre').forEach(function(e){var i=+e.getAttribute('data-i');if(ALB.l[i])ALB.l[i].p=e.value;});
 document.querySelectorAll('.a_ti').forEach(function(e){var i=+e.getAttribute('data-i');if(ALB.l[i])ALB.l[i].ti=e.value;});};

/* Los empleados solo hacen falta en el albaran de horas: se piden una vez. */
function albEmpleados(){
 if(ALB.emp||ALB.empCargando)return;
 ALB.empCargando=true;
 rest('empleados?select=id,nombre&activo=eq.true&order=nombre')
  .then(function(r){ALB.emp=r||[];ALB.empCargando=false;if(S.md&&S.md.t==='nalb')render();})
  .catch(function(){ALB.emp=[];ALB.empCargando=false;});
}

/* Los enganches propios del alta de albaran. Se llaman desde el bind general. */
function albBind(){
 if(!(S.md&&S.md.t==='nalb'))return;
 var bus=q('#a_cbus');
 if(bus){
  bus.value=ALB.cbus||'';
  bus.oninput=function(){
   ALB.cbus=bus.value;
   var t=bus.value.toLowerCase().trim(), sel=q('#a_cli');
   if(!sel)return;
   for(var i=0;i<sel.options.length;i++){
    var o=sel.options[i];
    o.hidden = !!t && i>0 && o.text.toLowerCase().indexOf(t)<0;
   }
  };
  if(ALB.cbus)bus.oninput();
 }
 document.querySelectorAll('[data-atipo]').forEach(function(b){
  b.onclick=function(){albLee();ALB.h.tipo=b.getAttribute('data-atipo');
   if(ALB.h.tipo==='horas')albEmpleados();
   render();};
 });
 if(q('#a_cli'))q('#a_cli').onchange=function(){albLee();ALB.h.obr='';render();};
 if(q('#a_obr_sel'))q('#a_obr_sel').onchange=function(){
  var v=q('#a_obr_sel').value;
  if(v!=='__nueva__'){albLee();return;}
  albLee();
  var nom=prompt('Nombre de la obra nueva');
  if(!nom||!nom.trim()){ALB.h.obr='';render();return;}
  var dir=prompt('Direccion de la obra (puedes dejarlo en blanco)')||'';
  S.bz=true;render();
  postR('cliente_direcciones',{cliente_id:ALB.h.cli,nombre:nom.trim(),direccion:dir.trim()||null,tipo:'obra',activo:true})
   .then(function(r){
     var d=r&&r[0];
     if(d){(S.d.dirs=S.d.dirs||[]).push(d);ALB.h.obr=d.nombre;if(!ALB.h.dir)ALB.h.dir=d.direccion||'';}
     toast('Obra creada');S.bz=false;render();})
   .catch(function(e){S.bz=false;toast(e.message);render();});
 };
 if(q('[data-addp]'))q('[data-addp]').onclick=function(){
  albLee();ALB.p=ALB.p||[];
  ALB.p.push({tipo:ALB.p.length?'entrega':'recogida',lugar:'',mer:'',peso:'',hora:''});
  render();};
 document.querySelectorAll('[data-delp]').forEach(function(b){
  b.onclick=function(){albLee();ALB.p.splice(+b.getAttribute('data-delp'),1);render();};});
}

/* Guardar: cabecera, lineas y paradas. */
function albGuardar(){
 albLee();
 var H=ALB.h||{}, esHoras=(H.tipo||'traslado')==='horas';
 var ls=(ALB.l||[]).filter(function(x){return (parseFloat(x.c)||0)>0&&((x.d&&x.d.trim())||x.sid||x.mid);});
 var ps=(ALB.p||[]).filter(function(x){return x.lugar&&x.lugar.trim();});
 if(!H.cli){toast('Elige el cliente');return;}
 if(esHoras){
  if(!H.emp){toast('Elige el empleado que hizo las horas');return;}
 }else{
  var ori=(H.ori||'').trim()||(ps.length?(ps[0].lugar||'').trim():'');
  var dst=(H.dst||'').trim()||(ps.length?(ps[ps.length-1].lugar||'').trim():'');
  if(!ori){toast('Pon el origen del transporte, o anade la primera parada');return;}
  if(!dst){toast('Pon el destino del transporte, o anade la ultima parada');return;}
  H.ori=ori;H.dst=dst;
 }
 if(!ls.length){toast('Anade al menos una linea con concepto y cantidad');return;}
 var ahora=new Date().toISOString();
 S.bz=true;render();
 postR('albaranes',{cliente_id:H.cli,fecha:H.fec,direccion_servicio:H.dir||null,obra:H.obr||null,
   tipo_albaran:esHoras?'horas':'traslado',
   empleado_id:esHoras?(H.emp||null):null,
   horas:(esHoras&&H.hrs)?parseFloat(H.hrs):null,
   origen:esHoras?null:(H.ori||null),destino:esHoras?null:(H.dst||null),
   tipo_carga:esHoras?null:(H.tc||null),codigo_ler:esHoras?null:(H.ler||null),
   mercancia:esHoras?null:(H.mer||H.tc||null),
   peso:(!esHoras&&H.pes)?parseFloat(H.pes):null,
   matricula:H.mat||null,remolque:esHoras?null:(H.rem||null),conductor:H.con||null,
   autorizacion_especial:esHoras?null:(H.aut||null),
   estado:H.est||'entregado',
   firmado:!!(H.fcn&&H.fcn.trim()),
   firma_cliente_nombre:(H.fcn&&H.fcn.trim())||null,
   firma_cliente_at:(H.fcn&&H.fcn.trim())?ahora:null,
   firma_conductor_nombre:(H.fkn&&H.fkn.trim())||null,
   firma_conductor_at:(H.fkn&&H.fkn.trim())?ahora:null,
   notas:H.not||null})
 .then(function(r){var id=r&&r[0]&&r[0].id;if(!id)throw new Error('No se pudo crear el albaran');
   ALB.nuevo=id;
   return post('albaranes_lineas',ls.map(function(x){
     return {albaran_id:id,servicio_id:x.sid||null,material_id:x.mid||null,descripcion:x.d||null,
             cantidad:parseFloat(x.c)||0,precio_unitario:parseFloat(x.p)||0,
             tipo_igic:(x.ti===''||x.ti==null)?null:parseFloat(x.ti)};}));})
 .then(function(){
   if(esHoras||!ps.length)return true;
   return post('albaranes_paradas',ps.map(function(x,i){
     return {albaran_id:ALB.nuevo,orden:i+1,tipo:x.tipo||'recogida',lugar:x.lugar,
             mercancia:x.mer||null,peso:x.peso?parseFloat(x.peso):null,hora:x.hora||null};}));})
 .then(function(){toast('Albaran guardado');S.bz=false;S.md=null;ALB={h:{},l:[],p:[]};S.d=null;S.v='albaranes';render();})
 .catch(function(e){S.bz=false;toast(e.message);render();});
}

albNuevo=function(cid){
 ALB={h:{cli:cid||'',fec:_hoy(),est:'entregado',tipo:'traslado'},l:[{mid:'',d:'',c:'',p:''}],p:[],emp:ALB&&ALB.emp};
 S.md={t:'nalb'};render();
};
window.ALB_BIND=function(){
 albBind();
 if(S.md&&S.md.t==='nalb'&&q('[data-galb]'))q('[data-galb]').onclick=albGuardar;
};
var _palb=window.BINDX;
window.BINDX=function(){
 if(_palb){try{_palb();}catch(e){console.error(e);}}
 try{window.ALB_BIND();}catch(e){console.error(e);}
};
})();

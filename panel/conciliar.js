var MDX={},S={},document={querySelectorAll:function(){return [];}};
function rpc(){return Promise.resolve([]);} function render(){} function es(x){return String(x);}
function fc(x){return String(x);} function q(){return null;} function eu2(x){return String(x);}
function eur(x){return String(x);} function _n(x){return Number(x)||0;} function toast(){}
/* ===== Conciliar repartiendo el movimiento entre varios documentos ===== */
function rpR2(n){return Math.round((Number(n)||0)*100)/100;}
function rpAsignado(L){var s=0;for(var i=0;i<(L||[]).length;i++){if(L[i].sel)s+=_n(L[i].importe);}return rpR2(s);}
function rpCarga(mo){
 S.md={t:'conc',mov:mo,rep:null,lin:null,er:null,add:''};
 render();
 if(mo.estado==='conciliado'){
  rpc('lineas_de_movimiento',{p_mov:mo.id})
   .then(function(l){if(S.md&&S.md.t==='conc'&&S.md.mov.id===mo.id){S.md.lin=l||[];render();}})
   .catch(function(){if(S.md&&S.md.t==='conc'){S.md.lin=[];render();}});
  return;
 }
 rpc('sugerir_reparto',{p_mov:mo.id})
  .then(function(l){
    if(!S.md||S.md.t!=='conc'||S.md.mov.id!==mo.id)return;
    S.md.rep=(l||[]).map(function(x){return {sel:true,tipo:x.tipo,documento_id:x.documento_id,cobro_id:x.cobro_id,
      desc:x.descripcion,tercero:x.tercero,fecha:x.fecha,total:x.total,importe:_n(x.importe),motivo:x.motivo};});
    render();})
  .catch(function(e){if(S.md&&S.md.t==='conc'){S.md.rep=[];S.md.er=e.message||null;render();}});
}

MDX.conc=function(m){
 var mo=m.mov, tot=rpR2(Math.abs(_n(mo.importe))), L=m.rep;
 var cab='<div class="ov" data-ov><div class="md" style="max-width:760px"><h3>Conciliar movimiento</h3>'
  +'<div class="s">'+fc(mo.fecha)+' · '+es(mo.concepto||'')+'</div>'
  +'<div class="k" style="margin-top:12px"><div class="l">Importe del banco</div>'
  +'<div class="v" style="font-size:21px;color:'+(_n(mo.importe)<0?'var(--red)':'var(--ok)')+'">'+eu2(mo.importe)+'</div>'
  +'<div class="s">'+(_n(mo.importe)<0?'salida de dinero':'entrada de dinero')+'</div></div>';

 if(mo.estado==='conciliado'){
  var l2=m.lin;
  var cuerpo=(l2===null)?'<div class="mi" style="margin-top:12px">Cargando el reparto...</div>'
   :(l2.length?'<div class="mi" style="margin-top:12px">Ya esta conciliado. Va a '+(l2.length===1?'este documento':'estos '+l2.length+' documentos')+':</div>'
     +'<div class="tw" style="margin-top:8px"><table><thead><tr><th>Documento</th><th>Tercero</th><th class="r">Importe</th></tr></thead><tbody>'
     +l2.map(function(x){return '<tr><td class="nm">'+es(x.descripcion||'')+'</td><td>'+es(x.tercero||'')+'</td><td class="r nu">'+eu2(x.importe)+'</td></tr>';}).join('')
     +'</tbody></table></div>'
     :'<div class="note" style="margin-top:12px">Se concilio antes de que hubiera reparto, asi que no hay detalle guardado.</div>');
  return cab+cuerpo
   +'<div class="mb"><button class="mc" data-cn>Cerrar</button>'
   +((l2&&l2.length)?'<button class="mc" data-rpundo>Deshacer el reparto</button>':'')
   +'</div></div></div>';
 }

 if(L===null)
  return cab+'<div class="mi" style="margin-top:12px">Buscando a que corresponde...</div>'
   +'<div class="mb"><button class="mc" data-cn>Cerrar</button></div></div></div>';

 var asig=rpAsignado(L), queda=rpR2(tot-asig);
 var h=cab;

 if(!L.length)
  h+='<div class="note" style="margin-top:14px">No he encontrado ninguna factura ni nomina que cuadre con este importe. Anade a mano la que sea, o marcalo como que no es una factura.</div>';

 if(L.length){
  h+='<div style="margin-top:14px"><label>A que corresponde</label>'
   +'<div class="tw"><table><thead><tr><th></th><th>Documento</th><th>Tercero</th><th class="r">Pendiente</th><th class="r">Se aplica</th><th></th></tr></thead><tbody>';
  for(var i=0;i<L.length;i++){var x=L[i];
   h+='<tr><td><input type="checkbox" data-rpsel="'+i+'"'+(x.sel?' checked':'')+'></td>'
    +'<td class="nm">'+es(x.desc||'')+'<div class="sm">'+es(x.motivo||'')+'</div></td>'
    +'<td>'+es(x.tercero||'')+'<div class="sm">'+fc(x.fecha)+'</div></td>'
    +'<td class="r nu">'+eu2(x.total)+'</td>'
    +'<td class="r"><input type="number" step="0.01" data-rpimp="'+i+'" value="'+_n(x.importe)+'" style="max-width:110px;text-align:right"></td>'
    +'<td class="r"><button class="ed" data-rpdel="'+i+'">Quitar</button></td></tr>';
  }
  h+='</tbody></table></div></div>';
 }

 var col=Math.abs(queda)<=0.02?'var(--ok)':'var(--red)';
 h+='<div class="mi" style="margin-top:12px;font-size:15px">Asignado <b>'+eu2(asig)+'</b> de '+eu2(tot)
  +' · queda por asignar <b style="color:'+col+'">'+eu2(queda)+'</b></div>';

 h+='<div style="margin-top:12px"><label>Anadir otro documento a mano</label>'
  +'<div style="display:flex;gap:8px"><input id="rp_add" placeholder="Numero de factura o nombre" value="'+es(m.add||'')+'" style="flex:1">'
  +'<button class="ac" data-rpbuscar>Buscar</button></div>';
 if(m.cand&&m.cand.length){
  h+='<div class="chips" style="margin-top:8px">'+m.cand.map(function(c,j){
    return '<div class="chip"><div class="n">'+es(c.desc)+'</div><div class="d">'+es(c.tercero)+' · '+eu2(c.importe)+'</div>'
     +'<div style="margin-top:6px"><button class="ed" style="margin-left:0" data-rpadd="'+j+'">Anadir</button></div></div>';}).join('')+'</div>';
 } else if(m.cand){
  h+='<div class="mi">Ninguna factura pendiente con ese texto.</div>';
 }
 h+='</div>';

 return h+'<div class="mb"><button class="mc" data-cn>Cerrar</button>'
  +'<button class="mc" data-ignorar'+(S.bz?' disabled':'')+'>No es una factura</button>'
  +'<button class="ms" data-rpok'+((Math.abs(queda)>0.02||!L.length||S.bz)?' disabled':'')+'>Conciliar</button>'
  +'</div></div></div>';
};

function bindConciliar(){
 document.querySelectorAll('[data-conc]').forEach(function(b){b.onclick=function(){
   var mo=(S.d.mb||[]).filter(function(z){return z.id===b.getAttribute('data-conc');})[0];
   if(mo)rpCarga(mo);};});

 document.querySelectorAll('[data-rpsel]').forEach(function(c){c.onchange=function(){
   S.md.rep[Number(c.getAttribute('data-rpsel'))].sel=c.checked;render();};});
 document.querySelectorAll('[data-rpimp]').forEach(function(e){e.onchange=function(){
   S.md.rep[Number(e.getAttribute('data-rpimp'))].importe=_n(e.value);render();};});
 document.querySelectorAll('[data-rpdel]').forEach(function(b){b.onclick=function(){
   S.md.rep.splice(Number(b.getAttribute('data-rpdel')),1);render();};});

 if(q('#rp_add'))q('#rp_add').oninput=function(){S.md.add=q('#rp_add').value;};
 if(q('[data-rpbuscar]'))q('[data-rpbuscar]').onclick=function(){
   var t=String(S.md.add||'').toLowerCase().trim();
   if(!t){toast('Escribe algo que buscar');return;}
   var ent=_n(S.md.mov.importe)>0;
   var src=ent?(S.d.fv||[]):(S.d.fc||[]);
   var res=src.filter(function(x){
     if(ent){ if(x.estado!=='pendiente'||x.incobrable||_n(x.pendiente)<=0.01)return false; }
     else { if(x.estado!=='pendiente')return false; }
     var nom=ent?(x.cliente||''):((x.proveedores&&x.proveedores.nombre)||'');
     return ((x.numero_factura||'')+' '+nom).toLowerCase().indexOf(t)>=0;
   }).slice(0,12).map(function(x){
     return {tipo:ent?'cobro':'pago',documento_id:x.id,cobro_id:null,
       desc:x.numero_factura||'sin numero',
       tercero:ent?(x.cliente||''):((x.proveedores&&x.proveedores.nombre)||''),
       fecha:x.fecha,total:x.total,
       importe:ent?_n(x.pendiente):_n(x.total),motivo:'anadida a mano'};});
   if(ent){S.md.cand=res;render();return;}
   var queda=rpR2(Math.abs(_n(S.md.mov.importe))-rpAsignado(S.md.rep||[]));
   rest('empleados?select=id,nombre&activo=eq.true&order=nombre')
    .then(function(emp){
      (emp||[]).forEach(function(e){
        if(String(e.nombre||'').toLowerCase().indexOf(t)<0)return;
        res.push({tipo:'anticipo',documento_id:e.id,cobro_id:null,desc:'Anticipo a cuenta',
          tercero:e.nombre,fecha:S.md.mov.fecha,total:queda>0?queda:Math.abs(_n(S.md.mov.importe)),
          importe:queda>0?queda:Math.abs(_n(S.md.mov.importe)),
          motivo:'anticipo: va a la 460 y se descuenta de una nomina futura'});
      });
      S.md.cand=res.slice(0,14);render();})
    .catch(function(){S.md.cand=res;render();});};

 document.querySelectorAll('[data-rpadd]').forEach(function(b){b.onclick=function(){
   var c=S.md.cand[Number(b.getAttribute('data-rpadd'))];
   if(!c)return;
   if(!S.md.rep)S.md.rep=[];
   var rep=S.md.rep;
   for(var i=0;i<rep.length;i++){if(rep[i].documento_id===c.documento_id){toast('Ya estaba en el reparto');return;}}
   var queda=rpR2(Math.abs(_n(S.md.mov.importe))-rpAsignado(rep));
   var nl={};for(var k in c)nl[k]=c[k];
   nl.sel=true; if(queda>0.01&&queda<nl.importe)nl.importe=queda;
   rep.push(nl);S.md.cand=null;S.md.add='';render();};});

 if(q('[data-rpok]'))q('[data-rpok]').onclick=function(){
   var L=(S.md.rep||[]).filter(function(x){return x.sel&&_n(x.importe)>0;});
   if(!L.length){toast('No has marcado ningun documento');return;}
   S.bz=true;render();
   rpc('conciliar_reparto',{p_usuario:S.us.id,p_mov:S.md.mov.id,p_lineas:L.map(function(x){
     return {tipo:x.tipo,documento_id:x.documento_id,importe:_n(x.importe),cobro_id:x.cobro_id||null};})})
    .then(function(r){toast((r&&r.aviso)?r.aviso:'Movimiento conciliado');S.bz=false;S.md=null;S.d=null;render();})
    .catch(function(e){S.bz=false;toast(e.message||'No se pudo conciliar');render();});};

 if(q('[data-rpundo]'))q('[data-rpundo]').onclick=function(){
   S.bz=true;render();
   rpc('deshacer_reparto',{p_usuario:S.us.id,p_mov:S.md.mov.id})
    .then(function(){toast('Reparto deshecho');S.bz=false;S.md=null;S.d=null;render();})
    .catch(function(e){S.bz=false;toast(e.message||'No se pudo deshacer');render();});};
}

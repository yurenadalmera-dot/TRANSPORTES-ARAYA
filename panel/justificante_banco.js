
/* ===== Araya - modulo v02.23: justificante del banco al conciliar ===== */
(function(){
 if(typeof MDX==='undefined')return;

 var JB={soloSin:false};

 function jbMov(id){
  var l=(S.d&&S.d.mb)||[];
  for(var i=0;i<l.length;i++)if(l[i].id===id)return l[i];
  return null;
 }

 function jbCampos(){
  return '<div style="margin-top:14px"><label>Justificante del banco</label>'
   +'<input id="cj_doc" type="file" accept="application/pdf,image/*">'
   +'<div class="mi">El recibo o el PDF que da el banco. Queda guardado con el movimiento, '
   +'y desde aqui se puede abrir cuando haga falta comprobar que esto se cobro o se pago de verdad.</div>'
   +'<div class="mi"><label><input type="checkbox" id="cj_sin"> '
   +'No lo tengo ahora: conciliar sin justificante</label></div></div>';
 }

 function jbSube(mov, file){
  return _subeComprobante(mov.id, file, 'banco')
   .then(function(ruta){
     return rpc('guardar_justificante_movimiento',
       {p_usuario:S.us.id, p_mov:mov.id, p_ruta:ruta, p_nombre:file.name||null})
      .then(function(){return ruta;});
   });
 }

 /* --- adjuntar o cambiar el justificante de un movimiento ya conciliado --- */
 MDX.justb=function(m){
  var mo=m.mov;
  return '<div class="ov" data-ov><div class="md" style="max-width:560px">'
   +'<h3>'+(mo.justificante_url?'Cambiar el justificante':'Adjuntar el justificante')+'</h3>'
   +'<div class="s">'+fc(mo.fecha)+' - '+es(mo.concepto||'')+'</div>'
   +'<div class="k" style="margin-top:12px"><div class="l">Importe del banco</div>'
   +'<div class="v" style="font-size:21px;color:'+(_n(mo.importe)<0?'var(--red)':'var(--ok)')+'">'
   +eu2(mo.importe)+'</div></div>'
   +(mo.justificante_url
     ?'<div class="mi" style="margin-top:12px">Ahora mismo tiene guardado <b>'
      +es(mo.justificante_nombre||'un fichero')+'</b>'
      +(mo.justificante_at?', subido el '+fc(mo.justificante_at):'')
      +(mo.justificante_por?' por '+es(mo.justificante_por):'')
      +'. Si subes otro, se queda el nuevo.</div>'
     :'')
   +'<div style="margin-top:12px"><label>Fichero del banco</label>'
   +'<input id="jb_doc" type="file" accept="application/pdf,image/*"></div>'
   +'<div class="mb"><button class="mc" data-cn>Cerrar</button>'
   +(mo.justificante_url?'<button class="mc" data-jbver="'+es(mo.id)+'">Ver el que hay</button>':'')
   +'<button class="ms" data-jbok="'+es(mo.id)+'"'+(S.bz?' disabled':'')+'>'
   +(S.bz?'Subiendo...':'Guardar el justificante')+'</button></div></div></div>';
 };

 function jbBind(){
  /* --- dentro del modal de conciliar --- */
  if(S.md&&S.md.t==='conc'&&S.md.mov){
   var mo=S.md.mov;

   if(mo.estado!=='conciliado'&&q('[data-rpok]')&&!q('#cj_doc')){
    var pie=q('[data-rpok]').parentNode;
    if(pie){
     var caja=document.createElement('div');
     caja.innerHTML=jbCampos();
     pie.parentNode.insertBefore(caja.firstChild,pie);
    }
   }

   /* el boton de conciliar: primero el papel, luego el reparto */
   if(q('[data-rpok]')){
    var b=q('[data-rpok]');
    b.onclick=function(){
     var L=(S.md.rep||[]).filter(function(x){return x.sel&&_n(x.importe)>0;});
     if(!L.length){toast('No has marcado ningun documento');return;}
     var fi=q('#cj_doc'), file=(fi&&fi.files&&fi.files[0])||null;
     var sin=q('#cj_sin')&&q('#cj_sin').checked;
     if(!file&&!sin){toast('Sube el justificante del banco, o marca que no lo tienes ahora');return;}
     if(file&&file.size>15*1024*1024){toast('El justificante no puede pasar de 15 MB');return;}
     var mid=S.md.mov.id, fallo=null;
     S.bz=true;render();
     rpc('conciliar_reparto',{p_usuario:S.us.id,p_mov:mid,p_lineas:L.map(function(x){
        return {tipo:x.tipo,documento_id:x.documento_id,importe:_n(x.importe),cobro_id:x.cobro_id||null};})})
      .then(function(r){
        if(!file)return r;
        return jbSube({id:mid}, file)
          .then(function(){return r;},
                function(e){fallo=(e&&e.message)||'no se pudo subir';return r;});})
      .then(function(r){
        var t=(r&&r.aviso)?r.aviso:'Movimiento conciliado';
        if(!file)t+='. Ojo: queda sin justificante';
        else if(fallo)t+=', pero el justificante no se subio porque '+fallo;
        else t+=' con su justificante';
        toast(t);S.bz=false;S.md=null;S.d=null;render();})
      .catch(function(e){S.bz=false;toast((e&&e.message)||'No se pudo conciliar');render();});};
   }

   /* ya conciliado: enseñar el justificante o pedirlo */
   if(mo.estado==='conciliado'&&q('[data-cn]')&&!q('[data-jbpie]')){
    var pie2=q('[data-cn]').parentNode;
    if(pie2){
     var nb=document.createElement('button');
     nb.className=mo.justificante_url?'mc':'ms';
     nb.setAttribute('data-jbpie','1');
     nb.textContent=mo.justificante_url?'Ver el justificante':'Falta el justificante: adjuntarlo';
     pie2.insertBefore(nb,pie2.firstChild);
     nb.onclick=function(){
      if(mo.justificante_url)verDoc(mo.justificante_url);
      else {S.md={t:'justb',mov:mo};render();}};
    }
   }
  }

  /* --- modal de adjuntar --- */
  if(S.md&&S.md.t==='justb'){
   if(q('[data-jbver]'))q('[data-jbver]').onclick=function(){verDoc(S.md.mov.justificante_url);};
   if(q('[data-jbok]')){
    var g=q('[data-jbok]');
    g.onclick=function(){
     var fi=q('#jb_doc'), file=(fi&&fi.files&&fi.files[0])||null;
     if(!file){toast('Elige el fichero del banco');return;}
     if(file.size>15*1024*1024){toast('El justificante no puede pasar de 15 MB');return;}
     S.bz=true;render();
     jbSube(S.md.mov, file)
      .then(function(){toast('Justificante guardado');S.bz=false;S.md=null;S.d=null;render();})
      .catch(function(e){S.bz=false;toast((e&&e.message)||'No se pudo subir');render();});};
   }
  }

  /* --- la tabla de Banco: un boton por fila --- */
  if(S.v==='banco'){
   document.querySelectorAll('[data-desc],[data-conc]').forEach(function(b){
    var td=b.parentNode, tr=td&&td.parentNode;
    if(!td||td.getAttribute('data-jbok2'))return;
    td.setAttribute('data-jbok2','1');
    var id=b.getAttribute('data-desc')||b.getAttribute('data-conc');
    var mo=jbMov(id); if(!mo)return;
    if(mo.estado!=='conciliado'&&!mo.justificante_url)return;
    var nb=document.createElement('button');
    nb.className='ac'; nb.style.marginRight='6px';
    if(mo.justificante_url){
     nb.textContent='Justificante';
     nb.onclick=function(){verDoc(mo.justificante_url);};
    }else{
     nb.textContent='Falta justif.';
     nb.style.color='var(--red)';
     nb.onclick=function(){S.md={t:'justb',mov:mo};render();};
     if(tr)tr.setAttribute('data-sinjust','1');
    }
    td.insertBefore(nb,b);
   });

   /* filtro: enseñar solo los conciliados sin justificante */
   var fbs=document.querySelectorAll('[data-bkf]');
   if(fbs.length&&!q('[data-jbfil]')){
    var cont=fbs[0].parentNode;
    var n=((S.d&&S.d.mb)||[]).filter(function(x){
      return x.estado==='conciliado'&&!x.justificante_url;}).length;
    var fb=document.createElement('button');
    fb.className=JB.soloSin?'ms':'ac';
    fb.setAttribute('data-jbfil','1');
    fb.textContent='Sin justificante ('+n+')';
    cont.appendChild(fb);
    fb.onclick=function(){JB.soloSin=!JB.soloSin;render();};
   }
   if(JB.soloSin){
    document.querySelectorAll('[data-jbok2]').forEach(function(td){
     var tr=td.parentNode;
     if(tr&&!tr.getAttribute('data-sinjust'))tr.style.display='none';
    });
   }
  }
 }

 window.JB_BIND=jbBind;
 var _pjb=window.BINDX;
 window.BINDX=function(){
  if(_pjb){try{_pjb();}catch(e){console.error(e);}}
  try{window.JB_BIND();}catch(e){console.error(e);}
 };
})();

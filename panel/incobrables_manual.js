
/* ===== Araya - modulo v02.20: llevar a incobrables a mano ===== */
(function(){
 if(typeof MDX==='undefined')return;

 var INC_MOT=['Cliente insolvente',
   'Empresa cerrada o en concurso',
   'Deuda prescrita',
   'Reclamarla cuesta mas de lo que se cobra',
   'Acuerdo de quita con el cliente',
   'Otro motivo'];

 function incCampos(){
  var h='<div class="fi"><label>Por que se da por incobrable</label><select id="ic_mot">'
   +'<option value="">- elegir motivo -</option>';
  for(var i=0;i<INC_MOT.length;i++)h+='<option value="'+es(INC_MOT[i])+'">'+es(INC_MOT[i])+'</option>';
  h+='</select></div>'
   +'<div class="fi"><label>Detalle (se guarda con la factura)</label>'
   +'<input id="ic_lib" placeholder="Lo que quieras dejar escrito"></div>';
  return h;
 }

 function incLeeMotivo(){
  var s=q('#ic_mot'), l=q('#ic_lib');
  var a=(s&&s.value)||'', b=((l&&l.value)||'').replace(/^\s+|\s+$/g,'');
  if(a==='Otro motivo')a='';
  var m=(a&&b)?(a+' - '+b):(a||b);
  return m;
 }

 var INC_AVISO='Dejan de contar en el pendiente de cobro y en la tesoreria, y ya no se les manda avisos. '
  +'La deuda no se borra: sigue en la ficha del cliente, en la pestana Cartera antigua, y se puede deshacer cuando quieras.';

 /* --- expediente entero --- */
 MDX.incobrec=function(m){
  var r=m.r;
  return '<div class="ov" data-ov><div class="md" style="max-width:600px">'
   +'<h3>Llevar a incobrables</h3>'
   +'<div class="s">'+es(r.cliente||'')+(r.numero_expediente?' - expediente '+es(r.numero_expediente):'')+'</div>'
   +'<div class="note" style="margin-top:12px">Se marcan como incobrables las facturas de este expediente que siguen sin cobrar: '
   +'<b>'+_n(r.n_facturas)+' facturas</b> por <b>'+eur(_n(r.pendiente_hoy))+'</b>. '+INC_AVISO+'</div>'
   +'<div class="fg" style="margin-top:12px">'+incCampos()+'</div>'
   +'<div class="mi" style="margin-top:10px"><label><input type="checkbox" id="ic_arch" checked> '
   +'Archivar tambien el expediente y anotar la gestion</label></div>'
   +'<div class="mb"><button class="mc" data-cn>Cancelar</button>'
   +'<button class="ms" data-incgo="'+es(r.id)+'"'+(S.bz?' disabled':'')+'>'
   +(S.bz?'Llevando...':'Llevar a incobrables')+'</button></div></div></div>';
 };

 /* --- una factura suelta --- */
 MDX.incobfac=function(m){
  var f=m.f, pen=Math.max(_n(f.pendiente),_n(f.total)-_n(f.importe_cobrado));
  if(m.quitar){
   return '<div class="ov" data-ov><div class="md" style="max-width:560px">'
    +'<h3>Sacar de incobrables</h3>'
    +'<div class="s">'+es(f.numero_factura||'')+' - '+es(f.cliente||'')+'</div>'
    +'<div class="note" style="margin-top:12px">La factura <b>'+es(f.numero_factura||'')+'</b> de '
    +eur(_n(f.total))+' vuelve a contar como pendiente de cobro'
    +(f.motivo_incobrable?'. Se quita el motivo que tenia puesto: <i>'+es(f.motivo_incobrable)+'</i>':'')+'.</div>'
    +'<div class="mb"><button class="mc" data-cn>Cancelar</button>'
    +'<button class="ms" data-incoff="'+es(f.id)+'"'+(S.bz?' disabled':'')+'>'
    +(S.bz?'Sacando...':'Volver a contarla')+'</button></div></div></div>';
  }
  return '<div class="ov" data-ov><div class="md" style="max-width:600px">'
   +'<h3>Llevar a incobrables</h3>'
   +'<div class="s">'+es(f.numero_factura||'')+' - '+es(f.cliente||'')+'</div>'
   +'<div class="note" style="margin-top:12px">Quedan sin cobrar <b>'+eur(pen)+'</b> de esta factura. '+INC_AVISO+'</div>'
   +'<div class="fg" style="margin-top:12px">'+incCampos()+'</div>'
   +'<div class="mb"><button class="mc" data-cn>Cancelar</button>'
   +'<button class="ms" data-incfac="'+es(f.id)+'"'+(S.bz?' disabled':'')+'>'
   +(S.bz?'Llevando...':'Llevar a incobrables')+'</button></div></div></div>';
 };

 function incFV(id){
  var l=S.d&&S.d.fv?S.d.fv:[];
  for(var i=0;i<l.length;i++)if(l[i].id===id)return l[i];
  return null;
 }

 function incBind(){
  /* boton en cada fila de Facturas emitidas */
  if(S.v==='facturacion'&&typeof pue==='function'&&pue()){
   document.querySelectorAll('[data-vfv]').forEach(function(b){
    var td=b.parentNode; if(!td||td.getAttribute('data-incok'))return;
    td.setAttribute('data-incok','1');
    var f=incFV(b.getAttribute('data-vfv'));
    if(!f)return;
    if(!f.incobrable&&(f.estado==='cobrada'||f.estado==='anulada'))return;
    var nb=document.createElement('button');
    nb.className='ac';
    nb.setAttribute(f.incobrable?'data-incq':'data-incp',f.id);
    nb.textContent=f.incobrable?'Recuperar':'Incobrable';
    nb.style.marginRight='6px';
    td.insertBefore(nb,b);
    nb.onclick=function(){S.md={t:'incobfac',f:f,quitar:!!f.incobrable};render();};
   });
  }
  /* boton en la ficha del expediente */
  if(S.md&&S.md.t==='recficha'&&q('[data-recsav]')&&typeof pue==='function'&&pue()){
   var s=q('[data-recsav]'), pie=s.parentNode;
   if(pie&&!pie.getAttribute('data-incok')){
    pie.setAttribute('data-incok','1');
    var r=S.md.r;
    if(r&&_n(r.pendiente_hoy)>0.005){
     var bi=document.createElement('button');
     bi.className='ac'; bi.textContent='Llevar a incobrables';
     bi.style.marginRight='8px';
     if(S.bz)bi.disabled=true;
     pie.insertBefore(bi,s);
     bi.onclick=function(){S.md={t:'incobrec',r:r};render();};
    }
   }
  }
  /* llevar el expediente entero */
  if(q('[data-incgo]')){
   var g=q('[data-incgo]');
   g.onclick=function(){
    var id=g.getAttribute('data-incgo'), mot=incLeeMotivo();
    if(!mot){toast('Dime por que se da por incobrable');return;}
    var ar=q('#ic_arch')?!!q('#ic_arch').checked:true;
    S.bz=true;render();
    rpc('llevar_reclamacion_a_incobrables',
        {p_usuario:S.us.id,p_reclamacion:id,p_motivo:mot,p_archivar:ar})
     .then(function(r){
       toast((r&&r.facturas?r.facturas:0)+' facturas a incobrables por '+eur(_n(r&&r.importe))
             +(ar?'. Expediente archivado':''));
       S.bz=false;S.md=null;S.d=null;
       if(typeof REC!=='undefined'){REC.exp=null;REC.act={};REC.ts=0;}
       render();
       if(typeof cargaRec==='function')cargaRec(true);})
     .catch(function(e){S.bz=false;toast(e.message);render();});};
  }
  /* una factura a incobrables */
  if(q('[data-incfac]')){
   var p=q('[data-incfac]');
   p.onclick=function(){
    var id=p.getAttribute('data-incfac'), mot=incLeeMotivo();
    if(!mot){toast('Dime por que se da por incobrable');return;}
    S.bz=true;render();
    rpc('marcar_incobrable',{p_usuario:S.us.id,p_factura:id,p_incobrable:true,p_motivo:mot})
     .then(function(){toast('Factura llevada a incobrables. La tienes en Cartera antigua');
       S.bz=false;S.md=null;S.d=null;render();})
     .catch(function(e){S.bz=false;toast(e.message);render();});};
  }
  /* sacarla de incobrables */
  if(q('[data-incoff]')){
   var o=q('[data-incoff]');
   o.onclick=function(){
    var id=o.getAttribute('data-incoff');
    S.bz=true;render();
    rpc('marcar_incobrable',{p_usuario:S.us.id,p_factura:id,p_incobrable:false,p_motivo:null})
     .then(function(){toast('Vuelve a contar como pendiente de cobro');
       S.bz=false;S.md=null;S.d=null;render();})
     .catch(function(e){S.bz=false;toast(e.message);render();});};
  }
 }

 window.INCOB_BIND=incBind;
 var _pinc=window.BINDX;
 window.BINDX=function(){
  if(_pinc){try{_pinc();}catch(e){console.error(e);}}
  try{window.INCOB_BIND();}catch(e){console.error(e);}
 };
})();


/* ===== Araya - modulo v02.21: pasar a reclamaciones desde el informe de pendientes ===== */
(function(){
 if(typeof MDX==='undefined')return;

 var ICR={g:null,exp:null,ld:false,er:null};

 function icrUuid(v){return /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(String(v||''));}

 function icrCargaExp(cid){
  ICR.exp=null;ICR.ld=true;ICR.er=null;
  rest('v_reclamaciones?select=id,estado,referencia,numero_expediente,n_facturas,pendiente_hoy'
       +'&cliente_id=eq.'+encodeURIComponent(cid)
       +'&estado=not.in.(cobrada,archivada)&order=created_at.desc')
   .then(function(l){ICR.exp=l||[];ICR.ld=false;render();})
   .catch(function(e){ICR.exp=[];ICR.ld=false;ICR.er=e.message||'';render();});
 }

 MDX.icrec=function(){
  var g=ICR.g; if(!g)return '';
  var h='<div class="ov" data-ov><div class="md" style="max-width:660px">'
   +'<h3>Pasar a reclamaciones</h3>'
   +'<div class="s">'+es(g.nombre||'')+(g.cif?' - '+es(g.cif):'')+'</div>';

  if(ICR.ld||ICR.exp===null){
   h+='<div class="emp"><h3>Mirando si ya tiene expediente...</h3></div>'
    +'<div class="mb"><button class="mc" data-cn>Cerrar</button></div></div></div>';
   return h;
  }

  var ab=ICR.exp||[];
  if(ab.length){
   h+='<div class="note" style="margin-top:12px">Este cliente ya tiene '
    +(ab.length===1?'un expediente abierto':ab.length+' expedientes abiertos')
    +'. Si eliges uno, las facturas se le suman; las que ya estuvieran dentro se quedan.</div>'
    +'<div class="fi" style="margin-top:10px"><label>Donde van</label><select id="icr_dst">';
   for(var e=0;e<ab.length;e++){
    var x=ab[e];
    h+='<option value="'+es(x.id)+'">Anadir al expediente '
     +es(x.numero_expediente||x.referencia||recEstTxt(x.estado))
     +' ('+_n(x.n_facturas)+' facturas, '+eur(_n(x.pendiente_hoy))+')</option>';
   }
   h+='<option value="">Abrir un expediente nuevo</option></select></div>';
  }else{
   h+='<div class="note" style="margin-top:12px">Se abre un expediente nuevo en estado '
    +'<b>preparando</b> con las facturas que marques. Dejan de salir en el informe de '
    +'pendientes de cobro y en los avisos, y pasan a la pantalla de Reclamaciones.</div>';
  }

  h+='<div class="tw" style="margin-top:12px;max-height:320px;overflow:auto"><table><thead><tr>'
   +'<th style="width:34px"></th><th>Factura</th><th>Fecha</th><th>Vencimiento</th>'
   +'<th class="r">Pendiente</th></tr></thead><tbody>';
  var tot=0;
  for(var i=0;i<g.fs.length;i++){
   var f=g.fs[i], fid=f.factura_id||f.id, vd=icVencida(f);
   tot+=_n(f.pendiente);
   h+='<tr><td><input type="checkbox" class="icr_f" value="'+es(fid)+'" checked></td>'
    +'<td class="nm nu">'+es(f.numero_factura||'-')+'</td>'
    +'<td class="nu">'+fc(f.fecha)+'</td>'
    +'<td class="nu"'+(vd?' style="color:var(--red)"':'')+'>'+(icVence(f)?fc(icVence(f)):'-')
    +(vd?' <span class="sm">vencida</span>':'')+'</td>'
    +'<td class="r nu">'+eu2(f.pendiente)+'</td></tr>';
  }
  h+='</tbody><tfoot><tr><th colspan="4">TOTAL</th><th class="r nu">'+eu2(tot)+'</th></tr></tfoot></table></div>'
   +'<div class="mi" style="margin-top:8px"><button class="ac" data-icrall>Marcar todas</button> '
   +'<button class="ac" data-icrnone>Desmarcar todas</button></div>'
   +'<div class="mb"><button class="mc" data-cn>Cancelar</button>'
   +'<button class="ms" data-icrgo'+(S.bz?' disabled':'')+'>'
   +(S.bz?'Pasando...':'Pasar a reclamaciones')+'</button></div></div></div>';
  return h;
 };

 function icrBind(){
  /* boton por cliente en el informe de pendientes de cobro */
  if(S.v==='informes'&&INF.tab==='cobros'&&typeof pue==='function'&&pue()){
   var arr=(INFC.rows&&!INFC.ld)?icDatos():[];
   var grs=document.querySelectorAll('#informe tr.gr');
   for(var i=0;i<grs.length&&i<arr.length;i++){
    (function(tr,g){
     if(tr.getAttribute('data-icrok'))return;
     tr.setAttribute('data-icrok','1');
     var fid=(g.fs[0]&&(g.fs[0].cliente_id))||null;
     if(!icrUuid(fid))return;
     var td=tr.cells[0]; if(!td)return;
     var b=document.createElement('button');
     b.className='ac noimp'; b.textContent='A reclamaciones';
     b.style.marginLeft='10px';
     td.appendChild(b);
     b.onclick=function(){
      ICR.g={id:fid,nombre:g.nombre,cif:g.cif,fs:g.fs};
      S.md={t:'icrec'};render();icrCargaExp(fid);};
    })(grs[i],arr[i]);
   }
  }
  /* dentro del modal */
  if(S.md&&S.md.t==='icrec'){
   if(q('[data-icrall]'))q('[data-icrall]').onclick=function(){
    document.querySelectorAll('.icr_f').forEach(function(c){c.checked=true;});};
   if(q('[data-icrnone]'))q('[data-icrnone]').onclick=function(){
    document.querySelectorAll('.icr_f').forEach(function(c){c.checked=false;});};
   if(q('[data-icrgo]'))q('[data-icrgo]').onclick=function(){
    var g=ICR.g; if(!g)return;
    var ids=[];
    document.querySelectorAll('.icr_f').forEach(function(c){if(c.checked)ids.push(c.value);});
    if(!ids.length){toast('Marca al menos una factura');return;}
    var ds=q('#icr_dst'), dst=ds?ds.value:'';
    S.bz=true;render();
    (dst?rest('reclamacion_facturas?select=factura_venta_id&reclamacion_id=eq.'+encodeURIComponent(dst))
        :Promise.resolve([]))
     .then(function(l){
       var todas=ids.slice();
       (l||[]).forEach(function(x){if(todas.indexOf(x.factura_venta_id)<0)todas.push(x.factura_venta_id);});
       return rpc('guardar_reclamacion',{p_usuario:S.us.id,
         p_datos:(dst?{id:dst}:{cliente_id:g.id}), p_facturas:todas});})
     .then(function(r){
       toast(dst?('Expediente con '+(r&&r.facturas||0)+' facturas por '+eur(_n(r&&r.importe)))
                :('Expediente abierto con '+(r&&r.facturas||0)+' facturas por '+eur(_n(r&&r.importe))));
       S.bz=false;S.md=null;S.d=null;ICR.g=null;ICR.exp=null;
       if(typeof INFC!=='undefined')INFC.rows=null;
       if(typeof REC!=='undefined'){REC.exp=null;REC.act={};REC.ts=0;}
       render();
       if(typeof icCarga==='function')icCarga(true);})
     .catch(function(e){S.bz=false;toast(e.message);render();});};
  }
  /* en Cartera antigua, decir desde cuando y por que */
  if(S.v==='facturacion'&&typeof FVQ!=='undefined'&&FVQ.tab==='antigua'){
   document.querySelectorAll('[data-vfv]').forEach(function(b){
    var tr=b.parentNode&&b.parentNode.parentNode; if(!tr||tr.getAttribute('data-incmot'))return;
    tr.setAttribute('data-incmot','1');
    var id=b.getAttribute('data-vfv'), f=null, l=(S.d&&S.d.fv)||[];
    for(var i=0;i<l.length;i++)if(l[i].id===id){f=l[i];break;}
    if(!f||!f.incobrable)return;
    var td=tr.cells[2]; if(!td)return;
    var txt=(f.fecha_incobrable?'incobrable desde '+fc(f.fecha_incobrable):'incobrable')
     +(f.motivo_incobrable?' - '+f.motivo_incobrable:'');
    var d=document.createElement('div');
    d.className='sm'; d.style.color='var(--mute)'; d.textContent=txt;
    td.appendChild(d);
   });
  }
 }

 window.ICREC_BIND=icrBind;
 var _picr=window.BINDX;
 window.BINDX=function(){
  if(_picr){try{_picr();}catch(e){console.error(e);}}
  try{window.ICREC_BIND();}catch(e){console.error(e);}
 };
})();

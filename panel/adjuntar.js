/* ===== Adjuntar el comprobante a un cobro ya registrado ===== */
function adjPide(cobroId,facturaId){
 var inp=document.createElement('input');
 inp.type='file';
 inp.accept='.pdf,.jpg,.jpeg,.png,.webp,image/*,application/pdf';
 inp.style.display='none';
 document.body.appendChild(inp);
 inp.onchange=function(){
  var file=inp.files&&inp.files[0];
  document.body.removeChild(inp);
  if(!file)return;
  if(file.size>15*1024*1024){toast('El comprobante no puede pasar de 15 MB');return;}
  S.bz=true;render();
  _subeComprobante(facturaId,file)
   .then(function(ruta){
     return rpc('adjuntar_comprobante_cobro',
       {p_usuario:S.us.id,p_cobro:cobroId,p_documento:ruta});})
   .then(function(){toast('Comprobante adjuntado');S.bz=false;S.d=null;render();})
   .catch(function(e){S.bz=false;
     toast('No se pudo adjuntar porque '+(e.message||'fallo la subida'));render();});
 };
 inp.click();
}
function bindAdjuntar(){
 document.querySelectorAll('[data-adjcob]').forEach(function(b){
  b.onclick=function(){
    adjPide(b.getAttribute('data-adjcob'), b.getAttribute('data-adjfac'));};});
}

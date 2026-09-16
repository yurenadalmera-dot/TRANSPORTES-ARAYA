/* ===== Comprobantes: renovar la sesion y no tirar el cobro si falla ===== */
function cmpMotivo(status,t){
 var s=String(t||'');
 if(status===401||status===403||s.indexOf('exp')>=0||s.indexOf('Unauthorized')>=0)
   return 'se habia caducado la sesion';
 if(status===413||s.indexOf('too large')>=0) return 'el fichero pesa demasiado';
 if(!status) return 'no hubo conexion';
 return 'el servidor respondio ' + status;
}
function _subeComprobante(fid,file){
 var ext=String(file.name||'pdf').split('.').pop().toLowerCase().replace(/[^a-z0-9]/g,'')||'pdf';
 var ruta='cobros/'+fid+'/'+Date.now()+'.'+ext;
 function intento(){
  return fetch(SB+'/storage/v1/object/facturas/'+ruta,{method:'POST',
    headers:{apikey:AK,Authorization:'Bearer '+S.tk,'x-upsert':'true',
             'Content-Type':file.type||'application/octet-stream'},
    body:file});
 }
 return auth().then(intento)
  .then(function(x){
    if(x&&(x.status===401||x.status===403)&&S.rt){
      return renovar().then(intento,function(){return x;});
    }
    return x;})
  .then(function(x){
    if(!x||!x.ok){
      var st=x?x.status:0;
      return (x?x.text():Promise.resolve('')).then(function(t){
        throw new Error(cmpMotivo(st,t));});
    }
    return ruta;});
}
function bindCobroDoc(){
 var b=q('[data-gcob]');
 if(!b)return;
 b.onclick=function(){
  var id=b.getAttribute('data-gcob');
  var imp=parseFloat((q('#c_imp')||{}).value);
  if(!imp||imp<=0){toast('Pon el importe del cobro');return;}
  var fe=(q('#c_fec')||{}).value||null, mt=(q('#c_fp')||{}).value||null, rf=(q('#c_ref')||{}).value||null;
  var fi=q('#c_doc'), file=(fi&&fi.files&&fi.files[0])||null;
  if(file&&file.size>15*1024*1024){toast('El comprobante no puede pasar de 15 MB');return;}
  S.bz=true;render();
  var fallo=null;
  var subida=file
    ? _subeComprobante(id,file).catch(function(e){fallo=e.message||'no se pudo subir';return null;})
    : Promise.resolve(null);
  subida.then(function(ruta){
      return rpc('registrar_cobro',{p_usuario:S.us.id,p_factura:id,p_importe:imp,
        p_fecha:fe,p_metodo:mt,p_referencia:rf,p_documento:ruta});})
   .then(function(r){
      var t=(r&&r.estado==='cobrada')
        ? 'Factura cobrada del todo'
        : 'Cobro parcial registrado. Quedan '+eu2((r&&r.pendiente)||0);
      if(fallo)t+='. El cobro queda guardado, pero el comprobante no se subio porque '+fallo;
      toast(t);
      S.bz=false;S.md=null;S.d=null;render();})
   .catch(function(e){S.bz=false;toast(e.message);render();});
 };
}

var S={},BND={},N8='';
function q(){return null;} function render(){} function toast(){}
function auth(){return Promise.resolve();} function salir(){}
function pdfAImagenes(){return Promise.resolve([]);}
function fetch(){return Promise.resolve({status:200,json:function(){return Promise.resolve({ok:true});}});}
/* ===== Escaner: reconocer el documento y llevarlo a su bandeja ===== */
function bndRuta(t){
 return t==='albaran'?'/araya/albaran-lote':(t==='venta'?'/araya/venta-lote':(t==='albcompra'?'/araya/albaran-compra-lote':'/araya/factura-lote'));
}
function bndNombreTipo(t){
 return {factura:'facturas de proveedor',venta:'facturas de venta',albaran:'albaranes de trabajo',albcompra:'albaranes de proveedor',nomina:'nominas'}[t]||t;
}
function bndSubir(files,tipo){
 var fd=new FormData(); fd.append('token',S.tk);
 var total=0;
 if(tipo==='nomina'){
  for(var n=0;n<files.length;n++){fd.append('orig'+n,files[n],files[n].name);}
  return auth().then(function(){try{fd.set('token',S.tk);}catch(e2){fd.append('token',S.tk);}
    return fetch(N8+'/araya/nomina-lote',{method:'POST',body:fd});})
   .then(function(r){if(r.status===401){salir();throw new Error('Sesion caducada. Vuelve a entrar.');}return r.json();})
   .then(function(j){if(!j.ok)throw new Error(j.error||'No se pudieron subir las nominas');
     return {tipo:tipo,documentos:files.length,paginas:0};});
 }
 var proc=function(i){
  if(i>=files.length)return Promise.resolve();
  var f=files[i];
  fd.append('orig'+i,f,f.name);
  if(/pdf/i.test(f.type)||/\.pdf$/i.test(f.name)){
   return pdfAImagenes(f,function(p,nn){BND.msg='Preparando '+f.name+': pagina '+p+' de '+nn;render();})
    .then(function(pgs){for(var z=0;z<pgs.length;z++){fd.append('pg'+i+'_'+pgs[z].n,pgs[z].blob,'p'+pgs[z].n+'.jpg');total++;}})
    .then(function(){return proc(i+1);});}
  fd.append('pg'+i+'_1',f,f.name); total++;
  return proc(i+1);};
 return proc(0)
  .then(function(){
    var tam=0;for(var z=0;z<files.length;z++){tam+=files[z].size;}
    tam+=total*260000;
    if(tam>13000000){throw new Error('El envio es demasiado grande ('+Math.round(tam/1048576)+' MB). Sube el escaneo en dos o tres tandas mas cortas.');}
    BND.msg='Subiendo '+files.length+' documento(s) y '+total+' paginas...';render();
    return auth().then(function(){try{fd.set('token',S.tk);}catch(e3){fd.append('token',S.tk);}
      return fetch(N8+bndRuta(tipo),{method:'POST',body:fd});});})
  .then(function(r){if(r.status===401){salir();throw new Error('Sesion caducada. Vuelve a entrar.');}return r.json();})
  .then(function(j){if(!j.ok)throw new Error(j.error||'No se pudo subir el escaneo');
    return {tipo:tipo,documentos:j.documentos||files.length,paginas:total};});
}
function bndPrimeraPagina(f){
 if(/pdf/i.test(f.type)||/\.pdf$/i.test(f.name)){
  return pdfAImagenes(f,function(){}).then(function(pgs){return (pgs&&pgs.length)?pgs[0].blob:null;});
 }
 return Promise.resolve(f);
}
function bndClasificar(files){
 var res=[];
 var paso=function(i){
  if(i>=files.length)return Promise.resolve(res);
  BND.msg='Reconociendo '+(i+1)+' de '+files.length+': '+files[i].name;render();
  return bndPrimeraPagina(files[i])
   .then(function(bl){
     if(!bl){res.push({f:files[i],tipo:'otro',confianza:0,motivo:'No se pudo leer el documento'});return null;}
     var fd=new FormData(); fd.append('data',bl,'p1.jpg');
     return auth().then(function(){fd.append('token',S.tk);
       return fetch(N8+'/araya/clasificar',{method:'POST',body:fd});})
      .then(function(r){if(r.status===401){salir();throw new Error('Sesion caducada. Vuelve a entrar.');}return r.json();})
      .then(function(j){res.push({f:files[i],tipo:(j&&j.tipo)||'otro',confianza:(j&&j.confianza)||0,motivo:(j&&j.motivo)||null});});})
   .then(function(){return paso(i+1);});};
 return paso(0);
}
function bndAuto(files){
 BND.subiendo=true;BND.msg='Reconociendo los documentos...';render();
 return bndClasificar(files).then(function(cl){
   var g={},dudosos=[],tipos=[];
   for(var i=0;i<cl.length;i++){
     var c=cl[i],t=(c.tipo==='compra')?'factura':c.tipo;
     if(t==='otro'||c.confianza<60){dudosos.push(c);continue;}
     if(!g[t]){g[t]=[];tipos.push(t);}
     g[t].push(c.f);
   }
   if(!tipos.length){
     BND.subiendo=false;
     BND.msg='No he sabido reconocer ninguno de los '+files.length+' documento(s). Elige el tipo a mano y vuelve a subirlos.';
     toast('No se reconocio ningun documento');render();return null;
   }
   var hechos=[];
   var sube=function(k){
     if(k>=tipos.length)return Promise.resolve();
     var t=tipos[k];
     BND.msg='Enviando '+g[t].length+' '+bndNombreTipo(t)+'...';render();
     return bndSubir(g[t],t)
      .then(function(){hechos.push(g[t].length+' '+bndNombreTipo(t));})
      .then(function(){return sube(k+1);});};
   return sube(0).then(function(){
     BND.subiendo=false;
     var sinsaber='';
     if(dudosos.length){
       var nn=[];for(var z=0;z<dudosos.length;z++){nn.push(dudosos[z].f.name);}
       sinsaber=' '+dudosos.length+' documento(s) no se han enviado porque no he sabido que eran ('+nn.join(', ')+'): elige el tipo a mano y subelos aparte.';
     }
     BND.msg='Reconocido y enviado: '+hechos.join(', ')+'.'+sinsaber
       +' Tarda unos segundos por pagina; pulsa Actualizar para verlos entrar.';
     toast('Escaneo reconocido y enviado');render();});
 }).catch(function(e){BND.subiendo=false;BND.msg=null;toast(e.message);render();});
}

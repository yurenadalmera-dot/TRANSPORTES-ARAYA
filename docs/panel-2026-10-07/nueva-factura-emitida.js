/* ===== v02.83 Nueva factura emitida a mano (sin albaranes) ===== */
(function(){
try{
window.MDX=window.MDX||{};
var NFM={f:null};
var TIPOS=[['7','7 %'],['3','3 %'],['0','0 % (exento)'],['9.5','9,5 %'],['15','15 %'],['20','20 %']];
function r2(n){n=Number(n)||0;return Math.round((n+(n<0?-1:1)*1e-9)*100)/100;}
function hoyIso(){var d=new Date();return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2);}
function fila(){return {d:'',c:'1',p:'',t:'7'};}
function cli(n){n=String(n||'').trim().toLowerCase();if(!n)return null;
 var l=(S.d&&S.d.cl)||[],i,c;
 for(i=0;i<l.length;i++){c=l[i];if(String(c.nombre||'').trim().toLowerCase()===n||(c.cif&&String(c.cif).trim().toLowerCase()===n))return c;}
 return null;}
function imp(l){return r2((l.c===''?1:(Number(l.c)||0))*(Number(l.p)||0));}
function lee(){var f=NFM.f;if(!f||!q('#nfm_cli'))return f;
 f.cliente=q('#nfm_cli').value;f.fecha=q('#nfm_fec').value;f.dias=q('#nfm_dias').value;f.notas=q('#nfm_not').value;
 document.querySelectorAll('[data-nfml]').forEach(function(e){var i=+e.getAttribute('data-i'),k=e.getAttribute('data-nfml');if(f.lin[i])f.lin[i][k]=e.value;});
 return f;}
function suma(f){var g={},b=0,c=0;
 f.lin.forEach(function(l){if(!String(l.d||'').trim())return;var t=String(Number(l.t)||0);g[t]=(g[t]||0)+imp(l);});
 Object.keys(g).forEach(function(t){var bb=r2(g[t]);b+=bb;c+=r2(bb*Number(t)/100);});
 return {b:r2(b),g:r2(c),t:r2(b+c)};}
function txt(s){return 'Base '+eu2(s.b)+' · IGIC '+eu2(s.g)+' · Total '+eu2(s.t);}
MDX.nfm=function(m){var f=NFM.f,s=suma(f),cs=(S.d&&S.d.cl)||[];
 var h='<div class="ov" data-ov><div class="md" style="max-width:760px"><h3>Nueva factura</h3><div class="s">Factura emitida a mano, sin albaranes. El numero lo pone el panel.</div>'
  +'<div class="fg" style="margin-top:12px"><div class="fi" style="grid-column:1/-1"><label>Cliente</label><input id="nfm_cli" list="nfm_clis" autocomplete="off" placeholder="Escribe el nombre o el CIF y eligelo de la lista" value="'+es(f.cliente)+'">'
  +'<datalist id="nfm_clis">'+cs.map(function(c){return '<option value="'+es(c.nombre)+'">'+(c.cif?es(c.cif):'')+'</option>';}).join('')+'</datalist></div>'
  +'<div class="fi"><label>Fecha</label><input id="nfm_fec" type="date" value="'+es(f.fecha)+'"></div>'
  +'<div class="fi"><label>Vence a (dias)</label><input id="nfm_dias" type="number" step="1" min="0" placeholder="los de la ficha del cliente" value="'+es(f.dias)+'"></div></div>'
  +'<div class="tw" style="margin-top:12px"><table><thead><tr><th>Concepto</th><th class="r">Cantidad</th><th class="r">Precio</th><th>IGIC</th><th class="r">Importe</th><th></th></tr></thead><tbody>';
 f.lin.forEach(function(l,i){
  h+='<tr><td><input data-nfml="d" data-i="'+i+'" value="'+es(l.d)+'" placeholder="p. ej. transporte de material a obra" style="min-width:220px"></td>'
   +'<td class="r"><input data-nfml="c" data-i="'+i+'" type="number" step="0.01" value="'+es(l.c)+'" style="width:80px"></td>'
   +'<td class="r"><input data-nfml="p" data-i="'+i+'" type="number" step="0.0001" value="'+es(l.p)+'" style="width:100px"></td>'
   +'<td><select data-nfml="t" data-i="'+i+'">'+TIPOS.map(function(z){return '<option value="'+z[0]+'"'+(String(l.t)===z[0]?' selected':'')+'>'+z[1]+'</option>';}).join('')+'</select></td>'
   +'<td class="r nu" data-nfmi="'+i+'">'+eu2(imp(l))+'</td>'
   +'<td>'+(f.lin.length>1?'<button class="mc" data-nfmdel="'+i+'" style="padding:0 10px" title="Quitar la linea">×</button>':'')+'</td></tr>';});
 h+='</tbody></table></div><button class="mc" data-nfmadd style="margin-top:8px">+ Anadir linea</button>'
  +'<div class="fg" style="margin-top:10px"><div class="fi" style="grid-column:1/-1"><label>Notas</label><input id="nfm_not" value="'+es(f.notas)+'" placeholder="obra, pedido, referencia..."></div></div>'
  +'<div class="mi" id="nfm_res" style="margin-top:8px"><b>'+txt(s)+'</b></div>'
  +(m.err?'<div class="note" style="margin-top:8px;color:var(--red)">'+es(m.err)+'</div>':'')
  +'<div class="mb"><button class="mc" data-cn>Cancelar</button><button class="ms" data-nfmok'+(S.bz?' disabled':'')+'>'+(S.bz?'Emitiendo...':'Emitir factura')+'</button></div></div></div>';
 return h;};
function pinta(){var f=lee();if(!f)return;
 f.lin.forEach(function(l,i){var e=q('[data-nfmi="'+i+'"]');if(e)e.textContent=eu2(imp(l));});
 var r=q('#nfm_res');if(r)r.innerHTML='<b>'+txt(suma(f))+'</b>';}
function enlaza(){
 var b=q('[data-nfm]');
 if(b)b.onclick=function(){NFM.f={cliente:'',fecha:hoyIso(),dias:'',notas:'',lin:[fila()]};S.md={t:'nfm',err:null};render();};
 if(!(S.md&&S.md.t==='nfm'&&NFM.f))return;
 var m=S.md;
 var a=q('[data-nfmadd]');if(a)a.onclick=function(){lee();NFM.f.lin.push(fila());render();};
 document.querySelectorAll('[data-nfmdel]').forEach(function(x){x.onclick=function(){lee();NFM.f.lin.splice(+x.getAttribute('data-nfmdel'),1);render();};});
 document.querySelectorAll('[data-nfml]').forEach(function(x){x.addEventListener(x.tagName==='SELECT'?'change':'input',pinta);});
 var ok=q('[data-nfmok]');if(ok)ok.onclick=function(){
  var f=lee(),c=cli(f.cliente),s=suma(f);
  if(!c){m.err='Elige el cliente de la lista, tal como esta en su ficha';render();return;}
  if(!f.fecha){m.err='Pon la fecha de la factura';render();return;}
  var ls=f.lin.filter(function(l){return String(l.d||'').trim()!=='';}).map(function(l){
   return {descripcion:String(l.d).trim(),cantidad:(l.c===''?1:Number(l.c)||0),precio_unitario:Number(l.p)||0,tipo_igic:Number(l.t)||0};});
  if(!ls.length){m.err='Escribe al menos una linea con su concepto y su precio';render();return;}
  if(ls.some(function(l){return !(l.cantidad*l.precio_unitario);})){m.err='Hay una linea sin cantidad o sin precio';render();return;}
  if(!confirm('Emitir la factura a '+c.nombre+' por '+eu2(s.t)+'?'))return;
  m.err=null;S.bz=true;render();
  rpc('crear_factura_venta',{p_usuario:S.us.id,p_datos:{cliente_id:c.id,fecha:f.fecha,dias_vencimiento:f.dias,notas:f.notas,lineas:ls}})
   .then(function(r){S.bz=false;S.md=null;NFM.f=null;S.d=null;toast('Factura '+((r&&r.numero)||'')+' emitida'+((r&&r.aviso)?' · '+r.aviso:''));render();})
   .catch(function(e){S.bz=false;m.err=(e&&e.message)||'No se pudo emitir la factura';render();});};}
var prevB=window.BINDX;
window.BINDX=function(){if(prevB){try{prevB();}catch(e1){console.error(e1);}}try{enlaza();}catch(e2){console.error(e2);}};
}catch(e){console.error('nueva factura',e);}
})();

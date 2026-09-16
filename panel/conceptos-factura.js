var CEX={rows:[],sug:[]};
function cexSet(r){CEX.rows=(r&&r.length)?r.map(function(x){return {c:(x.concepto!=null?x.concepto:x.c)||'',i:(x.importe!=null?x.importe:x.i),k:(x.cuenta!=null?x.cuenta:x.k)||''};}):[];}
function cexSum(){var t=0;CEX.rows.forEach(function(r){t+=Number(r.i)||0;});return Math.round(t*100)/100;}
function cexTxt(){if(!CEX.rows.length)return 'Sin conceptos aparte: el total tiene que salir de base + IGIC - retencion.';return 'Otros conceptos: '+eu2(cexSum())+' (van al total, no a la base ni al IGIC).';}
function cexUI(){
 var h='<div style="margin-top:14px"><label style="font-size:12px;color:var(--mute)">Otros conceptos de la factura: tasas de trafico, financiacion del bono social, alquiler de contador... Suman al total pero no llevan IGIC.</label><div>';
 for(var i=0;i<CEX.rows.length;i++){var r=CEX.rows[i];
  h+='<div class="fg" style="margin-top:6px;grid-template-columns:1.6fr 1fr 1fr auto;gap:8px;align-items:end">'
   +'<div class="fi"><label>Concepto</label><input class="cex_c" data-i="'+i+'" value="'+es(r.c||'')+'"></div>'
   +'<div class="fi"><label>Importe</label><input class="cex_i" data-i="'+i+'" type="number" step="0.01" value="'+(r.i!=null?r.i:'')+'"></div>'
   +'<div class="fi"><label>Cuenta</label><input class="cex_k" data-i="'+i+'" placeholder="la del proveedor" value="'+es(r.k||'')+'"></div>'
   +'<button class="mc" data-cexdel="'+i+'" style="height:38px;padding:0 12px">Quitar</button></div>';}
 h+='</div><div class="mi" id="cex_res" style="margin-top:6px">'+cexTxt()+'</div>'
  +'<button class="mc" data-cexadd style="margin-top:8px">+ Anadir concepto</button>';
 var puestos={},j;
 for(j=0;j<CEX.rows.length;j++){puestos[String(CEX.rows[j].c||'').toLowerCase()]=1;}
 for(j=0;j<CEX.sug.length;j++){var s=CEX.sug[j];
  if(puestos[String(s.concepto||'').toLowerCase()])continue;
  h+='<button class="mc" data-cexsug="'+j+'" style="margin-top:8px;margin-left:6px">+ '+es(s.concepto)+'</button>';}
 return h+'</div>';}
function cexLee(){
 document.querySelectorAll('.cex_c').forEach(function(x){var i=+x.getAttribute('data-i');if(CEX.rows[i])CEX.rows[i].c=x.value;});
 document.querySelectorAll('.cex_i').forEach(function(x){var i=+x.getAttribute('data-i');if(CEX.rows[i])CEX.rows[i].i=x.value;});
 document.querySelectorAll('.cex_k').forEach(function(x){var i=+x.getAttribute('data-i');if(CEX.rows[i])CEX.rows[i].k=x.value;});}
function cexBind(){
 if(q('[data-cexadd]'))q('[data-cexadd]').onclick=function(){cexLee();CEX.rows.push({c:'',i:'',k:''});render();};
 document.querySelectorAll('[data-cexdel]').forEach(function(b){b.onclick=function(){cexLee();CEX.rows.splice(+b.getAttribute('data-cexdel'),1);render();};});
 document.querySelectorAll('[data-cexsug]').forEach(function(b){b.onclick=function(){cexLee();
  var s=CEX.sug[+b.getAttribute('data-cexsug')]||{};CEX.rows.push({c:s.concepto||'',i:'',k:s.cuenta||''});render();};});
 document.querySelectorAll('.cex_c,.cex_i,.cex_k').forEach(function(x){x.addEventListener('input',function(){
  cexLee();var e=q('#cex_res');if(e)e.textContent=cexTxt();if(typeof fcChk==='function')fcChk();});});
 var pv=q('#c_prov');
 if(pv)pv.addEventListener('change',function(){ var id=pv.value;
  if(!id){CEX.sug=[];render();return;}
  rest('proveedores_conceptos?select=concepto,cuenta&proveedor_id=eq.'+id+'&order=orden')
   .then(function(sg){CEX.sug=sg||[];render();}).catch(function(){});});}
function cexPayload(){cexLee();return CEX.rows.filter(function(r){return String(r.c||'').trim()!==''&&(Number(r.i)||0)!==0;})
 .map(function(r){return {concepto:String(r.c).trim(),importe:Number(r.i)||0,cuenta:String(r.k||'').trim()||null};});}

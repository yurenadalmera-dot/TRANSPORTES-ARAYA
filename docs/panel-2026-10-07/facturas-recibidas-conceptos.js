/* ===== Conceptos de la factura recibida: cada uno con su importe, su descuento y su tipo de IGIC (o sin IGIC) ===== */
var CFL={rows:[],ret:'no',totMan:false};
var CFL_TIPOS=[['7','7 %'],['3','3 %'],['0','0 % (exento)'],['9.5','9,5 %'],['15','15 %'],['20','20 %'],['ns','Sin IGIC (tasas, bono social...)']];
var CFL_RET=[['no','No lleva'],['15','15 % (profesional)'],['7','7 % (profesional, inicio actividad)'],['19','19 % (alquiler)'],['1','1 % (modulos)'],['otro','Otro importe']];
var CFL_CAMPOS={c_prov:'proveedor_id',c_num:'numero_factura',c_fec:'fecha',c_ven:'fecha_vencimiento',c_bas:'base_imponible',c_por:'portes',c_igi:'igic',c_ret:'retencion',c_tot:'total',c_fpg:'forma_pago',c_dto:'descuento',c_dtt:'descuento_tipo',c_cto:'referencia_contrato'};
function cflR(n){n=Number(n)||0;return Math.round((n+(n<0?-1:1)*1e-9)*100)/100;}
function cflFila(o){o=o||{};return {c:o.c||'',i:(o.i!=null?o.i:''),d:((o.d!=null&&Number(o.d)!==0)?o.d:''),t:((o.t!=null&&o.t!=='')?String(o.t):'7'),k:o.k||''};}
function cflIni(f){f=f||{};CFL.rows=[];CFL.totMan=!!f.id;
 var r=Number(f.retencion)||0,b=Number(f.base_imponible)||0,m='no';
 if(r){m='otro';['15','7','19','1'].forEach(function(p){if(m==='otro'&&b&&Math.abs(cflR(b*Number(p)/100)-r)<=0.01)m=p;});}
 CFL.ret=m;}
function cflLee(){
 document.querySelectorAll('[data-cfl]').forEach(function(x){var i=+x.getAttribute('data-i');if(CFL.rows[i])CFL.rows[i][x.getAttribute('data-cfl')]=x.value;});
 var p=q('#c_rtp');if(p)CFL.ret=p.value;}
function cflSum(){var g={},ex=0,dt=0,n=0;
 CFL.rows.forEach(function(r){var im=Number(r.i)||0,de=Number(r.d)||0,ne=cflR(im-de);
  if(!im&&!de)return;dt+=de;
  if(r.t==='ns'){ex+=ne;return;}
  n++;var t=String(Number(r.t)||0);g[t]=(g[t]||0)+ne;});
 var b=0,c=0,ds=[];
 Object.keys(g).forEach(function(t){var bb=cflR(g[t]),cc=cflR(bb*Number(t)/100);b+=bb;c+=cc;if(bb!==0)ds.push({tipo:Number(t),base:bb});});
 return {n:n,b:cflR(b),g:cflR(c),x:cflR(ex),d:cflR(dt),ds:ds};}
function cflCuadra(ig,cx){var s=cflSum(),m={},ok=true,x=0;
 (ig||[]).forEach(function(g){var k=String(Number(g.tipo));m[k]=cflR((m[k]||0)+(Number(g.base)||0));});
 s.ds.forEach(function(d){var k=String(d.tipo);if(Math.abs((m[k]||0)-d.base)>0.01)ok=false;m[k]=0;});
 Object.keys(m).forEach(function(k){if(m[k])ok=false;});
 (cx||[]).forEach(function(c){x+=Number(c.importe)||0;});
 return ok&&Math.abs(cflR(x)-s.x)<=0.01;}
function cflSet(det,ig,cx){var rs=[];
 if(det&&det.length){det.forEach(function(x){rs.push(cflFila({c:x.concepto,i:x.importe,d:x.descuento,t:x.tipo,k:x.cuenta}));});
  CFL.rows=rs;if(cflCuadra(ig,cx))return;rs=[];}
 (ig||[]).forEach(function(g){rs.push(cflFila({c:'',i:g.base,t:g.tipo}));});
 (cx||[]).forEach(function(x){rs.push(cflFila({c:x.concepto,i:x.importe,t:'ns',k:x.cuenta}));});
 CFL.rows=rs;}
function cflKeep(){cflLee();if(!S.md||S.md.t!=='edfc')return;
 if(!S.md._cp){var o=S.md.f||{},c={};for(var k in o)c[k]=o[k];S.md.f=c;S.md._cp=1;}
 for(var id in CFL_CAMPOS){var e=q('#'+id);if(e)S.md.f[CFL_CAMPOS[id]]=e.value;}}
function cflCarga(f){if(!f||!f.id)return;
 var nada=function(){return [];};
 Promise.all([rest('facturas?select=conceptos_detalle&id=eq.'+f.id).catch(nada),
  rest('facturas_igic?select=tipo,base&factura_id=eq.'+f.id+'&order=tipo').catch(nada),
  rest('facturas_conceptos?select=concepto,importe,cuenta&factura_id=eq.'+f.id+'&order=orden').catch(nada)])
 .then(function(a){if(!(S.md&&S.md.t==='edfc'&&S.md.f&&S.md.f.id===f.id))return;
  var dt=(a[0]&&a[0][0]&&a[0][0].conceptos_detalle)||null;
  if(typeof dt==='string'){try{dt=JSON.parse(dt);}catch(ex){dt=null;}}
  cflKeep();cflSet(dt,a[1],a[2]);if(CFL.rows.length)render();});}
function cflTxt(s){
 if(!CFL.rows.length)return 'Sin conceptos: rellena arriba la base y el IGIC. Anade conceptos si la factura trae varios tipos de IGIC, descuentos por linea o importes sin IGIC (tasas, bono social...).';
 return 'Base '+eu2(s.b)+' · IGIC '+eu2(s.g)+(s.x?' · Sin IGIC '+eu2(s.x):'')+(s.d?' · Descuentos '+eu2(s.d):'')
  +(s.n?'':' · la base y el IGIC de arriba se rellenan a mano');}
function cflRetUI(f){var m=CFL.ret||'no';
 return '<div class="fi"><label>Retencion IRPF</label><div style="display:flex;gap:6px">'
  +'<select id="c_rtp" style="flex:1.5;min-width:0">'+CFL_RET.map(function(z){return '<option value="'+z[0]+'"'+(m===z[0]?' selected':'')+'>'+z[1]+'</option>';}).join('')+'</select>'
  +'<input id="c_ret" type="number" step="0.01" style="flex:1;min-width:0" value="'+((f.retencion!=null&&f.retencion!=='')?es(f.retencion):'')+'"></div></div>';}
function cflUI(){
 var h='<div style="margin-top:14px"><label style="font-size:12px;color:var(--mute)">Conceptos de la factura: cada uno con su importe, su descuento y su tipo de IGIC. Las tasas, el bono social o el alquiler de contador van como "Sin IGIC", con su cuenta.</label><div>';
 for(var i=0;i<CFL.rows.length;i++){var r=CFL.rows[i],ns=r.t==='ns',ops=CFL_TIPOS.slice();
  if(!ops.some(function(z){return z[0]===String(r.t);}))ops.unshift([String(r.t),String(r.t).replace('.',',')+' %']);
  h+='<div style="margin-top:8px;padding:8px;border:1px solid var(--line,#e3e3e8);border-radius:8px">'
   +'<div class="fg" style="grid-template-columns:1fr auto;gap:8px;align-items:end">'
   +'<div class="fi"><label>Concepto</label><input data-cfl="c" data-i="'+i+'" placeholder="p. ej. mano de obra, material, tasa de trafico" value="'+es(r.c||'')+'"></div>'
   +'<button class="mc" data-cfldel="'+i+'" style="height:38px;padding:0 12px">Quitar</button></div>'
   +'<div class="fg" style="margin-top:6px;grid-template-columns:repeat('+(ns?4:3)+',minmax(0,1fr));gap:8px;align-items:end">'
   +'<div class="fi"><label>Base imponible</label><input data-cfl="i" data-i="'+i+'" type="number" step="0.01" value="'+es(r.i)+'"></div>'
   +'<div class="fi"><label>Descuento</label><input data-cfl="d" data-i="'+i+'" type="number" step="0.01" placeholder="0,00" value="'+es(r.d)+'"></div>'
   +'<div class="fi"><label>IGIC</label><select data-cfl="t" data-i="'+i+'">'+ops.map(function(z){return '<option value="'+z[0]+'"'+(String(r.t)===z[0]?' selected':'')+'>'+z[1]+'</option>';}).join('')+'</select></div>'
   +(ns?'<div class="fi"><label>Cuenta</label><input data-cfl="k" data-i="'+i+'" placeholder="la del proveedor" value="'+es(r.k||'')+'"></div>':'')
   +'</div></div>';}
 h+='</div><div class="mi" id="cfl_res" style="margin-top:6px">'+cflTxt(cflSum())+'</div>'
  +'<button class="mc" data-cfladd style="margin-top:8px">+ Anadir concepto</button>';
 var puestos={},j;
 for(j=0;j<CFL.rows.length;j++){puestos[String(CFL.rows[j].c||'').toLowerCase()]=1;}
 for(j=0;j<CEX.sug.length;j++){var s=CEX.sug[j];
  if(puestos[String(s.concepto||'').toLowerCase()])continue;
  h+='<button class="mc" data-cflsug="'+j+'" style="margin-top:8px;margin-left:6px">+ '+es(s.concepto)+'</button>';}
 return h+'</div>';}
function cflCalc(){cflLee();
 var s=cflSum(),au=s.n>0,B=q('#c_bas'),G=q('#c_igi'),D=q('#c_dto'),R=q('#c_ret'),T=q('#c_tot'),m=CFL.ret||'no';
 [B,G,D].forEach(function(e){if(e){e.readOnly=au;e.style.opacity=au?'.7':'';}});
 if(au){if(B)B.value=s.b.toFixed(2);if(G)G.value=s.g.toFixed(2);if(D)D.value=s.d?s.d.toFixed(2):'';}
 var base=parseFloat((B||{}).value)||0;
 if(R){R.readOnly=(m!=='otro');R.style.opacity=R.readOnly?'.7':'';
  if(m==='no')R.value='';else if(m!=='otro')R.value=cflR(base*Number(m)/100).toFixed(2);}
 var ret=parseFloat((R||{}).value)||0;
 if(T&&au&&!CFL.totMan)T.value=cflR(s.b+s.g+s.x-ret).toFixed(2);
 var e=q('#cfl_res');if(e)e.textContent=cflTxt(s);
 if(typeof fcChk==='function')fcChk();}
function cflBind(){
 if(q('[data-cfladd]'))q('[data-cfladd]').onclick=function(){cflKeep();CFL.rows.push(cflFila());render();};
 document.querySelectorAll('[data-cfldel]').forEach(function(b){b.onclick=function(){cflKeep();CFL.rows.splice(+b.getAttribute('data-cfldel'),1);render();};});
 document.querySelectorAll('[data-cflsug]').forEach(function(b){b.onclick=function(){cflKeep();
  var s=CEX.sug[+b.getAttribute('data-cflsug')]||{};CFL.rows.push(cflFila({c:s.concepto,t:'ns',k:s.cuenta}));render();};});
 document.querySelectorAll('[data-cfl]').forEach(function(x){
  if(x.getAttribute('data-cfl')==='t')x.addEventListener('change',function(){cflKeep();render();});
  else x.addEventListener('input',cflCalc);});
 var P=q('#c_rtp');if(P)P.addEventListener('change',cflCalc);
 var B=q('#c_bas');if(B)B.addEventListener('input',cflCalc);
 var T=q('#c_tot');if(T)T.addEventListener('input',function(){CFL.totMan=T.value!=='';});
 var pv=q('#c_prov');
 if(pv)pv.addEventListener('change',function(){var id=pv.value;cflKeep();
  if(S.md&&S.md.f)S.md.f.proveedor_id=id||null;
  var z=(S.d.pv||[]).filter(function(p){return p.id===id;})[0];
  if(z&&!(S.md&&S.md.f&&S.md.f.id)&&CFL.ret==='no'){var mr=String(z.modelo_retencion||'');if(mr==='111')CFL.ret='15';else if(mr==='115')CFL.ret='19';}
  if(!id){CEX.sug=[];render();return;}
  rest('proveedores_conceptos?select=concepto,cuenta&proveedor_id=eq.'+id+'&order=orden')
   .then(function(sg){CEX.sug=sg||[];cflKeep();render();}).catch(function(){render();});});
 cflCalc();}
function cflExtras(){cflLee();
 return CFL.rows.filter(function(r){return r.t==='ns'&&cflR((Number(r.i)||0)-(Number(r.d)||0))!==0;})
 .map(function(r){return {concepto:String(r.c||'').trim()||'Otros conceptos',importe:cflR((Number(r.i)||0)-(Number(r.d)||0)),cuenta:String(r.k||'').trim()||null};});}
function cflDetalle(){cflLee();
 return CFL.rows.filter(function(r){return String(r.c||'').trim()!==''||(Number(r.i)||0)!==0;})
 .map(function(r){return {concepto:String(r.c||'').trim(),importe:Number(r.i)||0,descuento:Number(r.d)||0,tipo:r.t==='ns'?'ns':(Number(r.t)||0),cuenta:String(r.k||'').trim()||null};});}

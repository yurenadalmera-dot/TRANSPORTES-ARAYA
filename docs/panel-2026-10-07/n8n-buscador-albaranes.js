// Buscador libre en Albaranes de servicio (07/10/2026). Va despues de la capa de filtros de "Construir panel":
// primero busca el texto en todos los campos del albaran y luego los filtros de siempre trabajan sobre lo encontrado.
// Tambien hace que los albaranes anulados (columna anulado, funcion anular_albaran) se traten como anulados en la
// capa de filtros: etiqueta ANULADO, fuera de los totales y sin poder facturarlos; y pone el motivo y quien lo anulo.
// Si algo falla, se sirve el panel sin el buscador. Para quitarlo: dejar este nodo en   return [{json:{html: $json.html}}];
function busca(){
if(window.__BUSX)return;window.__BUSX='1';
if(typeof S==='undefined'||typeof render!=='function'||typeof vAlb!=='function')return;
window.VX=window.VX||{};
var B={q:''},tmr=null,foco=false,pos=0;
function nrm(s){s=String(s==null?'':s).toLowerCase();try{s=s.normalize('NFD').replace(/[\u0300-\u036f]/g,'');}catch(e){}return s;}
function fecha(f){var p=String(f||'').slice(0,10).split('-');return p.length===3?(p[2]+'/'+p[1]+'/'+p[0]):'';}
function texto(a){var t=[],k,v;
 for(k in a){v=a[k];if(v==null)continue;
  if(typeof v==='string'||typeof v==='number')t.push(String(v));
  else if(typeof v==='object'){try{t.push(JSON.stringify(v));}catch(e){}}}
 t.push(fecha(a.fecha));
 if(a.total!=null)t.push((Number(a.total)||0).toFixed(2).replace('.',','));
 return nrm(t.join(' | '));}
function casa(a,ws){var h=texto(a),i;for(i=0;i<ws.length;i++){if(h.indexOf(ws[i])<0)return false;}return true;}
function caja(n,total){
 return '<div class="fts" style="gap:10px;flex-wrap:wrap;border-bottom:0;padding-bottom:0">'
  +'<input id="busx_q" type="search" autocomplete="off" placeholder="Buscar en los albaranes: numero, cliente, obra, matricula, conductor, material, notas, fecha..." value="'+es(B.q)+'"'
  +' style="flex:1;min-width:220px;font-size:13px;border:1px solid var(--line);border-radius:8px;padding:8px 12px;background:#fff">'
  +(B.q?'<span class="cnt" style="color:var(--mute)">'+n+' de '+total+' coinciden</span><button class="ac" data-busxclr>Borrar busqueda</button>':'')
  +'</div>';}
function meter(html,c){
 var i=html.indexOf('<div class="fts"');
 if(i>=0)return html.slice(0,i)+c+html.slice(i);
 var j=html.indexOf('<div class="ch">');if(j<0)return c+html;
 var k=html.indexOf('</div>',j);return k<0?c+html:html.slice(0,k+6)+c+html.slice(k+6);}
function norm(){((S.d&&S.d.al)||[]).forEach(function(a){if(a&&a.anulado&&a.estado!=='anulado')a.estado='anulado';});}
function fdma(t){var p=String(t||'').slice(0,10).split('-');return p.length===3?(p[2]+'/'+p[1]+'/'+p[0]):'';}
function motivos(){
 var m={},bs=document.querySelectorAll('[data-valb]'),i;
 ((S.d&&S.d.al)||[]).forEach(function(a){if(a&&a.anulado)m[a.id]=a;});
 for(i=0;i<bs.length;i++){
  var a=m[bs[i].getAttribute('data-valb')];if(!a)continue;
  var tr=bs[i];while(tr&&tr.tagName!=='TR')tr=tr.parentNode;if(!tr||tr.getAttribute('data-busxm'))continue;
  var tags=tr.querySelectorAll('.tg'),k,sm=null;
  for(k=0;k<tags.length;k++){if(/ANULADO/.test(tags[k].textContent||'')){sm=tags[k].parentNode.querySelector('.sm');break;}}
  if(!sm)continue;
  tr.setAttribute('data-busxm','1');
  sm.textContent='Anulado'+(a.anulado_por?' por '+a.anulado_por:'')+(a.anulado_at?' el '+fdma(a.anulado_at):'')+(a.motivo_anulacion?' · '+a.motivo_anulacion:'')+' · no facturar';
  sm.style.whiteSpace='normal';}}
var prevMd=window.MDX&&MDX.nfv;
if(prevMd)MDX.nfv=function(m){norm();return prevMd(m);};
var prev=VX.albaranes||function(){return vAlb();};
VX.albaranes=function(){
 norm();
 var all=(S.d&&S.d.al)||[];
 if(!all.length)return prev();
 var ws=nrm(B.q).split(/\s+/).filter(function(w){return !!w;});
 if(!ws.length)return meter(prev(),caja(all.length,all.length));
 var f=all.filter(function(a){return casa(a,ws);});
 if(!f.length)return '<div class="c"><div class="ch"><h2>Albaranes de servicio</h2><span class="m">0 de '+all.length+'</span></div>'
  +caja(0,all.length)+'<div class="emp"><h3>Ningun albaran contiene &laquo;'+es(B.q)+'&raquo;</h3><p>Prueba con otra palabra o borra la busqueda.</p></div></div>';
 var html;S.d.al=f;
 try{html=prev();}finally{S.d.al=all;}
 return meter(html,caja(f.length,all.length));};
function enlaza(){
 if(S.v!=='albaranes')return;
 motivos();
 var e=q('#busx_q');
 if(e){
  e.oninput=function(){B.q=e.value;clearTimeout(tmr);
   tmr=setTimeout(function(){foco=(document.activeElement===e);pos=e.selectionStart||e.value.length;render();},300);};
  e.onkeydown=function(ev){if(ev.key==='Escape'){B.q='';foco=true;pos=0;render();}
   else if(ev.key==='Enter'){ev.preventDefault();clearTimeout(tmr);B.q=e.value;foco=true;pos=e.value.length;render();}};
  if(foco){foco=false;e.focus();try{e.setSelectionRange(pos,pos);}catch(x){}}}
 var b=q('[data-busxclr]');if(b)b.onclick=function(){B.q='';foco=true;pos=0;render();};}
var prevB=window.BINDX;
window.BINDX=function(){
 if(prevB){try{prevB();}catch(e1){console.error(e1);}}
 try{enlaza();}catch(e2){console.error(e2);}};
try{if(S.tk&&S.d&&S.v==='albaranes')render();}catch(e3){console.error(e3);}
}
var html = $json.html;
try {
  if (typeof html === 'string' && html.indexOf('__BUSX') === -1) {
    var i = html.lastIndexOf('</body>');
    if (i > 0) html = html.slice(0, i) + '<script>(' + busca.toString() + ')();</' + 'script>' + html.slice(i);
  }
} catch (e) { html = $json.html; }
return [{ json: { html: html } }];

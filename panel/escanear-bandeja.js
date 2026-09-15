/* ===== Escanear y bandeja, en una sola pantalla ===== */
var EBQ={tab:'escanear'};
function ebBarra(){
 var tabs=[['escanear','Escanear'],['bandeja','Bandeja de escaneo']];
 var h='<div class="c" style="margin-bottom:20px"><div style="padding:12px 16px;display:flex;flex-wrap:wrap;gap:8px;align-items:center">';
 for(var i=0;i<tabs.length;i++)
  h+='<button class="ac'+(EBQ.tab===tabs[i][0]?' ord':'')+'" data-ebtab="'+tabs[i][0]+'">'+tabs[i][1]+'</button>';
 return h+'<span style="flex:1"></span>'
  +'<span class="sm">Escaneas aqui y lo que queda por revisar te espera en la bandeja.</span>'
  +'</div></div>';
}
VX.escanear=function(){
 return ebBarra()+(EBQ.tab==='bandeja'?vBnd():vEsc());
};
VX.bandeja=function(){
 EBQ.tab='bandeja';
 return ebBarra()+vBnd();
};
function bindEscBnd(){
 document.querySelectorAll('[data-ebtab]').forEach(function(b){
  b.onclick=function(){
    EBQ.tab=b.getAttribute('data-ebtab');
    if(S.v!=='escanear'){S.v='escanear';}
    render();};});
}

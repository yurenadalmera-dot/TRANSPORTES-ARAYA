/* ===== Al facturar, los dias de vencimiento del cliente ===== */
function fvDiasCliente(id){
 if(!id)return null;
 var c=((S.d&&S.d.cl)||[]).filter(function(z){return z.id===id;})[0];
 return (c&&c.dias_vencimiento!=null)?c.dias_vencimiento:null;
}
function fvPonVenc(id){
 var d=fvDiasCliente(id);
 if(d==null)return false;
 FV.venc=d;
 var e=q('#v_ven');
 if(e)e.value=d;
 return true;
}
function bindFactVenc(){
 var s=q('#v_cli');
 if(!s)return;
 s.onchange=function(){
  if(typeof fvLee==='function')fvLee();
  FV.cli=s.value;
  FV.sel={};
  if(!fvPonVenc(s.value)&&(FV.venc===''||FV.venc==null))FV.venc=30;
  render();
 };
}

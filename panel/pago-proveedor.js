function pgHoy(){return new Date().toISOString().slice(0,10);}
var PG_MODOS=[['transferencia','Transferencia'],['domiciliado','Domiciliado / recibo'],['tarjeta','Tarjeta'],['efectivo','Efectivo'],['confirming','Confirming']];
function pgModos(sel){var o='',i;for(i=0;i<PG_MODOS.length;i++){o+='<option value="'+PG_MODOS[i][0]+'"'+(sel===PG_MODOS[i][0]?' selected':'')+'>'+PG_MODOS[i][1]+'</option>';}return '<option value="">-- elige --</option>'+o;}

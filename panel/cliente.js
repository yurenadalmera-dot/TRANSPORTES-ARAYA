var VX={},S={},MDX={},document={querySelectorAll:function(){return [];}};
function rest(){return Promise.resolve([]);} function render(){} function es(x){return String(x);}
function fc(x){return String(x);} function q(){return null;} function eu2(x){return String(x);}
function eur(x){return String(x);} function cp(x){return String(x);} function pue(){return true;}
function _n(x){return Number(x)||0;} function toast(){}
/* ===== Ficha de cliente: todo lo del cliente en un solo sitio ===== */
var CF={id:null,ld:false,er:null,c:null,fac:null,cob:null,alb:null,avi:null,tab:'facturas',txt:''};

function abreFicha(id){
 if(!id)return;
 CF.id=id;CF.c=null;CF.fac=null;CF.cob=null;CF.alb=null;CF.avi=null;
 CF.er=null;CF.tab='facturas';CF.txt='';
 S.v='cliente';render();cargaFicha();
}
function cargaFicha(){
 if(CF.ld||!CF.id)return;
 CF.ld=true;CF.er=null;
 var f='cliente_id=eq.'+encodeURIComponent(CF.id);
 Promise.all([
  rest('v_cliente_ficha?select=*&id=eq.'+encodeURIComponent(CF.id)),
  rest('v_facturas_venta?select=*&'+f+'&order=fecha.desc&limit=500'),
  rest('cobros?select=*&'+f+'&order=fecha.desc&limit=300'),
  rest('albaranes?select=*&'+f+'&order=fecha.desc&limit=300'),
  rest('avisos_cobro?select=*&'+f+'&order=enviado_at.desc&limit=50').catch(function(){return [];})
 ]).then(function(a){
  CF.c=(a[0]||[])[0]||null;CF.fac=a[1]||[];CF.cob=a[2]||[];CF.alb=a[3]||[];CF.avi=a[4]||[];
  CF.ld=false;render();
 }).catch(function(e){CF.ld=false;CF.er=e.message||'No se pudo cargar la ficha';render();});
}
function cfEstado(x){
 var ef=x.estado_factusol||'';
 if(x.estado==='anulada')return '<span class="tg t-otro">anulada</span>';
 if(ef==='devuelta')return '<span class="tg t-impuesto">devuelta</span>';
 if(ef==='impagada')return '<span class="tg t-impuesto">impagada</span>';
 if(x.estado==='cobrada')return '<span class="tg t-proveedor">cobrada</span>';
 var pa=(_n(x.cobrado)>0&&_n(x.pendiente)>0)?' <span class="tg t-suministro">parcial</span>':'';
 if(x.vencida)return '<span class="tg t-impuesto">vencida'+(_n(x.dias_vencida)>0?' '+x.dias_vencida+'d':'')+'</span>'+pa;
 if(pa)return '<span class="tg t-otro">pendiente</span>'+pa;
 return '<span class="tg t-otro">pendiente</span>';
}

VX.cliente=function(){
 if(!CF.id)return '<div class="c"><div class="emp"><h3>Ningun cliente seleccionado</h3><p>Entra desde la lista de clientes.</p></div></div>';
 var vol='<button class="ac" data-cfvol>&#8592; Volver a clientes</button>';
 if(CF.er)return '<div class="c"><div class="ch"><h2>Ficha de cliente</h2>'+vol+'</div><div class="emp"><h3>No se pudo cargar</h3><p>'+es(CF.er)+'</p></div></div>';
 if(!CF.c)return '<div class="c"><div class="ch"><h2>Ficha de cliente</h2>'+vol+'</div><div class="emp"><h3>Cargando...</h3><p>Un momento.</p></div></div>';

 var c=CF.c,fa=CF.fac||[],co=CF.cob||[],al=CF.alb||[],av=CF.avi||[];
 var sinFac=al.filter(function(a){return a.estado!=='facturado';}).length;

 var h='<div class="c"><div class="ch"><h2>'+es(c.nombre||'')+'</h2>'
  +'<span class="m">'+es(cp(c.tipo||'cliente'))+(c.activo?'':' · dado de baja')+(c.codigo_externo?' · codigo '+es(c.codigo_externo):'')+'</span>'
  +vol
  +(pue()?'<button class="ac" data-edc="'+es(c.id)+'" style="margin-left:6px">Editar datos</button>':'')
  +(pue()?'<button class="ac" data-clic="'+es(c.id)+'" style="margin-left:6px">Condiciones de cobro</button>':'')
  +(pue()?'<button class="addb" data-nab="'+es(c.id)+'">+ Nuevo albaran</button>':'')
  +'</div>';

 h+='<div class="kp" style="margin:16px 0">'
  +'<div class="k hero"><div class="l">Pendiente de cobro</div><div class="v">'+eur(_n(c.pendiente))+'</div><div class="s">'+_n(c.n_pendientes)+' facturas'+(_n(c.n_vencidas)?' · '+_n(c.n_vencidas)+' vencidas por '+eur(_n(c.vencido)):'')+'</div></div>'
  +'<div class="k"><div class="l">Facturado</div><div class="v">'+eur(_n(c.facturado_total))+'</div><div class="s">'+_n(c.n_facturas)+' facturas'+(c.primera_factura?' desde '+fc(c.primera_factura):'')+'</div></div>'
  +'<div class="k"><div class="l">Facturado este ano</div><div class="v">'+eur(_n(c.facturado_anio))+'</div><div class="s">'+(c.ultima_factura?'ultima el '+fc(c.ultima_factura):'sin facturas')+'</div></div>'
  +'<div class="k"><div class="l">Cobrado</div><div class="v">'+eur(_n(c.cobrado_total))+'</div><div class="s">'+(c.ultimo_cobro?'ultimo el '+fc(c.ultimo_cobro):'sin cobros registrados')+'</div></div>'
  +'</div>';

 if(_n(c.n_incidencias))
  h+='<div class="note" style="background:#FBE9E9;border-color:#F0C4C4;color:#8E2C2C"><b>'+_n(c.n_incidencias)+' facturas devueltas o impagadas</b> por '+eu2(c.importe_incidencias)+' EUR. Estan marcadas en la lista de abajo.</div>';
 if(sinFac)
  h+='<div class="note" style="margin-top:10px">Tiene <b>'+sinFac+' albaranes entregados sin facturar</b>. Ese dinero todavia no esta reclamado.</div>';

 var dat=function(l,v){return '<div class="mi"><span class="l">'+l+'</span> '+(v?es(v):'<span style="color:var(--mute)">sin definir</span>')+'</div>';};
 h+='<div class="tw" style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px;overflow:visible">'
  +'<div><label>Datos</label>'
   +dat('CIF',c.cif)+dat('Telefono',c.telefono)+dat('Correo',c.email)
   +dat('Direccion',c.direccion)+dat('Subcuenta',c.subcuenta)
  +'</div>'
  +'<div><label>Condiciones de cobro</label>'
   +dat('Forma de pago',c.forma_pago?cp(c.forma_pago):'')
   +dat('Dias de vencimiento',c.dias_vencimiento==null?'':String(c.dias_vencimiento))
   +dat('Dia de pago',c.dia_pago==null?'':String(c.dia_pago))
   +dat('Correo de avisos',c.email_cobros)
   +dat('Avisar de vencidas',c.avisar_cobro?'si':'no')
   +(c.ultimo_aviso?dat('Ultimo aviso enviado',fc(String(c.ultimo_aviso).slice(0,10))):'')
  +'</div></div>';

 var bt=function(k,t,n){return '<button class="ac'+(CF.tab===k?' on':'')+'" data-cftab="'+k+'" style="margin-left:6px">'+t+' ('+n+')</button>';};
 h+='<div class="ch" style="margin-top:20px"><h2>Movimiento del cliente</h2><div>'
  +bt('facturas','Facturas',fa.length)+bt('cobros','Cobros',co.length)
  +bt('albaranes','Albaranes',al.length)+bt('avisos','Avisos',av.length)
  +(CF.tab==='facturas'?'<input id="cf_txt" placeholder="Buscar numero" value="'+es(CF.txt)+'" style="max-width:180px;margin-left:6px">':'')
  +'</div></div>';

 if(CF.tab==='facturas'){
  var t=String(CF.txt||'').toLowerCase().trim();
  var lf=t?fa.filter(function(x){return String(x.numero_factura||'').toLowerCase().indexOf(t)>=0;}):fa;
  if(!lf.length)return h+'<div class="emp"><h3>Sin facturas</h3><p>Este cliente todavia no tiene facturas emitidas.</p></div></div>';
  var tb=0,tc=0,tp=0;
  h+='<div class="tw" style="margin-top:12px"><table><thead><tr><th>Numero</th><th>Fecha</th><th>Vencimiento</th><th class="r">Base</th><th class="r">IGIC</th><th class="r">Total</th><th class="r">Cobrado</th><th class="r">Pendiente</th><th>Estado</th></tr></thead><tbody>';
  for(var i=0;i<lf.length;i++){var x=lf[i];
   tb+=_n(x.base_imponible);tc+=_n(x.cobrado);tp+=_n(x.pendiente);
   h+='<tr><td class="nm">'+es(x.numero_factura||'')+(x.rectifica_numero?'<div class="sm">rectifica '+es(x.rectifica_numero)+'</div>':'')+'</td>'
    +'<td class="nu">'+fc(x.fecha)+'</td><td class="nu">'+(x.fecha_vencimiento?fc(x.fecha_vencimiento):'-')+'</td>'
    +'<td class="r nu">'+eu2(x.base_imponible)+'</td><td class="r nu">'+eu2(x.igic)+'</td>'
    +'<td class="r nu"><b>'+eu2(x.total)+'</b></td><td class="r nu">'+eu2(x.cobrado)+'</td>'
    +'<td class="r nu">'+eu2(x.pendiente)+'</td><td>'+cfEstado(x)+'</td></tr>';
  }
  h+='</tbody><tfoot><tr class="tot"><td colspan="3">'+lf.length+' facturas</td><td class="r nu">'+eu2(tb)+'</td><td></td><td class="r nu">'+eu2(lf.reduce(function(s,x){return s+_n(x.total);},0))+'</td><td class="r nu">'+eu2(tc)+'</td><td class="r nu">'+eu2(tp)+'</td><td></td></tr></tfoot></table></div>';
  return h+'</div>';
 }

 if(CF.tab==='cobros'){
  if(!co.length)return h+'<div class="emp"><h3>Sin cobros</h3><p>Todavia no hay ningun cobro registrado de este cliente.</p></div></div>';
  h+='<div class="tw" style="margin-top:12px"><table><thead><tr><th>Fecha</th><th class="r">Importe</th><th>Metodo</th><th>Referencia</th><th>Conciliado</th></tr></thead><tbody>';
  for(var j=0;j<co.length;j++){var k=co[j];
   h+='<tr><td class="nu">'+fc(k.fecha)+'</td><td class="r nu"><b>'+eu2(k.importe)+'</b></td>'
    +'<td>'+es(cp(k.metodo||''))+'</td><td class="nu">'+es(k.referencia||'-')+'</td>'
    +'<td>'+(k.conciliado?'<span class="tg t-proveedor">si</span>':'<span class="tg t-otro">no</span>')+'</td></tr>';
  }
  return h+'</tbody><tfoot><tr class="tot"><td>'+co.length+' cobros</td><td class="r nu">'+eu2(co.reduce(function(s,x){return s+_n(x.importe);},0))+'</td><td colspan="3"></td></tr></tfoot></table></div></div>';
 }

 if(CF.tab==='albaranes'){
  if(!al.length)return h+'<div class="emp"><h3>Sin albaranes</h3><p>Este cliente no tiene albaranes de servicio.</p></div></div>';
  h+='<div class="tw" style="margin-top:12px"><table><thead><tr><th>Numero</th><th>Fecha</th><th>Origen</th><th>Destino</th><th>Matricula</th><th>Estado</th><th class="r">DeCA</th></tr></thead><tbody>';
  for(var m2=0;m2<al.length;m2++){var a=al[m2];
   h+='<tr><td class="nm">'+es(a.numero||'')+'</td><td class="nu">'+fc(a.fecha)+'</td>'
    +'<td>'+es(a.origen||'-')+'</td><td>'+es(a.destino||'-')+'</td>'
    +'<td class="nu">'+es(a.matricula||'-')+'</td>'
    +'<td><span class="tg t-'+(a.estado==='facturado'?'proveedor':'otro')+'">'+es(cp(a.estado||''))+'</span></td>'
    +'<td class="r">'+(a.deca_url?'<a class="ac" href="'+es(a.deca_url)+'" target="_blank" rel="noopener">Ver DeCA</a>':'-')+'</td></tr>';
  }
  return h+'</tbody></table></div></div>';
 }

 if(!av.length)return h+'<div class="emp"><h3>Sin avisos</h3><p>Todavia no se le ha enviado ningun recordatorio de pago.</p></div></div>';
 h+='<div class="tw" style="margin-top:12px"><table><thead><tr><th>Enviado</th><th>Destinatario</th><th>Asunto</th><th class="r">Facturas</th><th class="r">Importe</th><th>Estado</th></tr></thead><tbody>';
 for(var p2=0;p2<av.length;p2++){var v2=av[p2];
  h+='<tr><td class="nu">'+fc(String(v2.enviado_at||'').slice(0,10))+'</td>'
   +'<td class="nu">'+es(v2.destinatario||'')+'</td><td>'+es(v2.asunto||'')+'</td>'
   +'<td class="r nu">'+_n(v2.n_facturas)+'</td><td class="r nu">'+eu2(v2.importe)+'</td>'
   +'<td><span class="tg t-'+(v2.estado==='enviado'?'proveedor':'impuesto')+'">'+es(v2.estado||'')+'</span></td></tr>';
 }
 return h+'</tbody></table></div></div>';
};

function bindCliente(){
 if(q('[data-cfvol]'))q('[data-cfvol]').onclick=function(){S.v='clientes';render();};
 document.querySelectorAll('[data-cftab]').forEach(function(b){b.onclick=function(){
   CF.tab=b.getAttribute('data-cftab');render();};});
 if(q('#cf_txt')){var ct=q('#cf_txt');ct.oninput=function(){CF.txt=ct.value;};
   ct.onkeydown=function(ev){if(ev.key==='Enter'){CF.txt=ct.value;render();
     setTimeout(function(){var x=q('#cf_txt');if(x){x.focus();try{x.setSelectionRange(x.value.length,x.value.length);}catch(_e){}}},0);}};}
 document.querySelectorAll('[data-cfver]').forEach(function(b){b.onclick=function(){
   abreFicha(b.getAttribute('data-cfver'));};});
}

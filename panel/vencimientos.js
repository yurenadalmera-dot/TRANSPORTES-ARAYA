/* ===== Vencimientos de cobro por cliente ===== */
var VEN={ld:false,er:null,ts:0,lista:null,tab:'faltan',txt:''};
function cargaVenc(force){
 if(VEN.ld)return;
 if(!force&&VEN.lista&&(Date.now()-VEN.ts)<180000)return;
 VEN.ld=true;VEN.er=null;
 rest('v_clientes_vencimientos?select=*&facturas_24m=gt.0&order=facturado_24m.desc.nullslast&limit=800')
 .then(function(l){VEN.lista=l||[];VEN.ts=Date.now();VEN.ld=false;render();})
 .catch(function(e){VEN.ld=false;VEN.er=e.message||'No se pudo cargar la lista';render();});
}
function venCli(id){
 var l=VEN.lista||[];
 for(var i=0;i<l.length;i++)if(l[i].id===id)return l[i];
 return null;
}
function venAbre(id){
 var c=(typeof CF!=='undefined'&&CF.c&&CF.c.id===id)?CF.c:null;
 if(!c)c=venCli(id);
 if(!c)c=((S.d&&S.d.cl)||[]).filter(function(z){return z.id===id;})[0]||null;
 if(c){S.md={t:'clicob',c:c};render();return;}
 rest('clientes?select=*&id=eq.'+encodeURIComponent(id))
 .then(function(a){
   var x=(a||[])[0];
   if(!x){toast('No encuentro ese cliente');return;}
   S.md={t:'clicob',c:x};render();})
 .catch(function(e){toast(e.message||'No se pudo abrir');});
}
function venGuardaDias(c,dias){
 S.bz=true;render();
 rpc('guardar_condiciones_cliente',{p_usuario:S.us.id,p_cliente:c.id,p_datos:{
   forma_pago:c.forma_pago||'',
   dias_vencimiento:String(dias),
   dia_pago:(c.dia_pago!=null?String(c.dia_pago):''),
   email_cobros:c.email_cobros||'',
   avisar_cobro:(c.avisar_cobro!==false)
 }})
 .then(function(){toast(dias+' dias guardados en '+(c.nombre||'el cliente'));
   S.bz=false;VEN.lista=null;cargaVenc(true);})
 .catch(function(e){S.bz=false;toast(e.message);render();});
}
function venFiltra(){
 var l=VEN.lista||[], t=VEN.tab, s=(VEN.txt||'').toLowerCase().trim();
 var r=l.filter(function(c){
   if(t==='faltan')return c.dias_vencimiento==null;
   if(t==='puestos')return c.dias_vencimiento!=null;
   return true;
 });
 if(s)r=r.filter(function(c){return ((c.nombre||'')+' '+(c.cif||'')).toLowerCase().indexOf(s)>=0;});
 return r;
}
function venFila(c){
 var sug=c.dias_sugeridos, re=c.dias_reales;
 var real=(re==null)?'<span class="sm">sin historial</span>'
   :(re+' d <span class="sm">('+c.cobradas_36m+' facturas)</span>');
 var puesto=(c.dias_vencimiento!=null)
   ?'<span class="tg t-ok">'+c.dias_vencimiento+' dias</span>'
   :'<span class="tg t-otro">sin poner</span>';
 var acc='';
 if(c.dias_vencimiento==null&&sug!=null)
   acc='<button class="ac" data-vensug="'+es(c.id)+'" data-vend="'+sug+'">Poner '+sug+' d</button>';
 return '<tr><td class="nm">'+es(c.nombre||'')+'</td>'
  +'<td class="r nu">'+eur(_n(c.facturado_24m))+'</td>'
  +'<td class="r nu">'+_n(c.facturas_24m)+'</td>'
  +'<td class="r nu">'+(_n(c.pendiente)?eur(_n(c.pendiente)):'—')+'</td>'
  +'<td class="r">'+real+'</td>'
  +'<td>'+puesto+'</td>'
  +'<td>'+(c.forma_pago?es(cp(c.forma_pago)):'<span class="sm">—</span>')+'</td>'
  +'<td class="r">'+acc
  +'<button class="ac" data-clic="'+es(c.id)+'" style="margin-left:6px">Editar</button>'
  +'<button class="ac" data-cfver="'+es(c.id)+'" style="margin-left:6px">Ficha</button></td></tr>';
}
VX.vencimientos=function(){
 if(!VEN.lista&&!VEN.er)cargaVenc(false);
 if(VEN.er)return '<div class="c"><div class="ch"><h2>Vencimientos de cobro</h2></div><div class="emp"><h3>No se pudo cargar</h3><p>'+es(VEN.er)+'</p></div></div>';
 if(!VEN.lista)return '<div class="c"><div class="ch"><h2>Vencimientos de cobro</h2></div><div class="emp"><h3>Cargando...</h3></div></div>';
 var l=VEN.lista, fal=l.filter(function(c){return c.dias_vencimiento==null;});
 var sug=fal.filter(function(c){return c.dias_sugeridos!=null;});
 var eu=0; for(var i=0;i<fal.length;i++)eu+=_n(fal[i].facturado_24m);
 var h='<div class="kp" style="margin-bottom:20px">'
  +'<div class="k hero"><div class="l">Faltan por poner</div><div class="v">'+fal.length+'</div>'
  +'<div class="s">de '+l.length+' clientes que facturan</div></div>'
  +'<div class="k"><div class="l">Con dias ya puestos</div><div class="v" style="color:var(--ok)">'+(l.length-fal.length)+'</div>'
  +'<div class="s">listos para los avisos</div></div>'
  +'<div class="k"><div class="l">Se pueden poner solos</div><div class="v">'+sug.length+'</div>'
  +'<div class="s">calculado por como pagan</div></div>'
  +'<div class="k"><div class="l">Facturacion sin condiciones</div><div class="v">'+eur(eu)+'</div>'
  +'<div class="s">en los ultimos 24 meses</div></div></div>';
 h+='<div class="c"><div class="ch"><h2>Vencimientos de cobro por cliente</h2>'
  +'<span class="m">'+l.length+' clientes con facturas en 24 meses</span>'
  +'<button class="ac" data-venref>Actualizar</button></div>'
  +'<div class="mi" style="padding:12px 16px 0">Los dias de vencimiento marcan la fecha de pago de las facturas nuevas y disparan los avisos de cobro. '
  +'La columna <b>Como paga de verdad</b> es la mediana de lo que ha tardado en pagar, para que pongas los dias con criterio.</div>';
 var tabs=[['faltan','Faltan por poner'],['puestos','Ya puestos'],['todos','Todos']];
 h+='<div style="padding:12px 16px;display:flex;flex-wrap:wrap;gap:8px;align-items:center;border-bottom:1px solid var(--bd)">';
 for(var j=0;j<tabs.length;j++)
  h+='<button class="ac'+(VEN.tab===tabs[j][0]?' ord':'')+'" data-ventab="'+tabs[j][0]+'">'+tabs[j][1]+'</button>';
 h+='<span style="flex:1"></span><input id="ven_txt" placeholder="Buscar cliente o CIF" value="'+es(VEN.txt||'')+'" style="max-width:260px"></div>';
 var f=venFiltra();
 if(!f.length)return h+'<div class="emp"><h3>Nada por aqui</h3><p>Ningun cliente encaja con ese filtro.</p></div></div>';
 h+='<div class="tw"><table><thead><tr><th>Cliente</th><th class="r">Facturado 24m</th><th class="r">Facturas</th>'
  +'<th class="r">Pendiente</th><th class="r">Como paga de verdad</th><th>Dias puestos</th><th>Forma de pago</th><th class="r"></th></tr></thead><tbody>';
 for(var k=0;k<f.length;k++)h+=venFila(f[k]);
 return h+'</tbody></table></div></div>';
};
function bindVenc(){
 if(q('[data-venref]'))q('[data-venref]').onclick=function(){VEN.lista=null;VEN.er=null;cargaVenc(true);};
 document.querySelectorAll('[data-ventab]').forEach(function(b){
   b.onclick=function(){VEN.tab=b.getAttribute('data-ventab');render();};});
 if(q('#ven_txt')){var t=q('#ven_txt');
   t.oninput=function(){VEN.txt=t.value;};
   t.onkeydown=function(ev){if(ev.key==='Enter'){VEN.txt=t.value;render();
     setTimeout(function(){var x=q('#ven_txt');if(x){x.focus();try{x.setSelectionRange(x.value.length,x.value.length);}catch(_e){}}},0);}};}
 document.querySelectorAll('[data-vensug]').forEach(function(b){
   b.onclick=function(){
     var c=venCli(b.getAttribute('data-vensug'));
     if(c)venGuardaDias(c,_n(b.getAttribute('data-vend')));};});
 document.querySelectorAll('[data-clic]').forEach(function(b){
   b.onclick=function(){venAbre(b.getAttribute('data-clic'));};});
}

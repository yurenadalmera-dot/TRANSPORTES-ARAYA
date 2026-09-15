/* ===== Reclamaciones: burofax, juzgado y seguimiento ===== */
var REC={ld:false,er:null,ts:0,exp:null,cand:null,act:{},tab:'abiertos',txt:''};
var REC_EST=[['preparando','Preparando'],['burofax','Burofax enviado'],['presentada','Presentada'],
 ['admitida','Admitida a tramite'],['requerido','Deudor requerido'],['oposicion','Con oposicion'],
 ['juicio','En juicio'],['sentencia','Con sentencia'],['ejecucion','En ejecucion'],
 ['cobrada','Cobrada'],['archivada','Archivada']];
function recEstTxt(e){for(var i=0;i<REC_EST.length;i++)if(REC_EST[i][0]===e)return REC_EST[i][1];return e||'';}
function recEstTg(e){
 if(e==='cobrada')return '<span class="tg t-ok">Cobrada</span>';
 if(e==='archivada')return '<span class="tg t-otro">Archivada</span>';
 if(e==='preparando')return '<span class="tg t-bajo">Preparando</span>';
 if(e==='burofax')return '<span class="tg t-reponer">Burofax</span>';
 return '<span class="tg t-suministro">'+es(recEstTxt(e))+'</span>';
}
function cargaRec(force){
 if(REC.ld)return;
 if(!force&&REC.exp&&(Date.now()-REC.ts)<120000)return;
 REC.ld=true;REC.er=null;
 Promise.all([
  rest('v_reclamaciones?select=*&order=proxima_fecha.asc.nullslast'),
  rest('v_candidatos_reclamacion?select=*&order=importe.desc')
 ]).then(function(a){REC.exp=a[0]||[];REC.cand=a[1]||[];REC.ts=Date.now();REC.ld=false;render();})
 .catch(function(e){REC.ld=false;REC.er=e.message||'No se pudieron cargar las reclamaciones';render();});
}
function recCargaAct(id){
 if(REC.act[id])return;
 REC.act[id]='cargando';
 rest('reclamacion_actuaciones?select=*&reclamacion_id=eq.'+encodeURIComponent(id)+'&order=fecha.desc,created_at.desc')
 .then(function(l){REC.act[id]=l||[];render();})
 .catch(function(){REC.act[id]=[];render();});
}
function recAbre(id){
 var r=(REC.exp||[]).filter(function(x){return x.id===id;})[0];
 if(!r)return;
 recCargaAct(id);
 S.md={t:'recficha',r:r};render();
}
function recNueva(cliente_id){
 S.bz=true;render();
 rpc('guardar_reclamacion',{p_usuario:S.us.id,p_datos:{cliente_id:cliente_id}})
 .then(function(r){S.bz=false;REC.exp=null;REC.ts=0;
   toast('Expediente abierto con '+r.facturas+' facturas');
   cargaRec(true);})
 .catch(function(e){S.bz=false;toast(e.message);render();});
}
function recFilt(l){
 var s=(REC.txt||'').toLowerCase().trim();
 if(!s)return l;
 return l.filter(function(x){
   return ((x.cliente||'')+' '+(x.cif||'')+' '+(x.numero_expediente||'')+' '+(x.juzgado||''))
     .toLowerCase().indexOf(s)>=0;});
}
function recKpis(){
 var l=REC.exp||[];
 var ab=l.filter(function(x){return x.estado!=='cobrada'&&x.estado!=='archivada';});
 var toca=ab.filter(function(x){return x.toca_ya;});
 var imp=0,rec=0;
 for(var i=0;i<ab.length;i++)imp+=_n(ab[i].importe_principal);
 for(var j=0;j<l.length;j++)rec+=_n(l[j].importe_recuperado);
 var cand=(REC.cand||[]).filter(function(x){return !x.reclamacion_id;});
 var nos=cand.filter(function(x){return x.quien_lo_llevaria==='nosotros';});
 return '<div class="kp" style="margin-bottom:20px">'
  +'<div class="k'+(toca.length?' hero':'')+'"><div class="l">Toca preguntar</div>'
  +'<div class="v" style="color:'+(toca.length?'var(--red)':'var(--ok)')+'">'+toca.length+'</div>'
  +'<div class="s">de '+ab.length+' expedientes abiertos</div></div>'
  +'<div class="k"><div class="l">Reclamado</div><div class="v">'+eur(imp)+'</div>'
  +'<div class="s">en los expedientes abiertos</div></div>'
  +'<div class="k"><div class="l">Recuperado</div><div class="v" style="color:var(--ok)">'+eur(rec)+'</div>'
  +'<div class="s">cobrado por esta via</div></div>'
  +'<div class="k"><div class="l">Sin reclamar</div><div class="v">'+cand.length+'</div>'
  +'<div class="s">'+nos.length+' los llevariamos nosotros</div></div></div>';
}
function recFilaExp(r){
 var sn=_n(r.dias_sin_novedad);
 return '<tr><td class="nm">'+es(r.cliente||'')+(r.cif?'<div class="sm">'+es(r.cif)+'</div>':'')+'</td>'
  +'<td>'+recEstTg(r.estado)+(r.quien_lo_lleva==='abogado'?'<div class="sm">abogado</div>':'<div class="sm">lo llevamos nosotros</div>')+'</td>'
  +'<td class="sm">'+(r.numero_expediente?es(r.numero_expediente):'—')
    +(r.juzgado?'<div class="sm">'+es(r.juzgado)+'</div>':'')+'</td>'
  +'<td class="r nu">'+eur(_n(r.importe_principal))+'</td>'
  +'<td class="r nu">'+(_n(r.pendiente_hoy)!==_n(r.importe_principal)
      ?'<b>'+eur(_n(r.pendiente_hoy))+'</b>':'<span class="sm">igual</span>')+'</td>'
  +'<td class="sm">'+(r.proxima_fecha?(r.toca_ya?'<b style="color:var(--red)">'+fc(r.proxima_fecha)+'</b>':fc(r.proxima_fecha)):'—')
    +(r.proxima_actuacion?'<div class="sm">'+es(r.proxima_actuacion)+'</div>':'')+'</td>'
  +'<td class="r sm"'+(sn>90?' style="color:var(--red)"':'')+'>'+(r.dias_sin_novedad==null?'—':sn+' d')+'</td>'
  +'<td class="r"><button class="ac" data-recver="'+es(r.id)+'">Abrir</button></td></tr>';
}
function recPresc(c){
 var p=c.prescripcion, d=_n(c.dias_que_quedarian);
 if(p==='en_plazo')return '<span class="tg t-ok">Quedan '+d+' d</span>';
 if(p==='se_acaba')return '<span class="tg t-reponer">Solo '+d+' d</span>';
 if(p==='pasado_el_ano')return '<span class="tg t-bajo">Paso el ano</span>';
 return '<span class="tg t-financiacion">Mas de 2 anos</span>';
}
function recVia(c){
 var v=c.via||{}, o=v.si_se_opone;
 if(o==='verbal_sin_abogado')return '<span class="tg t-ok">Solos del todo</span>';
 if(o==='verbal_con_abogado')return '<span class="tg t-bajo">Abogado si se opone</span>';
 return '<span class="tg t-suministro">Ordinario si se opone</span>';
}
function recFilaCand(c){
 var q=c.quien_lo_llevaria==='nosotros'
   ?'<span class="tg t-ok">Nosotros</span>':'<span class="tg t-suministro">Abogado</span>';
 var extra=_n(c.intereses_estimados)+_n(c.costes_de_cobro);
 return '<tr><td class="nm">'+es(c.cliente||'')+(c.cif?'<div class="sm">'+es(c.cif)+'</div>':'')+'</td>'
  +'<td class="r nu">'+eur(_n(c.importe))
    +'<div class="sm">+'+eur(extra)+' de intereses y costes</div></td>'
  +'<td class="r nu">'+_n(c.n_facturas)+'</td>'
  +'<td class="sm">'+fc(c.ultimo_vencimiento)+'</td>'
  +'<td>'+recPresc(c)+'</td>'
  +'<td>'+recVia(c)+'</td><td>'+q+'</td>'
  +'<td class="r">'+(c.reclamacion_id
      ?'<span class="sm">ya tiene expediente</span>'
      :(pue()?'<button class="ac" data-recnew="'+es(c.cliente_id)+'"'+(S.bz?' disabled':'')+'>Abrir expediente</button>':''))
  +'</td></tr>';
}
function recAviso(){
 var t=(REC.cand||[])[0], tipo=t?_n(t.tipo_interes):0;
 return '<div class="mi" style="padding:12px 16px 0">'
  +'<b>La peticion inicial del monitorio no necesita abogado ni procurador, sea cual sea el importe</b> '
  +'(art. 814.2 de la Ley de Enjuiciamiento Civil). Se presenta en el juzgado del domicilio del deudor '
  +'(art. 813). Lo que cambia con el importe es que pasa <b>si el deudor se opone</b>: hasta 2.000 € '
  +'sigue sin hacer falta abogado; de ahi a 6.000 € ya si; por encima es juicio ordinario y hay un mes '
  +'para presentar la demanda.</div>'
  +'<div class="note" style="margin:12px 16px 0;background:#FBF1DF;border-color:#EBD9AE;color:#8A5A10">'
  +'<b>Ojo con el plazo.</b> En transporte de mercancias las acciones prescriben al <b>ano</b> '
  +'(art. 79 de la Ley 15/2009), no a los cinco. Y el burofax aqui <b>suspende</b> el plazo, no lo '
  +'reinicia. El plazo que ves se cuenta desde el ultimo vencimiento. '
  +'Esto es una orientacion para priorizar, no un dictamen: confirmalo con el abogado antes de presentar nada.</div>'
  +'<div class="mi" style="padding:8px 16px 0">A la deuda se le pueden sumar intereses de demora al '
  +eu2(tipo)+' % anual y <b>40 € por cada factura</b> impagada (Ley 3/2004, arts. 7 y 8).</div>';
}
VX.reclamaciones=function(){
 if(!REC.exp&&!REC.er)cargaRec(false);
 if(REC.er)return '<div class="c"><div class="ch"><h2>Reclamaciones</h2><button class="ac" data-recref>Reintentar</button></div><div class="emp"><h3>No se pudo cargar</h3><p>'+es(REC.er)+'</p></div></div>';
 if(!REC.exp)return '<div class="c"><div class="ch"><h2>Reclamaciones</h2></div><div class="emp"><h3>Cargando...</h3></div></div>';

 var tabs=[['abiertos','Expedientes abiertos'],['reclamar','Sin reclamar'],['cerrados','Cerrados']];
 var h=recKpis()+'<div class="c"><div class="ch"><h2>Reclamaciones</h2>'
  +'<button class="ac" data-recref>Actualizar</button></div>'
  +'<div style="padding:12px 16px;display:flex;flex-wrap:wrap;gap:8px;align-items:center;border-bottom:1px solid var(--bd)">';
 for(var i=0;i<tabs.length;i++)
  h+='<button class="ac'+(REC.tab===tabs[i][0]?' ord':'')+'" data-rectab="'+tabs[i][0]+'">'+tabs[i][1]+'</button>';
 h+='<span style="flex:1"></span><input id="rec_q" placeholder="Buscar cliente o expediente" value="'+es(REC.txt||'')+'" style="max-width:250px"></div>';

 if(REC.tab==='reclamar'){
  var c=recFilt((REC.cand||[]).filter(function(x){return !x.reclamacion_id;}));
  h+=recAviso();
  if(!c.length)return h+'<div class="emp"><h3>Nada por reclamar</h3></div></div>';
  h+='<div class="tw"><table><thead><tr><th>Cliente</th><th class="r">Deuda</th><th class="r">Facturas</th>'
   +'<th>Ultimo vencimiento</th><th>Plazo para reclamar</th><th>Si se opone</th><th>Quien</th>'
   +'<th class="r"></th></tr></thead><tbody>';
  for(var k=0;k<c.length;k++)h+=recFilaCand(c[k]);
  return h+'</tbody></table></div></div>';
 }

 var cerr=(REC.tab==='cerrados');
 var l=recFilt((REC.exp||[]).filter(function(x){
   var fin=(x.estado==='cobrada'||x.estado==='archivada');return cerr?fin:!fin;}));
 if(!l.length)return h+'<div class="emp"><h3>'+(cerr?'Ningun expediente cerrado':'Ningun expediente abierto')+'</h3>'
   +(cerr?'':'<p>Los expedientes se abren desde la pestana <b>Sin reclamar</b>.</p>')+'</div></div>';
 h+='<div class="tw"><table><thead><tr><th>Cliente</th><th>Estado</th><th>Expediente</th>'
  +'<th class="r">Reclamado</th><th class="r">Queda hoy</th><th>Proxima gestion</th>'
  +'<th class="r">Sin novedad</th><th class="r"></th></tr></thead><tbody>';
 for(var j=0;j<l.length;j++)h+=recFilaExp(l[j]);
 return h+'</tbody></table></div></div>';
};
MDX.recficha=function(m){
 var r=m.r, acts=REC.act[r.id];
 var h='<div class="ov" data-ov><div class="md" style="max-width:720px">'
  +'<h3>'+es(r.cliente||'')+'</h3><div class="s">'+recEstTxt(r.estado)
  +(r.numero_expediente?' · expediente '+es(r.numero_expediente):'')+'</div>'
  +'<div class="kp" style="margin:14px 0">'
  +'<div class="k"><div class="l">Reclamado</div><div class="v">'+eur(_n(r.importe_principal))+'</div>'
  +'<div class="s">'+_n(r.n_facturas)+' facturas</div></div>'
  +'<div class="k"><div class="l">Queda hoy</div><div class="v">'+eur(_n(r.pendiente_hoy))+'</div>'
  +'<div class="s">'+(_n(r.importe_recuperado)?eur(_n(r.importe_recuperado))+' recuperado':'sin recuperar nada')+'</div></div></div>'
  +'<div class="fg">'
  +'<div class="fi"><label>Estado</label><select id="rc_est">';
 for(var i=0;i<REC_EST.length;i++)
  h+='<option value="'+REC_EST[i][0]+'"'+(r.estado===REC_EST[i][0]?' selected':'')+'>'+REC_EST[i][1]+'</option>';
 h+='</select></div>'
  +'<div class="fi"><label>Quien lo lleva</label><select id="rc_qui">'
  +'<option value="nosotros"'+(r.quien_lo_lleva==='nosotros'?' selected':'')+'>Nosotros</option>'
  +'<option value="abogado"'+(r.quien_lo_lleva==='abogado'?' selected':'')+'>Abogado</option></select></div>'
  +'<div class="fi"><label>Fecha del burofax</label><input id="rc_bur" type="date" value="'+es(r.fecha_burofax||'')+'"></div>'
  +'<div class="fi"><label>Fecha de la denuncia</label><input id="rc_den" type="date" value="'+es(r.fecha_denuncia||'')+'"></div>'
  +'<div class="fi"><label>Juzgado</label><input id="rc_juz" value="'+es(r.juzgado||'')+'" placeholder="Juzgado de Primera Instancia n... de..."></div>'
  +'<div class="fi"><label>N. de expediente</label><input id="rc_exp" value="'+es(r.numero_expediente||'')+'" placeholder="412/2023"></div>'
  +'<div class="fi"><label>Procedimiento</label><select id="rc_pro">'
  +'<option value="">Sin definir</option>';
 var pr=[['monitorio','Monitorio'],['verbal','Verbal'],['ordinario','Ordinario'],['cambiario','Cambiario'],['otro','Otro']];
 for(var p=0;p<pr.length;p++)
  h+='<option value="'+pr[p][0]+'"'+(r.procedimiento===pr[p][0]?' selected':'')+'>'+pr[p][1]+'</option>';
 h+='</select></div>'
  +'<div class="fi"><label>Abogado</label><input id="rc_abo" value="'+es(r.abogado||'')+'"></div>'
  +'<div class="fi"><label>Recuperado</label><input id="rc_rec" type="number" step="0.01" value="'+(_n(r.importe_recuperado)||'')+'"></div>'
  +'<div class="fi" style="grid-column:1/-1"><label>Que toca hacer</label><input id="rc_px" value="'+es(r.proxima_actuacion||'')+'" placeholder="Llamar al juzgado para preguntar"></div>'
  +'<div class="fi"><label>Cuando</label><input id="rc_pf" type="date" value="'+es(r.proxima_fecha||'')+'"></div>'
  +'</div>'
  +'<div class="c" style="margin-top:16px"><div class="ch"><h2>Seguimiento</h2>'
  +'<span class="m">'+_n(r.n_gestiones)+' gestiones</span></div>'
  +'<div class="fg" style="padding:12px 16px">'
  +'<div class="fi"><label>Fecha</label><input id="rc_afe" type="date" value="'+es(_hoy())+'"></div>'
  +'<div class="fi"><label>Tipo</label><select id="rc_ati">'
  +'<option value="nota">Nota</option><option value="llamada">Llamada</option>'
  +'<option value="burofax">Burofax</option><option value="escrito">Escrito</option>'
  +'<option value="vista">Vista</option><option value="resolucion">Resolucion</option>'
  +'<option value="pago">Pago</option><option value="visita">Visita</option></select></div>'
  +'<div class="fi" style="grid-column:1/-1"><label>Que se ha hecho</label>'
  +'<input id="rc_ade" placeholder="Llamada al juzgado: pendiente de senalamiento"></div>'
  +'</div><div style="padding:0 16px 12px">'
  +'<button class="ac" data-recact="'+es(r.id)+'"'+(S.bz?' disabled':'')+'>Anotar la gestion</button></div>';
 if(acts==='cargando'||acts===undefined){h+='<div class="emp"><h3>Cargando el seguimiento...</h3></div>';}
 else if(!acts.length){h+='<div class="emp"><h3>Sin gestiones anotadas</h3></div>';}
 else{
  h+='<div class="tw"><table><thead><tr><th>Fecha</th><th>Tipo</th><th>Gestion</th><th>Quien</th></tr></thead><tbody>';
  for(var a=0;a<acts.length;a++){var x=acts[a];
   h+='<tr><td class="sm">'+fc(x.fecha)+'</td><td class="sm">'+es(cp(x.tipo||''))+'</td>'
    +'<td>'+es(x.detalle||'')+'</td><td class="sm">'+es(x.quien||'')+'</td></tr>';}
  h+='</tbody></table></div>';
 }
 h+='</div><div class="mb"><button class="mc" data-cn>Cerrar</button>'
  +'<button class="ms" data-recsav="'+es(r.id)+'"'+(S.bz?' disabled':'')+'>'+(S.bz?'Guardando...':'Guardar')+'</button></div>';
 return h+'</div></div>';
};
function recLee(){
 var g=function(id){var e=q('#'+id);return e?e.value:'';};
 return {estado:g('rc_est'),quien_lo_lleva:g('rc_qui'),fecha_burofax:g('rc_bur'),
   fecha_denuncia:g('rc_den'),juzgado:g('rc_juz'),numero_expediente:g('rc_exp'),
   procedimiento:g('rc_pro'),abogado:g('rc_abo'),importe_recuperado:g('rc_rec'),
   proxima_actuacion:g('rc_px'),proxima_fecha:g('rc_pf')};
}
function bindRec(){
 if(q('[data-recref]'))q('[data-recref]').onclick=function(){REC.exp=null;REC.er=null;REC.act={};cargaRec(true);};
 document.querySelectorAll('[data-rectab]').forEach(function(b){
   b.onclick=function(){REC.tab=b.getAttribute('data-rectab');render();};});
 if(q('#rec_q')){var t=q('#rec_q');
   t.oninput=function(){REC.txt=t.value;};
   t.onkeydown=function(ev){if(ev.key==='Enter'){REC.txt=t.value;render();
     setTimeout(function(){var x=q('#rec_q');if(x){x.focus();
       try{x.setSelectionRange(x.value.length,x.value.length);}catch(_e){}}},0);}};}
 document.querySelectorAll('[data-recver]').forEach(function(b){
   b.onclick=function(){recAbre(b.getAttribute('data-recver'));};});
 document.querySelectorAll('[data-recnew]').forEach(function(b){
   b.onclick=function(){recNueva(b.getAttribute('data-recnew'));};});
 if(q('[data-recsav]')){var s=q('[data-recsav]');
   s.onclick=function(){var id=s.getAttribute('data-recsav');var d=recLee();d.id=id;
     S.bz=true;render();
     rpc('guardar_reclamacion',{p_usuario:S.us.id,p_datos:d})
      .then(function(){toast('Expediente guardado');S.bz=false;S.md=null;REC.exp=null;cargaRec(true);})
      .catch(function(e){S.bz=false;toast(e.message);render();});};}
 if(q('[data-recact]')){var a=q('[data-recact]');
   a.onclick=function(){var id=a.getAttribute('data-recact');
     var det=(q('#rc_ade')||{}).value||'';
     if(!det.trim()){toast('Escribe que se ha hecho');return;}
     S.bz=true;render();
     rpc('anadir_actuacion',{p_usuario:S.us.id,p_reclamacion:id,p_datos:{
       fecha:(q('#rc_afe')||{}).value||'',tipo:(q('#rc_ati')||{}).value||'nota',detalle:det,
       proxima_actuacion:(q('#rc_px')||{}).value||'',proxima_fecha:(q('#rc_pf')||{}).value||''}})
      .then(function(){toast('Gestion anotada');S.bz=false;delete REC.act[id];REC.exp=null;cargaRec(true);})
      .catch(function(e){S.bz=false;toast(e.message);render();});};}
}

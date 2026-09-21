-- ============================================================================
-- Boton "Enviar aviso de cobro" en la ficha de cliente del panel
-- Transportes Araya Franquiz - 21/09/2026
--
-- COMO EJECUTARLO
--   1. Proyecto de Supabase del panel (araya) -> SQL Editor.
--   2. Pegar este script completo y pulsar "Run".
--   3. Refrescar el panel con Ctrl+F5 y abrir la ficha de un cliente que
--      tenga saldo pendiente: el boton sale junto a "Condiciones de cobro".
--
-- POR QUE LO TIENES QUE PEGAR TU
--   El rol tecnico que uso desde n8n es "n8n_app". Comprobado contra la base:
--     has_table_privilege('n8n_app','public.app_ui','SELECT') = true
--     has_table_privilege('n8n_app','public.app_ui','INSERT') = false
--     has_table_privilege('n8n_app','public.app_ui','UPDATE') = false
--   La tabla app_ui (donde vive el HTML+JS del panel) es propiedad de
--   "postgres" y n8n_app no tiene escritura sobre ella. Es una proteccion de
--   la propia base de datos. El SQL Editor de Supabase usa un rol con mas
--   privilegios, por eso ahi si funciona.
--
-- QUE HACE
--   1) Copia de seguridad del codigo actual en la fila 'bak_v02.17_20260921'.
--   2) Añade el boton en la cabecera de la ficha de cliente. Solo lo ve quien
--      ya puede editar clientes (pue()) y solo si el cliente tiene pendiente.
--   3) Engancha el clic dentro de bindCliente(), que es la funcion que el
--      panel ejecuta tras cada render (la llama BINDX). Al pulsar, pide
--      confirmacion, carga el aviso de ese cliente de v_avisos_cobro y lo
--      envia por el mismo endpoint que ya usa la pantalla de Avisos
--      (/araya/aviso-cobro), con el mismo asunto y el mismo texto.
--   Si algo no encaja, la transaccion se deshace entera y no cambia nada.
--
-- COMPROBADO CONTRA EL PANEL EN PRODUCCION (21/09/2026)
--   - Los dos textos que busca el script existen tal cual (posiciones 363328
--     y 370680 del HTML), y 'data-avcli' todavia no aparece: no esta puesto.
--   - c.pendiente existe en la ficha: es el KPI "Pendiente de cobro", que sale
--     de la vista v_cliente_ficha.
--   - v_avisos_cobro tiene las columnas que usa el boton: cliente_id, email,
--     importe, n_facturas, facturas.
--   - Existen las funciones que invoca: q, rest, acc, toast, _n, eu2,
--     _avisoAsunto, _textoAvisoCliente, y la global org.
-- ============================================================================

begin;

-- 1) Copia de seguridad del codigo actual (no hace nada si ya existe)
insert into app_ui (id, html, actualizado)
select 'bak_v02.17_20260921', html, now()
from app_ui
where id = 'app'
  and not exists (select 1 from app_ui where id = 'bak_v02.17_20260921');

-- 2) Parche: boton en la cabecera de la ficha + su gestor de clic
update app_ui
set html = replace(
             replace(
               html,
               $OLD_BOTON$  +vol
  +(pue()?'<button class="ac" data-edc="'+es(c.id)+'" style="margin-left:6px">Editar datos</button>':'')
  +(pue()?'<button class="ac" data-clic="'+es(c.id)+'" style="margin-left:6px">Condiciones de cobro</button>':'')
  +(pue()?'<button class="addb" data-nab="'+es(c.id)+'">+ Nuevo albaran</button>':'')
  +'</div>';$OLD_BOTON$,
               $NEW_BOTON$  +vol
  +(pue()?'<button class="ac" data-edc="'+es(c.id)+'" style="margin-left:6px">Editar datos</button>':'')
  +(pue()?'<button class="ac" data-clic="'+es(c.id)+'" style="margin-left:6px">Condiciones de cobro</button>':'')
  +((pue()&&_n(c.pendiente)>0)?'<button class="ac" data-avcli="'+es(c.id)+'" style="margin-left:6px">Enviar aviso de cobro</button>':'')
  +(pue()?'<button class="addb" data-nab="'+es(c.id)+'">+ Nuevo albaran</button>':'')
  +'</div>';$NEW_BOTON$
             ),
             $OLD_BIND$function bindCliente(){
 if(q('[data-cfvol]'))q('[data-cfvol]').onclick=function(){S.v='clientes';render();};$OLD_BIND$,
             $NEW_BIND$function bindCliente(){
 if(q('[data-cfvol]'))q('[data-cfvol]').onclick=function(){S.v='clientes';render();};
 if(q('[data-avcli]'))q('[data-avcli]').onclick=function(){
  var b=q('[data-avcli]'),cid=b.getAttribute('data-avcli'),t0=b.textContent;
  b.disabled=true;b.textContent='Cargando...';
  rest('v_avisos_cobro?select=*&cliente_id=eq.'+encodeURIComponent(cid)).then(function(gs){
   var g=(gs||[])[0];
   if(!g){toast('Este cliente no tiene facturas vencidas que reclamar');b.disabled=false;b.textContent=t0;return;}
   if(!g.email){toast('Este cliente no tiene correo de avisos definido');b.disabled=false;b.textContent=t0;return;}
   if(!confirm('Enviar el aviso de cobro a '+g.email+'?\n\n'+_n(g.n_facturas)+' facturas por '+eu2(g.importe)+' EUR.')){b.disabled=false;b.textContent=t0;return;}
   b.textContent='Enviando...';
   return acc('/araya/aviso-cobro',{cliente_id:g.cliente_id,destinatario:g.email,asunto:_avisoAsunto(g),cuerpo:_textoAvisoCliente(g,org),importe:_n(g.importe),facturas:g.facturas||[]})
    .then(function(){toast('Aviso enviado a '+g.email);b.disabled=false;b.textContent=t0;});
  }).catch(function(e){toast(e.message||'No se pudo enviar el aviso');b.disabled=false;b.textContent=t0;});
 };$NEW_BIND$
           ),
    actualizado = now()
where id = 'app';

-- 3) Si alguna de las dos piezas no ha entrado, se deshace todo el script
do $chk$
declare
  v_boton int;
  v_clic  int;
begin
  select position('data-avcli="' in html), position('[data-avcli]' in html)
    into v_boton, v_clic
  from app_ui where id = 'app';

  if v_boton = 0 then
    raise exception 'No se aplico el boton: el codigo de la ficha de cliente no coincide con lo esperado. No se ha cambiado nada.';
  end if;
  if v_clic = 0 then
    raise exception 'No se aplico el gestor de clic: bindCliente() no coincide con lo esperado. No se ha cambiado nada.';
  end if;
end
$chk$;

commit;

-- ----------------------------------------------------------------------------
-- Verificacion (opcional). Debe devolver: boton_puesto = true, clic_puesto = true
-- y copia_seguridad = true.
-- ----------------------------------------------------------------------------
select
  position('data-avcli="' in html) > 0 as boton_puesto,
  position('[data-avcli]' in html) > 0 as clic_puesto,
  exists (select 1 from app_ui where id = 'bak_v02.17_20260921') as copia_seguridad,
  actualizado
from app_ui
where id = 'app';

-- ----------------------------------------------------------------------------
-- PARA DESHACER (si hiciera falta):
--   update app_ui
--   set html = (select html from app_ui where id = 'bak_v02.17_20260921'),
--       actualizado = now()
--   where id = 'app';
-- ----------------------------------------------------------------------------

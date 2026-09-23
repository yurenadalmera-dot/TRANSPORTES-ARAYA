-- ============================================================================
-- Justificante del banco al conciliar
-- Transportes Araya Franquiz · 22/09/2026
--
-- Pedido por Yurena: al conciliar un movimiento, que pida el comprobante del
-- banco, que quede guardado con el movimiento, y que despues se pueda abrir
-- para comprobar que eso esta cobrado o pagado de verdad.
--
-- El fichero se sube al bucket 'facturas', carpeta 'banco/<id del movimiento>/',
-- igual que los comprobantes de cobro. Aqui solo se guarda la ruta.
-- ============================================================================

-- Ejecutar por tandas: el ALTER primero, y la vista despues.

-- 1. Donde se guarda -----------------------------------------------------------
alter table public.movimientos_banco
  add column if not exists justificante_url    text,
  add column if not exists justificante_nombre text,
  add column if not exists justificante_at     timestamptz,
  add column if not exists justificante_por    text;

comment on column public.movimientos_banco.justificante_url is
  'Ruta dentro del bucket facturas del comprobante del banco de este movimiento';

-- 2. Que el panel lo vea -------------------------------------------------------
-- v_movimientos es lo que carga la pantalla de Banco, con select=*
create or replace view public.v_movimientos as
 select m.id, m.org_id, m.cuenta_id, cb.nombre as cuenta,
    m.fecha, m.fecha_valor, m.concepto, m.referencia, m.importe, m.saldo,
    m.tipo, m.estado, m.origen, m.confianza_match, m.conciliado_at,
    m.factura_id, m.factura_venta_id,
    coalesce(p.nombre, c.nombre) as tercero,
    coalesce(f.numero_factura, fv.numero_factura) as documento,
    a.clase, a.aviso, a.diagnostico, a.sugerencias, a.mejor_confianza,
    a.sug_tercero, a.sug_numero, a.ya_registrado, a.factura_ya_registrada,
    -- Las nuevas van AL FINAL: create or replace view no deja meterlas en medio
    -- (ERROR 42P16: cannot change name of view column "clase" to "justificante_url")
    m.justificante_url, m.justificante_nombre, m.justificante_at, m.justificante_por
   from public.movimientos_banco m
     left join public.cuentas_banco cb on cb.id = m.cuenta_id
     left join public.facturas f on f.id = m.factura_id
     left join public.facturas_venta fv on fv.id = m.factura_venta_id
     left join public.proveedores p on p.id = m.proveedor_id
     left join public.clientes c on c.id = m.cliente_id
     left join public.v_movimientos_banco a on a.id = m.id;

-- 3. Guardar o quitar el justificante ------------------------------------------
create or replace function public.guardar_justificante_movimiento(
  p_usuario uuid, p_mov uuid, p_ruta text, p_nombre text default null)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $function$
declare m record; v_ruta text; v_quien text; v_cobros int := 0;
begin
  perform public.exigir_identidad(p_usuario);

  select * into m from public.movimientos_banco where id = p_mov;
  if m.id is null then raise exception 'El movimiento no existe'; end if;

  v_ruta  := nullif(btrim(coalesce(p_ruta,'')),'');
  v_quien := (select email from public.usuarios where id = p_usuario);

  update public.movimientos_banco
     set justificante_url    = v_ruta,
         justificante_nombre = case when v_ruta is null then null
                                    else nullif(btrim(coalesce(p_nombre,'')),'') end,
         justificante_at     = case when v_ruta is null then null else now() end,
         justificante_por    = case when v_ruta is null then null else v_quien end
   where id = p_mov;

  -- si el movimiento ya esta repartido, el mismo papel vale para sus cobros
  if v_ruta is not null then
    update public.cobros c
       set documento_url = v_ruta
      from public.conciliacion_lineas l
     where l.movimiento_id = p_mov
       and l.cobro_id = c.id
       and c.documento_url is null;
    get diagnostics v_cobros = row_count;
  end if;

  return jsonb_build_object('ok', true, 'ruta', v_ruta, 'cobros', v_cobros);
end
$function$;

revoke all on function public.guardar_justificante_movimiento(uuid,uuid,text,text) from public;
grant execute on function public.guardar_justificante_movimiento(uuid,uuid,text,text)
  to authenticated, service_role, n8n_app;

-- 4. Para mirar como vamos -----------------------------------------------------
create or replace view public.v_banco_sin_justificante as
 select m.id, m.fecha, m.concepto, m.importe, m.estado, m.conciliado_at,
        cb.nombre as cuenta,
        coalesce(p.nombre, c.nombre) as tercero,
        coalesce(f.numero_factura, fv.numero_factura) as documento
   from public.movimientos_banco m
     left join public.cuentas_banco cb on cb.id = m.cuenta_id
     left join public.facturas f on f.id = m.factura_id
     left join public.facturas_venta fv on fv.id = m.factura_venta_id
     left join public.proveedores p on p.id = m.proveedor_id
     left join public.clientes c on c.id = m.cliente_id
  where m.estado = 'conciliado' and m.justificante_url is null;

grant select on public.v_banco_sin_justificante to authenticated, service_role, n8n_app;

notify pgrst, 'reload schema';

-- 5. Comprobacion --------------------------------------------------------------
select count(*) as movimientos,
       count(*) filter (where estado = 'conciliado') as conciliados,
       count(*) filter (where estado = 'conciliado' and justificante_url is null) as sin_justificante
from public.movimientos_banco;

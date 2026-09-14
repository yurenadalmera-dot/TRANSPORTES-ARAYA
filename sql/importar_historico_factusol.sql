-- Pasa el espejo de Factusol (factusol_facturas / _lineas / _cobros) a las tablas
-- operativas del panel. Es idempotente: solo crea lo que aun no esta.
--
--   select public.importar_historico_factusol(1000);   -- por tandas, ~200 facturas/s
--
-- El numero es el CODFAC, salvo cuando el mismo numero existe en dos series: "serie-numero".
-- Manda la cabecera de Factusol para base, IGIC y total; las lineas se traen con su
-- IGIC propio, resuelto contra PIVA1..3 de la cabecera segun IVALFA.
-- No genera ningun asiento: todo el historico es anterior a
-- config_contable.fecha_inicio_contable.

create or replace function public.importar_historico_factusol(p_lote integer default 300)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_org   uuid := 'a1a1a1a1-0000-4000-8000-000000000001';
  v_corte date := coalesce((select fecha_inicio_contable from config_contable limit 1), '2026-01-01');
  r record;
  v_cli uuid; v_fac uuid; v_cod text; v_cif text; v_nombre text;
  v_base numeric; v_igic numeric; v_tipo numeric; v_venc date; v_cobrado numeric;
  v_estado text; v_ef text; v_lineas int;
  n_fac int := 0; n_cli int := 0; n_lin int := 0; n_cob int := 0; n_desc int := 0;
begin
  for r in
    with col as (select codfac, count(*) n from factusol_facturas group by codfac)
    select f.*,
           case when col.n > 1 then f.tipfac || '-' || f.codfac else f.codfac::text end as numero
      from factusol_facturas f
      join col on col.codfac = f.codfac
     where not exists (
             select 1 from facturas_venta v
              where v.numero_factura = case when col.n > 1 then f.tipfac || '-' || f.codfac else f.codfac::text end
                and v.org_id = v_org)
     order by f.fecfac, f.tipfac, f.codfac
     limit greatest(p_lote, 1)
  loop
    -- cliente
    v_cod    := lpad(coalesce(r.clifac, 0)::text, 6, '0');
    v_cif    := nullif(btrim(coalesce(r.cnifac, '')), '');
    v_nombre := nullif(btrim(coalesce(r.cnofac, '')), '');

    v_cli := null;
    select id into v_cli from clientes where codigo_externo = v_cod and org_id = v_org limit 1;
    if v_cli is null and v_cif is not null then
      select id into v_cli from clientes
       where upper(replace(cif, '-', '')) = upper(replace(v_cif, '-', '')) and org_id = v_org limit 1;
    end if;
    if v_cli is null then
      insert into clientes (org_id, nombre, cif, direccion, telefono, codigo_externo, tipo, activo)
      values (v_org, coalesce(v_nombre, 'CLIENTE ' || v_cod), v_cif,
              nullif(btrim(coalesce(r.cdofac, '') || case when coalesce(r.cpofac,'') <> '' then ', ' || r.cpofac else '' end
                           || case when coalesce(r.ccpfac,'') <> '' then ', ' || r.ccpfac else '' end), ''),
              nullif(btrim(coalesce(r.telfac, '')), ''), v_cod, 'cliente', true)
      returning id into v_cli;
      n_cli := n_cli + 1;
    end if;

    -- importes: manda la cabecera de Factusol
    v_base := round(coalesce(r.bas1,0) + coalesce(r.bas2,0) + coalesce(r.bas3,0) + coalesce(r.bas4,0), 2);
    v_igic := round(coalesce(r.iiva1,0) + coalesce(r.iiva2,0) + coalesce(r.iiva3,0), 2);
    v_tipo := case when coalesce(r.bas1,0) <> 0 then coalesce(r.piva1,0)
                   when coalesce(r.bas2,0) <> 0 then coalesce(r.piva2,0)
                   when coalesce(r.bas3,0) <> 0 then coalesce(r.piva3,0)
                   else 0 end;

    -- vencimiento: el ultimo que marque VENFAC
    v_venc := null;
    begin
      select max(to_date(m[1], 'DD/MM/YYYY'))
        into v_venc
        from regexp_matches(coalesce(r.venfac, ''), '(\d{2}/\d{2}/\d{4})', 'g') m;
    exception when others then v_venc := null;
    end;
    if v_venc is null or v_venc < r.fecfac then v_venc := r.fecfac + 30; end if;

    -- estado
    v_ef := case r.estfac when 0 then 'pendiente' when 1 then 'cobro_parcial'
                          when 2 then 'cobrada'   when 3 then 'devuelta'
                          when 4 then 'impagada'  else null end;
    v_estado := case when r.estfac = 2 then 'cobrada' else 'pendiente' end;

    insert into facturas_venta (org_id, cliente_id, numero_factura, fecha, fecha_vencimiento,
                                base_imponible, igic, tipo_igic, total, estado, estado_factusol,
                                origen, created_by, notas)
    values (v_org, v_cli, r.numero, r.fecfac, v_venc,
            v_base, v_igic, v_tipo, round(coalesce(r.totfac,0), 2), v_estado, v_ef,
            'factusol-historico', 'factusol-historico',
            'Historico traido de Factusol (serie ' || r.tipfac || ', numero ' || r.codfac || ')'
            || case when coalesce(r.fopfac,'') <> '' then '. Forma de pago Factusol: ' || r.fopfac else '' end
            || case when coalesce(r.reffac,'') <> '' then '. Referencia: ' || r.reffac else '' end
            || case when coalesce(r.ob1,'') <> '' then '. ' || r.ob1 else '' end)
    returning id into v_fac;
    n_fac := n_fac + 1;

    -- lineas, con su IGIC propio segun el grupo de la cabecera
    insert into facturas_venta_lineas (org_id, factura_venta_id, descripcion, cantidad, precio_unitario, importe, tipo_igic)
    select v_org, v_fac,
           nullif(btrim(coalesce(l.deslfa, '')), ''),
           coalesce(l.canlfa, 1), coalesce(l.prelfa, 0), round(coalesce(l.totlfa, 0), 2),
           coalesce(case l.ivalfa::int
                      when 0 then r.piva1 when 1 then r.piva2
                      when 2 then r.piva3 when 3 then 0 end, v_tipo)
      from factusol_lineas l
     where l.tiplfa = r.tipfac and l.codlfa = r.codfac
     order by l.poslfa;
    get diagnostics v_lineas = row_count;
    n_lin := n_lin + v_lineas;

    if v_lineas > 0 and abs((select coalesce(sum(importe),0) from facturas_venta_lineas where factura_venta_id = v_fac) - v_base) > 0.02 then
      insert into factusol_sync_log (numero_factura, resultado, detalle)
      values (r.numero, 'lineas_no_cuadran',
              'cabecera ' || v_base || ' / lineas ' ||
              (select coalesce(sum(importe),0) from facturas_venta_lineas where factura_venta_id = v_fac)
              || ' (manda la cabecera)');
      n_desc := n_desc + 1;
    end if;

    -- cobros
    insert into cobros (org_id, factura_venta_id, cliente_id, fecha, importe, metodo, referencia)
    select v_org, v_fac, v_cli, c.feccob, round(c.impcob, 2), 'transferencia',
           'Factusol cobro ' || c.codcob
      from factusol_cobros c
     where c.tipcob = 0 and c.serie = r.tipfac and c.numero = r.codfac
       and c.impcob is not null and c.impcob > 0 and c.feccob is not null;
    get diagnostics v_lineas = row_count;
    n_cob := n_cob + v_lineas;

    select round(coalesce(sum(importe), 0), 2) into v_cobrado from cobros where factura_venta_id = v_fac;
    update facturas_venta
       set importe_cobrado = v_cobrado,
           fecha_cobro = case when v_cobrado > 0 then (select max(fecha) from cobros where factura_venta_id = v_fac) end,
           estado = case when r.estfac = 2 or (round(coalesce(r.totfac,0),2) > 0 and v_cobrado >= round(coalesce(r.totfac,0),2) - 0.02)
                         then 'cobrada' else 'pendiente' end
     where id = v_fac;
  end loop;

  return jsonb_build_object(
    'facturas', n_fac, 'clientes_nuevos', n_cli, 'lineas', n_lin, 'cobros', n_cob,
    'lineas_no_cuadran', n_desc,
    'quedan', (select count(*) from factusol_facturas f
                join (select codfac, count(*) n from factusol_facturas group by codfac) col on col.codfac = f.codfac
               where not exists (select 1 from facturas_venta v
                                  where v.numero_factura = case when col.n > 1 then f.tipfac || '-' || f.codfac else f.codfac::text end
                                    and v.org_id = v_org)),
    'sin_asiento_antes_de', v_corte);
end
$fn$;

grant execute on function public.importar_historico_factusol(integer) to service_role;

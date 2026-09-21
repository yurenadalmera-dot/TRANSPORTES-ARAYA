-- Transportes Araya Franquiz - 21/09/2026
-- La 260194 de BLUE DOLPHIN se queda con 6,29 EUR sin cobrar de sus 1.446,91:
-- el cliente pago el total y al banco entraron 1.440,62. Yurena confirma que la
-- diferencia es gasto bancario, asi que se anota y la factura queda saldada.
--
-- Hay que ejecutarlo con un usuario que pueda escribir. El 21/09/2026 la conexion
-- del panel a Supabase paso a ser de solo lectura y no se pudo aplicar desde aqui.

do $chk$
declare v_id uuid; v_tot numeric; v_cob numeric;
begin
  select f.id, f.total,
         (select coalesce(sum(importe),0) from public.cobros k where k.factura_venta_id = f.id)
    into v_id, v_tot, v_cob
    from public.facturas_venta f
   where f.numero_factura = '260194';

  if v_id is null then
    raise exception 'No existe la factura 260194';
  end if;
  if round(v_tot - v_cob, 2) <> 6.29 then
    raise exception 'La 260194 ya no debe 6,29 EUR sino %. No se toca nada.', round(v_tot - v_cob, 2);
  end if;
end $chk$;

select public.registrar_cobro(
  '5384105b-0c74-438a-bc9d-a1ea806adbce'::uuid,          -- Yurena Mendez
  (select id from public.facturas_venta where numero_factura = '260194'),
  6.29::numeric,
  '2026-05-14'::date,                                     -- la fecha de la transferencia
  'otro'::text,
  'Gasto bancario de la transferencia del 14/05/2026: el cliente pago los 1.446,91 EUR y al banco entraron 1.440,62. Confirmado por Yurena el 21/09/2026.'::text,
  null::text
) as resultado;

-- Comprobacion: tiene que quedar cobrada y a cero.
select numero_factura, estado, total, cobrado, pendiente, cobrado_el
  from public.v_facturas_venta
 where numero_factura = '260194';

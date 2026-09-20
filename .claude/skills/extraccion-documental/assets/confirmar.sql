-- ════════════════════════════════════════════════════════════════════
-- Confirmación transaccional: de _ocr a producción
-- ════════════════════════════════════════════════════════════════════
-- Todo o nada. Un alta a medias —tercero creado, factura no— deja basura
-- que alguien limpia a mano semanas después.
--
-- Adapta los pasos 3-5 al dominio. Los pasos 1, 2 y 6 son el patrón.
-- ════════════════════════════════════════════════════════════════════

create or replace function public.confirmar_documento_ocr(
  p_ocr_id uuid,
  p_datos jsonb,                          -- lo que quedó tras la revisión
  p_permitir_duplicado boolean default false
)
returns table(ok boolean, documento_id uuid, mensaje text)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_org uuid := auth_organizacion_id();
  v_ocr public.documentos_ocr%rowtype;
  v_tercero_id uuid;
  v_doc_id uuid;
  v_nif text := nullif(trim(p_datos->>'nif_emisor'), '');
  v_num text := nullif(trim(p_datos->>'num_documento'), '');
begin
  -- ── 1. Permisos y estado ──────────────────────────────────────────
  select * into v_ocr from public.documentos_ocr
   where id = p_ocr_id and organizacion_id = v_org
   for update;                            -- bloquea: dos pestañas no registran dos veces

  if not found then
    return query select false, null::uuid, 'Documento no encontrado'; return;
  end if;
  if v_ocr.estado = 'registrado' then
    return query select false, v_ocr.documento_id, 'Este documento ya estaba registrado'; return;
  end if;

  -- ── 2. Duplicados: en el commit, no sólo como aviso ───────────────
  -- Un aviso al elegir archivo se ignora; una restricción aquí no.
  -- La vía de escape existe porque hay casos legítimos, pero es una
  -- decisión consciente y queda registrada.
  if v_num is not null and not p_permitir_duplicado then
    if exists (
      select 1 from public.documentos d
       where d.organizacion_id = v_org
         and d.num_documento = v_num
         and (v_nif is null or d.nif_emisor = v_nif)
    ) then
      return query select false, null::uuid,
        format('Ya existe un documento con el número %s de este emisor.', v_num);
      return;
    end if;
  end if;

  -- ── 3. Resolver o crear el tercero ────────────────────────────────
  -- Por NIF primero: es el identificador de verdad. El nombre sólo como
  -- último recurso, normalizado, porque "S.L." y "SL" son la misma empresa.
  if v_nif is not null then
    select id into v_tercero_id from public.terceros
     where organizacion_id = v_org and nif = v_nif;
  end if;

  if v_tercero_id is null then
    select id into v_tercero_id from public.terceros
     where organizacion_id = v_org
       and lower(regexp_replace(nombre, '[^a-zA-Z0-9]', '', 'g'))
         = lower(regexp_replace(coalesce(p_datos->>'emisor',''), '[^a-zA-Z0-9]', '', 'g'))
     limit 1;
  end if;

  if v_tercero_id is null then
    insert into public.terceros (organizacion_id, nombre, nif)
    values (v_org, coalesce(p_datos->>'emisor', 'Sin nombre'), v_nif)
    returning id into v_tercero_id;
  end if;

  -- ── 4. Crear el documento real ────────────────────────────────────
  insert into public.documentos (
    organizacion_id, tercero_id, tipo_doc, num_documento, fecha,
    base, impuesto, total,
    archivo_path, archivo_hash, origen_ocr_id
  ) values (
    v_org, v_tercero_id,
    p_datos->>'tipo_doc', v_num, (p_datos->>'fecha')::date,
    (p_datos->>'base')::numeric, (p_datos->>'impuesto')::numeric, (p_datos->>'total')::numeric,
    v_ocr.archivo_path, v_ocr.archivo_hash, p_ocr_id
  ) returning id into v_doc_id;

  -- ── 5. Líneas, asiento y enlaces del dominio ──────────────────────
  -- Aquí van las líneas de detalle, el asiento contable y los enlaces a
  -- documentos relacionados. Dentro de esta misma transacción.

  -- ── 6. Cerrar la fila de origen ───────────────────────────────────
  update public.documentos_ocr
     set estado = 'registrado',
         datos_revisados = p_datos,       -- se guarda aunque no cambie nada
         revisado_por = auth.uid(),
         revisado_en = now(),
         documento_id = v_doc_id
   where id = p_ocr_id;

  return query select true, v_doc_id, 'Registrado';
end $$;

grant execute on function public.confirmar_documento_ocr(uuid, jsonb, boolean) to authenticated;
revoke execute on function public.confirmar_documento_ocr(uuid, jsonb, boolean) from public, anon;

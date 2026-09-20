-- ════════════════════════════════════════════════════════════════════
-- Tabla intermedia de extracción documental
-- ════════════════════════════════════════════════════════════════════
-- Nada de lo que devuelve el modelo entra en producción. Cae aquí, una
-- persona lo revisa, y el alta real la hace confirmar_documento_ocr().
--
-- Adapta: nombres de tabla, la función de organización y las columnas de
-- dominio. La estructura (datos_ia inmutable + datos_revisados + huella
-- de coste) es lo que no conviene cambiar.
-- ════════════════════════════════════════════════════════════════════

create table if not exists public.documentos_ocr (
  id uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null references public.organizaciones(id) on delete cascade,
  subido_por uuid not null references auth.users(id),

  estado text not null default 'pendiente'
    check (estado in ('pendiente','revisado','descartado','registrado')),

  -- ── El original ──────────────────────────────────────────────────
  -- Se guarda siempre, aunque la lectura falle después. El justificante
  -- es lo que hace falta si un día hay una comprobación.
  archivo_path   text not null,
  archivo_nombre text,
  archivo_mime   text,
  archivo_bytes  bigint,
  archivo_hash   text,           -- SHA-256, para detectar reenvíos

  -- ── Lo que dijo el modelo ────────────────────────────────────────
  -- INMUTABLE. Las correcciones van a datos_revisados. Si se machaca,
  -- se pierde la única medida de precisión que hay.
  datos_ia jsonb not null,
  confianza_ia text check (confianza_ia in ('alta','media','baja')),
  fiabilidad numeric(3,2),       -- la calculada en código, 0.00-1.00
  motivos_fiabilidad text[],     -- por qué bajó: se enseña en la bandeja
  avisos text[],

  -- ── Lo que quedó tras la revisión ────────────────────────────────
  -- Se guarda aunque no cambie nada: "una persona miró esto y lo dio por
  -- bueno" es justo el dato que mide si el modelo acierta.
  datos_revisados jsonb,
  revisado_por uuid references auth.users(id),
  revisado_en  timestamptz,

  -- ── Trazabilidad de coste y versión ──────────────────────────────
  modelo           text,
  prompt_version   text,
  tokens_entrada   integer,
  tokens_salida    integer,
  tokens_cache     integer,      -- leídos de caché; si es 0 siempre, algo invalida el prefijo
  error_lectura    text,         -- por qué falló, cuando falló

  documento_id uuid,             -- se rellena al registrar
  creado_en timestamptz not null default now()
);

comment on column public.documentos_ocr.datos_ia is
  'Respuesta literal del modelo. No se modifica nunca: es la referencia para medir precisión.';
comment on column public.documentos_ocr.tokens_cache is
  'Tokens de entrada servidos desde caché. Cero constante con prefijo estable = hay un invalidador.';

create index if not exists idx_ocr_bandeja
  on public.documentos_ocr (organizacion_id, estado, fiabilidad nulls first, creado_en desc);
create index if not exists idx_ocr_hash
  on public.documentos_ocr (organizacion_id, archivo_hash) where archivo_hash is not null;

-- ── RLS ─────────────────────────────────────────────────────────────
alter table public.documentos_ocr enable row level security;

create policy ocr_ver on public.documentos_ocr
  for select to authenticated
  using (organizacion_id = auth_organizacion_id());

create policy ocr_insertar on public.documentos_ocr
  for insert to authenticated
  with check (organizacion_id = auth_organizacion_id() and subido_por = auth.uid());

-- Sólo se puede tocar lo pendiente, y sólo la parte revisable. Una fila
-- registrada es historia: si se pudiera editar, el enlace con el
-- documento real dejaría de significar nada.
create policy ocr_revisar on public.documentos_ocr
  for update to authenticated
  using (organizacion_id = auth_organizacion_id() and estado in ('pendiente','revisado'))
  with check (organizacion_id = auth_organizacion_id() and estado in ('pendiente','revisado','descartado'));

revoke all on public.documentos_ocr from anon;

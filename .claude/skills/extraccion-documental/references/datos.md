# Datos y seguridad

## Por qué una tabla intermedia

La tabla `_ocr` es la diferencia entre un escáner que puedes mejorar y uno que sólo puedes
sufrir. Sin ella:

- Si la persona cierra la pestaña, la extracción se pierde — y ya la has pagado.
- No hay rastro de qué dijo el modelo frente a qué corrigió la persona, así que **no puedes
  medir la precisión**. "La IA funciona bien" se queda en impresión.
- No hay cola, así que no hay lotes.
- Reprocesar significa volver a llamar y volver a pagar.

Ese registro de "qué dijo el modelo / qué quedó" es lo que después te deja decidir con datos si
puedes bajar de tier de modelo, si un campo concreto necesita mejor prompt, o si el catálogo
inyectado está ayudando.

## La tabla

Ver `assets/_ocr.sql` para la migración completa. La forma mínima:

```sql
create table documentos_ocr (
  id uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null,
  estado text not null default 'pendiente'
    check (estado in ('pendiente','revisado','descartado','registrado')),

  -- El original, siempre, aunque la lectura falle
  archivo_path text not null,
  archivo_hash text,

  -- Lo que dijo el modelo, literal y sin tocar
  datos_ia jsonb not null,
  fiabilidad numeric(3,2),
  motivos_fiabilidad text[],
  avisos text[],

  -- Lo que quedó tras la revisión; null mientras nadie lo toque
  datos_revisados jsonb,
  revisado_por uuid,
  revisado_en timestamptz,

  -- Trazabilidad de coste y de versión
  modelo text,
  tokens_entrada int,
  tokens_salida int,
  prompt_version text,

  documento_id uuid,   -- se rellena al registrar
  creado_en timestamptz not null default now()
);
```

Tres detalles que parecen menores y no lo son:

**`datos_ia` se guarda literal y no se modifica nunca.** Las correcciones van a
`datos_revisados`. Si machacas el original, pierdes la única medida de precisión que tenías.

**`prompt_version` y `modelo` en cada fila.** Cuando la precisión cambie —a mejor o a peor—
vas a querer saber con qué versión se leyó cada documento. Sin esto la comparación es
imposible a posteriori.

**El hash del archivo** permite detectar el mismo documento subido dos veces antes de gastar
una lectura.

## La RPC de confirmación

Ver `assets/confirmar.sql`. Hace todo en **una transacción**:

1. Comprueba permisos sobre la organización del documento.
2. Resuelve o crea el tercero (proveedor/cliente) por NIF, o por nombre normalizado si no hay NIF.
3. Bloquea duplicados por número de documento + tercero, **salvo confirmación expresa**.
4. Crea el documento real con su enlace al justificante.
5. Genera líneas, asiento contable y enlaces relacionados si el dominio lo pide.
6. Marca la fila `_ocr` como `registrado` y guarda el `documento_id`.

Que sea una sola transacción no es elegancia: es que un alta a medias —tercero creado, factura
no— deja basura que alguien tiene que limpiar a mano, y normalmente se descubre semanas después.

El bloqueo de duplicados va **en el commit**, no sólo como aviso al elegir archivo. Un aviso se
ignora; una restricción no. Deja una vía de escape explícita (`p_permitir_duplicado boolean`)
porque hay casos legítimos, pero que sea una decisión consciente y quede registrada.

## Seguridad

**Todo lo que escribe corre con el token del usuario, no con service role.**

Es la regla que evita la clase de incidente más común en estos flujos: un nodo o endpoint que
corre con privilegios totales porque era lo más rápido de configurar, y que un día acepta una
petición que no debía. Si el servidor no guarda la clave de servicio, **no puede hacer nada que
el usuario no pudiera hacer por sí mismo**, y el RLS que se aplica es el suyo. Esa propiedad se
puede razonar; "el workflow está bien configurado" no.

```js
// La misma llamada resuelve identidad, plan y cupo, y el RLS se evalúa en Postgres
const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/puedo_usar_ia`, {
  method: 'POST',
  headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${tokenDelUsuario}` },
});
```

Distingue los tres fallos que suelen acabar en el mismo mensaje inútil:

| Código | Significa | Qué lee la persona |
|---|---|---|
| 401 / 403 | El token no vale | "Tu sesión ha caducado. Vuelve a entrar." |
| Otro error HTTP | El servidor está mal configurado | "No está bien configurado. Avisa a soporte; mientras tanto rellena a mano." |
| Cupo agotado | Plan sin lecturas | El mensaje del propio plan, con lo que le queda |

Mezclarlos manda a la gente a buscar donde no es: decirle "tu sesión ha caducado" a quien tiene
la sesión viva es peor que no decir nada.

## Cupo

Se comprueba **antes** de la llamada y se apunta **desde el servidor**:

```sql
create or replace function puedo_usar_ia()
returns table(ok boolean, mensaje text, restantes integer)
language plpgsql stable security definer set search_path to 'public' as $$
...
$$;
```

Por qué antes: después ya has pagado. Es lo único que impide que una sesión válida dispare la
factura de la API subiendo mil fotos.

Por qué desde el servidor: si lo apunta el navegador, se salta.

Cuenta las llamadas en **columna propia**, separada de los documentos registrados. Una
extracción que la persona abandona ha costado dinero aunque no acabe en documento; mezclar los
dos números hace que los dos mientan.

Revoca `execute` a `anon` en las dos funciones y concédelo sólo a `authenticated`. Es el tipo de
detalle que no falla en pruebas y falla en producción.

## Storage

Sube el original **siempre**, antes de leerlo o en paralelo, y aunque la lectura falle después.
El justificante es lo que hace falta si un día hay una comprobación; el JSON es una comodidad.

Acepta en storage más formatos de los que sabes leer. HEIC es el caso típico: es lo que hace un
iPhone por defecto y las APIs no lo aceptan como imagen. Guárdalo igual y di claramente qué ha
pasado:

> Las fotos en formato HEIC del iPhone no se pueden leer todavía. El archivo se guarda igual:
> rellena los datos a mano, o vuelve a hacer la foto con el formato "Más compatible" en los
> ajustes de la cámara.

Perder el justificante por un formato es un fallo caro y totalmente evitable.

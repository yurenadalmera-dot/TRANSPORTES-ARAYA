# Auditar un escáner existente

Para adaptar una implementación que ya funciona. Recórrela en este orden: primero lo que puede
meter un dato falso en producción, después lo que cuesta dinero, al final lo que sólo molesta.

**No reescribas un escáner que funciona sólo para que se parezca al patrón.** Arregla lo que
tiene consecuencia y deja constancia del resto. Informa ordenando por impacto —euros al mes o
riesgo de dato falso— no por orden de aparición en el código.

---

## A. Riesgo de dato falso (arreglar primero)

**A1 · ¿Se escribe directo en las tablas de producción?**
Busca el `insert`/`update` que sigue a la respuesta del modelo. Si va a `facturas`, `documentos`
o equivalente sin pasar por una tabla intermedia, es el hallazgo más grave: no hay punto donde
una persona pueda parar un error.
→ `references/datos.md`, `assets/_ocr.sql`

**A2 · ¿Hay importes donde un `0` del modelo pasa por dato bueno?**
Lista los campos numéricos del esquema y pregúntate uno a uno: si el modelo devuelve `0` aquí,
¿se nota? Los que no se noten necesitan la regla del cero. Mira especialmente cotizaciones,
retenciones, descuentos y cuotas.
→ `references/validacion.md` §1

**A3 · ¿Los campos que pueden faltar admiten `null`?**
Un campo en `required` sin `null` obliga al modelo a inventarse algo. Revisa identificadores
(NIF, número de documento, matrícula, IBAN) y fechas.
→ `references/esquema.md`

**A4 · ¿El esquema es estricto de verdad?**
Que el prompt pida JSON y haya un `JSON.parse` no es salida estructurada. Busca
`strict: true` (OpenAI) o `output_config.format` (Anthropic). Sin eso funciona hasta el
documento raro.

**A5 · ¿Se valida que los ids del catálogo existan?**
Si el modelo devuelve el id de un proveedor, comprueba en código que está en el catálogo. Un id
inventado parece siempre correcto en una bandeja.
→ `references/validacion.md` §4

**A6 · ¿Hay algún cuadre aritmético?**
Al menos uno propio del documento (base + impuesto = total, devengado + SS = coste). Y que
**avise** cuando no cuadra en vez de corregir en silencio.
→ `references/validacion.md` §2

---

## B. Seguridad

**B1 · ¿El paso que escribe corre con service role?**
Busca la clave de servicio en las variables del workflow o del servidor. Si está ahí, ese
componente puede hacer cualquier cosa sobre cualquier fila; el RLS deja de protegerte. Debe
correr con el token del usuario.
→ `references/datos.md`

**B2 · ¿Hay verificación de sesión en cada endpoint de escritura?**
Explícita y como paso propio, no implícita. Un nodo sin credencial no falla ruidosamente: acepta.

**B3 · ¿Se distinguen sesión caducada, error de configuración y cupo agotado?**
Si los tres acaban en el mismo mensaje, se manda a la gente a buscar donde no es.

**B4 · ¿Están revocados los permisos a `anon` en las funciones?**

---

## C. Coste (ordenado por lo que suele ahorrar)

**C1 · ¿Se cachea el prefijo estable?**
Mira `cache_read_input_tokens` (Anthropic) o `prompt_tokens_details.cached_tokens` (OpenAI) en
respuestas reales. Si es 0 de forma constante, no está entrando. Busca fechas interpoladas en el
system prompt o catálogos sin `ORDER BY`.
→ `references/coste.md` §1

**C2 · ¿Se manda el catálogo entero en cada documento?**
El gasto evitable más grande cuando hay catálogo, y crece con cada alta. Pasa a shortlist.
→ `references/coste.md` §2

**C3 · ¿El tier del modelo está justificado con datos?**
Extraer es transcripción. Si corre en el tier más caro sin haber medido el barato sobre
documentos reales, probablemente sobra gasto. Necesitas `_ocr` para medirlo bien (A1).
→ `references/coste.md` §3

**C4 · ¿El flujo asíncrono podría ir por API de lotes?**
Si nadie espera delante de la pantalla, es la mitad de precio.
→ `references/coste.md` §5

**C5 · ¿Está el esfuerzo/razonamiento al mínimo útil?**

---

## D. Revisión y operación

**D1 · ¿La bandeja distingue "lo rellenó la máquina" de "no lo encontró"?**
Azul y ámbar. Sin el ámbar, un hueco se confunde con un campo que no aplica y se confirma vacío.
→ `references/revision.md`

**D2 · ¿Se puede abrir el documento original desde la bandeja?**

**D3 · ¿La fiabilidad viene con motivos?**
"0.55" obliga a abrir el documento. "0.55 — el total no cuadra, el NIF no valida" es accionable.

**D4 · ¿La fiabilidad la calcula el código o se cree el autoinforme del modelo?**
Un número 0.0-1.0 que sale directo del modelo es precisión falsa, y si además decide el
enrutamiento, el umbral está apoyado en ruido.
→ `references/validacion.md` §5

**D5 · ¿El volcado respeta lo que ya escribió la persona?**
Un `null` del modelo no debe borrar nada.

**D6 · ¿Se guarda `datos_revisados` aunque no haya cambios?**
Es lo que mide que el modelo acertó.

**D7 · ¿Se guarda el original aunque la lectura falle?**
Y con más formatos de los que se saben leer — HEIC sobre todo.

**D8 · ¿Se bloquean duplicados en el commit o sólo con un aviso?**
Los avisos se ignoran.

---

## Formato del informe

Por cada desviación: **qué**, **dónde** (archivo y línea, o nodo del workflow), **qué puede
pasar** en concreto, y **qué cuesta arreglarlo**. Agrupa por riesgo y coste, no por archivo.

Cierra con lo que **no** vas a tocar y por qué: una desviación consciente y documentada es
una decisión; una silenciosa es una deuda que alguien redescubrirá.

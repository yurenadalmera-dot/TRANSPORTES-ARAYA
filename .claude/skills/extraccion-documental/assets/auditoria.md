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
¿se nota? El fallo típico no es olvidar la regla, es ponerla **en un solo campo** y darla por
resuelta. Mira especialmente cotizaciones, cuotas de impuesto, kilómetros y unidades — y
comprueba que las excepciones (retenciones, descuentos) están decididas, no olvidadas.
→ `references/validacion.md` §1

**A2b · ¿En qué ORDEN corren las validaciones?**
La regla del cero tiene que ir **antes** de los cuadres. Si va después no sirve de nada: `hay(0)`
es `true`, así que el cero entra en el cuadre como dato bueno y bloquea la deducción que lo
habría recuperado. Este fallo ya ha llegado a producción y no da ningún error — solo pierde
datos que estaban al alcance. Compruébalo ejecutando el post-proceso con `0` y con `null` en el
mismo campo: si dan resultados distintos, el orden está mal.
→ `references/validacion.md` §0

**A2c · ¿Puede la confianza SUBIR?**
Si se asigna directa en varios sitios, gana la última. Un documento con un descuadre ya
detectado puede acabar con mejor nota por una regla posterior y subir en una bandeja ordenada
por fiabilidad.
→ `references/validacion.md` §4

**A2d · ¿Se puede probar el post-proceso sin llamar a la API?**
Si está enterrado dentro de la función que llama al modelo, no hay forma de escribir la prueba
que detecta A2b. Sacarlo a una función pura exportada es parte del arreglo.

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

**C0 · ¿Se llama al modelo para documentos que no lo necesitan?**
El ahorro más grande y el que nadie mira. Si el documento trae QR de Verifactu, XML de Facturae
o es un PDF con capa de texto, el dato ya está ahí: leerlo cuesta cero tokens y es exacto.
Comprueba también si hay duplicados que se pagan dos veces y qué hay realmente en el recuento de
documentos del mes.
→ `references/coste.md` §1

**C1 · ¿Se cachea el prefijo estable?**
Mira `cache_read_input_tokens` (Anthropic) o `prompt_tokens_details.cached_tokens` (OpenAI) en
respuestas reales. Si es 0 de forma constante, no está entrando. Busca fechas interpoladas en el
system prompt o catálogos sin `ORDER BY`.
→ `references/coste.md` §1

**C2 · ¿Se manda el catálogo entero en cada documento?**
El gasto evitable más grande cuando hay catálogo, y crece con cada alta. Pasa a shortlist.
→ `references/coste.md` §2

**C2b · ¿Entra el caché de verdad, y es compatible con el tier al que quieres ir?**
Dos trampas: el caché **caduca**, así que a bajo volumen disperso no ahorra nada salvo que
agrupes en tandas; y el mínimo cacheable **depende del modelo y no crece de forma ordenada**, así
que recortar el catálogo y bajar de tier a la vez puede dejar el prefijo por debajo del umbral y
salir más caro. No son palancas independientes.
→ `references/coste.md` §3

**C3 · ¿El tier del modelo está justificado con datos, y en el orden correcto?**
Extraer es transcripción. Si corre en el tier más caro sin haber medido el barato sobre
documentos reales, probablemente sobra gasto. Pero mide **después** de simplificar la tarea: un
modelo barato al que todavía le mandas el catálogo entero fallará, y habrás "demostrado" que no
sirve cuando el problema era otro. Necesitas `_ocr` para medirlo (A1).
→ `references/coste.md` §6

**C3b · ¿Se envía `effort` a un modelo que no lo acepta?**
Algunos devuelven 400 antes de leer el documento. Si el modelo se cambia por variable de entorno
para comparar tiers, esto convierte la prueba del modelo barato en una extracción rota.

**C3c · ¿Sobra algo en el esquema de salida?**
Los tokens de salida cuestan del orden de 5× los de entrada. Un campo que no acaba en columna se
paga en cada documento.
→ `references/coste.md` §5

**C4 · ¿El flujo asíncrono podría ir por API de lotes?**
Si nadie espera delante de la pantalla, es la mitad de precio.
→ `references/coste.md` §5

**C5 · ¿Está el esfuerzo/razonamiento al mínimo útil?**

**C6 · ¿Los reintentos vuelven a pagar la extracción?**
Si la llamada no está aislada con persistencia inmediata del resultado, cada reintento del
orquestador re-factura el documento.
→ `references/coste.md` §7

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

---
name: extraccion-documental
description: >
  Patrón canónico para leer documentos escaneados (facturas, albaranes, nóminas, tickets,
  recibos, partes de trabajo) con un modelo de lenguaje y convertirlos en filas de base de
  datos sin que un dato inventado llegue a producción. Úsala siempre que aparezca un escáner
  de documentos, lectura automática, OCR con IA, extracción de facturas, bandeja de revisión,
  tabla _ocr, o cuando haya que montar, auditar o abaratar un flujo que lea documentos y los
  convierta en registros — da igual si se implementa en n8n o en un endpoint propio, y da
  igual el proveedor de modelo. También cuando alguien quiera adaptar un escáner que ya
  existe a un patrón único, o pregunte por qué su extracción se inventa datos, duplica
  proveedores o cuesta demasiado. Incluye: invoice extraction, document scanning, OCR
  pipeline, human-in-the-loop review.
---

# Extracción documental con IA

## La tesis

Un modelo que lee documentos se equivoca de dos maneras: **deja un hueco** o **se inventa un
dato**. La primera es barata — alguien la rellena en dos segundos. La segunda es cara: se
cuela en una declaración tributaria, en un asiento contable, en un pago a un proveedor que no
existe. Y no avisa.

Todo lo que sigue existe para una sola cosa: **convertir errores del segundo tipo en errores
del primero**. Cada regla de este documento se puede justificar contra esa frase. Si una
decisión de diseño no reduce alucinaciones o no hace visible un hueco, probablemente sobra.

La segunda idea de fondo: **el modelo transcribe, el código verifica, la persona confirma.**
Tres papeles distintos que no se mezclan. El modelo no valida, el código no adivina, la
persona no transcribe.

## Arquitectura

Nueve pasos. El orden importa: los pasos 2 y 3 van antes de gastar dinero, y el 7 va antes de
tocar producción.

```
1. Recibir archivo          → validar tipo y tamaño
2. Verificar sesión         → con el token del usuario, nunca service role
3. Comprobar cupo           → ANTES de llamar al modelo; después ya se ha pagado
4. Guardar el original      → a storage, siempre, aunque la lectura falle
5. Cargar contexto          → catálogo de terceros/servicios, en shortlist
6. Llamar al modelo         → schema estricto + prefijo cacheado
7. Validar en código        → cuadres aritméticos, regla del cero, confianza derivada
8. Escribir en _ocr         → tabla intermedia, nunca producción
9. Revisión humana → RPC    → alta transaccional al confirmar
```

Los pasos 1-8 pueden correr en n8n, en un endpoint o mezclados. El **2, el 3 y el 9 viven en
la base de datos** como funciones llamadas con el token de quien pide — ahí es donde el RLS
los evalúa de verdad y donde un fallo de configuración no los deja abiertos por descuido.

## Las cinco reglas no negociables

Si vas con prisa, estas cinco son el patrón. El resto son detalles de ejecución.

**1. Nada de lo que diga el modelo entra en producción sin que una persona lo confirme.**
La escritura va a una tabla `_ocr`, no a `facturas`. El alta real la hace una función
transaccional al pulsar "Registrar". Sin esto, el resto de reglas son decorativas: basta un
descuido para que un total mal leído se contabilice.

**2. Un campo que puede faltar admite `null`, y está en `required`.**
Parece contradictorio y no lo es. Si un campo es obligatorio y *no* admite `null`, el modelo
pierde la opción de decir "no lo encuentro" y tiene que escribir algo: `"N/A"`, un `0`, o un
NIF inventado. Con `null` permitido, el hueco es una respuesta válida. Ver `references/esquema.md`.

**3. Un `0` en un importe que puede faltar se convierte en `null`.**
Esta es la regla que más dinero salva y la que todo el mundo omite. Un hueco genera una
pregunta; un cero se contabiliza en silencio y descuadra un cálculo sin que nadie lo note.
Va en código después de la respuesta, nunca confiada al prompt. Ver `references/validacion.md`.

**4. La confianza la calcula el código, no el modelo.**
Los modelos no son estimadores calibrados de probabilidad: la diferencia entre un 0.74 y un
0.78 autoinformados es ruido. Pide al modelo una señal gruesa (`alta`/`media`/`baja`) y
**deriva la puntuación real de comprobaciones deterministas**: ¿cuadra la suma con el total?
¿valida el dígito de control del NIF? ¿hizo match el tercero? Eso sí es un número defendible,
y además te dice *por qué* bajó.

**5. El cupo se comprueba antes de la llamada y se apunta desde el servidor.**
Después de llamar ya has pagado. Y si el consumo lo apunta el navegador, se salta. Ver
`references/datos.md`.

## Síncrono o asíncrono

No es una elección de arquitectura, es por flujo — y con la tabla `_ocr` puedes tener los dos.
El modo síncrono es simplemente "escribe en `_ocr` **y además** devuelve el JSON a la pantalla".

| Situación | Modo | Por qué |
|---|---|---|
| Un documento, lo sube quien lo tiene delante | Síncrono | Quien acaba de fotografiar la factura es quien mejor detecta un NIF mal leído, y está ahí |
| Lote (alguien vuelca 20 albaranes) | Asíncrono | No puedes retener a nadie en un spinner durante minutos |
| Lo sube A y lo revisa B | Asíncrono | El revisor no tiene el papel delante; necesita cola y original accesible |

## Montar un escáner nuevo

Trabaja en este orden. Cada paso deja algo verificable antes de pasar al siguiente, y así un
fallo aparece cerca de su causa.

1. **Modela primero la tabla `_ocr` y la RPC de confirmación** (`assets/_ocr.sql`,
   `assets/confirmar.sql`). Antes que el prompt. La forma de la tabla te dice qué campos
   necesitas de verdad, y eso es el esquema.
2. **Escribe el esquema JSON a partir de esa tabla** (`references/esquema.md`). Un campo del
   esquema = una columna. Sin capa de mapeo: cuando hay traducción intermedia, es donde se
   pierden los `null`.
3. **Escribe el prompt** con el esqueleto de seis partes (`references/prompt.md`). Esta es la
   pieza que hay que reescribir de cero para cada sector; el resto se copia.
4. **Monta la llamada** (`assets/llamada-anthropic.js` o `assets/llamada-openai.js`), con
   caché del prefijo estable desde el primer día — retrofitarla después es rehacer el prompt.
5. **Escribe las validaciones deterministas** (`references/validacion.md`). Mínimo: regla del
   cero y un cuadre aritmético propio del documento.
6. **Monta la bandeja** con marcado azul/ámbar (`references/revision.md`).
7. **Cierra la seguridad y el cupo** (`references/datos.md`) y comprueba con un token caducado
   y otro de otra organización que devuelven lo que deben.
8. **Mide coste y precisión** sobre documentos reales (`references/coste.md`) y elige el tier
   de modelo con datos, no por intuición.

## Auditar un escáner existente

Recorre `assets/auditoria.md`: es la misma lista en forma de comprobaciones, ordenada por
coste y riesgo. Los cuatro fallos que aparecen casi siempre:

- Se escribe directo en producción sin tabla intermedia.
- Hay importes donde un `0` del modelo pasa por dato bueno.
- El prefijo del prompt (instrucciones + catálogo) se reenvía sin caché en cada documento.
- El paso que escribe corre con service role en vez del token del usuario.

Informa de las desviaciones ordenadas por lo que cuestan — en euros al mes o en riesgo de dato
falso — no por orden de aparición en el código. Y no reescribas un escáner que funciona sólo
para que se parezca al patrón: arregla lo que tiene consecuencia y deja constancia del resto.

## Referencias

| Archivo | Cuándo leerlo |
|---|---|
| `references/esquema.md` | Al diseñar el JSON Schema: disciplina de `null`, límites por proveedor |
| `references/prompt.md` | Al escribir el prompt: esqueleto de seis partes y ejemplo completo |
| `references/validacion.md` | Al escribir el post-proceso: catálogo de comprobaciones deterministas |
| `references/datos.md` | Al montar tabla `_ocr`, RPC de confirmación, cupo, RLS y seguridad |
| `references/revision.md` | Al montar la bandeja y la pantalla de revisión |
| `references/coste.md` | Al elegir modelo, montar caché o cuando el gasto se dispare |

| Plantilla | Qué es |
|---|---|
| `assets/_ocr.sql` | Migración de la tabla intermedia, con índices y RLS |
| `assets/confirmar.sql` | RPC de confirmación transaccional con alta de tercero y bloqueo de duplicados |
| `assets/llamada-anthropic.js` | Bloque de llamada con `output_config.format` y caché |
| `assets/llamada-openai.js` | Equivalente con `response_format` `json_schema` estricto |
| `assets/auditoria.md` | Lista de comprobación para auditar una implementación existente |

# Coste

Extraer documentos es de los pocos usos de un modelo donde el coste es **predecible**: misma
clase de entrada, misma salida, miles de repeticiones. Eso lo hace fácil de optimizar y fácil de
dejar desbocado sin enterarse.

---

## 0. Antes de tocar nada: calibra con la factura real

No empieces asumiendo tarifas. Parte de lo que el cliente paga hoy y deduce el precio efectivo
por token:

```
180 €/mes ÷ 3.000 documentos = 0,060 €/documento
```

Reparte ese número entre las piezas que conoces —imagen, instrucciones, esquema, catálogo,
salida— y comprueba que la reconstrucción cuadra con la factura. Si cuadra, tienes un modelo del
gasto que sirve para decidir; si no cuadra, te falta una pieza y conviene encontrarla antes de
optimizar nada.

Esto es mejor que una tabla de precios por dos razones: los números absolutos salen bien sea cual
sea el proveedor, y los **porcentajes** —qué fracción se va en el catálogo, cuál en la imagen—
son robustos aunque las tarifas cambien.

---

## 1. La palanca más grande: no llamar al modelo

Antes de abaratar la llamada, pregunta si hace falta.

**Documentos con datos estructurados dentro.** Muchas facturas ya traen el dato en forma legible
por máquina: el **QR de Verifactu** (NIF, número, fecha e importe), **Facturae** o cualquier
factura electrónica en XML, los ficheros de un banco, un CSV adjunto. Leerlos cuesta **cero
tokens y tiene precisión perfecta**. Deja preparada la bifurcación:

```
¿trae XML o QR? → parsea y sáltate el modelo
                → si no, extracción con IA
```

**PDF con capa de texto.** Un PDF generado por ordenador —no escaneado— ya contiene el texto.
Mandarlo como imagen multiplica los tokens de entrada para que el modelo vuelva a leer con la
vista lo que podrías extraer literal. Detéctalo y manda el texto.

**Duplicados.** El hash del archivo, comprobado antes de llamar, evita pagar dos veces el mismo
documento. Y merece la pena mirar qué hay de verdad en ese recuento de "3.000 documentos/mes":
suelen colarse reenvíos, logos de firma de correo y páginas en blanco.

---

## 2. Higiene de la entrada

- **Resolución de la foto.** Una foto de móvil a resolución completa gasta muchos más tokens que
  la misma reducida, y por encima de cierto punto no se lee mejor. Redimensiona antes de enviar.
- **Tope de páginas.** Sin límite, un PDF de 150 páginas se va en una sola llamada con un coste
  desproporcionado. Pon un máximo y avisa en vez de tragarlo.
- **Un documento por llamada.** Agrupar varios en una sola petición para "ahorrar" mezcla
  contextos y empeora la lectura.

---

## 3. Cachear el prefijo estable

El system prompt y el esquema son **idénticos en cada documento**. Sin caché los pagas enteros
mil veces al mes.

El caché es por **coincidencia de prefijo**: cualquier byte que cambie invalida todo lo que viene
después. El orden de renderizado es `tools` → `system` → `messages`, así que va lo estable
primero, lo volátil al final, y el punto de corte entre los dos.

```js
system: [{ type: 'text', text: INSTRUCCIONES, cache_control: { type: 'ephemeral' } }],
messages: [{ role: 'user', content: [adjunto, { type: 'text', text: 'Extrae los datos.' }] }],
```

**Invalidadores silenciosos.** Si el caché no entra, casi siempre es uno de estos:

- Una fecha u hora interpolada en el system prompt (`{{ $now }}`, `new Date()`).
- El catálogo sin `ORDER BY`: cada consulta lo devuelve en otro orden y rompe el prefijo. Es el
  fallo típico cuando el contexto sale de una base de datos.
- JSON serializado con las claves en orden variable.

**Dos trampas que hacen que el caché no sirva aunque esté bien puesto:**

**Caduca.** El caché tiene una vida corta. A 4 documentos por hora expira entre llamada y
llamada y no ahorra nada. A 140 documentos al día en horario laboral, sí. Si tu volumen es bajo
y disperso, **agrupa en tandas** — lo que además encaja con la API de lotes del punto 7.

**El mínimo cacheable depende del modelo y no crece de forma ordenada.** Un prefijo por debajo
del mínimo **no cachea y no avisa**. Eso hace que el caché y el tier **no sean palancas
independientes**: recortar el catálogo (punto 4) y bajar a un modelo con mínimo alto pueden dejar
el prefijo por debajo del umbral, y salir más caro que dejar la lista larga. Es el único caso
donde más contexto cuesta menos. Comprueba el mínimo del modelo al que vas antes de decidir.

**Verifícalo, no lo supongas.** Mira los tokens leídos de caché en la respuesta
(`cache_read_input_tokens` en Anthropic, `prompt_tokens_details.cached_tokens` en OpenAI). Si
salen 0 llamada tras llamada, el caché no funciona por mucho que esté configurado.

---

## 4. No mandar el catálogo entero

En cuanto hay catálogo inyectado suele ser **la mayor parte del coste de entrada**, y crece solo:
cada alta encarece **todas** las lecturas futuras.

- **Shortlist**: 20-50 candidatos, no 800. Por frecuencia de uso, por actividad reciente, o por
  búsqueda difusa sobre el nombre transcrito.
- **Resolución determinista primero**: si el documento trae NIF, resuelve el tercero con un JOIN
  exacto en código. Es gratis, exacto y auditable. La shortlist solo hace falta cuando no hay NIF.
- **Cachea la parte estable**: si mandas un bloque fijo de habituales, que entre en el prefijo
  cacheado, con el orden fijado.

Y recuerda que la lista larga no solo cuesta: **sesga hacia el match forzado**. Un modelo con 600
nombres delante encaja un proveedor nuevo en el más parecido, en silencio. Una factura mal
imputada es peor que un duplicado. Ver `prompt.md`.

---

## 5. Higiene de la salida

Los tokens de salida cuestan del orden de **5 veces** los de entrada. Un esquema con campos que
nadie usa se paga en cada documento del mes.

- Quita del esquema lo que no acaba en una columna.
- No pidas explicaciones ni razonamientos en la respuesta: el post-proceso no los lee.
- `avisos` es texto libre a propósito y merece la pena; un campo de "comentarios" genérico, no.
- **No recortes `max_tokens` al límite.** Una respuesta truncada hay que repetirla entera, y
  entonces has pagado dos veces. Comprueba siempre el motivo de parada.

---

## 6. El tier, con datos y en el orden correcto

Extraer es **transcripción con reglas**, el trabajo donde los modelos pequeños rinden
proporcionalmente mejor. Precios por millón de tokens (consulta la página de precios para el dato
vigente):

| Modelo | Id | Entrada | Salida |
|---|---|---|---|
| Claude Opus 5 | `claude-opus-5` | $5,00 | $25,00 |
| Claude Sonnet 5 | `claude-sonnet-5` | $2,00 | $10,00 |
| Claude Haiku 4.5 | `claude-haiku-4-5` | $1,00 | $5,00 |

**El orden importa y es causal.** Baja de tier **después** de simplificar la tarea, nunca antes.
Si pruebas el modelo barato mientras todavía le mandas 600 proveedores y una imagen sin
optimizar, fallará — y habrás "demostrado" que no sirve cuando el problema era la tarea.

**Cómo elegir.** Aquí es donde la tabla `_ocr` paga su construcción:

1. Coge 50-150 documentos reales ya revisados, con `datos_ia` y `datos_revisados`.
2. Estratifica a propósito: incluye los borrosos, los raros, los de proveedores nuevos. Una
   muestra aleatoria mide el caso fácil, que es el que ya funciona.
3. Pásalos por el tier más barato y compara **campo a campo** contra `datos_revisados`.
4. Fija el listón **antes** de medir, y cambia **una palanca cada vez**.

Mira la precisión por campo, no agregada: si el modelo barato clava importes y NIF pero falla el
número de documento, la respuesta puede ser mejorar ese campo en el prompt, no cambiar de modelo.

**Sin tabla intermedia no puedes hacer nada de esto**, y te quedas atrapado en el modelo caro por
no poder demostrar que el barato aguanta. Es la razón de coste para montar `_ocr`, además de la
de riesgo.

---

## 7. Esfuerzo, lotes y reintentos

**Esfuerzo.** Para extraer, el razonamiento extendido aporta poco y se paga como salida. Baja el
esfuerzo en vez de desactivar el pensamiento: desactivarlo del todo en los modelos que lo llevan
activo por defecto tiene efectos raros, y el nivel bajo captura casi todo el ahorro.

Ojo: **`effort` no existe en toda la familia** y los modelos que no lo aceptan devuelven 400
antes de leer el documento. Si cambias de tier por variable de entorno, envíalo solo donde se
acepta — si no, "probar el modelo barato" se convierte en "romper la extracción".

**Lotes: mitad de precio.** Si el flujo ya es asíncrono, no estás pagando por latencia. La API de
lotes procesa en diferido al **50%**. Encaja con "cola de documentos y revisión posterior", y se
combina bien con agrupar para que el caché entre (punto 3). Mantén el camino síncrono solo donde
alguien espera delante de la pantalla.

**Reintentos que re-facturan.** Si la llamada al modelo no está aislada con persistencia
inmediata del resultado, cada reintento del orquestador vuelve a pagar la extracción. Guarda la
respuesta en cuanto llega, antes de cualquier paso que pueda fallar.

---

## Qué medir

Guarda en cada fila `_ocr`: `modelo`, `prompt_version`, tokens de entrada, de salida y de caché.
Con eso respondes las tres preguntas que se acaban haciendo siempre:

- **¿Cuánto cuesta un documento?** Media **por tipo**: una nómina de cuatro páginas y un ticket
  no se parecen en nada.
- **¿Está entrando el caché?** Proporción de tokens leídos de caché sobre el total de entrada.
- **¿Cuánto cuesta un documento *correcto*?** Coste del mes entre documentos registrados sin
  corrección manual. Es el único número que compara tiers de forma justa: una lectura mala cuesta
  más en tiempo de revisión que lo que ahorra en tokens.

Y como métrica de producción, el **porcentaje de documentos que no pasan las validaciones**: avisa
el mismo día, no en el cierre contable.

# Coste

Extraer documentos es de los pocos usos de un modelo donde el coste es **totalmente
predecible**: mismo tipo de entrada, mismo tamaño de salida, miles de repeticiones. Eso lo hace
fácil de optimizar y fácil de dejar desbocado sin enterarse.

Los cuatro palancas, **en este orden**. Las dos primeras no cuestan calidad: agótalas antes de
tocar el modelo.

## 1. Cachear el prefijo estable (gratis, la primera siempre)

El system prompt, el esquema y la parte fija del contexto son **idénticos en cada documento**.
Sin caché los pagas enteros mil veces al mes.

Cómo funciona en las dos APIs: el caché es por **coincidencia de prefijo**. Cualquier byte que
cambie invalida todo lo que viene después. El orden de renderizado es `tools` → `system` →
`messages`, así que:

- Lo estable primero: instrucciones, esquema, reglas del sector.
- Lo volátil al final: el documento, la shortlist del catálogo, cualquier marca de tiempo.
- El punto de corte del caché, entre los dos.

```js
system: [
  { type: 'text', text: INSTRUCCIONES, cache_control: { type: 'ephemeral' } },
],
messages: [{ role: 'user', content: [adjunto, { type: 'text', text: 'Extrae los datos.' }] }],
```

**Invalidadores silenciosos** — si el caché no entra, casi siempre es uno de estos:

- Una fecha u hora dentro del system prompt (`new Date()` interpolado).
- El catálogo ordenado de forma no determinista: un `SELECT` sin `ORDER BY` devuelve las filas
  en orden distinto y rompe el prefijo cada vez.
- JSON serializado con claves en orden variable.
- El prefijo por debajo del mínimo cacheable (varía por modelo, del orden de miles de tokens):
  por debajo no cachea y no avisa.

**Verifícalo, no lo supongas.** Mira `usage.cache_read_input_tokens` en la respuesta: si sale 0
llamada tras llamada, el caché no está funcionando por mucho que lo hayas configurado. Los
multiplicadores exactos de lectura y escritura de caché están en la página de precios del
proveedor; lo que importa aquí es que la lectura cuesta una fracción del token normal y la
escritura lleva un pequeño recargo — con volumen, compensa desde el segundo documento.

## 2. No mandar el catálogo entero (gratis)

Es el gasto evitable más grande en cuanto hay catálogo inyectado, y crece solo: cada proveedor
nuevo encarece **todas** las lecturas futuras.

Un catálogo de 800 proveedores son varios miles de tokens en cada documento. A mil documentos
al mes, estás pagando millones de tokens por enviar una lista que casi nunca cambia.

Dos arreglos, compatibles entre sí:

**Shortlist.** Manda 20-50 candidatos, no 800. Sácalos de una búsqueda previa barata — por
frecuencia de uso, por los últimos meses, o con una búsqueda difusa sobre el texto si haces una
primera pasada. La precisión no baja: el proveedor correcto está casi siempre entre los
frecuentes.

**Cachea la parte que sí es estable.** Si mandas un bloque fijo (los 50 proveedores habituales),
ponlo dentro del prefijo cacheado y deja fuera sólo lo que varía por documento.

Y recuerda que la shortlist también reduce el sesgo hacia el match forzado — ver `prompt.md`.

## 3. Elegir el tier de modelo con datos

Extraer es **transcripción con reglas**, no razonamiento profundo. Es de los trabajos donde los
modelos pequeños rinden proporcionalmente mejor. Precios por millón de tokens (Anthropic,
consultar la página de precios para el dato vigente):

| Modelo | Id | Entrada | Salida |
|---|---|---|---|
| Claude Opus 5 | `claude-opus-5` | $5.00 | $25.00 |
| Claude Sonnet 5 | `claude-sonnet-5` | $2.00 | $10.00 |
| Claude Haiku 4.5 | `claude-haiku-4-5` | $1.00 | $5.00 |

**Orden de magnitud** para una factura escaneada (≈3.600 tokens de entrada contando imagen,
instrucciones y esquema; ≈350 de salida), sin caché:

| Modelo | Por documento | 1.000 documentos/mes |
|---|---|---|
| Opus 5 | ≈ $0,027 | ≈ $27 |
| Sonnet 5 | ≈ $0,011 | ≈ $11 |
| Haiku 4.5 | ≈ $0,005 | ≈ $5 |

Son estimaciones para dimensionar, no una factura: el tamaño real de tu imagen manda. Mide con
el contador de tokens o con el `usage` de tus propias respuestas.

**Cómo elegir, sin adivinar.** Aquí es donde la tabla `_ocr` paga su coste de construcción:

1. Coge 50 documentos reales ya revisados, con `datos_ia` y `datos_revisados`.
2. Vuelve a pasarlos por el tier más barato.
3. Compara campo a campo contra `datos_revisados`, que es la verdad.
4. Mira la precisión **por campo**, no agregada: si Haiku falla sólo en el número de factura
   pero clava importes y NIF, quizá la respuesta no es cambiar de modelo sino mejorar ese campo
   en el prompt.

Baja de tier si la precisión aguanta. Si no, quédate donde estás: una lectura mala cuesta más
en tiempo de revisión que lo que ahorras en tokens. **El coste que importa es por documento
correctamente registrado**, no por llamada.

## 4. Ajustar esfuerzo y razonamiento

Para extraer, el razonamiento extendido aporta poco y se paga. Con la API de Anthropic, baja el
esfuerzo en lugar de desactivar el pensamiento:

```js
output_config: {
  effort: 'low',                                   // extraer no necesita profundidad
  format: { type: 'json_schema', schema: ESQUEMA },
}
```

Desactivarlo del todo en los modelos que lo llevan activo por defecto tiene efectos raros
—llamadas a herramientas escritas en el texto visible, etiquetas internas filtradas— y `low`
ya captura casi todo el ahorro sin esos riesgos.

Y el otro lado: **no recortes `max_tokens`** hasta el límite. Una respuesta cortada a medias hay
que repetirla entera, y entonces has pagado dos veces.

## 5. Lotes asíncronos: mitad de precio

Si tu flujo ya es asíncrono —alguien vuelca 20 albaranes y los revisa luego—, no estás pagando
por latencia. La **API de lotes** procesa de forma diferida **al 50% del precio**.

Encaja exactamente con el caso "cola de documentos con revisión posterior": el documento llega,
entra en la cola, y la bandeja se rellena cuando esté. Nadie espera delante de la pantalla.

Mantén el camino síncrono para la subida de un documento suelto, donde la latencia sí importa.
Es la misma razón por la que el modo lo decide el flujo y no la arquitectura — ver SKILL.md.

## Qué medir

Guarda en cada fila `_ocr`: `modelo`, `prompt_version`, `tokens_entrada`, `tokens_salida` y los
tokens de lectura de caché. Con eso respondes las tres preguntas que se acaban haciendo siempre:

- **¿Cuánto cuesta un documento?** Media por tipo, no global: una nómina de cuatro páginas y un
  ticket no se parecen en nada.
- **¿Está entrando el caché?** Proporción de tokens leídos de caché sobre el total de entrada.
  Si es baja con prefijo estable, hay un invalidador.
- **¿Cuánto cuesta un documento *correcto*?** Coste total del mes entre documentos registrados
  sin corrección manual. Es el único número que compara tiers de forma justa.

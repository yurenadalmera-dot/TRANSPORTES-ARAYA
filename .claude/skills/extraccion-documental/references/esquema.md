# El esquema JSON

## Regla base: un campo = una columna

El esquema se calca de la tabla `_ocr`. Sin capa de traducción intermedia: lo que devuelve el
modelo entra directo en la fila. Cuando hay un mapeo en medio ("el modelo devuelve `importe` y
yo lo guardo en `base_imponible`"), es exactamente ahí donde se pierden los `null` y donde
nadie se acuerda de actualizar los dos lados al añadir un campo.

Si un campo del esquema no tiene columna, o sobra o falta una columna.

## La trampa de `required` sin `null`

Esta es la parte contraintuitiva y la más importante del archivo.

Un campo que está en `required` y **no** admite `null` obliga al modelo a escribir algo. No
tiene la opción de callarse. Cuando el NIF está borroso, no devuelve un hueco: devuelve
`"N/A"`, o `"B00000000"`, o el NIF de otra empresa que aparecía en el pie de página.

```jsonc
// MAL: el modelo no puede decir "no lo encuentro"
"nif_emisor": { "type": "string" }

// BIEN: el hueco es una respuesta válida
"nif_emisor": { "type": ["string", "null"] }
```

Esto no es opcional en modo estricto de OpenAI, donde **todas** las propiedades tienen que
estar en `required` — la única forma de expresar "puede faltar" es la unión con `null`. La
restricción del proveedor y la regla de diseño coinciden, cosa que conviene.

## Dónde gastar el `null`

No todos los campos lo necesitan, y en algunos proveedores hay un techo (ver abajo). El
criterio es el daño que hace un valor inventado:

| Tipo de campo | ¿Admite `null`? | Por qué |
|---|---|---|
| Identificadores (NIF, nº de documento, matrícula, IBAN) | **Sí** | Un identificador falso se propaga a libros, declaraciones y pagos |
| Importes y fechas | **Sí** | Un número inventado descuadra un cálculo sin avisar |
| Descriptivos (nombre del emisor, concepto, observaciones) | No hace falta | Si falta, `""` es aceptable: nadie liquida impuestos con el campo "concepto" |
| Enumerados con default razonable (`tipo`, `tipo_doc`) | No | Fija el valor más frecuente como default y pide que avise cuando dude |

## Límites por proveedor

**Anthropic.** Máximo **16 propiedades con tipo unión** (`string|null`, `number|null`, …) en un
mismo esquema. Pasar de ahí devuelve 400 (`invalid_request_error`, "too many parameters with
union types") *antes* de leer el documento. Si chocas con el techo, aplica la tabla de arriba:
quita el `null` de los descriptivos, nunca de los identificadores ni de los importes.

**OpenAI (modo estricto).** Todas las propiedades en `required`, `additionalProperties: false`
en cada objeto, y profundidad y número de propiedades acotados. Sin `strict: true` el esquema
es una sugerencia, no una garantía — compruébalo, porque es un fallo silencioso: parece que
funciona hasta el documento raro.

**Protege el techo con una prueba.** El límite se alcanza en silencio: el esquema funciona hasta
que alguien añade un campo anulable perfectamente razonable y la extracción entera empieza a
devolver 400, con un error que no menciona el campo nuevo. Una prueba lo convierte en un fallo
local y explicado:

```js
test('el esquema no pasa de 16 tipos unión (la API responde 400 en 17)', () => {
  const union = Object.values(ESQUEMA.properties)
    .filter((v) => Array.isArray(v.type) && v.type.includes('null'));
  assert.ok(union.length <= 16,
    `Hay ${union.length} propiedades con tipo unión. Para añadir un campo anulable hay que `
    + 'quitarle el null a uno descriptivo, nunca a un identificador ni a un importe.');
});
```

En los dos casos: **pide el esquema estricto de verdad**. "Devuélveme JSON" en el prompt más un
`JSON.parse` no es salida estructurada, es una esperanza. Aun así, envuelve el parseo en
`try/catch`: el coste de hacerlo es cero y el día que falle no tumbará el flujo.

## Los dos campos que no son datos

Todo esquema lleva dos campos que no salen del documento sino que describen la lectura:

```jsonc
"confianza": { "type": "string", "enum": ["alta", "media", "baja"] },
"avisos": {
  "type": "array",
  "items": { "type": "string" },
  "description": "Lo que la persona debe mirar con atención. Vacío si no hay nada."
}
```

`confianza` se pide como enumerado grueso a propósito. Un modelo no es un estimador calibrado:
un `0.82` autoinformado sugiere una precisión que no existe. Tres categorías son honestas
respecto a lo que el modelo realmente distingue. **La puntuación fina que decide el
enrutamiento la calcula el código** con comprobaciones deterministas — ver `validacion.md`.

`avisos` es texto libre y es deliberado: es el único sitio donde el modelo puede contarte algo
que no habías previsto ("la factura lleva IVA y no IGIC", "hay dos totales y no coinciden",
"la firma está tachada"). Un esquema cerrado no puede capturar lo que no anticipaste.

## `description` es parte del contrato

El campo `description` de cada propiedad llega al modelo. Úsalo para el formato y para la
trampa concreta de ese campo, no para repetir el nombre:

```jsonc
// Inútil
"fecha": { "type": ["string","null"], "description": "La fecha" }

// Útil
"fecha": { "type": ["string","null"], "description": "Fecha de emisión, AAAA-MM-DD" },
"ss_empresa": {
  "type": ["number","null"],
  "description": "Cotización a cargo de la EMPRESA. Si el documento trae las líneas sueltas (contingencias comunes, AT y EP, desempleo, formación, FOGASA), súmalas."
},
"coste_total": {
  "type": ["number","null"],
  "description": "TAL CUAL figure impreso. null si no aparece: NO lo calcules."
}
```

Ese último patrón — pedir un número impreso y prohibir calcularlo — es lo que después permite
**cuadrar** en código sin fiarte de la aritmética del modelo. Ver `validacion.md`.

## Ejemplo mínimo

```jsonc
{
  "type": "object",
  "additionalProperties": false,
  "required": ["tipo_doc","fecha","num_documento","emisor","nif_emisor",
               "base","impuesto_pct","impuesto","total","confianza","avisos"],
  "properties": {
    "tipo_doc":      { "type": "string", "enum": ["factura","albaran","nomina"] },
    "fecha":         { "type": ["string","null"], "description": "AAAA-MM-DD" },
    "num_documento": { "type": ["string","null"] },
    "emisor":        { "type": "string", "description": "Razón social de quien emite" },
    "nif_emisor":    { "type": ["string","null"] },
    "base":          { "type": ["number","null"], "description": "Base imponible, sin impuestos" },
    "impuesto_pct":  { "type": ["string","null"], "description": "Tipo tal cual figura: \"7%\", \"0%\"" },
    "impuesto":      { "type": ["number","null"] },
    "total":         { "type": ["number","null"], "description": "TAL CUAL figure en el pie. No lo calcules." },
    "confianza":     { "type": "string", "enum": ["alta","media","baja"] },
    "avisos":        { "type": "array", "items": { "type": "string" } }
  }
}
```

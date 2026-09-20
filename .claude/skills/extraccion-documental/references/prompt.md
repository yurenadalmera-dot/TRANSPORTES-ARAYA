# El prompt de extracción

Es la pieza que más determina la calidad y la única que hay que **reescribir entera** para cada
sector. El esqueleto se conserva; el vocabulario y las reglas de negocio no se pueden copiar de
un dominio a otro.

Lo que hace bueno a un prompt de extracción no es la técnica: es que **describa el documento
físico** que el modelo va a ver, no la tarea en abstracto. "Extrae la Seguridad Social de la
empresa" es una tarea. "Está en el cuadro del pie, 'Determinación de las bases de cotización',
columna 'Aportación Empresarial', repartida en cinco líneas que hay que sumar" es una
descripción. La segunda funciona muchísimo mejor.

## Esqueleto de seis partes

Escríbelas en este orden y numeradas, diciendo explícitamente que van **por orden de
importancia**. Cuando dos reglas chocan sobre un documento raro, el modelo necesita saber cuál
gana.

### 1. Rol y contexto del negocio
Quién eres, para quién, y el marco que cambia la interpretación: sector, país o región, moneda,
impuesto aplicable, idioma de los documentos.

> Extraes datos de facturas y nóminas españolas para una asesoría de Canarias.

Corto. El contexto que importa es el que cambia una decisión (Canarias → IGIC, no IVA), no la
presentación de la empresa.

### 2. Regla anti-alucinación, siempre la primera
> **NO TE INVENTES NADA.** Si un dato no está visible en el documento, devuélvelo como `null`.
> Un hueco se rellena a mano en dos segundos; un dato inventado se cuela en una declaración.

Incluye el **porqué**. Un modelo que entiende la consecuencia generaliza a campos que no
enumeraste; uno que sólo recibe la orden, no.

### 3. Formato de cada campo
Fechas en ISO, números con punto decimal y sin separador de miles ni símbolo de moneda,
matrículas en mayúsculas, conversiones de unidad con aviso. Da el ejemplo de la conversión:

> `"1.234,56 €"` es `1234.56`.

### 4. Lógica de negocio del sector
La parte larga, y la que no se copia. Aquí va dónde está físicamente cada dato difícil, cómo
distinguir dos casos que se parecen, y qué hacer ante la duda. Cuando un error es asimétrico,
dilo y explica por qué:

> Si no puedes distinguir con seguridad si la factura la emite o la recibe la empresa, pon
> "gasto" —que es lo más frecuente—, baja la confianza y dilo en un aviso.

> Ante la duda entre conformidad e incidencia, marca **incidencia**: un albarán conforme que
> era incidencia se factura mal y el cliente lo descubre; al revés sólo cuesta una revisión.

### 5. Confianza
> Si el documento está borroso, cortado, torcido o hay cifras que no lees con seguridad, baja
> la confianza y di exactamente de qué campo no te fías.

Pide la señal gruesa (`alta`/`media`/`baja`). El número fino lo calcula el código.

### 6. Avisos
> Los avisos los va a leer una persona con prisa: frases cortas y concretas, en español, sin
> tecnicismos. Si no hay nada que avisar, deja la lista vacía.

Decir quién los lee cambia mucho cómo se escriben.

## Contexto inyectado: normalizar sin forzar

Pasar el catálogo existente (proveedores, clientes, servicios) evita que cada lectura cree un
duplicado — que "CUBA DE AGUA POTABLE 12.000L" y "Cuba agua potable 12000 l" acaben siendo dos
servicios. Es una de las mejoras de precisión más grandes que hay, con dos peligros reales:

**No escala.** Un catálogo de 800 proveedores son miles de tokens reenviados en cada documento.
Manda una **shortlist**, no el catálogo entero. Ver `coste.md`.

**Sesga hacia el match.** Un modelo al que le enseñas 50 proveedores tiende a elegir uno aunque
el correcto no esté. Un proveedor nuevo se convierte entonces en una factura mal imputada, que
es peor que no haber normalizado.

La forma robusta es **separar transcripción de resolución**:

```jsonc
"emisor_literal":  { "type": "string",          "description": "Nombre TAL CUAL aparece impreso" },
"emisor_id":       { "type": ["string","null"], "description": "Id del catálogo si es claramente el mismo. null si no estás seguro o no está." }
```

Así nunca pierdes lo que decía el papel, "proveedor nuevo" es una salida válida, y el match
lleva su propia confianza que el código puede verificar por separado. Si el modelo devuelve
`emisor_id`, comprueba en código que ese id existe de verdad en el catálogo: los identificadores
inventados también existen.

## Dónde vive el prompt

**En un nodo o archivo aparte del que hace la llamada.** En n8n, un nodo "Preparar petición IA"
distinto del HTTP Request. En código, una constante exportada, no un literal dentro de la
función. Dos razones: iteras el prompt sin tocar la integración, y el prompt es el prefijo que
quieres cachear — necesita ser estable y fácil de comparar entre versiones.

Versiona el prompt junto al esquema. Cambiar uno sin el otro es el origen de la mitad de los
fallos raros.

## Colocación del documento

El adjunto va **antes** del texto en el contenido del mensaje, no después:

```js
content: [ adjunto, { type: 'text', text: 'Extrae los datos de este documento.' } ]
```

Es lo que recomiendan las dos APIs: el modelo tiene el documento presente al leer la
instrucción. La instrucción final puede ser tan corta como esa: el trabajo lo hace el system
prompt, que además es lo que se cachea.

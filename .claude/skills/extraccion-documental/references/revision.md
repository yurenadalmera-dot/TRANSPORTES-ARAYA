# La bandeja de revisión

La bandeja es donde el patrón se gana el sueldo. Un escáner con buena extracción y mala bandeja
produce revisiones de mentira: la gente confirma en bloque sin mirar, y entonces daba igual todo
lo anterior.

El objetivo de diseño: **que revisar de verdad sea más rápido que confirmar a ciegas**.

## La lista

Una fila por documento, con lo justo para decidir sin abrirlo:

| Columna | Por qué está |
|---|---|
| Nº y fecha | Identifica el documento |
| Tercero | Lo primero que se comprueba de un vistazo |
| Total | El dato que más duele si está mal |
| Fiabilidad | Con los motivos, no sólo el número |
| Avisos | Un icono con el recuento; el texto al pasar por encima |
| Doc | Abre el escaneo original |
| Revisar | Entra a la pantalla de corrección |

Ordena por fiabilidad ascendente por defecto: lo dudoso primero. Y deja filtrar por "sólo los
que necesitan atención", porque en un lote de 40 albaranes los 35 limpios son ruido.

El botón **Doc** no es opcional. Revisar sin poder ver el original obliga a fiarse, que es justo
lo que no queremos.

## Los tres estados visuales

Esta es la pieza que casi todo el mundo omite, y la que más cambia el comportamiento:

| Marca | Significado | Qué hace la persona |
|---|---|---|
| **Azul** | Lo rellenó la máquina | Repasarlo |
| **Ámbar** | La máquina lo intentó y **no lo encontró** | Escribirlo |
| Sin marca | Lo escribió una persona, o no aplica | Nada |

El ámbar es la mitad que se olvida. Sin él, un campo vacío porque el modelo no lo encontró es
indistinguible de un campo vacío porque no aplica — y se confirma sin rellenar. Con él, la
pantalla te dice literalmente qué te queda por hacer.

Se calcula contra la lista de campos imprescindibles del tipo de documento (ver
`validacion.md`), y **después** del volcado: si la persona ya escribió algo, no hay nada que
reclamarle.

```js
const marca = (campo) => {
  if (rellenadosPorIA.includes(campo)) return 'leido';   // azul
  if (faltantes.includes(campo))       return 'falta';   // ámbar
  return '';
};
```

**En cuanto la persona teclea en un campo, deja de estar marcado.** Ya lo ha mirado; seguir
señalándolo entrena a ignorar las marcas.

## El volcado

Al pasar lo leído al formulario, dos reglas:

```js
// Sólo se tocan los campos que vienen con valor:
// un null del modelo nunca borra lo que ya escribió una persona.
for (const [campo, valor] of Object.entries(datos)) {
  if (valor === null || valor === '') continue;
  formulario[campo] = valor;
  rellenados.push(campo);
}
```

Si alguien empezó a rellenar a mano mientras la lectura iba por detrás, su trabajo gana. Es el
caso normal en el flujo asíncrono y es exasperante cuando no se respeta.

## Los avisos, visibles

Los avisos del modelo van arriba, en texto, no escondidos tras un icono. Son frases escritas
para leerse:

> Los números no cuadran: base 1.240,00 más impuesto 86,80 no da el total 1.316,80 que figura
> en la factura. Revisa los tres antes de guardar.

Junto a ellos, los motivos de fiabilidad que calculó el código. Las dos fuentes dicen cosas
distintas: el modelo avisa de lo que vio raro en el papel, el código de lo que no cuadra al
comprobarlo.

## Confirmar

Un solo botón que llama a la RPC transaccional. Antes de habilitarlo:

- Ningún campo imprescindible en ámbar.
- Si hay duplicado detectado, confirmación expresa con una casilla aparte.
- Si la fiabilidad está por debajo del umbral, que la persona lo reconozca explícitamente.

Y al confirmar, **guarda `datos_revisados` aunque no haya cambiado nada**. "La persona miró
esto y lo dio por bueno" es información: es la que te dice que el modelo acertó, y sin ella no
puedes medir nada.

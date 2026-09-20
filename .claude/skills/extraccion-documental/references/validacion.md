# Validación determinista

Todo lo de este archivo va **en código, después de la respuesta del modelo**. Nada aquí se
delega al prompt. Un prompt es una petición; una validación es una garantía, y hacen falta las
dos.

El principio: **el modelo extrae, el código verifica por contraste, y nadie corrige a ciegas.**
Cuando una comprobación falla, se avisa y se baja la confianza — no se "arregla" el número. Un
dato corregido en silencio por una heurística es otra vez el problema que intentamos evitar.

## 1. La regla del cero

La más importante, y la que casi nadie implementa.

```js
// Un 0 en un importe que puede faltar se trata como "no lo he encontrado"
if (datos.ss_empresa === 0) {
  datos.ss_empresa = null;
  datos.avisos.push('No hemos encontrado la Seguridad Social a cargo de la empresa. '
    + 'Sin ese dato el cálculo sale más alto de lo que toca: búscala en el RLC.');
  datos.confianza = 'media';
}
```

Por qué: un `null` genera una pregunta en la bandeja; un `0` se contabiliza en silencio. Son
resultados completamente distintos a partir del mismo fallo de lectura.

**Aplícala a todo importe donde el cero sea semánticamente distinto de "ausente"**, que suele
ser casi todos: retenciones, cuotas de impuesto, cotizaciones, descuentos, bultos, kilómetros.
La excepción son los campos donde el cero es un valor real y frecuente — una cuota de IGIC al
0% es un cero legítimo. Distínguelos mirando si existe el tipo impositivo: `impuesto: 0` con
`impuesto_pct: "0%"` es bueno; `impuesto: 0` con `impuesto_pct: null` es sospechoso.

## 2. Cuadres aritméticos por contraste

Pide al modelo **números impresos** y compara entre ellos, en vez de fiarte de que sume bien.
Hay tres desenlaces y los tres importan:

```js
const hay = (v) => typeof v === 'number' && Number.isFinite(v);

if (hay(base) && hay(total) && !hay(impuesto)) {
  // Falta uno, los otros dos están: se deduce. Restar dos cifras impresas es
  // más fiable que confiar en una suma que el modelo no ha hecho bien.
  datos.impuesto = Math.round((total - base) * 100) / 100;
  datos.avisos.push('La cuota se ha deducido del total menos la base. Compruébala.');
  datos.confianza = 'media';

} else if (hay(base) && hay(impuesto) && hay(total)
           && Math.abs(base + impuesto - total) > 0.02) {
  // Los tres están y no cuadran: uno se ha leído mal, y no sabemos cuál.
  // No se corrige ninguno. Avisar es lo único honesto.
  datos.avisos.push(`Los números no cuadran: base ${base} más impuesto ${impuesto} `
    + `no da el total ${total} que figura. Revisa los tres antes de guardar.`);
  datos.confianza = 'baja';
}
```

La tolerancia de `0.02` absorbe redondeos legítimos. Si tu dominio acumula más redondeo (líneas
de detalle, prorrateos), súbela con criterio y déjalo comentado — una tolerancia sin
justificación acaba creciendo hasta tapar errores reales.

## 3. Validación de identificadores

Los identificadores tienen estructura comprobable. Úsala: es gratis y detecta lecturas malas
que ninguna otra regla ve.

- **NIF/CIF español**: longitud, formato y **dígito de control**. Un NIF con letra incorrecta es
  casi siempre un dígito mal leído, no un NIF raro.
- **IBAN**: validación módulo 97.
- **Matrícula**: formato del país.
- **Fecha**: que exista (un 31 de febrero es una lectura mala) y que sea plausible — una factura
  fechada dentro de tres años, o quince años atrás, merece un aviso.

Cuando la comprobación falla, **conserva el valor leído** además de avisar. La persona que
revisa necesita ver qué puso el modelo para compararlo con el papel; borrarlo la obliga a
transcribir desde cero.

## 4. Verificar los identificadores del catálogo

Si el modelo devuelve el id de un tercero o de un servicio del catálogo inyectado, comprueba
que existe:

```js
if (datos.emisor_id && !catalogo.has(datos.emisor_id)) {
  datos.avisos.push(`El proveedor asignado no existe en el catálogo. Se ha dejado sin asignar.`);
  datos.emisor_id = null;
  datos.confianza = 'baja';
}
```

Los ids alucinados son menos frecuentes que los datos alucinados, pero mucho más difíciles de
detectar a simple vista en una bandeja: un id parece siempre correcto.

## 5. La confianza que decide el enrutamiento

Parte de la señal del modelo y **réstale por cada comprobación fallida**. Así el número tiene
una explicación y puedes enseñarla:

```js
const PESOS = { alta: 1.0, media: 0.7, baja: 0.4 };
let score = PESOS[datos.confianza] ?? 0.4;
const motivos = [];

if (!cuadraTotal)          { score -= 0.30; motivos.push('el total no cuadra'); }
if (!nifValido)            { score -= 0.20; motivos.push('el NIF no valida'); }
if (!datos.num_documento)  { score -= 0.15; motivos.push('falta el número'); }
if (!datos.fecha)          { score -= 0.15; motivos.push('falta la fecha'); }
if (datos.emisor_id === null) { score -= 0.10; motivos.push('proveedor sin asignar'); }

datos.fiabilidad = Math.max(0, Math.round(score * 100) / 100);
datos.motivos_fiabilidad = motivos;
```

Guarda `motivos_fiabilidad` junto al número. En la bandeja, "0.55 — el total no cuadra, el NIF
no valida" es accionable; "0.55" a secas obliga a abrir el documento para averiguar qué pasa.

Los pesos son un punto de partida: ajústalos con documentos reales, mirando qué comprobaciones
predicen de verdad una corrección humana. Una comprobación que nunca cambia el resultado sólo
añade ruido.

## 6. Campos imprescindibles por tipo de documento

Declara qué campos son obligatorios en cada tipo y marca los que sigan vacíos **después** del
volcado. Un campo que no está en la lista puede faltar sin que pase nada (una factura sin
retención es lo normal) y marcarlo sería ruido que acaba ignorándose.

```js
const IMPRESCINDIBLES = {
  factura: ['fecha','emisor','nif_emisor','num_documento','base','total'],
  albaran: ['fecha','cliente','servicio','matricula'],
  nomina:  ['empleado','nif_empleado','periodo','salario_bruto','ss_empresa','liquido'],
};
```

Esa lista es la que alimenta el marcado ámbar de la bandeja. Ver `revision.md`.

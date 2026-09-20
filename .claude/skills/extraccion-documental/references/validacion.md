# Validación determinista

Todo lo de este archivo va **en código, después de la respuesta del modelo**. Nada se delega al
prompt. Un prompt es una petición; una validación es una garantía, y hacen falta las dos.

El principio: **el modelo extrae, el código verifica por contraste, y nadie corrige a ciegas.**
Cuando una comprobación falla se avisa y se baja la confianza — no se "arregla" el número. Un
dato corregido en silencio por una heurística es otra vez el problema que intentamos evitar.

---

## 0. El orden de los bloques es causal

Esto va primero porque es lo que más caro sale y lo que menos se ve al revisar un diff. Las
validaciones no son una lista de comprobaciones independientes: **unas alimentan a otras**, y
puestas en el orden equivocado se anulan entre sí sin dar ningún error.

El orden correcto es siempre:

```
1. Regla del cero      → convierte ceros sospechosos en huecos
2. Cuadres             → rellena huecos desde lo que sí está impreso
3. Avisos              → reclama solo lo que sigue faltando
```

### El caso real que motiva esta sección

Un módulo en producción tenía la regla del cero **después** del cuadre. Parecía inocuo. Lo que
pasaba:

```js
const hay = (v) => typeof v === 'number' && Number.isFinite(v);

// CUADRE (corría primero)
if (hay(bruto) && hay(coste) && !hay(datos.ss_empresa)) {
  datos.ss_empresa = coste - bruto;          // deduce el dato que falta
}

// REGLA DEL CERO (corría después)
if (datos.ss_empresa === 0) datos.ss_empresa = null;
```

Con `ss_empresa: 0`, `hay(0)` es **true**. Así que la rama que deduce el dato no se ejecutaba
nunca, y el cero se convertía en `null` cuando ya era tarde para recuperarlo. Resultado: el
mismo fallo de lectura daba dos desenlaces opuestos según cómo lo expresara el modelo.

| El modelo devuelve | Resultado |
|---|---|
| `null` | Se deduce del coste total. Nadie hace nada. |
| `0` | Se pierde el dato teniéndolo al alcance. Alguien va a buscarlo a mano. |

Y la regla del cero, al ejecutarse última, **sobreescribía** el `baja` del cuadre dejándolo en
`media`: el documento con el problema detectado bajaba en una bandeja ordenada por fiabilidad,
justo al revés de lo que debería.

**Protégelo con una prueba de simetría.** Es la que caza la regresión si alguien reordena:

```js
test('0 y null dan el mismo resultado', () => {
  assert.equal(postproceso({ ...base, ss_empresa: 0 }).ss_empresa,
               postproceso({ ...base, ss_empresa: null }).ss_empresa);
});
```

Para poder escribirla, **el post-proceso tiene que ser una función pura exportada**, no código
suelto dentro de la función que llama a la API. Sacarlo es parte del patrón, no un extra.

---

## 1. La regla del cero

La más importante, y la que casi nadie implementa.

**No es una regla de IA: es una regla de fronteras.** Cada vez que un dato entra desde fuera —un
modelo, una API de terceros, un CSV, un formulario, un webhook— hay que decidir si un cero
significa cero o significa "no venía". Un modelo la incumple porque alucina; una API porque
alguien escribió `Number(campo ?? 0)`. El daño es idéntico:

```js
// El mismo fallo sin ningún modelo de por medio
total_amount: Number(r.total_amount ?? r.totalAmount ?? 0),
```

Si esa API deja de mandar el importe, la fila se guarda con 0 €, los cálculos que dependen de
ella salen de ese cero, y en un registro que **ya existía** se sobreescribe el valor bueno.
Ninguna excepción, ningún log: un `0` tiene pinta de dato, no de error.

```js
if (datos.ss_empresa === 0) {
  datos.ss_empresa = null;
  bajar('media');
}
```

Un `null` genera una pregunta; un `0` se contabiliza en silencio. Son resultados opuestos a
partir del mismo fallo.

### Dónde aplicarla, y dónde no

Aplícala a todo importe donde el cero **no** sea un valor real y frecuente. Pero no la apliques
en bloque: un aviso que salta siempre se acaba ignorando, y un aviso ignorado deja de proteger.

| Campo | ¿Convertir `0` en `null`? | Por qué |
|---|---|---|
| Base, total, devengado, líquido | **Sí** | Un documento con importe cero es una anomalía que hay que mirar |
| Cotizaciones sociales | **Sí** | El cero infla el rendimiento neto y el cliente paga de más |
| Kilómetros, bultos, unidades | **Sí** | El cero es casi siempre lectura fallida |
| Retenciones de IRPF | **No** | La mayoría de facturas no llevan retención; un salario bajo tiene 0% |
| Descuentos | **No** | Lo normal es que no haya |
| Cuota de impuesto | **Depende** | Ver abajo |

El impuesto es el caso que necesita matiz, y el patrón se reutiliza: **un cero es real cuando
otro campo del documento lo respalda.**

```js
// Una cuota de 0 € es legítima si el tipo impreso es 0% o exento.
// Sin un tipo que lo justifique, es un hueco — y se lleva por delante
// impuesto deducible.
if (datos.impuesto === 0
    && !/^\s*(0([.,]0+)?\s*%|exento)\s*$/i.test(datos.impuesto_pct || '')) {
  datos.impuesto = null;
  avisar('Hay una cuota a cero sin un tipo del 0% que lo justifique. Compruébala.');
  bajar('media');
}
```

### Comprueba la cobertura

El fallo típico no es olvidar la regla: es ponerla **en un solo campo** y creer que está
resuelta. Recorre el esquema entero y decide campo por campo. Una tabla declarativa hace
visible lo que se ha decidido, y una prueba puede recorrerla:

```js
const CERO_SOSPECHOSO = {
  nomina:  [['salario_bruto','el devengado'], ['liquido','el líquido'],
            ['ss_empleado','la cotización del trabajador'],
            ['ss_empresa','la Seguridad Social de la empresa']],
  factura: [['base','la base imponible'], ['total','el total']],
};
```

---

## 2. Cuadres por contraste

Pide al modelo **números impresos** y compara entre ellos, en vez de fiarte de que sume bien.
Tres desenlaces, y los tres importan:

```js
if (hay(base) && hay(total) && !hay(impuesto)) {
  // Falta uno y los otros dos están: se deduce. Restar dos cifras
  // impresas es más fiable que confiar en una suma que el modelo no hizo.
  datos.impuesto = Math.round((total - base) * 100) / 100;
  recuperados.add('impuesto');          // ← para no reclamarlo en el paso 3
  avisar('La cuota se ha deducido del total menos la base. Compruébala.');
  bajar('media');

} else if (hay(base) && hay(impuesto) && hay(total)
           && Math.abs(base + impuesto - total) > 0.02) {
  // Los tres están y no cuadran: uno se ha leído mal y no sabemos cuál.
  // No se corrige ninguno. Avisar es lo único honesto.
  avisar(`Los números no cuadran: base ${base} más impuesto ${impuesto} no da `
       + `el total ${total} que figura. Revisa los tres antes de guardar.`);
  bajar('baja');
}
```

La tolerancia de `0.02` absorbe redondeos legítimos. Si tu dominio acumula más redondeo, súbela
**con el motivo comentado**: una tolerancia sin justificación acaba creciendo hasta tapar
errores reales.

Este bloque solo funciona si el prompt pidió los números **tal cual están impresos** y prohibió
calcularlos. Si el modelo los deduce, cuadran siempre y el cuadre no comprueba nada. Ver
`prompt.md`.

---

## 3. Los avisos van al final

Después de los cuadres, no antes. Si avisas al convertir el cero, acabas diciendo "no hemos
encontrado la cotización" justo encima de "la hemos deducido del coste total". Dos avisos que se
contradicen sobre el mismo campo enseñan a no leer los avisos.

```js
// 1. La regla del cero solo convierte y anota
for (const [campo, nombre] of CERO_SOSPECHOSO[datos.tipo_doc] || []) {
  if (datos[campo] === 0) { datos[campo] = null; eranCero.set(campo, nombre); bajar('media'); }
}

// 2. Los cuadres pueden recuperar alguno

// 3. Se avisa solo de lo que sigue faltando
for (const [campo, nombre] of eranCero) {
  if (!hay(datos[campo])) avisar(`No hemos encontrado ${nombre}. Complétalo mirando el original.`);
}
```

---

## 4. La confianza solo puede empeorar

Si la asignas directa en varios sitios, gana la última — que puede ser la más benévola. Un
documento con un descuadre detectado puede acabar en `media` porque una regla posterior lo
"mejoró", y subir en una bandeja ordenada por fiabilidad.

```js
const ORDEN = { alta: 3, media: 2, baja: 1 };
const bajar = (nivel) => {
  if (ORDEN[nivel] < (ORDEN[datos.confianza] || 3)) datos.confianza = nivel;
};
```

### Por qué se le pide confianza al modelo si está mal calibrado

Es una objeción legítima: un modelo pondrá `alta` en algunas alucinaciones, así que su
autoevaluación no sirve para decidir nada por sí sola.

Se le pide igualmente porque **ve cosas que el código no puede derivar**: que el papel está
borroso, torcido, cortado, que hay dos totales impresos, que la firma está tachada. Ninguna
comprobación aritmética detecta eso. Es información real y es barata.

Lo que no se hace es dejarle decidir. Se le pide una señal **gruesa** (tres categorías, no un
decimal que finge precisión que no existe) y se usa como **una entrada más** de una puntuación
que calcula el código:

```js
let score = { alta: 1.0, media: 0.7, baja: 0.4 }[datos.confianza] ?? 0.4;
const motivos = [];

if (!cuadraTotal)     { score -= 0.30; motivos.push('el total no cuadra'); }
if (!nifValido)       { score -= 0.20; motivos.push('el NIF no valida'); }
if (!datos.num_doc)   { score -= 0.15; motivos.push('falta el número'); }
if (!datos.fecha)     { score -= 0.15; motivos.push('falta la fecha'); }
if (!datos.tercero_id){ score -= 0.10; motivos.push('tercero sin asignar'); }

datos.fiabilidad = Math.max(0, Math.round(score * 100) / 100);
datos.motivos_fiabilidad = motivos;
```

Guarda los motivos junto al número. En la bandeja, "0,55 — el total no cuadra, el NIF no valida"
es accionable; "0,55" obliga a abrir el documento para averiguar qué pasa.

Los pesos son un punto de partida: ajústalos con documentos reales mirando qué comprobaciones
predicen de verdad una corrección humana. Una comprobación que nunca cambia el resultado solo
añade ruido.

---

## 5. Validación de identificadores

Tienen estructura comprobable. Úsala: es gratis y detecta lecturas malas que ninguna otra regla
ve. La disciplina de `null` protege del identificador **inventado**; esto protege del **mal
leído**, que es otro problema — un `8` que se lee `B`, un `0` que se lee `O`.

- **NIF/CIF**: longitud, formato y **dígito de control**.
- **IBAN**: módulo 97.
- **Matrícula**: formato del país.
- **Fecha**: que exista (un 31 de febrero es una lectura mala) y que sea plausible. Un año mal
  leído manda la factura al trimestre equivocado, en silencio.

Cuando la comprobación falla, **conserva el valor leído** además de avisar. Quien revisa
necesita ver qué puso el modelo para compararlo con el papel; borrarlo la obliga a transcribir
desde cero.

---

## 6. Verificar los ids del catálogo

Si el modelo devuelve el id de un tercero o un servicio, comprueba que existe:

```js
if (datos.tercero_id && !catalogo.has(datos.tercero_id)) {
  datos.tercero_id = null;
  avisar('El proveedor asignado no existe en el catálogo. Se ha dejado sin asignar.');
  bajar('baja');
}
```

Los ids alucinados son menos frecuentes que los datos alucinados y mucho más difíciles de ver en
una bandeja: un id parece siempre correcto.

---

## 7. Campos imprescindibles por tipo

Declara qué campos son obligatorios en cada tipo y marca los que sigan vacíos **después** del
volcado. Un campo fuera de la lista puede faltar sin que pase nada —una factura sin retención es
lo normal— y marcarlo sería ruido.

```js
const IMPRESCINDIBLES = {
  factura: ['fecha','emisor','nif_emisor','num_documento','base','total'],
  albaran: ['fecha','cliente','servicio','matricula'],
  nomina:  ['empleado','nif_empleado','periodo','salario_bruto','ss_empresa','liquido'],
};
```

Esa lista alimenta el marcado ámbar de la bandeja. Ver `revision.md`.

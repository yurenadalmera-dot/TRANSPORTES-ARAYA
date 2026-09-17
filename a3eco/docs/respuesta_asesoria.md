# Borrador de respuesta a Asesoría Gopar (Departamento Fiscal)

> Asunto: RE: Plan de cuentas y datos para el enlace contable a3eco

Buenas tardes, Ana:

Muchas gracias, con el código de empresa (02111), las subcuentas de ingresos
(70500000 / 70500001) y el listado de clientes ya hemos podido montar el mapeo
de subcuentas en nuestro ERP: hemos cargado las 391 cuentas del 430 y las
enlazamos por NIF de forma automática.

Antes de generaros el primer fichero de pruebas nos quedan cuatro cosas por
cerrar. Preferimos preguntaros ahora y mandaros un fichero que entre limpio, que
haceros probar algo que os ensucie el plan contable:

**1. Documentación del formato.** ¿Nos podéis pasar el PDF *"Enlace contable de
entrada. Descripción de registros"* de vuestra versión de a3eco (o indicarnos la
versión que tenéis instalada)? Es el documento de Wolters Kluwer con las
posiciones exactas de cada campo del `SUENLACE.DAT`. Tenemos la estructura
general, pero el fichero es de ancho fijo y sin separadores: un campo desplazado
un solo carácter invalida el registro entero, así que no queremos trabajar de
oído.

**2. Subcuenta de IGIC repercutido.** Es la única cuenta del asiento que nos
falta. Nosotros facturamos con IGIC al 7%, y el asiento nos queda:

```
(D) 430xxxxx  cliente                       total
    (H) 70500000  prestación de servicios        base
    (H) 4770xxxx  IGIC repercutido               cuota
```

¿Cuál es la subcuenta exacta? Y si manejáis varias según el tipo impositivo,
pasadnos el desglose.

**3. Cuatro NIF con dos subcuentas.** En el listado hay NIF repetidos y nuestro
sistema no elige por su cuenta. ¿Con cuál nos quedamos?

| NIF | Subcuentas |
|---|---|
| 78527303J | 43000197 y 43000253 — ESTEBAN HDEZ MARTINEZ |
| B35121219 | 43000128 ARCOIN PLAN S.L. / 43000133 ARCOR PLAN S.L. |
| H35214238 | 43000304 y 43000362 — URB. RESIDENCIAL SANTA URSULA |
| U76139823 | 43000145 FOMENTO DE CONST.Y CONTRATAS / 43000355 UTE PAJARA |

**4. Cuentas sin NIF.** Hay 42 subcuentas sin NIF en la ficha. Las genéricas las
entendemos (CLIENTE DE CONTADO, CLIENTES REMESA, CLIENTES VARIOS 2026), pero
otras son clientes reales con la ficha incompleta — ALDIANA FUERTEVENTURA S.A.,
COLEGIO EL CIERVO y varios particulares. ¿Nos podéis completar el NIF en esas
fichas, o preferís que esas facturas las traspasemos a una cuenta genérica?

Dos apuntes más:

- **Altas de clientes nuevos.** Tenemos entendido que a3eco crea automáticamente
  la subcuenta que no existe en el fichero. Preferimos no aprovecharnos de eso:
  cuando demos de alta un cliente nuevo os avisamos para que abráis la cuenta y
  nos digáis el número, y hasta entonces nuestro sistema aparta esa factura en
  lugar de inventarse una cuenta.
- **Formato del asiento.** Podemos mandároslo como asiento simple (registros de
  tipo 0) o en formato factura (tipo 1/2), que es el que alimenta el libro de
  registro de IGIC. Decidnos qué preferís recibir y lo generamos así.

En cuanto tengamos estos datos os mandamos el fichero de pruebas con cuatro o
cinco facturas para que lo paséis por Utilidades → Importar/Exportar → Enlace
Contable y nos confirméis que entra correctamente.

Gracias y un saludo,

Yurena Méndez
Transportes Araya Franquiz SL

# Pendiente antes de mandar el fichero de pruebas

## 1. Documentación del formato (bloqueante)

Necesitamos el PDF **"Enlace contable de entrada. Descripción de registros"** de
la versión de a3eco que usa la asesoría. Lo publica Wolters Kluwer en a3Responde:

- `https://a3responde.wolterskluwer.com/es/s/article/enlace-contable-de-entrada-suenlace-dat-descripcion-de-registros`
- `https://media.a3software.com/a3responde/files/2731-Enlace_contable_descripcion_registros_WEB.pdf`

Con él se completan los campos marcados `pendiente` en
`spec/layout_suenlace.json` y se confirma el único marcado `probable`
(el offset del importe, deducido en la posición 59).

Lo contrastado hasta ahora:

| Pos. | Long. | Campo | Estado |
|---|---|---|---|
| 1 | 1 | Tipo de formato (constante `4`) | confirmado |
| 2–6 | 5 | Código de empresa (`02111`) | confirmado |
| 7–14 | 8 | Fecha del asiento `AAAAMMDD` | confirmado |
| 15 | 1 | Tipo de registro (0/1/2/3/9) | confirmado |
| 16–27 | 12 | Cuenta (nivel 6 a 12) | confirmado |
| 28–57 | 30 | Descripción | confirmado |
| 58 | 1 | `C` cargo / `A` abono | confirmado |
| 59–72 | 14 | Importe (signo + 10 enteros + `.` + 2 decimales) | **probable** |

Longitud de registro: 256 bytes, ASCII de ancho fijo, sin separadores.

## 2. Datos que faltan de la asesoría

- **Subcuenta de IGIC repercutido.** Es la única cuenta del asiento que no nos
  han dado. Ahora mismo el módulo usa `47700000` como marcador y avisa en cada
  ejecución. Si manejan varias subcuentas por tipo impositivo, necesitamos el
  desglose.
- **NIF con más de una subcuenta.** Cuatro NIF aparecen repetidos. El exportador
  se niega a elegir; hay que fijar cuál se usa en cada caso:

  | NIF | Subcuentas |
  |---|---|
  | `78527303J` | 43000197 ESTEBAN HDEZ MARTINEZ / 43000253 ESTEBAN HDEZ MARTINEZ |
  | `B35121219` | 43000128 ARCOIN PLAN S.L. / 43000133 ARCOR PLAN S.L. |
  | `H35214238` | 43000304 URB. RESIDENCIAL SANTA URSULA / 43000362 (misma razón social) |
  | `U76139823` | 43000145 FOMENTO DE CONST.Y CONTRATAS,S / 43000355 UTE PAJARA |

  Los dos primeros parecen duplicados a depurar (ARCOIN / ARCOR puede ser un
  error de tecleo); el último son dos cuentas distintas compartiendo NIF de UTE.

- **Subcuentas sin NIF.** 42 cuentas sin NIF en el listado. Algunas son genéricas
  (CLIENTE DE CONTADO, CLIENTES REMESA, CLIENTES CONTADO AÑO 2025, CLIENTES
  VARIOS 2026), pero otras son clientes reales con la ficha incompleta (ALDIANA
  FUERTEVENTURA S.A., COLEGIO EL CIERVO y varios particulares). El ERP no puede
  mapearlas por NIF: o se completan las fichas en a3eco, o esas facturas salen
  como incidencia.
- **Altas de clientes nuevos.** Procedimiento acordado: a3eco crea sola la cuenta
  que no existe, y eso ensucia el plan. Preferimos avisar y esperar al alta.

## 3. Decisión pendiente: tipo 0 vs tipo 1/2

- **Tipo 0** (implementado): asiento correcto, pero el libro de registro de IGIC
  no se alimenta solo.
- **Tipo 1/2**: formato factura, alimenta libros de IGIC y SII. Requiere el
  layout completo del punto 1.

Preguntar a la asesoría qué prefieren recibir.

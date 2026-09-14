# Transportes Araya Franquiz · panel de gestión

El programa **no vive en este repositorio**. Está repartido entre dos sitios, y este
repo guarda la documentación y las herramientas auxiliares.

| Pieza | Dónde | Detalle |
|---|---|---|
| Base de datos | Supabase Cloud, proyecto `araya-operativa` (`wapxjjsjwpofgjoqmoby`) | PostgreSQL 17, región `eu-west-1`. El historial de cambios está en las *migrations* del proyecto. |
| Interfaz | Una sola página HTML guardada en la tabla `public.app_ui` (fila `app`) | La sirve n8n en el webhook `GET /araya/panel`. Cada cambio queda versionado solo en `app_ui_versiones`. |
| Automatismos | n8n (`n8n-n8n.kjixqg.easypanel.host`), carpeta *TRANSPORTES ARAYA* | Escáner de documentos, correo entrante, sincronización con Factusol, avisos de cobro. |

## Módulo de personal y nóminas

Añadido en septiembre de 2026.

### Tablas

- `empleados` — ficha del trabajador: DNI, nº de afiliación, categoría, antigüedad,
  situación, y los vencimientos de **carnet, CAP, ADR, tarjeta de tacógrafo y
  reconocimiento médico**, que alimentan el tablón de avisos.
- `nominas` — una fila por trabajador y mes, con devengado, bases, IRPF, Seguridad
  Social del trabajador y de la empresa, líquido y estado de pago.
- `nominas_conceptos` — el detalle línea a línea del recibo (devengos y deducciones).
- `nominas_ss_empresa` — la aportación empresarial desglosada por concepto.
- `nominas_ocr` — bandeja de revisión: lo que lee el escáner antes de que una
  persona lo confirme.
- `seguros_sociales` — recibo de liquidación de cotizaciones (RLC/TC1), para cuadrar
  el cargo de la TGSS con lo que suman las nóminas.
- `modelo_111` — retenciones de IRPF presentadas cada trimestre, para contrastarlas
  con lo que dicen las nóminas.

### Contabilidad

`generar_asiento_nomina(periodo, usuario)` genera **un asiento mensual agrupado**:

```
Debe   640  Sueldos y salarios ................ total devengado
Debe   642  Seguridad Social a cargo empresa .. aportación empresarial
Haber  476  Organismos SS acreedores .......... empresa + trabajador
Haber  4751 Hacienda acreedora, retenciones ... IRPF
Haber  649  Retribución en especie y otras ..... otras deducciones
Haber  465  Remuneraciones pendientes de pago .. líquido
```

Las cuentas son configurables en `config_contable` (`cuenta_sueldos`,
`cuenta_ss_empresa`, `cuenta_ss_acreedora`, `cuenta_remuneraciones`,
`cuenta_gastos_sociales`).

El pago de cada trabajador se concilia contra el banco con `conciliar_nomina`, que
además genera el asiento `465 / 572`. `conciliar_nominas_automatico` lo hace en
bloque, pero **solo** cuando hay un único candidato cuyo líquido cuadra al céntimo
y que además deja rastro de su nombre en el concepto del movimiento; el nombre de la
empresa se ignora al cotejar, porque sale en todos los apuntes.

### Lectura de las nóminas

Las nóminas se leen **sin IA**, directamente de la capa de texto del PDF. El lector
vive en el workflow *Araya · Nóminas por escáner* (`POST /araya/nomina-lote`) y su
código está en `n8n/leer-nominas.js`.

Para separar devengos de deducciones prueba dos criterios —la columna en la que cae
el importe y el rango del código de concepto (≥ 700 es deducción)— y se queda con el
que reproduce el **líquido a percibir** que pone el propio recibo. Así aguanta que la
extracción de texto coloque las columnas de otra manera.

`herramientas/parse_nominas.py` es el mismo algoritmo en Python, que sirve para
comprobar un PDF desde la línea de órdenes sin tocar el programa.

Verificado contra las 24 nóminas de agosto de 2026: los seis totales (devengado,
deducciones, IRPF, SS del trabajador, SS de la empresa y líquido) cuadran al céntimo,
y el asiento del mes sale cuadrado.

### Interfaz

`panel/personal.js` es el módulo que se inyecta en `app_ui`. Añade tres vistas
(`VX.avisos`, `VX.personal`, `VX.nominas`) y su función de enlace `bindPersonal()`,
llamada desde `BINDX()`.

## Herramientas

```bash
pip install pypdf
python3 herramientas/parse_nominas.py nominas.pdf    # vuelca el PDF como JSON
```

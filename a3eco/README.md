# Enlace contable a3eco — Transportes Araya Franquiz SL

Módulo de exportación contable: convierte las facturas emitidas del ERP en el
fichero `SUENLACE.DAT` que la asesoría importa desde
**Utilidades → Importar/Exportar → Enlace Contable** de a3eco.

## Datos confirmados por la asesoría (correo de 17/09/2026)

| Dato | Valor |
|---|---|
| Código de empresa en a3eco | `02111` |
| Subcuenta de ingresos | `70500000` — Prestación de Servicios |
| Subcuenta de abonos | `70500001` — Abono prestación de servicios |
| Plan de cuentas de clientes | 391 subcuentas `430*` (ver `data/`) |

## Estado

Funciona hoy, con una limitación importante: **el layout completo del fichero
no está cerrado.**

La documentación oficial de Wolters Kluwer (*"Enlace contable de entrada.
Descripción de registros"*) es la única fuente fiable de las posiciones exactas
de cada campo. De ella tenemos contrastadas las 58 primeras posiciones, que son
las que necesita un registro **tipo 0** (apunte de asiento sin impuesto).
Los campos de los registros **tipo 1 / 2** (formato factura, con NIF, base, tipo
y cuota, que son los que alimentan el libro de registro de IGIC) siguen sin
determinar.

Por eso el módulo genera hoy el asiento como tres apuntes tipo 0:

```
(D) 430xxxxx  cliente                    total
    (H) 70500000  prestación de servicios      base
    (H) 47700000  IGIC repercutido             cuota
```

Es contablemente correcto, pero **no rellena el libro de IGIC en a3eco**. Para
eso hacen falta los registros tipo 1/2. Ver `docs/pendiente.md`.

Ojo: si se manda una subcuenta que no existe, **a3eco la crea automáticamente**.
Un NIF mal mapeado no da error, ensucia el plan contable de la asesoría. Por eso
el exportador aparta la factura entera en lugar de inventarse la cuenta.

## Uso

```bash
cd src
python3 -m a3eco.cli ../data/facturas_ejemplo.csv --salida ../salida/SUENLACE.DAT
```

Sin dependencias externas (solo librería estándar de Python 3.10+).

Entrada: CSV con `numero, fecha, nif, nombre, base, cuota, total, tipo_impuesto,
rectificativa, carta_porte`. La columna `carta_porte` es opcional y se incluye en
el concepto del apunte para mantener la trazabilidad logística.

Si alguna factura tiene incidencia (NIF no mapeado, NIF ambiguo, importes que no
cuadran) **no se escribe nada**: medio asiento en a3eco cuesta más de arreglar
que repetir la exportación. Con `--forzar` se exportan solo las correctas.

## Estructura

```
config/empresa.json              código de empresa y subcuentas
spec/layout_suenlace.json        geometría del fichero; cada campo marcado
                                 confirmado / probable / pendiente
data/plan_cuentas_clientes.csv   las 391 subcuentas 430* tal cual las envió la asesoría
data/mapeo_nif_subcuenta.json    índice NIF → subcuenta, con duplicados apartados
src/a3eco/                       módulo de exportación
scripts/extraer_plan_cuentas.py  regenera data/ desde el XLSX de la asesoría
tests/                           19 pruebas (python3 -m unittest discover -s tests)
docs/                            lo que falta y el borrador de respuesta a Gopar
```

Toda la geometría del fichero vive en `spec/layout_suenlace.json`, no en el
código: cuando la asesoría confirme los offsets, se corrige el spec y nada más.

## Regenerar el plan de cuentas

Cuando la asesoría mande un listado actualizado:

```bash
pip install openpyxl
python3 scripts/extraer_plan_cuentas.py ruta/al/PLAN_DE_CUENTAS_CLIENTES.xlsx
```

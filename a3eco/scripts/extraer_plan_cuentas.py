"""Extrae el plan de cuentas de clientes (430*) del listado que envia la asesoria.

Entrada:  PLAN_DE_CUENTAS_CLIENTES.xlsx (export de a3eco, hoja "Cuentas Datos Filiacion")
Salida:   data/plan_cuentas_clientes.csv  (listado completo, una fila por subcuenta)
          data/mapeo_nif_subcuenta.json   (indice NIF -> subcuenta para el ERP)

Uso:
    python scripts/extraer_plan_cuentas.py ruta/al/PLAN_DE_CUENTAS_CLIENTES.xlsx

Requiere openpyxl solo para regenerar los ficheros; el modulo de exportacion no
depende de el.
"""

from __future__ import annotations

import csv
import json
import sys
from collections import defaultdict
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
CSV_SALIDA = RAIZ / "data" / "plan_cuentas_clientes.csv"
JSON_SALIDA = RAIZ / "data" / "mapeo_nif_subcuenta.json"

# La cabecera real empieza en la fila 7 del export de a3eco; los datos en la 8.
PRIMERA_FILA_DATOS = 8
COLUMNAS = ["subcuenta", "nombre", "nif", "via_publica", "numero", "cp", "municipio", "telefono", "local", "email"]


def normaliza_nif(valor) -> str:
    """Deja el NIF en mayusculas y sin espacios. Cadena vacia si no hay dato."""
    if valor is None:
        return ""
    return str(valor).strip().upper()


def normaliza_texto(valor) -> str:
    if valor is None:
        return ""
    return str(valor).strip()


def lee_filas(ruta_xlsx: Path) -> list[dict]:
    import openpyxl

    hoja = openpyxl.load_workbook(ruta_xlsx, data_only=True).active
    filas = []
    for fila in hoja.iter_rows(min_row=PRIMERA_FILA_DATOS, values_only=True):
        if fila[0] is None:
            continue
        subcuenta = str(fila[0]).strip()
        if not subcuenta.startswith("430"):
            continue
        registro = {clave: normaliza_texto(fila[i]) for i, clave in enumerate(COLUMNAS)}
        registro["subcuenta"] = subcuenta
        registro["nif"] = normaliza_nif(fila[2])
        filas.append(registro)
    return filas


def construye_mapeo(filas: list[dict]) -> dict:
    """NIF -> subcuenta. Los NIF repetidos se apartan para revision manual."""
    por_nif: dict[str, list[dict]] = defaultdict(list)
    for registro in filas:
        if registro["nif"]:
            por_nif[registro["nif"]].append(registro)

    unicos = {}
    ambiguos = {}
    for nif, registros in sorted(por_nif.items()):
        if len(registros) == 1:
            unicos[nif] = registros[0]["subcuenta"]
        else:
            ambiguos[nif] = [
                {"subcuenta": r["subcuenta"], "nombre": r["nombre"]} for r in registros
            ]

    sin_nif = [
        {"subcuenta": r["subcuenta"], "nombre": r["nombre"]}
        for r in filas
        if not r["nif"]
    ]

    return {
        "_origen": "PLAN_DE_CUENTAS_CLIENTES.xlsx (asesoria Gopar, 17/09/2026)",
        "_total_subcuentas": len(filas),
        "nif_a_subcuenta": unicos,
        "nif_duplicados": ambiguos,
        "subcuentas_sin_nif": sin_nif,
    }


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__)
        return 2

    ruta_xlsx = Path(sys.argv[1])
    filas = lee_filas(ruta_xlsx)

    CSV_SALIDA.parent.mkdir(parents=True, exist_ok=True)
    with CSV_SALIDA.open("w", encoding="utf-8", newline="") as f:
        escritor = csv.DictWriter(f, fieldnames=COLUMNAS)
        escritor.writeheader()
        escritor.writerows(filas)

    mapeo = construye_mapeo(filas)
    JSON_SALIDA.write_text(
        json.dumps(mapeo, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    print(f"{len(filas)} subcuentas -> {CSV_SALIDA.relative_to(RAIZ)}")
    print(f"{len(mapeo['nif_a_subcuenta'])} NIF unicos, "
          f"{len(mapeo['nif_duplicados'])} duplicados, "
          f"{len(mapeo['subcuentas_sin_nif'])} sin NIF -> {JSON_SALIDA.relative_to(RAIZ)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

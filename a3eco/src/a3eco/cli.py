"""Interfaz de linea de comandos: genera SUENLACE.DAT desde un CSV de facturas.

    python -m a3eco.cli facturas.csv --salida salida/SUENLACE.DAT
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from . import export


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Genera el enlace contable para a3eco")
    parser.add_argument("facturas", type=Path, help="CSV de facturas emitidas")
    parser.add_argument("--salida", type=Path, default=Path("salida/SUENLACE.DAT"))
    parser.add_argument("--forzar", action="store_true",
                        help="Escribe el fichero aunque haya facturas con incidencia")
    args = parser.parse_args(argv)

    facturas = export.lee_facturas_csv(args.facturas)
    resultado = export.genera(facturas)

    for aviso in resultado.avisos:
        print(f"AVISO: {aviso}", file=sys.stderr)
    for incidencia in resultado.incidencias:
        print(f"INCIDENCIA [{incidencia.factura}]: {incidencia.motivo}", file=sys.stderr)

    if resultado.incidencias and not args.forzar:
        print(f"\n{len(resultado.incidencias)} factura(s) con incidencia. "
              f"No se escribe nada. Use --forzar para exportar solo las correctas.",
              file=sys.stderr)
        return 1

    ruta = export.escribe(resultado, args.salida)
    print(f"{resultado.facturas_exportadas} factura(s), "
          f"{len(resultado.lineas)} apunte(s) -> {ruta}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

"""Resolucion de la subcuenta 430* de cada cliente a partir de su NIF."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
RUTA_MAPEO = RAIZ / "data" / "mapeo_nif_subcuenta.json"


class ClienteNoMapeado(Exception):
    """El NIF no figura en el plan de cuentas que envio la asesoria."""


class ClienteAmbiguo(Exception):
    """El NIF tiene mas de una subcuenta abierta en a3eco."""


@dataclass(frozen=True)
class PlanDeClientes:
    por_nif: dict[str, str]
    duplicados: dict[str, list[dict]]
    sin_nif: list[dict]

    def subcuenta(self, nif: str) -> str:
        clave = normaliza(nif)
        if clave in self.duplicados:
            opciones = ", ".join(
                f"{d['subcuenta']} ({d['nombre']})" for d in self.duplicados[clave]
            )
            raise ClienteAmbiguo(
                f"El NIF {clave} tiene varias subcuentas en a3eco: {opciones}. "
                f"Hay que decidir con la asesoria cual se usa y fijarla en el ERP."
            )
        if clave not in self.por_nif:
            raise ClienteNoMapeado(
                f"El NIF {clave} no esta en el plan de cuentas de la asesoria. "
                f"Pedir alta de subcuenta antes de exportar: si se manda una cuenta "
                f"inexistente, a3eco la crea sola y descuadra el plan contable."
            )
        return self.por_nif[clave]

    def conoce(self, nif: str) -> bool:
        return normaliza(nif) in self.por_nif

    def __len__(self) -> int:
        return len(self.por_nif)


def normaliza(nif: str) -> str:
    return (nif or "").strip().upper().replace("-", "").replace(" ", "")


def carga(ruta: Path | None = None) -> PlanDeClientes:
    datos = json.loads((ruta or RUTA_MAPEO).read_text(encoding="utf-8"))
    return PlanDeClientes(
        por_nif={normaliza(k): v for k, v in datos["nif_a_subcuenta"].items()},
        duplicados={normaliza(k): v for k, v in datos["nif_duplicados"].items()},
        sin_nif=datos["subcuentas_sin_nif"],
    )

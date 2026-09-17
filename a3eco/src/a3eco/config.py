"""Carga de la configuracion de empresa y de las cuentas contables."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
RUTA_CONFIG = RAIZ / "config" / "empresa.json"


class ConfiguracionIncompleta(Exception):
    """Falta un dato que solo puede confirmar la asesoria."""


@dataclass(frozen=True)
class Cuenta:
    subcuenta: str
    descripcion: str
    estado: str

    @property
    def confirmada(self) -> bool:
        return self.estado == "confirmado"


@dataclass(frozen=True)
class Configuracion:
    codigo_empresa: str
    razon_social: str
    ventas: Cuenta
    abono_ventas: Cuenta
    igic_repercutido: Cuenta
    tipo_igic_general: float

    def cuenta_ingresos(self, es_rectificativa: bool) -> Cuenta:
        """70500000 para factura, 70500001 para abono."""
        return self.abono_ventas if es_rectificativa else self.ventas

    def cuentas_sin_confirmar(self) -> list[Cuenta]:
        return [c for c in (self.ventas, self.abono_ventas, self.igic_repercutido)
                if not c.confirmada]


def _cuenta(datos: dict, clave: str) -> Cuenta:
    bloque = datos["cuentas"][clave]
    return Cuenta(
        subcuenta=bloque["subcuenta"],
        descripcion=bloque["descripcion"],
        estado=bloque["estado"],
    )


def carga(ruta: Path | None = None) -> Configuracion:
    datos = json.loads((ruta or RUTA_CONFIG).read_text(encoding="utf-8"))
    return Configuracion(
        codigo_empresa=datos["codigo_empresa"],
        razon_social=datos["razon_social"],
        ventas=_cuenta(datos, "ventas"),
        abono_ventas=_cuenta(datos, "abono_ventas"),
        igic_repercutido=_cuenta(datos, "igic_repercutido"),
        tipo_igic_general=float(datos["impuesto"]["tipo_general"]),
    )

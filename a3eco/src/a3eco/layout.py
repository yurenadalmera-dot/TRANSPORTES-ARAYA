"""Construccion de registros de ancho fijo a partir de spec/layout_suenlace.json.

Toda la geometria del fichero vive en el JSON, no en el codigo: cuando la
asesoria confirme los offsets pendientes solo hay que tocar el spec.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
RUTA_SPEC = RAIZ / "spec" / "layout_suenlace.json"


class ErrorDeLayout(Exception):
    """El registro no encaja en el formato declarado."""


class CampoSinConfirmar(Exception):
    """Se ha pedido un campo cuyo offset todavia no esta determinado."""


@dataclass(frozen=True)
class Campo:
    nombre: str
    inicio: int          # 1-based, como en la documentacion de a3
    longitud: int
    tipo: str
    alineacion: str
    relleno: str
    estado: str

    @property
    def fin(self) -> int:
        """Ultima posicion ocupada, 1-based e inclusiva."""
        return self.inicio + self.longitud - 1


@dataclass(frozen=True)
class Layout:
    longitud_registro: int
    codificacion: str
    fin_de_linea: str
    campos: dict[str, Campo]

    def campo(self, nombre: str) -> Campo:
        if nombre not in self.campos:
            raise CampoSinConfirmar(
                f"El campo '{nombre}' no tiene offset confirmado en el spec. "
                f"Completar spec/layout_suenlace.json con el PDF oficial de a3."
            )
        return self.campos[nombre]

    def campos_probables(self) -> list[Campo]:
        return [c for c in self.campos.values() if c.estado == "probable"]


def carga(ruta: Path | None = None) -> Layout:
    datos = json.loads((ruta or RUTA_SPEC).read_text(encoding="utf-8"))
    campos: dict[str, Campo] = {}
    for bruto in datos["campos_comunes"]:
        campo = Campo(
            nombre=bruto["nombre"],
            inicio=bruto["inicio"],
            longitud=bruto["longitud"],
            tipo=bruto["tipo"],
            alineacion=bruto["alineacion"],
            relleno=bruto["relleno"],
            estado=bruto["estado"],
        )
        campos[campo.nombre] = campo

    _comprueba_solapamientos(campos.values(), datos["longitud_registro"])

    return Layout(
        longitud_registro=datos["longitud_registro"],
        codificacion=datos["codificacion"],
        fin_de_linea=datos["fin_de_linea"],
        campos=campos,
    )


def _comprueba_solapamientos(campos, longitud_registro: int) -> None:
    ordenados = sorted(campos, key=lambda c: c.inicio)
    for anterior, siguiente in zip(ordenados, ordenados[1:]):
        if siguiente.inicio <= anterior.fin:
            raise ErrorDeLayout(
                f"'{anterior.nombre}' (pos {anterior.inicio}-{anterior.fin}) se solapa "
                f"con '{siguiente.nombre}' (pos {siguiente.inicio}-{siguiente.fin})"
            )
    for campo in ordenados:
        if campo.fin > longitud_registro:
            raise ErrorDeLayout(
                f"'{campo.nombre}' acaba en {campo.fin}, fuera del registro de "
                f"{longitud_registro} posiciones"
            )


# --- formateo de valores -------------------------------------------------

def formatea_fecha(valor: date) -> str:
    return valor.strftime("%Y%m%d")


def formatea_importe(valor: Decimal, longitud: int) -> str:
    """signo + 10 enteros + punto + 2 decimales, alineado a la derecha.

    a3 espera el importe siempre positivo acompanado de la marca C/A; el signo
    negativo solo aparece si el apunte invierte el sentido del cargo/abono.
    """
    cuantizado = valor.quantize(Decimal("0.01"))
    signo = "-" if cuantizado < 0 else "+"
    texto = f"{signo}{abs(cuantizado):.2f}"
    if len(texto) > longitud:
        raise ErrorDeLayout(f"El importe {valor} no cabe en {longitud} posiciones")
    return texto.rjust(longitud)


def _ajusta(campo: Campo, texto: str) -> str:
    if len(texto) > campo.longitud:
        if campo.tipo in ("texto",):
            texto = texto[: campo.longitud]
        else:
            raise ErrorDeLayout(
                f"'{texto}' ({len(texto)}) no cabe en el campo '{campo.nombre}' "
                f"de {campo.longitud} posiciones"
            )
    if campo.alineacion == "derecha":
        return texto.rjust(campo.longitud, campo.relleno)
    return texto.ljust(campo.longitud, campo.relleno)


def construye_registro(layout: Layout, valores: dict[str, object]) -> str:
    """Devuelve una linea de longitud_registro caracteres, rellena con espacios."""
    buffer = [" "] * layout.longitud_registro

    for nombre, valor in valores.items():
        campo = layout.campo(nombre)
        if isinstance(valor, date):
            texto = formatea_fecha(valor)
        elif isinstance(valor, Decimal):
            texto = formatea_importe(valor, campo.longitud)
        else:
            texto = str(valor)
        ajustado = _ajusta(campo, texto)
        buffer[campo.inicio - 1 : campo.fin] = list(ajustado)

    linea = "".join(buffer)
    if len(linea) != layout.longitud_registro:
        raise ErrorDeLayout(
            f"Registro de {len(linea)} posiciones, se esperaban {layout.longitud_registro}"
        )
    return linea

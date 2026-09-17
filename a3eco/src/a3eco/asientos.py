"""Modelo de factura y su traduccion a apuntes contables.

Una factura emitida de Araya se contabiliza asi:

    (D) 430xxxxx  cliente              total
        (H) 70500000 prestacion de servicios     base
        (H) 47700000 IGIC repercutido            cuota

La rectificativa invierte el sentido y usa 70500001.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal, InvalidOperation

CENTIMO = Decimal("0.01")


class FacturaInvalida(Exception):
    """Los importes de la factura no cuadran."""


@dataclass(frozen=True)
class Factura:
    numero: str
    fecha: date
    nif_cliente: str
    nombre_cliente: str
    base: Decimal
    cuota: Decimal
    total: Decimal
    tipo_impuesto: Decimal = Decimal("7.00")
    rectificativa: bool = False
    carta_porte: str = ""

    def valida(self) -> None:
        if self.base + self.cuota != self.total:
            raise FacturaInvalida(
                f"Factura {self.numero}: base {self.base} + cuota {self.cuota} "
                f"!= total {self.total}"
            )
        esperada = (self.base * self.tipo_impuesto / 100).quantize(CENTIMO)
        if abs(esperada - self.cuota) > CENTIMO:
            raise FacturaInvalida(
                f"Factura {self.numero}: cuota {self.cuota} no corresponde al "
                f"{self.tipo_impuesto}% de {self.base} (esperado {esperada})"
            )
        if self.total <= 0:
            raise FacturaInvalida(f"Factura {self.numero}: total {self.total} no positivo")

    def concepto(self) -> str:
        """Descripcion del apunte, 30 caracteres en a3."""
        prefijo = "ABONO" if self.rectificativa else "FRA"
        partes = [prefijo, self.numero, self.nombre_cliente]
        if self.carta_porte:
            partes.insert(2, f"CP{self.carta_porte}")
        return " ".join(p for p in partes if p)[:30]


@dataclass(frozen=True)
class Apunte:
    cuenta: str
    descripcion: str
    signo: str          # "C" cargo (debe) / "A" abono (haber)
    importe: Decimal


@dataclass
class Asiento:
    fecha: date
    apuntes: list[Apunte] = field(default_factory=list)

    def cuadra(self) -> bool:
        debe = sum((a.importe for a in self.apuntes if a.signo == "C"), Decimal("0"))
        haber = sum((a.importe for a in self.apuntes if a.signo == "A"), Decimal("0"))
        return debe == haber


def a_decimal(valor) -> Decimal:
    try:
        return Decimal(str(valor)).quantize(CENTIMO)
    except (InvalidOperation, ValueError) as exc:
        raise FacturaInvalida(f"Importe no valido: {valor!r}") from exc


def construye_asiento(factura: Factura, cuenta_cliente: str, cuenta_ingresos: str,
                      cuenta_impuesto: str) -> Asiento:
    """Traduce la factura a los tres apuntes del asiento (registros tipo 0)."""
    factura.valida()
    concepto = factura.concepto()

    # La rectificativa invierte cargo y abono respecto de la factura normal.
    signo_cliente = "A" if factura.rectificativa else "C"
    signo_contrapartida = "C" if factura.rectificativa else "A"

    apuntes = [
        Apunte(cuenta_cliente, concepto, signo_cliente, factura.total),
        Apunte(cuenta_ingresos, concepto, signo_contrapartida, factura.base),
    ]
    if factura.cuota:
        apuntes.append(
            Apunte(cuenta_impuesto, concepto, signo_contrapartida, factura.cuota)
        )

    asiento = Asiento(fecha=factura.fecha, apuntes=apuntes)
    if not asiento.cuadra():
        raise FacturaInvalida(f"El asiento de la factura {factura.numero} no cuadra")
    return asiento

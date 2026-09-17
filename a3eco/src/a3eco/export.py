"""Generacion del fichero SUENLACE.DAT a partir de un lote de facturas."""

from __future__ import annotations

import csv
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path

from . import asientos as mod_asientos
from . import config as mod_config
from . import cuentas as mod_cuentas
from . import layout as mod_layout

TIPO_REGISTRO_ASIENTO = "0"


@dataclass
class Incidencia:
    factura: str
    motivo: str


@dataclass
class Resultado:
    lineas: list[str] = field(default_factory=list)
    incidencias: list[Incidencia] = field(default_factory=list)
    facturas_exportadas: int = 0
    avisos: list[str] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return not self.incidencias


def lee_facturas_csv(ruta: Path) -> list[mod_asientos.Factura]:
    """Lee el lote de facturas exportado por el ERP.

    Columnas: numero, fecha (AAAA-MM-DD), nif, nombre, base, cuota, total,
    tipo_impuesto, rectificativa (S/N), carta_porte.
    """
    facturas = []
    with ruta.open(encoding="utf-8-sig", newline="") as f:
        for fila in csv.DictReader(f):
            facturas.append(
                mod_asientos.Factura(
                    numero=fila["numero"].strip(),
                    fecha=datetime.strptime(fila["fecha"].strip(), "%Y-%m-%d").date(),
                    nif_cliente=fila["nif"].strip(),
                    nombre_cliente=fila["nombre"].strip(),
                    base=mod_asientos.a_decimal(fila["base"]),
                    cuota=mod_asientos.a_decimal(fila["cuota"]),
                    total=mod_asientos.a_decimal(fila["total"]),
                    tipo_impuesto=mod_asientos.a_decimal(fila.get("tipo_impuesto") or "7"),
                    rectificativa=(fila.get("rectificativa") or "N").strip().upper() == "S",
                    carta_porte=(fila.get("carta_porte") or "").strip(),
                )
            )
    return facturas


def genera(facturas: list[mod_asientos.Factura],
           cfg: mod_config.Configuracion | None = None,
           plan: mod_cuentas.PlanDeClientes | None = None,
           lay: mod_layout.Layout | None = None) -> Resultado:
    """Convierte el lote en lineas SUENLACE.DAT (registros tipo 0).

    Las facturas con incidencia se apartan enteras: nunca se escribe medio
    asiento, porque un asiento descuadrado en a3eco cuesta mas de arreglar que
    volver a exportar la factura.
    """
    cfg = cfg or mod_config.carga()
    plan = plan or mod_cuentas.carga()
    lay = lay or mod_layout.carga()

    resultado = Resultado()

    for cuenta in cfg.cuentas_sin_confirmar():
        resultado.avisos.append(
            f"La subcuenta {cuenta.subcuenta} ({cuenta.descripcion}) no esta "
            f"confirmada por la asesoria."
        )
    for campo in lay.campos_probables():
        resultado.avisos.append(
            f"El campo '{campo.nombre}' (pos {campo.inicio}-{campo.fin}) usa un offset "
            f"deducido, no contrastado con el PDF oficial de a3."
        )

    for factura in facturas:
        try:
            cuenta_cliente = plan.subcuenta(factura.nif_cliente)
            asiento = mod_asientos.construye_asiento(
                factura,
                cuenta_cliente=cuenta_cliente,
                cuenta_ingresos=cfg.cuenta_ingresos(factura.rectificativa).subcuenta,
                cuenta_impuesto=cfg.igic_repercutido.subcuenta,
            )
        except (mod_cuentas.ClienteNoMapeado, mod_cuentas.ClienteAmbiguo,
                mod_asientos.FacturaInvalida) as exc:
            resultado.incidencias.append(Incidencia(factura.numero, str(exc)))
            continue

        for apunte in asiento.apuntes:
            resultado.lineas.append(
                mod_layout.construye_registro(lay, {
                    "tipo_formato": "4",
                    "codigo_empresa": cfg.codigo_empresa,
                    "fecha_asiento": asiento.fecha,
                    "tipo_registro": TIPO_REGISTRO_ASIENTO,
                    "cuenta": apunte.cuenta,
                    "descripcion": apunte.descripcion,
                    "signo_importe": apunte.signo,
                    "importe": apunte.importe,
                })
            )
        resultado.facturas_exportadas += 1

    return resultado


def escribe(resultado: Resultado, destino: Path,
            lay: mod_layout.Layout | None = None) -> Path:
    """Vuelca las lineas en SUENLACE.DAT con la codificacion que espera a3."""
    lay = lay or mod_layout.carga()
    destino.parent.mkdir(parents=True, exist_ok=True)
    contenido = "".join(linea + lay.fin_de_linea for linea in resultado.lineas)
    destino.write_bytes(contenido.encode(lay.codificacion, errors="replace"))
    return destino

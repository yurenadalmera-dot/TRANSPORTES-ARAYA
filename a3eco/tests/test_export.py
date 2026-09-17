"""Pruebas del generador de SUENLACE.DAT."""

import sys
import unittest
from datetime import date
from decimal import Decimal
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ / "src"))

from a3eco import asientos, config, cuentas, export, layout  # noqa: E402


class PruebaLayout(unittest.TestCase):
    def setUp(self):
        self.lay = layout.carga()

    def test_registro_tiene_longitud_fija(self):
        linea = layout.construye_registro(self.lay, {
            "tipo_formato": "4", "codigo_empresa": "02111",
            "fecha_asiento": date(2026, 9, 17), "tipo_registro": "0",
            "cuenta": "43000005", "descripcion": "FRA 2026/0001",
            "signo_importe": "C", "importe": Decimal("1070.00"),
        })
        self.assertEqual(len(linea), 256)

    def test_campos_en_su_posicion(self):
        linea = layout.construye_registro(self.lay, {
            "tipo_formato": "4", "codigo_empresa": "02111",
            "fecha_asiento": date(2026, 9, 17), "tipo_registro": "0",
            "cuenta": "43000005",
        })
        self.assertEqual(linea[0], "4")
        self.assertEqual(linea[1:6], "02111")
        self.assertEqual(linea[6:14], "20260917")
        self.assertEqual(linea[14], "0")
        self.assertEqual(linea[15:27], "43000005    ")

    def test_descripcion_se_trunca_a_30(self):
        linea = layout.construye_registro(self.lay, {
            "descripcion": "X" * 45,
        })
        self.assertEqual(linea[27:57], "X" * 30)
        self.assertEqual(linea[57], " ")

    def test_importe_no_cabe(self):
        with self.assertRaises(layout.ErrorDeLayout):
            layout.construye_registro(self.lay, {"importe": Decimal("99999999999.99")})

    def test_campo_sin_confirmar(self):
        with self.assertRaises(layout.CampoSinConfirmar):
            layout.construye_registro(self.lay, {"base_imponible_1": "100"})


class PruebaCuentas(unittest.TestCase):
    def setUp(self):
        self.plan = cuentas.carga()

    def test_nif_conocido(self):
        self.assertEqual(self.plan.subcuenta("A35031723"), "43000005")

    def test_nif_con_formato_sucio(self):
        self.assertEqual(self.plan.subcuenta(" a35031723 "), "43000005")

    def test_nif_desconocido(self):
        with self.assertRaises(cuentas.ClienteNoMapeado):
            self.plan.subcuenta("B00000000")

    def test_nif_duplicado_no_se_adivina(self):
        with self.assertRaises(cuentas.ClienteAmbiguo):
            self.plan.subcuenta("B35121219")


class PruebaAsientos(unittest.TestCase):
    def factura(self, **cambios):
        base = dict(numero="2026/0001", fecha=date(2026, 9, 1), nif_cliente="A35031723",
                    nombre_cliente="TRANSVENTURA S.A.", base=Decimal("1000.00"),
                    cuota=Decimal("70.00"), total=Decimal("1070.00"))
        base.update(cambios)
        return asientos.Factura(**base)

    def test_asiento_de_factura(self):
        asiento = asientos.construye_asiento(
            self.factura(), "43000005", "70500000", "47700000")
        self.assertTrue(asiento.cuadra())
        self.assertEqual([a.signo for a in asiento.apuntes], ["C", "A", "A"])
        self.assertEqual(asiento.apuntes[0].importe, Decimal("1070.00"))

    def test_rectificativa_invierte_el_asiento(self):
        asiento = asientos.construye_asiento(
            self.factura(rectificativa=True), "43000005", "70500001", "47700000")
        self.assertTrue(asiento.cuadra())
        self.assertEqual([a.signo for a in asiento.apuntes], ["A", "C", "C"])

    def test_total_descuadrado(self):
        with self.assertRaises(asientos.FacturaInvalida):
            asientos.construye_asiento(
                self.factura(total=Decimal("1000.00")), "43000005", "70500000", "47700000")

    def test_cuota_no_corresponde_al_tipo(self):
        with self.assertRaises(asientos.FacturaInvalida):
            asientos.construye_asiento(
                self.factura(cuota=Decimal("210.00"), total=Decimal("1210.00")),
                "43000005", "70500000", "47700000")

    def test_concepto_cabe_en_30(self):
        concepto = self.factura(carta_porte="4521").concepto()
        self.assertLessEqual(len(concepto), 30)
        self.assertTrue(concepto.startswith("FRA 2026/0001 CP4521"))


class PruebaExportacion(unittest.TestCase):
    def test_lote_de_ejemplo(self):
        facturas = export.lee_facturas_csv(RAIZ / "data" / "facturas_ejemplo.csv")
        resultado = export.genera(facturas)
        self.assertTrue(resultado.ok, [i.motivo for i in resultado.incidencias])
        self.assertEqual(resultado.facturas_exportadas, 4)
        self.assertEqual(len(resultado.lineas), 12)
        self.assertTrue(all(len(l) == 256 for l in resultado.lineas))
        # Cada lote avisa de lo que sigue sin confirmar la asesoria.
        self.assertTrue(resultado.avisos)

    def test_factura_con_cliente_desconocido_no_sale(self):
        factura = asientos.Factura(
            numero="2026/9999", fecha=date(2026, 9, 1), nif_cliente="B00000000",
            nombre_cliente="DESCONOCIDO", base=Decimal("100.00"),
            cuota=Decimal("7.00"), total=Decimal("107.00"))
        resultado = export.genera([factura])
        self.assertFalse(resultado.ok)
        self.assertEqual(resultado.lineas, [])
        self.assertEqual(resultado.facturas_exportadas, 0)

    def test_el_lote_cuadra_en_conjunto(self):
        facturas = export.lee_facturas_csv(RAIZ / "data" / "facturas_ejemplo.csv")
        resultado = export.genera(facturas)
        debe = haber = Decimal("0")
        for linea in resultado.lineas:
            importe = Decimal(linea[58:72].strip())
            if linea[57] == "C":
                debe += importe
            else:
                haber += importe
        self.assertEqual(debe, haber)


class PruebaConfiguracion(unittest.TestCase):
    def test_datos_de_la_asesoria(self):
        cfg = config.carga()
        self.assertEqual(cfg.codigo_empresa, "02111")
        self.assertEqual(cfg.cuenta_ingresos(False).subcuenta, "70500000")
        self.assertEqual(cfg.cuenta_ingresos(True).subcuenta, "70500001")

    def test_igic_sigue_sin_confirmar(self):
        pendientes = [c.subcuenta for c in config.carga().cuentas_sin_confirmar()]
        self.assertIn("47700000", pendientes)


if __name__ == "__main__":
    unittest.main()

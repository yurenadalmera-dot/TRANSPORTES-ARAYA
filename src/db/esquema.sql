-- Esquema de cobros y pagos de Transportes Araya.
-- Todos los importes se guardan en céntimos (enteros) para no arrastrar
-- errores de redondeo con decimales en coma flotante.
-- Todas las fechas se guardan como texto ISO 'YYYY-MM-DD'.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS clientes (
  id         INTEGER PRIMARY KEY,
  codigo     TEXT NOT NULL UNIQUE,
  nombre     TEXT NOT NULL,
  nif        TEXT,
  telefono   TEXT,
  email      TEXT,
  dias_pago  INTEGER NOT NULL DEFAULT 30,
  activo     INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS proveedores (
  id         INTEGER PRIMARY KEY,
  codigo     TEXT NOT NULL UNIQUE,
  nombre     TEXT NOT NULL,
  nif        TEXT,
  telefono   TEXT,
  email      TEXT,
  dias_pago  INTEGER NOT NULL DEFAULT 30,
  activo     INTEGER NOT NULL DEFAULT 1
);

-- Facturas que emitimos a clientes: generan cobros pendientes.
CREATE TABLE IF NOT EXISTS facturas_emitidas (
  id                 INTEGER PRIMARY KEY,
  numero             TEXT NOT NULL UNIQUE,
  cliente_id         INTEGER NOT NULL REFERENCES clientes(id),
  fecha_emision      TEXT NOT NULL,
  fecha_vencimiento  TEXT NOT NULL,
  base_centimos      INTEGER NOT NULL,
  impuestos_centimos INTEGER NOT NULL DEFAULT 0,
  total_centimos     INTEGER NOT NULL CHECK (total_centimos >= 0),
  concepto           TEXT,
  anulada            INTEGER NOT NULL DEFAULT 0
);

-- Facturas que recibimos de proveedores: generan pagos pendientes.
CREATE TABLE IF NOT EXISTS facturas_recibidas (
  id                 INTEGER PRIMARY KEY,
  numero             TEXT NOT NULL,
  proveedor_id       INTEGER NOT NULL REFERENCES proveedores(id),
  fecha_emision      TEXT NOT NULL,
  fecha_vencimiento  TEXT NOT NULL,
  base_centimos      INTEGER NOT NULL,
  impuestos_centimos INTEGER NOT NULL DEFAULT 0,
  total_centimos     INTEGER NOT NULL CHECK (total_centimos >= 0),
  concepto           TEXT,
  anulada            INTEGER NOT NULL DEFAULT 0,
  UNIQUE (proveedor_id, numero)
);

-- Cobros y pagos parciales: una factura puede saldarse en varias veces.
CREATE TABLE IF NOT EXISTS cobros (
  id                INTEGER PRIMARY KEY,
  factura_id        INTEGER NOT NULL REFERENCES facturas_emitidas(id) ON DELETE CASCADE,
  fecha             TEXT NOT NULL,
  importe_centimos  INTEGER NOT NULL CHECK (importe_centimos > 0),
  metodo            TEXT,
  observaciones     TEXT
);

CREATE TABLE IF NOT EXISTS pagos (
  id                INTEGER PRIMARY KEY,
  factura_id        INTEGER NOT NULL REFERENCES facturas_recibidas(id) ON DELETE CASCADE,
  fecha             TEXT NOT NULL,
  importe_centimos  INTEGER NOT NULL CHECK (importe_centimos > 0),
  metodo            TEXT,
  observaciones     TEXT
);

CREATE INDEX IF NOT EXISTS idx_emitidas_cliente   ON facturas_emitidas (cliente_id);
CREATE INDEX IF NOT EXISTS idx_emitidas_venc      ON facturas_emitidas (fecha_vencimiento);
CREATE INDEX IF NOT EXISTS idx_recibidas_prov     ON facturas_recibidas (proveedor_id);
CREATE INDEX IF NOT EXISTS idx_recibidas_venc     ON facturas_recibidas (fecha_vencimiento);
CREATE INDEX IF NOT EXISTS idx_cobros_factura     ON cobros (factura_id);
CREATE INDEX IF NOT EXISTS idx_pagos_factura      ON pagos (factura_id);

-- Vistas con el saldo vivo de cada factura. El listado diario sale de aquí,
-- así el cálculo de "lo que queda por cobrar/pagar" vive en un único sitio.
CREATE VIEW IF NOT EXISTS v_cobros_pendientes AS
SELECT
  f.id                AS factura_id,
  f.numero            AS numero,
  c.id                AS tercero_id,
  c.codigo            AS tercero_codigo,
  c.nombre            AS tercero_nombre,
  c.telefono          AS tercero_telefono,
  f.fecha_emision     AS fecha_emision,
  f.fecha_vencimiento AS fecha_vencimiento,
  f.concepto          AS concepto,
  f.total_centimos    AS total_centimos,
  f.total_centimos - COALESCE(SUM(co.importe_centimos), 0) AS pendiente_centimos
FROM facturas_emitidas f
JOIN clientes c ON c.id = f.cliente_id
LEFT JOIN cobros co ON co.factura_id = f.id
WHERE f.anulada = 0
GROUP BY f.id
HAVING pendiente_centimos > 0;

CREATE VIEW IF NOT EXISTS v_pagos_pendientes AS
SELECT
  f.id                AS factura_id,
  f.numero            AS numero,
  p.id                AS tercero_id,
  p.codigo            AS tercero_codigo,
  p.nombre            AS tercero_nombre,
  p.telefono          AS tercero_telefono,
  f.fecha_emision     AS fecha_emision,
  f.fecha_vencimiento AS fecha_vencimiento,
  f.concepto          AS concepto,
  f.total_centimos    AS total_centimos,
  f.total_centimos - COALESCE(SUM(pa.importe_centimos), 0) AS pendiente_centimos
FROM facturas_recibidas f
JOIN proveedores p ON p.id = f.proveedor_id
LEFT JOIN pagos pa ON pa.factura_id = f.id
WHERE f.anulada = 0
GROUP BY f.id
HAVING pendiente_centimos > 0;

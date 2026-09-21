-- ############################################################################
-- APLICADO EN PRODUCCION EL 21/09/2026.
--   Se borraron las 32 filas fantasma. Comprobado despues: 0 parejas
--   duplicadas, los 3 falsos positivos intactos, 0 lineas huerfanas y
--   0 cobros huerfanos. Facturas de venta: 11.539 -> 11.507.
--   Copia de seguridad de las 32 filas con sus lineas en la tabla
--   public.respaldo_duplicados_factusol_20260921 (sin permisos para la API).
--   Este fichero queda como registro y para volver a pasarlo si en el futuro
--   otra importacion historica vuelve a duplicar facturas.
-- ############################################################################

-- ============================================================================
-- Limpiar las facturas de venta duplicadas por las series de Factusol
-- Transportes Araya Franquiz - 21/09/2026
--
-- EL PROBLEMA
--   Factusol guarda algunas facturas en dos series a la vez (2 y 7, o 1 y 2,
--   o 1 y 9). La importacion historica del 14/09/2026 las trajo al panel como
--   dos facturas distintas: "2-4100" y "7-4100" son la MISMA factura real.
--   Resultado: el panel cuenta dos veces la misma deuda.
--
--   Situacion a 21/09/2026, despues de arreglar el caso AL-BANNI:
--     32 parejas duplicadas de verdad
--     26 filas fantasma figurando como pendientes de cobro ... 62.305,46 EUR
--      6 filas fantasma ya cobradas (inflan la facturacion) ....  6.597,58 EUR
--   Comprobado el 21/09/2026: el PASO 2 selecciona exactamente 32 filas,
--   ninguna con cobros o asientos colgando, y no toca los falsos positivos.
--
--   Los casos mas graves son 4040, 4100 y 4196 (ABIJEIM SOCIETY): el dinero
--   se cobro en la serie 2, pero la copia de la serie 7 sigue reclamandose
--   como pendiente. Son 20.110,51 EUR que ya estan en el banco.
--
-- TRES FALSOS POSITIVOS QUE NO HAY QUE TOCAR
--   Los numeros 14, 210068 y 250529 se repiten entre series pero son facturas
--   DISTINTAS, de clientes distintos e importes distintos. Este script los
--   excluye solo: exige que las dos filas coincidan en cliente, importe y
--   fecha antes de considerarlas gemelas.
--
-- COMO USARLO
--   1. Ejecuta primero el PASO 1 (solo lectura) y revisa la lista.
--   2. Si estas de acuerdo, ejecuta el PASO 2.
--   El PASO 2 nunca borra una fila que tenga cobros, asientos, albaranes,
--   movimientos de banco o reclamaciones colgando: de cada pareja se queda
--   siempre con la fila que lleva la informacion real.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- PASO 1 - REVISAR (no cambia nada)
-- ---------------------------------------------------------------------------
with pref as (
  select fv.id, fv.cliente_id, cl.nombre as cliente, fv.numero_factura,
         split_part(fv.numero_factura,'-',1)::int as serie,
         split_part(fv.numero_factura,'-',2) as num,
         fv.fecha, fv.total, coalesce(fv.importe_cobrado,0) as cobrado, fv.estado,
         (select count(*) from cobros c             where c.factura_venta_id  = fv.id)
        +(select count(*) from asientos a           where a.factura_venta_id  = fv.id)
        +(select count(*) from albaranes al         where al.factura_venta_id = fv.id)
        +(select count(*) from movimientos_banco mb where mb.factura_venta_id = fv.id)
        +(select count(*) from reclamacion_facturas rf where rf.factura_venta_id = fv.id) as ataduras
  from facturas_venta fv
  join clientes cl on cl.id = fv.cliente_id
  where fv.numero_factura ~ '^[0-9]+-[0-9]+$'
),
gemelas as (
  select num from pref
  group by num
  having count(*) = 2
     and count(distinct cliente_id) = 1
     and count(distinct total)      = 1
     and count(distinct fecha)      = 1
),
ranked as (
  select p.*, row_number() over (
           partition by p.num order by p.ataduras desc, p.cobrado desc, p.serie asc) as rn
  from pref p join gemelas g on g.num = p.num
)
select a.num as numero, a.cliente, a.fecha, a.total,
       a.numero_factura as se_queda,  a.estado as estado_se_queda,  a.ataduras as ataduras_se_queda,
       b.numero_factura as se_borra,  b.estado as estado_se_borra,  b.ataduras as ataduras_se_borra,
       case when b.estado <> 'cobrada' then b.total - b.cobrado else 0 end as pendiente_falso_que_desaparece
from ranked a
join ranked b on b.num = a.num and b.rn = 2
where a.rn = 1
order by (case when b.estado <> 'cobrada' then b.total - b.cobrado else 0 end) desc;


-- ---------------------------------------------------------------------------
-- PASO 2 - BORRAR (ejecutar solo despues de revisar el PASO 1)
-- Las lineas de cada factura borrada se van con ella (borrado en cascada).
-- ---------------------------------------------------------------------------
begin;

with pref as (
  select fv.id, fv.cliente_id, fv.numero_factura,
         split_part(fv.numero_factura,'-',1)::int as serie,
         split_part(fv.numero_factura,'-',2) as num,
         fv.fecha, fv.total, coalesce(fv.importe_cobrado,0) as cobrado,
         (select count(*) from cobros c             where c.factura_venta_id  = fv.id)
        +(select count(*) from asientos a           where a.factura_venta_id  = fv.id)
        +(select count(*) from albaranes al         where al.factura_venta_id = fv.id)
        +(select count(*) from movimientos_banco mb where mb.factura_venta_id = fv.id)
        +(select count(*) from reclamacion_facturas rf where rf.factura_venta_id = fv.id) as ataduras
  from facturas_venta fv
  where fv.numero_factura ~ '^[0-9]+-[0-9]+$'
),
gemelas as (
  select num from pref
  group by num
  having count(*) = 2
     and count(distinct cliente_id) = 1
     and count(distinct total)      = 1
     and count(distinct fecha)      = 1
),
ranked as (
  select p.*, row_number() over (
           partition by p.num order by p.ataduras desc, p.cobrado desc, p.serie asc) as rn
  from pref p join gemelas g on g.num = p.num
),
a_borrar as (
  select id, numero_factura from ranked
  where rn = 2
    and ataduras = 0          -- nunca una fila con cobros/asientos/albaranes/reclamaciones
)
delete from facturas_venta fv
using a_borrar b
where fv.id = b.id
returning fv.numero_factura, fv.total;

commit;


-- ---------------------------------------------------------------------------
-- COMPROBAR DESPUES: deberia devolver 0 parejas.
-- ---------------------------------------------------------------------------
-- select count(*) as parejas_que_quedan from (
--   select split_part(numero_factura,'-',2) as num
--   from facturas_venta where numero_factura ~ '^[0-9]+-[0-9]+$'
--   group by 1, split_part(numero_factura,'-',2)
--   having count(*) = 2 and count(distinct cliente_id) = 1
--      and count(distinct total) = 1 and count(distinct fecha) = 1) t;

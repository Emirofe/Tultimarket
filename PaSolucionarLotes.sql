-- ==========================================================================================
-- TULTIMARKET - SCRIPT DE SOLUCIÓN INTEGRAL (SPRINT 10)
-- Este script corrige los 3 errores críticos detectados en el cierre del sprint:
-- 1. Sincronización de Stock (Lotes Inventario)
-- 2. Sincronización de Secuencias (Errores de ID duplicado)
-- 3. Trigger de Snapshot (Errores de valores nulos en detalle_pedido)
-- ==========================================================================================

-- PARTE 1: MIGRACIÓN MASIVA DE LOTES
-- Corrige el error: "Stock insuficiente o caducado" al hacer checkout.
-- Crea un lote para cada producto que tenga stock en la tabla 'productos' pero no en 'lotes_inventario'.
INSERT INTO lotes_inventario (id_producto, stock_disponible, fecha_recibido, fecha_caducidad)
SELECT id, stock_total, CURRENT_DATE, '2026-12-31' -- Fecha de caducidad genérica a futuro
FROM productos p
WHERE NOT EXISTS (
    SELECT 1 FROM lotes_inventario l WHERE l.id_producto = p.id
) AND stock_total > 0;

-- PARTE 2: RECALIBRACIÓN DE SECUENCIAS
-- Corrige el error: "duplicate key value violates unique constraint" al insertar nuevos registros.
SELECT setval('usuarios_id_seq', (SELECT MAX(id) FROM usuarios));
SELECT setval('productos_id_seq', (SELECT MAX(id) FROM productos));
SELECT setval('categorias_id_seq', (SELECT MAX(id) FROM categorias));
SELECT setval('pedidos_id_seq', (SELECT MAX(id) FROM pedidos));
SELECT setval('detalle_pedido_id_seq', (SELECT MAX(id) FROM detalle_pedido));
SELECT setval('lotes_inventario_id_seq', (SELECT MAX(id) FROM lotes_inventario));
SELECT setval('direcciones_id_seq', (SELECT MAX(id) FROM direcciones));
SELECT setval('negocios_id_seq', (SELECT MAX(id) FROM negocios));
SELECT setval('roles_id_seq', (SELECT MAX(id) FROM roles));

-- PARTE 3: TRIGGER DE SNAPSHOT
-- Corrige el error: "null value in column 'snapshot_item' violates not-null constraint".
CREATE OR REPLACE FUNCTION trg_llenar_snapshot_detalle() 
RETURNS TRIGGER AS $$
DECLARE
    v_nombre VARCHAR;
    v_imagen TEXT;
    v_precio DECIMAL;
BEGIN
    IF NEW.id_producto IS NOT NULL THEN
        SELECT p.nombre, p.precio, pi.url_imagen INTO v_nombre, v_precio, v_imagen
        FROM productos p
        LEFT JOIN producto_imagenes pi ON p.id = pi.id_producto AND pi.es_principal = TRUE
        WHERE p.id = NEW.id_producto;

        NEW.precio_unitario_historico := COALESCE(v_precio, 0);
        NEW.snapshot_item := jsonb_build_object('nombre', v_nombre, 'imagen_principal', v_imagen);
        
    ELSIF NEW.id_servicio IS NOT NULL THEN
        SELECT s.nombre, s.precio_base, si.url_imagen INTO v_nombre, v_precio, v_imagen
        FROM servicios s
        LEFT JOIN servicio_imagenes si ON s.id = si.id_servicio AND si.es_principal = TRUE
        WHERE s.id = NEW.id_servicio;

        NEW.precio_unitario_historico := COALESCE(v_precio, 0);
        NEW.snapshot_item := jsonb_build_object('nombre', v_nombre, 'imagen_principal', v_imagen);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tg_snapshot_detalle ON detalle_pedido;
CREATE TRIGGER tg_snapshot_detalle
BEFORE INSERT ON detalle_pedido
FOR EACH ROW EXECUTE FUNCTION trg_llenar_snapshot_detalle();

-- RECALCULAR STOCK TOTAL EN PRODUCTOS (Sincronización final)
UPDATE productos p
SET stock_total = (
    SELECT COALESCE(SUM(stock_disponible), 0)
    FROM lotes_inventario
    WHERE id_producto = p.id AND fecha_caducidad >= CURRENT_DATE
);

RAISE NOTICE '¡Base de datos estabilizada con éxito!';

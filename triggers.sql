-- ==========================================================================================
-- TULTIMARKET - TODOS LOS TRIGGERS Y FUNCIONES DEL SISTEMA
-- Este archivo contiene la lógica de base de datos para automatizar el stock, 
-- las calificaciones y los snapshots de pedidos.
-- ==========================================================================================

-- 1. TRIGGER: ACTUALIZAR CALIFICACIÓN AUTOMÁTICAMENTE
-- Recalcula el promedio de estrellas de un producto o servicio cuando alguien deja una reseña.
CREATE OR REPLACE FUNCTION trg_actualizar_calificacion() 
RETURNS TRIGGER AS $$
BEGIN
    IF COALESCE(NEW.id_producto, OLD.id_producto) IS NOT NULL THEN
        UPDATE productos
        SET calificacion = (
            SELECT ROUND(AVG(calificacion)::numeric, 1)
            FROM resenas 
            WHERE id_producto = COALESCE(NEW.id_producto, OLD.id_producto)
        )
        WHERE id = COALESCE(NEW.id_producto, OLD.id_producto);
    END IF;

    IF COALESCE(NEW.id_servicio, OLD.id_servicio) IS NOT NULL THEN
        UPDATE servicios
        SET calificacion = (
            SELECT ROUND(AVG(calificacion)::numeric, 1)
            FROM resenas 
            WHERE id_servicio = COALESCE(NEW.id_servicio, OLD.id_servicio)
        )
        WHERE id = COALESCE(NEW.id_servicio, OLD.id_servicio);
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tg_actualizar_calificacion ON resenas;
CREATE TRIGGER tg_actualizar_calificacion
AFTER INSERT OR UPDATE OR DELETE ON resenas
FOR EACH ROW EXECUTE FUNCTION trg_actualizar_calificacion();


-- 2. TRIGGER: SNAPSHOT DE PEDIDO (EL QUE "EXTRAE CHIDO" LOS DATOS)
-- Antes de insertar en detalle_pedido, guarda el nombre, la foto y el precio actual
-- para que si el producto cambia después, el recibo del cliente se mantenga igual.
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


-- 3. TRIGGER: SINCRONIZACIÓN DE STOCK (LOTES -> PRODUCTO)
-- Cada vez que entra mercancía nueva o se vende algo (en lotes_inventario), 
-- actualiza el stock_total en la tabla principal de productos.
CREATE OR REPLACE FUNCTION trg_sync_stock_producto() 
RETURNS TRIGGER AS $$
BEGIN
    UPDATE productos
    SET stock_total = (
        SELECT COALESCE(SUM(stock_disponible), 0)
        FROM lotes_inventario
        WHERE id_producto = COALESCE(NEW.id_producto, OLD.id_producto)
          AND fecha_caducidad >= CURRENT_DATE 
    )
    WHERE id = COALESCE(NEW.id_producto, OLD.id_producto);
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tg_sync_stock ON lotes_inventario;
CREATE TRIGGER tg_sync_stock
AFTER INSERT OR UPDATE OR DELETE ON lotes_inventario
FOR EACH ROW EXECUTE FUNCTION trg_sync_stock_producto();

-- NOTA: Estos triggers aseguran que la lógica de negocio esté blindada 
-- directamente en la base de datos.

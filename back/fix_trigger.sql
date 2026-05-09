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

const express = require("express");

function createCompradorRouter({ pool }) {
  const router = express.Router();

  function obtenerUsuarioSesion(req) {
    return Number(req.session?.usuario_id || 0);
  }

  function requireSession(req, res) {
    const idUsuario = obtenerUsuarioSesion(req);
    if (!Number.isInteger(idUsuario) || idUsuario <= 0) {
      res.status(401).json({ status: "error", mensaje: "Debes iniciar sesion" });
      return null;
    }
    return idUsuario;
  }

  async function requireActiveSession(req, res) {
    const idUsuario = requireSession(req, res);
    if (!idUsuario) return null;

    try {
      const usuarioActivo = await pool.query(
        `SELECT id
         FROM usuarios
         WHERE id = $1
           AND activo = TRUE
           AND fecha_eliminacion IS NULL
         LIMIT 1`,
        [idUsuario]
      );

      if (usuarioActivo.rows.length === 0) {
        res.status(401).json({ status: "error", mensaje: "Sesion invalida o usuario inactivo" });
        return null;
      }

      return idUsuario;
    } catch (error) {
      console.error(error);
      res.status(500).json({ status: "error", mensaje: "Error al validar sesion" });
      return null;
    }
  }

  const precioProductoActualSql = `CASE
    WHEN d.id IS NOT NULL
      AND d.codigo_cupon IS NULL
      AND CURRENT_TIMESTAMP BETWEEN d.fecha_inicio AND d.fecha_fin
    THEN ROUND((p.precio * (1 - (d.porcentaje_descuento / 100)))::numeric, 2)
    ELSE p.precio
  END`;

  const precioServicioActualSql = `CASE
    WHEN d.id IS NOT NULL
      AND d.codigo_cupon IS NULL
      AND CURRENT_TIMESTAMP BETWEEN d.fecha_inicio AND d.fecha_fin
    THEN ROUND((s.precio_base * (1 - (d.porcentaje_descuento / 100)))::numeric, 2)
    ELSE s.precio_base
  END`;

  async function verificarCompra({ idUsuario, tipo, idItem }) {
    const columnaItem = tipo === "producto" ? "id_producto" : "id_servicio";
    const result = await pool.query(
      `SELECT 1
       FROM pedidos p
       INNER JOIN detalle_pedido dp ON dp.id_pedido = p.id
       WHERE p.id_usuario = $1
         AND dp.${columnaItem} = $2
         AND COALESCE(p.estado_pedido, '') NOT IN ('CANCELADO', 'CANCELADA')
       LIMIT 1`,
      [idUsuario, idItem]
    );

    return result.rows.length > 0;
  }

  async function obtenerResenaConUsuario(idResena) {
    const result = await pool.query(
      `SELECT
         r.id,
         r.id_usuario,
         r.id_producto,
         r.id_servicio,
         r.calificacion,
         r.comentario,
         r.compra_verificada,
         r.fecha_creacion,
         u.nombre AS usuario
       FROM resenas r
       INNER JOIN usuarios u ON u.id = r.id_usuario
       WHERE r.id = $1
       LIMIT 1`,
      [idResena]
    );

    const resena = result.rows[0];
    if (!resena) return null;

    return {
      id: resena.id,
      calificacion: Number(resena.calificacion),
      comentario: resena.comentario,
      compra_verificada: resena.compra_verificada,
      fecha_creacion: resena.fecha_creacion,
      usuario: {
        id: resena.id_usuario,
        nombre: resena.usuario,
      },
    };
  }

  // Obtener categorias para el front 
  router.get("/comprador/categorias", async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT id, nombre_categoria, tipo, id_padre
         FROM categorias
         ORDER BY nombre_categoria ASC`
      );

      return res.status(200).json(
        result.rows.map((categoria) => ({
          id: categoria.id,
          nombre: categoria.nombre_categoria,
          tipo: categoria.tipo,
          id_padre: categoria.id_padre,
        }))
      );
    } catch (error) {
      console.error(error);
      return res.status(500).json({ mensaje: "Error al obtener categorias" });
    }
  });

  // Top categorías raíz por cantidad de productos (para navbar)
  router.get("/comprador/categorias/top", async (req, res) => {
    try {
      const result = await pool.query(
        `WITH RECURSIVE arbol AS (
           SELECT id, id AS raiz_id FROM categorias WHERE id_padre IS NULL
           UNION ALL
           SELECT c.id, a.raiz_id FROM categorias c INNER JOIN arbol a ON c.id_padre = a.id
         ),
         items AS (
           SELECT a.raiz_id, 'producto' AS tipo, pc.id_producto AS item_id
           FROM arbol a
           INNER JOIN producto_categoria pc ON pc.id_categoria = a.id
           INNER JOIN productos p ON p.id = pc.id_producto AND p.esta_activo = TRUE
           UNION ALL
           SELECT a.raiz_id, 'servicio' AS tipo, sc.id_servicio AS item_id
           FROM arbol a
           INNER JOIN servicio_categoria sc ON sc.id_categoria = a.id
           INNER JOIN servicios s ON s.id = sc.id_servicio AND s.esta_activo = TRUE
         )
         SELECT cat.id, cat.nombre_categoria, COUNT(DISTINCT items.tipo || '-' || items.item_id) AS total_items
         FROM items
         INNER JOIN categorias cat ON cat.id = items.raiz_id
         GROUP BY cat.id, cat.nombre_categoria
         HAVING COUNT(DISTINCT items.tipo || '-' || items.item_id) > 0
         ORDER BY total_items DESC
         LIMIT 10`
      );

      return res.status(200).json(
        result.rows.map((c) => ({
          id: c.id,
          nombre: c.nombre_categoria,
          total: Number(c.total_items),
        }))
      );
    } catch (error) {
      console.error(error);
      return res.status(500).json({ mensaje: "Error al obtener top categorias" });
    }
  });

  // Obtener productos por categoria
  router.get("/comprador/productos/categoria/:idCategoria", async (req, res) => {
    const idCategoria = Number(req.params.idCategoria);
    const { q, precio_min, precio_max, calificacion_min, ordenar } = req.query;

    if (!Number.isInteger(idCategoria) || idCategoria <= 0) {
      return res.status(400).json({ mensaje: "idCategoria invalido" });
    }

    try {
      const filtros = ["pc.id_categoria IN (SELECT id FROM cat_tree)"];
      const valores = [idCategoria];
      let qLikeIndex = null;

      if (q !== undefined && String(q).trim() !== "") {
        valores.push(`%${String(q).trim()}%`);
        qLikeIndex = valores.length;
        filtros.push(
          `(p.nombre ILIKE $${qLikeIndex} OR COALESCE(p.descripcion, '') ILIKE $${qLikeIndex} OR COALESCE(n.nombre_comercial, '') ILIKE $${qLikeIndex})`
        );
      }

      const precioMinNum = Number(precio_min);
      if (precio_min !== undefined && precio_min !== "" && !Number.isNaN(precioMinNum)) {
        valores.push(precioMinNum);
        filtros.push(`(${precioProductoActualSql}) >= $${valores.length}`);
      }

      const precioMaxNum = Number(precio_max);
      if (precio_max !== undefined && precio_max !== "" && !Number.isNaN(precioMaxNum)) {
        valores.push(precioMaxNum);
        filtros.push(`(${precioProductoActualSql}) <= $${valores.length}`);
      }

      const calificacionMinNum = Number(calificacion_min);
      if (calificacion_min !== undefined && calificacion_min !== "" && !Number.isNaN(calificacionMinNum)) {
        valores.push(calificacionMinNum);
        filtros.push(`COALESCE(p.calificacion, 0) >= $${valores.length}`);
      }

      const orden = String(ordenar || "mejor_calificados").toLowerCase();
      let orderBy = "p.calificacion DESC NULLS LAST, COUNT(DISTINCT r.id) DESC, p.fecha_registro DESC";

      if (orden === "precio_menor" || orden === "precio_menor_a_mayor" || orden === "precio_asc") {
        orderBy = "precio ASC, p.nombre ASC";
      } else if (orden === "precio_mayor" || orden === "precio_mayor_a_menor" || orden === "precio_desc") {
        orderBy = "precio DESC, p.nombre ASC";
      } else if (orden === "nombre" || orden === "nombre_az") {
        orderBy = "p.nombre ASC";
      } else if (orden === "relevancia" && qLikeIndex !== null) {
        orderBy = `
          CASE
            WHEN p.nombre ILIKE $${qLikeIndex} THEN 3
            WHEN COALESCE(p.descripcion, '') ILIKE $${qLikeIndex} THEN 2
            WHEN COALESCE(n.nombre_comercial, '') ILIKE $${qLikeIndex} THEN 1
            ELSE 0
          END DESC,
          p.calificacion DESC NULLS LAST,
          COUNT(DISTINCT r.id) DESC,
          p.fecha_registro DESC`;
      }

      const productosResult = await pool.query(
        `WITH RECURSIVE cat_tree AS (
           SELECT id FROM categorias WHERE id = $1
           UNION ALL
           SELECT c.id FROM categorias c INNER JOIN cat_tree ct ON c.id_padre = ct.id
         )
         SELECT
           p.id,
           p.nombre,
           p.calificacion,
           p.precio AS precio_original,
           CASE
             WHEN d.id IS NOT NULL
               AND d.codigo_cupon IS NULL
               AND CURRENT_TIMESTAMP BETWEEN d.fecha_inicio AND d.fecha_fin
             THEN ROUND((p.precio * (1 - (d.porcentaje_descuento / 100)))::numeric, 2)
             ELSE p.precio
           END AS precio,
           CASE
             WHEN d.id IS NOT NULL
               AND d.codigo_cupon IS NULL
               AND CURRENT_TIMESTAMP BETWEEN d.fecha_inicio AND d.fecha_fin
             THEN d.porcentaje_descuento
             ELSE NULL
           END AS porcentaje_descuento,
           pi.url_imagen AS imagen_principal,
           COALESCE(n.nombre_comercial, '') AS empresa,
           COUNT(DISTINCT r.id) AS numero_resenas
         FROM productos p
         INNER JOIN producto_categoria pc ON pc.id_producto = p.id
         LEFT JOIN negocios n ON n.id = p.id_negocio
         LEFT JOIN descuentos d ON d.id = p.id_descuento
        LEFT JOIN LATERAL (
          SELECT pi_sub.url_imagen
          FROM producto_imagenes pi_sub
          WHERE pi_sub.id_producto = p.id
          ORDER BY pi_sub.es_principal DESC, pi_sub.orden_visual ASC, pi_sub.id ASC
          LIMIT 1
        ) pi ON TRUE
         LEFT JOIN resenas r ON r.id_producto = p.id
         WHERE p.esta_activo = TRUE
           AND ${filtros.join(" AND ")}
         GROUP BY p.id, p.nombre, p.calificacion, p.precio, pi.url_imagen, n.nombre_comercial, p.fecha_registro,
                  d.id, d.codigo_cupon, d.porcentaje_descuento, d.fecha_inicio, d.fecha_fin
         ORDER BY ${orderBy}`,
        valores
      );

      return res.status(200).json({
        id_categoria: idCategoria,
        filtros: {
          q: q || null,
          precio_min: precio_min || null,
          precio_max: precio_max || null,
          calificacion_min: calificacion_min || null,
          ordenar: ordenar || "mejor_calificados",
        },
        total: productosResult.rows.length,
        productos: productosResult.rows,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ mensaje: "Error al obtener productos por categoria" });
    }
  });

  // Obtener servicios por categoria
  router.get("/comprador/servicios/categoria/:idCategoria", async (req, res) => {
    const idCategoria = Number(req.params.idCategoria);
    const { q, precio_min, precio_max, calificacion_min, ordenar } = req.query;

    if (!Number.isInteger(idCategoria) || idCategoria <= 0) {
      return res.status(400).json({ mensaje: "idCategoria invalido" });
    }

    try {
      const filtros = ["sc.id_categoria IN (SELECT id FROM cat_tree)"];
      const valores = [idCategoria];
      let qLikeIndex = null;

      if (q !== undefined && String(q).trim() !== "") {
        valores.push(`%${String(q).trim()}%`);
        qLikeIndex = valores.length;
        filtros.push(
          `(s.nombre ILIKE $${qLikeIndex} OR COALESCE(s.descripcion, '') ILIKE $${qLikeIndex} OR COALESCE(n.nombre_comercial, '') ILIKE $${qLikeIndex})`
        );
      }

      const precioMinNum = Number(precio_min);
      if (precio_min !== undefined && precio_min !== "" && !Number.isNaN(precioMinNum)) {
        valores.push(precioMinNum);
        filtros.push(`(${precioServicioActualSql}) >= $${valores.length}`);
      }

      const precioMaxNum = Number(precio_max);
      if (precio_max !== undefined && precio_max !== "" && !Number.isNaN(precioMaxNum)) {
        valores.push(precioMaxNum);
        filtros.push(`(${precioServicioActualSql}) <= $${valores.length}`);
      }

      const calificacionMinNum = Number(calificacion_min);
      if (calificacion_min !== undefined && calificacion_min !== "" && !Number.isNaN(calificacionMinNum)) {
        valores.push(calificacionMinNum);
        filtros.push(`COALESCE(s.calificacion, 0) >= $${valores.length}`);
      }

      const orden = String(ordenar || "mejor_calificados").toLowerCase();
      let orderBy = "s.calificacion DESC NULLS LAST, COUNT(DISTINCT r.id) DESC, s.fecha_registro DESC";

      if (orden === "precio_menor" || orden === "precio_menor_a_mayor" || orden === "precio_asc") {
        orderBy = "precio ASC, s.nombre ASC";
      } else if (orden === "precio_mayor" || orden === "precio_mayor_a_menor" || orden === "precio_desc") {
        orderBy = "precio DESC, s.nombre ASC";
      } else if (orden === "nombre" || orden === "nombre_az") {
        orderBy = "s.nombre ASC";
      } else if (orden === "relevancia" && qLikeIndex !== null) {
        orderBy = `
          CASE
            WHEN s.nombre ILIKE $${qLikeIndex} THEN 3
            WHEN COALESCE(s.descripcion, '') ILIKE $${qLikeIndex} THEN 2
            WHEN COALESCE(n.nombre_comercial, '') ILIKE $${qLikeIndex} THEN 1
            ELSE 0
          END DESC,
          s.calificacion DESC NULLS LAST,
          COUNT(DISTINCT r.id) DESC,
          s.fecha_registro DESC`;
      }

      const serviciosResult = await pool.query(
        `WITH RECURSIVE cat_tree AS (
           SELECT id FROM categorias WHERE id = $1
           UNION ALL
           SELECT c.id FROM categorias c INNER JOIN cat_tree ct ON c.id_padre = ct.id
         )
         SELECT
           s.id,
           s.nombre,
           s.calificacion,
           s.precio_base AS precio_original,
           CASE
             WHEN d.id IS NOT NULL
               AND d.codigo_cupon IS NULL
               AND CURRENT_TIMESTAMP BETWEEN d.fecha_inicio AND d.fecha_fin
             THEN ROUND((s.precio_base * (1 - (d.porcentaje_descuento / 100)))::numeric, 2)
             ELSE s.precio_base
           END AS precio,
           CASE
             WHEN d.id IS NOT NULL
               AND d.codigo_cupon IS NULL
               AND CURRENT_TIMESTAMP BETWEEN d.fecha_inicio AND d.fecha_fin
             THEN d.porcentaje_descuento
             ELSE NULL
           END AS porcentaje_descuento,
           si.url_imagen AS imagen_principal,
           COALESCE(n.nombre_comercial, '') AS empresa,
           COUNT(DISTINCT r.id) AS numero_resenas,
           COALESCE(agenda.horarios_disponibles, 0) AS horarios_disponibles,
           agenda.proximo_horario_inicio,
           agenda.proximo_horario_fin
         FROM servicios s
         INNER JOIN servicio_categoria sc ON sc.id_servicio = s.id
         INNER JOIN negocios n ON n.id = s.id_negocio
         LEFT JOIN descuentos d ON d.id = s.id_descuento
        LEFT JOIN LATERAL (
          SELECT si_sub.url_imagen
          FROM servicio_imagenes si_sub
          WHERE si_sub.id_servicio = s.id
          ORDER BY si_sub.es_principal DESC, si_sub.orden_visual ASC, si_sub.id ASC
          LIMIT 1
        ) si ON TRUE
         LEFT JOIN resenas r ON r.id_servicio = s.id
         LEFT JOIN LATERAL (
           SELECT
             COUNT(*)::int AS horarios_disponibles,
             MIN(ag.fecha_hora_inicio) AS proximo_horario_inicio,
             (array_agg(ag.fecha_hora_fin ORDER BY ag.fecha_hora_inicio ASC))[1] AS proximo_horario_fin
           FROM agenda_servicios ag
           WHERE ag.id_servicio = s.id
             AND ag.estado = 'disponible'
             AND ag.fecha_hora_inicio > CURRENT_TIMESTAMP
         ) agenda ON TRUE
         WHERE s.esta_activo = TRUE
           AND ${filtros.join(" AND ")}
         GROUP BY s.id, s.nombre, s.calificacion, s.precio_base, si.url_imagen, n.nombre_comercial, s.fecha_registro,
                  d.id, d.codigo_cupon, d.porcentaje_descuento, d.fecha_inicio, d.fecha_fin,
                  agenda.horarios_disponibles, agenda.proximo_horario_inicio, agenda.proximo_horario_fin
         ORDER BY ${orderBy}`,
        valores
      );

      return res.status(200).json({
        id_categoria: idCategoria,
        filtros: {
          q: q || null,
          precio_min: precio_min || null,
          precio_max: precio_max || null,
          calificacion_min: calificacion_min || null,
          ordenar: ordenar || "mejor_calificados",
        },
        total: serviciosResult.rows.length,
        servicios: serviciosResult.rows,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ mensaje: "Error al obtener servicios por categoria" });
    }
  });

  // Obtener todos los productos activos
  router.get("/comprador/productos", async (req, res) => {
    const { q, precio_min, precio_max, calificacion_min, ordenar } = req.query;

    try {
      const filtros = ["p.esta_activo = TRUE"];
      const valores = [];
      let qLikeIndex = null;

      if (q !== undefined && String(q).trim() !== "") {
        valores.push(`%${String(q).trim()}%`);
        qLikeIndex = valores.length;
        filtros.push(
          `(p.nombre ILIKE $${qLikeIndex} OR COALESCE(p.descripcion, '') ILIKE $${qLikeIndex} OR COALESCE(n.nombre_comercial, '') ILIKE $${qLikeIndex})`
        );
      }

      const precioMinNum = Number(precio_min);
      if (precio_min !== undefined && precio_min !== "" && !Number.isNaN(precioMinNum)) {
        valores.push(precioMinNum);
        filtros.push(`(${precioProductoActualSql}) >= $${valores.length}`);
      }

      const precioMaxNum = Number(precio_max);
      if (precio_max !== undefined && precio_max !== "" && !Number.isNaN(precioMaxNum)) {
        valores.push(precioMaxNum);
        filtros.push(`(${precioProductoActualSql}) <= $${valores.length}`);
      }

      const calificacionMinNum = Number(calificacion_min);
      if (calificacion_min !== undefined && calificacion_min !== "" && !Number.isNaN(calificacionMinNum)) {
        valores.push(calificacionMinNum);
        filtros.push(`COALESCE(p.calificacion, 0) >= $${valores.length}`);
      }

      const orden = String(ordenar || "mejor_calificados").toLowerCase();
      let orderBy = "p.calificacion DESC NULLS LAST, COUNT(DISTINCT r.id) DESC, p.fecha_registro DESC";

      if (orden === "precio_menor" || orden === "precio_menor_a_mayor" || orden === "precio_asc") {
        orderBy = "precio ASC, p.nombre ASC";
      } else if (orden === "precio_mayor" || orden === "precio_mayor_a_menor" || orden === "precio_desc") {
        orderBy = "precio DESC, p.nombre ASC";
      } else if (orden === "nombre" || orden === "nombre_az") {
        orderBy = "p.nombre ASC";
      } else if (orden === "relevancia" && qLikeIndex !== null) {
        orderBy = `
          CASE
            WHEN p.nombre ILIKE $${qLikeIndex} THEN 3
            WHEN COALESCE(p.descripcion, '') ILIKE $${qLikeIndex} THEN 2
            WHEN COALESCE(n.nombre_comercial, '') ILIKE $${qLikeIndex} THEN 1
            ELSE 0
          END DESC,
          p.calificacion DESC NULLS LAST,
          COUNT(DISTINCT r.id) DESC,
          p.fecha_registro DESC`;
      }

      const result = await pool.query(
        `SELECT
           p.id,
           p.nombre,
           p.calificacion,
           p.precio AS precio_original,
           CASE
             WHEN d.id IS NOT NULL
               AND d.codigo_cupon IS NULL
               AND CURRENT_TIMESTAMP BETWEEN d.fecha_inicio AND d.fecha_fin
             THEN ROUND((p.precio * (1 - (d.porcentaje_descuento / 100)))::numeric, 2)
             ELSE p.precio
           END AS precio,
           CASE
             WHEN d.id IS NOT NULL
               AND d.codigo_cupon IS NULL
               AND CURRENT_TIMESTAMP BETWEEN d.fecha_inicio AND d.fecha_fin
             THEN d.porcentaje_descuento
             ELSE NULL
           END AS porcentaje_descuento,
           pi.url_imagen AS imagen_principal,
           COALESCE(n.nombre_comercial, '') AS empresa,
           COUNT(DISTINCT r.id) AS numero_resenas
         FROM productos p
         LEFT JOIN negocios n ON n.id = p.id_negocio
         LEFT JOIN descuentos d ON d.id = p.id_descuento
        LEFT JOIN LATERAL (
          SELECT pi_sub.url_imagen
          FROM producto_imagenes pi_sub
          WHERE pi_sub.id_producto = p.id
          ORDER BY pi_sub.es_principal DESC, pi_sub.orden_visual ASC, pi_sub.id ASC
          LIMIT 1
        ) pi ON TRUE
         LEFT JOIN resenas r ON r.id_producto = p.id
         WHERE ${filtros.join(" AND ")}
         GROUP BY p.id, p.nombre, p.calificacion, p.precio, pi.url_imagen, n.nombre_comercial, p.fecha_registro,
                  d.id, d.codigo_cupon, d.porcentaje_descuento, d.fecha_inicio, d.fecha_fin
         ORDER BY ${orderBy}`,
        valores
      );

      return res.status(200).json({
        filtros: {
          q: q || null,
          precio_min: precio_min || null,
          precio_max: precio_max || null,
          calificacion_min: calificacion_min || null,
          ordenar: ordenar || "mejor_calificados",
        },
        total: result.rows.length,
        productos: result.rows,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ mensaje: "Error al obtener productos" });
    }
  });

  // Obtener todos los servicios activos
  router.get("/comprador/servicios", async (req, res) => {
    const { q, precio_min, precio_max, calificacion_min, ordenar } = req.query;

    try {
      const filtros = ["s.esta_activo = TRUE"];
      const valores = [];
      let qLikeIndex = null;

      if (q !== undefined && String(q).trim() !== "") {
        valores.push(`%${String(q).trim()}%`);
        qLikeIndex = valores.length;
        filtros.push(
          `(s.nombre ILIKE $${qLikeIndex} OR COALESCE(s.descripcion, '') ILIKE $${qLikeIndex} OR COALESCE(n.nombre_comercial, '') ILIKE $${qLikeIndex})`
        );
      }

      const precioMinNum = Number(precio_min);
      if (precio_min !== undefined && precio_min !== "" && !Number.isNaN(precioMinNum)) {
        valores.push(precioMinNum);
        filtros.push(`(${precioServicioActualSql}) >= $${valores.length}`);
      }

      const precioMaxNum = Number(precio_max);
      if (precio_max !== undefined && precio_max !== "" && !Number.isNaN(precioMaxNum)) {
        valores.push(precioMaxNum);
        filtros.push(`(${precioServicioActualSql}) <= $${valores.length}`);
      }

      const calificacionMinNum = Number(calificacion_min);
      if (calificacion_min !== undefined && calificacion_min !== "" && !Number.isNaN(calificacionMinNum)) {
        valores.push(calificacionMinNum);
        filtros.push(`COALESCE(s.calificacion, 0) >= $${valores.length}`);
      }

      const orden = String(ordenar || "mejor_calificados").toLowerCase();
      let orderBy = "s.calificacion DESC NULLS LAST, COUNT(DISTINCT r.id) DESC, s.fecha_registro DESC";

      if (orden === "precio_menor" || orden === "precio_menor_a_mayor" || orden === "precio_asc") {
        orderBy = "precio ASC, s.nombre ASC";
      } else if (orden === "precio_mayor" || orden === "precio_mayor_a_menor" || orden === "precio_desc") {
        orderBy = "precio DESC, s.nombre ASC";
      } else if (orden === "nombre" || orden === "nombre_az") {
        orderBy = "s.nombre ASC";
      } else if (orden === "relevancia" && qLikeIndex !== null) {
        orderBy = `
          CASE
            WHEN s.nombre ILIKE $${qLikeIndex} THEN 3
            WHEN COALESCE(s.descripcion, '') ILIKE $${qLikeIndex} THEN 2
            WHEN COALESCE(n.nombre_comercial, '') ILIKE $${qLikeIndex} THEN 1
            ELSE 0
          END DESC,
          s.calificacion DESC NULLS LAST,
          COUNT(DISTINCT r.id) DESC,
          s.fecha_registro DESC`;
      }

      const result = await pool.query(
        `SELECT
           s.id,
           s.nombre,
           s.calificacion,
           s.precio_base AS precio_original,
           CASE
             WHEN d.id IS NOT NULL
               AND d.codigo_cupon IS NULL
               AND CURRENT_TIMESTAMP BETWEEN d.fecha_inicio AND d.fecha_fin
             THEN ROUND((s.precio_base * (1 - (d.porcentaje_descuento / 100)))::numeric, 2)
             ELSE s.precio_base
           END AS precio,
           CASE
             WHEN d.id IS NOT NULL
               AND d.codigo_cupon IS NULL
               AND CURRENT_TIMESTAMP BETWEEN d.fecha_inicio AND d.fecha_fin
             THEN d.porcentaje_descuento
             ELSE NULL
           END AS porcentaje_descuento,
           si.url_imagen AS imagen_principal,
           COALESCE(n.nombre_comercial, '') AS empresa,
           COUNT(DISTINCT r.id) AS numero_resenas,
           COALESCE(agenda.horarios_disponibles, 0) AS horarios_disponibles,
           agenda.proximo_horario_inicio,
           agenda.proximo_horario_fin
         FROM servicios s
         LEFT JOIN negocios n ON n.id = s.id_negocio
         LEFT JOIN descuentos d ON d.id = s.id_descuento
        LEFT JOIN LATERAL (
          SELECT si_sub.url_imagen
          FROM servicio_imagenes si_sub
          WHERE si_sub.id_servicio = s.id
          ORDER BY si_sub.es_principal DESC, si_sub.orden_visual ASC, si_sub.id ASC
          LIMIT 1
        ) si ON TRUE
         LEFT JOIN resenas r ON r.id_servicio = s.id
         LEFT JOIN LATERAL (
           SELECT
             COUNT(*)::int AS horarios_disponibles,
             MIN(ag.fecha_hora_inicio) AS proximo_horario_inicio,
             (array_agg(ag.fecha_hora_fin ORDER BY ag.fecha_hora_inicio ASC))[1] AS proximo_horario_fin
           FROM agenda_servicios ag
           WHERE ag.id_servicio = s.id
             AND ag.estado = 'disponible'
             AND ag.fecha_hora_inicio > CURRENT_TIMESTAMP
         ) agenda ON TRUE
         WHERE ${filtros.join(" AND ")}
         GROUP BY s.id, s.nombre, s.calificacion, s.precio_base, si.url_imagen, n.nombre_comercial, s.fecha_registro,
                  d.id, d.codigo_cupon, d.porcentaje_descuento, d.fecha_inicio, d.fecha_fin,
                  agenda.horarios_disponibles, agenda.proximo_horario_inicio, agenda.proximo_horario_fin
         ORDER BY ${orderBy}`,
        valores
      );

      return res.status(200).json({
        filtros: {
          q: q || null,
          precio_min: precio_min || null,
          precio_max: precio_max || null,
          calificacion_min: calificacion_min || null,
          ordenar: ordenar || "mejor_calificados",
        },
        total: result.rows.length,
        servicios: result.rows,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ mensaje: "Error al obtener servicios" });
    }
  });

  // Obtener todos los productos con descuento activo
  router.get("/comprador/productos/descuentos", async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT
           p.id,
           p.nombre,
           p.calificacion,
           p.precio AS precio_original,
           ROUND((p.precio * (1 - (d.porcentaje_descuento / 100)))::numeric, 2) AS precio,
           d.porcentaje_descuento,
           pi.url_imagen AS imagen_principal,
           COALESCE(n.nombre_comercial, '') AS empresa,
           COUNT(DISTINCT r.id) AS numero_resenas
         FROM productos p
         INNER JOIN descuentos d ON d.id = p.id_descuento
         LEFT JOIN negocios n ON n.id = p.id_negocio
        LEFT JOIN LATERAL (
          SELECT pi_sub.url_imagen
          FROM producto_imagenes pi_sub
          WHERE pi_sub.id_producto = p.id
          ORDER BY pi_sub.es_principal DESC, pi_sub.orden_visual ASC, pi_sub.id ASC
          LIMIT 1
        ) pi ON TRUE
         LEFT JOIN resenas r ON r.id_producto = p.id
         WHERE p.esta_activo = TRUE
           AND d.codigo_cupon IS NULL
           AND CURRENT_TIMESTAMP BETWEEN d.fecha_inicio AND d.fecha_fin
         GROUP BY p.id, p.nombre, p.calificacion, p.precio, d.porcentaje_descuento, pi.url_imagen, n.nombre_comercial, p.fecha_registro
         ORDER BY p.fecha_registro DESC, p.nombre ASC`
      );

      return res.status(200).json({
        total: result.rows.length,
        productos: result.rows.map((producto) => ({
          id: producto.id,
          nombre: producto.nombre,
          calificacion: producto.calificacion !== null ? Number(producto.calificacion) : null,
          precio_original: Number(producto.precio_original),
          precio: Number(producto.precio),
          porcentaje_descuento: producto.porcentaje_descuento !== null ? Number(producto.porcentaje_descuento) : null,
          imagen_principal: producto.imagen_principal,
          empresa: producto.empresa,
          numero_resenas: Number(producto.numero_resenas),
        })),
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ mensaje: "Error al obtener productos con descuento" });
    }
  });

  // Obtener todos los servicios con descuento activo
  router.get("/comprador/servicios/descuentos", async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT
           s.id,
           s.nombre,
           s.calificacion,
           s.precio_base AS precio_original,
           ROUND((s.precio_base * (1 - (d.porcentaje_descuento / 100)))::numeric, 2) AS precio,
           d.porcentaje_descuento,
           si.url_imagen AS imagen_principal,
           COALESCE(n.nombre_comercial, '') AS empresa,
           COUNT(DISTINCT r.id) AS numero_resenas,
           COALESCE(agenda.horarios_disponibles, 0) AS horarios_disponibles,
           agenda.proximo_horario_inicio,
           agenda.proximo_horario_fin
         FROM servicios s
         INNER JOIN descuentos d ON d.id = s.id_descuento
         LEFT JOIN negocios n ON n.id = s.id_negocio
        LEFT JOIN LATERAL (
          SELECT si_sub.url_imagen
          FROM servicio_imagenes si_sub
          WHERE si_sub.id_servicio = s.id
          ORDER BY si_sub.es_principal DESC, si_sub.orden_visual ASC, si_sub.id ASC
          LIMIT 1
        ) si ON TRUE
         LEFT JOIN resenas r ON r.id_servicio = s.id
         LEFT JOIN LATERAL (
           SELECT
             COUNT(*)::int AS horarios_disponibles,
             MIN(ag.fecha_hora_inicio) AS proximo_horario_inicio,
             (array_agg(ag.fecha_hora_fin ORDER BY ag.fecha_hora_inicio ASC))[1] AS proximo_horario_fin
           FROM agenda_servicios ag
           WHERE ag.id_servicio = s.id
             AND ag.estado = 'disponible'
             AND ag.fecha_hora_inicio > CURRENT_TIMESTAMP
         ) agenda ON TRUE
         WHERE s.esta_activo = TRUE
           AND d.codigo_cupon IS NULL
           AND CURRENT_TIMESTAMP BETWEEN d.fecha_inicio AND d.fecha_fin
         GROUP BY s.id, s.nombre, s.calificacion, s.precio_base, d.porcentaje_descuento, si.url_imagen, n.nombre_comercial, s.fecha_registro,
                  agenda.horarios_disponibles, agenda.proximo_horario_inicio, agenda.proximo_horario_fin
         ORDER BY s.fecha_registro DESC, s.nombre ASC`
      );

      return res.status(200).json({
        total: result.rows.length,
        servicios: result.rows.map((servicio) => ({
          id: servicio.id,
          nombre: servicio.nombre,
          calificacion: servicio.calificacion !== null ? Number(servicio.calificacion) : null,
          precio_original: Number(servicio.precio_original),
          precio: Number(servicio.precio),
          porcentaje_descuento: servicio.porcentaje_descuento !== null ? Number(servicio.porcentaje_descuento) : null,
          imagen_principal: servicio.imagen_principal,
          empresa: servicio.empresa,
          numero_resenas: Number(servicio.numero_resenas),
          horarios_disponibles: Number(servicio.horarios_disponibles || 0),
          proximo_horario_inicio: servicio.proximo_horario_inicio,
          proximo_horario_fin: servicio.proximo_horario_fin,
        })),
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ mensaje: "Error al obtener servicios con descuento" });
    }
  });

  router.post("/comprador/resenas", async (req, res) => {
    try {
      const idUsuario = await requireActiveSession(req, res);
      if (!idUsuario) return;

      const tipo = String(req.body?.tipo || "").trim().toLowerCase();
      const idItem = Number(req.body?.id_item);
      const calificacion = Number(req.body?.calificacion);
      const comentario = String(req.body?.comentario || "").trim();

      if (!["producto", "servicio"].includes(tipo)) {
        return res.status(400).json({ status: "error", mensaje: "Tipo de resena invalido" });
      }

      if (!Number.isInteger(idItem) || idItem <= 0) {
        return res.status(400).json({ status: "error", mensaje: "Item invalido para resenar" });
      }

      if (!Number.isInteger(calificacion) || calificacion < 1 || calificacion > 5) {
        return res.status(400).json({ status: "error", mensaje: "La calificacion debe ser un numero entero entre 1 y 5" });
      }

      if (comentario.length < 10) {
        return res.status(400).json({ status: "error", mensaje: "El comentario debe tener al menos 10 caracteres" });
      }

      if (comentario.length > 1000) {
        return res.status(400).json({ status: "error", mensaje: "El comentario no puede exceder 1000 caracteres" });
      }

      const itemResult = await pool.query(
        tipo === "producto"
          ? "SELECT id FROM productos WHERE id = $1 AND esta_activo = TRUE LIMIT 1"
          : "SELECT id FROM servicios WHERE id = $1 AND esta_activo = TRUE LIMIT 1",
        [idItem]
      );

      if (itemResult.rows.length === 0) {
        return res.status(404).json({ status: "error", mensaje: "El item no existe o no esta disponible" });
      }

      const compraVerificada = await verificarCompra({ idUsuario, tipo, idItem });

      const result = tipo === "producto"
        ? await pool.query(
          `INSERT INTO resenas (id_usuario, id_producto, id_servicio, calificacion, comentario, compra_verificada)
           VALUES ($1, $2, NULL, $3, $4, $5)
           ON CONFLICT (id_usuario, id_producto) WHERE id_producto IS NOT NULL
           DO UPDATE SET
             calificacion = EXCLUDED.calificacion,
             comentario = EXCLUDED.comentario,
             compra_verificada = EXCLUDED.compra_verificada,
             fecha_creacion = CURRENT_TIMESTAMP
           RETURNING id`,
          [idUsuario, idItem, calificacion, comentario, compraVerificada]
        )
        : await pool.query(
          `INSERT INTO resenas (id_usuario, id_producto, id_servicio, calificacion, comentario, compra_verificada)
           VALUES ($1, NULL, $2, $3, $4, $5)
           ON CONFLICT (id_usuario, id_servicio) WHERE id_servicio IS NOT NULL
           DO UPDATE SET
             calificacion = EXCLUDED.calificacion,
             comentario = EXCLUDED.comentario,
             compra_verificada = EXCLUDED.compra_verificada,
             fecha_creacion = CURRENT_TIMESTAMP
           RETURNING id`,
          [idUsuario, idItem, calificacion, comentario, compraVerificada]
        );

      const resena = await obtenerResenaConUsuario(result.rows[0].id);

      return res.status(200).json({
        status: "success",
        mensaje: "Resena guardada correctamente",
        resena,
      });
    } catch (error) {
      console.error("Error al guardar resena:", error);
      return res.status(500).json({ status: "error", mensaje: "Error al guardar la resena" });
    }
  });

  // Consultar detalle de un producto
  router.get("/comprador/productos/:idProducto", async (req, res) => {
    const idProducto = Number(req.params.idProducto);

    if (!Number.isInteger(idProducto) || idProducto <= 0) {
      return res.status(400).json({ mensaje: "idProducto invalido" });
    }

    try {
      const productoResult = await pool.query(
        `SELECT
           p.id,
           p.nombre,
           p.descripcion,
           p.calificacion,
           p.precio AS precio_original,
           CASE
             WHEN d.id IS NOT NULL
               AND d.codigo_cupon IS NULL
               AND CURRENT_TIMESTAMP BETWEEN d.fecha_inicio AND d.fecha_fin
             THEN ROUND((p.precio * (1 - (d.porcentaje_descuento / 100)))::numeric, 2)
             ELSE p.precio
           END AS precio,
           CASE
             WHEN d.id IS NOT NULL
               AND d.codigo_cupon IS NULL
               AND CURRENT_TIMESTAMP BETWEEN d.fecha_inicio AND d.fecha_fin
             THEN d.porcentaje_descuento
             ELSE NULL
           END AS porcentaje_descuento,
           p.sku,
           p.fecha_registro,
           p.stock_total,
           img.url_imagen AS imagen_principal,
           COALESCE(
             (
               SELECT json_agg(
                 json_build_object(
                   'id', pi.id,
                   'url_imagen', pi.url_imagen,
                   'es_principal', pi.es_principal,
                   'orden_visual', pi.orden_visual
                 )
                 ORDER BY pi.es_principal DESC, pi.orden_visual ASC, pi.id ASC
               )
               FROM producto_imagenes pi
               WHERE pi.id_producto = p.id
             ),
             '[]'::json
           ) AS galeria_imagenes,
           COALESCE(n.nombre_comercial, '') AS empresa,
           COALESCE(
             (
               SELECT COUNT(*)
               FROM resenas r
               WHERE r.id_producto = p.id
             ),
             0
           ) AS numero_resenas,
           COALESCE(
             (
               SELECT array_agg(c.nombre_categoria ORDER BY c.nombre_categoria ASC)
               FROM producto_categoria pc
               INNER JOIN categorias c ON c.id = pc.id_categoria
               WHERE pc.id_producto = p.id
             ),
             ARRAY[]::varchar[]
           ) AS categorias
         FROM productos p
         LEFT JOIN negocios n ON n.id = p.id_negocio
         LEFT JOIN descuentos d ON d.id = p.id_descuento
         LEFT JOIN LATERAL (
           SELECT img_sub.url_imagen
           FROM producto_imagenes img_sub
           WHERE img_sub.id_producto = p.id
           ORDER BY img_sub.es_principal DESC, img_sub.orden_visual ASC, img_sub.id ASC
           LIMIT 1
         ) img ON TRUE
         WHERE p.id = $1
           AND p.esta_activo = TRUE
         LIMIT 1`,
        [idProducto]
      );

      if (productoResult.rows.length === 0) {
        return res.status(404).json({ mensaje: "Producto no encontrado" });
      }

      const resenasResult = await pool.query(
        `SELECT
           r.id,
           r.calificacion,
           r.comentario,
           r.compra_verificada,
           r.fecha_creacion,
           u.id AS id_usuario,
           u.nombre AS usuario
         FROM resenas r
         INNER JOIN usuarios u ON u.id = r.id_usuario
         WHERE r.id_producto = $1
         ORDER BY r.fecha_creacion DESC`,
        [idProducto]
      );

      const producto = productoResult.rows[0];

      return res.status(200).json({
        producto: {
          id: producto.id,
          nombre: producto.nombre,
          descripcion: producto.descripcion,
          calificacion: producto.calificacion !== null ? Number(producto.calificacion) : null,
          precio: Number(producto.precio),
          precio_original: Number(producto.precio_original),
          porcentaje_descuento: producto.porcentaje_descuento !== null ? Number(producto.porcentaje_descuento) : null,
          sku: producto.sku,
          fecha_registro: producto.fecha_registro,
          imagen_principal: producto.imagen_principal,
          galeria_imagenes: producto.galeria_imagenes,
          empresa: producto.empresa,
          stock_total: Number(producto.stock_total),
          numero_resenas: Number(producto.numero_resenas),
          categorias: producto.categorias,
          resenas: resenasResult.rows.map((resena) => ({
            id: resena.id,
            calificacion: Number(resena.calificacion),
            comentario: resena.comentario,
            compra_verificada: resena.compra_verificada,
            fecha_creacion: resena.fecha_creacion,
            usuario: {
              id: resena.id_usuario,
              nombre: resena.usuario,
            },
          })),
        },
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ mensaje: "Error al obtener detalle del producto" });
    }
  });

  // Consultar detalle de un servicio
  router.get("/comprador/servicios/:idServicio", async (req, res) => {
    const idServicio = Number(req.params.idServicio);

    if (!Number.isInteger(idServicio) || idServicio <= 0) {
      return res.status(400).json({ mensaje: "idServicio invalido" });
    }

    try {
      const servicioResult = await pool.query(
        `SELECT
           s.id,
           s.nombre,
           s.descripcion,
           s.calificacion,
           s.precio_base AS precio_original,
           CASE
             WHEN d.id IS NOT NULL
               AND d.codigo_cupon IS NULL
               AND CURRENT_TIMESTAMP BETWEEN d.fecha_inicio AND d.fecha_fin
             THEN ROUND((s.precio_base * (1 - (d.porcentaje_descuento / 100)))::numeric, 2)
             ELSE s.precio_base
           END AS precio,
           CASE
             WHEN d.id IS NOT NULL
               AND d.codigo_cupon IS NULL
               AND CURRENT_TIMESTAMP BETWEEN d.fecha_inicio AND d.fecha_fin
             THEN d.porcentaje_descuento
             ELSE NULL
           END AS porcentaje_descuento,
           s.duracion_minutos,
           s.fecha_registro,
           img.url_imagen AS imagen_principal,
           COALESCE(
             (
               SELECT json_agg(
                 json_build_object(
                   'id', si.id,
                   'url_imagen', si.url_imagen,
                   'es_principal', si.es_principal,
                   'orden_visual', si.orden_visual
                 )
                 ORDER BY si.es_principal DESC, si.orden_visual ASC, si.id ASC
               )
               FROM servicio_imagenes si
               WHERE si.id_servicio = s.id
             ),
             '[]'::json
           ) AS galeria_imagenes,
           COALESCE(n.nombre_comercial, '') AS empresa,
           COALESCE(
             (
               SELECT COUNT(*)
               FROM resenas r
               WHERE r.id_servicio = s.id
             ),
             0
           ) AS numero_resenas
         FROM servicios s
         LEFT JOIN negocios n ON n.id = s.id_negocio
         LEFT JOIN descuentos d ON d.id = s.id_descuento
         LEFT JOIN LATERAL (
           SELECT img_sub.url_imagen
           FROM servicio_imagenes img_sub
           WHERE img_sub.id_servicio = s.id
           ORDER BY img_sub.es_principal DESC, img_sub.orden_visual ASC, img_sub.id ASC
           LIMIT 1
         ) img ON TRUE
         WHERE s.id = $1
           AND s.esta_activo = TRUE
         LIMIT 1`,
        [idServicio]
      );

      if (servicioResult.rows.length === 0) {
        return res.status(404).json({ mensaje: "Servicio no encontrado" });
      }

      const agendaResult = await pool.query(
        `SELECT
           ag.id,
           ag.fecha_hora_inicio,
           ag.fecha_hora_fin,
           ag.estado,
           n.nombre_comercial,
           d.calle,
           d.ciudad,
           d.estado AS estado_direccion,
           d.codigo_postal,
           d.pais
         FROM agenda_servicios ag
         INNER JOIN servicios s ON s.id = ag.id_servicio
         LEFT JOIN negocios n ON n.id = s.id_negocio
         LEFT JOIN direcciones d ON d.id = n.id_direccion
         WHERE ag.id_servicio = $1
           AND ag.estado = 'disponible'
           AND ag.fecha_hora_inicio >= CURRENT_TIMESTAMP
         ORDER BY ag.fecha_hora_inicio ASC`,
        [idServicio]
      );

      const resenasResult = await pool.query(
        `SELECT
           r.id,
           r.calificacion,
           r.comentario,
           r.compra_verificada,
           r.fecha_creacion,
           u.id AS id_usuario,
           u.nombre AS usuario
         FROM resenas r
         INNER JOIN usuarios u ON u.id = r.id_usuario
         WHERE r.id_servicio = $1
         ORDER BY r.fecha_creacion DESC`,
        [idServicio]
      );

      const categoriasResult = await pool.query(
        `SELECT c.nombre_categoria
         FROM servicio_categoria sc
         INNER JOIN categorias c ON c.id = sc.id_categoria
         WHERE sc.id_servicio = $1
         ORDER BY c.nombre_categoria ASC`,
        [idServicio]
      );

      const servicio = servicioResult.rows[0];

      return res.status(200).json({
        servicio: {
          id: servicio.id,
          nombre: servicio.nombre,
          descripcion: servicio.descripcion,
          calificacion: servicio.calificacion !== null ? Number(servicio.calificacion) : null,
          precio: Number(servicio.precio),
          precio_original: Number(servicio.precio_original),
          porcentaje_descuento: servicio.porcentaje_descuento !== null ? Number(servicio.porcentaje_descuento) : null,
          duracion_minutos: servicio.duracion_minutos,
          fecha_registro: servicio.fecha_registro,
          imagen_principal: servicio.imagen_principal,
          galeria_imagenes: servicio.galeria_imagenes,
          empresa: servicio.empresa,
          numero_resenas: Number(servicio.numero_resenas),
          categorias: categoriasResult.rows.map((categoria) => categoria.nombre_categoria),
          agenda_disponible: agendaResult.rows.map((slot) => ({
            id: slot.id,
            id_sucursal: null,
            fecha_hora_inicio: slot.fecha_hora_inicio,
            fecha_hora_fin: slot.fecha_hora_fin,
            estado: slot.estado,
            sucursal: {
              nombre: slot.nombre_comercial,
              direccion: {
                calle: slot.calle,
                ciudad: slot.ciudad,
                estado: slot.estado_direccion,
                codigo_postal: slot.codigo_postal,
                pais: slot.pais,
              },
            },
          })),
          resenas: resenasResult.rows.map((resena) => ({
            id: resena.id,
            calificacion: Number(resena.calificacion),
            comentario: resena.comentario,
            compra_verificada: resena.compra_verificada,
            fecha_creacion: resena.fecha_creacion,
            usuario: {
              id: resena.id_usuario,
              nombre: resena.usuario,
            },
          })),
        },
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ mensaje: "Error al obtener detalle del servicio" });
    }
  });

  return router;
}

module.exports = createCompradorRouter;

const express = require("express");

function createVendedorAgendaRouter({ pool }) {
  const router = express.Router();

  const ESTADOS_BLOQUEANTES = ["disponible", "reservado", "ocupado"];

  const requireVendedorAuth = async (req, res, next) => {
    try {
      const idUsuario = Number(req.session?.usuario_id || 0);
      if (!Number.isInteger(idUsuario) || idUsuario <= 0) {
        return res.status(401).json({ status: "error", mensaje: "Debes iniciar sesion" });
      }

      const result = await pool.query(
        `SELECT u.id, r.nombre_rol
         FROM usuarios u
         JOIN roles r ON r.id = u.id_rol
         WHERE u.id = $1
           AND u.activo = TRUE
           AND u.fecha_eliminacion IS NULL
         LIMIT 1`,
        [idUsuario]
      );

      if (result.rows.length === 0 || String(result.rows[0].nombre_rol || "").toLowerCase() !== "vendedor") {
        return res.status(403).json({ status: "error", mensaje: "Acceso solo para vendedores" });
      }

      req.idUsuario = idUsuario;
      return next();
    } catch (error) {
      console.error("Error al validar vendedor:", error);
      return res.status(500).json({ status: "error", mensaje: "Error al validar sesion" });
    }
  };

  const getNegocioId = async (req, res) => {
    const result = await pool.query(
      `SELECT id
       FROM negocios
       WHERE id_usuario = $1
       LIMIT 1`,
      [req.idUsuario]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ status: "error", mensaje: "No tienes un negocio registrado" });
      return null;
    }

    return Number(result.rows[0].id);
  };

  const parseDateTime = (value) => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const normalizeSlot = (slot) => ({
    id: slot.id,
    id_servicio: slot.id_servicio,
    fecha_hora_inicio: slot.fecha_hora_inicio,
    fecha_hora_fin: slot.fecha_hora_fin,
    estado: slot.estado,
    id_usuario_cliente: slot.id_usuario_cliente,
    cliente: slot.id_usuario_cliente
      ? {
          id: slot.id_usuario_cliente,
          nombre: slot.cliente_nombre,
          email: slot.cliente_email,
        }
      : null,
  });

  const obtenerServicioDelVendedor = async (client, idServicio, negocioId) => {
    const result = await client.query(
      `SELECT id, id_negocio, nombre, duracion_minutos
       FROM servicios
       WHERE id = $1
         AND id_negocio = $2
       LIMIT 1`,
      [idServicio, negocioId]
    );

    return result.rows[0] || null;
  };

  const validarHorario = ({ inicio, fin, duracionMinutos }) => {
    if (!inicio || !fin) {
      return "Fecha y horario invalidos";
    }

    if (inicio <= new Date()) {
      return "El horario debe estar en el futuro";
    }

    if (fin <= inicio) {
      return "La hora de fin debe ser posterior a la hora de inicio";
    }

    if (duracionMinutos) {
      const minutos = Math.round((fin.getTime() - inicio.getTime()) / 60000);
      if (minutos < Number(duracionMinutos)) {
        return `El horario debe cubrir al menos ${duracionMinutos} minutos`;
      }
    }

    return null;
  };

  const hayTraslape = async (client, { negocioId, inicio, fin, excluirAgendaId = null }) => {
    const params = [negocioId, fin, inicio, ESTADOS_BLOQUEANTES];
    let filtroExclusion = "";

    if (excluirAgendaId !== null) {
      params.push(excluirAgendaId);
      filtroExclusion = `AND ag.id <> $${params.length}`;
    }

    const result = await client.query(
      `SELECT ag.id
       FROM agenda_servicios ag
       JOIN servicios s ON s.id = ag.id_servicio
       WHERE s.id_negocio = $1
         AND ag.fecha_hora_inicio < $2
         AND ag.fecha_hora_fin > $3
         AND LOWER(COALESCE(ag.estado, '')) = ANY($4::text[])
         ${filtroExclusion}
       LIMIT 1`,
      params
    );

    return result.rows.length > 0;
  };

  router.get("/api/vendedor/servicios/:idServicio/agenda", requireVendedorAuth, async (req, res) => {
    const idServicio = Number(req.params.idServicio);
    if (!Number.isInteger(idServicio) || idServicio <= 0) {
      return res.status(400).json({ status: "error", mensaje: "idServicio invalido" });
    }

    const negocioId = await getNegocioId(req, res);
    if (negocioId === null) return;

    try {
      const servicio = await obtenerServicioDelVendedor(pool, idServicio, negocioId);
      if (!servicio) {
        return res.status(404).json({ status: "error", mensaje: "Servicio no encontrado" });
      }

      const result = await pool.query(
        `SELECT
           ag.id,
           ag.id_servicio,
           ag.fecha_hora_inicio,
           ag.fecha_hora_fin,
           ag.estado,
           ag.id_usuario_cliente,
           u.nombre AS cliente_nombre,
           u.email AS cliente_email
         FROM agenda_servicios ag
         LEFT JOIN usuarios u ON u.id = ag.id_usuario_cliente
         WHERE ag.id_servicio = $1
         ORDER BY ag.fecha_hora_inicio ASC, ag.id ASC`,
        [idServicio]
      );

      return res.json({ status: "success", agenda: result.rows.map(normalizeSlot) });
    } catch (error) {
      console.error("Error al obtener agenda:", error);
      return res.status(500).json({ status: "error", mensaje: "Error al obtener agenda" });
    }
  });

  router.post("/api/vendedor/servicios/:idServicio/agenda", requireVendedorAuth, async (req, res) => {
    const idServicio = Number(req.params.idServicio);
    const inicio = parseDateTime(req.body?.fecha_hora_inicio);
    const fin = parseDateTime(req.body?.fecha_hora_fin);

    if (!Number.isInteger(idServicio) || idServicio <= 0) {
      return res.status(400).json({ status: "error", mensaje: "idServicio invalido" });
    }

    const negocioId = await getNegocioId(req, res);
    if (negocioId === null) return;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const servicio = await obtenerServicioDelVendedor(client, idServicio, negocioId);
      if (!servicio) {
        await client.query("ROLLBACK");
        return res.status(404).json({ status: "error", mensaje: "Servicio no encontrado" });
      }

      const errorHorario = validarHorario({ inicio, fin, duracionMinutos: servicio.duracion_minutos });
      if (errorHorario) {
        await client.query("ROLLBACK");
        return res.status(400).json({ status: "error", mensaje: errorHorario });
      }

      if (await hayTraslape(client, { negocioId, inicio, fin })) {
        await client.query("ROLLBACK");
        return res.status(409).json({ status: "error", mensaje: "Este horario se traslapa con otro horario de tu agenda" });
      }

      const result = await client.query(
        `INSERT INTO agenda_servicios (id_servicio, fecha_hora_inicio, fecha_hora_fin, estado)
         VALUES ($1, $2, $3, 'disponible')
         RETURNING id, id_servicio, fecha_hora_inicio, fecha_hora_fin, estado, id_usuario_cliente`,
        [idServicio, inicio, fin]
      );

      await client.query("COMMIT");
      return res.status(201).json({ status: "success", agenda: normalizeSlot(result.rows[0]) });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Error al crear horario:", error);
      return res.status(500).json({ status: "error", mensaje: "Error al crear horario" });
    } finally {
      client.release();
    }
  });

  router.put("/api/vendedor/agenda/:idAgenda", requireVendedorAuth, async (req, res) => {
    const idAgenda = Number(req.params.idAgenda);
    const inicio = parseDateTime(req.body?.fecha_hora_inicio);
    const fin = parseDateTime(req.body?.fecha_hora_fin);

    if (!Number.isInteger(idAgenda) || idAgenda <= 0) {
      return res.status(400).json({ status: "error", mensaje: "idAgenda invalido" });
    }

    const negocioId = await getNegocioId(req, res);
    if (negocioId === null) return;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const actual = await client.query(
        `SELECT ag.id, ag.id_servicio, ag.estado, s.duracion_minutos
         FROM agenda_servicios ag
         JOIN servicios s ON s.id = ag.id_servicio
         WHERE ag.id = $1
           AND s.id_negocio = $2
         FOR UPDATE`,
        [idAgenda, negocioId]
      );

      if (actual.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ status: "error", mensaje: "Horario no encontrado" });
      }

      if (String(actual.rows[0].estado || "").toLowerCase() !== "disponible") {
        await client.query("ROLLBACK");
        return res.status(409).json({ status: "error", mensaje: "Solo puedes editar horarios disponibles" });
      }

      const errorHorario = validarHorario({ inicio, fin, duracionMinutos: actual.rows[0].duracion_minutos });
      if (errorHorario) {
        await client.query("ROLLBACK");
        return res.status(400).json({ status: "error", mensaje: errorHorario });
      }

      if (await hayTraslape(client, { negocioId, inicio, fin, excluirAgendaId: idAgenda })) {
        await client.query("ROLLBACK");
        return res.status(409).json({ status: "error", mensaje: "Este horario se traslapa con otro horario de tu agenda" });
      }

      const result = await client.query(
        `UPDATE agenda_servicios
         SET fecha_hora_inicio = $1,
             fecha_hora_fin = $2
         WHERE id = $3
         RETURNING id, id_servicio, fecha_hora_inicio, fecha_hora_fin, estado, id_usuario_cliente`,
        [inicio, fin, idAgenda]
      );

      await client.query("COMMIT");
      return res.json({ status: "success", agenda: normalizeSlot(result.rows[0]) });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Error al actualizar horario:", error);
      return res.status(500).json({ status: "error", mensaje: "Error al actualizar horario" });
    } finally {
      client.release();
    }
  });

  router.delete("/api/vendedor/agenda/:idAgenda", requireVendedorAuth, async (req, res) => {
    const idAgenda = Number(req.params.idAgenda);

    if (!Number.isInteger(idAgenda) || idAgenda <= 0) {
      return res.status(400).json({ status: "error", mensaje: "idAgenda invalido" });
    }

    const negocioId = await getNegocioId(req, res);
    if (negocioId === null) return;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const actual = await client.query(
        `SELECT ag.id, ag.estado
         FROM agenda_servicios ag
         JOIN servicios s ON s.id = ag.id_servicio
         WHERE ag.id = $1
           AND s.id_negocio = $2
         FOR UPDATE`,
        [idAgenda, negocioId]
      );

      if (actual.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ status: "error", mensaje: "Horario no encontrado" });
      }

      if (String(actual.rows[0].estado || "").toLowerCase() !== "disponible") {
        await client.query("ROLLBACK");
        return res.status(409).json({ status: "error", mensaje: "No puedes eliminar un horario reservado" });
      }

      await client.query("DELETE FROM agenda_servicios WHERE id = $1", [idAgenda]);
      await client.query("COMMIT");
      return res.json({ status: "success", mensaje: "Horario eliminado" });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Error al eliminar horario:", error);
      return res.status(500).json({ status: "error", mensaje: "Error al eliminar horario" });
    } finally {
      client.release();
    }
  });

  return router;
}

module.exports = createVendedorAgendaRouter;

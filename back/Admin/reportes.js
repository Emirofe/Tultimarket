const express = require("express");
const { intentarEnviarCorreos } = require("./mail");
const { crearNotificacion } = require("../Usuario/notificaciones-helper");

function createAdminReportesRouter({ pool }) {
  const router = express.Router();

  // Valida session admin y asegura que el usuario exista y sea admin en BD.
  async function requireActiveAdminSession(req, res) {
    const usuarioId = Number(req.session?.usuario_id || 0);
    const rol = String(req.session?.rol || "").toLowerCase();

    if (!Number.isInteger(usuarioId) || usuarioId <= 0) {
      res.status(401).json({ status: "error", mensaje: "Debes iniciar sesion" });
      return null;
    }

    if (rol !== "admin") {
      res.status(403).json({ status: "error", mensaje: "No autorizado" });
      return null;
    }

    try {
      const activo = await pool.query(
        `SELECT u.id
         FROM usuarios u
         INNER JOIN roles r ON r.id = u.id_rol
         WHERE u.id = $1
           AND activo = TRUE
           AND fecha_eliminacion IS NULL
           AND LOWER(r.nombre_rol) = 'admin'
         LIMIT 1`,
        [usuarioId]
      );

      if (activo.rows.length === 0) {
        res.status(401).json({ status: "error", mensaje: "Sesion invalida o usuario inactivo" });
        return null;
      }

      return usuarioId;
    } catch (error) {
      console.error(error);
      res.status(500).json({ status: "error", mensaje: "Error al validar sesion" });
      return null;
    }
  }

  // Mapea fila de reporte a objeto legible
  function mapReporteRow(row) {
    return {
      id: row.id,
      id_usuario: row.id_usuario,
      id_usuario_reportante: row.id_usuario,
      reportante: row.reportante_nombre
        ? { id: row.id_usuario, nombre: row.reportante_nombre, email: row.reportante_email }
        : null,
      id_negocio: row.id_negocio,
      negocio: row.nombre_comercial,
      id_usuario_reportado: row.id_usuario_reportado,
      usuario_reportado: row.usuario_reportado_nombre
        ? { id: row.id_usuario_reportado, nombre: row.usuario_reportado_nombre, email: row.usuario_reportado_email }
        : null,
      id_producto: row.id_producto,
      id_servicio: row.id_servicio,
      tipo_objetivo: row.id_producto ? "producto" : "servicio",
      id_objetivo: row.id_producto || row.id_servicio,
      nombre_objetivo: row.nombre_producto || row.nombre_servicio,
      motivo: row.motivo,
      descripcion: row.descripcion,
      estado_reporte: row.estado_reporte,
      fecha_creacion: row.fecha_creacion,
      fecha_resolucion: row.fecha_resolucion,
    };
  }

  const ESTADOS_FINALES = new Set([
    "RESUELTO",
    "DESESTIMADO",
    "ADVERTENCIA_FORMAL",
    "SUSPENSION_TEMPORAL",
    "BLOQUEO_PERMANENTE",
    "CONTENIDO_ELIMINADO",
  ]);

  async function obtenerReporteParaAccion(client, id, bloquear = false) {
    const result = await client.query(
      `SELECT
         r.id,
         r.id_usuario AS id_usuario_reportante,
         r.id_negocio,
         r.id_producto,
         r.id_servicio,
         r.estado_reporte,
         n.id_usuario AS id_usuario_reportado
       FROM reportes r
       INNER JOIN negocios n ON n.id = r.id_negocio
       WHERE r.id = $1
       LIMIT 1
       ${bloquear ? "FOR UPDATE OF r" : ""}`,
      [id]
    );

    return result.rows[0] || null;
  }

  function escapeHtml(valor) {
    return String(valor ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function construirTicketReporte(idReporte) {
    return `RPT-${String(idReporte).padStart(6, "0")}`;
  }

  async function obtenerContextoNotificacionReporte(id) {
    const result = await pool.query(
      `SELECT
         r.id,
         r.id_usuario AS id_usuario_reportante,
         r.id_negocio,
         r.id_producto,
         r.id_servicio,
         r.motivo,
         r.descripcion,
         r.estado_reporte,
         r.fecha_creacion,
         r.fecha_resolucion,
         ur.nombre AS reportante_nombre,
         ur.email AS reportante_email,
         n.nombre_comercial,
         n.id_usuario AS id_usuario_reportado,
         uv.nombre AS usuario_reportado_nombre,
         uv.email AS usuario_reportado_email,
         p.nombre AS nombre_producto,
         s.nombre AS nombre_servicio
       FROM reportes r
       INNER JOIN negocios n ON n.id = r.id_negocio
       INNER JOIN usuarios ur ON ur.id = r.id_usuario
       INNER JOIN usuarios uv ON uv.id = n.id_usuario
       LEFT JOIN productos p ON p.id = r.id_producto
       LEFT JOIN servicios s ON s.id = r.id_servicio
       WHERE r.id = $1
       LIMIT 1`,
      [id]
    );

    return result.rows[0] || null;
  }

  function obtenerTituloAccion(accion) {
    const titulos = {
      RESUELTO: "Reporte resuelto",
      DESESTIMADO: "Reporte desestimado",
      ADVERTENCIA_FORMAL: "Advertencia formal aplicada",
      SUSPENSION_TEMPORAL: "Suspension temporal aplicada",
      BLOQUEO_PERMANENTE: "Bloqueo permanente aplicado",
      CONTENIDO_ELIMINADO: "Contenido eliminado",
    };

    return titulos[accion] || `Reporte actualizado a ${accion}`;
  }

  function debeNotificarReportado(accion) {
    return [
      "ADVERTENCIA_FORMAL",
      "SUSPENSION_TEMPORAL",
      "BLOQUEO_PERMANENTE",
      "CONTENIDO_ELIMINADO",
    ].includes(accion);
  }

  function construirMensajeAccion(contexto, accion, opciones = {}) {
    const ticket = construirTicketReporte(contexto.id);
    const titulo = obtenerTituloAccion(accion);
    const tipoObjetivo = contexto.id_producto ? "Producto" : "Servicio";
    const nombreObjetivo = contexto.nombre_producto || contexto.nombre_servicio || "Sin nombre";
    const razon = String(opciones.razon || "").trim();
    const duracion = String(opciones.duracion || "").trim();
    const lineas = [
      titulo,
      "",
      `Ticket: ${ticket}`,
      `Estado: ${contexto.estado_reporte}`,
      `Negocio: ${contexto.nombre_comercial || "N/D"}`,
      `${tipoObjetivo}: ${nombreObjetivo}`,
      `Motivo del reporte: ${contexto.motivo}`,
      `Descripcion: ${contexto.descripcion || "Sin descripcion"}`,
    ];

    if (razon) lineas.push(`Razon de administracion: ${razon}`);
    if (duracion) lineas.push(`Duracion: ${duracion}`);

    const texto = lineas.join("\n");
    const html =
      `<p><strong>${escapeHtml(titulo)}</strong></p>` +
      `<p><strong>Ticket:</strong> ${escapeHtml(ticket)}</p>` +
      `<p><strong>Estado:</strong> ${escapeHtml(contexto.estado_reporte)}</p>` +
      `<p><strong>Negocio:</strong> ${escapeHtml(contexto.nombre_comercial || "N/D")}</p>` +
      `<p><strong>${escapeHtml(tipoObjetivo)}:</strong> ${escapeHtml(nombreObjetivo)}</p>` +
      `<p><strong>Motivo del reporte:</strong> ${escapeHtml(contexto.motivo)}</p>` +
      `<p><strong>Descripcion:</strong> ${escapeHtml(contexto.descripcion || "Sin descripcion")}</p>` +
      (razon ? `<p><strong>Razon de administracion:</strong> ${escapeHtml(razon)}</p>` : "") +
      (duracion ? `<p><strong>Duracion:</strong> ${escapeHtml(duracion)}</p>` : "");

    return { subject: `[TultiMarket] ${titulo} ${ticket}`, text: texto, html };
  }

  async function notificarAccionReporte(id, accion, opciones = {}) {
    const contexto = await obtenerContextoNotificacionReporte(id);
    if (!contexto) {
      return { total: 0, enviados: 0, fallidos: [], smtp_configurado: false };
    }

    const destinatarios = [contexto.reportante_email];
    if (debeNotificarReportado(accion)) {
      destinatarios.push(contexto.usuario_reportado_email);
    }

    const mensaje = construirMensajeAccion(contexto, accion, opciones);
    return intentarEnviarCorreos({
      to: destinatarios,
      subject: mensaje.subject,
      text: mensaje.text,
      html: mensaje.html,
    });
  }

  async function intentarNotificarAccionReporte(id, accion, opciones = {}) {
    try {
      return await notificarAccionReporte(id, accion, opciones);
    } catch (error) {
      console.error("No se pudo notificar accion de reporte:", error);
      return {
        total: 0,
        enviados: 0,
        fallidos: [{ email: null, error: String(error?.message || error) }],
        smtp_configurado: false,
      };
    }
  }

  function validarReporteProcesable(reporte) {
    const estadoActual = String(reporte.estado_reporte || "").toUpperCase();
    if (ESTADOS_FINALES.has(estadoActual)) {
      const error = new Error(`El reporte ya fue procesado con estado ${estadoActual}`);
      error.statusCode = 409;
      throw error;
    }
  }

  // Lista todos los reportes (admin)
  router.get("/admin/reportes", async (req, res) => {
    const adminId = await requireActiveAdminSession(req, res);
    if (!adminId) return;

    try {
      const result = await pool.query(
        `SELECT
           r.id,
           r.id_usuario,
           r.id_negocio,
           r.id_producto,
           r.id_servicio,
           r.motivo,
           r.descripcion,
           r.estado_reporte,
           r.fecha_creacion,
           r.fecha_resolucion,
           p.nombre AS nombre_producto,
           s.nombre AS nombre_servicio,
           n.nombre_comercial,
           n.id_usuario AS id_usuario_reportado,
           ur.nombre AS reportante_nombre,
           ur.email AS reportante_email,
           uv.nombre AS usuario_reportado_nombre,
           uv.email AS usuario_reportado_email
         FROM reportes r
         LEFT JOIN productos p ON p.id = r.id_producto
         LEFT JOIN servicios s ON s.id = r.id_servicio
         INNER JOIN negocios n ON n.id = r.id_negocio
         INNER JOIN usuarios ur ON ur.id = r.id_usuario
         INNER JOIN usuarios uv ON uv.id = n.id_usuario
         ORDER BY r.fecha_creacion DESC, r.id DESC`
      );

      return res.status(200).json({
        status: "success",
        total: result.rows.length,
        reportes: result.rows.map(mapReporteRow),
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ status: "error", mensaje: "Error al obtener reportes" });
    }
  });

  // Detalle de un reporte
  router.get("/admin/reportes/:id", async (req, res) => {
    const adminId = await requireActiveAdminSession(req, res);
    if (!adminId) return;

    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0)
      return res.status(400).json({ status: "error", mensaje: "id invalido" });

    try {
      const result = await pool.query(
        `SELECT
           r.id,
           r.id_usuario,
           r.id_negocio,
           r.id_producto,
           r.id_servicio,
           r.motivo,
           r.descripcion,
           r.estado_reporte,
           r.fecha_creacion,
           r.fecha_resolucion,
           p.nombre AS nombre_producto,
           s.nombre AS nombre_servicio,
           n.nombre_comercial,
           n.id_usuario AS id_usuario_reportado,
           ur.nombre AS reportante_nombre,
           ur.email AS reportante_email,
           uv.nombre AS usuario_reportado_nombre,
           uv.email AS usuario_reportado_email
         FROM reportes r
         LEFT JOIN productos p ON p.id = r.id_producto
         LEFT JOIN servicios s ON s.id = r.id_servicio
         INNER JOIN negocios n ON n.id = r.id_negocio
         INNER JOIN usuarios ur ON ur.id = r.id_usuario
         INNER JOIN usuarios uv ON uv.id = n.id_usuario
         WHERE r.id = $1
         LIMIT 1`,
        [id]
      );

      if (result.rows.length === 0)
        return res.status(404).json({ status: "error", mensaje: "Reporte no encontrado" });

      return res.status(200).json({ status: "success", reporte: mapReporteRow(result.rows[0]) });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ status: "error", mensaje: "Error al obtener reporte" });
    }
  });

  // Actualizar estado de un reporte (admin) — cambio general de estado
  router.patch("/admin/reportes/:id/estado", async (req, res) => {
    const adminId = await requireActiveAdminSession(req, res);
    if (!adminId) return;

    const id = Number(req.params.id);
    const estado = String(req.body?.estado || "").trim().toUpperCase();
    if (!Number.isInteger(id) || id <= 0)
      return res.status(400).json({ status: "error", mensaje: "id invalido" });
    if (!estado)
      return res.status(400).json({ status: "error", mensaje: "estado es obligatorio" });

    try {
      const result = await pool.query(
        `UPDATE reportes
         SET estado_reporte = $1,
             fecha_resolucion = CASE WHEN $1 = 'RESUELTO' THEN COALESCE(fecha_resolucion, CURRENT_TIMESTAMP) ELSE fecha_resolucion END
         WHERE id = $2
         RETURNING id, estado_reporte, fecha_resolucion`,
        [estado, id]
      );

      if (result.rows.length === 0)
        return res.status(404).json({ status: "error", mensaje: "Reporte no encontrado" });

      const notificacionCorreo = ESTADOS_FINALES.has(estado)
        ? await intentarNotificarAccionReporte(id, estado)
        : { total: 0, enviados: 0, fallidos: [], smtp_configurado: false };

      // Notificación in-app al comprador que creó el reporte (fire-and-forget)
      if (ESTADOS_FINALES.has(estado)) {
        pool.query("SELECT id_usuario FROM reportes WHERE id = $1", [id])
          .then((rptResult) => {
            if (rptResult.rows.length > 0) {
              crearNotificacion(pool, {
                id_usuario: rptResult.rows[0].id_usuario,
                tipo: "reporte_resuelto",
                titulo: "Reporte atendido",
                mensaje: `Tu reporte fue revisado. Estado: ${estado}.`,
                datos_extra: { reporte_id: id, url: "/mis-reportes" },
              });
            }
          }).catch((err) => console.error("[notif] Error:", err.message));
      }

      return res.status(200).json({
        status: "success",
        mensaje: "Estado de reporte actualizado",
        reporte: result.rows[0],
        notificacion_correo: notificacionCorreo,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ status: "error", mensaje: "Error al actualizar reporte" });
    }
  });

  // Eliminar un reporte
  router.delete("/admin/reportes/:id", async (req, res) => {
    const adminId = await requireActiveAdminSession(req, res);
    if (!adminId) return;

    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0)
      return res.status(400).json({ status: "error", mensaje: "id invalido" });

    try {
      const result = await pool.query(
        `DELETE FROM reportes WHERE id = $1 RETURNING id, motivo`,
        [id]
      );
      if (result.rows.length === 0)
        return res.status(404).json({ status: "error", mensaje: "Reporte no encontrado" });

      return res.status(200).json({
        status: "success",
        mensaje: "Reporte eliminado",
        reporte: result.rows[0],
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ status: "error", mensaje: "Error al eliminar reporte" });
    }
  });

  // Desestimar reporte (invalido/sin fundamento)
  router.post("/admin/reportes/:id/desestimar", async (req, res) => {
    const adminId = await requireActiveAdminSession(req, res);
    if (!adminId) return;

    const id = Number(req.params.id);
    const razon = String(req.body?.razon || "").trim();
    if (!Number.isInteger(id) || id <= 0)
      return res.status(400).json({ status: "error", mensaje: "id invalido" });
    if (!razon)
      return res.status(400).json({ status: "error", mensaje: "razon es obligatoria" });

    try {
      const reporteActual = await obtenerReporteParaAccion(pool, id);
      if (!reporteActual)
        return res.status(404).json({ status: "error", mensaje: "Reporte no encontrado" });
      validarReporteProcesable(reporteActual);

      const result = await pool.query(
        `UPDATE reportes
         SET estado_reporte = 'DESESTIMADO',
             fecha_resolucion = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING id, id_usuario, estado_reporte, fecha_resolucion`,
        [id]
      );

      if (result.rows.length === 0)
        return res.status(404).json({ status: "error", mensaje: "Reporte no encontrado" });

      const notificacionCorreo = await intentarNotificarAccionReporte(id, "DESESTIMADO", { razon });

      // Notificación in-app al comprador que creó el reporte
      crearNotificacion(pool, {
        id_usuario: result.rows[0].id_usuario,
        tipo: "reporte_resuelto",
        titulo: "Reporte revisado",
        mensaje: `Tu reporte fue revisado y desestimado.`,
        datos_extra: { reporte_id: id, url: "/mis-reportes" },
      });

      return res.status(200).json({
        status: "success",
        mensaje: "Reporte desestimado",
        accion: "DESESTIMAR",
        razon,
        reporte: result.rows[0],
        notificacion_correo: notificacionCorreo,
      });
    } catch (error) {
      console.error(error);
      if (error.statusCode) {
        return res.status(error.statusCode).json({ status: "error", mensaje: error.message });
      }
      return res.status(500).json({ status: "error", mensaje: "Error al desestimar reporte" });
    }
  });

  // Advertencia formal (queda en historial)
  router.post("/admin/reportes/:id/advertencia", async (req, res) => {
    const adminId = await requireActiveAdminSession(req, res);
    if (!adminId) return;

    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0)
      return res.status(400).json({ status: "error", mensaje: "id invalido" });

    try {
      const reporteActual = await obtenerReporteParaAccion(pool, id);

      if (!reporteActual)
        return res.status(404).json({ status: "error", mensaje: "Reporte no encontrado" });

      validarReporteProcesable(reporteActual);
      const idUsuarioReportado = reporteActual.id_usuario_reportado;

      const updateResult = await pool.query(
        `UPDATE reportes
         SET estado_reporte = 'ADVERTENCIA_FORMAL',
             fecha_resolucion = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING id, id_usuario, estado_reporte, fecha_resolucion`,
        [id]
      );

      const notificacionCorreo = await intentarNotificarAccionReporte(id, "ADVERTENCIA_FORMAL");

      // Notificación in-app al comprador que creó el reporte
      crearNotificacion(pool, {
        id_usuario: reporteActual.id_usuario_reportante,
        tipo: "reporte_resuelto",
        titulo: "Reporte atendido",
        mensaje: `Tu reporte fue atendido. Se emitio una advertencia formal al vendedor.`,
        datos_extra: { reporte_id: id, url: "/mis-reportes" },
      });

      return res.status(200).json({
        status: "success",
        mensaje: "Advertencia formal registrada para el vendedor reportado",
        accion: "ADVERTENCIA_FORMAL",
        usuario_notificado: idUsuarioReportado,
        usuario_reportante: reporteActual.id_usuario_reportante,
        reporte: updateResult.rows[0],
        notificacion_correo: notificacionCorreo,
      });
    } catch (error) {
      console.error(error);
      if (error.statusCode) {
        return res.status(error.statusCode).json({ status: "error", mensaje: error.message });
      }
      return res.status(500).json({ status: "error", mensaje: "Error al registrar advertencia" });
    }
  });

  // Suspensión temporal (desactiva la cuenta; el admin puede reactivarla desde el panel de usuarios)
  router.post("/admin/reportes/:id/suspension", async (req, res) => {
    const adminId = await requireActiveAdminSession(req, res);
    if (!adminId) return;

    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0)
      return res.status(400).json({ status: "error", mensaje: "id invalido" });

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const reporteActual = await obtenerReporteParaAccion(client, id, true);

      if (!reporteActual) {
        await client.query("ROLLBACK");
        return res.status(404).json({ status: "error", mensaje: "Reporte no encontrado" });
      }

      validarReporteProcesable(reporteActual);
      const idUsuarioReportado = reporteActual.id_usuario_reportado;

      // Desactivar la cuenta del vendedor reportado (sin marcarla como eliminada)
      await client.query(
        `UPDATE usuarios SET activo = FALSE WHERE id = $1`,
        [idUsuarioReportado]
      );

      const updateResult = await client.query(
        `UPDATE reportes
         SET estado_reporte = 'SUSPENSION_TEMPORAL',
             fecha_resolucion = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING id, id_usuario, estado_reporte, fecha_resolucion`,
        [id]
      );

      await client.query("COMMIT");

      const notificacionCorreo = await intentarNotificarAccionReporte(id, "SUSPENSION_TEMPORAL", {
        duracion: "Temporal hasta que administracion reactive la cuenta",
      });

      // Notificación in-app al comprador que creó el reporte
      crearNotificacion(pool, {
        id_usuario: reporteActual.id_usuario_reportante,
        tipo: "reporte_resuelto",
        titulo: "Reporte atendido",
        mensaje: `Tu reporte fue atendido. La cuenta del vendedor fue suspendida temporalmente.`,
        datos_extra: { reporte_id: id, url: "/mis-reportes" },
      });

      return res.status(200).json({
        status: "success",
        mensaje: "Cuenta del vendedor suspendida temporalmente",
        accion: "SUSPENSION_TEMPORAL",
        usuario_suspendido: idUsuarioReportado,
        usuario_reportante: reporteActual.id_usuario_reportante,
        reporte: updateResult.rows[0],
        notificacion_correo: notificacionCorreo,
      });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error(error);
      if (error.statusCode) {
        return res.status(error.statusCode).json({ status: "error", mensaje: error.message });
      }
      return res.status(500).json({ status: "error", mensaje: "Error al aplicar suspension" });
    } finally {
      client.release();
    }
  });

  // Bloqueo permanente (cierre cuenta + ban dispositivos)
  router.post("/admin/reportes/:id/bloqueo", async (req, res) => {
    const adminId = await requireActiveAdminSession(req, res);
    if (!adminId) return;

    const id = Number(req.params.id);
    const razon = String(req.body?.razon || "").trim();
    if (!Number.isInteger(id) || id <= 0)
      return res.status(400).json({ status: "error", mensaje: "id invalido" });
    if (!razon)
      return res.status(400).json({ status: "error", mensaje: "razon es obligatoria" });

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const reporteActual = await obtenerReporteParaAccion(client, id, true);

      if (!reporteActual) {
        await client.query("ROLLBACK");
        return res.status(404).json({ status: "error", mensaje: "Reporte no encontrado" });
      }

      validarReporteProcesable(reporteActual);
      const idUsuarioReportado = reporteActual.id_usuario_reportado;

      // Bloquear la cuenta del vendedor reportado permanentemente
      await client.query(
        `UPDATE usuarios SET activo = FALSE, fecha_eliminacion = NOW() WHERE id = $1`,
        [idUsuarioReportado]
      );

      const updateResult = await client.query(
        `UPDATE reportes
         SET estado_reporte = 'BLOQUEO_PERMANENTE',
             fecha_resolucion = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING id, id_usuario, estado_reporte, fecha_resolucion`,
        [id]
      );

      await client.query("COMMIT");

      const notificacionCorreo = await intentarNotificarAccionReporte(id, "BLOQUEO_PERMANENTE", { razon });

      // Notificación in-app al comprador que creó el reporte
      crearNotificacion(pool, {
        id_usuario: reporteActual.id_usuario_reportante,
        tipo: "reporte_resuelto",
        titulo: "Reporte atendido",
        mensaje: `Tu reporte fue atendido. La cuenta del vendedor fue bloqueada permanentemente.`,
        datos_extra: { reporte_id: id, url: "/mis-reportes" },
      });

      return res.status(200).json({
        status: "success",
        mensaje: "Cuenta del vendedor bloqueada permanentemente",
        accion: "BLOQUEO_PERMANENTE",
        usuario_bloqueado: idUsuarioReportado,
        usuario_reportante: reporteActual.id_usuario_reportante,
        razon,
        reporte: updateResult.rows[0],
        notificacion_correo: notificacionCorreo,
      });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error(error);
      if (error.statusCode) {
        return res.status(error.statusCode).json({ status: "error", mensaje: error.message });
      }
      return res.status(500).json({ status: "error", mensaje: "Error al aplicar bloqueo" });
    } finally {
      client.release();
    }
  });

  // Eliminar contenido (sin afectar la cuenta)
  router.post("/admin/reportes/:id/eliminar-contenido", async (req, res) => {
    const adminId = await requireActiveAdminSession(req, res);
    if (!adminId) return;

    const id = Number(req.params.id);
    const razon = String(req.body?.razon || "").trim();
    if (!Number.isInteger(id) || id <= 0)
      return res.status(400).json({ status: "error", mensaje: "id invalido" });
    if (!razon)
      return res.status(400).json({ status: "error", mensaje: "razon es obligatoria" });

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const reporteActual = await obtenerReporteParaAccion(client, id, true);

      if (!reporteActual) {
        await client.query("ROLLBACK");
        return res.status(404).json({ status: "error", mensaje: "Reporte no encontrado" });
      }

      validarReporteProcesable(reporteActual);
      const idUsuarioReportado = reporteActual.id_usuario_reportado;
      const idProducto = reporteActual.id_producto;
      const idServicio = reporteActual.id_servicio;

      const tipo_objetivo = idProducto ? "producto" : "servicio";
      const id_objetivo = idProducto || idServicio;

      // Desactivar el producto o servicio reportado
      if (idProducto) {
        await client.query(
          `UPDATE productos SET esta_activo = FALSE WHERE id = $1`,
          [idProducto]
        );
      } else if (idServicio) {
        await client.query(
          `UPDATE servicios SET esta_activo = FALSE WHERE id = $1`,
          [idServicio]
        );
      }

      const updateResult = await client.query(
        `UPDATE reportes
         SET estado_reporte = 'CONTENIDO_ELIMINADO',
             fecha_resolucion = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING id, id_usuario, estado_reporte, fecha_resolucion`,
        [id]
      );

      await client.query("COMMIT");

      const notificacionCorreo = await intentarNotificarAccionReporte(id, "CONTENIDO_ELIMINADO", { razon });

      // Notificación in-app al comprador que creó el reporte
      crearNotificacion(pool, {
        id_usuario: reporteActual.id_usuario_reportante,
        tipo: "reporte_resuelto",
        titulo: "Reporte atendido",
        mensaje: `Tu reporte fue atendido. El contenido reportado fue retirado de la plataforma.`,
        datos_extra: { reporte_id: id, tipo_objetivo, id_objetivo, url: "/mis-reportes" },
      });

      return res.status(200).json({
        status: "success",
        mensaje: "Contenido eliminado sin afectar la cuenta",
        accion: "CONTENIDO_ELIMINADO",
        usuario: idUsuarioReportado,
        usuario_reportante: reporteActual.id_usuario_reportante,
        tipo_objetivo,
        id_objetivo,
        razon,
        reporte: updateResult.rows[0],
        notificacion_correo: notificacionCorreo,
      });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error(error);
      if (error.statusCode) {
        return res.status(error.statusCode).json({ status: "error", mensaje: error.message });
      }
      return res.status(500).json({ status: "error", mensaje: "Error al eliminar contenido" });
    } finally {
      client.release();
    }
  });

  return router;
}

module.exports = createAdminReportesRouter;

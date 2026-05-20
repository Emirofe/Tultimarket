/**
 * notificaciones.js (Usuario)
 * ─────────────────────────────────────────────────────────────────────────────
 * Router de notificaciones in-app para cualquier usuario autenticado.
 * Endpoints:
 *   GET    /usuario/notificaciones           → Últimas 50 + conteo no leídas
 *   PUT    /usuario/notificaciones/:id/leer  → Marcar una como leída
 *   PUT    /usuario/notificaciones/leer-todas → Marcar todas como leídas
 *   DELETE /usuario/notificaciones/:id       → Eliminar una notificación
 * ─────────────────────────────────────────────────────────────────────────────
 */

const express = require("express");

function createUsuarioNotificacionesRouter({ pool }) {
  const router = express.Router();

  // Middleware: requiere sesión activa (cualquier rol)
  function requireSession(req, res) {
    const userId = Number(req.session?.usuario_id || 0);
    if (!Number.isInteger(userId) || userId <= 0) {
      res.status(401).json({ status: "error", mensaje: "Debes iniciar sesion" });
      return null;
    }
    return userId;
  }

  // ─── GET /usuario/notificaciones ─────────────────────────────────────────
  router.get("/usuario/notificaciones", async (req, res) => {
    const userId = requireSession(req, res);
    if (!userId) return;

    try {
      const [notifResult, countResult] = await Promise.all([
        pool.query(
          `SELECT id, tipo, titulo, mensaje, leida, datos_extra, fecha_creacion
           FROM notificaciones
           WHERE id_usuario = $1
           ORDER BY fecha_creacion DESC
           LIMIT 50`,
          [userId]
        ),
        pool.query(
          `SELECT COUNT(*)::int AS no_leidas
           FROM notificaciones
           WHERE id_usuario = $1 AND leida = FALSE`,
          [userId]
        ),
      ]);

      return res.json({
        status: "success",
        notificaciones: notifResult.rows,
        no_leidas: countResult.rows[0]?.no_leidas || 0,
      });
    } catch (error) {
      console.error("[notificaciones] Error al obtener:", error.message);
      return res.status(500).json({ status: "error", mensaje: "Error al obtener notificaciones" });
    }
  });

  // ─── PUT /usuario/notificaciones/leer-todas ──────────────────────────────
  // NOTA: Esta ruta DEBE ir antes de /:id/leer para que Express no confunda
  // "leer-todas" con un :id
  router.put("/usuario/notificaciones/leer-todas", async (req, res) => {
    const userId = requireSession(req, res);
    if (!userId) return;

    try {
      await pool.query(
        `UPDATE notificaciones SET leida = TRUE
         WHERE id_usuario = $1 AND leida = FALSE`,
        [userId]
      );
      return res.json({ status: "success", mensaje: "Todas las notificaciones marcadas como leidas" });
    } catch (error) {
      console.error("[notificaciones] Error al marcar todas:", error.message);
      return res.status(500).json({ status: "error", mensaje: "Error al actualizar notificaciones" });
    }
  });

  // ─── PUT /usuario/notificaciones/:id/leer ────────────────────────────────
  router.put("/usuario/notificaciones/:id/leer", async (req, res) => {
    const userId = requireSession(req, res);
    if (!userId) return;

    const notifId = Number(req.params.id);
    if (!Number.isInteger(notifId) || notifId <= 0) {
      return res.status(400).json({ status: "error", mensaje: "ID de notificacion invalido" });
    }

    try {
      const result = await pool.query(
        `UPDATE notificaciones SET leida = TRUE
         WHERE id = $1 AND id_usuario = $2
         RETURNING id`,
        [notifId, userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ status: "error", mensaje: "Notificacion no encontrada" });
      }

      return res.json({ status: "success", mensaje: "Notificacion marcada como leida" });
    } catch (error) {
      console.error("[notificaciones] Error al marcar leida:", error.message);
      return res.status(500).json({ status: "error", mensaje: "Error al actualizar notificacion" });
    }
  });

  // ─── DELETE /usuario/notificaciones/:id ──────────────────────────────────
  router.delete("/usuario/notificaciones/:id", async (req, res) => {
    const userId = requireSession(req, res);
    if (!userId) return;

    const notifId = Number(req.params.id);
    if (!Number.isInteger(notifId) || notifId <= 0) {
      return res.status(400).json({ status: "error", mensaje: "ID de notificacion invalido" });
    }

    try {
      const result = await pool.query(
        `DELETE FROM notificaciones WHERE id = $1 AND id_usuario = $2 RETURNING id`,
        [notifId, userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ status: "error", mensaje: "Notificacion no encontrada" });
      }

      return res.json({ status: "success", mensaje: "Notificacion eliminada" });
    } catch (error) {
      console.error("[notificaciones] Error al eliminar:", error.message);
      return res.status(500).json({ status: "error", mensaje: "Error al eliminar notificacion" });
    }
  });

  return router;
}

module.exports = createUsuarioNotificacionesRouter;

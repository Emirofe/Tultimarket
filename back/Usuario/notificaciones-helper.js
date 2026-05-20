/**
 * notificaciones-helper.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Helper reutilizable para crear notificaciones in-app.
 * Cualquier router del backend puede importar estas funciones para
 * insertar notificaciones en la tabla `notificaciones`.
 *
 * Uso:
 *   const { crearNotificacion } = require("./notificaciones-helper");
 *   await crearNotificacion(pool, {
 *     id_usuario: 5,
 *     tipo: "pedido_confirmado",
 *     titulo: "Pedido confirmado",
 *     mensaje: "Tu pedido fue confirmado exitosamente.",
 *     datos_extra: { pedido_id: 42, url: "/mis-compras/42" },
 *   });
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Crea una notificación in-app para un usuario específico.
 * Si falla, loguea el error pero NO lanza excepción (fire-and-forget).
 */
async function crearNotificacion(pool, { id_usuario, tipo, titulo, mensaje, datos_extra = {} }) {
  try {
    await pool.query(
      `INSERT INTO notificaciones (id_usuario, tipo, titulo, mensaje, datos_extra)
       VALUES ($1, $2, $3, $4, $5)`,
      [id_usuario, tipo, titulo, mensaje, JSON.stringify(datos_extra)]
    );
  } catch (error) {
    console.error("[notificaciones-helper] Error al crear notificacion:", error.message);
  }
}

/**
 * Crea notificaciones in-app para múltiples usuarios (misma notificación).
 * Útil para notificaciones masivas del admin.
 */
async function notificarMultiples(pool, idsUsuarios, { tipo, titulo, mensaje, datos_extra = {} }) {
  if (!Array.isArray(idsUsuarios) || idsUsuarios.length === 0) return;

  const ids = [...new Set(idsUsuarios.filter((id) => Number.isInteger(id) && id > 0))];
  if (ids.length === 0) return;

  // Insertar en batch con un solo query
  const valores = [];
  const placeholders = [];
  let idx = 1;
  const extrasJson = JSON.stringify(datos_extra);

  for (const id of ids) {
    placeholders.push(`($${idx}, $${idx + 1}, $${idx + 2}, $${idx + 3}, $${idx + 4})`);
    valores.push(id, tipo, titulo, mensaje, extrasJson);
    idx += 5;
  }

  try {
    await pool.query(
      `INSERT INTO notificaciones (id_usuario, tipo, titulo, mensaje, datos_extra)
       VALUES ${placeholders.join(", ")}`,
      valores
    );
  } catch (error) {
    console.error("[notificaciones-helper] Error al notificar multiples:", error.message);
  }
}

module.exports = {
  crearNotificacion,
  notificarMultiples,
};

const express = require("express");
const { esEmailValido, intentarEnviarCorreos, normalizarEmail } = require("./mail");

function createAdminNotificacionesRouter({ pool }) {
	const router = express.Router();
	const LIMITE_DESTINATARIOS = 200;

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
				   AND u.activo = TRUE
				   AND u.fecha_eliminacion IS NULL
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

	function normalizarRolFiltro(valor) {
		const rol = String(valor || "").trim().toLowerCase();
		if (["cliente", "comprador"].includes(rol)) return "cliente";
		if (rol === "vendedor") return "vendedor";
		if (rol === "admin") return "admin";
		return null;
	}

	async function obtenerDestinatarios(body) {
		const usarTodos =
			body?.todos === true ||
			String(body?.destinatarios || "").trim().toLowerCase() === "todos";
		const rolFiltro = normalizarRolFiltro(body?.rol || body?.destinatarios);
		const idsUsuarios = Array.isArray(body?.ids_usuarios)
			? body.ids_usuarios
					.map((value) => Number(value))
					.filter((value) => Number.isInteger(value) && value > 0)
			: [];
		const correosManual = Array.isArray(body?.correos)
			? body.correos.map(normalizarEmail).filter(esEmailValido)
			: [];

		if (usarTodos || rolFiltro || idsUsuarios.length > 0) {
			const valores = [];
			const filtros = [
				"u.activo = TRUE",
				"u.fecha_eliminacion IS NULL",
				"u.email IS NOT NULL",
				"TRIM(u.email) <> ''",
			];

			if (rolFiltro) {
				valores.push(rolFiltro);
				filtros.push(`LOWER(r.nombre_rol) = $${valores.length}`);
			}

			if (!usarTodos && idsUsuarios.length > 0) {
				valores.push(idsUsuarios);
				filtros.push(`u.id = ANY($${valores.length}::int[])`);
			}

			const result = await pool.query(
				`SELECT u.id, u.nombre, u.email, COALESCE(r.nombre_rol, '') AS rol
				 FROM usuarios u
				 LEFT JOIN roles r ON r.id = u.id_rol
				 WHERE ${filtros.join(" AND ")}
				 ORDER BY u.id ASC
				 LIMIT ${LIMITE_DESTINATARIOS}`,
				valores
			);

			return result.rows.map((row) => ({
				id: row.id,
				nombre: row.nombre,
				email: normalizarEmail(row.email),
				rol: row.rol,
			}));
		}

		if (correosManual.length > 0) {
			return [...new Set(correosManual)].slice(0, LIMITE_DESTINATARIOS).map((email) => ({
				id: null,
				nombre: null,
				email,
				rol: "manual",
			}));
		}

		const error = new Error("Debes enviar destinatarios='todos', rol, ids_usuarios o correos");
		error.statusCode = 400;
		throw error;
	}

	router.get("/admin/notificaciones/destinatarios", async (req, res) => {
		const adminId = await requireActiveAdminSession(req, res);
		if (!adminId) return;

		const rolFiltro = normalizarRolFiltro(req.query?.rol);
		const busqueda = String(req.query?.q || "").trim();
		const valores = [];
		const filtros = [
			"u.activo = TRUE",
			"u.fecha_eliminacion IS NULL",
			"u.email IS NOT NULL",
			"TRIM(u.email) <> ''",
		];

		if (rolFiltro) {
			valores.push(rolFiltro);
			filtros.push(`LOWER(r.nombre_rol) = $${valores.length}`);
		}

		if (busqueda) {
			valores.push(`%${busqueda}%`);
			filtros.push(`(u.nombre ILIKE $${valores.length} OR u.email ILIKE $${valores.length})`);
		}

		try {
			const result = await pool.query(
				`SELECT u.id, u.nombre, u.email, COALESCE(r.nombre_rol, '') AS rol
				 FROM usuarios u
				 LEFT JOIN roles r ON r.id = u.id_rol
				 WHERE ${filtros.join(" AND ")}
				 ORDER BY u.id ASC
				 LIMIT ${LIMITE_DESTINATARIOS}`,
				valores
			);

			return res.status(200).json({
				status: "success",
				total: result.rows.length,
				destinatarios: result.rows.map((row) => ({
					id: row.id,
					nombre: row.nombre,
					email: row.email,
					rol: row.rol,
				})),
			});
		} catch (error) {
			console.error(error);
			return res.status(500).json({ status: "error", mensaje: "Error al obtener destinatarios" });
		}
	});

	router.post("/admin/notificaciones/enviar", async (req, res) => {
		const adminId = await requireActiveAdminSession(req, res);
		if (!adminId) return;

		const asunto = String(req.body?.asunto || "").trim();
		const mensaje = String(req.body?.mensaje || "").trim();

		if (!asunto || !mensaje) {
			return res.status(400).json({ status: "error", mensaje: "asunto y mensaje son obligatorios" });
		}

		if (asunto.length > 180 || mensaje.length > 5000) {
			return res.status(400).json({ status: "error", mensaje: "asunto o mensaje demasiado largo" });
		}

		try {
			const destinatarios = await obtenerDestinatarios(req.body);
			if (destinatarios.length === 0) {
				return res.status(404).json({ status: "error", mensaje: "No se encontraron destinatarios validos" });
			}

			const notificacionCorreo = await intentarEnviarCorreos({
				to: destinatarios.map((destinatario) => destinatario.email),
				subject: asunto,
				text: mensaje,
			});

			return res.status(200).json({
				status: "success",
				mensaje: "Proceso de notificacion completado",
				resumen: {
					total_destinatarios: notificacionCorreo.total,
					enviados: notificacionCorreo.enviados,
					fallidos: notificacionCorreo.fallidos.length,
					smtp_configurado: notificacionCorreo.smtp_configurado,
				},
				fallidos: notificacionCorreo.fallidos,
			});
		} catch (error) {
			console.error(error);
			const statusCode = Number(error.statusCode || 500);
			return res.status(statusCode).json({
				status: "error",
				mensaje: statusCode === 500 ? "Error al enviar notificaciones" : error.message,
			});
		}
	});

	return router;
}

module.exports = createAdminNotificacionesRouter;

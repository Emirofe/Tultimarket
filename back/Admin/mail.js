function normalizarEmail(email) {
	return String(email || "").trim().toLowerCase();
}

function esEmailValido(email) {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizarEmail(email));
}

function obtenerConfigSMTP() {
	const host = String(process.env.SMTP_HOST || "").trim();
	const port = Number(process.env.SMTP_PORT || 587);
	const user = String(process.env.SMTP_USER || "").trim();
	const pass = String(process.env.SMTP_PASS || "").trim();
	const from = String(process.env.SMTP_FROM || user).trim();
	const secure = String(process.env.SMTP_SECURE || "false").toLowerCase() === "true";
	const faltantes = [];

	if (!host) faltantes.push("SMTP_HOST");
	if (!Number.isInteger(port) || port <= 0) faltantes.push("SMTP_PORT");
	if (!user) faltantes.push("SMTP_USER");
	if (!pass) faltantes.push("SMTP_PASS");

	return {
		configurado: faltantes.length === 0,
		faltantes,
		host,
		port,
		user,
		pass,
		from,
		secure,
	};
}

function cargarNodemailer() {
	try {
		return require("nodemailer");
	} catch (error) {
		const moduleError = new Error(
			"No se pudo cargar nodemailer. Ejecuta npm install en la carpeta back."
		);
		moduleError.code = "NODEMAILER_MISSING";
		throw moduleError;
	}
}

function crearTransporter() {
	const config = obtenerConfigSMTP();
	if (!config.configurado) {
		const error = new Error(`SMTP no configurado. Faltan: ${config.faltantes.join(", ")}`);
		error.code = "SMTP_NOT_CONFIGURED";
		error.faltantes = config.faltantes;
		throw error;
	}

	const nodemailer = cargarNodemailer();
	return {
		from: config.from,
		transporter: nodemailer.createTransport({
			host: config.host,
			port: config.port,
			secure: config.secure,
			auth: {
				user: config.user,
				pass: config.pass,
			},
		}),
	};
}

function destinatariosUnicos(destinatarios) {
	const emails = Array.isArray(destinatarios) ? destinatarios : [destinatarios];
	return [...new Set(emails.map(normalizarEmail).filter(esEmailValido))];
}

function resumenFallido(destinatarios, error) {
	const emails = destinatariosUnicos(destinatarios);
	const mensaje = String(error?.message || error || "Error al enviar correo");

	return {
		total: emails.length,
		enviados: 0,
		fallidos: emails.map((email) => ({ email, error: mensaje })),
		smtp_configurado: obtenerConfigSMTP().configurado,
	};
}

async function enviarCorreo({ to, subject, text, html }) {
	const emails = destinatariosUnicos(to);
	if (emails.length === 0) {
		throw new Error("No hay destinatarios validos para enviar correo");
	}

	const smtp = crearTransporter();
	return smtp.transporter.sendMail({
		from: smtp.from,
		to: emails.join(", "),
		subject,
		text,
		html: html || text,
	});
}

async function intentarEnviarCorreos({ to, subject, text, html }) {
	const emails = destinatariosUnicos(to);
	if (emails.length === 0) {
		return {
			total: 0,
			enviados: 0,
			fallidos: [],
			smtp_configurado: obtenerConfigSMTP().configurado,
		};
	}

	let smtp;
	try {
		smtp = crearTransporter();
	} catch (error) {
		return resumenFallido(emails, error);
	}

	const resultados = await Promise.allSettled(
		emails.map((email) =>
			smtp.transporter.sendMail({
				from: smtp.from,
				to: email,
				subject,
				text,
				html: html || text,
			})
		)
	);

	const fallidos = resultados
		.map((resultado, index) => ({ resultado, email: emails[index] }))
		.filter(({ resultado }) => resultado.status === "rejected")
		.map(({ resultado, email }) => ({
			email,
			error: String(resultado.reason?.message || resultado.reason || "Error al enviar correo"),
		}));

	return {
		total: emails.length,
		enviados: emails.length - fallidos.length,
		fallidos,
		smtp_configurado: obtenerConfigSMTP().configurado,
	};
}

module.exports = {
	crearTransporter,
	enviarCorreo,
	esEmailValido,
	intentarEnviarCorreos,
	normalizarEmail,
	obtenerConfigSMTP,
};

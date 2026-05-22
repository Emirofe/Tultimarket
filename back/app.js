const express = require("express");
const cors = require("cors");
const session = require("express-session");
const path = require("path");
const multer = require("multer");
const { Pool } = require("pg");
const fs = require("fs");
const createLoginRouter = require("./Login/APIs");
const createAdminRouter = require("./Admin/routes");
const createAdminReportesRouter = require("./Admin/reportes");
const createAdminNotificacionesRouter = require("./Admin/notificaciones");
const createVendedorRouter = require("./Vendedor/CRUD");
const createVendedorOrdersRouter = require("./Vendedor/Pedidos");
const createCompradorRouter = require("./Comprador/productos");
const createCompradorCuentaRouter = require("./Usuario/cuenta");
const createCompradorCarritoRouter = require("./Comprador/carrito");
const createCompradorPedidosRouter = require("./Comprador/pedidos");
const createCompradorReportesRouter = require("./Comprador/reportes");
const createUsuarioWishlistRouter = require("./Usuario/wishlist");
const createUsuarioNotificacionesRouter = require("./Usuario/notificaciones");
const createVendedorBusinessRouter = require("./Vendedor/Negocio");
const createVendedorDescuentosRouter = require("./Vendedor/Descuentos");
const createVendedorAgendaRouter = require("./Vendedor/Agenda");
const createIARouter = require("./IA/routes");


const app = express();

const corsOrigins = String(process.env.CORS_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const isProduction = process.env.NODE_ENV === "production";
const sessionSecret = process.env.SESSION_SECRET || "clave_super_secreta_tultimarket";

if (isProduction) {
  app.set("trust proxy", 1);
}

if (isProduction && !process.env.SESSION_SECRET) {
  console.warn("SESSION_SECRET no esta configurado. Define uno propio en Azure.");
}

// ── CORS: permite peticiones del frontend local o del dominio configurado ──
app.use(
  cors({
    origin: corsOrigins.length > 0 ? corsOrigins : true,
    credentials: true, // necesario para que las cookies de sesión funcionen
  })
);

// Configuración
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("static"));

app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE
        ? process.env.COOKIE_SECURE === "true"
        : isProduction,
      sameSite: process.env.COOKIE_SAMESITE || (isProduction ? "none" : "lax"),
      maxAge: 1000 * 60 * 60 * 8, // 8 horas de sesión
    },
  })
);

// PostgreSQL conexión
const dbConfig = process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL }
  : {
      user: process.env.PGUSER || "postgres",
      host: process.env.PGHOST || "localhost",
      database: process.env.PGDATABASE || "senora_chela",
      password: process.env.PGPASSWORD || "hola",
      port: Number(process.env.PGPORT || 5432),
    };

if (process.env.PGSSL === "true" || process.env.PGSSLMODE === "require") {
  dbConfig.ssl = { rejectUnauthorized: false };
}

const pool = new Pool(dbConfig);

// Carpeta de imágenes
const uploadFolder = process.env.UPLOAD_DIR || path.join("static", "images", "products");

if (!fs.existsSync(uploadFolder)) {
  fs.mkdirSync(uploadFolder, { recursive: true });
}

// Configuración de subida de imágenes
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadFolder);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", database: "ok" });
  } catch (error) {
    res.status(503).json({ status: "error", database: "error", details: error.message });
  }
});

// Obtener productos
async function obtenerProductos() {
  const result = await pool.query("SELECT * FROM Productos");
  return result.rows;
}

// Obtener categorías
async function obtenerCategorias() {
  const result = await pool.query(
    "SELECT DISTINCT categoria FROM Productos"
  );
  return result.rows.map((c) => c.categoria);
}

app.use(
  createLoginRouter({
    pool,
  })
);

app.use(
  createAdminRouter({
    pool,
    upload,
    obtenerProductos,
  })
);

app.use(
  createAdminReportesRouter({
    pool,
  })
);

app.use(
  createAdminNotificacionesRouter({
    pool,
  })
);

app.use(
  createCompradorRouter({
    pool,
  })
);

app.use(
  createCompradorCuentaRouter({
    pool,
  })
);

app.use(
  createCompradorCarritoRouter({
    pool,
  })
);

app.use(
  createCompradorPedidosRouter({
    pool,
  })
);

app.use(
  createCompradorReportesRouter({
    pool,
  })
);

app.use(
  createUsuarioWishlistRouter({
    pool,
  })
);

app.use(
  createUsuarioNotificacionesRouter({
    pool,
  })
);

app.use(
  createIARouter({
    pool,
  })
);

app.use(
  createVendedorRouter({
    pool,
  })
);

app.use(
  createVendedorOrdersRouter({
    pool,
  })
);

app.use(
  createVendedorBusinessRouter({
    pool,
  })
);

app.use(
  createVendedorDescuentosRouter({
    pool,
  })
);

app.use(
  createVendedorAgendaRouter({
    pool,
  })
);

const PORT = Number(process.env.PORT || 3000);

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});

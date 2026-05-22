const express = require("express");
const axios = require("axios");

const IA_BASE_URL = process.env.IA_BASE_URL || "http://127.0.0.1:8000";
const AXIOS_TIMEOUT = Number(process.env.IA_TIMEOUT_MS || 30_000);

const PROMPT_STOPWORDS = new Set([
    "para", "con", "una", "uno", "unos", "unas", "que", "quiero", "necesito",
    "busco", "evento", "fiesta", "personas", "invitados", "invitadas", "de",
    "la", "el", "los", "las", "del", "por", "mis", "mi", "en", "y", "o"
]);

function getPromptKeywords(prompt) {
    const normalized = String(prompt || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

    const words = normalized.match(/[a-z0-9]+/g) || [];
    const keywords = words.filter((word) => word.length >= 3 && !PROMPT_STOPWORDS.has(word));

    return [...new Set(keywords)].slice(0, 8);
}

function buildSearchCondition(alias, negocioAlias, categoryTable, itemColumn, keywords, params) {
    if (keywords.length === 0) return "";

    const parts = keywords.map((keyword) => {
        params.push(`%${keyword}%`);
        const placeholder = `$${params.length}`;

        return `(
            ${alias}.nombre ILIKE ${placeholder}
            OR COALESCE(${alias}.descripcion, '') ILIKE ${placeholder}
            OR COALESCE(${negocioAlias}.nombre_comercial, '') ILIKE ${placeholder}
            OR EXISTS (
                SELECT 1
                FROM ${categoryTable} rel
                INNER JOIN categorias c2 ON c2.id = rel.id_categoria
                WHERE rel.${itemColumn} = ${alias}.id
                  AND c2.nombre_categoria ILIKE ${placeholder}
            )
        )`;
    });

    return `AND (${parts.join(" OR ")})`;
}

function mapFallbackItem(row) {
    const price = Number(row.precio_final ?? row.precio_unitario ?? 0);
    const quantity = Number(row.cantidad_sugerida || 1);
    const category = Array.isArray(row.categorias) && row.categorias.length > 0
        ? row.categorias[0]
        : "Resultados relacionados";

    return {
        id: row.item_id,
        item_id: row.item_id,
        nombre: row.nombre,
        negocio: row.nombre_negocio,
        nombre_negocio: row.nombre_negocio,
        tipo: row.tipo,
        cantidad: quantity,
        cantidad_sugerida: quantity,
        razon: "Resultado relacionado con tu busqueda",
        razon_cantidad: "Resultado relacionado con tu busqueda",
        categoria_principal: category,
        precio_unitario: price,
        precio_final: price,
        precio_total: Number(row.precio_total ?? price * quantity),
        calificacion: Number(row.calificacion || 0),
        descuento_porcentaje: null,
        imagen_principal: row.imagen_principal || null,
        stock: row.stock ?? null,
    };
}

async function getPromptFallback(pool, prompt) {
    if (!pool) return null;

    const keywords = getPromptKeywords(prompt);
    const productParams = [];
    const serviceParams = [];
    const productSearch = buildSearchCondition(
        "p",
        "n",
        "producto_categoria",
        "id_producto",
        keywords,
        productParams
    );
    const serviceSearch = buildSearchCondition(
        "s",
        "n",
        "servicio_categoria",
        "id_servicio",
        keywords,
        serviceParams
    );

    const productLimit = 16;
    const serviceLimit = 8;
    productParams.push(productLimit);
    serviceParams.push(serviceLimit);

    const productQuery = `
        SELECT
            CONCAT('P-', p.id) AS item_id,
            'producto' AS tipo,
            p.nombre,
            COALESCE(n.nombre_comercial, 'Proveedor recomendado') AS nombre_negocio,
            COALESCE(p.calificacion, 0) AS calificacion,
            p.precio AS precio_unitario,
            p.precio AS precio_final,
            p.precio AS precio_total,
            p.stock_total AS stock,
            pi.url_imagen AS imagen_principal,
            COALESCE(
                ARRAY_AGG(DISTINCT c.nombre_categoria) FILTER (WHERE c.nombre_categoria IS NOT NULL),
                ARRAY[]::text[]
            ) AS categorias
        FROM productos p
        JOIN negocios n ON n.id = p.id_negocio
        LEFT JOIN producto_imagenes pi ON pi.id_producto = p.id AND pi.es_principal = TRUE
        LEFT JOIN producto_categoria pc ON pc.id_producto = p.id
        LEFT JOIN categorias c ON c.id = pc.id_categoria
        WHERE p.esta_activo = TRUE
          AND p.stock_total > 0
          ${productSearch}
        GROUP BY p.id, p.nombre, p.calificacion, p.precio, p.stock_total, pi.url_imagen, n.nombre_comercial
        ORDER BY p.calificacion DESC NULLS LAST, p.fecha_registro DESC
        LIMIT $${productParams.length}
    `;

    const serviceQuery = `
        SELECT
            CONCAT('S-', s.id) AS item_id,
            'servicio' AS tipo,
            s.nombre,
            COALESCE(n.nombre_comercial, 'Proveedor recomendado') AS nombre_negocio,
            COALESCE(s.calificacion, 0) AS calificacion,
            s.precio_base AS precio_unitario,
            s.precio_base AS precio_final,
            s.precio_base AS precio_total,
            NULL::integer AS stock,
            si.url_imagen AS imagen_principal,
            COALESCE(
                ARRAY_AGG(DISTINCT c.nombre_categoria) FILTER (WHERE c.nombre_categoria IS NOT NULL),
                ARRAY[]::text[]
            ) AS categorias
        FROM servicios s
        JOIN negocios n ON n.id = s.id_negocio
        LEFT JOIN servicio_imagenes si ON si.id_servicio = s.id AND si.es_principal = TRUE
        LEFT JOIN servicio_categoria sc ON sc.id_servicio = s.id
        LEFT JOIN categorias c ON c.id = sc.id_categoria
        WHERE s.esta_activo = TRUE
          ${serviceSearch}
        GROUP BY s.id, s.nombre, s.calificacion, s.precio_base, si.url_imagen, n.nombre_comercial
        ORDER BY s.calificacion DESC NULLS LAST, s.fecha_registro DESC
        LIMIT $${serviceParams.length}
    `;

    const [productsResult, servicesResult] = await Promise.all([
        pool.query(productQuery, productParams),
        pool.query(serviceQuery, serviceParams),
    ]);

    const items = [...productsResult.rows, ...servicesResult.rows].map(mapFallbackItem);
    const presupuesto = items.reduce((sum, item) => sum + Number(item.precio_total || 0), 0);

    return {
        prompt_original: prompt,
        evento: "busqueda",
        personas: 10,
        presupuesto_total: presupuesto,
        latencia_ms: 0,
        subcatalogos: [
            {
                nombre: keywords.length > 0 ? "Resultados relacionados" : "Productos destacados",
                presupuesto,
                items,
            },
        ],
        fallback: true,
    };
}

function createIARouter({ pool } = {}) {
    const router = express.Router();

    // ── Motor de Prompt — recomendaciones por texto libre ─────────────
    router.post("/ia/sugerir", async (req, res) => {
        try {
            const { prompt } = req.body;
            const cleanPrompt = String(prompt || "").trim();

            if (!cleanPrompt) {
                return res.status(400).json({ error: "El prompt no puede estar vacio" });
            }

            const response = await axios.post(
                `${IA_BASE_URL}/procesar`,
                { prompt: cleanPrompt },
                { timeout: AXIOS_TIMEOUT }
            );

            res.json(response.data);
        } catch (error) {
            console.error("Error conectando con el motor de IA:", error.message);

            try {
                const fallback = await getPromptFallback(pool, req.body?.prompt);
                if (fallback) {
                    return res.status(200).json(fallback);
                }
            } catch (fallbackError) {
                console.error("Error en fallback de IA:", fallbackError.message);
            }

            res.status(503).json({
                error: "El servicio de IA no esta disponible temporalmente",
                details: error.code === "ECONNABORTED" ? "Timeout" : error.message,
            });
        }
    });

    // ── Recomendador General — carruseles personalizados del home ─────
    router.get("/ia/recomendaciones/home/:id_usuario", async (req, res) => {
        try {
            const { id_usuario } = req.params;
            const limite = req.query.limite || 5;

            const response = await axios.get(
                `${IA_BASE_URL}/recomendaciones/home/${id_usuario}`,
                { params: { limite }, timeout: AXIOS_TIMEOUT }
            );

            res.json(response.data);
        } catch (error) {
            console.error("Error en recomendaciones home:", error.message);
            res.status(500).json({
                error: "El servicio de recomendaciones no está disponible",
                details: error.message
            });
        }
    });

    // ── Health Check del servicio de IA ───────────────────────────────
    router.get("/ia/health", async (req, res) => {
        try {
            const response = await axios.get(`${IA_BASE_URL}/health`);
            res.json(response.data);
        } catch (error) {
            res.status(503).json({
                status: "error",
                motor_prompt: "inactivo",
                recomendador_general: "inactivo",
                details: error.message
            });
        }
    });

    return router;
}

module.exports = createIARouter;

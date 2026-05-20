const express = require("express");
const axios = require("axios");

const IA_BASE_URL = process.env.IA_BASE_URL || "http://127.0.0.1:8000";

function createIARouter() {
    const router = express.Router();

    // ── Motor de Prompt — recomendaciones por texto libre ─────────────
    router.post("/ia/sugerir", async (req, res) => {
        try {
            const { prompt } = req.body;

            const response = await axios.post(`${IA_BASE_URL}/procesar`, {
                prompt: prompt
            });

            res.json(response.data);
        } catch (error) {
            console.error("Error conectando con el motor de IA:", error.message);
            res.status(500).json({ 
                error: "El servicio de IA no está disponible",
                details: error.message 
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
                { params: { limite } }
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

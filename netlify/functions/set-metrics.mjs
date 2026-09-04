import { getStore } from "@netlify/blobs";
import { verificarAuth } from "./auth-utils.mjs";

const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const USUARIO_REGEX = /^[a-zA-Z0-9_-]{3,30}$/;

function json400(msg) {
    return new Response(JSON.stringify({ error: msg }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
    });
}

function json200(data) {
    return new Response(JSON.stringify(data), {
        status: 200,
        headers: { "Content-Type": "application/json" },
    });
}

export default async (req) => {
    if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

    try {
        const body = await req.json();
        const usuario = body?.usuario;
        const authCheck = await verificarAuth(req, usuario);
        if (!authCheck.ok) {
            return new Response(JSON.stringify({ error: authCheck.error }), {
                status: 401,
                headers: { "Content-Type": "application/json" },
            });
        }

        const fecha = body?.fecha;
        if (!usuario || !USUARIO_REGEX.test(usuario)) return json400("Usuario inválido");
        if (!fecha || !FECHA_REGEX.test(fecha)) return json400("Fecha inválida");

        const metricas = {
            peso: typeof body.peso === "number" ? body.peso : null,
            sueno: typeof body.sueno === "number" ? body.sueno : null,
            energia: typeof body.energia === "number" ? body.energia : null,
            pasos: typeof body.pasos === "number" ? body.pasos : null,
            agua: typeof body.agua === "number" ? body.agua : null
        };

        const store = getStore("comidas");
        await store.setJSON(`${usuario}:${fecha}:metricas`, metricas);
        return json200({ success: true, metricas });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message || String(e) }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
};

export const config = { path: "/api/set-metrics" };

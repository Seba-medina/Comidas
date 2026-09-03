import { getStore } from "@netlify/blobs";

const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const USUARIO_REGEX = /^[a-zA-Z0-9_-]{3,30}$/;

function json400(msg) {
    return new Response(JSON.stringify({ error: msg }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
    });
}

export default async (req) => {
    const url = new URL(req.url);
    const usuario = url.searchParams.get("usuario");
    const fecha = url.searchParams.get("fecha");

    if (!usuario || !USUARIO_REGEX.test(usuario)) return json400("Usuario inválido");
    if (!fecha || !FECHA_REGEX.test(fecha)) return json400("Fecha inválida");

    const store = getStore("comidas");
    let metricas = {};
    try {
        const raw = await store.get(`${usuario}:${fecha}:metricas`, { type: "json" });
        if (raw && typeof raw === "object") metricas = raw;
    } catch (err) {
        // vacio si no hay datos
    }

    return new Response(JSON.stringify({ metricas }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
    });
};

export const config = { path: "/api/metrics" };

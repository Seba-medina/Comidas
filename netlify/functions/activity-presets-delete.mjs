import { getStore } from "@netlify/blobs";
import { verificarAuth } from "./auth-utils.mjs";

const USUARIO_REGEX = /^[a-zA-Z0-9_-]{3,30}$/;

function json400(msg) {
  return new Response(JSON.stringify({ error: msg }), {
    status: 400,
    headers: { "Content-Type": "application/json" },
  });
}

export default async (req) => {
  if (req.method !== "POST") {
    return new Response("Método no permitido", { status: 405 });
  }

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
    const texto = body?.texto;

    if (!usuario || !USUARIO_REGEX.test(usuario)) return json400("Usuario inválido");
    if (typeof texto !== "string") return json400("Texto inválido");

    const store = getStore("comidas");
    const key = `${usuario}:presets-actividad`;

    let opciones = [];
    try {
      const raw = await store.get(key, { type: "json" });
      if (Array.isArray(raw)) opciones = raw;
    } catch (e) {
      opciones = [];
    }

    opciones = opciones.filter((t) => t !== texto);
    await store.setJSON(key, opciones);

    return new Response(JSON.stringify({ ok: true, opciones }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const config = { path: "/api/activity-presets-delete" };

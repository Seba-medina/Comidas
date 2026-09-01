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
  if (req.method !== "POST") {
    return new Response("Método no permitido", { status: 405 });
  }

  try {
    const body = await req.json();
    const usuario = body?.usuario;
    const fecha = body?.fecha;
    const id = body?.id;

    if (!usuario || !USUARIO_REGEX.test(usuario)) return json400("Usuario inválido");
    if (!fecha || !FECHA_REGEX.test(fecha)) return json400("Fecha inválida");
    if (!id || typeof id !== "string") return json400("Id inválido");

    const store = getStore("comidas");
    const indexKey = `${usuario}:${fecha}:actividades`;

    let actividades = [];
    try {
      const raw = await store.get(indexKey, { type: "json" });
      if (Array.isArray(raw)) actividades = raw;
    } catch (e) {
      actividades = [];
    }

    const nuevaLista = actividades.filter((a) => a.id !== id);
    await store.setJSON(indexKey, nuevaLista);

    return new Response(JSON.stringify({ ok: true }), {
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

export const config = { path: "/api/activity-delete" };

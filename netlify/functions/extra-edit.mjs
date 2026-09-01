import { getStore } from "@netlify/blobs";

const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const USUARIO_REGEX = /^[a-zA-Z0-9_-]{3,30}$/;
const MAX_LEN = 300;

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
    const desc = body?.desc;

    if (!usuario || !USUARIO_REGEX.test(usuario)) return json400("Usuario inválido");
    if (!fecha || !FECHA_REGEX.test(fecha)) return json400("Fecha inválida");
    if (!id || typeof id !== "string") return json400("Id inválido");
    if (typeof desc !== "string") return json400("Descripción inválida");

    const store = getStore("comidas");
    const indexKey = `${usuario}:${fecha}:extras`;

    let extras = [];
    try {
      const raw = await store.get(indexKey, { type: "json" });
      if (Array.isArray(raw)) extras = raw;
    } catch (e) {
      extras = [];
    }

    const item = extras.find((e) => e.id === id);
    if (!item) return json400("No se encontró esa comida extra");

    item.desc = desc.slice(0, MAX_LEN);
    await store.setJSON(indexKey, extras);

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

export const config = { path: "/api/extra-edit" };

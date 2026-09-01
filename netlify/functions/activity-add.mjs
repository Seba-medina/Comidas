import { getStore } from "@netlify/blobs";

const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const USUARIO_REGEX = /^[a-zA-Z0-9_-]{3,30}$/;
const MAX_TIPO_LEN = 40;
const MAX_NOTA_LEN = 300;
const MAX_ACTIVIDADES_POR_DIA = 20;

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
    let tipo = body?.tipo;
    let nota = body?.nota || "";

    if (!usuario || !USUARIO_REGEX.test(usuario)) return json400("Usuario inválido");
    if (!fecha || !FECHA_REGEX.test(fecha)) return json400("Fecha inválida");
    if (typeof tipo !== "string" || !tipo.trim()) return json400("Escribí qué actividad hiciste");

    tipo = tipo.trim().slice(0, MAX_TIPO_LEN);
    nota = String(nota).trim().slice(0, MAX_NOTA_LEN);

    const store = getStore("comidas");
    const indexKey = `${usuario}:${fecha}:actividades`;

    let actividades = [];
    try {
      const raw = await store.get(indexKey, { type: "json" });
      if (Array.isArray(raw)) actividades = raw;
    } catch (e) {
      actividades = [];
    }

    if (actividades.length >= MAX_ACTIVIDADES_POR_DIA) {
      return json400("Ya hay demasiadas actividades cargadas para este día");
    }

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const nueva = { id, tipo, nota };
    actividades.push(nueva);
    await store.setJSON(indexKey, actividades);

    return new Response(JSON.stringify({ ok: true, actividad: nueva }), {
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

export const config = { path: "/api/activity-add" };

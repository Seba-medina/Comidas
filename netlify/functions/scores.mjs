import { getStore } from "@netlify/blobs";

const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const USUARIO_REGEX = /^[a-zA-Z0-9_-]{3,30}$/;

export default async (req) => {
  const url = new URL(req.url);
  const usuario = url.searchParams.get("usuario");
  const fecha = url.searchParams.get("fecha");

  if (!usuario || !USUARIO_REGEX.test(usuario)) {
    return new Response(JSON.stringify({ error: "Usuario inválido" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (!fecha || !FECHA_REGEX.test(fecha)) {
    return new Response(JSON.stringify({ error: "Fecha inválida" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const store = getStore("comidas");
  let puntajes = {};
  try {
    const raw = await store.get(`${usuario}:${fecha}:puntajes`, { type: "json" });
    if (raw && typeof raw === "object") puntajes = raw;
  } catch (e) {
    puntajes = {};
  }
  if (!puntajes.extras || typeof puntajes.extras !== "object") puntajes.extras = {};

  return new Response(JSON.stringify({ puntajes }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

export const config = { path: "/api/scores" };

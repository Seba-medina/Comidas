import { getStore } from "@netlify/blobs";

const USUARIO_REGEX = /^[a-zA-Z0-9_-]{3,30}$/;

export default async (req) => {
  const url = new URL(req.url);
  const usuario = url.searchParams.get("usuario");

  if (!usuario || !USUARIO_REGEX.test(usuario)) {
    return new Response(JSON.stringify({ error: "Usuario inválido" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const store = getStore("comidas");
  let opciones = [];
  try {
    const raw = await store.get(`${usuario}:presets-actividad`, { type: "json" });
    if (Array.isArray(raw)) opciones = raw;
  } catch (e) {
    opciones = [];
  }

  return new Response(JSON.stringify({ opciones }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

export const config = { path: "/api/activity-presets" };

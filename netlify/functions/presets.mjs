import { getStore } from "@netlify/blobs";

const USUARIO_REGEX = /^[a-zA-Z0-9_-]{3,30}$/;
const COMIDAS_VALIDAS = ["desayuno", "almuerzo", "merienda", "cena"];

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
  let presets = {};
  try {
    const raw = await store.get(`${usuario}:presets`, { type: "json" });
    if (raw && typeof raw === "object") presets = raw;
  } catch (e) {
    presets = {};
  }

  const resultado = {};
  for (const c of COMIDAS_VALIDAS) {
    resultado[c] = Array.isArray(presets[c]) ? presets[c] : [];
  }

  return new Response(JSON.stringify({ presets: resultado }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

export const config = { path: "/api/presets" };

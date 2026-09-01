import { getStore } from "@netlify/blobs";

const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const USUARIO_REGEX = /^[a-zA-Z0-9_-]{3,30}$/;
const COMIDAS_VALIDAS = ["desayuno", "almuerzo", "merienda", "cena"];

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
  let descripciones = {};
  try {
    const raw = await store.get(`${usuario}:${fecha}:descripciones`, { type: "json" });
    if (raw && typeof raw === "object") descripciones = raw;
  } catch (e) {
    descripciones = {};
  }

  const resultado = {};
  for (const c of COMIDAS_VALIDAS) {
    resultado[c] = typeof descripciones[c] === "string" ? descripciones[c] : "";
  }

  return new Response(JSON.stringify({ descripciones: resultado }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

export const config = { path: "/api/descriptions" };

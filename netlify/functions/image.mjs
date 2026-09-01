import { getStore } from "@netlify/blobs";

const COMIDAS_VALIDAS = ["desayuno", "almuerzo", "merienda", "cena"];
const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const USUARIO_REGEX = /^[a-zA-Z0-9_-]{3,30}$/;

export default async (req) => {
  const url = new URL(req.url);
  const usuario = url.searchParams.get("usuario");
  const comida = url.searchParams.get("comida");
  const fecha = url.searchParams.get("fecha");

  if (!usuario || !USUARIO_REGEX.test(usuario)) {
    return new Response("Usuario inválido", { status: 400 });
  }
  if (!COMIDAS_VALIDAS.includes(comida)) {
    return new Response("Comida inválida", { status: 400 });
  }
  if (!fecha || !FECHA_REGEX.test(fecha)) {
    return new Response("Fecha inválida", { status: 400 });
  }

  const store = getStore("comidas");
  const entry = await store.getWithMetadata(`${usuario}:${fecha}:${comida}`, { type: "arrayBuffer" });

  if (!entry) {
    return new Response("Sin foto todavía", { status: 404 });
  }

  const contentType = entry.metadata?.contentType || "image/jpeg";

  return new Response(entry.data, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "no-cache, max-age=0",
    },
  });
};

export const config = { path: "/api/image" };

import { getStore } from "@netlify/blobs";

const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const USUARIO_REGEX = /^[a-zA-Z0-9_-]{3,30}$/;

export default async (req) => {
  const url = new URL(req.url);
  const usuario = url.searchParams.get("usuario");
  const fecha = url.searchParams.get("fecha");
  const id = url.searchParams.get("id");

  if (!usuario || !USUARIO_REGEX.test(usuario)) {
    return new Response("Usuario inválido", { status: 400 });
  }
  if (!fecha || !FECHA_REGEX.test(fecha)) {
    return new Response("Fecha inválida", { status: 400 });
  }
  if (!id) {
    return new Response("Id inválido", { status: 400 });
  }

  const store = getStore("comidas");
  const entry = await store.getWithMetadata(`${usuario}:${fecha}:extra:${id}`, { type: "arrayBuffer" });

  if (!entry) {
    return new Response("Sin foto", { status: 404 });
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

export const config = { path: "/api/extra-image" };

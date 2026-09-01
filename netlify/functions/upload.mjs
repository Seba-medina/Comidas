import { getStore } from "@netlify/blobs";

const COMIDAS_VALIDAS = ["desayuno", "almuerzo", "merienda", "cena"];

export default async (req) => {
  if (req.method !== "POST") {
    return new Response("Método no permitido", { status: 405 });
  }

  try {
    const formData = await req.formData();
    const comida = formData.get("comida");
    const file = formData.get("foto");

    if (!COMIDAS_VALIDAS.includes(comida)) {
      return new Response(JSON.stringify({ error: "Comida inválida" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (!file || typeof file === "string") {
      return new Response(JSON.stringify({ error: "No se recibió ninguna foto" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (!file.type || !file.type.startsWith("image/")) {
      return new Response(JSON.stringify({ error: "El archivo debe ser una imagen" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const buffer = await file.arrayBuffer();
    const store = getStore("comidas");
    await store.set(comida, buffer, {
      metadata: { contentType: file.type },
    });

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

export const config = { path: "/api/upload" };

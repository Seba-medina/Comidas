import { getStore } from "@netlify/blobs";
import { verificarAuth } from "./auth-utils.mjs";

const COMIDAS_VALIDAS = ["desayuno", "almuerzo", "merienda", "cena"];
const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const USUARIO_REGEX = /^[a-zA-Z0-9_-]{3,30}$/;

export default async (req) => {
  if (req.method !== "POST") {
    return new Response("Método no permitido", { status: 405 });
  }

  try {
    const formData = await req.formData();
    const usuario = formData.get("usuario");

    const authCheck = await verificarAuth(req, usuario);
    if (!authCheck.ok) {
      return new Response(JSON.stringify({ error: authCheck.error }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    const comida = formData.get("comida");
    const fecha = formData.get("fecha");
    const file = formData.get("foto");

    if (!usuario || !USUARIO_REGEX.test(usuario)) {
      return new Response(JSON.stringify({ error: "Usuario inválido" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (!COMIDAS_VALIDAS.includes(comida)) {
      return new Response(JSON.stringify({ error: "Comida inválida" }), {
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
    if (!file || typeof file === "string") {
      return new Response(JSON.stringify({ error: "No se recibió ninguna foto" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (!file.type || !(file.type.includes("jpeg") || file.type.includes("jpg") || file.type.includes("png"))) {
      return new Response(JSON.stringify({ error: "Solo se aceptan fotos JPG o PNG (necesario para poder incluirlas en el PDF)" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const buffer = await file.arrayBuffer();
    const store = getStore("comidas");
    const key = `${usuario}:${fecha}:${comida}`;
    await store.set(key, buffer, {
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

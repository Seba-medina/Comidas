import { getStore } from "@netlify/blobs";
import { verificarAuth } from "./auth-utils.mjs";

const COMIDAS_VALIDAS = ["desayuno", "almuerzo", "merienda", "cena"];
const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const USUARIO_REGEX = /^[a-zA-Z0-9_-]{3,30}$/;

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
    const formData = await req.formData();
    const usuario = formData.get("usuario");

    const authCheck = await verificarAuth(req, usuario);
    if (!authCheck.ok) {
      return new Response(JSON.stringify({ error: authCheck.error }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    const fecha = formData.get("fecha");
    const after = formData.get("after");
    let label = formData.get("label") || "";
    let desc = formData.get("desc") || "";
    const file = formData.get("foto");

    if (!usuario || !USUARIO_REGEX.test(usuario)) return json400("Usuario inválido");
    if (!fecha || !FECHA_REGEX.test(fecha)) return json400("Fecha inválida");
    if (!COMIDAS_VALIDAS.includes(after)) return json400("Selección de 'después de' inválida");
    if (!file || typeof file === "string") return json400("No se recibió ninguna foto");
    if (!file.type || !(file.type.includes("jpeg") || file.type.includes("jpg") || file.type.includes("png"))) {
      return json400("Solo se aceptan fotos JPG o PNG");
    }

    label = String(label).slice(0, 40).trim();
    desc = String(desc).slice(0, 300).trim();

    const store = getStore("comidas");
    const indexKey = `${usuario}:${fecha}:extras`;

    let extras = [];
    try {
      const raw = await store.get(indexKey, { type: "json" });
      if (Array.isArray(raw)) extras = raw;
    } catch (e) {
      extras = [];
    }

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const nuevo = { id, after, label, desc };
    extras.push(nuevo);

    const buffer = await file.arrayBuffer();
    await store.set(`${usuario}:${fecha}:extra:${id}`, buffer, {
      metadata: { contentType: file.type },
    });
    await store.setJSON(indexKey, extras);

    return new Response(JSON.stringify({ ok: true, extra: nuevo }), {
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

export const config = { path: "/api/extra-upload" };

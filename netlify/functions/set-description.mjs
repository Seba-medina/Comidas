import { getStore } from "@netlify/blobs";

const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const USUARIO_REGEX = /^[a-zA-Z0-9_-]{3,30}$/;
const COMIDAS_VALIDAS = ["desayuno", "almuerzo", "merienda", "cena"];
const MAX_LEN = 300;

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
    const comida = body?.comida;
    const descripcion = body?.descripcion;

    if (!usuario || !USUARIO_REGEX.test(usuario)) return json400("Usuario inválido");
    if (!fecha || !FECHA_REGEX.test(fecha)) return json400("Fecha inválida");
    if (!COMIDAS_VALIDAS.includes(comida)) return json400("Comida inválida");
    if (typeof descripcion !== "string") return json400("Descripción inválida");

    const texto = descripcion.slice(0, MAX_LEN);

    const store = getStore("comidas");
    const key = `${usuario}:${fecha}:descripciones`;

    let descripciones = {};
    try {
      const raw = await store.get(key, { type: "json" });
      if (raw && typeof raw === "object") descripciones = raw;
    } catch (e) {
      descripciones = {};
    }

    descripciones[comida] = texto;
    await store.setJSON(key, descripciones);

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

export const config = { path: "/api/set-description" };

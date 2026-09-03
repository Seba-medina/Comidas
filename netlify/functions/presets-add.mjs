import { getStore } from "@netlify/blobs";
import { verificarAuth } from "./auth-utils.mjs";

const USUARIO_REGEX = /^[a-zA-Z0-9_-]{3,30}$/;
const COMIDAS_VALIDAS = ["desayuno", "almuerzo", "merienda", "cena"];
const MAX_LEN = 300;
const MAX_OPCIONES = 20;

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

    const authCheck = await verificarAuth(req, usuario);
    if (!authCheck.ok) {
      return new Response(JSON.stringify({ error: authCheck.error }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    const comida = body?.comida;
    let texto = body?.texto;

    if (!usuario || !USUARIO_REGEX.test(usuario)) return json400("Usuario inválido");
    if (!COMIDAS_VALIDAS.includes(comida)) return json400("Comida inválida");
    if (typeof texto !== "string" || !texto.trim()) return json400("Escribí algo antes de guardarlo como opción");

    texto = texto.trim().slice(0, MAX_LEN);

    const store = getStore("comidas");
    const key = `${usuario}:presets`;

    let presets = {};
    try {
      const raw = await store.get(key, { type: "json" });
      if (raw && typeof raw === "object") presets = raw;
    } catch (e) {
      presets = {};
    }

    if (!Array.isArray(presets[comida])) presets[comida] = [];

    const yaExiste = presets[comida].some((t) => t.toLowerCase() === texto.toLowerCase());
    if (!yaExiste) {
      presets[comida].push(texto);
      if (presets[comida].length > MAX_OPCIONES) {
        presets[comida] = presets[comida].slice(presets[comida].length - MAX_OPCIONES);
      }
      await store.setJSON(key, presets);
    }

    return new Response(JSON.stringify({ ok: true, opciones: presets[comida] }), {
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

export const config = { path: "/api/presets-add" };

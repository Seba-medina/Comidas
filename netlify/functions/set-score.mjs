import { getStore } from "@netlify/blobs";
import { verificarAuth } from "./auth-utils.mjs";

const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const USUARIO_REGEX = /^[a-zA-Z0-9_-]{3,30}$/;
const COMIDAS_VALIDAS = ["desayuno", "almuerzo", "merienda", "cena"];

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
    const fecha = body?.fecha;
    const comida = body?.comida; // "desayuno" | "almuerzo" | "merienda" | "cena" | "extra"
    const extraId = body?.extraId; // requerido solo si comida === "extra"
    const score = body?.score; // 0-5 (0 o null = borrar el puntaje)

    if (!usuario || !USUARIO_REGEX.test(usuario)) return json400("Usuario inválido");
    if (!fecha || !FECHA_REGEX.test(fecha)) return json400("Fecha inválida");
    if (comida !== "extra" && !COMIDAS_VALIDAS.includes(comida)) return json400("Comida inválida");
    if (comida === "extra" && (!extraId || typeof extraId !== "string")) return json400("Falta el id de la comida extra");

    const scoreNum = score === null || score === undefined ? 0 : Number(score);
    if (!Number.isInteger(scoreNum) || scoreNum < 0 || scoreNum > 5) return json400("Puntaje inválido (0 a 5)");

    const store = getStore("comidas");
    const key = `${usuario}:${fecha}:puntajes`;

    let puntajes = {};
    try {
      const raw = await store.get(key, { type: "json" });
      if (raw && typeof raw === "object") puntajes = raw;
    } catch (e) {
      puntajes = {};
    }
    if (!puntajes.extras || typeof puntajes.extras !== "object") puntajes.extras = {};

    if (comida === "extra") {
      if (scoreNum === 0) delete puntajes.extras[extraId];
      else puntajes.extras[extraId] = scoreNum;
    } else {
      if (scoreNum === 0) delete puntajes[comida];
      else puntajes[comida] = scoreNum;
    }

    await store.setJSON(key, puntajes);

    return new Response(JSON.stringify({ ok: true, puntajes }), {
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

export const config = { path: "/api/set-score" };

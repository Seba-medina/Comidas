import { getStore } from "@netlify/blobs";

const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const MES_REGEX = /^\d{4}-\d{2}$/;
const USUARIO_REGEX = /^[a-zA-Z0-9_-]{3,30}$/;
const MAX_DIAS_RACHA = 120; // tope para no escanear hacia atrás indefinidamente

function formatFecha(date) {
  return date.toISOString().slice(0, 10);
}
function addDias(date, dias) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + dias);
  return d;
}

// A partir de los puntajes de un día (1-5 por comida/extra), decide el
// "estado" del día: verde = todo lo puntuado quedó en 4 o 5; amarillo = lo
// peor puntuado fue un 3; rojo = hay al menos un 1 o 2; gris = no se
// puntuó ninguna comida ese día.
function estadoDelDia(puntajes) {
  const valores = [];
  for (const c of ["desayuno", "almuerzo", "merienda", "cena"]) {
    if (typeof puntajes?.[c] === "number") valores.push(puntajes[c]);
  }
  if (puntajes?.extras && typeof puntajes.extras === "object") {
    for (const v of Object.values(puntajes.extras)) {
      if (typeof v === "number") valores.push(v);
    }
  }
  if (valores.length === 0) return "gris";
  if (valores.some((v) => v <= 2)) return "rojo";
  if (valores.some((v) => v === 3)) return "amarillo";
  return "verde";
}

async function getPuntajesDia(store, usuario, fechaStr) {
  try {
    const raw = await store.get(`${usuario}:${fechaStr}:puntajes`, { type: "json" });
    if (raw && typeof raw === "object") return raw;
  } catch (e) {
    // sin datos ese día
  }
  return {};
}

export default async (req) => {
  const url = new URL(req.url);
  const usuario = url.searchParams.get("usuario");
  const mes = url.searchParams.get("mes"); // "YYYY-MM", opcional
  const hoyParam = url.searchParams.get("hoy"); // "YYYY-MM-DD", la fecha de "hoy" según el celular del usuario

  if (!usuario || !USUARIO_REGEX.test(usuario)) {
    return new Response(JSON.stringify({ error: "Usuario inválido" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (mes && !MES_REGEX.test(mes)) {
    return new Response(JSON.stringify({ error: "Mes inválido (formato YYYY-MM)" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (hoyParam && !FECHA_REGEX.test(hoyParam)) {
    return new Response(JSON.stringify({ error: "Fecha 'hoy' inválida" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const store = getStore("comidas");

  const hoy = hoyParam ? new Date(`${hoyParam}T00:00:00Z`) : new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z");

  // ---- Racha: días "verdes" consecutivos hacia atrás desde hoy. Un día
  // gris (sin puntuar) no la corta, solo la corta un día amarillo o rojo. ----
  let racha = 0;
  let alcanzoLimite = false;
  let cursor = hoy;
  for (let i = 0; i < MAX_DIAS_RACHA; i++) {
    const fechaStr = formatFecha(cursor);
    const puntajes = await getPuntajesDia(store, usuario, fechaStr);
    const estado = estadoDelDia(puntajes);
    if (estado === "rojo" || estado === "amarillo") break;
    if (estado === "verde") racha++;
    // "gris": no suma ni corta, seguimos para atrás
    cursor = addDias(cursor, -1);
    if (i === MAX_DIAS_RACHA - 1) alcanzoLimite = true;
  }

  // ---- Calendario del mes pedido (o el mes de "hoy" si no se especificó) ----
  const mesStr = mes || formatFecha(hoy).slice(0, 7);
  const [anio, mesNum] = mesStr.split("-").map(Number);
  const primerDia = new Date(Date.UTC(anio, mesNum - 1, 1));
  const ultimoDia = new Date(Date.UTC(anio, mesNum, 0));
  const cantidadDias = ultimoDia.getUTCDate();

  const dias = [];
  for (let d = 1; d <= cantidadDias; d++) {
    const fechaDia = new Date(Date.UTC(anio, mesNum - 1, d));
    const fechaStr = formatFecha(fechaDia);
    const puntajes = await getPuntajesDia(store, usuario, fechaStr);
    dias.push({ fecha: fechaStr, estado: estadoDelDia(puntajes) });
  }

  return new Response(JSON.stringify({ racha, alcanzoLimite, mes: mesStr, dias }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

export const config = { path: "/api/progreso" };

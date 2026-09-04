import { getStore } from "@netlify/blobs";

const USUARIO_REGEX = /^[a-zA-Z0-9_-]{3,30}$/;
const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// Utils para fechas
function parseFechaUTC(str) {
    const [y, m, d] = str.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d));
}
function formatFecha(date) {
    return date.toISOString().slice(0, 10);
}
function addDias(date, dias) {
    const d = new Date(date);
    d.setUTCDate(d.getUTCDate() + dias);
    return d;
}

export default async (req) => {
    try {
        const url = new URL(req.url);
        const usuario = url.searchParams.get("usuario");
        const hastaParam = url.searchParams.get("hasta");
        let diasTotales = parseInt(url.searchParams.get("dias")) || 30;

        if (!usuario || !USUARIO_REGEX.test(usuario)) {
            return new Response(JSON.stringify({ error: "Usuario inválido" }), { status: 400, headers: { "Content-Type": "application/json" } });
        }
        if (!hastaParam || !FECHA_REGEX.test(hastaParam)) {
            return new Response(JSON.stringify({ error: "Parametro 'hasta' invalido" }), { status: 400, headers: { "Content-Type": "application/json" } });
        }

        if (diasTotales > 60) diasTotales = 60;
        if (diasTotales < 1) diasTotales = 1;

        const fechaHasta = parseFechaUTC(hastaParam);
        const store = getStore("comidas");

        const results = [];
        for (let i = 0; i < diasTotales; i++) {
            results.push({ fechaStr: formatFecha(addDias(fechaHasta, -i)) });
        }

        // Obtener los blob keys en paralelo
        await Promise.all(results.map(async (r) => {
            const [metricasData, puntajesData, actividadesData, descData] = await Promise.all([
                store.get(`${usuario}:${r.fechaStr}:metricas`, { type: "json" }).catch(() => null),
                store.get(`${usuario}:${r.fechaStr}:puntajes`, { type: "json" }).catch(() => null),
                store.get(`${usuario}:${r.fechaStr}:actividades`, { type: "json" }).catch(() => null),
                store.get(`${usuario}:${r.fechaStr}:descripciones`, { type: "json" }).catch(() => null),
            ]);
            r.metricas = metricasData || {};
            r.puntajes = puntajesData || {};
            if (!r.puntajes.extras) r.puntajes.extras = {};
            r.actividades = Array.isArray(actividadesData) ? actividadesData : [];
            r.descripciones = descData || {};
        }));

        // Matrices reducidas para la UI de Chart.js y reportes
        const breakdown = { desayuno: [0, 0, 0, 0, 0, 0], almuerzo: [0, 0, 0, 0, 0, 0], merienda: [0, 0, 0, 0, 0, 0], cena: [0, 0, 0, 0, 0, 0] };
        const seriePeso = [];
        const serieSueno = [];
        const serieEnergia = [];
        let diasConActividad = 0;

        results.reverse();

        for (const r of results) {
            for (const c of ["desayuno", "almuerzo", "merienda", "cena"]) {
                const val = typeof r.puntajes[c] === 'number' ? Math.floor(r.puntajes[c]) : 0;
                if (val >= 1 && val <= 5) breakdown[c][val]++;
            }

            if (typeof r.metricas.peso === "number") seriePeso.push({ x: r.fechaStr, y: r.metricas.peso });
            if (typeof r.metricas.sueno === "number") serieSueno.push({ x: r.fechaStr, y: r.metricas.sueno });
            if (typeof r.metricas.energia === "number") serieEnergia.push({ x: r.fechaStr, y: r.metricas.energia });
            if (r.actividades.length) diasConActividad++;
        }

        return new Response(JSON.stringify({
            fechaDesde: results[0].fechaStr,
            fechaHasta: results[results.length - 1].fechaStr,
            diasAnalizados: diasTotales,
            diasConActividad,
            breakdown,
            seriePeso,
            serieSueno,
            serieEnergia,
            raw: results // para analisis de actividades en JS frontend
        }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });

    } catch (error) {
        console.error("Error en stats:", error);
        return new Response(JSON.stringify({ error: error.message || String(error) }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
};

export const config = { path: "/api/stats" };

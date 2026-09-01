import { getStore } from "@netlify/blobs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const COMIDAS = [
  { key: "desayuno", label: "Desayuno" },
  { key: "almuerzo", label: "Almuerzo" },
  { key: "merienda", label: "Merienda" },
  { key: "cena", label: "Cena" },
];

const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const USUARIO_REGEX = /^[a-zA-Z0-9_-]{3,30}$/;
const MAX_DIAS = 62; // tope para evitar que la función tarde demasiado
const ITEMS_POR_HOJA = 4; // grilla 2x2 por hoja

const DIAS_SEMANA = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

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
function chunk(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

function wrapText(text, font, size, maxWidth, maxLines) {
  if (!text) return [];
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(test, size) > maxWidth && current) {
      lines.push(current);
      current = word;
      if (lines.length === maxLines) break;
    } else {
      current = test;
    }
  }
  if (lines.length < maxLines && current) lines.push(current);

  // Si sobró texto sin usar, le agrega "..." a la última línea
  const palabrasUsadas = lines.join(" ").split(/\s+/).filter(Boolean).length;
  if (lines.length === maxLines && palabrasUsadas < words.length) {
    let ultima = lines[lines.length - 1];
    while (font.widthOfTextAtSize(`${ultima}...`, size) > maxWidth && ultima.length > 0) {
      ultima = ultima.slice(0, -1);
    }
    lines[lines.length - 1] = `${ultima}...`;
  }
  return lines;
}

export default async (req) => {
  const url = new URL(req.url);
  const usuario = url.searchParams.get("usuario");
  const desde = url.searchParams.get("desde");
  const hasta = url.searchParams.get("hasta");

  if (!usuario || !USUARIO_REGEX.test(usuario)) {
    return new Response("Usuario inválido", { status: 400 });
  }
  if (!desde || !hasta || !FECHA_REGEX.test(desde) || !FECHA_REGEX.test(hasta)) {
    return new Response("Faltan o son inválidos los parámetros 'desde' y 'hasta' (formato YYYY-MM-DD)", { status: 400 });
  }

  const fechaDesde = parseFechaUTC(desde);
  const fechaHasta = parseFechaUTC(hasta);

  if (fechaDesde > fechaHasta) {
    return new Response("La fecha 'desde' tiene que ser anterior o igual a 'hasta'", { status: 400 });
  }

  const diffDias = Math.round((fechaHasta - fechaDesde) / 86400000) + 1;
  if (diffDias > MAX_DIAS) {
    return new Response(`El rango no puede superar los ${MAX_DIAS} días`, { status: 400 });
  }

  const store = getStore("comidas");
  const pdfDoc = await PDFDocument.create();
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Para el resumen de actividad física al final del PDF
  const actividadCounts = new Map(); // key: tipo en minúscula -> { label, count }
  let diasConActividad = 0;

  for (let i = 0; i < diffDias; i++) {
    const fecha = addDias(fechaDesde, i);
    const fechaStr = formatFecha(fecha);
    const tituloBase = `${DIAS_SEMANA[fecha.getUTCDay()]} ${fecha.getUTCDate()} de ${MESES[fecha.getUTCMonth()]} de ${fecha.getUTCFullYear()}`;

    // Traer las comidas extra y las descripciones de este día
    let extras = [];
    try {
      const raw = await store.get(`${usuario}:${fechaStr}:extras`, { type: "json" });
      if (Array.isArray(raw)) extras = raw;
    } catch (e) {
      extras = [];
    }
    let descripciones = {};
    try {
      const raw = await store.get(`${usuario}:${fechaStr}:descripciones`, { type: "json" });
      if (raw && typeof raw === "object") descripciones = raw;
    } catch (e) {
      descripciones = {};
    }
    let actividades = [];
    try {
      const raw = await store.get(`${usuario}:${fechaStr}:actividades`, { type: "json" });
      if (Array.isArray(raw)) actividades = raw;
    } catch (e) {
      actividades = [];
    }

    if (actividades.length) diasConActividad++;
    for (const act of actividades) {
      const tipo = (act?.tipo || "").trim();
      if (!tipo) continue;
      const key = tipo.toLowerCase();
      const entry = actividadCounts.get(key) || { label: tipo, count: 0 };
      entry.count += 1;
      actividadCounts.set(key, entry);
    }
    const actividadTexto = actividades
      .map((a) => (a.nota ? `${a.tipo} (${a.nota})` : a.tipo))
      .join(", ");

    const items = [];
    for (const comida of COMIDAS) {
      items.push({
        tipo: "base",
        label: comida.label,
        desc: descripciones[comida.key] || "",
        blobKey: `${usuario}:${fechaStr}:${comida.key}`,
      });
      const extrasDeEsta = extras.filter((e) => e.after === comida.key);
      for (const extra of extrasDeEsta) {
        items.push({
          tipo: "extra",
          label: extra.label ? `${extra.label} (extra)` : "Comida extra",
          desc: extra.desc || "",
          blobKey: `${usuario}:${fechaStr}:extra:${extra.id}`,
        });
      }
    }

    const paginas = chunk(items, ITEMS_POR_HOJA);

    for (let p = 0; p < paginas.length; p++) {
      const itemsPagina = paginas[p];
      const page = pdfDoc.addPage([595.28, 841.89]); // A4
      const { width, height } = page.getSize();

      const titulo = p === 0 ? tituloBase : `${tituloBase} (cont.)`;
      page.drawText(titulo, {
        x: 40,
        y: height - 55,
        size: 20,
        font: fontBold,
        color: rgb(0.71, 0.4, 0.11),
      });

      if (p === 0 && actividadTexto) {
        const [lineaActividad] = wrapText(`Actividad física: ${actividadTexto}`, fontRegular, 10.5, width - 80, 1);
        if (lineaActividad) {
          page.drawText(lineaActividad, {
            x: 40,
            y: height - 76,
            size: 10.5,
            font: fontRegular,
            color: rgb(0.16, 0.5, 0.44),
          });
        }
      }

      const margin = 40;
      const gap = 20;
      const cellW = (width - margin * 2 - gap) / 2;
      const cellH = 330;
      const topY = height - 100;

      const posiciones = [
        { x: margin, y: topY - cellH },
        { x: margin + cellW + gap, y: topY - cellH },
        { x: margin, y: topY - cellH * 2 - gap },
        { x: margin + cellW + gap, y: topY - cellH * 2 - gap },
      ];

      for (let j = 0; j < itemsPagina.length; j++) {
        const { label, desc, blobKey } = itemsPagina[j];
        const pos = posiciones[j];

        page.drawText(label, {
          x: pos.x,
          y: pos.y + cellH - 18,
          size: 13,
          font: fontBold,
          color: rgb(0.2, 0.2, 0.2),
        });

        // Descripción (ingredientes, etc.), ajustada a 2 líneas
        const descLineas = wrapText(desc, fontRegular, 9.5, cellW - 10, 2);
        let descAltura = 0;
        descLineas.forEach((linea, idx) => {
          descAltura = (idx + 1) * 12;
          page.drawText(linea, {
            x: pos.x,
            y: pos.y + cellH - 34 - idx * 12,
            size: 9.5,
            font: fontRegular,
            color: rgb(0.4, 0.4, 0.4),
          });
        });

        const espacioSuperior = 25 + (descLineas.length ? descAltura + 6 : 0);
        const fotoAltura = cellH - espacioSuperior;

        page.drawRectangle({
          x: pos.x,
          y: pos.y,
          width: cellW,
          height: fotoAltura,
          borderColor: rgb(0.85, 0.85, 0.85),
          borderWidth: 1,
        });

        const entry = await store.getWithMetadata(blobKey, { type: "arrayBuffer" });

        if (entry) {
          try {
            const contentType = entry.metadata?.contentType || "";
            const img = contentType.includes("png")
              ? await pdfDoc.embedPng(entry.data)
              : await pdfDoc.embedJpg(entry.data);

            const boxW = cellW - 10;
            const boxH = fotoAltura - 10;
            const scale = Math.min(boxW / img.width, boxH / img.height);
            const imgW = img.width * scale;
            const imgH = img.height * scale;

            page.drawImage(img, {
              x: pos.x + (cellW - imgW) / 2,
              y: pos.y + (fotoAltura - imgH) / 2,
              width: imgW,
              height: imgH,
            });
          } catch (e) {
            page.drawText("No se pudo cargar la imagen", {
              x: pos.x + 10,
              y: pos.y + fotoAltura / 2,
              size: 10,
              font: fontRegular,
              color: rgb(0.8, 0.2, 0.2),
            });
          }
        } else {
          page.drawText("Sin foto", {
            x: pos.x + 10,
            y: pos.y + fotoAltura / 2,
            size: 12,
            font: fontRegular,
            color: rgb(0.6, 0.6, 0.6),
          });
        }
      }
    }
  }

  // Página de resumen de actividad física del rango completo
  {
    const pageW = 595.28;
    const pageH = 841.89;
    const margin = 40;
    let page = pdfDoc.addPage([pageW, pageH]);
    let y = pageH - 60;

    page.drawText("Resumen de actividad física", {
      x: margin,
      y,
      size: 20,
      font: fontBold,
      color: rgb(0.71, 0.4, 0.11),
    });
    y -= 26;

    page.drawText(
      `Del ${desde} al ${hasta} — actividad registrada en ${diasConActividad} de ${diffDias} día(s)`,
      { x: margin, y, size: 11, font: fontRegular, color: rgb(0.4, 0.4, 0.4) }
    );
    y -= 34;

    const filas = Array.from(actividadCounts.values()).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

    if (filas.length === 0) {
      page.drawText("No se registró actividad física en este rango de fechas.", {
        x: margin,
        y,
        size: 12,
        font: fontRegular,
        color: rgb(0.5, 0.5, 0.5),
      });
    } else {
      for (const fila of filas) {
        if (y < 60) {
          page = pdfDoc.addPage([pageW, pageH]);
          y = pageH - 60;
        }
        const veces = fila.count === 1 ? "vez" : "veces";
        page.drawText(`${fila.label}`, {
          x: margin,
          y,
          size: 13,
          font: fontBold,
          color: rgb(0.2, 0.2, 0.2),
        });
        page.drawText(`${fila.count} ${veces}`, {
          x: pageW - margin - 90,
          y,
          size: 13,
          font: fontRegular,
          color: rgb(0.16, 0.5, 0.44),
        });
        y -= 24;
      }
    }
  }

  const pdfBytes = await pdfDoc.save();

  return new Response(pdfBytes, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="comidas_${usuario}_${desde}_a_${hasta}.pdf"`,
    },
  });
};

export const config = { path: "/api/generate-pdf" };

import { getStore } from "@netlify/blobs";
import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FONT_DISPLAY_PATH = path.join(__dirname, "assets", "fonts", "DMSerifDisplay-Regular.ttf");
const FONT_DISPLAY_ITALIC_PATH = path.join(__dirname, "assets", "fonts", "DMSerifDisplay-Italic.ttf");

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

// Paleta cálida (misma identidad visual que la app web)
const COLORS = {
  rustDeep: rgb(0.522, 0.196, 0.075),    // #863213
  mustardDeep: rgb(0.588, 0.412, 0.059), // #96690F
  apricotDeep: rgb(0.612, 0.298, 0.118), // #9C4C1E
  plumDeep: rgb(0.341, 0.208, 0.251),    // #573540
  sageDeep: rgb(0.290, 0.341, 0.200),    // #4A5733
  ink: rgb(0.231, 0.173, 0.122),         // #3B2C1F
  inkSoft: rgb(0.478, 0.404, 0.322),     // #7A6752
  paperDeep: rgb(0.933, 0.882, 0.765),   // #EEE1C3
  paperStripe: rgb(0.965, 0.933, 0.863), // franja más suave para filas alternadas
  line: rgb(0.875, 0.800, 0.643),        // #DFCCA4
  danger: rgb(0.608, 0.229, 0.173),      // #9B3A2C
  white: rgb(1, 1, 1),
};

const COLOR_POR_COMIDA = {
  desayuno: COLORS.mustardDeep,
  almuerzo: COLORS.rustDeep,
  merienda: COLORS.apricotDeep,
  cena: COLORS.plumDeep,
};

// Mismo criterio que usa /api/progreso para "días verdes": si hay alguna
// comida puntuada por debajo de 4, el día no es verde.
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

// Dibuja 5 puntitos (llenos hasta el puntaje) debajo del nombre de la comida.
function dibujarPuntaje(page, score, cellX, cellY, cellW) {
  if (!score) return;
  const radio = 3;
  const espacio = 11;
  const total = 5 * espacio;
  const startX = cellX + (cellW - total) / 2 + espacio / 2;
  for (let i = 0; i < 5; i++) {
    const lleno = i < score;
    page.drawCircle({
      x: startX + i * espacio,
      y: cellY,
      size: radio,
      color: lleno ? COLORS.mustardDeep : undefined,
      borderColor: COLORS.mustardDeep,
      borderWidth: 0.75,
    });
  }
}

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

// ---------------- Orientación EXIF (fotos de celular) ----------------
// Los celulares (iPhone incluido) suelen guardar la foto "cruda" tal como
// la sensora tomó la luz, y anotan en el EXIF cuánto hay que rotarla para
// verse derecha. Los navegadores respetan ese dato solo al mostrar <img>,
// pero pdf-lib no lo lee: hay que leerlo nosotros y rotar al dibujar.
function leerOrientacionExif(bytes) {
  try {
    if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return 1;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let offset = 2;
    while (offset + 4 <= bytes.length) {
      if (bytes[offset] !== 0xff) break;
      const marker = bytes[offset + 1];
      if (marker === 0xe1) {
        const segLength = view.getUint16(offset + 2, false);
        const segStart = offset + 4;
        const esExif =
          bytes[segStart] === 0x45 && bytes[segStart + 1] === 0x78 &&
          bytes[segStart + 2] === 0x69 && bytes[segStart + 3] === 0x66 &&
          bytes[segStart + 4] === 0 && bytes[segStart + 5] === 0;
        if (esExif) {
          const tiffStart = segStart + 6;
          const little = bytes[tiffStart] === 0x49 && bytes[tiffStart + 1] === 0x49;
          const firstIFDOffset = view.getUint32(tiffStart + 4, little);
          const dirStart = tiffStart + firstIFDOffset;
          const numEntries = view.getUint16(dirStart, little);
          for (let i = 0; i < numEntries; i++) {
            const entryOffset = dirStart + 2 + i * 12;
            const tag = view.getUint16(entryOffset, little);
            if (tag === 0x0112) {
              return view.getUint16(entryOffset + 8, little);
            }
          }
        }
        offset += 2 + segLength;
      } else if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd9) || marker === 0x01) {
        offset += 2;
      } else {
        const segLength = view.getUint16(offset + 2, false);
        offset += 2 + segLength;
      }
    }
  } catch (e) {
    // Si el EXIF viene raro/incompleto, seguimos como si no hubiera rotación.
  }
  return 1;
}

// Grados en sentido horario que hay que rotar la imagen "cruda" para
// que se vea derecha, según el valor de orientación EXIF (1-8).
function rotacionParaOrientacion(orientation) {
  switch (orientation) {
    case 3: return 180;
    case 6: return 90;
    case 8: return 270;
    default: return 0; // 1 = normal; 2/4/5/7 son espejados (muy raros en fotos de celular)
  }
}

// Dibuja una imagen ya rotada/centrada dentro de una caja, sin deformarla.
function dibujarFotoAjustada(page, img, orientation, cellX, cellY, cellW, cellH) {
  const rotDeg = rotacionParaOrientacion(orientation);
  const rawW = img.width;
  const rawH = img.height;
  const displayW = rotDeg === 90 || rotDeg === 270 ? rawH : rawW;
  const displayH = rotDeg === 90 || rotDeg === 270 ? rawW : rawH;

  const boxW = cellW - 10;
  const boxH = cellH - 10;
  const scale = Math.min(boxW / displayW, boxH / displayH);
  const dW = displayW * scale;
  const dH = displayH * scale;
  const dx = cellX + (cellW - dW) / 2;
  const dy = cellY + (cellH - dH) / 2;

  const w = rawW * scale;
  const h = rawH * scale;

  let drawX = dx;
  let drawY = dy;
  let pdfRotate = 0;
  if (rotDeg === 90) {
    pdfRotate = 270;
    drawX = dx;
    drawY = dy + w;
  } else if (rotDeg === 180) {
    pdfRotate = 180;
    drawX = dx + w;
    drawY = dy + h;
  } else if (rotDeg === 270) {
    pdfRotate = 90;
    drawX = dx + h;
    drawY = dy;
  }

  page.drawImage(img, { x: drawX, y: drawY, width: w, height: h, rotate: degrees(pdfRotate) });
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
  pdfDoc.registerFontkit(fontkit);

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  // Tipografía serif de acento (misma familia de espíritu editorial que la
  // app web) para los títulos de cada día. Si por algún motivo el archivo
  // no está disponible, seguimos con una fuente estándar en su lugar.
  let fontDisplay = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  let fontDisplayItalic = fontItalic;
  try {
    fontDisplay = await pdfDoc.embedFont(readFileSync(FONT_DISPLAY_PATH), { subset: true });
    fontDisplayItalic = await pdfDoc.embedFont(readFileSync(FONT_DISPLAY_ITALIC_PATH), { subset: true });
  } catch (e) {
    // usa el fallback definido arriba
  }

  // Para el resumen de actividad física al final del PDF
  const actividadCounts = new Map(); // key: tipo en minúscula -> { label, count }
  let diasConActividad = 0;

  // Para el resumen de cumplimiento (puntajes) al final del PDF
  const estadoCounts = { verde: 0, amarillo: 0, rojo: 0, gris: 0 };

  for (let i = 0; i < diffDias; i++) {
    const fecha = addDias(fechaDesde, i);
    const fechaStr = formatFecha(fecha);

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
    let puntajes = {};
    try {
      const raw = await store.get(`${usuario}:${fechaStr}:puntajes`, { type: "json" });
      if (raw && typeof raw === "object") puntajes = raw;
    } catch (e) {
      puntajes = {};
    }
    if (!puntajes.extras || typeof puntajes.extras !== "object") puntajes.extras = {};

    estadoCounts[estadoDelDia(puntajes)]++;

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
        color: COLOR_POR_COMIDA[comida.key],
        label: comida.label,
        desc: descripciones[comida.key] || "",
        blobKey: `${usuario}:${fechaStr}:${comida.key}`,
        score: typeof puntajes[comida.key] === "number" ? puntajes[comida.key] : 0,
      });
      const extrasDeEsta = extras.filter((e) => e.after === comida.key);
      for (const extra of extrasDeEsta) {
        items.push({
          color: COLORS.sageDeep,
          label: extra.label ? `${extra.label} (extra)` : "Comida extra",
          desc: extra.desc || "",
          blobKey: `${usuario}:${fechaStr}:extra:${extra.id}`,
          score: typeof puntajes.extras[extra.id] === "number" ? puntajes.extras[extra.id] : 0,
        });
      }
    }

    const paginas = chunk(items, ITEMS_POR_HOJA);

    for (let p = 0; p < paginas.length; p++) {
      const itemsPagina = paginas[p];
      const page = pdfDoc.addPage([595.28, 841.89]); // A4
      const { width, height } = page.getSize();
      const margin = 40;

      // Franja lateral cálida, mismo gesto que el header de la app.
      page.drawRectangle({ x: 0, y: 0, width: 5, height, color: COLORS.rustDeep });

      // Numeral grande del día + nombre del día/mes, como una entrada de
      // diario. Ayuda a ubicarse rápido al hojear un rango de muchos días.
      const diaNum = String(fecha.getUTCDate());
      const diaNumSize = 44;
      page.drawText(diaNum, {
        x: margin,
        y: height - 58,
        size: diaNumSize,
        font: fontDisplay,
        color: COLORS.rustDeep,
      });
      const diaNumWidth = fontDisplay.widthOfTextAtSize(diaNum, diaNumSize);
      const nombreDia = DIAS_SEMANA[fecha.getUTCDay()];
      const nombreDiaCap = nombreDia.charAt(0).toUpperCase() + nombreDia.slice(1);
      page.drawText(nombreDiaCap, {
        x: margin + diaNumWidth + 14,
        y: height - 40,
        size: 14.5,
        font: fontBold,
        color: COLORS.ink,
      });
      page.drawText(`${MESES[fecha.getUTCMonth()]} de ${fecha.getUTCFullYear()}`, {
        x: margin + diaNumWidth + 14,
        y: height - 56,
        size: 10.5,
        font: fontRegular,
        color: COLORS.inkSoft,
      });

      if (p > 0) {
        const cont = "(continúa)";
        const contWidth = fontDisplayItalic.widthOfTextAtSize(cont, 13);
        page.drawText(cont, {
          x: width - margin - contWidth,
          y: height - 46,
          size: 13,
          font: fontDisplayItalic,
          color: COLORS.inkSoft,
        });
      }

      if (p === 0 && actividadTexto) {
        const [lineaActividad] = wrapText(`Actividad física: ${actividadTexto}`, fontRegular, 10.5, width - margin * 2, 1);
        if (lineaActividad) {
          page.drawText(lineaActividad, {
            x: margin,
            y: height - 74,
            size: 10.5,
            font: fontRegular,
            color: COLORS.sageDeep,
          });
        }
      }

      // Filete cálido bajo el encabezado, mismo motivo que separa
      // secciones en la app (línea suave, no una franja pesada).
      page.drawLine({
        start: { x: margin, y: height - 84 },
        end: { x: width - margin, y: height - 84 },
        thickness: 1,
        color: COLORS.line,
      });

      const gap = 20;
      const cellW = (width - margin * 2 - gap) / 2;
      const cellH = 330;
      const topY = height - 104;

      const posiciones = [
        { x: margin, y: topY - cellH },
        { x: margin + cellW + gap, y: topY - cellH },
        { x: margin, y: topY - cellH * 2 - gap },
        { x: margin + cellW + gap, y: topY - cellH * 2 - gap },
      ];

      for (let j = 0; j < itemsPagina.length; j++) {
        const { label, desc, blobKey, color, score } = itemsPagina[j];
        const pos = posiciones[j];

        // Cabecera de color por comida (mismo código de color que las
        // tarjetas de la app: mostaza/terracota/damasco/ciruela/salvia).
        const headerH = 22;
        const headerY = pos.y + cellH - headerH;
        page.drawRectangle({ x: pos.x, y: headerY, width: cellW, height: headerH, color });

        const labelSize = 11;
        const labelWidth = fontBold.widthOfTextAtSize(label, labelSize);
        page.drawText(label, {
          x: pos.x + Math.max(8, (cellW - labelWidth) / 2),
          y: headerY + 7,
          size: labelSize,
          font: fontBold,
          color: COLORS.white,
        });

        // Descripción (ingredientes, etc.), ajustada a 2 líneas
        const descLineas = wrapText(desc, fontRegular, 9.5, cellW - 16, 2);
        let cursorY = headerY - 15;
        descLineas.forEach((linea) => {
          page.drawText(linea, {
            x: pos.x + 8,
            y: cursorY,
            size: 9.5,
            font: fontRegular,
            color: COLORS.inkSoft,
          });
          cursorY -= 12.5;
        });

        // Puntitos de puntaje (1 a 5), si se cargó alguno para esta comida.
        if (score) {
          cursorY -= 2;
          dibujarPuntaje(page, score, pos.x, cursorY, cellW);
          cursorY -= 12;
        }

        const fotoTop = descLineas.length || score ? cursorY + 6 : headerY - 8;
        const fotoAltura = fotoTop - pos.y;

        const entry = await store.getWithMetadata(blobKey, { type: "arrayBuffer" });

        page.drawRectangle({
          x: pos.x,
          y: pos.y,
          width: cellW,
          height: fotoAltura,
          color: entry ? undefined : COLORS.paperDeep,
          borderColor: COLORS.line,
          borderWidth: 1,
        });

        if (entry) {
          try {
            const contentType = entry.metadata?.contentType || "";
            const bytes = new Uint8Array(entry.data);
            const isPng = contentType.includes("png");
            const img = isPng ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
            const orientation = isPng ? 1 : leerOrientacionExif(bytes);
            dibujarFotoAjustada(page, img, orientation, pos.x, pos.y, cellW, fotoAltura);
          } catch (e) {
            page.drawText("No se pudo cargar la imagen", {
              x: pos.x + 10,
              y: pos.y + fotoAltura / 2,
              size: 10,
              font: fontRegular,
              color: COLORS.danger,
            });
          }
        } else {
          const texto = "Sin foto";
          const textoWidth = fontDisplayItalic.widthOfTextAtSize(texto, 13);
          page.drawText(texto, {
            x: pos.x + (cellW - textoWidth) / 2,
            y: pos.y + fotoAltura / 2,
            size: 13,
            font: fontDisplayItalic,
            color: COLORS.inkSoft,
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
    page.drawRectangle({ x: 0, y: 0, width: 5, height: pageH, color: COLORS.rustDeep });
    let y = pageH - 60;

    page.drawText("Resumen del período", {
      x: margin,
      y,
      size: 25,
      font: fontDisplay,
      color: COLORS.rustDeep,
    });
    y -= 20;
    page.drawLine({
      start: { x: margin, y },
      end: { x: pageW - margin, y },
      thickness: 1,
      color: COLORS.line,
    });
    y -= 22;

    page.drawText(`Del ${desde} al ${hasta} — ${diffDias} día(s)`, {
      x: margin,
      y,
      size: 11,
      font: fontRegular,
      color: COLORS.inkSoft,
    });
    y -= 32;

    // ---- Cumplimiento del plan (puntajes 1-5 por comida) ----
    page.drawText("Cumplimiento del plan", {
      x: margin,
      y,
      size: 15,
      font: fontBold,
      color: COLORS.ink,
    });
    y -= 24;

    const diasConDatos = diffDias - estadoCounts.gris;
    if (diasConDatos === 0) {
      page.drawText("Todavía no cargaste puntajes en este rango de fechas.", {
        x: margin,
        y,
        size: 11,
        font: fontItalic,
        color: COLORS.inkSoft,
      });
      y -= 30;
    } else {
      const porcentajeVerde = Math.round((estadoCounts.verde / diasConDatos) * 100);
      page.drawText(`${porcentajeVerde}% de los días con datos cumpliste todo en verde`, {
        x: margin,
        y,
        size: 11,
        font: fontRegular,
        color: COLORS.sageDeep,
      });
      y -= 24;

      const filasEstado = [
        { label: "Días en verde", n: estadoCounts.verde, color: COLORS.sageDeep },
        { label: "Días regulares (amarillo)", n: estadoCounts.amarillo, color: COLORS.mustardDeep },
        { label: "Días con algo mal (rojo)", n: estadoCounts.rojo, color: COLORS.danger },
        { label: "Días sin puntuar", n: estadoCounts.gris, color: COLORS.inkSoft },
      ];
      for (const fila of filasEstado) {
        page.drawCircle({ x: margin + 4, y: y + 3, size: 4, color: fila.color });
        page.drawText(fila.label, {
          x: margin + 16,
          y,
          size: 11,
          font: fontRegular,
          color: COLORS.ink,
        });
        const nTexto = String(fila.n);
        const nWidth = fontBold.widthOfTextAtSize(nTexto, 11);
        page.drawText(nTexto, {
          x: pageW - margin - nWidth,
          y,
          size: 11,
          font: fontBold,
          color: fila.color,
        });
        y -= 18;
      }
      y -= 14;
    }

    page.drawLine({
      start: { x: margin, y },
      end: { x: pageW - margin, y },
      thickness: 1,
      color: COLORS.line,
    });
    y -= 26;

    // ---- Actividad física ----
    page.drawText("Actividad física", {
      x: margin,
      y,
      size: 15,
      font: fontBold,
      color: COLORS.ink,
    });
    y -= 22;

    page.drawText(
      `Actividad registrada en ${diasConActividad} de ${diffDias} día(s)`,
      { x: margin, y, size: 11, font: fontRegular, color: COLORS.inkSoft }
    );
    y -= 30;

    const filas = Array.from(actividadCounts.values()).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

    if (filas.length === 0) {
      page.drawText("No se registró actividad física en este rango de fechas.", {
        x: margin,
        y,
        size: 12,
        font: fontItalic,
        color: COLORS.inkSoft,
      });
    } else {
      const rowH = 28;
      filas.forEach((fila, idx) => {
        if (y < 70) {
          page = pdfDoc.addPage([pageW, pageH]);
          page.drawRectangle({ x: 0, y: 0, width: 5, height: pageH, color: COLORS.rustDeep });
          y = pageH - 60;
        }
        // Franja alternada + acento de color, mismo lenguaje visual
        // que las filas de actividad en la app.
        if (idx % 2 === 0) {
          page.drawRectangle({
            x: margin,
            y: y - rowH + 9,
            width: pageW - margin * 2,
            height: rowH,
            color: COLORS.paperStripe,
          });
        }
        page.drawRectangle({
          x: margin,
          y: y - rowH + 9,
          width: 4,
          height: rowH,
          color: COLORS.sageDeep,
        });

        const veces = fila.count === 1 ? "vez" : "veces";
        page.drawText(fila.label, {
          x: margin + 16,
          y,
          size: 12.5,
          font: fontBold,
          color: COLORS.ink,
        });
        const conteoTexto = `${fila.count} ${veces}`;
        const conteoWidth = fontBold.widthOfTextAtSize(conteoTexto, 12.5);
        page.drawText(conteoTexto, {
          x: pageW - margin - 16 - conteoWidth,
          y,
          size: 12.5,
          font: fontBold,
          color: COLORS.sageDeep,
        });
        y -= rowH;
      });
    }
  }

  // Numeración de página, discreta, abajo a la derecha de cada hoja.
  const todasLasPaginas = pdfDoc.getPages();
  todasLasPaginas.forEach((pg, idx) => {
    const { width: pw } = pg.getSize();
    const texto = `Página ${idx + 1} de ${todasLasPaginas.length}`;
    const textoWidth = fontRegular.widthOfTextAtSize(texto, 8.5);
    pg.drawText(texto, {
      x: pw - 40 - textoWidth,
      y: 24,
      size: 8.5,
      font: fontRegular,
      color: COLORS.inkSoft,
    });
  });

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

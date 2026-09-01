# Comidas del Día — versión Netlify

Página web para subir una foto de cada comida (desayuno, almuerzo, merienda,
cena) de cada día, navegar entre días, y generar un PDF con un rango de
fechas (una hoja por día, con las 4 fotos). Cualquiera con el link la puede
ver, desde PC o celular.

Usa:
- **HTML/CSS/JS estático** (`public/`) — la página.
- **Netlify Functions** en JavaScript (`netlify/functions/`) — suben/sirven
  fotos y generan el PDF.
- **Netlify Blobs** — almacenamiento permanente de las fotos, organizadas por
  fecha y comida (clave `YYYY-MM-DD:comida`).
- **pdf-lib** — arma el PDF del lado del servidor.

## Cómo publicarla (sin usar la terminal)

1. Cuenta gratis en https://app.netlify.com.
2. Subí esta carpeta a un repositorio de GitHub (arrastrando los archivos,
   manteniendo las carpetas `public/` y `netlify/functions/`).
3. En Netlify: "Add new site" → "Import an existing project" → elegí el
   repositorio.
4. Netlify detecta todo solo por el `netlify.toml` → "Deploy".
5. En un par de minutos tenés tu link `https://tu-sitio.netlify.app`.

## Cómo probarla en tu computadora (opcional)

```bash
npm install -g netlify-cli
npm install
netlify dev
```

Se abre en `http://localhost:8888`.

## Cómo agregarla como acceso directo en el celular

La página ya tiene ícono propio y modo pantalla completa configurados
(`manifest.json` + metatags). Para instalarla:

**Android (Chrome):**
1. Abrí tu link personal (el que compartís, con `?u=tu_usuario`).
2. Tocá el menú ⋮ (arriba a la derecha) → **"Instalar app"** o
   **"Agregar a pantalla de inicio"**.
3. Confirmá. Te queda un ícono como cualquier otra app, y se abre sin la
   barra del navegador.

**iPhone (Safari):**
1. Abrí tu link personal en Safari (tiene que ser Safari, no Chrome, para
   que aparezca la opción).
2. Tocá el botón de Compartir (el cuadradito con la flecha hacia arriba).
3. Elegí **"Agregar a pantalla de inicio"**.
4. Confirmá el nombre y listo.

Como tu usuario queda guardado en el navegador (`localStorage`), aunque el
acceso directo abra la página "pelada" (sin `?u=` en la URL), va a reconocer
tu usuario automáticamente y entrar directo a tus comidas — no hace falta
loguearse cada vez.

## Qué se agregó en esta versión

- **Usuarios por link**: al entrar por primera vez, elegís un nombre de
  usuario (ej: `martin83`). A partir de ahí el link queda así:
  `https://tu-sitio.netlify.app/?u=martin83`. Compartiendo ESE link (con tu
  botón "🔗 Compartir mi link"), la otra persona ve únicamente tus fotos.
  Si alguien más entra sin usuario, o con otro nombre, ve un espacio
  totalmente separado del tuyo.
  - ⚠️ Esto separa los datos por nombre de usuario, pero **no es una
    contraseña real**: es como un link "no listado". Cualquiera que conozca
    o adivine tu nombre de usuario podría verlo escribiéndolo en la URL.
    Para uso entre amigos/familia y tu nutricionista alcanza, pero elegí un
    nombre no obvio si te preocupa la privacidad.
  - El navegador recuerda tu usuario (con `localStorage`), así que no hace
    falta reescribirlo cada vez que entrás desde tu propio celu/PC. Podés
    cambiar de usuario con el botón "Cambiar de usuario".
- **Navegación por día**: flechas "Día anterior / Día siguiente" y un
  selector de fecha. Cada foto queda guardada asociada a esa fecha
  específica.
- **Grilla 2x2 con fotos más grandes**, en proporción 4:3 (la que suelen
  sacar los celulares), y se pueden tocar para verlas en pantalla completa.
- **Comidas extra**: si comiste algo fuera de las 4 comidas principales (ej:
  algo a media mañana), tocá "➕ Agregar comida extra", elegí después de cuál
  va (Desayuno, Almuerzo, Merienda o Cena), poné una descripción opcional
  (ej: "Media mañana") y subí la foto. Aparece intercalada en el lugar
  correcto de la grilla, y también en el PDF. Se puede eliminar con el botón
  "🗑 Eliminar" de esa tarjeta.
- **Generar PDF**: botón "📄 Generar PDF" que despliega un selector de rango
  "Desde" / "Hasta". Genera un PDF con una hoja por cada día del rango,
  mostrando las 4 fotos correspondientes (o "Sin foto" si algún día quedó
  incompleto).

### Límites a tener en cuenta

- Por ahora solo se aceptan fotos **JPG o PNG** (es lo que la librería del
  PDF puede incrustar directamente).
- El rango del PDF está limitado a **62 días** por pedido, para que la
  función no tarde demasiado y evitar que el hosting gratuito la corte por
  timeout. Si necesitás rangos más largos, se puede generar en varias tandas.

## Diferencia con la versión en Flask/Python

Netlify no ejecuta servidores Python persistentes (como Flask) ni tiene disco
propio para archivos sueltos. Por eso esta versión usa JavaScript para las
funciones, Netlify Blobs para el almacenamiento y pdf-lib para el PDF — todo
dentro del plan gratuito de Netlify.

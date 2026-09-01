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

## Qué se agregó en esta versión

- **Navegación por día**: flechas "Día anterior / Día siguiente" y un
  selector de fecha. Cada foto queda guardada asociada a esa fecha
  específica, así que podés cargar comidas de hoy, de ayer, o de cualquier
  día.
- **Grilla 2x2**: las 4 tarjetas de comida se acomodan siempre en 2 columnas
  x 2 filas.
- **Generar PDF**: al final de la página hay un selector "Desde" / "Hasta".
  Al tocar "Generar PDF" se descarga un PDF con una hoja por cada día del
  rango, mostrando las 4 fotos de ese día (o "Sin foto" si algún día no tiene
  alguna comida cargada).

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

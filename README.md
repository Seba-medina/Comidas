# Comidas del Día — versión Netlify

Página web para subir una foto de cada comida (desayuno, almuerzo, merienda,
cena) y que cualquiera con el link la vea, desde PC o celular.

Esta versión usa:
- **HTML/CSS/JS estático** (carpeta `public/`) — la página que se ve.
- **Netlify Functions** en JavaScript (carpeta `netlify/functions/`) — reciben
  la foto y la guardan.
- **Netlify Blobs** — el almacenamiento donde quedan guardadas las fotos de
  forma permanente (a diferencia de guardar archivos sueltos, que en Netlify
  no persiste).

## Cómo publicarla (la forma más fácil, sin usar la terminal)

1. Creá una cuenta gratis en https://app.netlify.com (podés entrar con GitHub,
   GitLab o email).
2. Subí esta carpeta completa a un repositorio nuevo en GitHub. Podés hacerlo
   sin usar la terminal: entrá a github.com → "New repository" → una vez creado,
   "Add file" → "Upload files" → arrastrá todos los archivos de esta carpeta
   (manteniendo la estructura de carpetas `public/` y `netlify/functions/`).
3. En Netlify: "Add new site" → "Import an existing project" → conectá el
   repositorio de GitHub que acabás de crear.
4. Netlify va a detectar automáticamente la configuración gracias al archivo
   `netlify.toml` (publish = `public`, functions = `netlify/functions`). Solo
   hace falta darle a "Deploy".
5. En 1-2 minutos te da un link tipo `https://tu-sitio.netlify.app` — ese es
   el que compartís. Funciona igual desde PC o celular.

No hace falta configurar nada de Netlify Blobs a mano: se activa solo la
primera vez que una función lo usa.

## Cómo probarla en tu computadora antes de publicar (opcional)

Necesitás Node.js instalado.

```bash
npm install -g netlify-cli
npm install
netlify dev
```

Se abre en `http://localhost:8888` con todo funcionando (frontend + funciones
+ almacenamiento) igual que en producción.

## Cómo funciona

- `public/index.html`: muestra las 4 tarjetas y, al elegir una foto, la manda
  por `fetch` a `/api/upload`.
- `netlify/functions/upload.mjs`: recibe la foto y la guarda en Netlify Blobs
  bajo la clave `desayuno`, `almuerzo`, `merienda` o `cena` (subir una nueva
  reemplaza la anterior).
- `netlify/functions/image.mjs`: sirve la foto guardada cuando el navegador la
  pide en `/api/image?comida=desayuno`.

## Diferencia con la versión en Flask/Python

Netlify no ejecuta servidores Python persistentes (como Flask) ni tiene disco
propio para guardar archivos sueltos. Por eso esta versión usa JavaScript para
las funciones y Netlify Blobs para el almacenamiento — es la forma nativa y
gratuita de lograr lo mismo dentro de Netlify. Si en algún momento preferís
seguir en Python, la versión Flask del mensaje anterior se puede publicar en
Render o PythonAnywhere en vez de Netlify.

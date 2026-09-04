# Contexto del proyecto: "Comidas del Día"

Pegá este texto completo al inicio de una conversación nueva con Claude antes
de pedir cualquier cambio. Si podés, adjuntá también el .zip con el código
actual del proyecto (así Claude puede leer los archivos reales en vez de
guiarse solo por esta descripción).

---

## Qué es

Una página web donde cada usuario sube una foto de cada comida del día
(Desayuno, Almuerzo, Merienda, Cena), puede navegar entre días, agregar
"comidas extra" (fuera de esas 4), escribir una descripción de ingredientes
por foto (con opciones guardadas reutilizables), registrar actividad física
del día, y generar un PDF con un rango de fechas para mandarle a su
nutricionista. Está pensada para uso desde el celular, con instalación como
acceso directo (PWA).

## Identidad visual

Estética moderna y fluida con soporte para *Glassmorphism* (cartas flotantes, interfaces semitransparentes), enfocada fuertemente en dinamismo, animaciones y usabilidad premium:

- **Paleta y Temas:** Fondo "mesh gradient" envolvente (toques de rojo, naranja, violeta y verde). Soporte completo para **Modo Claro** y **Modo Oscuro** (`dark-mode` con paleta slate `#090D16` / `#161E31`), seleccionable con botón 🌙 / ☀️ en la cabecera y persistente en `localStorage`. Tinta oscura mate para los textos de contraste diurno y blanco suave para el nocturno.
- **Tipografía en la web:** Outfit (sans-serif redondeada moderna, para títulos numéricos y logos) + Inter (sans neutra legibilísima, para el resto de UI), cargadas vía Google Fonts.
- **Tipografía en el PDF:** DM Serif Display, incrustada de verdad en el PDF
  (no es una fuente estándar) para los títulos de cada día; el resto del
  texto usa Helvetica (fuente estándar, liviana).
- **Navegación de acciones:** un botón ☰ en el header abre un menú
  desplegable con las acciones principales (Galería de fotos, Comida extra, Generar
  PDF, Mi progreso, Métricas y Actividad). No hay barra de botones fija ni panel lateral siempre
  visible — el comportamiento es el mismo en cualquier tamaño de pantalla.
- **Sistema de puntuación y resumen:** cada comida (base y extra) se puntúa del 1 al 5
  con estrellas, tanto en la web como reflejado en el PDF (puntitos de
  colores, ya que las fuentes del PDF no pueden mostrar el símbolo ★). La página principal cuenta además con un banner de progreso del día con checklist interactivo.

## Stack técnico

- **Hosting:** Netlify (plan gratuito).
- **Frontend:** un único archivo HTML estático con CSS y JavaScript vanilla
  embebido (sin frameworks, sin build step).
- **Backend:** Netlify Functions en JavaScript (no Python — Netlify no
  soporta bien Python para funciones persistentes).
- **Almacenamiento:** Netlify Blobs (key-value store propio de Netlify,
  gratuito, persistente).
- **Generación de PDF:** librería `pdf-lib` (del lado del servidor, en una
  Netlify Function), con `@pdf-lib/fontkit` para poder incrustar una fuente
  real (DM Serif Display) en vez de usar solo las fuentes estándar del PDF.
- **Gráficos Avanzados:** `Chart.js` inyectado vía CDN público para dibujar gráficos nativos de línea o barras al abrir el panel de progreso en dispositivos clientes.
- **Multiusuario y Autenticación:** Cada cuenta puede visualizarse de forma pública a través del parámetro de URL `?u=nombre_usuario` entrando en un "Modo Lectura". Para poder modificar, agregar comidas o generar PDFs se requiere iniciar sesión en la cuenta con su propia **contraseña**.

## Estructura de archivos

```
netlify.toml                     → config: publish="public", functions="netlify/functions",
                                    y functions.included_files para empaquetar la fuente
                                    del PDF junto con la función
package.json                     → dependencias: @netlify/blobs, pdf-lib, @pdf-lib/fontkit
public/
  index.html                     → toda la app (HTML+CSS+JS)
  manifest.json                  → manifest PWA (ícono, nombre, modo standalone, colores)
  icons/
    icon-192.png, icon-512.png, apple-touch-icon.png   → ícono rediseñado (plato+cubiertos
                                                           en la paleta cálida actual)
netlify/functions/
  auth-login.mjs                 → POST: autentica un usuario para permitirle (o crear) cuenta con contraseña
  auth-change-password.mjs       → POST: permite cambiar la contraseña del usuario logueado
  auth-utils.mjs                 → Helper/Middleware: intercepta y verifica el header de contraseña
  admin-users.mjs                → GET: uso exclusivo de admin para ver todas las claves
  upload.mjs                    → POST: sube foto de una de las 4 comidas base
  image.mjs                     → GET: sirve la foto de una comida base
  extras.mjs                    → GET: lista las comidas "extra" de un día
  extra-upload.mjs               → POST: sube una foto de comida extra
  extra-delete.mjs               → POST: elimina una comida extra
  extra-edit.mjs                 → POST: edita la descripción de una comida extra
  extra-image.mjs                → GET: sirve la foto de una comida extra
  descriptions.mjs               → GET: descripciones de las 4 comidas base de un día
  set-description.mjs            → POST: guarda la descripción de una comida base
  presets.mjs                    → GET: opciones guardadas por comida (reutilizables)
  presets-add.mjs                → POST: agrega una opción guardada
  presets-delete.mjs             → POST: elimina una opción guardada
  activities.mjs                 → GET: lista la actividad física de un día
  activity-add.mjs               → POST: agrega una actividad física a un día
  activity-delete.mjs            → POST: elimina una actividad física
  activity-presets.mjs           → GET: opciones guardadas de actividad física
  activity-presets-add.mjs       → POST: agrega una opción guardada de actividad
  activity-presets-delete.mjs    → POST: elimina una opción guardada de actividad
  set-score.mjs                  → POST: guarda el puntaje (1-5) de una comida base o extra
  scores.mjs                     → GET: puntajes de un día
  progreso.mjs                   → GET: racha actual + calendario de un mes (colores por día)
  generate-pdf.mjs               → GET: genera el PDF de un rango de fechas
  assets/fonts/
    DMSerifDisplay-Regular.ttf   → fuente incrustada en el PDF (títulos de cada día)
    DMSerifDisplay-Italic.ttf    → variante itálica (texto "(continúa)", "Sin foto")
    OFL.txt                     → licencia de la fuente (Open Font License)
```

## Modelo de datos (claves en Netlify Blobs, todas en el store "comidas")

- Foto de comida base: `usuario:fecha:comida`
  (ej: `martin83:2026-09-01:desayuno`) → el binario de la imagen (JPG/PNG),
  con metadata `contentType`.
- Contraseña de usuario: `usuario:password` → la clave elegida en texto plano.
- Descripciones de las 4 comidas base de un día:
  `usuario:fecha:descripciones` → JSON `{ desayuno, almuerzo, merienda, cena }`
- Índice de comidas extra de un día: `usuario:fecha:extras` → JSON
  `[{ id, after, label, desc }]` (`after` = después de qué comida base va)
- Foto de comida extra: `usuario:fecha:extra:ID` → binario de imagen
- Opciones guardadas (presets) de comida del usuario: `usuario:presets` →
  JSON `{ desayuno: [...], almuerzo: [...], merienda: [...], cena: [...] }`
  (son globales del usuario, no por día)
- Actividad física de un día: `usuario:fecha:actividades` → JSON
  `[{ id, tipo, nota }]`
- Opciones guardadas (presets) de actividad física del usuario:
  `usuario:presets-actividad` → JSON `[...]` (array de strings, global del
  usuario)
- Puntajes de un día: `usuario:fecha:puntajes` → JSON
  `{ desayuno, almuerzo, merienda, cena, extras: { extraId: n } }`, cada
  valor es un número 1-5 (ausente = no puntuada esa comida)
- Métricas Biométricas Diarias: `usuario:fecha:metricas` → JSON
  `{ peso, sueno, agua, pasos, energia }`, donde todos son numéricos y opcionales.

`usuario` valida contra `/^[a-zA-Z0-9_-]{3,30}$/`. `fecha` es `YYYY-MM-DD`.

## Sistema de puntuación (racha + calendario)

Cada una de las 4 comidas base y cada comida extra se puntúa del 1 al 5 con
estrellas (tocar la misma estrella otra vez borra el puntaje). Reglas:

- **Estado de un día:** se mira la peor comida puntuada ese día.
  - 🟢 **verde**: todas las comidas puntuadas quedaron en 4 o 5.
  - 🟡 **amarillo**: la peor puntuada fue un 3.
  - 🔴 **rojo**: hay alguna comida en 1 o 2.
  - ⚪ **gris**: no se puntuó ninguna comida ese día (no cuenta ni para bien
    ni para mal).
- **Racha:** cantidad de días **verdes** consecutivos yendo hacia atrás
  desde hoy. Un día gris (sin puntuar) no corta la racha, pero tampoco la
  hace avanzar — solo un día amarillo o rojo la corta. El cálculo tiene un
  tope de 120 días hacia atrás (`MAX_DIAS_RACHA` en `progreso.mjs`) para no
  escanear indefinidamente; si se llega al tope, la web muestra "120+".
- **Racha y Calendario Web:** La racha y el calendario mensual tipo mapa de calor ahora están incrustados directamente dentro de la **página principal** ("🏆 Progreso"), mientras que el botón "Estadísticas Avanzadas" en el menú ☰ abre gráficas complejas en un modal.
- **En el PDF:** cada comida muestra 5 puntitos (llenos hasta el puntaje) en
  vez de estrellas de texto — las fuentes usadas en el PDF no tienen el
  glyph ★, así que se dibujan como círculos con `page.drawCircle`. La página
  de resumen final del PDF incluye un bloque "Cumplimiento del plan" con el
  % de días verdes y el conteo de cada estado en el rango elegido.

## Funcionalidades ya implementadas (en orden en que se fueron agregando)

1. Página base con 4 comidas fijas (Desayuno/Almuerzo/Merienda/Cena), subida
   de foto por comida, visible por cualquiera con el link.
2. Migración de Flask/Python a Netlify (porque Netlify no corre Python de
   forma persistente) usando Netlify Functions + Netlify Blobs.
3. Grilla 2x2 fija, fotos más grandes en proporción 4:3, click en la foto
   abre un lightbox (pantalla completa).
4. Navegación entre días (flechas anterior/siguiente + selector de fecha).
   Cada foto queda asociada a una fecha específica.
5. Generación de PDF por rango de fechas: una hoja por día con las 4 fotos en
   grilla 2x2 (botón que despliega el selector "Desde"/"Hasta").
6. Corrección: el input de archivo no debía tener `capture="environment"`
   (forzaba la cámara y no dejaba elegir de la galería).
7. Sistema de usuarios por link (`?u=usuario`): cada usuario tiene su espacio
   separado. El usuario se guarda en `localStorage` para no tener que
   loguearse cada vez en el mismo dispositivo. Botón "Compartir mi link"
   copia la URL con el usuario al portapapeles.
8. Ícono de acceso directo / PWA: `manifest.json` + metatags + íconos
   generados, para "Agregar a pantalla de inicio" en Android/iPhone.
9. "Comidas extra": botón que permite agregar una foto fuera de las 4
   comidas base, eligiendo "después de cuál" va (se intercala en la grilla y
   en el PDF en el lugar correcto). Se puede eliminar.
10. Descripción de texto por foto (para detallar ingredientes que no se ven
    bien en la imagen), tanto en comidas base como extra. Aparece también en
    el PDF, debajo del nombre de cada comida (con salto de línea automático,
    máx. 2 líneas).
11. Opciones guardadas (presets) por tipo de comida: botón ⭐ guarda la
    descripción actual como opción reutilizable; aparece luego en un
    desplegable para elegir sin volver a escribir. Las opciones son del
    usuario y se comparten entre todos los días.
12. Registro de actividad física por día (tipo + nota opcional), con sus
    propias opciones guardadas (presets), listado y borrado. Aparece en la
    app dentro del menú de acciones y en el PDF (línea debajo del título del
    día, más una página de resumen al final con el conteo de cada actividad
    en todo el rango de fechas del PDF).
13. Rediseño visual "Modern Premium": migración total desde el diseño 2009 "rústico" hacia un esquema con mesh gradients dinámicos en CSS, glassmorphism con soft-shadows en tarjetas hiper-redondeadas (20px), microanimaciones, y tipografías corporativas (Outfit / Inter).
14. Menú de acciones como botón hamburguesa (☰) en el header, con un
    desplegable que reemplazó tanto la barra de botones fija de mobile como
    el panel lateral siempre visible de pantallas anchas — comportamiento
    único para cualquier tamaño de pantalla.
15. Corrección de orientación de fotos en el PDF: las fotos de celular
    (iPhone incluido) guardan la imagen "cruda" más un dato EXIF que indica
    cuánto rotarla para verse derecha. Los navegadores lo respetan solo al
    mostrar `<img>`, pero `pdf-lib` no — así que se agregó un parser EXIF
    propio (sin dependencias externas) que lee ese dato y rota cada foto
    matemáticamente antes de dibujarla en el PDF.
16. Rediseño visual del PDF: misma paleta e identidad que la web (cabecera
    de color por tipo de comida, numeral grande del día en tipografía serif
    incrustada de verdad —DM Serif Display—, franja lateral de color,
    numeración de página, página de resumen de actividad física con filas
    alternadas). Si el archivo de fuente no estuviera disponible en
    producción por algún motivo, el código cae automáticamente a una fuente
    estándar en vez de romper la generación del PDF.
17. Sistema de puntuación (1-5 estrellas) por comida. El calendario de rachas fue extraído y puesto estáticamente en la pantalla inicial, mientras que el menú ☰ cuenta con su propio panel para reportes estadísticos avanzados (integración Chart.js).
    día (verde/amarillo/rojo/gris) se usa también en el PDF: puntitos por
    comida y un resumen de cumplimiento del rango en la última página. Ver
    la sección "Sistema de puntuación" más arriba para el detalle de las
    reglas.
18. Autenticación, "Modo Lectura" público y contraseñas. Posibilita separar la app entre dueños de la cuenta con posibilidad para editar la información y el resto (familiares, amigos o la nutricionista) que pueden observar todos los datos al enviarles el link, pero les desaparecen las herramientas de edición.
19. Panel invisible "admin" para gestionar usuarios, acceder a cuentas y ver listados.
20. Mejoras técnicas y estéticas importantes al **Motor de PDF**:
    - **Fetch en Paralelo:** Uso de `Promise.all` para descargar imágenes agrupadamente. Antes, con un bucle secuencial, generar muchos días hacía que se superaran los 10 segundos gratuitos de AWS Lambda en Netlify, provocando caídas opacas como `unexpected end of JSON input`.
    - **Manejo de errores seguro (Try/Catch global):** Todo el endpoint de generación procesado en bloques seguros que devuelven JSON amigable, y eliminación de la variable `__dirname` nativa por colisión e inyecciones de los propios bundlers de esbuild/Netlify.
    - **Estética fotográfica:** Implementación algorítmica y calculada para imitar **object-fit: cover**, encuadrando mediante el uso de operadores avanzados de clipping mask de `pdf-lib` la imagen, logrando el mismo formato cuadrado profesional en base a cualquier foto original (vertical o apaisada).
21. **Rediseño de Cabecera y Barra de Usuario Unificada:** Cabecera con marca, usuario activo, botón de alternancia de tema 🌙 / ☀️, accesos para contraseña, compartir link, salir y menú desplegable en una sola fila refinada y responsiva.
22. **Separación de Actividad Física con Modal Dedicado:** La tarjeta de actividad física en la vista principal muestra exclusivamente las actividades del día con contador y botón `＋ Agregar`, abriendo un modal estilizado para cargar tipo y notas o guardar opciones reutilizables.
23. **Panel de Progreso y Estadísticas Rediseñado:** Gráficos nativos vectoriales SVG (líneas y barras con tooltips) de peso, sueño y energía, sin dependencias externas frágiles, junto con tarjetas KPI de resumen y desglose de estrellas por comida.
24. **Navegación Rápida con Botón "Hoy" e Indicador Relativo:** Indicador del día respecto a la fecha actual (`Hoy`, `Ayer`, `Mañana`, `Hace X días`) y botón interactivo `📅 Volver a Hoy` que aparece cuando se exploran fechas pasadas o futuras para regresar al día de hoy en un solo clic.
25. **Banner de Resumen y Checklist Diario de Comidas:** Widget superior con barra de progreso porcentual (`0/4` a `4/4`), estado de cada comida (Desayuno, Almuerzo, Merienda, Cena) con checks interactivos que hacen scroll al plato correspondiente, cálculo de calificación promedio de estrellas y celebración al completar el día.
26. **Sistema de Registro y Acceso por Pestañas (Iniciar Sesión / Registrarme):** Pantalla de ingreso renovada con selector de pestañas que separa nítidamente el inicio de sesión y la creación de una cuenta nueva. El formulario de registro incluye campo de usuario (validación de formato 3-30 caracteres alfanuméricos), creación de contraseña, confirmación de contraseña repetida, validaciones en tiempo real y soporte en el backend (`/api/auth-login` con `modo: "register"`) para evitar colisiones con cuentas existentes.
27. **Compartir Resumen del Día por WhatsApp:** Generador de texto estructurado con emojis y formato Markdown de WhatsApp (comidas, ingredientes, estrellas, actividades y biométricos) con botón de envío directo a WhatsApp o copia rápida al portapapeles con toast. (Nota: el tracker de agua fue retirado de la interfaz y del resumen para simplificar el flujo visual).
28. **Modo Oscuro Integrado:** Alternador 🌙 / ☀️ en la cabecera, con paleta oscura slate contrastada (`#090D16`, `#161E31`) y sombras profundas, con persistencia automática en el navegador (`localStorage`) y respeto a las preferencias del sistema.
29. **Galería Visual de Platos (Foto-feed 📸):** Modal con visualización en cuadrícula de fotos recientes, filtros por tipo de comida (Desayuno, Almuerzo, Merienda, Cena, Extras), visualización en lightbox y botón de salto instantáneo para viajar a la fecha de cualquier foto.

## Limitaciones conocidas / decisiones tomadas

- Solo se aceptan fotos JPG o PNG (por la librería de generación de PDF).
- El rango del PDF está limitado a 62 días por generación (para no exceder
  el timeout de las funciones gratuitas de Netlify).
- Cualquier persona que conozca un nombre de usuario válido (`?u=pepe`) podrá visualizar tranquilamente sus datos y fotos, ya que el bloqueo de autenticación radica netamente en la **modificación** y escritura de datos. Además, las contraseñas se almacenan limpias para que sea más fácil recuperarlas manualmente por el administrador sin hashes (seguridad para ámbito familiar, no estricta).
- Como retrocompatibilidad, todos los usuarios creados antes del sistema de claves asumen que su clave es `123456`, de esta manera los usuarios veteranos no perdieron control sobre su cuenta.
- No hay todavía una pantalla para eliminar opciones guardadas (presets) de
  comida ni de actividad física desde la interfaz, aunque las funciones del
  servidor (`presets-delete.mjs`, `activity-presets-delete.mjs`) ya existen
  y se podrían conectar.
- La corrección de orientación EXIF cubre las 4 orientaciones típicas de
  cámara (normal, 180°, 90° y -90°); no cubre los casos "espejados" del
  estándar EXIF (valores 2, 4, 5, 7), que en la práctica casi no aparecen en
  fotos sacadas directo con la cámara del celular.
- El cálculo de racha (`progreso.mjs`) escanea hacia atrás día por día desde
  "hoy" con un tope de 120 días (`MAX_DIAS_RACHA`); una racha real más larga
  se muestra como "120+" en vez del número exacto, para no alargar
  demasiado el tiempo de respuesta de la función.
- Un día sin ninguna comida puntuada (gris) no rompe la racha pero tampoco
  la hace avanzar — es una decisión de diseño explícita, no un descuido.
- El PDF depende de que `netlify.toml` incluya
  `functions.included_files = ["netlify/functions/assets/**"]` para que el
  archivo de fuente viaje empaquetado junto con la función `generate-pdf`.
  Si en el futuro se agregan más archivos binarios a otras funciones (otra
  fuente, una imagen, etc.), hay que asegurarse de que también caigan dentro
  de ese patrón (o agregar uno nuevo) para que Netlify los incluya en el
  deploy.

## Cómo se despliega

El código vive en un repositorio de GitHub conectado a Netlify (Add new site
→ Import an existing project). Cada vez que se suben cambios al repositorio,
Netlify redespliega automáticamente. Netlify Blobs no requiere configuración
manual, se activa solo la primera vez que una función lo usa. Los cambios
que Claude prepara en una conversación (código nuevo) no se ven reflejados
en el sitio real hasta que se suben al repositorio y Netlify vuelve a
desplegar.

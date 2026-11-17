---
name: "SCA-QR"
description: "Registro escolar claro, verificable y recuperable durante la jornada."
colors:
  page: "#f7f8fa"
  surface: "#fff"
  text: "#202723"
  secondary: "#58615c"
  muted: "#66716b"
  line: "#e1e6e2"
  accent: "#1a694b"
  accent-hover: "#115437"
  accent-soft: "#eaf3ee"
  danger: "#a72e32"
  danger-soft: "#fff1f1"
  warning: "#87590b"
  warning-soft: "#fff6e4"
  focus: "#236fbe"
  field-border: "#cbd4cd"
  button-border: "#cfd7d1"
  control-hover: "#edf2ee"
  neutral-soft: "#edf1f5"
  neutral-text: "#3b546a"
  badge-success-text: "#19603f"
  badge-warning-text: "#82560c"
  badge-danger-text: "#9d3035"
  badge-neutral-soft: "#eef1f3"
  badge-neutral-text: "#53615a"
typography:
  display:
    fontFamily: '"Public Sans Variable", "Public Sans", sans-serif'
    fontSize: "46px"
    fontWeight: 500
    lineHeight: 1.15
    letterSpacing: "-0.035em"
  headline:
    fontFamily: '"Public Sans Variable", "Public Sans", sans-serif'
    fontSize: "38px"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "-0.035em"
  title:
    fontFamily: '"Public Sans Variable", "Public Sans", sans-serif'
    fontSize: "28px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.035em"
  section:
    fontFamily: '"Public Sans Variable", "Public Sans", sans-serif'
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.015em"
  body:
    fontFamily: '"Public Sans Variable", "Public Sans", sans-serif'
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
  label:
    fontFamily: '"Public Sans Variable", "Public Sans", sans-serif'
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.55
    letterSpacing: "normal"
  table:
    fontFamily: '"Public Sans Variable", "Public Sans", sans-serif'
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
  caption:
    fontFamily: '"Public Sans Variable", "Public Sans", sans-serif'
    fontSize: "10px"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
  metric:
    fontFamily: '"Public Sans Variable", "Public Sans", sans-serif'
    fontSize: "32px"
    fontWeight: 500
    lineHeight: 1.35
    letterSpacing: "-0.04em"
rounded:
  status: "5px"
  navigation: "6px"
  control: "7px"
  feedback: "8px"
  credential: "10px"
  surface: "12px"
  scan: "16px"
  circle: "50%"
spacing:
  micro: "4px"
  field-gap: "6px"
  compact: "8px"
  cluster: "12px"
  field: "16px"
  section: "20px"
  panel: "24px"
  dialog: "28px"
  gutter: "32px"
  page: "36px"
  empty: "48px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.surface}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "9px 14px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "9px 14px"
  button-secondary-hover:
    backgroundColor: "{colors.control-hover}"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.secondary}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "9px 14px"
  button-quiet-hover:
    backgroundColor: "{colors.control-hover}"
    textColor: "{colors.text}"
  button-icon:
    backgroundColor: "transparent"
    textColor: "{colors.secondary}"
    rounded: "{rounded.navigation}"
    width: "34px"
    height: "34px"
  button-icon-hover:
    backgroundColor: "{colors.control-hover}"
  button-text:
    backgroundColor: "transparent"
    textColor: "{colors.accent}"
    typography: "{typography.label}"
    padding: "4px 0"
  button-text-hover:
    textColor: "#104a2e"
  input-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "9px 12px"
    width: "100%"
  nav-item:
    backgroundColor: "transparent"
    textColor: "#59655e"
    typography: "{typography.label}"
    rounded: "{rounded.navigation}"
    padding: "0 12px"
    height: "36px"
  nav-item-active:
    backgroundColor: "{colors.accent-soft}"
    textColor: "#155c3e"
  status-badge:
    rounded: "{rounded.status}"
    padding: "3px 8px"
  status-badge-success:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.badge-success-text}"
  status-badge-warning:
    backgroundColor: "{colors.warning-soft}"
    textColor: "{colors.badge-warning-text}"
  status-badge-danger:
    backgroundColor: "{colors.danger-soft}"
    textColor: "{colors.badge-danger-text}"
  status-badge-neutral:
    backgroundColor: "{colors.badge-neutral-soft}"
    textColor: "{colors.badge-neutral-text}"
  surface:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.surface}"
  scan-feedback:
    rounded: "{rounded.feedback}"
    padding: "16px"
    width: "100%"
  scan-feedback-warning:
    backgroundColor: "{colors.warning-soft}"
    textColor: "{colors.warning}"
  scan-feedback-success:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent}"
  scan-feedback-danger:
    backgroundColor: "{colors.danger-soft}"
    textColor: "{colors.danger}"
---

# Design System: SCA-QR

## Overview

**Creative North Star: "Registro diario"**

«Registro diario» organiza la interfaz como un instrumento de trabajo escolar: navegación persistente, resumen legible y registros alineados. La personalidad es sobria, clara y directa. El blanco y los grises verdosos sostienen una densidad operativa; el verde identifica la selección y las acciones principales, y los colores semánticos explican el estado de cada registro.

El mismo lenguaje recorre acceso, administración y portería: Public Sans, iconos de trazo fino, cifras tabulares, separadores y esquinas moderadas. Las superficies se distinguen por tono y borde; la lectura y la recuperación de una acción tienen prioridad sobre la decoración. La señal principal de portería conserva la diferencia entre copia local, revisión y asistencia confirmada.

**Key Characteristics:**

- Superficie clara y tipografía única autoalojada.
- Tablas, filas y divisores para comparar registros.
- Verde para acción y selección; estados con texto explícito.
- Foco visible y continuidad por teclado entre apertura y cierre.
- Menú móvil y desplazamiento horizontal dentro de las tablas.

**Alcance y evidencia:** sistema extraído de `src/app/globals.css`, los componentes administrativos, las páginas de alumnos/resumen/acceso y `TerminalClient.tsx`. Se contrastaron las capturas existentes de escritorio y móvil y `.impeccable/review/metrics.json` (1440 y 390 px, datos sintéticos, sin errores registrados ni desbordamiento de página en esas vistas). Las comprobaciones de foco de creación/edición y del menú móvil dieron resultado correcto; `detector.json` estaba vacío. La dirección se implementó con código; el brief registra selección remota degradada, sin comp ni tarjeta QUALITY BAR. Esto documenta el sistema observado, sin afirmar aprobación estética del usuario, aceptación del colegio ni certificación ISO. Las políticas escolares y la compatibilidad del lector físico siguen pendientes de validación.

## Colors

Una sola familia verde de acción se combina con neutros claros y pares semánticos de advertencia y error. Los valores normativos están en el frontmatter; los nombres conservan la relación con las propiedades CSS del proyecto.

### Primary

- **Verde de operación** (`accent`): acciones principales, enlaces de acción y cifras positivas. `accent-hover` oscurece la interacción; `accent-soft` sostiene selección, confirmación y conexión disponible.

### Neutral

- **Fondo de jornada** (`page`), **superficie blanca** (`surface`) y **divisor** (`line`): base, bloques de trabajo y separación entre registros.
- **Texto principal** (`text`), **secundario** (`secondary`) y **auxiliar** (`muted`): jerarquía de lectura sin cambiar de familia tipográfica.
- **Borde de campo** (`field-border`), **borde de botón** (`button-border`) y **superficie de interacción** (`control-hover`): controles reconocibles sobre fondo claro.
- **Aviso informativo** (`neutral-soft`, `neutral-text`) y **estado neutro** (`badge-neutral-soft`, `badge-neutral-text`): información operativa o ausencia de una clasificación confirmada.

Los pares `warning`/`warning-soft` y `danger`/`danger-soft` distinguen espera, revisión y error. Las etiquetas compactas usan sus tres colores de texto específicos (`badge-success-text`, `badge-warning-text`, `badge-danger-text`). El azul `focus` queda reservado al contorno de teclado. No existe una paleta secundaria de marca.

**The Receipt Before Green Rule.** El aviso principal de portería solo presenta «Asistencia confirmada» en verde cuando el recibo reconoce persistencia duradera. Una copia local, una revisión o un resultado de demostración conserva su mensaje y tratamiento de advertencia.

Las rampas tonales de `.impeccable/design.json` son vistas auxiliares sintetizadas para el panel. No añaden tonos autorizados al CSS de la aplicación.

## Typography

**Display Font:** Public Sans Variable, Public Sans, sans-serif.
**Body Font:** Public Sans Variable, Public Sans, sans-serif.
**Label/Mono Font:** las etiquetas conservan Public Sans; solo los identificadores técnicos y hashes usan `monospace` (10–11 px).

**Character:** una sola familia de trabajo, con peso medio para acciones y cifras, y seminegrita para títulos. La jerarquía cambia por tamaño, peso y espacio, sin mayúsculas decorativas ni tipografía de exhibición añadida.

### Hierarchy

- **Display**: portada pública (46 px, 500, interlínea 1.15); baja a 38 px en móvil.
- **Headline**: mensaje lateral de acceso (38 px, 500, interlínea 1.2); baja a 30 px desde 950 px y se oculta su bloque desde 760 px.
- **Title**: título de página (28 px, 600, interlínea 1.25); 25 px desde 760 px. Acceso y portería usan 25 px también en escritorio.
- **Section**: encabezado de superficie (16 px, 600, interlínea 1.4). Los encabezados menores usan 14 px y 600.
- **Body**: base (14 px, 400, interlínea 1.55); los textos operativos de formularios y descripciones se reducen a 12–13 px. Las introducciones de página se limitan a 70ch; el mensaje de captura, a 45ch.
- **Label**: campos, botones y navegación (12 px, 500). Los campos interiores usan 12 px y 400.
- **Table / Caption**: filas (11 px), cabeceras y metadatos (10 px); las cabeceras usan 500. El pie llega a 9 px en móvil; es metadato auxiliar, no escala para instrucciones o acciones nuevas.
- **Metric**: resumen (32 px, 500, interlínea 1.35); 28 px desde 950 px y 30 px desde 760 px. El contador de incidencias usa 42 px; el reloj, 26 px y 21 px en móvil.

**The Tabular Record Rule.** Usar cifras tabulares en tablas, métricas y reloj para que las columnas conserven su alineación al cambiar los valores.

**Fuente y licencia:** `@fontsource-variable/public-sans` se importa en el CSS y se sirve desde los recursos del propio build. Public Sans pertenece a The Public Sans Project Authors y usa SIL Open Font License 1.1; conservar copyright y licencia al redistribuirla. Fuente verificada: `node_modules/@fontsource-variable/public-sans/LICENSE`. No se carga una tipografía desde un proveedor remoto durante el uso.

## Layout

La unidad dominante es 4 px, con ajustes de 5–7 px en etiquetas, bordes y controles. Las agrupaciones usan 8/12 px; formularios, 16 px; secciones, 20/24 px. El panel administrativo tiene navegación fija lateral (248 px), cabecera (64 px), área útil máxima (1504 px) y margen interior (36 px). Cada enlace lateral mide 36 px de alto. La franja de resumen distribuye cuatro métricas con divisores; el área de trabajo del resumen combina una columna flexible y una lateral de 280 px, separadas por 24 px.

- **Desde 1600 px:** el área administrativa aumenta su margen superior a 44 px y la columna lateral del resumen a 320 px.
- **Hasta 1200 px:** el margen de contenido y cabecera pasa a 28 px; el resumen usa lateral de 240 px y separación de 20 px. La vista de listado/editor se convierte en una columna: el editor de alumnos ocupa la primera fila y el listado la segunda. En anchos mayores el editor está a la derecha (340 px), con 24 px de separación.
- **Hasta 950 px:** la navegación lateral se reduce a 224 px; resumen y portería pasan a una columna principal. Los dos bloques auxiliares de portería se muestran en una fila de dos columnas.
- **Hasta 760 px:** el lateral se vuelve un menú de 248 px sobre una cortina; la cabecera mide 56 px. El contenido lleva 24 px verticales y 20 px horizontales, y las acciones del encabezado pasan debajo del título. El resumen usa una cuadrícula 2×2. Los bloques auxiliares de portería se apilan. El formulario de alumnos conserva dos columnas para pares cortos y filas completas para nombres, horario y estado.

Las tablas mantienen sus columnas y se desplazan dentro de su contenedor; no deben ensanchar el documento. Las herramientas se ajustan en varias líneas y la búsqueda ocupa el ancho disponible en móvil. El gráfico reduce etiquetas horarias secundarias desde 760 px y usa una altura de 220 px, frente a 252 px en escritorio.

Portería usa un contenedor máximo de 1320 px con 24/32 px de margen interior, una columna flexible y otra de 350 px; esta última pasa a 300 px desde 1200 px. En móvil el margen es 20/16 px y el área de lectura conserva un mínimo de 330 px de altura, frente a 370 px en escritorio. Acceso distribuye dos mitades; desde 760 px conserva una marca superior y un formulario centrado. La impresión elimina navegación y acciones, mantiene el carnet con QR de 220 px y evita partirlo.

## Elevation & Depth

El sistema es plano durante el trabajo diario: fondo, borde fino y espacio definen cada bloque. La navegación fija está sobre el contenido; el menú móvil añade una cortina sin animación de entrada. El diálogo nativo es la única superficie con sombra y oscurece el fondo.

### Shadow Vocabulary

- **Diálogo superpuesto** (`0 24px 80px #203a2929`): separación ambiental del diálogo de prueba del lector; su fondo exterior usa `#17221b66`. La cortina del menú móvil usa `#15221970`.

**The Flat Work Surface Rule.** Mantener planas las superficies de trabajo y separarlas con borde o tono. Reservar la sombra ambiental para el diálogo superpuesto que ya la utiliza.

## Shapes

Las esquinas son moderadas y dependen de la escala: etiqueta (5 px), navegación y botón de icono (6 px), botón/campo/aviso (7 px), respuesta de captura (8 px), carnet (10 px), superficie/diálogo/resumen (12 px) y fondo del símbolo de lectura (16 px). Los avatares son círculos. Los bloques de trabajo llevan bordes de 1 px; las superficies recortan su contenido y las tablas se separan por líneas. No convertir todas las piezas en píldoras.

## Components

### Buttons

Acciones compactas con texto explícito. El botón principal usa verde de operación y texto blanco; el secundario, blanco y borde; la variante discreta conserva fondo transparente. Comparten radio de control, margen interior (9/14 px), altura mínima (38 px), texto (12 px, 500) y separación de icono (8 px). El acceso usa una acción a todo el ancho y altura mínima de 42 px. El botón de icono es un cuadrado de 34 px con radio de 6 px; el enlace de acción usa margen vertical de 4 px y sin borde.

Los cambios de fondo, texto y borde duran 140 ms. El hover solo se aplica en dispositivos con puntero fino y capacidad de hover; el principal oscurece y los controles secundarios reciben un fondo suave. La pulsación escala el botón a 0.985. Los botones deshabilitados usan opacidad 0.5 y cursor de indisponibilidad. Movimiento reducido elimina transición, animación y escala de pulsación.

### Chips

Las etiquetas de estado llevan un punto y texto (10 px, 500), margen interior (3/8 px) y radio de estado. Hay cuatro familias: éxito, advertencia, error y neutro. Son indicadores, no filtros seleccionables. La conexión de portería usa una etiqueta más amplia (6/10 px, radio 6 px), verde disponible y ámbar sin conexión. Conservar el texto del estado; el color no lo sustituye.

### Cards / Containers

Superficies blancas con borde de divisor y radio de superficie. El encabezado lleva 20/24 px y el cuerpo 0/24/24 px; ambos pasan a 20 px laterales en móvil. Usar una superficie para un conjunto de datos o tarea, con filas y divisores en su interior. Los avisos tienen radio de control, margen interior (12/16 px), texto de 12 px y color semántico; los errores usan `role="alert"` y las confirmaciones `role="status"`. Los bloques de carga son barras estáticas; el vacío muestra un título, explicación y, cuando existe, acción.

### Inputs / Fields

Campos blancos, borde de campo de 1 px, radio de control, altura mínima de 40 px y margen interior (9/12 px). Cada campo conserva etiqueta enlazada por `id` y, si existe ayuda, `aria-describedby`. El foco visible global es un contorno azul de 3 px separado 3 px del control. La búsqueda sustituye el contorno del input por uno de 2 px, separado 2 px, sobre todo el contenedor. No hay un borde rojo de campo universal: la validación nativa y el aviso de error describen el problema.

Al abrir creación o edición de alumnos se enfoca «Código institucional»; desde 1200 px el editor se lleva al inicio visible antes de enfocar sin desplazamiento adicional. Cerrar, cancelar o guardar devuelve el foco al control que abrió el editor; si ese control ya no existe, vuelve a «Nuevo alumno». El acceso coloca el foco inicial en «Usuario».

### Navigation

Enlaces laterales con icono (18 px), texto (12 px, 500), radio de navegación y separación vertical de 4 px. La selección usa fondo verde suave, texto verde oscuro, indicador de avance y `aria-current="page"`. El hover distingue enlace normal y seleccionado. Existe un enlace «Saltar al contenido» que aparece al recibir foco.

El menú móvil usa un diálogo modal accesible, enfoca «Cerrar menú», contiene el recorrido de Tab, cierra con Escape, selección, cortina o botón y devuelve el foco a «Abrir menú». El contenido principal queda inerte mientras está abierto; el lateral permite desplazamiento vertical. No trasladar este comportamiento modal al lateral fijo de escritorio.

### Lectura y recuperación

El área de lectura centra icono, título y explicación; la respuesta aparece en una franja semántica con `role="status"`. La cola y los movimientos locales permanecen en bloques separados con hora y estado. «Reintentar pendientes» es una acción explícita y se deshabilita sin conexión o durante la operación. El diálogo de prueba identifica su carácter visual y la validación física pendiente; no convierte una prueba de interfaz en una captura escolar.

**Iconos y licencia:** usar Lucide mediante `lucide-react`, con trazo (1.6), tamaños habituales (15–21 px) y símbolo de captura (48 px). Los iconos de acción sin texto conservan nombre accesible; los ejemplos del sidecar incorporan SVG en línea. El paquete instalado usa ISC, copyright 2026 Lucide Icons and Contributors, y conserva MIT para iconos derivados de Feather, copyright Cole Bemis. Mantener ambos avisos según `node_modules/lucide-react/LICENSE` al redistribuir.

## Do's and Don'ts

### Do:

- **Do** reutilizar la paleta semántica y acompañar cada estado con una etiqueta de texto.
- **Do** mantener Public Sans autoalojada, cifras tabulares y la jerarquía compacta de títulos.
- **Do** conservar el foco visible, las etiquetas de los campos y los nombres accesibles de los botones de icono.
- **Do** colocar el editor de alumnos antes del listado desde 1200 px y devolver el foco al control que lo abrió.
- **Do** mantener el desplazamiento horizontal dentro de la tabla y comprobar que la página cabe en el viewport.
- **Do** respetar movimiento reducido y mantener las transiciones de estado breves.
- **Do** rotular los datos sintéticos y mantener los avisos de licencia al redistribuir fuentes e iconos.

### Don't:

- **Don't** presentar una captura pendiente o un resultado de demostración como asistencia confirmada.
- **Don't** añadir imágenes raster decorativas ni sustituir los iconos SVG por caracteres de texto.
- **Don't** añadir sombras a cada superficie ni contenedores repetidos cuando bastan filas y divisores.
- **Don't** eliminar el contorno de foco salvo que el contenedor del campo muestre el equivalente observado.
- **Don't** atribuir al colegio una identidad aprobada, cifras operativas reales, validación física del lector o certificación institucional a partir de estas muestras.

**No canonizado:** `--raised` y el estilo de botón destructivo existen en el CSS sin uso observado en las superficies terminadas; no se incorporan como reglas para ampliar la interfaz. La escala mínima del pie se registra como metadato existente, sin recomendarla para contenido de tarea. No se reparó código durante esta documentación.
